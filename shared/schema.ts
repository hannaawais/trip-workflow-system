import { pgTable, text, serial, integer, boolean, timestamp, pgEnum, real, json, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User role enum
export const roleEnum = pgEnum('user_role', ['Employee', 'Manager', 'Finance', 'Admin']);

// Request status enum
export const statusEnum = pgEnum('request_status', [
  'Pending Department Approval',
  'Pending Project Approval',
  'Pending Finance Approval',
  'Approved',
  'Rejected',
  'Paid',
  'Cancelled'
]);

// Request type enum
export const requestTypeEnum = pgEnum('request_type', ['Trip', 'Administrative']);

// Trip type enum
export const tripTypeEnum = pgEnum('trip_type', ['Ticket', 'Planned', 'Urgent']);

// DEPRECATED: urgency type enum - DO NOT USE for new features
// This field is kept only for existing data compatibility and will be removed in future versions
// Use trip_type field instead for all new implementations
export const urgencyTypeEnum = pgEnum('urgency_type', ['Regular', 'Urgent']);

// Cost method enum
export const costMethodEnum = pgEnum('cost_method_type', ['direct', 'km', 'destination']);

// Workflow step type enum
export const workflowStepTypeEnum = pgEnum('workflow_step_type', [
  'Department Manager',
  'Second Department Manager', 
  'Tertiary Department Manager',
  'Project Manager',
  'Second Project Manager',
  'Finance Approval',
  'Admin Review'
]);

// Workflow step status enum
export const workflowStepStatusEnum = pgEnum('workflow_step_status', [
  'Pending',
  'Approved', 
  'Rejected',
  'Skipped'
]);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  companyNumber: text("company_number").notNull().unique(),
  department: text("department").notNull(),
  email: text("email").notNull().unique(),
  homeAddress: text("home_address").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default('Employee'),
  isActive: boolean("is_active").notNull().default(true),
  // New field: Direct manager name (can be updated by the user)
  directManagerName: text("direct_manager_name"),
  // New field: Direct cost entry permission (only admin can change, default No)
  directCostEntryPermission: boolean("direct_cost_entry_permission").notNull().default(false),
  // New field: GPS coordinates for home location
  homeLocation: text("home_location"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  budget: real("budget").notNull(),
  monthlyIncidentBudget: real("monthly_incident_budget").notNull().default(0),
  // New field: Monthly budget bonus (temporary increase that resets monthly)
  monthlyBudgetBonus: real("monthly_budget_bonus").notNull().default(0),
  // Reset date to track when the monthly bonus was last reset
  monthlyBudgetBonusResetDate: timestamp("monthly_budget_bonus_reset_date"),
  // Manager fields
  managerId: integer("manager_id").references(() => users.id),
  secondManagerId: integer("second_manager_id").references(() => users.id),
  // New field: Third manager for exceptional approvals
  thirdManagerId: integer("third_manager_id").references(() => users.id),
  // New field: Parent department for hierarchical structure
  parentDepartmentId: integer("parent_department_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  budget: real("budget").notNull(), // Legacy field - will become computed during transition
  originalBudget: real("original_budget"), // Never modified after creation
  budgetAdjustments: real("budget_adjustments").notNull().default(0), // Admin increases/decreases
  managerId: integer("manager_id").references(() => users.id),
  secondManagerId: integer("second_manager_id").references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
  isActive: boolean("is_active").notNull().default(true),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project assignments table (Many-to-Many)
export const projectAssignments = pgTable("project_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  projectId: integer("project_id").notNull().references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Trip requests table
export const tripRequests = pgTable("trip_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
  projectId: integer("project_id").references(() => projects.id),
  tripDate: timestamp("trip_date").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  purpose: text("purpose").notNull(),
  
  // Cost fields - primary source of truth for all trip costs
  cost: real("cost").notNull(), // THE single source of truth for cost
  kilometers: real("kilometers"), // Distance in KM (final distance used for calculations)
  originalDistance: real("original_distance"), // Originally recommended distance from OpenRoute API (for reference only)
  kmRateId: integer("km_rate_id").references(() => kmRates.id), // Reference to the rate record
  kmRateValue: real("km_rate_value"), // The actual rate value used (stored for historical accuracy)
  kmRate: real("km_rate"), // Legacy field for backward compatibility
  costCalculatedFromKm: boolean("cost_calculated_from_km").default(false), // Legacy flag
  costMethod: text("cost_method").default('direct'), // Method used for calculation: 'direct', 'km', 'destination'
  costUpdatedAt: timestamp("cost_updated_at"), // When cost was last updated
  costUpdatedBy: integer("cost_updated_by").references(() => users.id), // Who updated cost
  
  // Home trip deduction fields
  homeDeductionKm: real("home_deduction_km"), // Amount deducted for home trips
  isHomeTripOrigin: boolean("is_home_trip_origin").default(false),
  isHomeTripDestination: boolean("is_home_trip_destination").default(false),
  originalDistanceBeforeDeduction: real("original_distance_before_deduction"), // Distance before home deduction
  userHomeGpsUsed: text("user_home_gps_used"), // GPS coordinates used for home location
  
  // Regular fields
  attachmentPath: text("attachment_path"),
  status: statusEnum("status").notNull().default('Pending Department Approval'),
  createdAt: timestamp("created_at").defaultNow(),
  // DEPRECATED: Legacy approval fields - workflow now managed via workflow_steps table
  // These fields are kept for migration compatibility only and should not be used
  departmentManagerApproved: boolean("department_manager_approved"),
  departmentSecondApproved: boolean("department_second_approved"),
  projectManagerApproved: boolean("project_manager_approved"),
  projectSecondApproved: boolean("project_second_approved"),
  financeApproved: boolean("finance_approved"),
  rejectionReason: text("rejection_reason"),
  notified: boolean("notified").default(false),
  tripType: tripTypeEnum("trip_type"),
  urgencyType: urgencyTypeEnum("urgency_type"),
  ticketNo: text("ticket_no"), // Ticket number for ticket-based trips
  attachmentRequired: boolean("attachment_required").default(false),
  
  // Fields for status history and approval timeline
  statusHistory: json("status_history").default([]), // Structured history of all status changes
  lastUpdatedBy: integer("last_updated_by").references(() => users.id),
  lastUpdatedAt: timestamp("last_updated_at"),
  paid: boolean("paid").default(false),
  paidAt: timestamp("paid_at"),
  paidBy: integer("paid_by").references(() => users.id),
});

// Administrative requests table
export const adminRequests = pgTable("admin_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  attachmentPath: text("attachment_path"),
  status: statusEnum("status").notNull().default('Pending Finance Approval'),
  createdAt: timestamp("created_at").defaultNow(),
  financeApproved: boolean("finance_approved"),
  requestType: text("request_type").notNull(),
  // Reference to a trip cost if applicable
  tripRequestId: integer("trip_request_id").references(() => tripRequests.id),
  // Field should be deprecated in favor of the appropriate trip record
  // Keeping for backward compatibility
  requestedAmount: real("requested_amount"),
  targetType: text("target_type"), // 'department' or 'project'
  targetId: integer("target_id"), // departmentId or projectId
  rejectionReason: text("rejection_reason"),
  notified: boolean("notified").default(false),
  // Status history and approval timeline
  statusHistory: json("status_history").default([]),
  lastUpdatedBy: integer("last_updated_by").references(() => users.id),
  lastUpdatedAt: timestamp("last_updated_at"),
  paid: boolean("paid").default(false),
  paidAt: timestamp("paid_at"),
  paidBy: integer("paid_by").references(() => users.id),
});

// Project documents table
export const projectDocuments = pgTable("project_documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  uploaderId: integer("uploader_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  documentType: text("document_type").notNull(),
  description: text("description"),
  uploadDate: timestamp("upload_date").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

// System settings table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Audit log table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  details: json("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// KM rates table
export const kmRates = pgTable("km_rates", {
  id: serial("id").primaryKey(),
  rateValue: real("rate_value").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  description: text("description"),
});

// Site type enum
export const siteTypeEnum = pgEnum('site_type', ['Hospital', 'Comprehensive clinic', 'Primary Clinic', 'Directory', 'Other']);

// Sites table
export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  abbreviation: text("abbreviation").notNull().unique(),
  englishName: text("english_name").notNull(),
  city: text("city").notNull(),
  region: text("region"),
  gpsLat: real("gps_lat").notNull(),
  gpsLng: real("gps_lng").notNull(),
  siteType: siteTypeEnum("site_type").notNull().default('Other'),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Distances table for caching route calculations
export const distances = pgTable("distances", {
  id: serial("id").primaryKey(),
  fromSiteId: integer("from_site_id").notNull().references(() => sites.id),
  toSiteId: integer("to_site_id").notNull().references(() => sites.id),
  drivingDistance: real("driving_distance").notNull(), // in kilometers
  estimatedTime: integer("estimated_time").notNull(), // in minutes
  routeType: text("route_type").default("fastest").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workflow steps table - stores approval chain for each trip request
export const workflowSteps = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  tripRequestId: integer("trip_request_id").notNull().references(() => tripRequests.id),
  stepOrder: integer("step_order").notNull(), // 1, 2, 3, etc.
  stepType: workflowStepTypeEnum("step_type").notNull(),
  approverId: integer("approver_id").references(() => users.id), // Who should approve this step
  approverName: text("approver_name"), // Name of approver (cached for display)
  status: workflowStepStatusEnum("status").notNull().default('Pending'),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id), // Who actually approved
  rejectionReason: text("rejection_reason"),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project budget history table - tracks all budget-related transactions
export const projectBudgetHistory = pgTable("project_budget_history", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  transactionType: text("transaction_type").notNull(), // 'initial', 'adjustment', 'allocation', 'deallocation'
  amount: real("amount").notNull(),
  runningBalance: real("running_balance").notNull(), // Available budget after this transaction
  referenceId: integer("reference_id"), // trip_request_id for allocations, admin_request_id for adjustments
  referenceType: text("reference_type"), // 'trip_request', 'admin_request', 'manual'
  description: text("description"), // Human-readable description of the transaction
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    // Make the direct manager name optional
    directManagerName: z.string().optional(),
    // Omit directCostEntryPermission from insert schema as it's admin-only
    directCostEntryPermission: z.boolean().optional().default(false),
    // Enhanced validation for username (no spaces, case-insensitive)
    username: z.string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be less than 30 characters")
      .regex(/^\S+$/, "Username cannot contain spaces")
      .toLowerCase(),
    // Enhanced validation for email (unique, proper format)
    email: z.string()
      .email("Please enter a valid email address")
      .toLowerCase(),
    // Enhanced validation for company number (4-digit format)
    companyNumber: z.string()
      .regex(/^\d{4}$/, "Company number must be exactly 4 digits"),
    // GPS coordinates validation for home location (optional)
    homeLocation: z.string()
      .regex(/^-?\d+\.\d+,-?\d+\.\d+$/, "Home location must be in format: latitude,longitude (e.g., 31.9522,35.2332)")
      .optional(),
  });
export const insertDepartmentSchema = createInsertSchema(departments)
  .omit({ id: true, createdAt: true })
  .extend({
    // Make new fields optional
    monthlyBudgetBonus: z.number().default(0),
    monthlyBudgetBonusResetDate: z.union([
      z.date(),
      z.string().transform((str) => new Date(str)),
      z.null()
    ]).nullable().optional(),
    thirdManagerId: z.number().nullable().optional(),
    parentDepartmentId: z.number().nullable().optional(),
  });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true })
  .extend({
    // Ensure originalBudget is set during creation
    originalBudget: z.number().min(0.01, "Original budget must be greater than 0"),
    budgetAdjustments: z.number().default(0),
    // Required fields for project creation
    departmentId: z.number({
      required_error: "Department is required",
    }),
    managerId: z.number({
      required_error: "Project manager is required",
    }),
    // Optional secondary manager that supports null for clearing
    secondManagerId: z.number().nullable().optional(),
  });
export const insertProjectAssignmentSchema = createInsertSchema(projectAssignments).omit({ id: true, createdAt: true });
export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({ 
  id: true, 
  uploadDate: true, 
  isDeleted: true 
});
export const insertTripRequestSchema = createInsertSchema(tripRequests)
  .omit({ 
    id: true, 
    createdAt: true, 
    departmentManagerApproved: true, 
    departmentSecondApproved: true,
    projectManagerApproved: true,
    projectSecondApproved: true,
    financeApproved: true,
    status: true,
    rejectionReason: true,
    notified: true,
    statusHistory: true,
    lastUpdatedBy: true,
    lastUpdatedAt: true,
    paid: true,
    paidAt: true,
    paidBy: true,
    // Allow costCalculatedFromKm to be passed through from frontend
    // costCalculatedFromKm: true,
    costMethod: true,
    costUpdatedAt: true,
    costUpdatedBy: true,
    kmRate: true,
    kmRateId: true,
    kmRateValue: true
  })
  .extend({
    // Make tripDate accept either Date or string that can be parsed into a valid date
    tripDate: z.union([
      z.date(),
      z.string().transform((str) => new Date(str))
    ]),
    // Make kilometers optional
    kilometers: z.number().optional(),
    // Add cost calculation method
    costCalculationMethod: z.enum(['direct', 'km', 'destination']).optional(),
    // Add KM calculation flag
    costCalculatedFromKm: z.boolean().optional(),
    // Add KM rate reference
    kmRateId: z.number().optional(),
    // Make cost optional during creation (can be calculated after)
    cost: z.number().optional(),
    
    // Trip type must be one of the three supported types
    tripType: z.enum(['Ticket', 'Planned', 'Urgent']),
    
    // Make purpose optional by default
    purpose: z.string().optional(),
    
    // Make userId optional since it's set server-side
    userId: z.number().optional(),
    
    // Make departmentId optional since it can be auto-assigned
    departmentId: z.number().optional()
  })
  .refine((data) => {
    // Purpose is now optional for all trip types
    return true;
  });
export const insertAdminRequestSchema = createInsertSchema(adminRequests).omit({ 
  id: true, 
  createdAt: true, 
  financeApproved: true,
  status: true,
  rejectionReason: true,
  notified: true,
  statusHistory: true,
  lastUpdatedBy: true,
  lastUpdatedAt: true,
  paid: true,
  paidAt: true,
  paidBy: true
});
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export const insertKmRateSchema = createInsertSchema(kmRates).omit({ id: true, createdAt: true })
  .extend({
    // Make effectiveFrom and effectiveTo fields accept Date or string
    effectiveFrom: z.union([
      z.date(),
      z.string().transform((str) => new Date(str))
    ]),
    effectiveTo: z.union([
      z.date(),
      z.string().transform((str) => new Date(str)),
      z.null()
    ]).nullable()
  });

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    // GPS coordinates validation
    gpsLat: z.number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90"),
    gpsLng: z.number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180"),
    // Abbreviation validation (uppercase, no spaces, max 10 chars)
    abbreviation: z.string()
      .min(2, "Abbreviation must be at least 2 characters")
      .max(10, "Abbreviation must be no more than 10 characters")
      .regex(/^[A-Z0-9]+$/, "Abbreviation must contain only uppercase letters and numbers")
      .transform((val) => val.toUpperCase()),
    region: z.string().optional(),
  });

export const insertDistanceSchema = createInsertSchema(distances).omit({ id: true, createdAt: true, lastUpdated: true });
export const updateDistanceSchema = insertDistanceSchema.partial();

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({ 
  id: true, 
  createdAt: true, 
  approvedAt: true, 
  approvedBy: true 
});

export const insertProjectBudgetHistorySchema = createInsertSchema(projectBudgetHistory).omit({ 
  id: true, 
  createdAt: true 
});

// Type definitions
export type User = typeof users.$inferSelect & {
  activeRole?: string; // Used for role switching - not persisted in database
};
export type InsertUser = z.infer<typeof insertUserSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type ProjectAssignment = typeof projectAssignments.$inferSelect;
export type InsertProjectAssignment = z.infer<typeof insertProjectAssignmentSchema>;

export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;

export type TripRequest = typeof tripRequests.$inferSelect;
export type InsertTripRequest = z.infer<typeof insertTripRequestSchema>;

export type AdminRequest = typeof adminRequests.$inferSelect;
export type InsertAdminRequest = z.infer<typeof insertAdminRequestSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type KmRate = typeof kmRates.$inferSelect;
export type InsertKmRate = z.infer<typeof insertKmRateSchema>;

export type Site = typeof sites.$inferSelect;
export type InsertSite = z.infer<typeof insertSiteSchema>;

export type Distance = typeof distances.$inferSelect;
export type InsertDistance = z.infer<typeof insertDistanceSchema>;

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;

export type ProjectBudgetHistory = typeof projectBudgetHistory.$inferSelect;
export type InsertProjectBudgetHistory = z.infer<typeof insertProjectBudgetHistorySchema>;

// Login schema for validation
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginData = z.infer<typeof loginSchema>;

// Registration schema for authentication with password confirmation
export const registrationSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Approval schema
export const approvalSchema = z.object({
  requestId: z.number(),
  requestType: z.enum(['Trip', 'Administrative']),
  approve: z.boolean(),
  reason: z.string().optional(),
});

export type ApprovalData = z.infer<typeof approvalSchema>;

// Bulk approval schema
export const bulkApprovalSchema = z.object({
  requestIds: z.array(z.number()),
  requestType: z.enum(['Trip', 'Administrative']),
  approve: z.boolean(),
  reason: z.string().optional(),
});

export type BulkApprovalData = z.infer<typeof bulkApprovalSchema>;

// Status history entry type
export type StatusHistoryEntry = {
  status: string;
  timestamp: Date;
  userId: number;
  userName?: string;
  role?: string;
  reason?: string;
};