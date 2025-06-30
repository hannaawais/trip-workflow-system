/**
 * DATABASE STORAGE IMPLEMENTATION - CRITICAL FIXES APPLIED
 * 
 * SEQUENTIAL WORKFLOW STATUS FIX (June 12, 2025):
 * - Line ~1364: Fixed status determination logic in updateTripRequestStatus()
 * - Changed from: remainingSteps.find((step: any) => step.isRequired) || remainingSteps[0]
 * - Changed to: remainingSteps.sort((a, b) => a.stepOrder - b.stepOrder)[0]
 * - Problem solved: Trip statuses no longer jump from Step 1 → Step 3 when Step 2 is optional
 * 
 * BUDGET VALIDATION ENFORCEMENT:
 * - Project manager approvals blocked when insufficient project budget
 * - Budget checks applied to both individual and bulk approval endpoints
 * - User-friendly error messages for budget constraint violations
 */

import session from "express-session";
import { 
  User, InsertUser,
  Department, InsertDepartment,
  Project, InsertProject,
  ProjectAssignment, InsertProjectAssignment,
  ProjectDocument, InsertProjectDocument,
  TripRequest, InsertTripRequest,
  AdminRequest, InsertAdminRequest,
  AuditLog, InsertAuditLog,
  SystemSetting, InsertSystemSetting,
  KmRate, InsertKmRate,
  Site, InsertSite,
  Distance, InsertDistance,
  WorkflowStep, InsertWorkflowStep,
  ProjectBudgetHistory, InsertProjectBudgetHistory,
  users, departments, projects, projectAssignments, projectDocuments, tripRequests, adminRequests, auditLogs, systemSettings, kmRates, sites, distances, workflowSteps, projectBudgetHistory,
  roleEnum
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, SQL, sql, desc, isNotNull, isNull, lte, gte, not, inArray, ne } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { IStorage } from "./storage";
import { PermissionService } from "./permissions";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Use any for SessionStore type due to compatibility issues

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async updateUserRole(userId: number, role: string): Promise<User> {
    // Validate role through PermissionService
    const { PermissionService } = await import("./permissions");
    const validRoles = await PermissionService.getValidRoles();
    if (!validRoles.includes(role)) {
      throw new Error("Invalid role");
    }
    
    const [updatedUser] = await db
      .update(users)
      .set({ role: role as any })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }
  
  async updateUser(userId: number, data: { 
    fullName?: string; 
    email?: string; 
    department?: string; 
    companyNumber?: string; 
    homeAddress?: string;
    directManagerName?: string;
    directCostEntryPermission?: boolean;
    homeLocation?: string;
  }): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }
  
  async activateUser(userId: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive: true })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }
  
  async deactivateUser(userId: number): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return updatedUser;
  }
  
  async getDepartment(id: number): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department;
  }
  
  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }
  
  async createDepartment(department: InsertDepartment): Promise<Department> {
    // If monthly budget bonus is set, also set the reset date
    const departmentData = { ...department };
    
    if (departmentData.monthlyBudgetBonus && departmentData.monthlyBudgetBonus > 0) {
      // Set reset date to one month from now
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      departmentData.monthlyBudgetBonusResetDate = resetDate;
    }
    
    const [newDepartment] = await db.insert(departments).values(departmentData).returning();
    return newDepartment;
  }
  
  async updateDepartment(departmentId: number, data: { 
    name?: string; 
    budget?: number; 
    isActive?: boolean;
    thirdManagerId?: number | null;
    parentDepartmentId?: number | null;
    monthlyBudgetBonus?: number;
    monthlyBudgetBonusResetDate?: Date | null;
    managerId?: number;
    secondManagerId?: number | null;
  }): Promise<Department> {
    const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
    
    if (!department) {
      throw new Error(`Department with ID ${departmentId} not found`);
    }
    
    // Validate parent department to prevent circular references
    if (data.parentDepartmentId && data.parentDepartmentId === departmentId) {
      throw new Error('A department cannot be its own parent');
    }
    
    // Make a copy of the data to modify
    const updateData = { ...data };
    
    // If monthly budget bonus is being set/updated and no reset date is provided
    if (updateData.monthlyBudgetBonus !== undefined && 
        updateData.monthlyBudgetBonus > 0 && 
        !updateData.monthlyBudgetBonusResetDate) {
      // Set reset date to one month from now
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      updateData.monthlyBudgetBonusResetDate = resetDate;
    }
    
    const [updatedDepartment] = await db
      .update(departments)
      .set(updateData)
      .where(eq(departments.id, departmentId))
      .returning();
    
    return updatedDepartment;
  }
  
  async updateDepartmentBudget(departmentId: number, amount: number): Promise<Department> {
    const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
    
    if (!department) {
      throw new Error(`Department with ID ${departmentId} not found`);
    }
    
    const [updatedDepartment] = await db
      .update(departments)
      .set({ budget: department.budget + amount })
      .where(eq(departments.id, departmentId))
      .returning();
    
    return updatedDepartment;
  }
  
  async updateDepartmentMonthlyBonus(departmentId: number, amount: number): Promise<Department> {
    const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
    
    if (!department) {
      throw new Error(`Department with ID ${departmentId} not found`);
    }
    
    // Set reset date to one month from now
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    
    const [updatedDepartment] = await db
      .update(departments)
      .set({ 
        monthlyBudgetBonus: amount,
        monthlyBudgetBonusResetDate: resetDate 
      })
      .where(eq(departments.id, departmentId))
      .returning();
    
    return updatedDepartment;
  }
  
  async resetMonthlyBudgetBonus(departmentId?: number): Promise<number> {
    // If departmentId is provided, reset only that department
    if (departmentId) {
      const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
      
      if (!department) {
        throw new Error(`Department with ID ${departmentId} not found`);
      }
      
      // Reset the monthly bonus to 0
      const [updatedDepartment] = await db
        .update(departments)
        .set({ 
          monthlyBudgetBonus: 0,
          monthlyBudgetBonusResetDate: new Date()
        })
        .where(eq(departments.id, departmentId))
        .returning();
      
      return 1; // One department updated
    }
    
    // Otherwise, reset all departments with monthly bonus
    const result = await db
      .update(departments)
      .set({ 
        monthlyBudgetBonus: 0,
        monthlyBudgetBonusResetDate: new Date()
      })
      .where(not(eq(departments.monthlyBudgetBonus, 0)))
      .returning();
    
    return result.length; // Return number of departments updated
  }
  
  async activateDepartment(departmentId: number): Promise<Department> {
    const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
    
    if (!department) {
      throw new Error(`Department with ID ${departmentId} not found`);
    }
    
    const [updatedDepartment] = await db
      .update(departments)
      .set({ isActive: true })
      .where(eq(departments.id, departmentId))
      .returning();
    
    return updatedDepartment;
  }
  
  async deactivateDepartment(departmentId: number): Promise<Department> {
    const [department] = await db.select().from(departments).where(eq(departments.id, departmentId));
    
    if (!department) {
      throw new Error(`Department with ID ${departmentId} not found`);
    }
    
    const [updatedDepartment] = await db
      .update(departments)
      .set({ isActive: false })
      .where(eq(departments.id, departmentId))
      .returning();
    
    return updatedDepartment;
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }
  
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }
  
  async createProject(project: InsertProject): Promise<Project> {
    return await db.transaction(async (tx) => {
      // Ensure originalBudget is set and budget field matches for backward compatibility
      const projectData = {
        ...project,
        originalBudget: project.originalBudget || project.budget,
        budget: project.originalBudget || project.budget, // Keep legacy field in sync during transition
        budgetAdjustments: project.budgetAdjustments || 0
      };

      const [newProject] = await tx
        .insert(projects)
        .values(projectData)
        .returning();
      
      // Create initial budget history entry
      if (newProject.originalBudget && newProject.originalBudget > 0) {
        await tx
          .insert(projectBudgetHistory)
          .values({
            projectId: newProject.id,
            transactionType: 'initial',
            amount: newProject.originalBudget,
            runningBalance: newProject.originalBudget,
            description: `Initial budget allocation for project: ${newProject.name}`,
            createdBy: 2 // Default to admin user for system-generated entries
          });
      }
      
      return newProject;
    });
  }
  
  async updateProject(projectId: number, data: { 
    name?: string; 
    budget?: number; 
    departmentId?: number; 
    managerId?: number;
    secondManagerId?: number;
    expiryDate?: Date;
    isActive?: boolean 
  }): Promise<Project> {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    const updateData = {
      ...data,
      expiryDate: data.expiryDate ? data.expiryDate.toISOString() : data.expiryDate
    };
    
    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();
    
    return updatedProject;
  }
  
  async updateProjectBudget(projectId: number, amount: number): Promise<Project> {
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    
    const [updatedProject] = await db
      .update(projects)
      .set({ budget: project.budget + amount })
      .where(eq(projects.id, projectId))
      .returning();
    
    return updatedProject;
  }

  async getProjectSpending(projectId: number): Promise<{ totalAllocated: number; totalSpent: number; availableBudget: number; budgetUtilization: number; originalBudget: number; effectiveBudget: number }> {
    // Get project details with new budget fields
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    // Calculate allocated budget from budget history
    const [allocationResult] = await db
      .select({
        totalAllocated: sql<number>`COALESCE(SUM(CASE WHEN ${projectBudgetHistory.transactionType} = 'allocation' THEN ${projectBudgetHistory.amount} ELSE 0 END), 0)`,
        totalDeallocated: sql<number>`COALESCE(SUM(CASE WHEN ${projectBudgetHistory.transactionType} = 'deallocation' THEN ${projectBudgetHistory.amount} ELSE 0 END), 0)`
      })
      .from(projectBudgetHistory)
      .where(eq(projectBudgetHistory.projectId, projectId));

    const netAllocated = (allocationResult?.totalAllocated || 0) - (allocationResult?.totalDeallocated || 0);

    // Calculate actual spending (paid trips only)
    const [spendingResult] = await db
      .select({
        totalSpent: sql<number>`COALESCE(SUM(${tripRequests.cost}), 0)`
      })
      .from(tripRequests)
      .where(
        and(
          eq(tripRequests.projectId, projectId),
          eq(tripRequests.status, 'Paid')
        )
      );

    const totalSpent = spendingResult?.totalSpent || 0;
    const originalBudget = project.originalBudget || project.budget; // Fallback for legacy projects
    const budgetAdjustments = project.budgetAdjustments || 0;
    const effectiveBudget = originalBudget + budgetAdjustments;
    const availableBudget = effectiveBudget - netAllocated;
    const budgetUtilization = effectiveBudget > 0 ? (totalSpent / effectiveBudget) * 100 : 0; // Fixed: Use totalSpent for utilization

    return {
      totalAllocated: netAllocated,
      totalSpent,
      availableBudget,
      budgetUtilization,
      originalBudget,
      effectiveBudget
    };
  }

  async checkProjectBudgetForTrip(projectId: number, tripCost: number, excludeTripId?: number): Promise<{ canApprove: boolean; budgetExcess: number; budgetInfo: any }> {
    const budgetInfo = await this.getProjectSpending(projectId);
    
    // Adjust available budget if excluding a specific trip
    let adjustedAvailableBudget = budgetInfo.availableBudget;
    if (excludeTripId) {
      // If excluding a trip, we need to add back its allocation
      const [excludedTrip] = await db
        .select({ cost: tripRequests.cost })
        .from(tripRequests)
        .where(eq(tripRequests.id, excludeTripId));
      
      if (excludedTrip) {
        adjustedAvailableBudget += excludedTrip.cost;
      }
    }
    
    const canApprove = adjustedAvailableBudget >= tripCost;
    const budgetExcess = canApprove ? 0 : tripCost - adjustedAvailableBudget;

    return {
      canApprove,
      budgetExcess,
      budgetInfo: {
        totalAllocated: budgetInfo.totalAllocated,
        totalSpent: budgetInfo.totalSpent,
        availableBudget: adjustedAvailableBudget,
        budgetUtilization: budgetInfo.budgetUtilization,
        originalBudget: budgetInfo.originalBudget,
        effectiveBudget: budgetInfo.effectiveBudget
      }
    };
  }

  // Budget allocation methods
  async createBudgetAllocation(
    projectId: number, 
    amount: number, 
    referenceId: number, 
    referenceType: 'trip_request' | 'admin_request' | 'manual', 
    description: string,
    createdBy: number
  ): Promise<ProjectBudgetHistory> {
    const budgetInfo = await this.getProjectSpending(projectId);
    const newRunningBalance = budgetInfo.availableBudget - amount;

    const [allocation] = await db
      .insert(projectBudgetHistory)
      .values({
        projectId,
        transactionType: 'allocation',
        amount,
        runningBalance: newRunningBalance,
        referenceId,
        referenceType,
        description,
        createdBy
      })
      .returning();

    return allocation;
  }

  async createBudgetDeallocation(
    projectId: number, 
    amount: number, 
    referenceId: number, 
    referenceType: 'trip_request' | 'admin_request' | 'manual', 
    description: string,
    createdBy: number
  ): Promise<ProjectBudgetHistory> {
    const budgetInfo = await this.getProjectSpending(projectId);
    const newRunningBalance = budgetInfo.availableBudget + amount;

    const [deallocation] = await db
      .insert(projectBudgetHistory)
      .values({
        projectId,
        transactionType: 'deallocation',
        amount,
        runningBalance: newRunningBalance,
        referenceId,
        referenceType,
        description,
        createdBy
      })
      .returning();

    return deallocation;
  }

  async createBudgetAdjustment(
    projectId: number, 
    amount: number, 
    description: string,
    createdBy: number,
    referenceId?: number
  ): Promise<ProjectBudgetHistory> {
    // Update project budget adjustments
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    await db
      .update(projects)
      .set({ budgetAdjustments: (project.budgetAdjustments || 0) + amount })
      .where(eq(projects.id, projectId));

    const budgetInfo = await this.getProjectSpending(projectId);
    
    const [adjustment] = await db
      .insert(projectBudgetHistory)
      .values({
        projectId,
        transactionType: 'adjustment',
        amount,
        runningBalance: budgetInfo.availableBudget,
        referenceId,
        referenceType: 'admin_request',
        description,
        createdBy
      })
      .returning();

    return adjustment;
  }

  // Project document methods
  async getProjectDocument(id: number): Promise<ProjectDocument | undefined> {
    const [document] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, id));
    return document;
  }
  
  async getProjectDocuments(projectId: number): Promise<ProjectDocument[]> {
    return await db
      .select()
      .from(projectDocuments)
      .where(
        and(
          eq(projectDocuments.projectId, projectId),
          eq(projectDocuments.isDeleted, false)
        )
      )
      .orderBy(desc(projectDocuments.uploadDate));
  }
  
  async createProjectDocument(document: InsertProjectDocument): Promise<ProjectDocument> {
    const [newDocument] = await db
      .insert(projectDocuments)
      .values({
        ...document,
        isDeleted: false
      })
      .returning();
    
    return newDocument;
  }
  
  async markProjectDocumentAsDeleted(documentId: number): Promise<ProjectDocument> {
    const [document] = await db
      .select()
      .from(projectDocuments)
      .where(eq(projectDocuments.id, documentId));
    
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }
    
    const [updatedDocument] = await db
      .update(projectDocuments)
      .set({ isDeleted: true })
      .where(eq(projectDocuments.id, documentId))
      .returning();
    
    return updatedDocument;
  }
  
  async assignUserToProject(assignment: InsertProjectAssignment): Promise<ProjectAssignment> {
    const [newAssignment] = await db.insert(projectAssignments).values(assignment).returning();
    return newAssignment;
  }
  
  async getUserProjects(userId: number): Promise<Project[]> {
    // First get the user's department
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return [];
    }
    
    // Get projects where the user is the primary or secondary manager
    const managerProjects = await db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.managerId, userId),
          eq(projects.secondManagerId, userId)
        )
      );
      
    // Get department of the user  
    const userDepartment = user.department;
    
    // Find department ID by name
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.name, userDepartment));
    
    // Get projects assigned to the user
    const assignedProjectIds = await db
      .select({ projectId: projectAssignments.projectId })
      .from(projectAssignments)
      .where(eq(projectAssignments.userId, userId));
    
    let assignedProjects: Project[] = [];
    if (assignedProjectIds.length > 0) {
      assignedProjects = await db
        .select()
        .from(projects)
        .where(inArray(projects.id, assignedProjectIds.map(a => a.projectId)));
    }
    
    // Get projects in user's department
    let departmentProjects: Project[] = [];
    if (department) {
      departmentProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.departmentId, department.id));
    }
    
    // Combine and deduplicate all projects
    const allProjects = [...managerProjects, ...departmentProjects, ...assignedProjects];
    return Array.from(new Map(allProjects.map(p => [p.id, p])).values());
  }
  
  async getUserManagedProjects(userId: number): Promise<Project[]> {
    // Return projects where the user is explicitly assigned as PRIMARY or SECONDARY manager
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
  
  async getDepartmentProjects(departmentName: string): Promise<Project[]> {
    // First get the department ID
    const [department] = await db
      .select()
      .from(departments)
      .where(eq(departments.name, departmentName));
    
    if (!department) {
      return [];
    }
    
    // Get projects directly associated with the department via departmentId
    const departmentProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.departmentId, department.id));
    
    // Also get all projects related to managers from the department
    // First, get all users from the department
    const departmentUsers = await db
      .select()
      .from(users)
      .where(eq(users.department, departmentName));
    
    if (departmentUsers.length === 0) {
      return departmentProjects;
    }
    
    // Get all user IDs from the department
    const userIds = departmentUsers.map(user => user.id);
    
    // Delegate manager project filtering to PermissionService
    const { PermissionService } = await import("./permissions");
    const managerProjects = await PermissionService.getManagerProjectsForDepartment(userIds, departmentProjects);
    
    // Combine both sets of projects
    return [...departmentProjects, ...managerProjects];
  }

  async getAllActiveProjects(): Promise<Project[]> {
    const currentDate = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    return await db.select().from(projects)
      .where(and(
        eq(projects.isActive, true),
        or(
          isNull(projects.expiryDate),
          gte(projects.expiryDate, currentDate)
        )
      ))
      .orderBy(projects.name);
  }
  
  async getTripRequest(id: number): Promise<TripRequest | undefined> {
    const [result] = await db
      .select({
        // Trip request fields
        id: tripRequests.id,
        userId: tripRequests.userId,
        departmentId: tripRequests.departmentId,
        projectId: tripRequests.projectId,
        tripDate: tripRequests.tripDate,
        origin: tripRequests.origin,
        destination: tripRequests.destination,
        purpose: tripRequests.purpose,
        cost: tripRequests.cost,
        kilometers: tripRequests.kilometers,
        originalDistance: tripRequests.originalDistance,
        kmRateId: tripRequests.kmRateId,
        kmRateValue: tripRequests.kmRateValue,
        kmRate: tripRequests.kmRate,
        costCalculatedFromKm: tripRequests.costCalculatedFromKm,
        costMethod: tripRequests.costMethod,
        costUpdatedAt: tripRequests.costUpdatedAt,
        costUpdatedBy: tripRequests.costUpdatedBy,
        attachmentPath: tripRequests.attachmentPath,
        status: tripRequests.status,
        createdAt: tripRequests.createdAt,
        departmentManagerApproved: tripRequests.departmentManagerApproved,
        departmentSecondApproved: tripRequests.departmentSecondApproved,
        projectManagerApproved: tripRequests.projectManagerApproved,
        projectSecondApproved: tripRequests.projectSecondApproved,
        financeApproved: tripRequests.financeApproved,
        rejectionReason: tripRequests.rejectionReason,
        notified: tripRequests.notified,
        tripType: tripRequests.tripType,
        urgencyType: tripRequests.urgencyType,
        ticketNo: tripRequests.ticketNo,
        attachmentRequired: tripRequests.attachmentRequired,
        statusHistory: tripRequests.statusHistory,
        lastUpdatedBy: tripRequests.lastUpdatedBy,
        lastUpdatedAt: tripRequests.lastUpdatedAt,
        paid: tripRequests.paid,
        paidAt: tripRequests.paidAt,
        paidBy: tripRequests.paidBy,
        
        // User information
        userName: users.fullName,
        userEmail: users.email,
        userDepartment: users.department,
        userRole: users.role,
        userCompanyNumber: users.companyNumber,
        
        // Department information (if applicable)
        departmentName: departments.name,
        departmentBudget: departments.budget,
        departmentManagerId: departments.managerId,
        departmentSecondManagerId: departments.secondManagerId,
        
        // Project information (if applicable)
        projectName: projects.name,
        projectBudget: projects.budget,
        projectManagerId: projects.managerId,
        projectSecondManagerId: projects.secondManagerId,
        projectExpiryDate: projects.expiryDate,
        
        // Sites information (if available)
        fromSiteName: sites.englishName,
        fromSiteCity: sites.city,
        fromSiteAbbreviation: sites.abbreviation,
        
        // KM Rate information (if available)
        kmRateAmount: kmRates.rateValue,
        kmRateEffectiveFrom: kmRates.effectiveFrom,
        kmRateEffectiveTo: kmRates.effectiveTo
      })
      .from(tripRequests)
      .leftJoin(users, eq(tripRequests.userId, users.id))
      .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
      .leftJoin(projects, eq(tripRequests.projectId, projects.id))
      .leftJoin(sites, eq(tripRequests.origin, sites.abbreviation))
      .leftJoin(kmRates, eq(tripRequests.kmRateId, kmRates.id))
      .where(eq(tripRequests.id, id));

    if (!result) {
      return undefined;
    }

    // Get destination site information with separate query
    let toSiteInfo = null;
    if (result.destination) {
      const [toSite] = await db
        .select()
        .from(sites)
        .where(eq(sites.abbreviation, result.destination));
      toSiteInfo = toSite;
    }

    // Get project manager information with separate query
    let projectManagerInfo = null;
    if (result.projectManagerId) {
      const [projectManager] = await db
        .select()
        .from(users)
        .where(eq(users.id, result.projectManagerId));
      projectManagerInfo = projectManager;
    }

    // Transform the result to include all the joined data
    return {
      ...result,
      // Add convenience fields for frontend
      fullName: result.userName,
      employeeNo: result.userCompanyNumber,
      department: result.userDepartment,
      departmentName: result.departmentName || result.userDepartment, // Fallback to user department if department table has no match
      userDepartment: result.userDepartment, // Ensure this field exists for frontend
      projectName: result.projectName,
      projectManagerName: projectManagerInfo?.fullName,
      projectManagerEmail: projectManagerInfo?.email,
      originName: result.fromSiteName,
      originCity: result.fromSiteCity,
      originAbbreviation: result.fromSiteAbbreviation,
      destinationName: toSiteInfo?.englishName,
      destinationCity: toSiteInfo?.city,
      destinationAbbreviation: toSiteInfo?.abbreviation,
      kmRateAmount: result.kmRateAmount,
      kmRateEffectiveFrom: result.kmRateEffectiveFrom,
      kmRateEffectiveTo: result.kmRateEffectiveTo
    } as any;
  }
  
  async getTripRequests(page: number = 1, limit: number = 10): Promise<{data: any[], total: number}> {
    const trips = await db
      .select({
        id: tripRequests.id,
        userId: tripRequests.userId,
        departmentId: tripRequests.departmentId,
        projectId: tripRequests.projectId,
        tripDate: tripRequests.tripDate,
        origin: tripRequests.origin,
        destination: tripRequests.destination,
        purpose: tripRequests.purpose,
        cost: tripRequests.cost,
        kilometers: tripRequests.kilometers,
        originalDistance: tripRequests.originalDistance,
        kmRateId: tripRequests.kmRateId,
        kmRateValue: tripRequests.kmRateValue,
        kmRate: tripRequests.kmRate,
        costCalculatedFromKm: tripRequests.costCalculatedFromKm,
        costMethod: tripRequests.costMethod,
        costUpdatedAt: tripRequests.costUpdatedAt,
        costUpdatedBy: tripRequests.costUpdatedBy,
        attachmentPath: tripRequests.attachmentPath,
        status: tripRequests.status,
        createdAt: tripRequests.createdAt,
        departmentManagerApproved: tripRequests.departmentManagerApproved,
        departmentSecondApproved: tripRequests.departmentSecondApproved,
        projectManagerApproved: tripRequests.projectManagerApproved,
        projectSecondApproved: tripRequests.projectSecondApproved,
        financeApproved: tripRequests.financeApproved,
        rejectionReason: tripRequests.rejectionReason,
        notified: tripRequests.notified,
        tripType: tripRequests.tripType,
        urgencyType: tripRequests.urgencyType,
        ticketNo: tripRequests.ticketNo,
        attachmentRequired: tripRequests.attachmentRequired,
        statusHistory: tripRequests.statusHistory,
        lastUpdatedBy: tripRequests.lastUpdatedBy,
        lastUpdatedAt: tripRequests.lastUpdatedAt,
        paid: tripRequests.paid,
        paidAt: tripRequests.paidAt,
        paidBy: tripRequests.paidBy,
        // Join user information
        fullName: users.fullName,
        companyNumber: users.companyNumber,
        department: users.department,
        email: users.email,
        role: users.role
      })
      .from(tripRequests)
      .leftJoin(users, eq(tripRequests.userId, users.id))
      .orderBy(desc(tripRequests.createdAt));
    return { data: trips, total: trips.length };
  }

  // Permission-based methods using PermissionService - optimized for employees
  async getTripRequestsForUser(userId: number, userRole: string, activeRole?: string): Promise<any[]> {
    // Optimized query for employees
    if (userRole === "Employee") {
      const result = await db
        .select({
          id: tripRequests.id,
          userId: tripRequests.userId,
          departmentId: tripRequests.departmentId,
          projectId: tripRequests.projectId,
          tripDate: tripRequests.tripDate,
          origin: tripRequests.origin,
          destination: tripRequests.destination,
          purpose: tripRequests.purpose,
          cost: tripRequests.cost,
          kilometers: tripRequests.kilometers,
          originalDistance: tripRequests.originalDistance,
          kmRateId: tripRequests.kmRateId,
          kmRateValue: tripRequests.kmRateValue,
          kmRate: tripRequests.kmRate,
          costCalculatedFromKm: tripRequests.costCalculatedFromKm,
          costMethod: tripRequests.costMethod,
          costUpdatedAt: tripRequests.costUpdatedAt,
          costUpdatedBy: tripRequests.costUpdatedBy,
          attachmentPath: tripRequests.attachmentPath,
          status: tripRequests.status,
          createdAt: tripRequests.createdAt,
          departmentManagerApproved: tripRequests.departmentManagerApproved,
          departmentSecondApproved: tripRequests.departmentSecondApproved,
          projectManagerApproved: tripRequests.projectManagerApproved,
          projectSecondApproved: tripRequests.projectSecondApproved,
          financeApproved: tripRequests.financeApproved,
          rejectionReason: tripRequests.rejectionReason,
          notified: tripRequests.notified,
          tripType: tripRequests.tripType,
          urgencyType: tripRequests.urgencyType,
          ticketNo: tripRequests.ticketNo,
          attachmentRequired: tripRequests.attachmentRequired,
          statusHistory: tripRequests.statusHistory,
          lastUpdatedBy: tripRequests.lastUpdatedBy,
          lastUpdatedAt: tripRequests.lastUpdatedAt,
          paid: tripRequests.paid,
          paidAt: tripRequests.paidAt,
          paidBy: tripRequests.paidBy,
          // Join user information
          fullName: users.fullName,
          companyNumber: users.companyNumber,
          department: users.department,
          userDepartment: users.department,
          email: users.email,
          role: users.role,
          // Department information from departments table
          departmentName: departments.name
        })
        .from(tripRequests)
        .leftJoin(users, eq(tripRequests.userId, users.id))
        .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
        .where(eq(tripRequests.userId, userId))
        .orderBy(desc(tripRequests.createdAt))
        .limit(100);
      return result;
    }
    
    // For managers and admins, use permission service
    const { PermissionService } = await import("./permissions");
    const visibleIds = await PermissionService.getVisibleTripRequestIds(userId, userRole, activeRole);
    
    if (visibleIds.length === 0) {
      return [];
    }
    
    return await db
      .select({
        id: tripRequests.id,
        userId: tripRequests.userId,
        departmentId: tripRequests.departmentId,
        projectId: tripRequests.projectId,
        tripDate: tripRequests.tripDate,
        origin: tripRequests.origin,
        destination: tripRequests.destination,
        purpose: tripRequests.purpose,
        cost: tripRequests.cost,
        kilometers: tripRequests.kilometers,
        originalDistance: tripRequests.originalDistance,
        kmRateId: tripRequests.kmRateId,
        kmRateValue: tripRequests.kmRateValue,
        kmRate: tripRequests.kmRate,
        costCalculatedFromKm: tripRequests.costCalculatedFromKm,
        costMethod: tripRequests.costMethod,
        costUpdatedAt: tripRequests.costUpdatedAt,
        costUpdatedBy: tripRequests.costUpdatedBy,
        attachmentPath: tripRequests.attachmentPath,
        status: tripRequests.status,
        createdAt: tripRequests.createdAt,
        departmentManagerApproved: tripRequests.departmentManagerApproved,
        departmentSecondApproved: tripRequests.departmentSecondApproved,
        projectManagerApproved: tripRequests.projectManagerApproved,
        projectSecondApproved: tripRequests.projectSecondApproved,
        financeApproved: tripRequests.financeApproved,
        rejectionReason: tripRequests.rejectionReason,
        notified: tripRequests.notified,
        tripType: tripRequests.tripType,
        urgencyType: tripRequests.urgencyType,
        ticketNo: tripRequests.ticketNo,
        attachmentRequired: tripRequests.attachmentRequired,
        statusHistory: tripRequests.statusHistory,
        lastUpdatedBy: tripRequests.lastUpdatedBy,
        lastUpdatedAt: tripRequests.lastUpdatedAt,
        paid: tripRequests.paid,
        paidAt: tripRequests.paidAt,
        paidBy: tripRequests.paidBy,
        // Join user information
        fullName: users.fullName,
        companyNumber: users.companyNumber,
        department: users.department,
        userDepartment: users.department,
        email: users.email,
        role: users.role,
        // Department information from departments table
        departmentName: departments.name
      })
      .from(tripRequests)
      .leftJoin(users, eq(tripRequests.userId, users.id))
      .leftJoin(departments, eq(tripRequests.departmentId, departments.id))
      .where(sql`${tripRequests.id} IN (${sql.join(visibleIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(tripRequests.createdAt));
  }

  async getAdminRequestsForUser(userId: number, userRole: string, activeRole?: string): Promise<any[]> {
    // Optimized query for employees
    if (userRole === "Employee") {
      const result = await db
        .select({
          id: adminRequests.id,
          userId: adminRequests.userId,
          subject: adminRequests.subject,
          description: adminRequests.description,
          attachmentPath: adminRequests.attachmentPath,
          status: adminRequests.status,
          createdAt: adminRequests.createdAt,
          financeApproved: adminRequests.financeApproved,
          requestType: adminRequests.requestType,
          tripRequestId: adminRequests.tripRequestId,
          requestedAmount: adminRequests.requestedAmount,
          targetType: adminRequests.targetType,
          targetId: adminRequests.targetId,
          rejectionReason: adminRequests.rejectionReason,
          notified: adminRequests.notified,
          statusHistory: adminRequests.statusHistory,
          lastUpdatedBy: adminRequests.lastUpdatedBy,
          lastUpdatedAt: adminRequests.lastUpdatedAt,
          paid: adminRequests.paid,
          paidAt: adminRequests.paidAt,
          paidBy: adminRequests.paidBy,
          // Join user information
          fullName: users.fullName,
          companyNumber: users.companyNumber,
          department: users.department,
          email: users.email,
          role: users.role
        })
        .from(adminRequests)
        .leftJoin(users, eq(adminRequests.userId, users.id))
        .where(eq(adminRequests.userId, userId))
        .orderBy(desc(adminRequests.createdAt));
      return result;
    }
    
    // For managers and admins, use permission service
    const visibleIds = await PermissionService.getVisibleAdminRequestIds(userId, userRole, activeRole);
    
    if (visibleIds.length === 0) {
      return [];
    }
    
    return await db
      .select({
        id: adminRequests.id,
        userId: adminRequests.userId,
        subject: adminRequests.subject,
        description: adminRequests.description,
        attachmentPath: adminRequests.attachmentPath,
        status: adminRequests.status,
        createdAt: adminRequests.createdAt,
        financeApproved: adminRequests.financeApproved,
        requestType: adminRequests.requestType,
        tripRequestId: adminRequests.tripRequestId,
        requestedAmount: adminRequests.requestedAmount,
        targetType: adminRequests.targetType,
        targetId: adminRequests.targetId,
        rejectionReason: adminRequests.rejectionReason,
        notified: adminRequests.notified,
        statusHistory: adminRequests.statusHistory,
        lastUpdatedBy: adminRequests.lastUpdatedBy,
        lastUpdatedAt: adminRequests.lastUpdatedAt,
        paid: adminRequests.paid,
        paidAt: adminRequests.paidAt,
        paidBy: adminRequests.paidBy,
        // Join user information
        fullName: users.fullName,
        companyNumber: users.companyNumber,
        department: users.department,
        email: users.email,
        role: users.role
      })
      .from(adminRequests)
      .leftJoin(users, eq(adminRequests.userId, users.id))
      .where(sql`${adminRequests.id} IN (${sql.join(visibleIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(adminRequests.createdAt));
  }

  async getApprovedTripsForPayment(): Promise<any[]> {
    try {
      // Get approved trips with user and department details
      const result = await db
        .select({
          id: tripRequests.id,
          userId: tripRequests.userId,
          userName: users.fullName,
          department: users.department,
          destination: tripRequests.destination,
          origin: tripRequests.origin,
          purpose: tripRequests.purpose,
          tripDate: tripRequests.tripDate,
          tripType: tripRequests.tripType,
          cost: tripRequests.cost,
          kilometers: tripRequests.kilometers,
          status: tripRequests.status,
          paid: tripRequests.paid,
          createdAt: tripRequests.createdAt,
          lastUpdatedAt: tripRequests.lastUpdatedAt
        })
        .from(tripRequests)
        .innerJoin(users, eq(tripRequests.userId, users.id))
        .where(and(
          eq(tripRequests.status, 'Approved'),
          or(
            eq(tripRequests.paid, false),
            isNull(tripRequests.paid)
          )
        ))
        .orderBy(desc(tripRequests.lastUpdatedAt));
      
      console.log(`Found ${result.length} approved trips for payment`);
      return result;
    } catch (error) {
      console.error('Error fetching approved trips:', error);
      return [];
    }
  }
  
  async getUserTripRequests(userId: number, page: number = 1, limit: number = 10): Promise<{data: TripRequest[], total: number}> {
    const trips = await db
      .select()
      .from(tripRequests)
      .where(eq(tripRequests.userId, userId))
      .orderBy(desc(tripRequests.createdAt));
    return { data: trips, total: trips.length };
  }
  
  async getDepartmentTripRequests(department: string, page: number = 1, limit: number = 10): Promise<{data: TripRequest[], total: number}> {
    // Get all users in the department
    const departmentUsers = await db
      .select()
      .from(users)
      .where(eq(users.department, department));
    
    if (departmentUsers.length === 0) {
      return { data: [], total: 0 };
    }
    
    // Get their IDs
    const userIds = departmentUsers.map(user => user.id);
    
    // Create an SQL condition to match any of the user IDs
    const userConditions: SQL[] = userIds.map(id => 
      eq(tripRequests.userId, id)
    );
    
    // Get trip requests for these users
    const trips = await db
      .select()
      .from(tripRequests)
      .where(sql.join(userConditions, sql` OR `))
      .orderBy(desc(tripRequests.createdAt));
    
    return { data: trips, total: trips.length };
  }
  
  async getProjectManagerTripRequests(managerId: number, page: number = 1, limit: number = 10): Promise<{data: TripRequest[], total: number}> {
    // Get projects where this manager is either the main manager or secondary manager
    const managedProjects = await db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.managerId, managerId),
          eq(projects.secondManagerId, managerId)
        )
      );
    
    if (managedProjects.length === 0) {
      return { data: [], total: 0 };
    }
    
    // Create an SQL condition to match any of the managed project IDs
    const projectConditions: SQL[] = managedProjects.map(p => 
      eq(tripRequests.projectId, p.id)
    );
    
    // Get trip requests for these projects
    const trips = await db
      .select()
      .from(tripRequests)
      .where(
        and(
          isNotNull(tripRequests.projectId),
          or(...projectConditions)
        )
      )
      .orderBy(desc(tripRequests.createdAt));
    
    return { data: trips, total: trips.length };
  }
  
  async createTripRequest(tripRequest: InsertTripRequest): Promise<TripRequest> {
    // Set up default status data
    const timestamp = new Date();
    
    // Ensure departmentId is set - find department by user's department if not provided
    let departmentId = tripRequest.departmentId;
    if (!departmentId && tripRequest.userId) {
      const user = await this.getUser(tripRequest.userId);
      if (user?.department) {
        const userDepartment = await db.select().from(departments).where(eq(departments.name, user.department)).limit(1);
        if (userDepartment.length > 0) {
          departmentId = userDepartment[0].id;
        }
      }
    }
    
    // Delegate all trip creation logic to PermissionService to eliminate hardcoded authorization
    const { PermissionService } = await import("./permissions");
    const initialStatus = await PermissionService.determineInitialStatus(tripRequest);
    const statusHistory = await PermissionService.generateInitialStatusHistory(tripRequest, timestamp);
    const approvalDefaults = await PermissionService.getInitialApprovalDefaults(tripRequest);
    
    const [newTripRequest] = await db
      .insert(tripRequests)
      .values({
        ...tripRequest,
        departmentId, // Use resolved departmentId
        status: initialStatus,
        // Use PermissionService-generated approval defaults
        ...approvalDefaults,
        rejectionReason: null,
        notified: false,
        statusHistory // Include the status history
      })
      .returning();
    
    // Generate workflow steps for the new trip request
    await this.generateWorkflowForTrip(newTripRequest);
    
    return newTripRequest;
  }
  
  async updateTripRequestStatus(
    requestId: number, 
    approve: boolean, 
    userId: number, 
    role: string, 
    customStatus?: string,
    reason?: string
  ): Promise<TripRequest> {
    // Execute all operations within a database transaction for atomicity
    return await db.transaction(async (tx) => {
      // Get the current request
      const [request] = await tx
        .select()
        .from(tripRequests)
        .where(eq(tripRequests.id, requestId));
      
      if (!request) {
        throw new Error(`Trip request with ID ${requestId} not found`);
      }
      
      // Prepare updates
      const updates: Partial<TripRequest> = {};
      const timestamp = new Date();
      
      // Initialize or get existing status history
      let statusHistory: Array<any> = Array.isArray(request.statusHistory) ? [...request.statusHistory] : [];
    
    if (approve) {
      // Database-first workflow approval system - get workflow steps within transaction
      const workflowStepsData = await tx
        .select()
        .from(workflowSteps)
        .where(eq(workflowSteps.tripRequestId, requestId));
      
      const currentStep = workflowStepsData.find((step: any) => 
        step.status === 'Pending' && 
        (step.approverId === userId || 
         (step.approverId === null && step.stepType === 'Finance Approval' && (role === 'Finance' || role === 'Admin')))
      );

      if (!currentStep) {
        throw new Error(`No pending workflow step found for user ${userId} on request ${requestId}`);
      }

      // Update the current workflow step within transaction
      await tx
        .update(workflowSteps)
        .set({
          status: 'Approved' as any,
          approvedAt: timestamp,
          approvedBy: userId
        })
        .where(
          and(
            eq(workflowSteps.tripRequestId, requestId),
            eq(workflowSteps.stepType, currentStep.stepType as any)
          )
        );

      // Database-first: All approval tracking is handled via workflow steps
      // Legacy approval flags are deprecated and no longer updated

      // Determine next status based on remaining pending workflow steps
      const remainingSteps = workflowStepsData.filter((step: any) => 
        step.status === 'Pending' && step.stepOrder > currentStep.stepOrder
      );

      let nextStatus: "Pending Department Approval" | "Pending Project Approval" | "Pending Finance Approval" | "Approved" | "Rejected" | "Paid" | "Cancelled";
      if (remainingSteps.length === 0) {
        nextStatus = 'Approved';
      } else {
        const nextStep = remainingSteps.sort((a, b) => a.stepOrder - b.stepOrder)[0];
        // Delegate status determination to PermissionService
        const { PermissionService } = await import("./permissions");
        const determinedStatus = await PermissionService.determineNextStatus(nextStep);
        nextStatus = determinedStatus as typeof nextStatus;
      }

      updates.status = nextStatus;
      
      statusHistory.push({
        status: nextStatus,
        timestamp,
        userId,
        role
      });

      // Database-first budget handling within transaction
      // Budget deduction happens when FIRST Project Manager approves
      if (currentStep.stepType === 'Project Manager' && request.projectId && request.cost) {
        // Handle budget deduction within transaction for atomicity when first PM approves
        const [project] = await tx
          .select()
          .from(projects)
          .where(eq(projects.id, request.projectId));
        
        if (project) {
          // Deduct from project budget atomically when first Project Manager approves
          await tx
            .update(projects)
            .set({ 
              budget: project.budget - request.cost
            })
            .where(eq(projects.id, request.projectId));
        }
      }
    } else {
      // Handle rejection or custom status (like Cancelled)
      if (customStatus) {
        // Make sure customStatus is a valid enum value from statusEnum
        // Valid values are: 'Pending Department Approval', 'Pending Project Approval', 
        // 'Pending Finance Approval', 'Approved', 'Rejected', 'Paid', 'Cancelled'
        const validStatuses = [
          'Pending Department Approval', 
          'Pending Project Approval',
          'Pending Finance Approval', 
          'Approved', 
          'Rejected', 
          'Paid', 
          'Cancelled'
        ];
        
        if (validStatuses.includes(customStatus)) {
          updates.status = customStatus as any; // Cast to any since we've validated it's in the enum
        } else {
          // If it's not a valid status, default to Rejected
          updates.status = 'Rejected';
        }
        
        // Add status history entry for custom status
        statusHistory.push({
          status: customStatus,
          timestamp,
          userId,
          role,
          reason: reason || ''
        });
      } else {
        // Default to Rejected if no custom status
        updates.status = 'Rejected';
        
        // Add status history entry for rejection
        statusHistory.push({
          status: 'Rejected',
          timestamp,
          userId,
          role,
          reason: reason || ''
        });
      }
      
      updates.rejectionReason = reason || '';
      
        // Handle budget restoration within transaction for atomicity
        // Restore budget if rejecting after first Project Manager approved (budget was deducted)
        if (request.projectId && request.cost) {
          // Check if first project manager has already approved by looking at workflow steps
          const projectManagerSteps = await tx
            .select()
            .from(workflowSteps)
            .where(
              and(
                eq(workflowSteps.tripRequestId, requestId),
                eq(workflowSteps.stepType, 'Project Manager' as any),
                eq(workflowSteps.status, 'Approved' as any)
              )
            );
          
          // If first project manager approved, budget was deducted and needs restoration
          if (projectManagerSteps.length > 0) {
            const [project] = await tx
              .select()
              .from(projects)
              .where(eq(projects.id, request.projectId));
            
            if (project) {
              // Restore budget to project atomically
              await tx
                .update(projects)
                .set({ 
                  budget: project.budget + request.cost
                })
                .where(eq(projects.id, request.projectId));
            }
          }
        }
      }
      
      // Update lastUpdatedBy and lastUpdatedAt
      updates.lastUpdatedBy = userId;
      updates.lastUpdatedAt = timestamp;
      updates.statusHistory = statusHistory;
      
      // Update the request within transaction
      const [updatedRequest] = await tx
        .update(tripRequests)
        .set(updates)
        .where(eq(tripRequests.id, requestId))
        .returning();
      
      // Create an audit log entry for this action within transaction
      const actionType = approve ? "Approval" : "Rejection";
      
      await tx.insert(auditLogs).values({
        userId,
        action: `${actionType} by ${role}`,
        details: {
          requestId,
          requestType: "TripRequest",
          reason: reason || undefined,
          approvalStatus: approve ? "Approved" : "Rejected"
        }
      });
      
      return updatedRequest;
    });
  }
  
  async updateTripRequestCost(
    requestId: number,
    cost: number,
    costMethod: string,
    costCalculatedFromKm: boolean,
    kmRateId?: number | null,
    kmRateValue?: number | null
  ): Promise<TripRequest> {
    // Get the current request to ensure it exists
    const [existingRequest] = await db
      .select()
      .from(tripRequests)
      .where(eq(tripRequests.id, requestId));
    
    if (!existingRequest) {
      throw new Error("Trip request not found");
    }
    
    const timestamp = new Date();
    
    // Prepare the update data
    const updates = {
      cost,
      costMethod,
      costCalculatedFromKm,
      costUpdatedAt: timestamp,
      updatedAt: timestamp,
      kmRateId: kmRateId !== undefined ? kmRateId : existingRequest.kmRateId,
      kmRateValue: kmRateValue !== undefined ? kmRateValue : existingRequest.kmRateValue
    };
    
    // Update the trip request
    const [updatedRequest] = await db
      .update(tripRequests)
      .set(updates)
      .where(eq(tripRequests.id, requestId))
      .returning();
    
    // Create an audit log entry for cost update
    await this.createAuditLog({
      userId: 0, // System user or current user ID if available
      action: "TRIP_COST_UPDATED",
      details: {
        requestId,
        previousCost: existingRequest.cost,
        newCost: cost,
        costMethod,
        calculatedFromKm: costCalculatedFromKm,
        kmRateId: updates.kmRateId,
        kmRateValue: updates.kmRateValue
      }
    });
    
    return updatedRequest;
  }
  
  async markTripRequestAsPaid(
    requestId: number,
    userId: number
  ): Promise<TripRequest> {
    // Get the current request
    const [request] = await db
      .select()
      .from(tripRequests)
      .where(eq(tripRequests.id, requestId));
    
    if (!request) {
      throw new Error(`Trip request with ID ${requestId} not found`);
    }
    
    if (request.status !== 'Approved') {
      throw new Error("Cannot mark as paid: Trip request is not approved");
    }
    
    const timestamp = new Date();
    
    // Initialize or get existing status history
    let statusHistory: Array<any> = Array.isArray(request.statusHistory) ? [...request.statusHistory] : [];
    
    // Add status history entry for payment
    statusHistory.push({
      status: 'Paid',
      timestamp,
      userId,
      role: 'Finance'
    });
    
    // Update the request
    const [updatedRequest] = await db
      .update(tripRequests)
      .set({
        status: 'Paid',
        paid: true,
        paidAt: timestamp,
        paidBy: userId,
        lastUpdatedBy: userId,
        lastUpdatedAt: timestamp,
        statusHistory
      })
      .where(eq(tripRequests.id, requestId))
      .returning();
    
    // Create an audit log entry for this action
    await this.createAuditLog({
      userId,
      action: "Payment of Trip Request",
      details: {
        requestId,
        requestType: "TripRequest",
        paidAmount: request.cost
      }
    });
    
    return updatedRequest;
  }
  
  async getAdminRequest(id: number): Promise<AdminRequest | undefined> {
    const [request] = await db.select().from(adminRequests).where(eq(adminRequests.id, id));
    return request;
  }
  
  async getAdminRequests(): Promise<AdminRequest[]> {
    return await db.select().from(adminRequests).orderBy(desc(adminRequests.createdAt));
  }
  
  async getUserAdminRequests(userId: number): Promise<AdminRequest[]> {
    return await db
      .select()
      .from(adminRequests)
      .where(eq(adminRequests.userId, userId))
      .orderBy(desc(adminRequests.createdAt));
  }
  
  async getDepartmentAdminRequests(department: string): Promise<AdminRequest[]> {
    // Get all users in the department
    const departmentUsers = await db
      .select()
      .from(users)
      .where(eq(users.department, department));
    
    if (departmentUsers.length === 0) {
      return [];
    }
    
    // Get their IDs
    const userIds = departmentUsers.map(user => user.id);
    
    // Create an SQL condition to match any of the user IDs
    const userConditions: SQL[] = userIds.map(id => 
      eq(adminRequests.userId, id)
    );
    
    // Get admin requests for these users
    return await db
      .select()
      .from(adminRequests)
      .where(sql.join(userConditions, sql` OR `))
      .orderBy(desc(adminRequests.createdAt));
  }
  
  async createAdminRequest(adminRequest: InsertAdminRequest): Promise<AdminRequest> {
    const [newAdminRequest] = await db
      .insert(adminRequests)
      .values({
        ...adminRequest,
        financeApproved: null,
        rejectionReason: null,
        notified: false
      })
      .returning();
    
    return newAdminRequest;
  }
  
  async updateAdminRequestStatus(
    requestId: number, 
    approve: boolean, 
    reason?: string
  ): Promise<AdminRequest> {
    const updates: Partial<AdminRequest> = {};
    
    if (approve) {
      updates.status = 'Approved';
      updates.financeApproved = true;
    } else {
      updates.status = 'Rejected';
      updates.financeApproved = false;
      updates.rejectionReason = reason || '';
    }
    
    const [updatedRequest] = await db
      .update(adminRequests)
      .set(updates)
      .where(eq(adminRequests.id, requestId))
      .returning();
    
    if (!updatedRequest) {
      throw new Error(`Administrative request with ID ${requestId} not found`);
    }
    
    return updatedRequest;
  }
  
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }
  
  async getAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt));
  }
  
  async getUserAuditLogs(userId: number): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt));
  }
  
  async getMonthlyReport(month: number, year: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    // Get all trip requests within the date range
    const tripRequestsInRange = await db
      .select()
      .from(tripRequests)
      .where(
        and(
          sql`${tripRequests.createdAt} >= ${startDate}`,
          sql`${tripRequests.createdAt} <= ${endDate}`
        )
      );
    
    // Calculate totals
    const totalApproved = tripRequestsInRange.filter(req => req.status === 'Approved').length;
    const totalRejected = tripRequestsInRange.filter(req => req.status === 'Rejected').length;
    const totalPending = tripRequestsInRange.filter(req => 
      req.status === 'Pending Department Approval' || 
      req.status === 'Pending Project Approval' || 
      req.status === 'Pending Finance Approval'
    ).length;
    
    // Calculate total cost of approved trips
    const totalApprovedCost = tripRequestsInRange
      .filter(req => req.status === 'Approved')
      .reduce((sum, req) => sum + req.cost, 0);
    
    // Get department data for the report
    const allDepartments = await db.select().from(departments);
    
    // Calculate department expenses
    const departmentExpenses: Record<string, number> = {};
    for (const dept of allDepartments) {
      const departmentTripCosts = tripRequestsInRange
        .filter(req => req.departmentId === dept.id && req.status === 'Approved')
        .reduce((sum, req) => sum + req.cost, 0);
      
      departmentExpenses[dept.name] = departmentTripCosts;
    }
    
    // Get project data for the report
    const allProjects = await db.select().from(projects);
    
    // Calculate project expenses
    const projectExpenses: Record<string, number> = {};
    for (const proj of allProjects) {
      const projectTripCosts = tripRequestsInRange
        .filter(req => req.projectId === proj.id && req.status === 'Approved')
        .reduce((sum, req) => sum + req.cost, 0);
      
      projectExpenses[proj.name] = projectTripCosts;
    }
    
    return {
      month,
      year,
      tripRequests: tripRequestsInRange,
      totalApproved,
      totalRejected,
      totalPending,
      totalTrips: tripRequestsInRange.length,
      totalApprovedCost,
      departmentExpenses,
      projectExpenses
    };
  }

  // System settings methods
  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key));
    
    return setting;
  }
  
  async getSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }
  
  async updateSystemSetting(key: string, value: string, userId: number): Promise<SystemSetting> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key));
    
    if (!setting) {
      throw new Error(`System setting with key '${key}' not found`);
    }
    
    const [updatedSetting] = await db
      .update(systemSettings)
      .set({ 
        settingValue: value,
        updatedBy: userId,
        updatedAt: new Date()
      })
      .where(eq(systemSettings.settingKey, key))
      .returning();
    
    return updatedSetting;
  }
  
  async createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const [newSetting] = await db
      .insert(systemSettings)
      .values({
        ...setting,
        updatedAt: new Date()
      })
      .returning();
    
    return newSetting;
  }
  
  // KM rate methods
  async getKmRate(id: number): Promise<KmRate | undefined> {
    const [kmRate] = await db
      .select()
      .from(kmRates)
      .where(eq(kmRates.id, id));
    
    return kmRate;
  }
  
  async getKmRates(): Promise<KmRate[]> {
    const rates = await db
      .select()
      .from(kmRates)
      .orderBy(desc(kmRates.effectiveFrom));
    
    return rates;
  }
  
  async getCurrentKmRate(date: Date = new Date()): Promise<KmRate | undefined> {
    console.log(`Getting current KM rate for date: ${date.toISOString()}`);
    
    // Find the KM rate that is effective for the given date
    const dateString = date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    const rates = await db
      .select()
      .from(kmRates)
      .where(
        and(
          lte(kmRates.effectiveFrom, dateString),
          or(
            isNull(kmRates.effectiveTo),
            gte(kmRates.effectiveTo, dateString)
          )
        )
      )
      .orderBy(desc(kmRates.effectiveFrom));
    
    console.log(`Current KM rate query result:`, rates[0]);
    return rates[0];
  }
  
  async createKmRate(kmRate: InsertKmRate): Promise<KmRate> {
    // Convert Date objects to strings for database storage
    const insertData: any = { ...kmRate };
    if (insertData.effectiveFrom && insertData.effectiveFrom instanceof Date) {
      insertData.effectiveFrom = insertData.effectiveFrom.toISOString().split('T')[0];
    }
    if (insertData.effectiveTo && insertData.effectiveTo instanceof Date) {
      insertData.effectiveTo = insertData.effectiveTo.toISOString().split('T')[0];
    }
    
    const [newKmRate] = await db
      .insert(kmRates)
      .values(insertData)
      .returning();
    
    return newKmRate;
  }
  
  async updateKmRate(kmRateId: number, data: { 
    rateValue?: number; 
    effectiveFrom?: Date; 
    effectiveTo?: Date | null;
    description?: string 
  }): Promise<KmRate> {
    // Convert Date objects to strings for database storage
    const updateData: any = { ...data };
    if (updateData.effectiveFrom) {
      updateData.effectiveFrom = updateData.effectiveFrom.toISOString().split('T')[0];
    }
    if (updateData.effectiveTo) {
      updateData.effectiveTo = updateData.effectiveTo.toISOString().split('T')[0];
    }
    
    const [updatedKmRate] = await db
      .update(kmRates)
      .set(updateData)
      .where(eq(kmRates.id, kmRateId))
      .returning();
    
    if (!updatedKmRate) {
      throw new Error("KM rate not found");
    }
    
    return updatedKmRate;
  }
  
  async deleteKmRate(kmRateId: number): Promise<void> {
    const deleteResult = await db
      .delete(kmRates)
      .where(eq(kmRates.id, kmRateId));
    
    if (!deleteResult) {
      throw new Error("KM rate not found");
    }
  }
  
  // Site management methods
  async getSite(id: number): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.id, id));
    return site || undefined;
  }

  async getSites(): Promise<Site[]> {
    return await db.select().from(sites).orderBy(sites.abbreviation);
  }

  async getActiveSites(): Promise<Site[]> {
    return await db.select().from(sites).where(eq(sites.isActive, true)).orderBy(sites.abbreviation);
  }

  async getSiteByAbbreviation(abbreviation: string): Promise<Site | undefined> {
    const [site] = await db.select().from(sites).where(eq(sites.abbreviation, abbreviation.toUpperCase()));
    return site || undefined;
  }

  async createSite(site: InsertSite): Promise<Site> {
    const [newSite] = await db.insert(sites).values({
      ...site,
      abbreviation: site.abbreviation.toUpperCase(),
      updatedAt: new Date()
    }).returning();
    return newSite;
  }

  async updateSite(siteId: number, data: { 
    abbreviation?: string; 
    englishName?: string; 
    city?: string; 
    region?: string; 
    gpsLat?: number; 
    gpsLng?: number; 
    siteType?: string; 
    isActive?: boolean; 
  }): Promise<Site> {
    // Validate siteType enum if provided
    const validSiteTypes = ["Hospital", "Comprehensive clinic", "Primary Clinic", "Directory", "Other"];
    const updateData: any = { ...data };
    
    if (updateData.siteType && !validSiteTypes.includes(updateData.siteType)) {
      updateData.siteType = "Other"; // Default to Other if invalid
    }
    
    if (updateData.abbreviation) {
      updateData.abbreviation = updateData.abbreviation.toUpperCase();
    }

    const [updatedSite] = await db.update(sites)
      .set(updateData)
      .where(eq(sites.id, siteId))
      .returning();
    return updatedSite;
  }

  async deleteSite(siteId: number): Promise<void> {
    await db.delete(sites).where(eq(sites.id, siteId));
  }

  // Distance management methods
  async getDistance(fromSiteId: number, toSiteId: number, routeType: string = "fastest"): Promise<Distance | undefined> {
    const [distance] = await db.select().from(distances)
      .where(and(
        eq(distances.fromSiteId, fromSiteId),
        eq(distances.toSiteId, toSiteId),
        eq(distances.routeType, routeType)
      ));
    return distance || undefined;
  }

  async getDistances(): Promise<Distance[]> {
    return await db.select().from(distances).orderBy(distances.createdAt);
  }

  async createDistance(distance: InsertDistance): Promise<Distance> {
    const [newDistance] = await db.insert(distances).values({
      ...distance,
      lastUpdated: new Date()
    }).returning();
    return newDistance;
  }

  async updateDistance(distanceId: number, data: { 
    drivingDistance?: number; 
    estimatedTime?: number; 
    routeType?: string; 
  }): Promise<Distance> {
    const [updatedDistance] = await db.update(distances)
      .set({
        ...data,
        lastUpdated: new Date()
      })
      .where(eq(distances.id, distanceId))
      .returning();
    return updatedDistance;
  }

  async deleteDistance(distanceId: number): Promise<void> {
    await db.delete(distances).where(eq(distances.id, distanceId));
  }

  // Distance calculation method with OpenRouteService integration
  async calculateAndCacheDistance(fromSiteId: number, toSiteId: number, routeType: string = "fastest"): Promise<Distance> {
    // Check if distance already exists
    const existingDistance = await this.getDistance(fromSiteId, toSiteId, routeType);
    if (existingDistance) {
      return existingDistance;
    }

    // Get site coordinates
    const fromSite = await this.getSite(fromSiteId);
    const toSite = await this.getSite(toSiteId);

    if (!fromSite || !toSite) {
      throw new Error('Invalid site IDs provided');
    }

    let drivingDistance = 0;
    let estimatedTime = 0;

    try {
      // Use OpenRouteService API for real distance calculation
      const apiKey = process.env.OPENROUTESERVICE_API_KEY;
      if (!apiKey) {
        throw new Error('OpenRouteService API key not configured');
      }

      // Prepare coordinates for OpenRouteService (longitude, latitude format)
      const coordinates = [
        [Number(fromSite.gpsLng), Number(fromSite.gpsLat)],
        [Number(toSite.gpsLng), Number(toSite.gpsLat)]
      ];

      console.log(`Calculating distance from ${fromSite.englishName} to ${toSite.englishName}`);
      console.log(`Coordinates: [${coordinates[0]}] to [${coordinates[1]}]`);

      // Map route type to OpenRouteService profile
      const profile = routeType === "shortest" ? "driving-car" : "driving-car"; // OpenRouteService uses driving-car for both

      const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
        method: "POST",
        headers: {
          "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
          "Authorization": apiKey,
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          coordinates: coordinates,
          format: "json"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenRouteService API error: ${response.status} - ${errorText}`);
        throw new Error(`OpenRouteService API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenRouteService response:', JSON.stringify(data, null, 2));
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        drivingDistance = Math.round((route.summary.distance / 1000) * 100) / 100; // Convert meters to km
        estimatedTime = Math.round(route.summary.duration / 60); // Convert seconds to minutes
        console.log(`Calculated distance: ${drivingDistance} km, time: ${estimatedTime} minutes`);
      } else {
        throw new Error('No route found');
      }

    } catch (error) {
      console.error('OpenRouteService API error:', error);
      
      // Fallback to straight-line distance calculation if API fails
      const straightLineDistance = this.calculateStraightLineDistance(
        Number(fromSite.gpsLat), Number(fromSite.gpsLng),
        Number(toSite.gpsLat), Number(toSite.gpsLng)
      );

      // Estimate driving distance as 1.4x straight line distance
      drivingDistance = Math.round(straightLineDistance * 1.4 * 100) / 100;
      estimatedTime = Math.round(drivingDistance / 60 * 60); // Assuming 60 km/h average speed
    }

    return await this.createDistance({
      fromSiteId,
      toSiteId,
      drivingDistance,
      estimatedTime,
      routeType
    });
  }

  // Helper method to calculate straight-line distance between two GPS coordinates
  private calculateStraightLineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Trip cost recalculation method
  async recalculateTripCosts(rateId?: number): Promise<number> {
    let updatedCount = 0;
    
    // If a specific rate is provided, get that rate details
    let specificRate: KmRate | undefined;
    if (rateId) {
      specificRate = await this.getKmRate(rateId);
      if (!specificRate) {
        throw new Error("KM rate not found");
      }
      console.log(`[DEBUG] Recalculating trips for rate ID ${rateId}, value: ${specificRate.rateValue}, effective from: ${specificRate.effectiveFrom}, to: ${specificRate.effectiveTo || 'ongoing'}`);
    }
    
    // Get all trips that have kilometers entered, are not paid,
    // AND were specifically set to calculate costs from kilometers
    // First, fetch all unpaid trips to see what we're working with
    const allUnpaidTrips = await db
      .select()
      .from(tripRequests)
      .where(
        not(eq(tripRequests.status, "Paid"))
      );
      
    console.log(`[DEBUG] Found ${allUnpaidTrips.length} unpaid trips`);
    
    // Check each trip and log why it might be excluded
    for (const trip of allUnpaidTrips) {
      const tripDate = new Date(trip.tripDate);
      const month = tripDate.getMonth() + 1; // JavaScript months are 0-based
      const year = tripDate.getFullYear();
      
      console.log(`[DEBUG] Trip #${trip.id}: Date ${month}/${year}, KM: ${trip.kilometers || 'undefined'}, CalcFromKM: ${trip.costCalculatedFromKm}, CostMethod: ${trip.costMethod || 'undefined'}`);
      
      // If using a specific rate, check date range
      if (specificRate) {
        const effectiveFrom = new Date(specificRate.effectiveFrom);
        const effectiveTo = specificRate.effectiveTo ? new Date(specificRate.effectiveTo) : null;
        
        if (tripDate < effectiveFrom) {
          console.log(`[DEBUG] Trip #${trip.id} excluded: Date ${tripDate.toISOString()} is before rate effective date ${effectiveFrom.toISOString()}`);
        }
        
        if (effectiveTo && tripDate > effectiveTo) {
          console.log(`[DEBUG] Trip #${trip.id} excluded: Date ${tripDate.toISOString()} is after rate expiration date ${effectiveTo.toISOString()}`);
        }
      }
      
      // Check kilometers
      if (!trip.kilometers || trip.kilometers <= 0) {
        console.log(`[DEBUG] Trip #${trip.id} excluded: No kilometers entered (${trip.kilometers})`);
      }
      
      // Check calculation method
      if (!trip.costCalculatedFromKm && trip.costMethod !== 'km') {
        console.log(`[DEBUG] Trip #${trip.id} excluded: Not set to calculate from KM (costCalculatedFromKm: ${trip.costCalculatedFromKm}, costMethod: ${trip.costMethod || 'undefined'})`);
      }
    }
    
    // Now get only the trips that qualify for recalculation
    const kmBasedTrips = await db
      .select()
      .from(tripRequests)
      .where(
        and(
          // Check for trips with kilometers > 0
          sql`${tripRequests.kilometers} > 0`,
          // Never modify paid trips
          not(eq(tripRequests.status, "Paid")),
          // Only recalculate if the user explicitly chose to calculate by kilometers
          or(
            eq(tripRequests.costCalculatedFromKm, true),  // Legacy flag
            eq(tripRequests.costMethod, 'km')            // New field indicating km-based calculation
          )
        )
      );
      
    console.log(`[DEBUG] Found ${kmBasedTrips.length} trips qualifying for KM-based recalculation`);
    
    for (const trip of kmBasedTrips) {
      const tripDate = new Date(trip.tripDate);
      
      // If we're recalculating for a specific rate, check if this trip falls within its date range
      if (specificRate) {
        const effectiveFrom = new Date(specificRate.effectiveFrom);
        const effectiveTo = specificRate.effectiveTo ? new Date(specificRate.effectiveTo) : null;
        
        // Skip trips that aren't in this rate's date range
        if (tripDate < effectiveFrom || (effectiveTo && tripDate > effectiveTo)) {
          continue;
        }
        
        // Calculate new cost based on the specified rate (handle null kilometers)
        const newCost = (trip.kilometers || 0) * specificRate.rateValue;
        
        // Only update if the cost has changed
        if (Math.abs(newCost - trip.cost) > 0.001) { // Using a small epsilon for floating point comparison
          const updatedTrip = await db
            .update(tripRequests)
            .set({
              cost: newCost,
              lastUpdatedAt: new Date(),
              lastUpdatedBy: 1, // Using a valid user ID instead of 0
              kmRateId: specificRate.id, // Record which KM rate was used
              kmRateValue: specificRate.rateValue, // Store the actual rate value for historical accuracy
              costUpdatedAt: new Date(), // Track when the cost calculation occurred
              costUpdatedBy: 1 // Set who updated the cost (system in this case)
            })
            .where(eq(tripRequests.id, trip.id))
            .returning();
          
          if (updatedTrip.length > 0) {
            updatedCount++;
          }
        }
      }
      // Global recalculation (less common, but keeping as a fallback)
      else {
        // Find the applicable rate based on trip date
        const applicableRate = await this.getCurrentKmRate(tripDate);
        
        if (applicableRate) {
          // Calculate new cost based on kilometers and current rate (handle null kilometers)
          const newCost = (trip.kilometers || 0) * applicableRate.rateValue;
          
          // Only update if the cost has changed
          if (Math.abs(newCost - trip.cost) > 0.001) { // Using a small epsilon for floating point comparison
            const updatedTrip = await db
              .update(tripRequests)
              .set({
                cost: newCost,
                lastUpdatedAt: new Date(),
                lastUpdatedBy: 1, // Using a valid user ID instead of 0
                kmRateId: applicableRate.id, // Record which KM rate was used
                kmRateValue: applicableRate.rateValue, // Store the actual rate value for historical accuracy
                costUpdatedAt: new Date(), // Track when the cost calculation occurred
                costUpdatedBy: 1 // Set who updated the cost (system in this case)
              })
              .where(eq(tripRequests.id, trip.id))
              .returning();
            
            if (updatedTrip.length > 0) {
              updatedCount++;
            }
          }
        }
      }
    }
    
    return updatedCount;
  }

  // Workflow management methods
  async createWorkflowSteps(tripRequestId: number, steps: InsertWorkflowStep[]): Promise<WorkflowStep[]> {
    const workflowStepsData = steps.map(step => ({
      ...step,
      tripRequestId,
      createdAt: new Date()
    }));

    const createdSteps = await db
      .insert(workflowSteps)
      .values(workflowStepsData)
      .returning();

    return createdSteps;
  }

  async getWorkflowSteps(tripRequestId: number): Promise<WorkflowStep[]> {
    // Get basic workflow steps
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(eq(workflowSteps.tripRequestId, tripRequestId))
      .orderBy(workflowSteps.stepOrder);

    // Enhance with actual user names
    const enhancedSteps = await Promise.all(steps.map(async step => {
      let assignedApproverName = null;
      let actualApproverName = null;

      // Get assigned approver name
      if (step.approverId) {
        const assignedUser = await db.select({ fullName: users.fullName })
          .from(users)
          .where(eq(users.id, step.approverId))
          .limit(1);
        assignedApproverName = assignedUser[0]?.fullName || null;
      }

      // Get actual approver name if approved
      if (step.approvedBy) {
        const actualUser = await db.select({ fullName: users.fullName })
          .from(users)
          .where(eq(users.id, step.approvedBy))
          .limit(1);
        actualApproverName = actualUser[0]?.fullName || null;
      }

      return {
        ...step,
        displayApproverName: assignedApproverName || step.approverName,
        displayActualApprover: actualApproverName
      };
    }));

    return enhancedSteps;
  }

  async updateWorkflowStep(stepId: number, data: {
    status?: string;
    approvedAt?: Date;
    approvedBy?: number;
    rejectionReason?: string;
  }): Promise<WorkflowStep> {
    // Validate status enum if provided
    const validStatuses = ["Approved", "Rejected", "Pending", "Skipped"];
    const updateData: any = { ...data };
    
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      updateData.status = "Pending"; // Default to Pending if invalid
    }
    
    const [updatedStep] = await db
      .update(workflowSteps)
      .set(updateData)
      .where(eq(workflowSteps.id, stepId))
      .returning();

    return updatedStep;
  }

  async updateWorkflowStepStatus(
    tripRequestId: number, 
    stepType: string, 
    status: string, 
    userId: number, 
    timestamp: Date
  ): Promise<void> {
    try {
      await db
        .update(workflowSteps)
        .set({
          status: status as any,
          approvedAt: timestamp,
          approvedBy: userId
        })
        .where(
          and(
            eq(workflowSteps.tripRequestId, tripRequestId),
            eq(workflowSteps.stepType, stepType as any)
          )
        );
    } catch (error) {
      console.error(`Error updating workflow step status:`, error);
      // Don't throw - this is an enhancement that shouldn't break the main workflow
    }
  }

  async generateWorkflowForTrip(tripRequest: TripRequest): Promise<WorkflowStep[]> {
    // Delegate all workflow generation to PermissionService to eliminate hardcoded logic
    const { PermissionService } = await import("./permissions");
    const workflowStepsToCreate = await PermissionService.generateWorkflowSteps(tripRequest);

    // Create the workflow steps in the database
    return await this.createWorkflowSteps(tripRequest.id, workflowStepsToCreate);
  }

  // Atomic transaction-aware storage methods for bulk operations

  async updateTripRequestStatusAtomic(
    requestId: number, 
    approve: boolean, 
    userId: number, 
    role: string, 
    customStatus?: string,
    reason?: string,
    tx?: any
  ): Promise<TripRequest> {
    // Use provided transaction or create new one
    const dbContext = tx || db;
    
    // Get the current request within transaction
    const [request] = await dbContext
      .select()
      .from(tripRequests)
      .where(eq(tripRequests.id, requestId));
    
    if (!request) {
      throw new Error(`Trip request with ID ${requestId} not found`);
    }
    
    // Prepare updates
    const updates: Partial<TripRequest> = {};
    const timestamp = new Date();
    
    // Initialize or get existing status history
    let statusHistory: Array<any> = Array.isArray(request.statusHistory) ? [...request.statusHistory] : [];
  
    if (approve) {
      // Database-first workflow approval system - get workflow steps within transaction
      const workflowStepsData = await dbContext
        .select()
        .from(workflowSteps)
        .where(eq(workflowSteps.tripRequestId, requestId));
      
      const currentStep = workflowStepsData.find((step: any) => 
        step.status === 'Pending' && 
        (step.approverId === userId || 
         (step.approverId === null && step.stepType === 'Finance Approval' && (role === 'Finance' || role === 'Admin')))
      );

      if (!currentStep) {
        throw new Error(`No pending workflow step found for user ${userId} on request ${requestId}`);
      }

      // Update the current workflow step within transaction
      await dbContext
        .update(workflowSteps)
        .set({
          status: 'Approved' as any,
          approvedAt: timestamp,
          approvedBy: userId
        })
        .where(
          and(
            eq(workflowSteps.tripRequestId, requestId),
            eq(workflowSteps.stepType, currentStep.stepType as any)
          )
        );

      // Determine next status based on remaining pending workflow steps
      const remainingSteps = workflowStepsData.filter((step: any) => 
        step.status === 'Pending' && step.stepOrder > currentStep.stepOrder
      );

      let nextStatus: "Pending Department Approval" | "Pending Project Approval" | "Pending Finance Approval" | "Approved" | "Rejected" | "Paid" | "Cancelled";
      if (remainingSteps.length === 0) {
        nextStatus = 'Approved';
      } else {
        // Fix: Use sequential step order instead of isRequired flags
        const nextStep = remainingSteps.sort((a, b) => a.stepOrder - b.stepOrder)[0];
        // Delegate status determination to PermissionService
        const { PermissionService } = await import("./permissions");
        const determinedStatus = await PermissionService.determineNextStatus(nextStep);
        nextStatus = determinedStatus as typeof nextStatus;
      }

      updates.status = nextStatus;
      
      statusHistory.push({
        status: nextStatus,
        timestamp,
        userId,
        role
      });

      // New budget allocation system - create allocation when FIRST Project Manager approves
      if (currentStep.stepType === 'Project Manager' && request.projectId && request.cost) {
        // Create budget allocation entry instead of direct deduction
        await dbContext
          .insert(projectBudgetHistory)
          .values({
            projectId: request.projectId,
            transactionType: 'allocation',
            amount: request.cost,
            runningBalance: 0, // Will be calculated in next query
            referenceId: requestId,
            referenceType: 'trip_request',
            description: `Budget allocation for trip request #${requestId} - ${request.purpose}`,
            createdBy: userId
          });
        
        // Update running balance for this allocation
        const budgetInfo = await this.getProjectSpending(request.projectId);
        await dbContext
          .update(projectBudgetHistory)
          .set({ runningBalance: budgetInfo.availableBudget })
          .where(
            and(
              eq(projectBudgetHistory.projectId, request.projectId),
              eq(projectBudgetHistory.referenceId, requestId),
              eq(projectBudgetHistory.transactionType, 'allocation')
            )
          );
      }
    } else {
      // Handle rejection or custom status (like Cancelled)
      if (customStatus) {
        // Make sure customStatus is a valid enum value from statusEnum
        const validStatuses = [
          'Pending Department Approval', 
          'Pending Project Approval',
          'Pending Finance Approval', 
          'Approved', 
          'Rejected', 
          'Paid', 
          'Cancelled'
        ];
        
        if (validStatuses.includes(customStatus)) {
          updates.status = customStatus as any;
        } else {
          updates.status = 'Rejected';
        }
        
        statusHistory.push({
          status: customStatus,
          timestamp,
          userId,
          role,
          reason: reason || ''
        });
      } else {
        updates.status = 'Rejected';
        
        statusHistory.push({
          status: 'Rejected',
          timestamp,
          userId,
          role,
          reason: reason || ''
        });
      }
      
      updates.rejectionReason = reason || '';
      
      // Handle budget deallocation within transaction for atomicity
      if (request.projectId && request.cost) {
        // Check if allocation exists for this trip request
        const [existingAllocation] = await dbContext
          .select()
          .from(projectBudgetHistory)
          .where(
            and(
              eq(projectBudgetHistory.projectId, request.projectId),
              eq(projectBudgetHistory.referenceId, requestId),
              eq(projectBudgetHistory.transactionType, 'allocation')
            )
          );
        
        // If allocation exists, create deallocation entry to restore budget
        if (existingAllocation) {
          await dbContext
            .insert(projectBudgetHistory)
            .values({
              projectId: request.projectId,
              transactionType: 'deallocation',
              amount: request.cost,
              runningBalance: 0, // Will be calculated in next query
              referenceId: requestId,
              referenceType: 'trip_request',
              description: `Budget deallocation for rejected trip request #${requestId} - ${request.purpose}`,
              createdBy: userId
            });
          
          // Update running balance for this deallocation
          const budgetInfo = await this.getProjectSpending(request.projectId);
          await dbContext
            .update(projectBudgetHistory)
            .set({ runningBalance: budgetInfo.availableBudget })
            .where(
              and(
                eq(projectBudgetHistory.projectId, request.projectId),
                eq(projectBudgetHistory.referenceId, requestId),
                eq(projectBudgetHistory.transactionType, 'deallocation')
              )
            );
        }
      }
    }
    
    // Update lastUpdatedBy and lastUpdatedAt
    updates.lastUpdatedBy = userId;
    updates.lastUpdatedAt = timestamp;
    updates.statusHistory = statusHistory;
    
    // Update the request within transaction
    const [updatedRequest] = await dbContext
      .update(tripRequests)
      .set(updates)
      .where(eq(tripRequests.id, requestId))
      .returning();
    
    return updatedRequest;
  }

  async updateAdminRequestStatusAtomic(
    requestId: number,
    approve: boolean,
    reason?: string,
    tx?: any
  ): Promise<AdminRequest> {
    // Use provided transaction or create new one
    const dbContext = tx || db;
    
    const status = approve ? 'Approved' : 'Rejected';
    const timestamp = new Date();
    
    // Get current request to preserve status history
    const [currentRequest] = await dbContext
      .select()
      .from(adminRequests)
      .where(eq(adminRequests.id, requestId));
    
    if (!currentRequest) {
      throw new Error(`Admin request with ID ${requestId} not found`);
    }
    
    // Prepare status history update
    let statusHistory: Array<any> = Array.isArray(currentRequest.statusHistory) ? [...currentRequest.statusHistory] : [];
    statusHistory.push({
      status,
      timestamp,
      reason: reason || ''
    });
    
    const [updatedRequest] = await dbContext
      .update(adminRequests)
      .set({
        status: status as any,
        rejectionReason: !approve ? reason : null,
        lastUpdatedAt: timestamp,
        statusHistory
      })
      .where(eq(adminRequests.id, requestId))
      .returning();
    
    return updatedRequest;
  }



  async getProjectBudgetHistory(projectId: number): Promise<any[]> {
    const history = await db
      .select({
        id: projectBudgetHistory.id,
        transactionType: projectBudgetHistory.transactionType,
        amount: projectBudgetHistory.amount,
        runningBalance: projectBudgetHistory.runningBalance,
        description: projectBudgetHistory.description,
        createdAt: projectBudgetHistory.createdAt,
        createdBy: projectBudgetHistory.createdBy,
        referenceId: projectBudgetHistory.referenceId,
        createdByName: users.fullName
      })
      .from(projectBudgetHistory)
      .leftJoin(users, eq(projectBudgetHistory.createdBy, users.id))
      .where(eq(projectBudgetHistory.projectId, projectId))
      .orderBy(desc(projectBudgetHistory.createdAt));

    return history.map(record => ({
      id: record.id,
      type: record.transactionType,
      description: record.description,
      amount: record.amount,
      runningBalance: record.runningBalance,
      timestamp: record.createdAt,
      referenceId: record.referenceId,
      createdBy: record.createdByName
    }));
  }
}

export const storage = new DatabaseStorage();