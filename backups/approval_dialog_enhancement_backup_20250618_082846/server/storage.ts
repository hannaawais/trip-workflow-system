import { 
  User, 
  InsertUser, 
  Department, 
  InsertDepartment, 
  Project, 
  InsertProject,
  ProjectAssignment,
  InsertProjectAssignment,
  ProjectDocument,
  InsertProjectDocument,
  TripRequest,
  InsertTripRequest,
  AdminRequest,
  InsertAdminRequest,
  AuditLog,
  InsertAuditLog,
  SystemSetting,
  InsertSystemSetting,
  KmRate,
  InsertKmRate,
  Site,
  InsertSite,
  Distance,
  InsertDistance,
  WorkflowStep,
  InsertWorkflowStep
} from "@shared/schema";
import session from "express-session";

export interface IStorage {
  // Session store
  sessionStore: any;
  
  // User related methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;
  updateUserRole(userId: number, role: string): Promise<User>;
  updateUser(userId: number, data: { 
    fullName?: string; 
    email?: string; 
    department?: string; 
    companyNumber?: string; 
    homeAddress?: string; 
    directManagerName?: string;
    homeLocation?: string;
    directCostEntryPermission?: boolean;
  }): Promise<User>;
  activateUser(userId: number): Promise<User>;
  deactivateUser(userId: number): Promise<User>;
  
  // Department related methods
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartments(): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(departmentId: number, data: { 
    name?: string; 
    budget?: number; 
    isActive?: boolean;
    managerId?: number | null;
    secondManagerId?: number | null;
    thirdManagerId?: number | null;
    parentDepartmentId?: number | null;
    monthlyBudgetBonus?: number;
    monthlyBudgetBonusResetDate?: Date | null;
  }): Promise<Department>;
  updateDepartmentBudget(departmentId: number, amount: number): Promise<Department>;
  updateDepartmentMonthlyBonus(departmentId: number, amount: number): Promise<Department>;
  resetMonthlyBudgetBonus(departmentId?: number): Promise<number>;
  activateDepartment(departmentId: number): Promise<Department>;
  deactivateDepartment(departmentId: number): Promise<Department>;
  
  // Project related methods
  getProject(id: number): Promise<Project | undefined>;
  getProjects(): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(projectId: number, data: { 
    name?: string; 
    budget?: number; 
    departmentId?: number | null;
    managerId?: number | null;
    secondManagerId?: number | null;
    expiryDate?: Date;
    isActive?: boolean;
  }): Promise<Project>;
  updateProjectBudget(projectId: number, amount: number): Promise<Project>;
  getProjectSpending(projectId: number): Promise<{ totalSpent: number; availableBudget: number; budgetUtilization: number }>;
  checkProjectBudgetForTrip(projectId: number, tripCost: number): Promise<{ canApprove: boolean; budgetExcess: number; budgetInfo: any }>;
  getDepartmentProjects(departmentName: string): Promise<Project[]>;
  getAllActiveProjects(): Promise<Project[]>;
  
  // Project document methods
  getProjectDocument(id: number): Promise<ProjectDocument | undefined>;
  getProjectDocuments(projectId: number): Promise<ProjectDocument[]>;
  createProjectDocument(document: InsertProjectDocument): Promise<ProjectDocument>;
  markProjectDocumentAsDeleted(documentId: number): Promise<ProjectDocument>;
  
  // Project assignment methods
  assignUserToProject(assignment: InsertProjectAssignment): Promise<ProjectAssignment>;
  getUserProjects(userId: number): Promise<Project[]>;
  getUserManagedProjects(userId: number): Promise<Project[]>;
  
  // Trip request methods
  getTripRequest(id: number): Promise<TripRequest | undefined>;
  getTripRequests(page: number, limit: number): Promise<{data: any[], total: number}>;
  getTripRequestsForUser(userId: number, userRole: string, activeRole?: string): Promise<any[]>;
  getUserTripRequests(userId: number, page: number, limit: number): Promise<{data: TripRequest[], total: number}>;
  getDepartmentTripRequests(department: string, page: number, limit: number): Promise<{data: TripRequest[], total: number}>;
  getProjectManagerTripRequests(managerId: number, page: number, limit: number): Promise<{data: TripRequest[], total: number}>;
  createTripRequest(tripRequest: InsertTripRequest): Promise<TripRequest>;
  updateTripRequestStatus(
    requestId: number, 
    approve: boolean, 
    userId: number, 
    role: string, 
    customStatus?: string,
    reason?: string
  ): Promise<TripRequest>;
  updateTripRequestCost(
    requestId: number,
    cost: number,
    costMethod: string,
    costCalculatedFromKm: boolean,
    kmRateId?: number | null,
    kmRateValue?: number | null
  ): Promise<TripRequest>;
  markTripRequestAsPaid(
    requestId: number,
    userId: number
  ): Promise<TripRequest>;
  
  // Administrative request methods
  getAdminRequest(id: number): Promise<AdminRequest | undefined>;
  getAdminRequests(): Promise<AdminRequest[]>;
  getAdminRequestsForUser(userId: number, userRole: string, activeRole?: string): Promise<any[]>;
  getUserAdminRequests(userId: number): Promise<AdminRequest[]>;
  getDepartmentAdminRequests(department: string): Promise<AdminRequest[]>;
  createAdminRequest(adminRequest: InsertAdminRequest): Promise<AdminRequest>;
  updateAdminRequestStatus(
    requestId: number, 
    approve: boolean, 
    reason?: string
  ): Promise<AdminRequest>;
  
  // System settings methods
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  getSystemSettings(): Promise<SystemSetting[]>;
  updateSystemSetting(key: string, value: string, userId: number): Promise<SystemSetting>;
  createSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  
  // Audit log methods
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(): Promise<AuditLog[]>;
  getUserAuditLogs(userId: number): Promise<AuditLog[]>;
  
  // KM Rate methods
  getKmRate(id: number): Promise<KmRate | undefined>;
  getKmRates(): Promise<KmRate[]>;
  getCurrentKmRate(date?: Date): Promise<KmRate | undefined>;
  createKmRate(kmRate: InsertKmRate): Promise<KmRate>;
  updateKmRate(kmRateId: number, data: { 
    rateValue?: number; 
    effectiveFrom?: Date; 
    description?: string; 
    isActive?: boolean 
  }): Promise<KmRate>;
  deleteKmRate(kmRateId: number): Promise<void>;
  
  // Site methods
  getSite(id: number): Promise<Site | undefined>;
  getSites(): Promise<Site[]>;
  getActiveSites(): Promise<Site[]>;
  getSiteByAbbreviation(abbreviation: string): Promise<Site | undefined>;
  createSite(site: InsertSite): Promise<Site>;
  updateSite(siteId: number, data: { 
    abbreviation?: string; 
    englishName?: string; 
    arabicName?: string; 
    isActive?: boolean;
    latitude?: number;
    longitude?: number;
  }): Promise<Site>;
  deleteSite(siteId: number): Promise<void>;
  
  // Distance methods
  getDistance(fromSiteId: number, toSiteId: number, routeType?: string): Promise<Distance | undefined>;
  getDistances(): Promise<Distance[]>;
  createDistance(distance: InsertDistance): Promise<Distance>;
  updateDistance(distanceId: number, data: { 
    drivingDistance?: number; 
    estimatedTime?: number; 
    routeType?: string 
  }): Promise<Distance>;
  deleteDistance(distanceId: number): Promise<void>;
  calculateAndCacheDistance(fromSiteId: number, toSiteId: number, routeType?: string): Promise<Distance>;
  
  // Workflow methods
  createWorkflowSteps(tripRequestId: number, steps: InsertWorkflowStep[]): Promise<WorkflowStep[]>;
  getWorkflowSteps(tripRequestId: number): Promise<WorkflowStep[]>;
  updateWorkflowStep(stepId: number, data: {
    status?: string;
    approvedAt?: Date;
    approvedBy?: number;
    rejectionReason?: string;
  }): Promise<WorkflowStep>;
  generateWorkflowForTrip(tripRequest: TripRequest): Promise<WorkflowStep[]>;
  
  // Reporting methods
  getMonthlyReport(month: number, year: number): Promise<any>;
  getApprovedTripsForPayment(): Promise<any[]>;
  recalculateTripCosts(rateId?: number): Promise<number>;
  
  // Atomic transaction-aware methods for bulk operations
  updateTripRequestStatusAtomic(
    requestId: number, 
    approve: boolean, 
    userId: number, 
    role: string, 
    customStatus?: string,
    reason?: string,
    tx?: any
  ): Promise<TripRequest>;
  updateAdminRequestStatusAtomic(
    requestId: number,
    approve: boolean,
    reason?: string,
    tx?: any
  ): Promise<AdminRequest>;

}

// Import our database storage implementation
import { storage } from "./db_storage";

// Export the database storage instance
export { storage };