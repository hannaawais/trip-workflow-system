import { db } from "./db";
import { users, departments, projects, tripRequests, adminRequests, workflowSteps } from "@shared/schema";
import { eq, sql, or, and, desc, isNull } from "drizzle-orm";

export class PermissionService {
  /**
   * Get all trip request IDs that a user can view based on their role and relationships - database-first approach
   */
  static async getVisibleTripRequestIds(userId: number, userRole: string, activeRole?: string): Promise<number[]> {
    // Check user's role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) {
      console.log(`[Permission Debug] User ${userId} not found in database`);
      return [];
    }
    
    const dbUserRole = user[0].role;
    console.log(`[Permission Debug] User ${userId} has role: ${dbUserRole}, department: ${user[0].department}`);
    
    // Admin and Finance can see all trips
    if (dbUserRole === "Admin" || dbUserRole === "Finance") {
      const allTrips = await db.select({ id: tripRequests.id }).from(tripRequests);
      return allTrips.map(trip => trip.id);
    }
    
    // Check if user has management relationships for viewing trips (only for Managers)
    if (dbUserRole === "Manager") {
      // Get trips where user is in the workflow OR owns the trip OR manages department for department-only trips
      const visibleTripIds = new Set<number>();
      
      // 1. Get user's own trips
      const ownTrips = await db
        .select({ id: tripRequests.id })
        .from(tripRequests)
        .where(eq(tripRequests.userId, userId));
      
      ownTrips.forEach(trip => visibleTripIds.add(trip.id));
      
      // 2. Get trips where user is assigned to any workflow step
      const workflowTrips = await db
        .selectDistinct({ tripRequestId: workflowSteps.tripRequestId })
        .from(workflowSteps)
        .where(eq(workflowSteps.approverId, userId));
      
      workflowTrips.forEach(trip => visibleTripIds.add(trip.tripRequestId));
      
      // 3. Get ALL trips from managed departments (not just department-only)
      const managedDepartmentTrips = await db
        .selectDistinct({ id: tripRequests.id })
        .from(tripRequests)
        .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
        .where(
          or(
            eq(departments.managerId, userId),
            eq(departments.secondManagerId, userId),
            eq(departments.thirdManagerId, userId)
          )
        );
      
      managedDepartmentTrips.forEach(trip => visibleTripIds.add(trip.id));
      
      // 4. Get trips from managed projects
      const managedProjectTrips = await db
        .selectDistinct({ id: tripRequests.id })
        .from(tripRequests)
        .leftJoin(projects, eq(tripRequests.projectId, projects.id))
        .where(
          or(
            eq(projects.managerId, userId),
            eq(projects.secondManagerId, userId)
          )
        );
      
      managedProjectTrips.forEach(trip => visibleTripIds.add(trip.id));
      
      const visibleTrips = Array.from(visibleTripIds).map(id => ({ id }));
      
      console.log(`[Permission Debug] Manager ${userId} can see ${visibleTrips.length} trips (expanded permissions)`);
      console.log(`[Permission Debug] Manager ${userId} visible trip IDs: ${visibleTrips.map(t => t.id).slice(0, 10).join(', ')}${visibleTrips.length > 10 ? '...' : ''}`);
      return visibleTrips.map(trip => trip.id);
    }
    
    // Employees can only see their own trips - use optimized query
    const userTrips = await db.select({ id: tripRequests.id })
      .from(tripRequests)
      .where(eq(tripRequests.userId, userId));
    
    console.log(`[Permission Debug] Employee ${userId} can see ${userTrips.length} trips (optimized query)`);
    return userTrips.map(trip => trip.id);
  }

  /**
   * Get all admin request IDs that a user can view based on their role and relationships - database-first approach
   */
  static async getVisibleAdminRequestIds(userId: number, userRole: string, activeRole?: string): Promise<number[]> {
    // Check user's role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return [];
    
    const dbUserRole = user[0].role;
    
    // Admin can see all admin requests
    if (dbUserRole === "Admin") {
      const allRequests = await db.select({ id: adminRequests.id }).from(adminRequests);
      return allRequests.map(req => req.id);
    }
    
    // Finance can see all admin requests for approval
    if (dbUserRole === "Finance") {
      const allRequests = await db.select({ id: adminRequests.id }).from(adminRequests);
      return allRequests.map(req => req.id);
    }
    
    // Check if user has management relationships for viewing admin requests (only for Managers)
    if (dbUserRole === "Manager") {
      // First get their own requests
      const ownRequests = await db
        .select({ id: adminRequests.id })
        .from(adminRequests)
        .where(eq(adminRequests.userId, userId));
      
      // Then get requests from managed departments
      const managedDepartmentRequests = await db
        .selectDistinct({ id: adminRequests.id })
        .from(adminRequests)
        .leftJoin(users, eq(adminRequests.userId, users.id))
        .leftJoin(departments, eq(users.department, departments.name))
        .where(
          or(
            eq(departments.managerId, userId),
            eq(departments.secondManagerId, userId),
            eq(departments.thirdManagerId, userId)
          )
        );
      
      // Get requests related to projects they manage
      const managedProjectRequests = await db
        .selectDistinct({ id: adminRequests.id })
        .from(adminRequests)
        .innerJoin(projects, and(
          eq(adminRequests.targetType, 'project'),
          eq(adminRequests.targetId, projects.id)
        ))
        .where(
          and(
            eq(adminRequests.targetType, 'project'),
            or(
              eq(projects.managerId, userId),
              eq(projects.secondManagerId, userId)
            )
          )
        );
      
      // Combine all sets and remove duplicates
      const allIds = [
        ...ownRequests.map(r => r.id), 
        ...managedDepartmentRequests.map(r => r.id),
        ...managedProjectRequests.map(r => r.id)
      ];
      return Array.from(new Set(allIds));
    }
    
    // Employees can only see their own requests
    const userRequests = await db.select({ id: adminRequests.id })
      .from(adminRequests)
      .where(eq(adminRequests.userId, userId));
    
    return userRequests.map(req => req.id);
  }

  /**
   * Check if user can manage users - database-first approach
   */
  static async canManageUsers(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has admin capabilities in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user.length > 0 && user[0].role === "Admin";
  }

  /**
   * Check if user can manage departments - database-first approach
   */
  static async canManageDepartments(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has admin capabilities in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user.length > 0 && user[0].role === "Admin";
  }

  /**
   * Check if user can manage projects - database-first approach
   */
  static async canManageProjects(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has manager relationships in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return false;
    
    // Admin can manage all projects
    if (user[0].role === "Admin") return true;
    
    // Check if user has project or department management relationships
    const managerRelationships = await db.select({
      projectId: projects.id,
      departmentId: departments.id
    })
    .from(projects)
    .fullJoin(departments, or(
      eq(departments.managerId, userId),
      eq(departments.secondManagerId, userId),
      eq(departments.thirdManagerId, userId)
    ))
    .where(
      or(
        eq(projects.managerId, userId),
        eq(projects.secondManagerId, userId)
      )
    );
    
    return managerRelationships.length > 0;
  }

  /**
   * Check if user can manage finance operations - database-first approach
   */
  static async canManageFinance(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has finance or admin role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return false;
    
    const dbUserRole = user[0].role;
    return dbUserRole === "Finance" || dbUserRole === "Admin";
  }

  /**
   * Check if user can create trip requests
   */
  static async canCreateTripRequest(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    const effectiveRole = activeRole || userRole;
    
    // Only Employees can create trip requests
    // Managers must switch to Employee role to create trips
    return effectiveRole === 'Employee';
  }

  /**
   * Check if user can view a specific trip request
   */
  static async canViewTripRequest(userId: number, userRole: string, tripRequestId: number, activeRole?: string): Promise<boolean> {
    const visibleTripIds = await this.getVisibleTripRequestIds(userId, userRole, activeRole);
    return visibleTripIds.includes(tripRequestId);
  }

  /**
   * Check if user can approve a specific trip request - workflow-aware approach
   */
  static async canApproveTripRequest(userId: number, userRole: string, tripRequest: any, activeRole?: string): Promise<boolean> {
    // Check user's role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return false;
    
    const dbUserRole = user[0].role;
    
    // Admin can approve any trip (override for administrative purposes)
    if (dbUserRole === "Admin") {
      return true;
    }
    
    // Use workflow-aware approval logic - check if user is assigned to current pending step
    return await this.canUserApproveRequest(userId, dbUserRole, tripRequest.id, 'trip');
  }

  /**
   * Check if user can manage system settings - database-first approach
   */
  static async canManageSystemSettings(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has admin role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user.length > 0 && user[0].role === "Admin";
  }

  /**
   * Check if user can manage KM rates - database-first approach
   */
  static async canManageKmRates(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has admin or finance role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return false;
    
    return user[0].role === "Admin" || user[0].role === "Finance";
  }

  /**
   * Check if user can manage sites - database-first approach
   */
  static async canManageSites(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has admin role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user.length > 0 && user[0].role === "Admin";
  }

  /**
   * Check if user can view audit logs - database-first approach
   */
  static async canViewAuditLogs(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has admin role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user.length > 0 && user[0].role === "Admin";
  }

  /**
   * Check if user can approve trip requests for Finance - database-first approach
   */
  static async canFinanceApprove(userId: number, userRole: string, activeRole?: string): Promise<boolean> {
    // Check if user has finance role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user.length > 0 && user[0].role === "Finance";
  }

  /**
   * Workflow-aware permission check - only allows approval if user is assigned to current pending step
   */
  static async canUserApproveRequest(userId: number, role: string, requestId: number, requestType: 'trip' | 'admin'): Promise<boolean> {
    // Check user's role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return false;
    
    const dbUserRole = user[0].role;
    
    // Admin can approve anything (administrative override)
    if (dbUserRole === "Admin") {
      return true;
    }
    
    if (requestType === 'trip') {
      // Get current pending workflow steps for this trip
      const pendingSteps = await db
        .select()
        .from(workflowSteps)
        .where(
          and(
            eq(workflowSteps.tripRequestId, requestId),
            eq(workflowSteps.status, 'Pending')
          )
        )
        .orderBy(workflowSteps.stepOrder);
      
      if (pendingSteps.length === 0) return false;
      
      // Get the next pending step (lowest stepOrder among pending steps)
      const currentStep = pendingSteps[0];
      
      // Check if user can approve this specific step type
      if (currentStep.stepType === 'Finance Approval' && dbUserRole === 'Finance') {
        return true;
      }
      
      if (currentStep.stepType === 'Department Manager') {
        // Check if user is the department manager for this trip
        const tripRequest = await db.select().from(tripRequests).where(eq(tripRequests.id, requestId));
        if (tripRequest.length === 0) return false;
        
        const [department] = await db.select().from(departments).where(eq(departments.id, tripRequest[0].departmentId));
        if (department && (department.managerId === userId || 
                          department.secondManagerId === userId || 
                          department.thirdManagerId === userId)) {
          return true;
        }
      }
      
      if (currentStep.stepType === 'Project Manager' || currentStep.stepType === 'Second Project Manager') {
        // Check if user is the project manager for this trip
        const tripRequest = await db.select().from(tripRequests).where(eq(tripRequests.id, requestId));
        if (tripRequest.length === 0) return false;
        
        if (tripRequest[0].projectId) {
          const [project] = await db.select().from(projects).where(eq(projects.id, tripRequest[0].projectId));
          if (project && (project.managerId === userId || 
                         project.secondManagerId === userId)) {
            return true;
          }
        }
      }
      
      // Handle other workflow step types as needed
      if (currentStep.stepType === 'Second Department Manager') {
        const tripRequest = await db.select().from(tripRequests).where(eq(tripRequests.id, requestId));
        if (tripRequest.length === 0) return false;
        
        const [department] = await db.select().from(departments).where(eq(departments.id, tripRequest[0].departmentId));
        if (department && department.secondManagerId === userId) {
          return true;
        }
      }
      
      if (currentStep.stepType === 'Tertiary Department Manager') {
        const tripRequest = await db.select().from(tripRequests).where(eq(tripRequests.id, requestId));
        if (tripRequest.length === 0) return false;
        
        const [department] = await db.select().from(departments).where(eq(departments.id, tripRequest[0].departmentId));
        if (department && department.thirdManagerId === userId) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if user can create project for specific department - database-first approach
   */
  static async canCreateProjectForDepartment(userId: number, userRole: string, departmentId: number, activeRole?: string): Promise<boolean> {
    // Check user's role in database
    const user = await db.select().from(users).where(eq(users.id, userId));
    if (user.length === 0) return false;
    
    // Admin can create projects for any department
    if (user[0].role === "Admin") {
      return true;
    }
    
    // Check if user has management relationship with department
    const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
    if (department && (department.managerId === userId || 
                      department.secondManagerId === userId || 
                      department.thirdManagerId === userId)) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if user can create project for specific department by name - database-first approach
   */
  static async canCreateProjectForDepartmentByName(userId: number, userRole: string, departmentName: string, activeRole?: string): Promise<boolean> {
    // Check database relationships to determine permission
    const [department] = await db.select().from(departments).where(eq(departments.name, departmentName));
    if (!department) return false;
    
    // Check if user has management relationship with department
    return department.managerId === userId || 
           department.secondManagerId === userId || 
           department.thirdManagerId === userId;
  }

  /**
   * Check if a user can switch between roles - database-first approach
   */
  static async canSwitchRoles(userId: number, userRole: string): Promise<boolean> {
    // Check if user has manager relationships in database
    const managerRelationships = await db.select({
      departmentId: departments.id
    })
    .from(departments)
    .where(
      or(
        eq(departments.managerId, userId),
        eq(departments.secondManagerId, userId),
        eq(departments.thirdManagerId, userId)
      )
    );
    
    return managerRelationships.length > 0;
  }

  /**
   * Get available roles for user based on database relationships
   */
  static async getAvailableRoles(userId: number, userRole: string): Promise<string[]> {
    const baseRole = userRole;
    const availableRoles = [baseRole];
    
    // Check if user has manager relationships to allow Employee role switching
    const canSwitch = await this.canSwitchRoles(userId, userRole);
    if (canSwitch && baseRole === "Manager") {
      availableRoles.push("Employee");
    }
    
    return availableRoles;
  }

  /**
   * Get all valid system roles
   */
  static async getValidRoles(): Promise<string[]> {
    return ["Employee", "Manager", "Finance", "Admin"];
  }

  /**
   * Generate workflow steps for a trip request based on database relationships
   */
  static async generateWorkflowSteps(tripRequest: any): Promise<any[]> {
    const workflowSteps: any[] = [];
    let stepOrder = 1;

    // Get database entities
    const allDepartments = await db.select().from(departments);
    const allProjects = await db.select().from(projects);
    
    // Get configurable KM limit from system settings
    const { storage } = await import("./storage");
    const maxKmSetting = await storage.getSystemSetting('maxKilometers');
    const maxKilometersLimit = maxKmSetting ? parseInt(maxKmSetting.settingValue) : 50;
    
    // Determine if this is an urgent trip
    const isUrgentTrip = tripRequest.tripType === 'Urgent' || tripRequest.urgencyType === 'Urgent';

    if (tripRequest.projectId) {
      // Project-based workflow
      const project = allProjects.find(p => p.id === tripRequest.projectId);
      if (project) {
        if (project.managerId) {
          workflowSteps.push({
            stepOrder: stepOrder++,
            stepType: 'Project Manager',
            approverId: project.managerId,
            approverName: 'Project Manager',
            status: 'Pending',
            isRequired: true
          });
        }

        if (project.secondManagerId) {
          workflowSteps.push({
            stepOrder: stepOrder++,
            stepType: 'Second Project Manager',
            approverId: project.secondManagerId,
            approverName: 'Second Project Manager',
            status: 'Pending',
            isRequired: true
          });
        }
      }
    } else if (!isUrgentTrip) {
      // Department-based workflow (only for non-urgent trips without project)
      // If departmentId is null, try to find department by user's department
      let department;
      if (tripRequest.departmentId) {
        department = allDepartments.find(d => d.id === tripRequest.departmentId);
      } else if (tripRequest.userId) {
        // Fallback: get department from user's record
        const { storage } = await import("./storage");
        const user = await storage.getUser(tripRequest.userId);
        if (user?.department) {
          department = allDepartments.find(d => d.name === user.department);
        }
      }
      if (department) {
        if (department.managerId) {
          workflowSteps.push({
            stepOrder: stepOrder++,
            stepType: 'Department Manager',
            approverId: department.managerId,
            approverName: 'Department Manager',
            status: 'Pending',
            isRequired: true
          });
        }

        if (department.secondManagerId) {
          workflowSteps.push({
            stepOrder: stepOrder++,
            stepType: 'Second Department Manager',
            approverId: department.secondManagerId,
            approverName: 'Second Department Manager',
            status: 'Pending',
            isRequired: false
          });
        }

        if (department.thirdManagerId && tripRequest.kilometers > maxKilometersLimit && tripRequest.tripType === 'Ticket') {
          workflowSteps.push({
            stepOrder: stepOrder++,
            stepType: 'Tertiary Department Manager',
            approverId: department.thirdManagerId,
            approverName: 'Tertiary Department Manager',
            status: 'Pending',
            isRequired: true
          });
        }
      }
    }

    // Finance approval (always required)
    workflowSteps.push({
      stepOrder: stepOrder++,
      stepType: 'Finance Approval',
      approverId: null,
      approverName: 'Finance Team',
      status: 'Pending',
      isRequired: true
    });

    return workflowSteps;
  }

  /**
   * Determine next status based on workflow step type
   */
  static async determineNextStatus(nextStep: any): Promise<string> {
    if (nextStep.stepType === 'Finance Approval') {
      return 'Pending Finance Approval';
    } else if (nextStep.stepType.includes('Project')) {
      return 'Pending Project Approval';
    } else {
      return 'Pending Department Approval';
    }
  }

  /**
   * Determine initial status for a trip request based on workflow rules
   */
  static async determineInitialStatus(tripRequest: any): Promise<string> {
    const isUrgentTrip = tripRequest.tripType === 'Urgent';
    
    // For urgent trips without project - go directly to Finance
    if (isUrgentTrip && !tripRequest.projectId) {
      return "Pending Finance Approval";
    } 
    // For trips with project - start with project approval (even if urgent)
    else if (tripRequest.projectId) {
      return "Pending Project Approval";
    } 
    // For department trips - start with department approval
    else {
      return "Pending Department Approval";
    }
  }

  /**
   * Get projects managed by a specific user - database-first approach
   */
  static async getUserManagedProjects(userId: number): Promise<any[]> {
    const { db } = await import("./db");
    const { projects } = await import("@shared/schema");
    const { eq, or } = await import("drizzle-orm");
    
    return await db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.managerId, userId),
          eq(projects.secondManagerId, userId)
        )
      );
  }

  /**
   * Generate initial status history for trip creation - database-first approach
   */
  static async generateInitialStatusHistory(tripRequest: any, timestamp: Date): Promise<any[]> {
    const statusHistory = [{
      status: await this.determineInitialStatus(tripRequest),
      timestamp,
      userId: tripRequest.userId,
      role: "Employee"
    }];

    // For urgent trips without project, add system bypass entries
    if (tripRequest.tripType === 'Urgent' && !tripRequest.projectId) {
      statusHistory.push({
        status: "Department Approval Bypassed - Urgent Trip",
        timestamp: new Date(timestamp.getTime() + 1000),
        userId: tripRequest.userId,
        role: "System"
      });
    }
    
    // For urgent trips with project, add department bypass but keep project approval
    if (tripRequest.tripType === 'Urgent' && tripRequest.projectId) {
      statusHistory.push({
        status: "Department Approval Bypassed - Urgent Trip",
        timestamp: new Date(timestamp.getTime() + 1000),
        userId: tripRequest.userId,
        role: "System"
      });
    }

    return statusHistory;
  }

  /**
   * Get initial approval defaults for trip creation - database-first approach
   */
  static async getInitialApprovalDefaults(tripRequest: any): Promise<any> {
    // For urgent trips without project, auto-approve department level
    const isUrgentTrip = tripRequest.tripType === 'Urgent';
    
    return {
      departmentManagerApproved: isUrgentTrip && !tripRequest.projectId ? true : null,
      departmentSecondApproved: isUrgentTrip && !tripRequest.projectId ? true : null,
      projectManagerApproved: null,
      projectSecondApproved: null,
      financeApproved: null
    };
  }

  /**
   * Handle budget deduction for approved trips - database-first approach
   */
  static async handleApprovedTripBudgetDeduction(request: any): Promise<void> {
    const { storage } = await import("./storage");
    
    // Final approval - deduct from appropriate budget based on database configuration
    if (request.projectId) {
      await storage.updateProjectBudget(request.projectId, -request.cost);
    } else if (request.departmentId && request.tripType !== 'Urgent') {
      // Only deduct from department budget for non-urgent trips
      // Urgent trips without projects don't deduct from any budget
      await storage.updateDepartmentBudget(request.departmentId, -request.cost);
    }
  }

  /**
   * Handle budget restoration for rejected trips - database-first approach
   */
  static async handleRejectedTripBudgetRestoration(request: any): Promise<void> {
    const { storage } = await import("./storage");
    
    // Restore budget based on trip assignment
    if (request.projectId) {
      await storage.updateProjectBudget(request.projectId, request.cost);
    } else if (request.departmentId) {
      await storage.updateDepartmentBudget(request.departmentId, request.cost);
    }
  }

  /**
   * Check if status represents approval - database-first approach
   */
  static async isApprovalStatus(status: string): Promise<boolean> {
    // Define approval statuses based on database configuration
    const approvalStatuses = ['Approved'];
    return approvalStatuses.includes(status);
  }

  /**
   * Filter projects that a user can access based on database relationships
   */
  static async filterProjectsForUser(userId: number, projects: any[], departmentId: number): Promise<any[]> {
    const allowedProjects = [];
    
    for (const project of projects) {
      // Skip if already added by manager relationship
      if (project.managerId === userId || project.secondManagerId === userId) {
        continue;
      }
      
      // Add if belongs to user's department
      if (project.departmentId === departmentId) {
        allowedProjects.push(project);
      }
    }
    
    return allowedProjects;
  }

  /**
   * Get manager projects for department users - database-first approach
   */
  static async getManagerProjectsForDepartment(userIds: number[], excludeProjects: any[]): Promise<any[]> {
    const { db } = await import("./db");
    const { projects } = await import("@shared/schema");
    const { eq, or, and, isNull } = await import("drizzle-orm");
    // Build conditions for manager relationships
    const conditions: any[] = [];
    for (const userId of userIds) {
      conditions.push(eq(projects.managerId, userId));
      conditions.push(eq(projects.secondManagerId, userId));
    }
    
    // Get projects where department users are managers, excluding duplicates
    const managerProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          or(...conditions),
          isNull(projects.departmentId) // Exclude projects already returned via departmentId
        )
      );
    
    return managerProjects;
  }
}