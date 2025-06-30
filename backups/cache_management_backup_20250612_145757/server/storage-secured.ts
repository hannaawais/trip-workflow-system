import { db } from "./db";
import { users, departments, projects, tripRequests, adminRequests, auditLogs, workflowSteps } from "@shared/schema";
import { eq, or, and, inArray, desc, sql, isNull } from "drizzle-orm";
import type { Request } from 'express';
import { PermissionMiddleware, requirePermissions } from './middleware/permission-middleware';

/**
 * Secured Storage Methods with Centralized Permission Enforcement
 * These methods automatically apply permission filtering at the database level
 * 
 * ====================================================================================
 * CRITICAL ARCHITECTURE DOCUMENTATION - READ BEFORE MODIFYING
 * ====================================================================================
 * 
 * HYBRID AUTHORIZATION MODEL FOR APPROVAL WORKFLOWS:
 * 
 * This file implements a dual authorization model to handle different approval types:
 * 
 * 1. USER-SPECIFIC ASSIGNMENTS (Department Managers):
 *    - Workflow steps created with specific `approver_id = userId`
 *    - Query matches: `eq(workflowSteps.approverId, permissions.userId)`
 *    - Used for: Department Manager approvals, Project Manager approvals
 * 
 * 2. ROLE-BASED AUTHORIZATION (Finance/Admin):
 *    - Workflow steps created with `approver_id = NULL`
 *    - Query matches: `isNull(workflowSteps.approverId) + role check`
 *    - Used for: Finance approval (any Finance team member can approve)
 * 
 * HISTORICAL ISSUE RESOLVED:
 * 
 * The Finance approval menu was broken because:
 * - Workflow generation creates Finance steps with `approver_id = NULL` (role-based)
 * - Approval execution supports role-based via: `step.approverId === null && role === 'Finance'`
 * - BUT approval retrieval only implemented user-specific matching: `eq(approverId, userId)`
 * - Result: Finance users never saw their pending approval steps
 * 
 * SOLUTION IMPLEMENTED:
 * 
 * Modified `getTripRequestsForApprovalSecured` to enforce SEQUENTIAL approval logic:
 * - Only shows trips where the user can approve the NEXT pending workflow step
 * - Prevents Finance users from seeing trips with pending Department Manager steps
 * - Maintains proper workflow sequence: Department → Project → Finance → Approved
 * - Supports both user-specific assignments and role-based authorization
 * 
 * Algorithm:
 * 1. Get all trips with pending workflow steps
 * 2. For each trip, find the first (lowest stepOrder) pending step
 * 3. Check if current user can approve that specific step
 * 4. Only include trips where user is authorized for the next step
 * 
 * BUSINESS REQUIREMENTS MAINTAINED:
 * - Finance approval remains team-based: ANY Finance user can approve pending Finance steps
 * - Department Manager approvals remain user-specific: ONLY assigned manager can approve
 * - Admin users have override access to both models
 * 
 * CONSISTENCY ACHIEVED:
 * - Approval retrieval logic now matches approval execution logic
 * - Same authorization rules applied across both workflow phases
 * - No architectural inconsistencies between data creation and data access
 * 
 * WARNING: DO NOT modify this authorization logic without understanding both models!
 * Breaking either model will cause approval menu visibility issues for entire user roles.
 * 
 * ====================================================================================
 */
export class SecuredStorage {
  
  /**
   * Get trip requests with automatic permission filtering - ROLE-BASED (for All Requests page)
   */
  static async getTripRequestsSecured(req: Request): Promise<any[]> {
    const permissions = requirePermissions(req);
    
    // Admin and Finance can see all trips
    if (permissions.canViewAll) {
      const results = await db
        .select({
          id: tripRequests.id,
          userId: tripRequests.userId,
          origin: tripRequests.origin,
          destination: tripRequests.destination,
          purpose: tripRequests.purpose,
          departmentId: tripRequests.departmentId,
          projectId: tripRequests.projectId,
          status: tripRequests.status,
          cost: tripRequests.cost,
          kilometers: tripRequests.kilometers,
          urgencyType: tripRequests.urgencyType,
          tripType: tripRequests.tripType,
          createdAt: tripRequests.createdAt,
          tripDate: tripRequests.tripDate,
          paid: tripRequests.paid,
          userName: users.username,
          fullName: users.fullName,
          departmentName: departments.name,
          projectName: projects.name
        })
        .from(tripRequests)
        .leftJoin(users, eq(tripRequests.userId, users.id))
        .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
        .leftJoin(projects, eq(tripRequests.projectId, projects.id))
        .orderBy(desc(tripRequests.createdAt));
      
      console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) accessed ${results.length} trip requests (all access)`);
      return results;
    }

    // For managers, use relationship-based filtering (own + managed scope)
    if (permissions.userRole === 'Manager') {
      const queryConditions = [eq(tripRequests.userId, permissions.userId)]; // Own trips
      
      if (permissions.managedDepartmentIds.length > 0) {
        queryConditions.push(inArray(tripRequests.departmentId, permissions.managedDepartmentIds));
      }
      
      if (permissions.managedProjectIds.length > 0) {
        queryConditions.push(inArray(tripRequests.projectId, permissions.managedProjectIds));
      }
      
      const results = await db
        .select({
          id: tripRequests.id,
          userId: tripRequests.userId,
          origin: tripRequests.origin,
          destination: tripRequests.destination,
          purpose: tripRequests.purpose,
          departmentId: tripRequests.departmentId,
          projectId: tripRequests.projectId,
          status: tripRequests.status,
          cost: tripRequests.cost,
          kilometers: tripRequests.kilometers,
          urgencyType: tripRequests.urgencyType,
          tripType: tripRequests.tripType,
          createdAt: tripRequests.createdAt,
          tripDate: tripRequests.tripDate,
          paid: tripRequests.paid,
          userName: users.username,
          fullName: users.fullName,
          departmentName: departments.name,
          projectName: projects.name
        })
        .from(tripRequests)
        .leftJoin(users, eq(tripRequests.userId, users.id))
        .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
        .leftJoin(projects, eq(tripRequests.projectId, projects.id))
        .where(or(...queryConditions))
        .orderBy(desc(tripRequests.createdAt));
      
      console.log(`[Secured Storage] User ${permissions.userId} (Manager) accessed ${results.length} trip requests (filtered: own + managed scope)`);
      return results;
    }
    
    // Employees see only their own trips
    const results = await db
      .select({
        id: tripRequests.id,
        userId: tripRequests.userId,
        origin: tripRequests.origin,
        destination: tripRequests.destination,
        purpose: tripRequests.purpose,
        departmentId: tripRequests.departmentId,
        projectId: tripRequests.projectId,
        status: tripRequests.status,
        cost: tripRequests.cost,
        kilometers: tripRequests.kilometers,
        urgencyType: tripRequests.urgencyType,
        tripType: tripRequests.tripType,
        createdAt: tripRequests.createdAt,
        tripDate: tripRequests.tripDate,
        paid: tripRequests.paid,
        userName: users.username,
        fullName: users.fullName,
        departmentName: departments.name,
        projectName: projects.name
      })
      .from(tripRequests)
      .leftJoin(users, eq(tripRequests.userId, users.id))
      .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
      .leftJoin(projects, eq(tripRequests.projectId, projects.id))
      .where(eq(tripRequests.userId, permissions.userId))
      .orderBy(desc(tripRequests.createdAt));

    console.log(`[Secured Storage] User ${permissions.userId} (Employee) accessed ${results.length} trip requests (own only)`);
    return results;
  }

  /**
   * Get trip requests for APPROVAL workflows - STRICT workflow-only filtering
   */
  static async getTripRequestsForApprovalSecured(req: Request): Promise<any[]> {
    const permissions = requirePermissions(req);
    
    // Get trips where user can approve the NEXT pending workflow step (sequential approval)
    const allPendingTrips = await db
      .selectDistinct({ tripRequestId: workflowSteps.tripRequestId })
      .from(workflowSteps)
      .where(eq(workflowSteps.status, 'Pending'));

    const eligibleTripIds = [];
    
    for (const trip of allPendingTrips) {
      // Get all pending steps for this trip, ordered by step_order
      const pendingSteps = await db
        .select()
        .from(workflowSteps)
        .where(
          and(
            eq(workflowSteps.tripRequestId, trip.tripRequestId),
            eq(workflowSteps.status, 'Pending')
          )
        )
        .orderBy(workflowSteps.stepOrder);
      
      if (pendingSteps.length === 0) continue;
      
      // Check if user can approve the FIRST (next) pending step
      const nextStep = pendingSteps[0];
      
      const canApproveThisStep = 
        // User-specific assignment
        nextStep.approverId === permissions.userId ||
        // Role-based Finance/Admin authorization
        (nextStep.approverId === null && 
         nextStep.stepType === 'Finance Approval' && 
         (permissions.userRole === 'Finance' || permissions.userRole === 'Admin'));
      
      if (canApproveThisStep) {
        eligibleTripIds.push(trip.tripRequestId);
      }
    }

    if (eligibleTripIds.length === 0) {
      console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) has no trips ready for their approval in workflow sequence`);
      return [];
    }

    // Get the actual trip data for eligible trips
    const workflowTrips = eligibleTripIds.map(id => ({ tripRequestId: id }));
    
    if (workflowTrips.length === 0) {
      console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) has no trips pending approval in workflow steps`);
      return [];
    }
    
    const tripIds = eligibleTripIds;
    
    // Get trip details for approval-eligible trips only
    const results = await db
      .select({
        id: tripRequests.id,
        userId: tripRequests.userId,
        destination: tripRequests.destination,
        purpose: tripRequests.purpose,
        departmentId: tripRequests.departmentId,
        projectId: tripRequests.projectId,
        status: tripRequests.status,
        cost: tripRequests.cost,
        kilometers: tripRequests.kilometers,
        urgencyType: tripRequests.urgencyType,
        tripType: tripRequests.tripType,
        createdAt: tripRequests.createdAt,
        tripDate: tripRequests.tripDate,
        paid: tripRequests.paid,
        userName: users.username,
        fullName: users.fullName,
        departmentName: departments.name,
        projectName: projects.name
      })
      .from(tripRequests)
      .leftJoin(users, eq(tripRequests.userId, users.id))
      .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
      .leftJoin(projects, eq(tripRequests.projectId, projects.id))
      .where(inArray(tripRequests.id, tripIds))
      .orderBy(desc(tripRequests.createdAt));
    
    console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) accessed ${results.length} trip requests (strict workflow-only approval scope)`);
    console.log(`[Approval Debug] User ${permissions.userId} assigned to trips: [${tripIds.join(', ')}]`);
    return results;
  }
  
  /**
   * Get admin requests with automatic permission filtering
   */
  static async getAdminRequestsSecured(req: Request): Promise<any[]> {
    const permissions = requirePermissions(req);
    
    let query = db
      .select({
        id: adminRequests.id,
        userId: adminRequests.userId,
        subject: adminRequests.subject,
        description: adminRequests.description,
        requestType: adminRequests.requestType,
        status: adminRequests.status,
        createdAt: adminRequests.createdAt,
        userName: users.username,
        fullName: users.fullName,
        userDepartment: users.department
      })
      .from(adminRequests)
      .leftJoin(users, eq(adminRequests.userId, users.id));

    // Apply permission-based filtering
    query = PermissionMiddleware.applyAdminRequestFilter(query, permissions);

    const results = await query.orderBy(desc(adminRequests.createdAt));
    console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) accessed ${results.length} admin requests`);
    return results;
  }

  /**
   * Get departments with automatic permission filtering
   */
  static async getDepartmentsSecured(req: Request): Promise<any[]> {
    const permissions = requirePermissions(req);
    
    let query = db
      .select({
        id: departments.id,
        name: departments.name,
        budget: departments.budget,
        managerId: departments.managerId,
        isActive: departments.isActive,
        managerName: users.fullName
      })
      .from(departments)
      .leftJoin(users, eq(departments.managerId, users.id));

    // Apply permission-based filtering
    query = PermissionMiddleware.applyDepartmentFilter(query, permissions);

    const results = await query.orderBy(departments.name);
    console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) accessed ${results.length} departments`);
    return results;
  }

  /**
   * Get projects with automatic permission filtering
   */
  static async getProjectsSecured(req: Request): Promise<any[]> {
    const permissions = requirePermissions(req);
    
    let query = db
      .select({
        id: projects.id,
        name: projects.name,
        departmentId: projects.departmentId,
        managerId: projects.managerId,
        budget: projects.budget,
        startDate: projects.startDate,
        endDate: projects.endDate,
        isActive: projects.isActive,
        departmentName: departments.name,
        managerName: users.fullName
      })
      .from(projects)
      .leftJoin(departments, eq(projects.departmentId, departments.id))
      .leftJoin(users, eq(projects.managerId, users.id));

    // Apply permission-based filtering
    query = PermissionMiddleware.applyProjectFilter(query, permissions);

    const results = await query.orderBy(projects.name);
    console.log(`[Secured Storage] User ${permissions.userId} (${permissions.userRole}) accessed ${results.length} projects`);
    return results;
  }

  /**
   * Validate and get single trip request with permission check
   */
  static async getTripRequestSecured(req: Request, tripRequestId: number): Promise<any | null> {
    const permissions = requirePermissions(req);
    
    // First validate access
    const hasAccess = await PermissionMiddleware.validateTripRequestAccess(
      tripRequestId, 
      permissions,
      'view'
    );
    
    if (!hasAccess) {
      console.log(`[Secured Storage] User ${permissions.userId} denied access to trip request ${tripRequestId}`);
      return null;
    }
    
    const [result] = await db
      .select({
        id: tripRequests.id,
        userId: tripRequests.userId,
        destination: tripRequests.destination,
        purpose: tripRequests.purpose,
        departmentId: tripRequests.departmentId,
        projectId: tripRequests.projectId,
        status: tripRequests.status,
        cost: tripRequests.cost,
        kilometers: tripRequests.kilometers,
        urgencyType: tripRequests.urgencyType,
        tripType: tripRequests.tripType,
        createdAt: tripRequests.createdAt,
        tripDate: tripRequests.tripDate,
        paid: tripRequests.paid,
        userName: users.username,
        fullName: users.fullName,
        departmentName: departments.name,
        projectName: projects.name
      })
      .from(tripRequests)
      .leftJoin(users, eq(tripRequests.userId, users.id))
      .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
      .leftJoin(projects, eq(tripRequests.projectId, projects.id))
      .where(eq(tripRequests.id, tripRequestId));

    console.log(`[Secured Storage] User ${permissions.userId} accessed trip request ${tripRequestId}`);
    return result || null;
  }

  /**
   * Validate and get single admin request with permission check
   */
  static async getAdminRequestSecured(req: Request, adminRequestId: number): Promise<any | null> {
    const permissions = requirePermissions(req);
    
    // First validate access
    const hasAccess = await PermissionMiddleware.validateAdminRequestAccess(
      adminRequestId, 
      permissions,
      'view'
    );
    
    if (!hasAccess) {
      console.log(`[Secured Storage] User ${permissions.userId} denied access to admin request ${adminRequestId}`);
      return null;
    }
    
    const [result] = await db
      .select({
        id: adminRequests.id,
        userId: adminRequests.userId,
        subject: adminRequests.subject,
        description: adminRequests.description,
        requestType: adminRequests.requestType,
        status: adminRequests.status,
        createdAt: adminRequests.createdAt,
        userName: users.username,
        fullName: users.fullName,
        userDepartment: users.department
      })
      .from(adminRequests)
      .leftJoin(users, eq(adminRequests.userId, users.id))
      .where(eq(adminRequests.id, adminRequestId));

    console.log(`[Secured Storage] User ${permissions.userId} accessed admin request ${adminRequestId}`);
    return result || null;
  }

  /**
   * Validate approval permissions for trip requests
   */
  static async validateTripApprovalPermission(req: Request, tripRequestId: number): Promise<boolean> {
    const permissions = requirePermissions(req);
    
    return await PermissionMiddleware.validateTripRequestAccess(
      tripRequestId, 
      permissions,
      'approve'
    );
  }

  /**
   * Validate approval permissions for admin requests
   */
  static async validateAdminApprovalPermission(req: Request, adminRequestId: number): Promise<boolean> {
    const permissions = requirePermissions(req);
    
    return await PermissionMiddleware.validateAdminRequestAccess(
      adminRequestId, 
      permissions,
      'approve'
    );
  }

  /**
   * Get user statistics with permission context
   */
  static async getUserStatsSecured(req: Request): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
  }> {
    const permissions = requirePermissions(req);
    
    // Get all visible trip requests for the user
    const trips = await SecuredStorage.getTripRequestsSecured(req);
    
    const stats = {
      totalRequests: trips.length,
      pendingRequests: trips.filter(t => ['Pending', 'Under Review', 'Awaiting Finance Approval'].includes(t.status)).length,
      approvedRequests: trips.filter(t => t.status === 'Approved').length,
      rejectedRequests: trips.filter(t => t.status === 'Rejected').length
    };
    
    console.log(`[Secured Storage] User ${permissions.userId} stats: ${JSON.stringify(stats)}`);
    return stats;
  }

  /**
   * Create audit log with permission context
   */
  static async createSecuredAuditLog(
    req: Request,
    action: string,
    details?: any
  ): Promise<void> {
    const permissions = requirePermissions(req);
    
    await db.insert(auditLogs).values({
      userId: permissions.userId,
      action,
      details,
      createdAt: new Date()
    });
    
    console.log(`[Secured Storage] Audit log created for user ${permissions.userId}: ${action}`);
  }
}