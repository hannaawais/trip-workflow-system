# Permission Management System Architecture

## Overview
The system uses a **database-first permission model** where all access control is determined by querying the actual database relationships rather than hardcoded rules. This ensures permissions always reflect the current organizational structure.

## Core Permission Structure

### 1. Role-Based Access Control (RBAC)

```typescript
// Primary User Roles
- Admin: Full system access
- Finance: Financial operations and approvals
- Manager: Department/project management
- Employee: Basic trip creation and viewing
```

### 2. Permission Service Architecture

```typescript
export class PermissionService {
  // Core visibility methods
  static async getVisibleTripRequestIds(userId, userRole, activeRole?)
  static async getVisibleAdminRequestIds(userId, userRole, activeRole?)
  
  // Capability checks
  static async canManageUsers(userId, userRole, activeRole?)
  static async canManageFinance(userId, userRole, activeRole?)
  static async canApproveTripRequest(userId, userRole, tripRequest, activeRole?)
  
  // Workflow management
  static async generateWorkflowSteps(tripRequest)
  static async canUserApproveRequest(userId, role, requestId, requestType)
}
```

## Permission Matrix by Role

### Admin Role
- **Trip Requests**: View all, workflow-based approval (current: only sees pending steps assigned to them)
- **Admin Requests**: View all, approve all
- **User Management**: Full access
- **System Settings**: Full access
- **Financial Operations**: Full access
- **Audit Logs**: Full access

**⚠️ Known Limitation**: Admin approval permissions are currently limited to workflow-assigned steps only. Future enhancement needed to allow Admin role to approve any pending trip regardless of workflow assignment.

### Finance Role
- **Trip Requests**: View all, approve for payment
- **Admin Requests**: View all, approve all
- **Budget Operations**: Bulk payments, financial approvals
- **Reports**: Financial reporting access
- **Workflow**: Final approval step for most requests

### Manager Role
- **Trip Requests**: View own + managed departments/projects
- **Admin Requests**: View own + managed scope
- **Department Management**: Based on database relationships
- **Project Management**: Based on assigned projects
- **Budget Allocation**: Project-specific budget management

### Employee Role
- **Trip Requests**: View own, create new
- **Admin Requests**: View own, create new
- **Limited Access**: No management capabilities
- **Role Switching**: Managers can switch to Employee for trip creation

## Database-First Permission Logic

### Trip Request Visibility
```sql
-- Admin/Finance: See all trips
SELECT id FROM trip_requests;

-- Manager: See managed trips via relationships
SELECT DISTINCT tr.id FROM trip_requests tr
LEFT JOIN departments d ON tr.department_id = d.id
LEFT JOIN projects p ON tr.project_id = p.id
WHERE tr.user_id = ? OR
      d.manager_id = ? OR d.second_manager_id = ? OR d.third_manager_id = ? OR
      p.manager_id = ? OR p.second_manager_id = ?;

-- Employee: See only own trips
SELECT id FROM trip_requests WHERE user_id = ?;
```

### Admin Request Visibility
```sql
-- Admin/Finance: See all admin requests
SELECT id FROM admin_requests;

-- Manager: See managed scope
SELECT DISTINCT ar.id FROM admin_requests ar
LEFT JOIN users u ON ar.user_id = u.id
LEFT JOIN departments d ON u.department = d.name
LEFT JOIN projects p ON ar.target_type = 'project' AND ar.target_id = p.id
WHERE ar.user_id = ? OR
      d.manager_id = ? OR d.second_manager_id = ? OR d.third_manager_id = ? OR
      p.manager_id = ? OR p.second_manager_id = ?;
```

## Workflow Permission System

### Dynamic Workflow Generation
1. **Trip Creation**: System generates workflow steps based on:
   - Trip type (Planned, Urgent, Ticket)
   - Project assignment
   - Department relationships
   - Budget requirements

2. **Approval Chain**:
   ```
   Employee → Department Manager → Project Manager → Finance → Approved
   ```

3. **Special Cases**:
   - **Urgent trips**: Skip department approval
   - **No-project trips**: Skip project manager approval
   - **Ticket trips**: Different validation rules

### Approval Permission Logic
```typescript
// Database-first approval validation
static async canUserApproveRequest(userId, role, requestId, requestType) {
  // Query workflow_steps table for pending approvals
  const pendingSteps = await db
    .select()
    .from(workflowSteps)
    .where(and(
      eq(workflowSteps.tripRequestId, requestId),
      eq(workflowSteps.status, 'Pending'),
      or(
        eq(workflowSteps.approverId, userId),
        and(
          eq(workflowSteps.stepType, 'Finance Approval'),
          eq(role, 'Finance')
        )
      )
    ));
    
  return pendingSteps.length > 0;
}
```

## Role Switching Mechanism

### Manager → Employee Role Switch
```typescript
// Session-based role switching
req.session.activeRole = 'Employee';

// Permission checks consider active role
const effectiveRole = activeRole || user.role;
const canCreateTrip = effectiveRole === 'Employee';
```

## Security Features

### 1. Database Relationship Validation
- All permissions verified against actual database relationships
- No hardcoded user lists or department assignments
- Real-time validation of management hierarchies

### 2. Atomic Transaction Protection
- Bulk operations maintain permission consistency
- Transaction rollback on permission failures
- Audit logging for all permission-sensitive operations

### 3. Multi-Level Approval Workflow
- Each step validated independently
- Progressive permission escalation
- Bypass mechanisms for urgent requests

## Integration Points

### API Route Protection
```typescript
// Every protected route uses permission service
app.get("/api/trip-requests", isAuthenticated, async (req, res) => {
  const visibleIds = await PermissionService.getVisibleTripRequestIds(
    user.id, user.role, activeRole
  );
  // Filter results based on visibility
});
```

### Frontend Permission Gates
```typescript
// Component-level permission checks
const { canApprove } = usePermissions(user, tripRequest);
if (canApprove) {
  // Show approval buttons
}
```

## Permission Caching Strategy

### Real-Time Validation
- No permission caching for security
- Each request validates against current database state
- Immediate reflection of organizational changes

### Performance Optimization
- Efficient JOIN queries for bulk permission checks
- Indexed database queries for fast lookups
- Minimal permission validation overhead

## Audit and Compliance

### Permission Logging
- All permission checks logged with context
- Failed permission attempts tracked
- Management hierarchy changes audited

### Compliance Features
- Role separation enforcement
- Approval trail maintenance
- Budget authorization tracking
- Document access logging

This database-first approach ensures permissions always reflect the current organizational structure while maintaining security and performance.

## Known Issues & Future Enhancements

### Current Limitations

#### 1. Admin Approval Queue Limitation
**Issue**: Admin users can only approve trips where they have specific workflow step assignments. They cannot override workflow restrictions to approve any pending trip.

**Current Behavior**: 
- Admin has permission to approve all 110 trips in the system
- Admin sees 0 trips in approval queue because all assigned workflow steps are completed
- 40 trips remain pending approval but Admin cannot access them

**Database Evidence**:
```sql
-- Admin has workflow assignments for all trips
SELECT COUNT(*) FROM workflow_steps WHERE approver_id = 2; -- Returns 110

-- But no pending steps assigned to Admin
SELECT COUNT(*) FROM workflow_steps 
WHERE approver_id = 2 AND status = 'Pending'; -- Returns 0
```

**Future Enhancement**: Implement Admin override capability to approve any pending trip regardless of workflow assignment status.

#### 2. Workflow Step Assignment Dependencies
**Issue**: Current system requires explicit approver_id assignments in workflow_steps table for approval queue visibility.

**Impact**: Role-based permissions alone are insufficient - specific user assignments are mandatory for approval access.

**Future Enhancement**: Consider hybrid approach allowing role-based approvals with workflow step assignments as primary method.

### Enhancement Roadmap

1. **Admin Override System**: Allow Admin role to bypass workflow restrictions for emergency approvals
2. **Flexible Approval Assignments**: Support role-based approvals as fallback when specific user assignments are missing
3. **Approval Delegation**: Enable managers to delegate approval authority to subordinates
4. **Batch Approval Operations**: Allow multiple trip approvals in single transaction for efficiency

### Implementation Notes

- All enhancements must maintain audit trail integrity
- Database-first permission model should remain primary approach
- Backward compatibility with existing workflow assignments required
- Performance impact assessment needed for any permission system changes