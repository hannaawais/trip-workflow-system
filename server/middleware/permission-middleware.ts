import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, departments, projects, tripRequests, adminRequests } from '@shared/schema';
import { eq, or, and, inArray, sql } from 'drizzle-orm';
import { createForbiddenError, createUnauthorizedError } from '../error-handler';

// Extend Express Request to include permission context
declare global {
  namespace Express {
    interface Request {
      permissions?: {
        userId: number;
        userRole: string;
        activeRole?: string;
        departmentName: string;
        managedDepartmentIds: number[];
        managedProjectIds: number[];
        canViewAll: boolean;
      };
    }
  }
}

/**
 * Centralized Permission Middleware
 * Automatically calculates and applies user permissions based on database relationships
 */
export class PermissionMiddleware {
  /**
   * Initialize permission context for authenticated user
   */
  static async initializePermissions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.isAuthenticated()) {
        throw createUnauthorizedError("Authentication required");
      }

      const user = req.user as any;
      const activeRole = (req.session as any)?.activeRole;
      const effectiveRole = activeRole || user.role;

      // Get user's complete database context
      const [userRecord] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));

      if (!userRecord || !userRecord.isActive) {
        throw createForbiddenError("User account is inactive");
      }

      // Calculate managed department IDs
      const managedDepartments = await db
        .select({ id: departments.id })
        .from(departments)
        .where(
          or(
            eq(departments.managerId, user.id),
            eq(departments.secondManagerId, user.id),
            eq(departments.thirdManagerId, user.id)
          )
        );

      // Calculate managed project IDs
      const managedProjectsQuery = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          or(
            eq(projects.managerId, user.id),
            eq(projects.secondManagerId, user.id)
          )
        );

      // Set permission context
      req.permissions = {
        userId: user.id,
        userRole: userRecord.role,
        activeRole,
        departmentName: userRecord.department,
        managedDepartmentIds: managedDepartments.map(d => d.id),
        managedProjectIds: managedProjectsQuery.map(p => p.id),
        canViewAll: effectiveRole === 'Admin' || effectiveRole === 'Finance'
      };

      console.log(`[Permission Context] User ${user.id} (${effectiveRole}):`, {
        department: userRecord.department,
        managedDepts: req.permissions.managedDepartmentIds.length,
        managedProjects: req.permissions.managedProjectIds.length,
        canViewAll: req.permissions.canViewAll
      });

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apply trip request filtering based on user permissions
   */
  static applyTripRequestFilter(baseQuery: any, permissions: NonNullable<Request['permissions']>) {
    if (permissions.canViewAll) {
      // Admin and Finance can see all trips
      return baseQuery;
    }

    if (permissions.userRole === 'Manager') {
      // Build conditions for manager access
      const conditions = [
        eq(tripRequests.userId, permissions.userId) // Own trips
      ];

      // Add managed department trips (only if has managed departments)
      if (permissions.managedDepartmentIds.length > 0) {
        conditions.push(
          inArray(tripRequests.departmentId, permissions.managedDepartmentIds)
        );
      }

      // Add managed project trips (only if has managed projects)
      if (permissions.managedProjectIds.length > 0) {
        conditions.push(
          inArray(tripRequests.projectId, permissions.managedProjectIds)
        );
      }

      console.log(`[Permission Filter] Manager ${permissions.userId} conditions: own trips + ${conditions.length - 1} management scopes`);
      return baseQuery.where(or(...conditions));
    }

    // Employees see only their own trips
    return baseQuery.where(eq(tripRequests.userId, permissions.userId));
  }

  /**
   * Apply admin request filtering based on user permissions
   */
  static applyAdminRequestFilter(baseQuery: any, permissions: NonNullable<Request['permissions']>) {
    if (permissions.canViewAll) {
      // Admin and Finance can see all admin requests
      return baseQuery;
    }

    if (permissions.userRole === 'Manager') {
      // Build conditions for manager access
      const conditions = [
        eq(adminRequests.userId, permissions.userId) // Own requests
      ];

      // For managed department requests, we need to check user's department
      if (permissions.managedDepartmentIds.length > 0) {
        // Add a subquery condition for requests from users in managed departments
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM users u 
            JOIN departments d ON u.department = d.name 
            WHERE u.id = ${adminRequests.userId} 
            AND d.id IN (${sql.join(permissions.managedDepartmentIds.map(id => sql`${id}`), sql`, `)})
          )`
        );
      }

      console.log(`[Permission Filter] Manager ${permissions.userId} admin request conditions: own + managed dept users`);
      return baseQuery.where(or(...conditions));
    }

    // Employees see only their own requests
    return baseQuery.where(eq(adminRequests.userId, permissions.userId));
  }

  /**
   * Apply department filtering based on user permissions
   */
  static applyDepartmentFilter(baseQuery: any, permissions: NonNullable<Request['permissions']>) {
    if (permissions.canViewAll) {
      // Admin and Finance can see all departments
      return baseQuery;
    }

    if (permissions.userRole === 'Manager') {
      // Managers see only departments they manage
      return baseQuery.where(
        inArray(departments.id, permissions.managedDepartmentIds)
      );
    }

    // Employees cannot access department data
    throw createForbiddenError("Insufficient permissions to access department data");
  }

  /**
   * Apply project filtering based on user permissions
   */
  static applyProjectFilter(baseQuery: any, permissions: NonNullable<Request['permissions']>) {
    if (permissions.canViewAll) {
      // Admin and Finance can see all projects
      return baseQuery;
    }

    if (permissions.userRole === 'Manager') {
      // Managers see projects they manage + projects in their department
      return baseQuery
        .leftJoin(departments, eq(projects.departmentId, departments.id))
        .where(
          or(
            // Projects they directly manage
            inArray(projects.id, permissions.managedProjectIds),
            // Projects in departments they manage
            inArray(departments.id, permissions.managedDepartmentIds)
          )
        );
    }

    // Employees can see all active projects for trip creation
    return baseQuery.where(eq(projects.isActive, true));
  }

  /**
   * Validate trip request access for specific operations - workflow-aware
   */
  static async validateTripRequestAccess(
    tripRequestId: number,
    permissions: NonNullable<Request['permissions']>,
    operation: 'view' | 'approve' | 'edit' = 'view'
  ): Promise<boolean> {
    // Admin and Finance have full access
    if (permissions.canViewAll) {
      return true;
    }

    // Use workflow-aware visibility check from PermissionService
    const { PermissionService } = await import('../permissions');
    const visibleTripIds = await PermissionService.getVisibleTripRequestIds(
      permissions.userId, 
      permissions.userRole, 
      permissions.activeRole
    );

    // Check if trip is in user's visible trips
    if (!visibleTripIds.includes(tripRequestId)) {
      return false;
    }

    // For approval operations, use workflow-aware approval check
    if (operation === 'approve') {
      const [tripRequest] = await db
        .select()
        .from(tripRequests)
        .where(eq(tripRequests.id, tripRequestId));
      
      if (!tripRequest) return false;
      
      return await PermissionService.canApproveTripRequest(
        permissions.userId,
        permissions.userRole,
        tripRequest,
        permissions.activeRole
      );
    }

    return true;
  }

  /**
   * Validate admin request access for specific operations
   */
  static async validateAdminRequestAccess(
    adminRequestId: number,
    permissions: NonNullable<Request['permissions']>,
    operation: 'view' | 'approve' | 'edit' = 'view'
  ): Promise<boolean> {
    // Admin and Finance have full access
    if (permissions.canViewAll) {
      return true;
    }

    const [adminRequest] = await db
      .select({
        id: adminRequests.id,
        userId: adminRequests.userId
      })
      .from(adminRequests)
      .leftJoin(users, eq(adminRequests.userId, users.id))
      .leftJoin(departments, eq(users.department, departments.name))
      .where(eq(adminRequests.id, adminRequestId));

    if (!adminRequest) {
      return false;
    }

    // Own requests are always accessible
    if (adminRequest.userId === permissions.userId) {
      return true;
    }

    // For managers, check if the request is from their managed department
    if (permissions.userRole === 'Manager') {
      const [requestUser] = await db
        .select({ department: users.department })
        .from(users)
        .where(eq(users.id, adminRequest.userId));

      if (requestUser) {
        const [userDepartment] = await db
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.name, requestUser.department));

        if (userDepartment && permissions.managedDepartmentIds.includes(userDepartment.id)) {
          return true;
        }
      }
    }

    return false;
  }
}

/**
 * Middleware function to be used in routes
 */
export const initializePermissions = PermissionMiddleware.initializePermissions;

/**
 * Helper function to ensure permissions are available
 */
export function requirePermissions(req: Request): NonNullable<Request['permissions']> {
  if (!req.permissions) {
    throw createForbiddenError("Permission context not initialized");
  }
  return req.permissions;
}