# Trip Transportation Workflow Management System: Approval Workflow

> **IMPORTANT NOTICE**: This is a controlled document. No changes may be made to this document without explicit approval from the system owner. Any proposed changes must be reviewed and authorized before implementation.

This document serves as the single source of truth for the approval workflow in the Trip Transportation Management System. It details all possible approval paths, status transitions, and role permissions.

## 1. Trip Request Approval Workflow

### 1.1 Overview

The system supports three types of trip requests, each with its own distinct approval workflow:

1. **Ticket Trips** - Used for problem-solving travel
2. **Planned Trips** - Used for project-related travel
3. **Urgent Trips** - Used for time-sensitive travel with pre-approval

### 1.2 Complete Workflow Flowcharts

#### Ticket Trip Workflow
```
┌─────────────────┐
│   Employee      │
│ Submits Ticket  │
│   Trip Request  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ System Creates  │
│ Workflow Steps: │
│ 1. Dept Manager │
│ 2. Finance      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ Pending Dept    │───►│ Department      │
│ Manager         │    │ Manager Review  │
│ Approval        │    │                 │
└─────────────────┘    └─────────┬───────┘
                                 │
                       ┌─────────▼───────┐
                       │   Approved?     │
                       └─────────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Approved   │ │  Rejected   │ │Need Changes │
            │             │ │             │ │             │
            └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                   │               │               │
                   ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Pending     │ │ Request     │ │ Return to   │
            │ Finance     │ │ Rejected    │ │ Employee    │
            │ Approval    │ │ (Final)     │ │ for Updates │
            └──────┬──────┘ └─────────────┘ └─────────────┘
                   │
                   ▼
            ┌─────────────┐    ┌─────────────────┐
            │ Finance     │───►│ Finance Review  │
            │ Review      │    │ & Budget Check  │
            │             │    │                 │
            └─────────────┘    └─────────┬───────┘
                                         │
                               ┌─────────▼───────┐
                               │   Approved?     │
                               └─────────┬───────┘
                                         │
                            ┌────────────┼────────────┐
                            │            │            │
                            ▼            ▼            ▼
                    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                    │ Approved    │ │ Rejected    │ │Cost Updated │
                    │ (Final)     │ │ (Final)     │ │ Continue    │
                    │             │ │             │ │ Process     │
                    └─────────────┘ └─────────────┘ └─────────────┘
```

#### Planned Trip Workflow
```
┌─────────────────┐
│   Employee      │
│ Submits Planned │
│   Trip Request  │
│ (Project-based) │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ System Creates  │
│ Workflow Steps: │
│ 1. Project Mgr  │
│ 2. Finance      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐
│ Pending Project │───►│ Project Manager │
│ Manager         │    │ Review &        │
│ Approval        │    │ Budget Check    │
└─────────────────┘    └─────────┬───────┘
                                 │
                       ┌─────────▼───────┐
                       │ Valid Project & │
                       │ Budget Available│
                       └─────────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  Approved   │ │  Rejected   │ │Budget Issue │
            │             │ │             │ │             │
            └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                   │               │               │
                   ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Pending     │ │ Request     │ │ Admin       │
            │ Finance     │ │ Rejected    │ │ Request for │
            │ Approval    │ │ (Final)     │ │ Budget +    │
            └──────┬──────┘ └─────────────┘ └─────────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │ Finance Final       │
        │ Approval Process    │
        │ (Same as Ticket)    │
        └─────────────────────┘
```

#### Urgent Trip Workflow
```
┌─────────────────┐
│   Employee      │
│ Submits Urgent  │
│ Trip Request    │
│ + Documentation │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ System Validates│
│ Pre-approval    │
│ Documentation   │
│ Required        │
└─────────┬───────┘
          │
    ┌─────▼─────┐
    │Documentation│
    │  Present?   │
    └─────┬─────┘
          │
     ┌────┼────┐
     │    │    │
     ▼    ▼    ▼
┌─────────┐ ┌─────────────┐
│   No    │ │    Yes      │
│ Reject  │ │ Continue    │
│ Submit  │ │ Process     │
└─────────┘ └──────┬──────┘
                   │
                   ▼
            ┌─────────────────┐
            │ System Creates  │
            │ Workflow Steps: │
            │ 1. Finance Only │
            │ (Fast Track)    │
            └─────────┬───────┘
                      │
                      ▼
            ┌─────────────────┐    ┌─────────────────┐
            │ Pending Finance │───►│ Finance Review  │
            │ Approval        │    │ Documentation   │
            │ (Direct)        │    │ & Budget        │
            └─────────────────┘    └─────────┬───────┘
                                             │
                                   ┌─────────▼───────┐
                                   │ Documentation   │
                                   │ Valid & Budget  │
                                   │ Available?      │
                                   └─────────┬───────┘
                                             │
                                ┌────────────┼────────────┐
                                │            │            │
                                ▼            ▼            ▼
                        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                        │ Approved    │ │ Rejected    │ │Cost/Budget  │
                        │ (Final)     │ │ (Final)     │ │ Update      │
                        │             │ │             │ │ Required    │
                        └─────────────┘ └─────────────┘ └─────────────┘
```

### 1.3 Status Transition Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Complete Status Transition Map                  │
└─────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────┐
                            │ Trip Request    │
                            │ Submitted       │
                            └─────────┬───────┘
                                      │
                        ┌─────────────▼─────────────┐
                        │  Initial Status Based on  │
                        │      Trip Type             │
                        └─────────────┬─────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
                ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │ Pending Dept    │   │ Pending Project │   │ Pending Finance │
    │ Manager         │   │ Manager         │   │ Approval        │
    │ Approval        │   │ Approval        │   │ (Urgent Only)   │
    └─────────┬───────┘   └─────────┬───────┘   └─────────┬───────┘
              │                     │                     │
              ▼                     ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │ Approved or     │   │ Approved or     │   │ Final Decision: │
    │ Rejected by     │   │ Rejected by     │   │ Approved,       │
    │ Dept Manager    │   │ Project Manager │   │ Rejected, or    │
    └─────────┬───────┘   └─────────┬───────┘   │ Cost Update     │
              │                     │           └─────────────────┘
              ▼                     ▼
    ┌─────────────────┐   ┌─────────────────┐
    │ If Approved:    │   │ If Approved:    │
    │ → Finance       │   │ → Finance       │
    │ If Rejected:    │   │ If Rejected:    │
    │ → Final         │   │ → Final         │
    └─────────┬───────┘   └─────────┬───────┘
              │                     │
              └─────────┬───────────┘
                        │
                        ▼
            ┌─────────────────────┐
            │ Pending Finance     │
            │ Approval (Final)    │
            └─────────┬───────────┘
                      │
                      ▼
            ┌─────────────────────┐
            │ Finance Decision:   │
            │ • Approved → Paid   │
            │ • Rejected → Final  │
            │ • Cost Update       │
            └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                Valid Status Transitions Matrix                     │
└─────────────────────────────────────────────────────────────────────┘

From Status                    │ Valid Next Statuses
───────────────────────────────┼─────────────────────────────────────
Pending Department Approval    │ Approved, Rejected, Cancelled
Pending Project Approval       │ Approved, Rejected, Cancelled  
Pending Finance Approval       │ Approved, Rejected, Paid, Cancelled
Approved                       │ Paid, Cancelled
Rejected                       │ (Final - No transitions)
Paid                          │ (Final - No transitions)
Cancelled                     │ (Final - No transitions)
```

### 1.4 Database-Driven Workflow Validation

```
┌─────────────────────────────────────────────────────────────────────┐
│              Workflow Steps Table Validation Process               │
└─────────────────────────────────────────────────────────────────────┘

Request Approval Attempt
          │
          ▼
┌─────────────────────┐
│ Query workflow_steps│
│ WHERE request_id =  │
│ AND status =        │
│ 'Pending'           │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐       ┌─────────────────────┐
│ Step Found?         │ NO    │ Reject: Invalid     │
│                     │──────►│ Approval Sequence   │
└─────────┬───────────┘       └─────────────────────┘
          │ YES
          ▼
┌─────────────────────┐
│ Check user has      │
│ required_role from  │
│ workflow step       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐       ┌─────────────────────┐
│ Role Match?         │ NO    │ Reject: Insufficient│
│                     │──────►│ Permissions         │
└─────────┬───────────┘       └─────────────────────┘
          │ YES
          ▼
┌─────────────────────┐
│ BEGIN TRANSACTION   │
│                     │
│ 1. Update workflow  │
│    step status      │
│ 2. Update request   │
│    status           │
│ 3. Update budget    │
│    (if approved)    │
│ 4. Create audit log │
│                     │
│ COMMIT TRANSACTION  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Generate next       │
│ workflow step       │
│ (if required)       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Return success      │
│ with updated        │
│ request status      │
└─────────────────────┘
```

## CRITICAL WORKFLOW ENFORCEMENT UPDATES

### Sequential Approval Validation (MANDATORY)
All approval operations must validate current status before progression:

```typescript
// CORRECT: Status validation before approval
if (currentStatus !== expectedPreviousStatus) {
  throw new Error("Invalid approval sequence - workflow corruption prevented");
}

// FORBIDDEN: Direct status changes without validation
request.status = "Approved"; // NEVER DO THIS
```

### Department ID Resolution Requirements
**CRITICAL FIX**: All requests must resolve departmentId properly:

```typescript
// REQUIRED: Proper departmentId resolution
const department = departments.find(d => d.name === user.department);
if (!department) {
  throw new Error("Department not found - cannot process request");
}
const departmentId = department.id;
```

### 1.2 Request Statuses

All trip requests have one of the following statuses:

| Status | Description |
|--------|-------------|
| Pending Department Approval | Request awaiting approval from department manager(s) |
| Pending Project Approval | Request awaiting project manager approval |
| Pending Finance Approval | Request awaiting finance department approval |
| Approved | Request fully approved but not yet paid |
| Paid | Request approved and payment processed |
| Rejected | Request rejected at any stage of approval |
| Cancelled | Request cancelled by submitter or system administrator |

### 1.2.1 Critical Finance Approval Policy

**MANDATORY FINANCE APPROVAL**: All trip requests, regardless of cost, trip type, or distance, must receive finance department approval before being marked as "Approved". This is a non-negotiable business rule with no exceptions:

- **No cost threshold**: Finance approval is required even for zero-cost trips
- **All trip types**: Ticket, Planned, and Urgent trips all require finance approval
- **No distance exemptions**: Both short and long-distance trips require finance approval
- **Sequential enforcement**: Finance approval can only occur after all preceding approvals are completed

### 1.3 Trip Types and Approval Paths

#### 1.3.1 Ticket Trip Approval Flow
Ticket trips follow a department-focused approval workflow:

1. Employee submits ticket trip request
2. Initial status: **Pending Department Approval**
3. Department approval process:
   - **Primary department manager** approval is mandatory
   - **Secondary department manager** approval is conditional (only if defined in department configuration)
   - **Tertiary department manager** approval is conditional and **specific to ticket trips only** (only required if department has tertiary manager configured AND trip distance exceeds the administrator-configurable maximum kilometer threshold)
4. After all required department approvals, status changes to **Pending Finance Approval**
5. Finance approves → status changes to **Approved**
6. Finance marks as paid → status changes to **Paid**

```
Employee Submission → Department Approval (Primary → Secondary → Tertiary) → Finance Approval → Payment
```

**Note**: The tertiary department manager approval is conditional based on two requirements: (1) the department must have a tertiary manager configured, and (2) the trip distance must exceed the administrator-configurable maximum kilometer threshold. This additional approval layer only applies to ticket trips, not to planned or urgent trips.

#### 1.3.2 Planned Trip Approval Flow
Planned trips follow a project-focused approval workflow:

1. Employee submits planned trip request (must be associated with an active project)
2. Initial status: **Pending Project Approval** (bypasses department approval)
3. Project approval process (the system shows all active projects, not restricted to user assignment):
   - **Primary project manager** approval is mandatory (**budget deducted immediately**)
   - **Secondary project manager** approval is conditional (only if defined in project configuration)
4. After all required project approvals, status changes to **Pending Finance Approval**
5. Finance approves → status changes to **Approved**
6. Finance marks as paid → status changes to **Paid**

```
Employee Submission → Project Approval (Primary [Budget Deducted] → Secondary) → Finance Approval → Payment
```

**Important**: 
- Project managers cannot approve requests if the project has exceeded its budget
- Budget is deducted when the first project manager approves
- Budget is restored if any subsequent manager (second project manager or Finance) rejects the request

#### 1.3.3 Urgent Trip Approval Flow
Urgent trips follow an expedited approval workflow that varies based on project assignment:

##### 1.3.3.1 Urgent Trip WITHOUT Project Selected
1. Employee submits urgent trip request (**with mandatory attachment** of pre-approved paper documentation)
2. Initial status: **Pending Finance Approval** (bypasses both department and project approval)
3. Finance approves → status changes to **Approved**
4. Finance marks as paid → status changes to **Paid**

```
Employee Submission (with pre-approval documentation) → Finance Approval → Payment
```

##### 1.3.3.2 Urgent Trip WITH Project Selected
1. Employee submits urgent trip request (**with mandatory attachment** of pre-approved paper documentation)
2. Initial status: **Pending Project Approval** (bypasses department approval only)
3. Project approval process:
   - **Primary project manager** approval is mandatory (**budget deducted immediately**)
   - **Secondary project manager** approval is conditional (only if defined in project configuration)
4. After all required project approvals, status changes to **Pending Finance Approval**
5. Finance approves → status changes to **Approved**
6. Finance marks as paid → status changes to **Paid**

```
Employee Submission (with pre-approval documentation) → Project Approval (Primary [Budget Deducted] → Secondary) → Finance Approval → Payment
```

**Note**: Urgent trips require manual, offline approval before submission. The paper approval document must be scanned and attached to the request. The system enforces this requirement by making the attachment mandatory for urgent trips.

#### 1.3.4 Rejection Flow
- Any approver can reject a request at their approval stage
- Rejection requires providing a reason
- Status changes to **Rejected**
- Rejected trips remain in the system for audit purposes

#### 1.3.5 Cancellation Flow
- Employee can cancel a request if it hasn't been approved yet
- Admin can cancel any request
- Status changes to **Cancelled**
- Cancelled trips remain in the system for audit purposes

### 1.4 Role-Based Approval Permissions

| Role | Can Approve | Notes |
|------|-------------|-------|
| Employee | No | Can only submit and view their own requests |
| Primary Department Manager | Yes | Can approve ticket trips from their department |
| Secondary Department Manager | Yes | Can approve ticket trips after primary manager approval (if configured) |
| Tertiary Department Manager | Yes | Can approve high-distance ticket trips only (not applicable to planned or urgent trips) |
| Primary Project Manager | Yes | Can approve planned trips for their project (if within budget) |
| Secondary Project Manager | Yes | Can approve planned trips after primary project manager approval (if configured) |
| Finance | Yes | Can approve all trips in final stage |
| Admin | Yes | Has full system access, can override any approval |

### 1.5 Special Cases

#### Role Switching and Permissions
- Regular employees have only one role (Employee)
- Users with management, finance, or administrative roles can switch between their assigned role and the Employee role
- **Only users with the Employee role active can submit trip requests**
- When managers or finance staff switch to the Employee role, they can only view and access content related to Employee permissions
- When in their management role, managers can only view and approve trips related to their specific departments or projects
- The system enforces permissions based on the user's active role

#### Manager Trip Submission Restrictions
- Managers (when in Employee role) can only submit **urgent trip requests**
- These urgent trips require the mandatory attachment of manual pre-approval documentation
- Manager-submitted trip requests go directly to Finance, bypassing all department/project approval steps
- This prevents any conflict of interest where a manager might need to approve their own requests

#### Budget Considerations
- For ticket trips, those that exceed department budget receive a warning flag
- For planned trips, approval is blocked if the project is over budget
- Urgent trips are processed regardless of budget considerations due to their pre-approved nature
- Finance department makes the final determination on over-budget requests

## 2. Administrative Request Approval Workflow

### 2.1 Overview

Administrative requests follow a simplified workflow, going directly to Finance:

```
Employee Submission → Finance Approval
```

### 2.2 Request Types

Common administrative requests include:
- Budget increase requests (for departments or projects)
- Department/project configuration changes
- Special authorization requests

### 2.3 Approval Path

1. Employee submits administrative request
2. Initial status: **Pending Finance Approval**
3. Finance approves → status changes to **Approved**
4. Finance rejects → status changes to **Rejected**

## 3. Audit and Compliance

All approval actions are tracked in the audit log, including:
- Who approved/rejected/paid the request
- When the action was taken
- The status change that occurred
- Reasons provided for rejections

These logs provide a complete history of all request processing for compliance and accountability purposes.

## 4. Bulk Approval/Rejection Operations

### 4.1 Overview

The system supports bulk approval and rejection operations for both trip requests and administrative requests. The bulk processing system uses atomic database transactions that ensure complete data integrity while providing detailed error reporting and partial success handling.

### 4.2 User Interface Features

**Request Selection:**
- Individual checkbox selection for each request
- "Select All" toggle functionality for batch selection
- Dynamic selection counter showing "Selected X of Y requests"
- Separate tabs for Trip Requests and Administrative Requests

**Action Confirmation:**
- Bulk approval requires simple confirmation dialog
- Bulk rejection requires mandatory rejection reason in textarea
- Input validation ensures rejection reason is provided

### 4.3 Processing Architecture

**Atomic Processing Model:**
- Each selected request is processed individually within atomic database transactions
- Failed requests automatically rollback without affecting successful operations
- Complete ACID compliance ensures data consistency for all operations
- Results and errors are collected in separate arrays for detailed reporting

**Permission Validation:**
- Individual permission checking for each request using PermissionService
- Users can only approve requests where they are designated approvers
- Permission failures are recorded but don't block processing of other requests

**Budget Protection:**
- Real-time budget validation occurs for each approval request
- Calls storage.checkProjectBudgetForTrip() for current project state
- Budget failures generate specific error messages with available vs required amounts
- Budget tracking uses atomic database transactions with automatic rollback protection

### 4.4 Workflow Integration

**Status Determination:**
- Each approval updates the workflow_steps table for that specific request
- System finds pending workflow step assigned to current user
- Updates step status to "Approved" with timestamp
- Calculates remaining pending workflow steps to determine next status

**Budget Allocation Timing:**
- Budget deduction occurs only when trip reaches final "Approved" status
- No budget allocation during intermediate approval steps
- Prevents premature budget allocation during workflow progression

### 4.5 Error Handling

**Partial Success Design:**
- Some requests can succeed while others fail in the same batch
- Processing continues regardless of individual failures
- Final response includes both successful and failed requests

**Error Categories:**
- Budget Exceeded: Shows available vs required amounts in Jordanian Dinars
- Permission Denied: Indicates insufficient approval rights for specific request
- Request Not Found: Handles deleted or missing requests gracefully
- Status Update Failed: Captures database update errors

### 4.6 Audit Trail

**Individual Request Logging:**
- Each processed request generates individual audit log entry
- Records user ID, action type, request ID, and timestamp
- Includes approval/rejection reason if provided

**Bulk Action Summary:**
- Comprehensive summary audit log for the entire bulk operation
- Total requests processed vs successful actions
- Error count and budget impact totals
- Request type identification (Trip vs Administrative)

### 4.7 Response Format

The bulk operation returns detailed results including:
- Success count and processed request details
- Error array with specific failure reasons for each failed request
- Budget impact summary showing total allocations and deallocations
- Complete processing status for frontend integration

## 5. Future Enhancements

Planned enhancements to the approval workflow include:
- Email notifications at each approval stage
- Mobile approval capabilities
- Delegation of approval authority during manager absence
- Enhanced reporting on approval timelines and bottlenecks
- Atomic transaction support for bulk operations
- Parallel processing capabilities for larger batch sizes