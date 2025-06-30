# Trip Transportation Workflow System: Database Schema

> **IMPORTANT NOTICE**: This is a controlled document. No changes may be made to this document without explicit approval from the system owner. Any proposed changes must be reviewed and authorized before implementation.

This document provides a comprehensive overview of the database schema used in the Trip Transportation Workflow System. It describes all tables, their relationships, and how data is stored and accessed throughout the application.

## 1. Introduction

The database schema is designed to support the core functionality of the Trip Transportation Workflow System, including user management, department and project organization, trip requests, approval workflows, and budget tracking. The system uses PostgreSQL as its database management system with Drizzle ORM for typesafe database access.

## 1.1 Database Architecture Characteristics

### Single PostgreSQL Instance with Full ACID Compliance
- **Atomicity**: All database operations are atomic - transactions either complete fully or are rolled back entirely
- **Consistency**: Database constraints and validations ensure data remains in a valid state
- **Isolation**: Concurrent operations are isolated using PostgreSQL's transaction isolation levels
- **Durability**: Committed transactions are permanently stored and survive system failures

### Complete Transaction Atomicity for All Operations
- **Individual Operations**: Each trip request approval, budget modification, and status update uses atomic transactions
- **Bulk Operations**: Multi-request approvals are wrapped in single transactions ensuring all-or-nothing behavior
- **Budget Operations**: Budget allocations and deallocations are atomic with status changes
- **Audit Logging**: All audit entries are created within the same transaction as the operation being logged

### Real-time Budget Tracking with Atomic Validations
- **Atomic Budget Checks**: Budget validation and deduction occur within the same transaction
- **Real-time Calculations**: Budget availability is calculated in real-time considering all pending and approved requests
- **Rollback Protection**: Failed operations automatically restore budget state through transaction rollback
- **Cross-request Validation**: Bulk operations validate total budget impact before processing any individual request

### Database-First Permission System with Zero Hardcoded Logic
- **Workflow Steps Table**: All approval requirements stored in `workflow_steps` table
- **Dynamic Permission Validation**: Permissions determined by database relationships, not code logic
- **No Hardcoded Rules**: Business logic rules stored in database, not application code
- **Single Source of Truth**: Database serves as authoritative source for all workflow decisions

### Comprehensive Audit Logging for Compliance
- **Complete Action Tracking**: Every system action logged with user, timestamp, and details
- **Immutable Audit Trail**: Audit logs cannot be modified once created
- **Bulk Operation Tracking**: Individual and summary logs for batch operations
- **Compliance Ready**: Audit structure supports regulatory and organizational compliance requirements

### 1.2 Schema Diagram Overview

The system's data model revolves around these core entities:
- **Users**: System users with role-based permissions
- **Departments**: Organizational units with budgets and approval hierarchies
- **Projects**: Work efforts with assigned teams, budgets, and documentation
- **Trip Requests**: Transportation requests requiring approval
- **Admin Requests**: Administrative requests (e.g., budget increases)
- **KM Rates**: Configuration for distance-based cost calculation

## 2. CRITICAL DATABASE REQUIREMENTS

### 2.1 Department Creation Requirements
**MANDATORY**: All department creation operations must include the `monthlyBudgetBonus` field:

```sql
-- Required field in department creation
monthlyBudgetBonus DECIMAL NOT NULL DEFAULT 0
```

**Server Initialization Bug Prevention**: 
- This field is required to prevent server startup errors
- Missing this field causes routes.ts initialization failures
- Default value: 0 (must be explicitly set)

### 2.2 Recovery Procedures
If departments lack the monthlyBudgetBonus field:
```sql
-- Step 1: Add missing column
ALTER TABLE departments ADD COLUMN monthlyBudgetBonus DECIMAL DEFAULT 0;

-- Step 2: Update existing records
UPDATE departments SET monthlyBudgetBonus = 0 WHERE monthlyBudgetBonus IS NULL;

-- Step 3: Restart application server
```

## 3. Data Types and Enumerations

### 3.1 User Roles
```sql
CREATE TYPE user_role AS ENUM ('Employee', 'Manager', 'Finance', 'Admin');
```
Defines the four primary user roles in the system.

### 3.2 Request Status
```sql
CREATE TYPE request_status AS ENUM (
  'Pending Department Approval',
  'Pending Project Approval',
  'Pending Finance Approval',
  'Approved',
  'Rejected',
  'Paid',
  'Cancelled'
);
```
Tracks the approval workflow status for trip and administrative requests.

### 2.3 Request Types
```sql
CREATE TYPE request_type AS ENUM ('Trip', 'Administrative');
```
Distinguishes between different types of requests in the system.

### 2.4 Trip Types
```sql
CREATE TYPE trip_type AS ENUM ('Ticket', 'Planned', 'Urgent');
```
Defines the three types of transportation requests:
- **Ticket**: Problem-solving travel requiring department approval
- **Planned**: Project-based travel requiring project manager approval  
- **Urgent**: Time-sensitive travel with pre-approval documentation

### 2.5 Urgency Types
```sql
CREATE TYPE urgency_type AS ENUM ('Regular', 'Urgent');
```
**DEPRECATED**: This enum is kept for backward compatibility with existing records only. New trip requests should use the 'Urgent' value in the trip_type enum instead of setting a separate urgency flag. This field will be removed in a future database migration.

### 2.6 Cost Method Types
```sql
CREATE TYPE cost_method_type AS ENUM ('direct', 'km', 'destination');
```
Specifies how trip costs are calculated.

## 3. Core Tables

### 3.1 Users

**Table: users**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing user identifier |
| full_name | TEXT | NOT NULL | User's full name |
| company_number | TEXT | NOT NULL | Employee ID or company identifier |
| department | TEXT | NOT NULL | Department name the user belongs to |
| email | TEXT | NOT NULL | User's email address |
| home_address | TEXT | NOT NULL | User's residential address (for trip origin) |
| username | TEXT | NOT NULL, UNIQUE | Login username |
| password | TEXT | NOT NULL | Hashed password |
| role | user_role | NOT NULL, DEFAULT 'Employee' | User's system role |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Account activation status |
| direct_manager_name | TEXT | | Name of user's direct supervisor |
| direct_cost_entry_permission | BOOLEAN | NOT NULL, DEFAULT false | Permission to enter costs directly |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |

**Notes:**
- Users are assigned a single role but can switch to Employee role when needed
- The direct_cost_entry_permission field is controlled by administrators only
- Password storage uses scrypt algorithm with salt for secure hashing

### 3.2 Departments

**Table: departments**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing department identifier |
| name | TEXT | NOT NULL, UNIQUE | Department name |
| budget | REAL | NOT NULL | Annual department budget |
| monthly_incident_budget | REAL | NOT NULL, DEFAULT 0 | Monthly budget for incident (ticket) trips |
| monthly_budget_bonus | REAL | NOT NULL, DEFAULT 0 | Temporary monthly budget bonus |
| monthly_budget_bonus_reset_date | TIMESTAMP | | Date when the monthly bonus was last reset |
| manager_id | INTEGER | REFERENCES users(id) | Primary department manager |
| second_manager_id | INTEGER | REFERENCES users(id) | Secondary approval manager |
| third_manager_id | INTEGER | REFERENCES users(id) | Tertiary manager for exceptional approvals |
| parent_department_id | INTEGER | REFERENCES departments(id) | Parent department in hierarchy |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Department active status |
| created_at | TIMESTAMP | DEFAULT NOW() | Department creation timestamp |

**Notes:**
- Department budgets are tracked annually
- Monthly budget bonuses reset automatically at the beginning of each month
- Department hierarchy supports multi-level approval workflows
- Budget consumption is tracked through approved trip costs

### 3.3 Projects

**Table: projects**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing project identifier |
| name | TEXT | NOT NULL, UNIQUE | Project name |
| budget | REAL | NOT NULL | Total project budget |
| manager_id | INTEGER | REFERENCES users(id) | Primary project manager |
| second_manager_id | INTEGER | REFERENCES users(id) | Secondary project manager |
| department_id | INTEGER | REFERENCES departments(id) | Department owning the project |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Project status |
| expiry_date | DATE | | Project end date |
| created_at | TIMESTAMP | DEFAULT NOW() | Project creation timestamp |

**Notes:**
- Projects have finite lifespans controlled by the expiry_date
- Project budget is separate from department budget
- Projects belong to a specific department

### 3.4 Project Assignments

**Table: project_assignments**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing assignment identifier |
| user_id | INTEGER | NOT NULL, REFERENCES users(id) | Assigned user |
| project_id | INTEGER | NOT NULL, REFERENCES projects(id) | Project being assigned to |
| created_at | TIMESTAMP | DEFAULT NOW() | Assignment creation timestamp |

**Notes:**
- Implements many-to-many relationship between users and projects
- Users can only submit planned trip requests for projects they're assigned to

### 3.5 Trip Requests

**Table: trip_requests**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing request identifier |
| user_id | INTEGER | NOT NULL, REFERENCES users(id) | Requesting user |
| department_id | INTEGER | REFERENCES departments(id) | Department for the trip |
| project_id | INTEGER | REFERENCES projects(id) | Associated project (for planned trips) |
| trip_date | TIMESTAMP | NOT NULL | Date of the trip |
| origin | TEXT | NOT NULL | Starting location |
| destination | TEXT | NOT NULL | Ending location |
| purpose | TEXT | NOT NULL | Trip purpose |
| cost | REAL | NOT NULL | Trip cost (single source of truth) |
| kilometers | REAL | | Distance in kilometers |
| km_rate_id | INTEGER | REFERENCES km_rates(id) | Reference to rate record |
| km_rate_value | REAL | | Rate value used (for historical accuracy) |
| km_rate | REAL | | Legacy field for backward compatibility |
| cost_calculated_from_km | BOOLEAN | DEFAULT false | Whether cost was calculated from distance |
| cost_method | TEXT | DEFAULT 'direct' | Method used: 'direct', 'km', 'destination' |
| cost_updated_at | TIMESTAMP | | When cost was last updated |
| cost_updated_by | INTEGER | REFERENCES users(id) | Who updated the cost |
| attachment_path | TEXT | | Path to supporting document |
| status | request_status | NOT NULL, DEFAULT 'Pending Department Approval' | Current request status |
| created_at | TIMESTAMP | DEFAULT NOW() | Request creation timestamp |
| department_manager_approved | BOOLEAN | | Primary manager approval status |
| department_second_approved | BOOLEAN | | Secondary manager approval status |
| project_manager_approved | BOOLEAN | | Primary project manager approval status |
| project_second_approved | BOOLEAN | | Secondary project manager approval status |
| finance_approved | BOOLEAN | | Finance approval status |
| rejection_reason | TEXT | | Reason if request was rejected |
| notified | BOOLEAN | DEFAULT false | Whether user was notified of status change |
| trip_type | trip_type | | Type of trip (Ticket, Planned, Urgent) |
| urgency_type | urgency_type | | Legacy urgency field |
| incident_no | TEXT | | Ticket number for ticket-based trips (legacy field name) |
| attachment_required | BOOLEAN | DEFAULT false | Whether attachment is required |
| status_history | JSON | DEFAULT [] | History of all status changes |
| last_updated_by | INTEGER | REFERENCES users(id) | User who last updated the request |
| last_updated_at | TIMESTAMP | | When request was last updated |
| paid | BOOLEAN | DEFAULT false | Whether trip has been paid |
| paid_at | TIMESTAMP | | When trip was marked as paid |
| paid_by | INTEGER | REFERENCES users(id) | User who marked trip as paid |

**Notes:**
- Trip requests are the central entity in the system
- The cost field is the single source of truth for all financial calculations
- Status history is stored as structured JSON for audit and tracking
- Approval flags track individual approvals within the workflow
- Multiple cost calculation methods are supported based on user permissions

### 3.6 Administrative Requests

**Table: admin_requests**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing request identifier |
| user_id | INTEGER | NOT NULL, REFERENCES users(id) | Requesting user |
| subject | TEXT | NOT NULL | Request subject |
| description | TEXT | NOT NULL | Detailed request description |
| attachment_path | TEXT | | Path to supporting document |
| status | request_status | NOT NULL, DEFAULT 'Pending Finance Approval' | Current request status |
| created_at | TIMESTAMP | DEFAULT NOW() | Request creation timestamp |
| finance_approved | BOOLEAN | | Finance approval status |
| request_type | TEXT | NOT NULL | Type of administrative request |
| trip_request_id | INTEGER | REFERENCES trip_requests(id) | Related trip request if applicable |
| requested_amount | REAL | | Amount requested (legacy field) |
| target_type | TEXT | | Target: 'department' or 'project' |
| target_id | INTEGER | | ID of department or project |
| rejection_reason | TEXT | | Reason if request was rejected |
| notified | BOOLEAN | DEFAULT false | Whether user was notified of status change |
| status_history | JSON | DEFAULT [] | History of all status changes |
| last_updated_by | INTEGER | REFERENCES users(id) | User who last updated the request |
| last_updated_at | TIMESTAMP | | When request was last updated |
| paid | BOOLEAN | DEFAULT false | Whether request has been paid/fulfilled |
| paid_at | TIMESTAMP | | When request was marked as paid |
| paid_by | INTEGER | REFERENCES users(id) | User who marked request as paid |

**Notes:**
- Administrative requests handle non-trip related requests such as budget increases
- They can target either departments or projects
- Similar approval workflow tracking as trip requests
- Can be linked to trip requests when related

### 3.7 Project Documents

**Table: project_documents**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing document identifier |
| project_id | INTEGER | NOT NULL, REFERENCES projects(id) | Associated project |
| uploader_id | INTEGER | NOT NULL, REFERENCES users(id) | User who uploaded the document |
| file_name | TEXT | NOT NULL | Original file name |
| file_path | TEXT | NOT NULL | System storage path |
| file_size | INTEGER | NOT NULL | File size in bytes |
| document_type | TEXT | NOT NULL | Type of document |
| description | TEXT | | Document description |
| upload_date | TIMESTAMP | DEFAULT NOW() | Upload timestamp |
| is_deleted | BOOLEAN | DEFAULT false | Soft deletion flag |

**Notes:**
- Stores project-related documentation
- Uses soft deletion (is_deleted flag) rather than physical deletion
- Supports documentation for project trips

### 3.8 System Settings

**Table: system_settings**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing setting identifier |
| setting_key | TEXT | NOT NULL, UNIQUE | Setting identifier key |
| setting_value | TEXT | NOT NULL | Setting value |
| description | TEXT | | Setting description |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| updated_by | INTEGER | REFERENCES users(id) | User who last updated the setting |

**Notes:**
- Centralized configuration storage
- Used for system-wide settings like maximum distances, thresholds, etc.
- Changes are audited through the updated_by and updated_at fields

### 3.9 Audit Logs

**Table: audit_logs**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing log identifier |
| user_id | INTEGER | NOT NULL, REFERENCES users(id) | User who performed the action |
| action | TEXT | NOT NULL | Action description |
| details | JSON | | Additional structured details |
| created_at | TIMESTAMP | DEFAULT NOW() | Timestamp of the action |

**Notes:**
- Records all significant system actions for audit purposes
- Structured JSON details allow for flexible reporting
- Critical for tracking administrative changes to rates, budgets, etc.

### 3.10 KM Rates

**Table: km_rates**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing rate identifier |
| rate_value | REAL | NOT NULL | Rate value per kilometer |
| effective_from | DATE | NOT NULL | Start date of rate validity |
| effective_to | DATE | | End date of rate validity (null = still active) |
| created_at | TIMESTAMP | DEFAULT NOW() | Rate creation timestamp |
| created_by | INTEGER | NOT NULL, REFERENCES users(id) | User who created the rate |
| description | TEXT | | Rate description |

**Notes:**
- Stores historical and current kilometer rates
- Supports time-based rate changes with effectiveFrom/effectiveTo dates
- Rate changes require Finance or Admin role
- Rate changes are captured in the audit log

## 4. Data Relationships

### 4.1 Key Relationships
- **Users** belong to **Departments** (via the department field)
- **Users** are assigned to **Projects** (via project_assignments)
- **Users** submit **Trip Requests** and **Admin Requests**
- **Departments** own **Projects**
- **Trip Requests** can be associated with **Projects** (for planned trips)
- **Trip Requests** use **KM Rates** for cost calculations
- **Admin Requests** can target **Departments** or **Projects**

### 4.2 Hierarchical Relationships
- **Departments** can have parent departments (hierarchical structure)
- **Approval workflows** follow hierarchical paths based on the request type and department structure

## 5. Special Data Considerations

### 5.1 Status History
The status_history field in trip_requests and admin_requests tables stores a JSON array with the following structure:
```typescript
type StatusHistoryEntry = {
  status: string;        // New status value
  timestamp: Date;       // When the status changed
  userId: number;        // Who changed the status
  userName?: string;     // User's name (for display)
  role?: string;         // User's role at time of change
  reason?: string;       // Reason for change (especially rejections)
};
```

### 5.2 Trip Type Mapping
The system uses standardized trip type terminology:
- **Ticket**: Problem-solving travel (previously called "Incident")
- **Planned**: Project-based travel (previously called "Project")
- **Urgent**: Time-sensitive travel with pre-approval documentation

All documentation has been updated to use the new standardized terminology.

### 5.3 Cost Calculation
Trip costs are calculated using one of three methods:
1. **Direct entry**: Manually entered cost (requires special permission)
2. **KM-based**: Cost = Distance × Current KM Rate
3. **Destination-based**: Fixed costs based on destination (future capability)

The `cost` field is the single source of truth for all financial calculations.

## 6. Database Schema Evolution

### 6.1 Recent Schema Changes
1. Addition of the monthly_budget_bonus and monthly_budget_bonus_reset_date fields to departments
2. Addition of third_manager_id to departments for tertiary approvals
3. Restructured trip cost fields to make cost the single source of truth
4. Enhanced status history tracking with structured JSON data

### 6.2 Planned Schema Enhancements
1. Complete the trip_type enum migration to standardize on 'Ticket', 'Planned', 'Urgent'
2. Add system support for destination-based cost calculations
3. Enhance the department hierarchy model for multi-level approvals

## 7. Data Migration and Maintenance

### 7.1 Migration Approach
The system uses Drizzle ORM's migration capabilities to manage schema changes. Migration scripts are executed with:
```bash
npm run db:push
```

### 7.2 Data Integrity Rules
1. Soft deletion is preferred over hard deletion for most data
2. Foreign key constraints ensure referential integrity
3. All financial transactions (cost updates, budget changes) are logged in the audit system
4. Default values provide sensible fallbacks for optional fields

### 7.3 Backup and Recovery
The database is backed up daily with point-in-time recovery capabilities.

## 8. Query Patterns and Performance

### 8.1 Common Query Patterns
1. **User trip requests**: Filtered by user_id
2. **Department trip requests**: Filtered by department_id
3. **Project trip requests**: Filtered by project_id
4. **Approval queries**: Filtered by status and specific manager IDs
5. **Budget reporting**: Aggregating costs by department or project

### 8.2 Indexes
Key indexes are maintained on:
- Foreign key fields (user_id, department_id, project_id)
- Status field for efficient workflow queries
- Date fields for reporting (created_at, trip_date)

### 8.3 Performance Considerations
- The status_history JSON field is designed for auditing, not for frequent querying
- Batch operations use transaction support for consistency
- Monthly budget reset operations are scheduled during off-peak hours