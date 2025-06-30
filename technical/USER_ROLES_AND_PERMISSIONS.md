# Trip Transportation Management System: User Roles and Permissions

> **IMPORTANT NOTICE**: This is a controlled document. No changes may be made to this document without explicit approval from the system owner. Any proposed changes must be reviewed and authorized before implementation.

This document defines all user roles within the Trip Transportation Management System, their associated permissions, and access controls. It serves as the authoritative reference for role-based access control implementation.

## 1. System Roles Overview

The system supports the following primary roles, each with distinct permissions and access levels:

| Role | Description | Can Switch To |
|------|-------------|--------------|
| Employee | Basic user role for all staff members | N/A |
| Manager | Manages department/project approvals and budgets | Employee |
| Finance | Handles financial approvals and payment processing | Employee |
| Administrator | System administration with full access | Employee |

## 2. Core Role Definitions

### 2.1 Employee
The base role assigned to all users in the system.

**Permissions:**
- Submit trip requests (ticket, planned, and urgent types)
  * All employees can enter distance (kilometers) for trip requests
  * Only employees with special permission can enter direct cost (permission managed by administrators)
  * Can select any active project for planned trips (not restricted to user assignment)
- Submit administrative requests
- View own trip and administrative requests
- Cancel own pending requests
- View personal profile information
- Department information is automatically included from user profile
- Update personal profile information (if enabled by system administrators)
- Change own password
- Access reports related to own activities

**Restrictions:**
- Cannot approve any requests
- Cannot view other users' requests
- Cannot modify department or project settings
- Cannot access system administration features

### 2.2 Manager
Responsible for approving trip requests based on assignment to departments or projects.

**Permissions:**
- All Employee permissions when switched to Employee role
- Approve ticket trip requests for their assigned department(s)
- Approve planned trip requests for their assigned project(s)
- View all trip requests related to their department(s) or project(s)
- View budget information for their department(s) or project(s)
- Access reporting related to their areas of responsibility
- View staff lists for their department(s) or project(s)
- Create new projects with full access to all project fields
- Edit existing projects with limited access:
  * Update project expiry date
  * Activate or deactivate projects
  * Add project documents (cannot delete existing documents)
  * Change secondary approval manager assignment

**Manager Hierarchy and Assignments:**
- Managers can be assigned to departments, projects, or both
- Managers can have different positions in the approval hierarchy:
  * Primary Manager: First-level approval for all trips
  * Secondary Manager: Second-level approval (if configured)
  * Tertiary Manager: For department managers only, approves high-distance ticket trips (no additional documentation required)

**Approval Scope:**
- Department-assigned managers approve ticket trips for their department
- Project-assigned managers approve planned trips for their projects
- Managers may have both department and project responsibilities

**Restrictions:**
- Cannot approve their own requests (must submit urgent trips only)
- Cannot modify system settings
- Cannot approve project-related trips if the project is over budget
- Cannot change budgets (must request via administrative request)
- Cannot delete project documents once uploaded
- Cannot modify certain project fields after creation:
  * Project name
  * Project budget
  * Department assignment
  * Primary manager assignment
- Cannot create or modify departments

### 2.3 Finance
Responsible for final approval of all trip requests, payment processing, and budget oversight.

**Permissions:**
- All Employee permissions when switched to Employee role
- Final approval of all trip types (ticket, planned, urgent)
- Edit trip distance (kilometers) before approval
  * Any distance edits by Finance are automatically recorded in the audit log
  * Original and modified values are both preserved for accountability
- Mark trip requests as paid
- View all trip and administrative requests in the system
- Access all financial reports and budget information
- Approve administrative requests
- Adjust department and project budgets
- Configure system settings related to finance
- Manage kilometer rates

**Restrictions:**
- Cannot modify user roles and permissions
- Cannot delete system records
- Cannot modify core system configurations

### 2.4 Administrator
System administrators with comprehensive access and control.

**Permissions:**
- All Employee permissions when switched to Employee role
- Full system access and configuration
- User account management (create, update, deactivate)
- Role assignment and modification
- User profile management controls:
  * Enable/disable user self-service profile editing
  * Configure which profile fields users can edit
  * Override profile edit restrictions for individual users
  * Grant direct cost entry permission to specific users (default is disabled)
- Department and project management:
  * Create new departments
  * Edit existing departments (including budgets)
  * Create new projects
  * Edit all project fields (including after creation)
- Edit trip distance (kilometers) for any trip request
  * All edits are logged with original and new values
- Override approval workflows when necessary
- System settings management
- Access all system reports and logs
- Override any approval or restriction if necessary
- System backup and maintenance functions

**Restrictions:**
- Should follow organization policies for system changes
- Audit logs track all administrative actions for accountability

## 3. Role Assignment and Management

### 3.1 User Account Setup and Management
- Each user must have exactly one account in the system
- Users can self-register in the system:
  * Self-registration requires email verification
  * Self-registered accounts are initially assigned the Employee role
  * Administrators can later modify role assignments as needed
- Users can reset their own passwords through a secure password recovery process
- Users can update their personal profile information
- All users are assigned the Employee role by default
- Additional roles can be assigned by Administrators
- User accounts require the following minimum information:
  * Full Name
  * Username
  * Password (securely stored)
  * Company ID Number
  * Department assignment
  * Contact information
  * Role assignment

### 3.2 Role Management
- Each user is assigned exactly one system role (Employee, Manager, Finance, or Administrator)
- The system enforces permissions based on the user's assigned role
- Role assignment changes are logged for audit purposes

### 3.3 Role Switching Behavior
- Users with management, finance, or administrative roles can switch to Employee role
- When in Employee role, users only have Employee permissions regardless of their other roles
- After role switching, the user's interface and available actions update to reflect their active role
- Users are limited to creating urgent trip requests when they have management roles

## 4. Access Control Enforcement

### 4.1 Trip Request Access Controls
- Users can only view trip requests they submitted
- Managers see only requests they are required to approve based on their department/project assignments
- Finance and Administrators can see all requests

### 4.2 Report Access Controls
- Reports are filtered based on user role and permissions
- Department-specific reports are only accessible to managers assigned to those departments
- Project-specific reports are only accessible to managers assigned to those projects
- Finance has access to consolidated financial reports
- Administrators have access to all reports

### 4.3 System Configuration Access
- System configuration is restricted to Admin and Finance roles
- Finance can only modify financial configuration parameters
- Administrators can modify all system parameters

## 5. Special Access Scenarios

### 5.1 Manager Assignments
- Managers are assigned to specific departments or projects 
- A manager can be assigned as primary, secondary, or tertiary for a department
- A manager can be assigned as primary or secondary for a project
- These assignments determine which requests the manager can approve

### 5.2 Request Override Procedures
- Administrators can override standard approval workflows when necessary
- Override actions require documented justification
- All overrides are prominently logged in the audit system

### 5.3 Emergency Access Protocol
- In emergency situations, Administrators can grant temporary elevated access
- Emergency access expires automatically after a short period
- All emergency access grants and subsequent actions are flagged in audit logs

## 6. Audit and Compliance

### 6.1 Role and Permission Auditing
- All permission changes are recorded in the system audit log
- Regular audits of role assignments should be conducted
- Role assignment reports are available to Administrators

### 6.2 Access Monitoring
- Failed access attempts are logged and monitored
- Unusual access patterns trigger alerts for Administrators
- Regular access reports are generated for security review

### 6.3 Compliance Requirements
- Role assignments must comply with segregation of duties principles
- Critical functions require multiple roles for proper checks and balances
- System enforces compliance rules for role assignment