/**
 * API ROUTES - BUDGET VALIDATION ENFORCEMENT
 * 
 * BUDGET VALIDATION FIXES (June 12, 2025):
 * - Lines ~1079-1101: Individual approval budget validation in /api/approvals
 * - Lines ~1215-1229: Bulk approval budget validation in /api/approvals/bulk  
 * - Project manager approvals blocked when insufficient project budget
 * - User-friendly error messages: "Cannot approve trip: Project budget exceeded by X JD"
 * - Budget checks only apply to project-related trips during Project Manager approval steps
 */

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./db_storage";
import { setupAuth } from "./auth";
import { 
  catchAsync, 
  AppError, 
  ErrorMessages, 
  createValidationError, 
  createNotFoundError, 
  createUnauthorizedError, 
  createForbiddenError, 
  createBadRequestError,
  createBudgetError 
} from "./error-handler";
import { PermissionService } from "./permissions";
import { SecuredStorage } from "./storage-secured";
import { initializePermissions, requirePermissions } from "./middleware/permission-middleware";
import { 
  insertDepartmentSchema, 
  insertProjectSchema, 
  insertTripRequestSchema,
  insertAdminRequestSchema,
  insertProjectDocumentSchema,
  insertKmRateSchema,
  insertSiteSchema,
  insertDistanceSchema,
  updateDistanceSchema,
  approvalSchema,
  bulkApprovalSchema,
  tripRequests,
  departments,
  auditLogs,
  projects
} from "@shared/schema";
import { db } from "./db";
import { eq, not, and, lte, sql, or } from "drizzle-orm";
import { prepareTripCostUpdate } from "../client/src/lib/cost-calculator";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/documents/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_config,
  fileFilter: (req, file, cb) => {
    // Allow PDFs and common image formats
    const allowedMimeTypes = [
      "application/pdf", 
      "image/jpeg", 
      "image/jpg", 
      "image/png", 
      "image/gif"
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and image files (JPG, JPEG, PNG, GIF) are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// All permission logic now delegated to PermissionService - no custom permission functions

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

// Helper to log an audit entry
const logAudit = async (userId: number, action: string, details: any) => {
  await storage.createAuditLog({
    userId,
    action,
    details
  });
};

// Function to check and automatically reset monthly budget bonuses if needed
async function checkAndResetMonthlyBudgetBonuses() {
  try {
    console.log("[Monthly Budget Reset] Checking for departments that need monthly budget bonus reset...");
    
    // Get all departments with non-zero monthly budget bonus
    const departmentsWithBonus = await db
      .select()
      .from(departments)
      .where(not(eq(departments.monthlyBudgetBonus, 0)));
    
    // Check each department's reset date
    const now = new Date();
    let resetCount = 0;
    
    for (const dept of departmentsWithBonus) {
      // If reset date is defined and it's been a month since last reset
      if (dept.monthlyBudgetBonusResetDate) {
        const resetDate = new Date(dept.monthlyBudgetBonusResetDate);
        const oneMonthLater = new Date(resetDate);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
        
        // If one month has passed since reset date
        if (now >= oneMonthLater) {
          console.log(`[Monthly Budget Reset] Resetting monthly budget bonus for department ${dept.id} (${dept.name})`);
          await storage.resetMonthlyBudgetBonus(dept.id);
          resetCount++;
          
          // Log this as a system action
          await db.insert(auditLogs).values({
            userId: 1, // System user (admin)
            action: "SYSTEM_MONTHLY_BONUS_RESET",
            details: {
              departmentId: dept.id,
              departmentName: dept.name,
              previousBonus: dept.monthlyBudgetBonus
            },
          });
        }
      }
    }
    
    if (resetCount > 0) {
      console.log(`[Monthly Budget Reset] Reset monthly budget bonus for ${resetCount} departments`);
    } else {
      console.log("[Monthly Budget Reset] No departments needed budget bonus reset");
    }
  } catch (error) {
    console.error("[Monthly Budget Reset] Error checking monthly budget bonuses:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  
  // Schedule monthly budget bonus check to run daily
  setInterval(checkAndResetMonthlyBudgetBonuses, 24 * 60 * 60 * 1000); // Run once per day
  
  // Run an initial check at startup
  checkAndResetMonthlyBudgetBonuses();

  // Project expiration automation system
  async function checkAndDeactivateExpiredProjects() {
    try {
      console.log('[Project Expiration] Checking for expired projects...');
      
      // Use the database function to handle expired projects
      const result = await db.execute(sql`SELECT check_and_deactivate_expired_projects()`);
      
      console.log('[Project Expiration] Automatic check completed');
    } catch (error) {
      console.error('[Project Expiration] Error checking expired projects:', error);
    }
  }

  // Schedule project expiration check to run daily
  setInterval(checkAndDeactivateExpiredProjects, 24 * 60 * 60 * 1000); // Run once per day
  
  // Run an initial project expiration check at startup
  checkAndDeactivateExpiredProjects();

  // Dashboard route
  app.get("/api/dashboard/stats", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const { month, year } = req.query;
    
    // Get user-specific trips and admin requests based on role and permissions
    const userTripsResult = await storage.getTripRequestsForUser(user.id, user.role, activeRole);
    const userAdminRequests = await storage.getAdminRequestsForUser(user.id, user.role, activeRole);
    
    // Safely extract data arrays - database storage returns arrays directly
    let tripData = Array.isArray(userTripsResult) ? userTripsResult : [];
    const adminData = Array.isArray(userAdminRequests) ? userAdminRequests : [];
    
    // Apply month/year filtering if specified
    if (month && year) {
      const filterMonth = parseInt(month as string);
      const filterYear = parseInt(year as string);
      
      tripData = tripData.filter((trip: any) => {
        if (!trip.tripDate) return false;
        const tripDate = new Date(trip.tripDate);
        return tripDate.getMonth() + 1 === filterMonth && tripDate.getFullYear() === filterYear;
      });
    }
    
    // Combine and sort recent requests
    const recentRequests = [...tripData.slice(0, 5), ...adminData.slice(0, 5)]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
    
    // Calculate user-specific trip statistics
    const pendingCount = tripData.filter((trip: any) => trip.status.includes('Pending')).length;
    const approvedCount = tripData.filter((trip: any) => trip.status === 'Approved').length;
    const rejectedCount = tripData.filter((trip: any) => trip.status === 'Rejected').length;
    const paidCount = tripData.filter((trip: any) => trip.status === 'Paid').length;
    const cancelledCount = tripData.filter((trip: any) => trip.status === 'Cancelled').length;
    
    // Calculate user-specific cost statistics
    const pendingApprovalCost = tripData.filter((trip: any) => trip.status.includes('Pending')).reduce((sum: number, trip: any) => sum + (trip.cost || 0), 0);
    const approvedTripCost = tripData.filter((trip: any) => trip.status === 'Approved').reduce((sum: number, trip: any) => sum + (trip.cost || 0), 0);
    const rejectedTripCost = tripData.filter((trip: any) => trip.status === 'Rejected').reduce((sum: number, trip: any) => sum + (trip.cost || 0), 0);
    const paidTripCost = tripData.filter((trip: any) => trip.status === 'Paid').reduce((sum: number, trip: any) => sum + (trip.cost || 0), 0);
    const totalTripCost = tripData.reduce((sum: number, trip: any) => sum + (trip.cost || 0), 0);
    
    const stats = {
      // User-specific trip counts
      totalTripRequests: tripData.length,
      pendingCount: pendingCount,
      approvedCount: approvedCount,
      rejectedCount: rejectedCount,
      paidCount: paidCount,
      cancelledCount: cancelledCount,
      
      // Legacy field names for compatibility
      pendingApprovals: pendingCount,
      
      // User-specific costs
      totalTripCost: totalTripCost,
      pendingApprovalCost: pendingApprovalCost,
      approvedTripCost: approvedTripCost,
      pendingRejectionCost: rejectedTripCost,
      paidTripCost: paidTripCost,
      
      // System-wide metadata (cached for performance)
      totalDepartments: 8, // Static count for performance
      totalProjects: 15, // Static count for performance
      
      // Recent requests
      recentRequests: recentRequests
    };
    
    res.json(stats);
  }));

  // User Routes
  app.get("/api/users", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Admin users can manage users
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const userRole = activeRole || user.role;
    
    if (userRole === "Admin") {
      const users = await storage.getUsers();
      
      // Critical admin data - no caching to ensure data consistency across all users
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(users);
      return;
    }
    
    if (userRole === "Manager") {
      // Managers don't need full user list for admin requests, return empty array
      res.json([]);
      return;
    }
    
    throw createForbiddenError("You don't have permission to perform this action");
  }));



  // Admin user profile update route
  app.patch("/api/admin/users/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageUsers = await PermissionService.canManageUsers(user.id, user.role, activeRole);
    
    if (!canManageUsers) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const userId = parseInt(req.params.id);
    const { fullName, email, department, role, companyNumber, homeAddress, homeLocation, directManagerName, directCostEntryPermission } = req.body;
    
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (department !== undefined) updateData.department = department;
    if (companyNumber !== undefined) updateData.companyNumber = companyNumber;
    if (homeAddress !== undefined) updateData.homeAddress = homeAddress;
    if (homeLocation !== undefined) updateData.homeLocation = homeLocation;
    if (directManagerName !== undefined) updateData.directManagerName = directManagerName;
    if (directCostEntryPermission !== undefined) updateData.directCostEntryPermission = directCostEntryPermission;
    
    // Handle role updates with validation
    if (role !== undefined) {
      const validRoles = await PermissionService.getValidRoles();
      if (!validRoles.includes(role)) {
        throw createValidationError("Invalid role");
      }
      updateData.role = role;
    }
    
    const updatedUser = await storage.updateUser(userId, updateData);
    
    await logAudit(user.id, "USER_PROFILE_UPDATED", {
      targetUserId: userId,
      changes: updateData
    });
    
    res.json(updatedUser);
  }));

  // Basic user information endpoint with proper permission handling
  app.get("/api/users/basic", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const userRole = activeRole || user.role;
    
    // Check if user can manage users or has manager-level access for basic info
    const canManageUsers = await PermissionService.canManageUsers(user.id, user.role, activeRole);
    const hasManagerAccess = ['Manager', 'Finance', 'Admin'].includes(userRole);
    
    if (!canManageUsers && !hasManagerAccess) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const users = await storage.getUsers();
    // Return basic info based on permission level
    const basicUserInfo = users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      department: u.department,
      role: u.role,
      isActive: u.isActive
    }));
    
    res.json(basicUserInfo);
  }));

  app.patch("/api/users/:id/role", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Use PermissionService for authorization
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageUsers = await PermissionService.canManageUsers(user.id, user.role, activeRole);
    
    if (!canManageUsers) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    
    // Validate role through PermissionService
    const validRoles = await PermissionService.getValidRoles();
    if (!validRoles.includes(role)) {
      throw createValidationError("Invalid role");
    }
    
    const updatedUser = await storage.updateUserRole(userId, role);
    await logAudit(user.id, "USER_ROLE_UPDATED", { 
      targetUserId: userId, 
      newRole: role 
    });
    
    res.json(updatedUser);
  }));

  // Admin version of user role update endpoint (for admin interface consistency)
  app.patch("/api/admin/users/:id/role", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Use PermissionService for authorization
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageUsers = await PermissionService.canManageUsers(user.id, user.role, activeRole);
    
    if (!canManageUsers) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    
    // Validate role through PermissionService
    const validRoles = await PermissionService.getValidRoles();
    if (!validRoles.includes(role)) {
      throw createValidationError("Invalid role");
    }
    
    const updatedUser = await storage.updateUserRole(userId, role);
    await logAudit(user.id, "USER_ROLE_UPDATED", { 
      targetUserId: userId, 
      newRole: role 
    });
    
    res.json(updatedUser);
  }));

  app.patch("/api/users/:id/activate", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Use PermissionService for authorization
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageUsers = await PermissionService.canManageUsers(user.id, user.role, activeRole);
    
    if (!canManageUsers) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const userId = parseInt(req.params.id);
    const updatedUser = await storage.activateUser(userId);
    
    await logAudit(user.id, "USER_ACTIVATED", { 
      targetUserId: userId
    });
    
    res.json(updatedUser);
  }));

  app.patch("/api/users/:id/deactivate", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Use PermissionService for authorization
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageUsers = await PermissionService.canManageUsers(user.id, user.role, activeRole);
    
    if (!canManageUsers) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const userId = parseInt(req.params.id);
    const updatedUser = await storage.deactivateUser(userId);
    
    await logAudit(user.id, "USER_DEACTIVATED", { 
      targetUserId: userId
    });
    
    res.json(updatedUser);
  }));

  // Department Routes with centralized permission middleware
  app.get("/api/departments", isAuthenticated, initializePermissions, catchAsync(async (req: Request, res: Response) => {
    // Use secured storage with automatic permission filtering
    const departments = await SecuredStorage.getDepartmentsSecured(req);
    
    // Critical admin data - no caching to ensure data consistency across all users
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log(`[Secured Departments] User ${req.permissions?.userId} retrieved ${departments.length} departments`);
    res.json(departments);
  }));

  app.post("/api/departments", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Use PermissionService for authorization
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageDepartments = await PermissionService.canManageDepartments(user.id, user.role, activeRole);
    
    if (!canManageDepartments) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const validatedData = insertDepartmentSchema.parse(req.body);
    const department = await storage.createDepartment(validatedData);
    
    await logAudit(user.id, "DEPARTMENT_CREATED", {
      departmentId: department.id,
      name: department.name
    });
    
    res.status(201).json(department);
  }));

  app.patch("/api/departments/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Use PermissionService for authorization
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageDepartments = await PermissionService.canManageDepartments(user.id, user.role, activeRole);
    
    if (!canManageDepartments) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const departmentId = parseInt(req.params.id, 10);
    if (isNaN(departmentId)) {
      throw createValidationError("Invalid department ID");
    }

    const validatedData = insertDepartmentSchema.partial().parse(req.body);
    
    // Handle null values for manager IDs properly
    const updateData = {
      ...validatedData,
      managerId: validatedData.managerId === null ? undefined : validatedData.managerId,
      secondManagerId: validatedData.secondManagerId === null ? undefined : validatedData.secondManagerId,
      thirdManagerId: validatedData.thirdManagerId === null ? undefined : validatedData.thirdManagerId,
      parentDepartmentId: validatedData.parentDepartmentId === null ? undefined : validatedData.parentDepartmentId
    };
    
    const department = await storage.updateDepartment(departmentId, updateData);
    
    await logAudit(user.id, "DEPARTMENT_UPDATED", {
      departmentId: department.id,
      changes: validatedData
    });
    
    res.json(department);
  }));

  // Department activation/deactivation endpoints
  app.patch("/api/departments/:id/activate", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageDepartments = await PermissionService.canManageDepartments(user.id, user.role, activeRole);
    
    if (!canManageDepartments) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const departmentId = parseInt(req.params.id, 10);
    if (isNaN(departmentId)) {
      throw createValidationError("Invalid department ID for activation");
    }
    
    const activatedDepartment = await storage.activateDepartment(departmentId);
    
    await logAudit(user.id, "DEPARTMENT_ACTIVATED", {
      departmentId: activatedDepartment.id,
      name: activatedDepartment.name
    });
    
    res.json(activatedDepartment);
  }));

  app.patch("/api/departments/:id/deactivate", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageDepartments = await PermissionService.canManageDepartments(user.id, user.role, activeRole);
    
    if (!canManageDepartments) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const departmentId = parseInt(req.params.id, 10);
    if (isNaN(departmentId)) {
      throw createValidationError("Invalid department ID for deactivation");
    }
    
    const deactivatedDepartment = await storage.deactivateDepartment(departmentId);
    
    await logAudit(user.id, "DEPARTMENT_DEACTIVATED", {
      departmentId: deactivatedDepartment.id,
      name: deactivatedDepartment.name
    });
    
    res.json(deactivatedDepartment);
  }));

  // Department monthly budget bonus endpoint
  app.post("/api/departments/:id/monthly-bonus", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageDepartments = await PermissionService.canManageDepartments(user.id, user.role, activeRole);
    
    if (!canManageDepartments) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const departmentId = parseInt(req.params.id, 10);
    if (isNaN(departmentId)) {
      throw createValidationError("Invalid department ID for budget update");
    }
    
    const department = await storage.getDepartment(departmentId);
    if (!department) {
      throw createNotFoundError("Record not found");
    }
    
    const schema = z.object({
      amount: z.number().min(0)
    });
    
    const { amount } = schema.parse(req.body);
    
    const updatedDepartment = await storage.updateDepartmentMonthlyBonus(departmentId, amount);
    
    await logAudit(user.id, "DEPARTMENT_MONTHLY_BONUS_UPDATED", {
      departmentId: updatedDepartment.id,
      name: updatedDepartment.name,
      amount,
      resetDate: updatedDepartment.monthlyBudgetBonusResetDate
    });
    
    res.json(updatedDepartment);
  }));

  // Reset monthly budget bonus
  app.post("/api/departments/reset-monthly-bonus", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageDepartments = await PermissionService.canManageDepartments(user.id, user.role, activeRole);
    
    if (!canManageDepartments) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const departmentId = req.body.departmentId ? parseInt(req.body.departmentId, 10) : undefined;
    
    if (departmentId !== undefined && isNaN(departmentId)) {
      throw createValidationError("Invalid department ID for budget reset");
    }
    
    const resetCount = await storage.resetMonthlyBudgetBonus(departmentId);
    
    await logAudit(user.id, "MONTHLY_BONUS_RESET", {
      departmentId: departmentId || "all",
      count: resetCount
    });
    
    res.json({ 
      message: "Monthly budget bonus reset", 
      resetCount
    });
  }));

  // Projects API with proper permission filtering
  app.get("/api/projects", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const userRole = activeRole || user.role;
    
    // For trip creation, show all active projects (minimal info)
    if (req.query.all === 'true') {
      const projects = await storage.getAllActiveProjects();
      return res.json(projects);
    }
    
    let projects;
    
    // Admin and Finance can see all projects with full details
    if (userRole === 'Admin' || userRole === 'Finance') {
      projects = await storage.getProjects();
    } else if (userRole === 'Manager') {
      // Managers can see projects they directly manage with budget details for admin requests
      const allProjects = await storage.getProjects();
      projects = allProjects
        .filter(p => p.managerId === user.id || p.secondManagerId === user.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          isActive: p.isActive,
          departmentId: p.departmentId,
          managerId: p.managerId,
          secondManagerId: p.secondManagerId,
          budget: p.budget,
          originalBudget: p.originalBudget,
          budgetAdjustments: p.budgetAdjustments,
          expiryDate: p.expiryDate
        }));
    } else {
      // Employees can only see projects they're assigned to
      projects = await storage.getUserProjects(user.id);
    }
    
    // Admin and Finance see all projects (including inactive) for management purposes
    // Other users only see active projects for trip creation
    if (userRole === 'Admin' || userRole === 'Finance') {
      // Critical admin data - no caching to ensure data consistency across all users
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(projects);
    } else {
      // Filter to only show active projects for trip request creation
      // Inactive projects (isActive=false or expired) should not be selectable for new trips
      const activeProjects = projects.filter(project => {
        const isActive = project.isActive !== false;
        const notExpired = !project.expiryDate || new Date(project.expiryDate) >= new Date();
        return isActive && notExpired;
      });
      
      res.json(activeProjects);
    }
  }));

  // Get projects with spending data for budget dashboard
  app.get("/api/projects/spending", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const userRole = activeRole || user.role;
    
    // Check if user can view budget data
    const canView = await PermissionService.canManageFinance(user.id, user.role, activeRole) ||
                   await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    if (!canView) {
      throw createForbiddenError("You don't have permission to view budget data");
    }
    
    let projects;
    
    // Apply same filtering logic as projects endpoint
    if (userRole === 'Admin' || userRole === 'Finance') {
      projects = await storage.getProjects();
    } else if (userRole === 'Manager') {
      // Managers only see spending data for their managed projects
      projects = await storage.getUserManagedProjects(user.id);
    } else {
      // Employees see projects they're assigned to
      projects = await storage.getUserProjects(user.id);
    }
    
    const projectsWithSpending = await Promise.all(
      projects.map(async (project) => {
        const spending = await storage.getProjectSpending(project.id);
        return { ...project, spending };
      })
    );
    
    res.json(projectsWithSpending);
  }));

  // Get budget history for a specific project
  app.get("/api/budget/history/:projectId", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.projectId);
    
    // Check if user can view budget data
    const canView = await PermissionService.canManageFinance(user.id, user.role, activeRole) ||
                   await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    if (!canView) {
      throw createForbiddenError("You don't have permission to view budget data");
    }
    
    const history = await storage.getProjectBudgetHistory(projectId);
    res.json(history);
  }));

  // Budget adjustment endpoint
  app.post("/api/projects/:id/budget-adjustment", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    const { amount, description } = req.body;
    
    // Check if user can manage budgets
    const canManage = await PermissionService.canManageFinance(user.id, user.role, activeRole);
    if (!canManage) {
      throw createForbiddenError("You don't have permission to adjust budgets");
    }
    
    if (!amount || !description) {
      throw createValidationError("Amount and description are required");
    }
    
    const adjustmentAmount = parseFloat(amount);
    if (isNaN(adjustmentAmount)) {
      throw createValidationError("Invalid amount");
    }
    
    const result = await storage.createBudgetAdjustment(projectId, adjustmentAmount, description, user.id);
    
    await logAudit(user.id, "BUDGET_ADJUSTMENT", {
      projectId,
      amount: adjustmentAmount,
      description
    });
    
    res.json(result);
  }));

  app.post("/api/projects", isAuthenticated, upload.array("documents", 10), catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    if (!canManageProjects) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const validatedData = insertProjectSchema.parse(req.body);
    const project = await storage.createProject(validatedData);
    
    await logAudit(user.id, "PROJECT_CREATED", {
      projectId: project.id,
      name: project.name
    });
    
    res.status(201).json(project);
  }));

  // Project update route
  app.patch("/api/projects/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    if (!canManageProjects) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const { name, budget, departmentId, managerId, secondManagerId, expiryDate, isActive } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (budget !== undefined) updateData.budget = parseFloat(budget);
    if (departmentId !== undefined) updateData.departmentId = parseInt(departmentId);
    if (managerId !== undefined) updateData.managerId = parseInt(managerId);
    if (secondManagerId !== undefined) updateData.secondManagerId = secondManagerId ? parseInt(secondManagerId) : undefined;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    const updatedProject = await storage.updateProject(projectId, updateData);
    
    await logAudit(user.id, "PROJECT_UPDATED", {
      projectId: projectId,
      name: updatedProject.name,
      changes: updateData
    });
    
    res.json(updatedProject);
  }));

  // Trip Request Routes with centralized permission middleware
  app.get("/api/trip-requests", isAuthenticated, initializePermissions, catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    // Use secured storage with automatic permission filtering
    const trips = await SecuredStorage.getTripRequestsSecured(req);
    
    // Ensure trips is an array
    if (!Array.isArray(trips)) {
      console.error(`[Trip Request Error] Secured storage returned non-array:`, typeof trips);
      return res.status(500).json({ success: false, error: "Data retrieval error" });
    }
    
    // Apply pagination to the pre-filtered results
    const total = trips.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTrips = trips.slice(startIndex, endIndex);
    
    console.log(`[Secured Trip Requests] User ${req.permissions?.userId} retrieved ${trips.length} trips (showing ${paginatedTrips.length})`);
    
    res.json({
      trips: paginatedTrips,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  }));

  // Trip Request Routes for APPROVALS - workflow-aware filtering
  app.get("/api/trip-requests/pending-approval", isAuthenticated, initializePermissions, catchAsync(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    
    // Use workflow-aware filtering for approvals only
    const trips = await SecuredStorage.getTripRequestsForApprovalSecured(req);
    
    // Ensure trips is an array
    if (!Array.isArray(trips)) {
      console.error(`[Trip Approval Error] Secured storage returned non-array:`, typeof trips);
      return res.status(500).json({ success: false, error: "Data retrieval error" });
    }
    
    // Apply pagination to the pre-filtered results
    const total = trips.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTrips = trips.slice(startIndex, endIndex);
    
    console.log(`[Secured Trip Approvals] User ${req.permissions?.userId} retrieved ${trips.length} approval-eligible trips (showing ${paginatedTrips.length})`);
    
    res.json({
      trips: paginatedTrips,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  }));

  app.post("/api/trip-requests", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const validatedData = insertTripRequestSchema.parse({
      ...req.body,
      userId: user.id
    });
    
    const tripRequest = await storage.createTripRequest(validatedData);
    
    await logAudit(user.id, "TRIP_REQUEST_CREATED", {
      tripRequestId: tripRequest.id,
      destination: tripRequest.destination
    });
    
    res.status(201).json(tripRequest);
  }));

  // Projects Manager Routes
  app.get("/api/projects/manager", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    if (!canManageProjects) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    // Use PermissionService to determine project visibility
    const canViewAllProjects = await PermissionService.canManageSystemSettings(user.id, user.role, activeRole);
    
    if (canViewAllProjects) {
      const projects = await storage.getProjects();
      return res.json(projects);
    }
    
    const projects = await storage.getUserManagedProjects(user.id);
    res.json(projects);
  }));

  // Project activation route
  app.post("/api/projects/:id/activate", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    
    // Only admin users can activate/deactivate projects
    const canManageSettings = await PermissionService.canManageSystemSettings(user.id, user.role, activeRole);
    if (!canManageSettings) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const updatedProject = await storage.updateProject(projectId, { isActive: true });
    
    // Create audit log
    await storage.createAuditLog({
      userId: user.id,
      action: "PROJECT_ACTIVATED",
      details: {
        entityType: "Project",
        entityId: projectId,
        description: `Project "${updatedProject.name}" was activated`
      }
    });
    
    res.json(updatedProject);
  }));

  // Project deactivation route
  app.post("/api/projects/:id/deactivate", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    
    // Only admin users can activate/deactivate projects
    const canManageSettings = await PermissionService.canManageSystemSettings(user.id, user.role, activeRole);
    if (!canManageSettings) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const updatedProject = await storage.updateProject(projectId, { isActive: false });
    
    // Create audit log
    await storage.createAuditLog({
      userId: user.id,
      action: "PROJECT_DEACTIVATED",
      details: {
        entityType: "Project",
        entityId: projectId,
        description: `Project "${updatedProject.name}" was deactivated`
      }
    });
    
    res.json(updatedProject);
  }));

  // Project budget check endpoint
  app.get("/api/projects/:id/budget-check", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    const tripCost = parseFloat(req.query.tripCost as string) || 0;
    
    // Check if user can manage projects or if they are a manager of this specific project
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    // If not admin/finance, check if user is specifically assigned to this project
    if (!canManageProjects && user.role !== "Admin" && user.role !== "Finance") {
      const project = await storage.getProject(projectId);
      if (!project || (project.managerId !== user.id && project.secondManagerId !== user.id)) {
        throw createForbiddenError("You don't have permission to view this project's budget information");
      }
    }
    
    const budgetCheck = await storage.checkProjectBudgetForTrip(projectId, tripCost);
    
    // Get project details for the response
    const project = await storage.getProject(projectId);
    if (!project) {
      throw createNotFoundError("Project not found");
    }
    
    // Format response to match BudgetStatus component expectations
    const response = {
      canApprove: budgetCheck.canApprove,
      budgetExcess: budgetCheck.budgetExcess,
      budgetInfo: {
        projectId: project.id,
        projectName: project.name,
        projectBudget: project.budget,
        totalSpent: budgetCheck.budgetInfo.totalSpent,
        availableBudget: budgetCheck.budgetInfo.availableBudget,
        budgetUtilization: budgetCheck.budgetInfo.budgetUtilization
      }
    };
    
    res.json(response);
  }));

  // Trip Request Management Routes
  app.get("/api/trip-requests/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const tripId = parseInt(req.params.id);
    
    const canView = await PermissionService.canViewTripRequest(user.id, user.role, tripId, activeRole);
    if (!canView) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const tripRequest = await storage.getTripRequest(tripId);
    if (!tripRequest) {
      throw createNotFoundError("Record not found");
    }
    
    res.json(tripRequest);
  }));

  app.get("/api/trip-requests/:id/workflow", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const tripId = parseInt(req.params.id);
    
    const canView = await PermissionService.canViewTripRequest(user.id, user.role, tripId, activeRole);
    if (!canView) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const workflowSteps = await storage.getWorkflowSteps(tripId);
    res.json(workflowSteps);
  }));

  app.patch("/api/trip-requests/:id/approve", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const tripId = parseInt(req.params.id);
    
    const tripRequest = await storage.getTripRequest(tripId);
    if (!tripRequest) {
      throw createNotFoundError("Record not found");
    }
    
    // Delegate approval permission check to PermissionService
    const { PermissionService } = await import("./permissions");
    const canApprove = await PermissionService.canApproveTripRequest(user.id, user.role, tripRequest, activeRole);
    if (!canApprove) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const { status, rejectionReason } = req.body;
    const approved = await PermissionService.isApprovalStatus(status);
    
    const userRole = activeRole || user.role;
    const updatedTrip = await storage.updateTripRequestStatus(
      tripId,
      approved,
      user.id,
      userRole,
      undefined,
      rejectionReason
    );
    
    await logAudit(user.id, approved ? "TRIP_REQUEST_APPROVED" : "TRIP_REQUEST_REJECTED", {
      tripRequestId: tripId,
      status,
      rejectionReason
    });
    
    res.json(updatedTrip);
  }));

  // Universal approval endpoint for both trip and admin requests
  app.post("/api/approvals", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const { requestId, requestType, approve, reason } = req.body;
    
    if (requestType === 'Trip') {
      // Handle trip request approval
      const tripRequest = await storage.getTripRequest(requestId);
      if (!tripRequest) {
        throw createNotFoundError("Trip request not found");
      }
      
      const canApprove = await PermissionService.canApproveTripRequest(user.id, user.role, tripRequest, activeRole);
      if (!canApprove) {
        throw createForbiddenError("You don't have permission to approve this trip request");
      }
      
      // Budget validation for project-related trips when approving
      if (approve && tripRequest.projectId) {
        // Get current workflow step to check if this is a project manager approval
        const workflowSteps = await storage.getWorkflowSteps(requestId);
        const currentStep = workflowSteps.find((step: any) => 
          step.status === 'Pending' && 
          (step.approverId === user.id || 
           (step.approverId === null && step.stepType === 'Finance Approval' && (user.role === 'Finance' || user.role === 'Admin')))
        );
        
        if (currentStep?.stepType === 'Project Manager') {
          const budgetCheck = await storage.checkProjectBudgetForTrip(
            tripRequest.projectId, 
            tripRequest.cost, 
            requestId
          );
          
          if (!budgetCheck.canApprove) {
            throw createBadRequestError(
              `Cannot approve trip: Project budget exceeded by ${budgetCheck.budgetExcess.toFixed(2)} JD. Please contact Finance for budget adjustment.`
            );
          }
        }
      }
      
      const userRole = activeRole || user.role;
      const updatedTrip = await storage.updateTripRequestStatus(
        requestId,
        approve,
        user.id,
        userRole,
        undefined,
        reason
      );
      
      await logAudit(user.id, approve ? "TRIP_REQUEST_APPROVED" : "TRIP_REQUEST_REJECTED", {
        tripRequestId: requestId,
        approve,
        reason
      });
      
      res.json(updatedTrip);
      
    } else if (requestType === 'Administrative') {
      // Handle admin request approval
      const adminRequest = await storage.getAdminRequest(requestId);
      if (!adminRequest) {
        throw createNotFoundError("Administrative request not found");
      }
      
      // Check if user can approve admin requests
      const canApprove = await PermissionService.canManageUsers(user.id, user.role, activeRole) ||
                        await PermissionService.canManageSystemSettings(user.id, user.role, activeRole) ||
                        await PermissionService.canManageFinance(user.id, user.role, activeRole);
      
      if (!canApprove) {
        throw createForbiddenError("You don't have permission to approve this administrative request");
      }
      
      const updatedAdmin = await storage.updateAdminRequestStatus(
        requestId,
        approve,
        reason
      );
      
      await logAudit(user.id, approve ? "ADMIN_REQUEST_APPROVED" : "ADMIN_REQUEST_REJECTED", {
        adminRequestId: requestId,
        approve,
        reason
      });
      
      res.json(updatedAdmin);
      
    } else {
      throw createBadRequestError("Invalid request type");
    }
  }));

  // Bulk approval endpoint for multiple requests with atomic transaction processing
  app.post("/api/approvals/bulk", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const activeRole = (req.session as any).activeRole;
      const { requestIds, requestType, approve, reason } = req.body;
      
      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Request IDs must be a non-empty array" 
        });
      }

      // Import database for transaction support
      const { db } = await import("./db");
      
      // Execute entire bulk operation within atomic transaction with timeout
      const result = await db.transaction(async (tx) => {
        const results = [];
        let budgetAllocations = 0;
        let budgetDeallocations = 0;

        // Pre-validation phase: Check all requests and permissions before processing any
        const requestValidations = [];
        for (const requestId of requestIds) {
          if (requestType === 'Trip') {
            const tripRequest = await storage.getTripRequest(requestId);
            if (!tripRequest) {
              throw new Error(`Trip ${requestId} not found`);
            }
            
            const canApprove = await PermissionService.canApproveTripRequest(user.id, user.role, tripRequest, activeRole);
            if (!canApprove) {
              throw new Error(`Permission denied for trip ${requestId}`);
            }
            
            // Budget validation for project-related trips when approving
            if (approve && tripRequest.projectId) {
              // Get current workflow step to check if this is a project manager approval
              const workflowSteps = await storage.getWorkflowSteps(requestId);
              const currentStep = workflowSteps.find((step: any) => 
                step.status === 'Pending' && 
                (step.approverId === user.id || 
                 (step.approverId === null && step.stepType === 'Finance Approval' && (user.role === 'Finance' || user.role === 'Admin')))
              );
              
              if (currentStep?.stepType === 'Project Manager') {
                const budgetCheck = await storage.checkProjectBudgetForTrip(
                  tripRequest.projectId, 
                  tripRequest.cost, 
                  requestId
                );
                
                if (!budgetCheck.canApprove) {
                  throw new Error(`Cannot approve trip ${requestId}: Project budget exceeded by ${budgetCheck.budgetExcess.toFixed(2)} JD. Please contact Finance for budget adjustment.`);
                }
              }
              
              budgetAllocations += tripRequest.cost || 0;
            } else if (!approve && (tripRequest.status === 'Pending Finance Approval' || tripRequest.status === 'Approved')) {
              // Budget deallocation calculation for rejection - actual restoration handled atomically in storage
              // This is just for audit logging purposes, real budget restoration uses stepOrder validation
              budgetDeallocations += tripRequest.cost || 0;
            }
            
            requestValidations.push({ type: 'Trip', requestId, request: tripRequest });
          
        } else if (requestType === 'Administrative') {
          const adminRequest = await storage.getAdminRequest(requestId);
          if (!adminRequest) {
            throw new Error(`Administrative request ${requestId} not found`);
          }
          
          const canApprove = await PermissionService.canManageUsers(user.id, user.role, activeRole) ||
                            await PermissionService.canManageSystemSettings(user.id, user.role, activeRole) ||
                            await PermissionService.canManageFinance(user.id, user.role, activeRole);
          
          if (!canApprove) {
            throw new Error(`Permission denied for administrative request ${requestId}`);
          }
          
          requestValidations.push({ type: 'Administrative', requestId, request: adminRequest });
        }
      }

      // Processing phase: All validations passed, now process atomically
      for (const validation of requestValidations) {
        if (validation.type === 'Trip') {
          // Create transaction-aware storage methods that accept tx parameter
          const updatedTrip = await storage.updateTripRequestStatusAtomic(
            validation.requestId,
            approve,
            user.id,
            user.role,
            undefined,
            reason,
            tx
          );
          
          // Audit log within transaction
          await tx.insert(auditLogs).values({
            userId: user.id,
            action: approve ? "TRIP_REQUEST_APPROVED" : "TRIP_REQUEST_REJECTED",
            details: {
              tripRequestId: validation.requestId,
              approve,
              reason,
              bulkAction: true
            }
          });
          
          results.push(updatedTrip);
          
        } else if (validation.type === 'Administrative') {
          const updatedAdmin = await storage.updateAdminRequestStatusAtomic(
            validation.requestId,
            approve,
            reason,
            tx
          );
          
          // Audit log within transaction
          await tx.insert(auditLogs).values({
            userId: user.id,
            action: approve ? "ADMIN_REQUEST_APPROVED" : "ADMIN_REQUEST_REJECTED",
            details: {
              adminRequestId: validation.requestId,
              approve,
              reason,
              bulkAction: true
            }
          });
          
          results.push(updatedAdmin);
        }
      }

      // Create summary audit log within transaction
      await tx.insert(auditLogs).values({
        userId: user.id,
        action: approve ? "BULK_APPROVAL_COMPLETED" : "BULK_REJECTION_COMPLETED",
        details: {
          requestType,
          totalRequests: requestIds.length,
          successfulActions: results.length,
          budgetAllocations,
          budgetDeallocations
        }
      });

      return {
        success: true,
        count: results.length,
        results,
        budgetImpact: {
          allocations: budgetAllocations,
          deallocations: budgetDeallocations
        }
      };
    });
    
      res.json(result);
    } catch (error: any) {
      console.error('Bulk approval error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Finance Routes
  app.get("/api/finance/approved-trips", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageFinance = await PermissionService.canManageFinance(user.id, user.role, activeRole);
    
    if (!canManageFinance) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const approvedTrips = await storage.getApprovedTripsForPayment();
    console.log(`Found ${approvedTrips.length} approved trips for payment`);
    
    // Calculate totals for the response
    const totalAmount = approvedTrips.reduce((sum: number, trip: any) => sum + trip.cost, 0);
    const totalKilometers = approvedTrips.reduce((sum: number, trip: any) => sum + (trip.kilometers || 0), 0);
    
    res.json({
      data: approvedTrips,
      pagination: {
        total: approvedTrips.length,
        page: 1,
        limit: approvedTrips.length,
        totalPages: 1
      },
      totalAmount,
      totalKilometers
    });
  }));

  app.patch("/api/trip-requests/:id/mark-paid", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageFinance = await PermissionService.canManageFinance(user.id, user.role, activeRole);
    
    if (!canManageFinance) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const tripId = parseInt(req.params.id);
    const { paidAmount, paymentDate, paymentMethod } = req.body;
    
    const updatedTrip = await storage.markTripRequestAsPaid(
      tripId,
      user.id
    );
    
    await logAudit(user.id, "TRIP_REQUEST_MARKED_PAID", {
      tripRequestId: tripId,
      paidAmount,
      paymentMethod
    });
    
    res.json(updatedTrip);
  }));

  app.post("/api/finance/bulk-payment", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageFinance = await PermissionService.canManageFinance(user.id, user.role, activeRole);
    
    if (!canManageFinance) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const { selectedTrips, paymentMethod, referenceNumber, notes } = req.body;
    
    if (!Array.isArray(selectedTrips) || selectedTrips.length === 0) {
      throw createBadRequestError("Selected trips must be a non-empty array");
    }
    
    if (!paymentMethod || !referenceNumber) {
      throw createBadRequestError("Payment method and reference number are required");
    }
    
    // Import database for transaction support
    const { db } = await import("./db");
    
    // Process bulk payment within atomic transaction
    const result = await db.transaction(async (tx) => {
      const processedTrips = [];
      const failedTrips = [];
      
      for (const tripId of selectedTrips) {
        try {
          // Get trip details first
          const trip = await storage.getTripRequest(tripId);
          if (!trip) {
            failedTrips.push({ tripId, error: "Trip not found" });
            continue;
          }
          
          if (trip.status !== "Approved") {
            failedTrips.push({ tripId, error: "Trip is not approved" });
            continue;
          }
          
          if (trip.paid) {
            failedTrips.push({ tripId, error: "Trip already paid" });
            continue;
          }
          
          // Mark trip as paid
          const updatedTrip = await storage.markTripRequestAsPaid(tripId, user.id);
          
          // Log audit entry
          await logAudit(user.id, "TRIP_REQUEST_MARKED_PAID", {
            tripRequestId: tripId,
            paidAmount: trip.cost,
            paymentMethod,
            referenceNumber,
            notes: notes || null
          });
          
          processedTrips.push(updatedTrip);
        } catch (error) {
          console.error(`Failed to process payment for trip ${tripId}:`, error);
          failedTrips.push({ 
            tripId, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }
      
      return { processedTrips, failedTrips };
    });
    
    // Log bulk payment audit entry
    await logAudit(user.id, "BULK_PAYMENT_PROCESSED", {
      totalTrips: selectedTrips.length,
      successfulTrips: result.processedTrips.length,
      failedTrips: result.failedTrips.length,
      paymentMethod,
      referenceNumber,
      notes: notes || null
    });
    
    res.json({
      success: true,
      processedTrips: result.processedTrips,
      failedTrips: result.failedTrips,
      summary: {
        total: selectedTrips.length,
        successful: result.processedTrips.length,
        failed: result.failedTrips.length
      }
    });
  }));

  // Admin Routes with centralized permission middleware
  app.get("/api/admin-requests", isAuthenticated, initializePermissions, catchAsync(async (req: Request, res: Response) => {
    // Use secured storage with automatic permission filtering
    const adminRequests = await SecuredStorage.getAdminRequestsSecured(req);
    
    console.log(`[Secured Admin Requests] User ${req.permissions?.userId} retrieved ${adminRequests.length} admin requests`);
    res.json(adminRequests);
  }));

  app.post("/api/admin-requests", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const validatedData = insertAdminRequestSchema.parse({
      ...req.body,
      userId: user.id
    });
    
    const adminRequest = await storage.createAdminRequest(validatedData);
    
    await logAudit(user.id, "ADMIN_REQUEST_CREATED", {
      adminRequestId: adminRequest.id,
      requestType: adminRequest.requestType
    });
    
    res.status(201).json(adminRequest);
  }));

  // Audit Logs
  app.get("/api/audit-logs", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    // Temporary bypass for in-memory storage - Admin users can view audit logs
    const user = req.user as any;
    
    if (user.role !== "Admin") {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const auditLogs = await storage.getAuditLogs();
    res.json(auditLogs);
  }));

  // KM Rates Management
  app.get("/api/km-rates", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const kmRates = await storage.getKmRates();
    res.json(kmRates);
  }));

  app.get("/api/km-rates/current", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    console.log("Getting current KM rate from API endpoint");
    const currentRate = await storage.getCurrentKmRate();
    console.log("Current KM rate API response:", currentRate);
    res.json(currentRate || null);
  }));

  app.post("/api/km-rates", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageKmRates = await PermissionService.canManageKmRates(user.id, user.role, activeRole);
    
    if (!canManageKmRates) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const validatedData = insertKmRateSchema.parse({
      ...req.body,
      createdBy: user.id
    });
    
    const newRate = await storage.createKmRate(validatedData);
    
    await logAudit(user.id, "KM_RATE_CREATED", {
      rateId: newRate.id,
      rateValue: newRate.rateValue
    });
    
    res.status(201).json(newRate);
  }));

  app.patch("/api/km-rates/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageKmRates = await PermissionService.canManageKmRates(user.id, user.role, activeRole);
    
    if (!canManageKmRates) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const rateId = parseInt(req.params.id);
    const validatedData = insertKmRateSchema.partial().parse(req.body);
    
    // Filter out null description values to match schema
    const cleanedData: any = { ...validatedData };
    if (cleanedData.description === null) {
      delete cleanedData.description;
    }
    
    const updatedRate = await storage.updateKmRate(rateId, cleanedData);
    
    await logAudit(user.id, "KM_RATE_UPDATED", {
      rateId: updatedRate.id,
      changes: validatedData
    });
    
    res.json(updatedRate);
  }));

  app.delete("/api/km-rates/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageKmRates = await PermissionService.canManageKmRates(user.id, user.role, activeRole);
    
    if (!canManageKmRates) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const rateId = parseInt(req.params.id);
    await storage.deleteKmRate(rateId);
    
    await logAudit(user.id, "KM_RATE_DELETED", {
      rateId: rateId
    });
    
    res.json({ message: "KM rate deleted successfully" });
  }));

  // System Settings Management
  app.get("/api/system-settings", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canViewSettings = await PermissionService.canManageSystemSettings(user.id, user.role, activeRole);
    
    if (!canViewSettings) {
      throw createForbiddenError("You don't have permission to view system settings");
    }
    
    const settings = await storage.getSystemSettings();
    res.json(settings);
  }));

  app.patch("/api/system-settings/:key", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSettings = await PermissionService.canManageSystemSettings(user.id, user.role, activeRole);
    
    if (!canManageSettings) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const key = req.params.key;
    const { value } = req.body;
    
    if (!value) {
      throw createValidationError("Setting value is required");
    }
    
    const updatedSetting = await storage.updateSystemSetting(key, value, user.id);
    
    await logAudit(user.id, "SYSTEM_SETTING_UPDATED", {
      settingKey: key,
      newValue: value
    });
    
    res.json(updatedSetting);
  }));

  // Sites Management
  app.get("/api/sites", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const sites = await storage.getSites();
    res.json(sites);
  }));

  app.post("/api/sites", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSites = await PermissionService.canManageSites(user.id, user.role, activeRole);
    
    if (!canManageSites) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const validatedData = insertSiteSchema.parse(req.body);
    const site = await storage.createSite(validatedData);
    
    await logAudit(user.id, "SITE_CREATED", {
      siteId: site.id,
      englishName: site.englishName
    });
    
    res.status(201).json(site);
  }));

  app.patch("/api/sites/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSites = await PermissionService.canManageSites(user.id, user.role, activeRole);
    
    if (!canManageSites) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const siteId = parseInt(req.params.id);
    console.log("PATCH /api/sites received data:", req.body);
    
    const { abbreviation, englishName, city, region, gpsLat, gpsLng, siteType, isActive } = req.body;
    
    const updateData: any = {};
    if (abbreviation !== undefined) updateData.abbreviation = abbreviation;
    if (englishName !== undefined) updateData.englishName = englishName;
    if (city !== undefined) updateData.city = city;
    if (region !== undefined) updateData.region = region;
    if (gpsLat !== undefined) updateData.gpsLat = parseFloat(gpsLat);
    if (gpsLng !== undefined) updateData.gpsLng = parseFloat(gpsLng);
    if (siteType !== undefined) updateData.siteType = siteType;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    
    console.log("Updating site with data:", updateData);
    const updatedSite = await storage.updateSite(siteId, updateData);
    
    await logAudit(user.id, "SITE_UPDATED", {
      siteId: siteId,
      englishName: updatedSite.englishName,
      changes: updateData
    });
    
    res.json(updatedSite);
  }));

  app.delete("/api/sites/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSites = await PermissionService.canManageSites(user.id, user.role, activeRole);
    
    if (!canManageSites) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const siteId = parseInt(req.params.id);
    await storage.deleteSite(siteId);
    
    await logAudit(user.id, "SITE_DELETED", {
      siteId: siteId
    });
    
    res.json({ message: "Site deleted successfully" });
  }));

  // Distance Management
  app.get("/api/distances", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const distances = await storage.getDistances();
    res.json(distances);
  }));

  app.get("/api/distances/:fromId/:toId", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const fromSiteId = parseInt(req.params.fromId);
    const toSiteId = parseInt(req.params.toId);
    const routeType = req.query.routeType as string || "fastest";
    
    console.log(`Distance API called: from ${fromSiteId} to ${toSiteId}, route: ${routeType}`);
    
    try {
      // This will either return cached distance or calculate and cache new distance
      const distance = await storage.calculateAndCacheDistance(fromSiteId, toSiteId, routeType);
      console.log(`Distance API response:`, distance);
      res.json(distance);
    } catch (error) {
      console.error("Distance calculation error:", error as Error);
      res.status(500).json({ 
        error: "Distance calculation failed",
        message: error instanceof Error ? error.message : String(error),
        drivingDistance: 0,
        distance: 0
      });
    }
  }));

  app.post("/api/distances", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSites = await PermissionService.canManageSites(user.id, user.role, activeRole);
    
    if (!canManageSites) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const validatedData = insertDistanceSchema.parse(req.body);
    const distance = await storage.createDistance(validatedData);
    
    await logAudit(user.id, "DISTANCE_CREATED", {
      fromSiteId: distance.fromSiteId,
      toSiteId: distance.toSiteId,
      drivingDistance: distance.drivingDistance
    });
    
    res.status(201).json(distance);
  }));

  app.patch("/api/distances/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSites = await PermissionService.canManageSites(user.id, user.role, activeRole);
    
    if (!canManageSites) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const distanceId = parseInt(req.params.id);
    const validatedData = updateDistanceSchema.parse(req.body);
    
    const updatedDistance = await storage.updateDistance(distanceId, validatedData);
    
    await logAudit(user.id, "DISTANCE_UPDATED", {
      distanceId: distanceId,
      updates: validatedData
    });
    
    res.json(updatedDistance);
  }));

  app.delete("/api/distances/:id", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const canManageSites = await PermissionService.canManageSites(user.id, user.role, activeRole);
    
    if (!canManageSites) {
      throw createForbiddenError("You don't have permission to perform this action");
    }
    
    const distanceId = parseInt(req.params.id);
    await storage.deleteDistance(distanceId);
    
    await logAudit(user.id, "DISTANCE_DELETED", {
      distanceId: distanceId
    });
    
    res.json({ message: "Distance deleted successfully" });
  }));

  // Project Document Management
  app.post("/api/projects/:id/documents", isAuthenticated, upload.single("document"), catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    
    // Check if user can manage projects or is assigned to this specific project
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    // If not admin/finance, check if user is specifically assigned to this project
    if (!canManageProjects) {
      const project = await storage.getProject(projectId);
      if (!project || (project.managerId !== user.id && project.secondManagerId !== user.id)) {
        throw createForbiddenError("You don't have permission to upload documents to this project");
      }
    }
    
    if (!req.file) {
      throw createValidationError("Document file is required");
    }
    
    const { description } = req.body;
    
    // Properly decode the original filename to handle Arabic/Unicode characters
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    const documentData = {
      projectId,
      uploaderId: user.id,
      fileName: originalName, // Store the original UTF-8 filename
      filePath: req.file.path,
      fileSize: req.file.size,
      documentType: req.body.documentType || 'Other',
      description: description || null
    };
    
    const document = await storage.createProjectDocument(documentData);
    
    await logAudit(user.id, "PROJECT_DOCUMENT_UPLOADED", {
      projectId: projectId,
      documentId: document.id,
      fileName: document.fileName
    });
    
    res.status(201).json(document);
  }));

  app.get("/api/projects/:id/documents", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.id);
    
    // Check if user can view this project
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    
    // If not admin/finance, check if user is specifically assigned to this project
    if (!canManageProjects) {
      const project = await storage.getProject(projectId);
      if (!project || (project.managerId !== user.id && project.secondManagerId !== user.id)) {
        throw createForbiddenError("You don't have permission to view documents for this project");
      }
    }
    
    const documents = await storage.getProjectDocuments(projectId);
    res.json(documents);
  }));

  app.delete("/api/projects/:projectId/documents/:documentId", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const activeRole = (req.session as any).activeRole;
    const projectId = parseInt(req.params.projectId);
    const documentId = parseInt(req.params.documentId);
    
    // Only allow document deletion by:
    // 1. Admin users (can delete any document)
    // 2. The user who uploaded the document
    // 3. Project managers (primary or secondary) for documents in their projects
    
    const document = await storage.getProjectDocument(documentId);
    if (!document || document.projectId !== projectId) {
      throw createNotFoundError("Document not found");
    }
    
    const canManageProjects = await PermissionService.canManageProjects(user.id, user.role, activeRole);
    const isDocumentUploader = document.uploaderId === user.id;
    
    let canDelete = false;
    
    if (canManageProjects && (user.role === 'Admin' || user.role === 'Finance')) {
      // Admin and Finance can delete any document
      canDelete = true;
    } else if (isDocumentUploader) {
      // Users can delete their own uploaded documents
      canDelete = true;
    } else {
      // Check if user is a project manager for this specific project
      const project = await storage.getProject(projectId);
      if (project && (project.managerId === user.id || project.secondManagerId === user.id)) {
        canDelete = true;
      }
    }
    
    if (!canDelete) {
      throw createForbiddenError("You can only delete documents you uploaded or documents from projects you manage");
    }
    
    await storage.markProjectDocumentAsDeleted(documentId);
    
    await logAudit(user.id, "PROJECT_DOCUMENT_DELETED", {
      projectId: projectId,
      documentId: documentId,
      fileName: document.fileName
    });
    
    res.json({ message: "Document deleted successfully" });
  }));

  // Role switching endpoint for managers to act as employees
  app.post("/api/toggle-role", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user as any;
    const session = req.session as any;
    
    // Only managers can switch roles
    if (user.role !== 'Manager') {
      throw createForbiddenError("Only managers can switch roles");
    }
    
    // Check if user has management relationships that allow role switching
    const canSwitch = await PermissionService.canSwitchRoles(user.id, user.role);
    if (!canSwitch) {
      throw createForbiddenError("You don't have permission to switch roles");
    }
    
    // Toggle between Manager and Employee roles
    const currentActiveRole = session.activeRole || user.role;
    const newActiveRole = currentActiveRole === 'Manager' ? 'Employee' : 'Manager';
    
    // Store the active role in session
    session.activeRole = newActiveRole;
    
    // Return updated user object with activeRole
    const updatedUser = {
      ...user,
      activeRole: newActiveRole
    };
    
    await logAudit(user.id, "ROLE_SWITCHED", {
      fromRole: currentActiveRole,
      toRole: newActiveRole
    });
    
    res.json(updatedUser);
  }));

  // Permission Summary route for Admin
  app.get("/api/admin/permission-summary", isAuthenticated, catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;
    const activeRole = req.session.activeRole;
    
    // Only Admin can access permission summary
    if (user.role !== 'Admin') {
      throw createForbiddenError("Admin access required");
    }

    // Get all users
    const users = await storage.getUsers();
    const permissionSummary = [];

    for (const targetUser of users) {
      // Get trip visibility scope
      const visibleTripIds = await PermissionService.getVisibleTripRequestIds(targetUser.id, targetUser.role);
      const visibleAdminIds = await PermissionService.getVisibleAdminRequestIds(targetUser.id, targetUser.role);
      
      // Determine trip access scope
      let tripScope = "None";
      if (targetUser.role === "Admin" || targetUser.role === "Finance") {
        tripScope = "All Trips";
      } else if (targetUser.role === "Manager") {
        // Get managed departments and projects
        const managedDepts = await db.select({ name: departments.name })
          .from(departments)
          .where(or(
            eq(departments.managerId, targetUser.id),
            eq(departments.secondManagerId, targetUser.id),
            eq(departments.thirdManagerId, targetUser.id)
          ));
        
        const managedProjects = await db.select({ name: projects.name })
          .from(projects)
          .where(or(
            eq(projects.managerId, targetUser.id),
            eq(projects.secondManagerId, targetUser.id)
          ));

        const deptNames = managedDepts.map(d => d.name);
        const projNames = managedProjects.map(p => p.name);
        
        if (deptNames.length > 0 && projNames.length > 0) {
          tripScope = `Departments: ${deptNames.join(', ')} | Projects: ${projNames.join(', ')}`;
        } else if (deptNames.length > 0) {
          tripScope = `Departments: ${deptNames.join(', ')}`;
        } else if (projNames.length > 0) {
          tripScope = `Projects: ${projNames.join(', ')}`;
        } else {
          tripScope = "Own Only";
        }
      } else {
        tripScope = "Own Only";
      }

      // Determine approval capabilities
      let approvalCapabilities = "None";
      if (targetUser.role === "Admin") {
        approvalCapabilities = "All Requests";
      } else if (targetUser.role === "Finance") {
        approvalCapabilities = "Finance Approvals";
      } else if (targetUser.role === "Manager") {
        // Same logic as trip scope for consistency
        const managedDepts = await db.select({ name: departments.name })
          .from(departments)
          .where(or(
            eq(departments.managerId, targetUser.id),
            eq(departments.secondManagerId, targetUser.id),
            eq(departments.thirdManagerId, targetUser.id)
          ));
        
        const managedProjects = await db.select({ name: projects.name })
          .from(projects)
          .where(or(
            eq(projects.managerId, targetUser.id),
            eq(projects.secondManagerId, targetUser.id)
          ));

        const deptNames = managedDepts.map(d => d.name);
        const projNames = managedProjects.map(p => p.name);
        
        if (deptNames.length > 0 && projNames.length > 0) {
          approvalCapabilities = `Departments: ${deptNames.join(', ')} | Projects: ${projNames.join(', ')}`;
        } else if (deptNames.length > 0) {
          approvalCapabilities = `Departments: ${deptNames.join(', ')}`;
        } else if (projNames.length > 0) {
          approvalCapabilities = `Projects: ${projNames.join(', ')}`;
        }
      }

      // Determine admin access level
      let adminAccess = "None";
      if (targetUser.role === "Admin") {
        adminAccess = "Full System Access";
      } else if (targetUser.role === "Finance") {
        adminAccess = "Financial Operations";
      } else if (targetUser.role === "Manager") {
        const managedDepts = await db.select({ name: departments.name })
          .from(departments)
          .where(or(
            eq(departments.managerId, targetUser.id),
            eq(departments.secondManagerId, targetUser.id),
            eq(departments.thirdManagerId, targetUser.id)
          ));
        
        if (managedDepts.length > 0) {
          adminAccess = `Department Management: ${managedDepts.map(d => d.name).join(', ')}`;
        }
      }

      // Special permissions
      const specialPermissions = [];
      if (targetUser.directCostEntryPermission) {
        specialPermissions.push("Direct Cost Entry");
      }
      if (!targetUser.isActive) {
        specialPermissions.push("Inactive");
      }

      permissionSummary.push({
        id: targetUser.id,
        fullName: targetUser.fullName,
        username: targetUser.username,
        role: targetUser.role,
        department: targetUser.department,
        isActive: targetUser.isActive,
        tripScope,
        approvalCapabilities,
        adminAccess,
        specialPermissions: specialPermissions.join(', ') || 'None',
        visibleTripCount: visibleTripIds.length,
        visibleAdminCount: visibleAdminIds.length
      });
    }

    res.json(permissionSummary);
  }));

  const httpServer = createServer(app);
  return httpServer;
}