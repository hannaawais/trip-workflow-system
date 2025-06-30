# Error Recovery Procedures

## CRITICAL DATABASE INITIALIZATION ERRORS

### Department Creation Bug
**Symptom**: Server startup fails with department-related errors
**Root Cause**: Missing `monthlyBudgetBonus` field in department creation

#### Recovery Steps:
```sql
-- 1. Check if field exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'departments' AND column_name = 'monthlyBudgetBonus';

-- 2. Add missing field if needed
ALTER TABLE departments ADD COLUMN monthlyBudgetBonus DECIMAL DEFAULT 0;

-- 3. Update existing records
UPDATE departments SET monthlyBudgetBonus = 0 WHERE monthlyBudgetBonus IS NULL;

-- 4. Restart application server
```

### Form Data Loading Failures
**Symptom**: Forms show empty dropdowns or "No data available"
**Root Cause**: Frontend using hardcoded data instead of database endpoints

#### Recovery Steps:
```bash
# 1. Verify useQuery imports
grep -r "useQuery" client/src/pages/ | grep -v "from"

# 2. Check for hardcoded data patterns
grep -rn "data: \[\]" client/src/pages/
grep -rn "const.*= \[" client/src/pages/

# 3. Verify API endpoint calls
grep -rn "queryKey.*api" client/src/pages/
```

#### Required Form Patterns:
```typescript
// CORRECT: Database integration
const { data: departments = [] } = useQuery<Department[]>({
  queryKey: ["/api/departments"],
});

// INCORRECT: Hardcoded data (causes failures)
const departments = [{ id: 1, name: "Marketing" }];
```

## APPROVAL WORKFLOW CORRUPTION

### Status Validation Errors
**Symptom**: Requests stuck in invalid status states
**Root Cause**: Direct status changes without workflow validation

#### Recovery Steps:
```sql
-- 1. Identify corrupted requests
SELECT id, status, createdAt FROM trip_requests 
WHERE status NOT IN ('Pending Department Approval', 'Pending Project Approval', 
                     'Pending Finance Approval', 'Approved', 'Rejected', 'Paid', 'Cancelled');

-- 2. Reset to valid initial status
UPDATE trip_requests SET status = 'Pending Department Approval' 
WHERE status NOT IN (valid_statuses) AND rejectionReason IS NULL;
```

#### Required Validation Pattern:
```typescript
// CORRECT: Status validation before approval
if (currentStatus !== expectedPreviousStatus) {
  throw new Error("Invalid approval sequence");
}

// INCORRECT: Direct status change (causes corruption)
request.status = "Approved"; // FORBIDDEN
```

### Department ID Resolution Failures
**Symptom**: Requests fail with "department not found" errors
**Root Cause**: Undefined departmentId in request processing

#### Recovery Steps:
```typescript
// REQUIRED: Proper department resolution
const departments = await storage.getDepartments();
const department = departments.find(d => d.name === user.department);
if (!department) {
  throw new Error("Department not found - cannot process request");
}
const departmentId = department.id;
```

## TYPE SAFETY FAILURES

### Array Operation Crashes
**Symptom**: "Cannot read property 'filter' of undefined" errors
**Root Cause**: Missing array validation

#### Recovery Pattern:
```typescript
// CORRECT: Safe array operations
const trips = (data as { trips: any[] })?.trips || [];
const filtered = Array.isArray(trips) ? trips.filter(condition) : [];

// INCORRECT: Unsafe operations (causes crashes)
const filtered = trips.filter(condition); // trips could be undefined
```

## SYSTEM RECOVERY COMMANDS

### Complete System Reset
```bash
# 1. Database schema verification
npm run db:push

# 2. Clear application cache
rm -rf node_modules/.cache

# 3. Restart development server
npm run dev

# 4. Verify all endpoints
curl -X GET http://localhost:5000/api/departments
curl -X GET http://localhost:5000/api/users
curl -X GET http://localhost:5000/api/trip-requests
```

### Database Backup Before Recovery
```sql
-- Create backup tables
CREATE TABLE departments_backup AS SELECT * FROM departments;
CREATE TABLE trip_requests_backup AS SELECT * FROM trip_requests;
CREATE TABLE admin_requests_backup AS SELECT * FROM admin_requests;
```

## DEBUGGING CHECKLIST

### For Frontend Issues:
- [ ] Check browser network tab for API call failures
- [ ] Verify useQuery hooks are properly imported
- [ ] Confirm queryKey matches backend routes
- [ ] Test with array safety validation
- [ ] Check TypeScript errors in console

### For Backend Issues:
- [ ] Verify database connection status
- [ ] Check server logs for initialization errors
- [ ] Confirm all required fields in database schema
- [ ] Test API endpoints with curl commands
- [ ] Validate user authentication and permissions

### For Workflow Issues:
- [ ] Verify sequential approval validation is active
- [ ] Check department ID resolution logic
- [ ] Confirm status transitions follow defined workflow
- [ ] Test with different user roles and permissions
- [ ] Validate audit log creation for all actions