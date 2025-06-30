# Frontend Database Integration Guidelines

## CRITICAL REQUIREMENTS

### Database Integration Mandate
**ALL forms must use live database connections via useQuery hooks**

### Required Patterns

#### 1. Data Fetching
```typescript
// CORRECT: Use database endpoints
const { data: departments = [] } = useQuery<Department[]>({
  queryKey: ["/api/departments"],
});

// INCORRECT: Never use hardcoded data
const departments = [
  { id: 1, name: "Marketing" }, // FORBIDDEN
];
```

#### 2. Array Safety Requirements
```typescript
// CORRECT: Always validate arrays
const tripRequests = (tripRequestData as { trips: any[] })?.trips || [];
const filteredRequests = Array.isArray(tripRequests) ? 
  tripRequests.filter(req => condition) : [];

// INCORRECT: Unsafe array operations
const filteredRequests = tripRequests.filter(req => condition); // Can crash
```

#### 3. Type Safety Enforcement
```typescript
// CORRECT: Explicit typing with defaults
const { data: users = [], isLoading } = useQuery<User[]>({
  queryKey: ["/api/users"],
});

// INCORRECT: Missing type safety
const { data: users } = useQuery({
  queryKey: ["/api/users"],
}); // users could be undefined
```

### Form Integration Checklist

#### Trip Request Forms
- ✅ Sites loaded from /api/sites
- ✅ Projects loaded from /api/projects  
- ✅ KM rates loaded from /api/km-rates/current
- ✅ Departments loaded from /api/departments

#### Admin Forms
- ✅ Users loaded from /api/users
- ✅ Departments loaded from /api/departments
- ✅ System settings loaded from /api/system-settings
- ✅ Audit logs loaded from /api/audit-logs

#### Budget Forms
- ✅ Departments loaded from /api/departments
- ✅ Projects loaded from /api/projects
- ✅ Trip data loaded from /api/trip-requests

### Error Recovery Procedures

#### Database Connection Failures
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ["/api/endpoint"],
  retry: 3,
  retryDelay: 1000,
});

if (error) {
  return <ErrorBoundary message="Failed to load data" />;
}
```

#### Null Data Handling
```typescript
// Always provide fallbacks
const departments = data?.departments || [];
const projects = Array.isArray(projectData) ? projectData : [];
```

### Debugging Steps

1. **Check Network Tab**: Verify API calls are made to correct endpoints
2. **Verify Query Keys**: Ensure queryKey matches backend route
3. **Check Array Types**: Confirm data is properly typed as arrays
4. **Test Error States**: Verify graceful handling of failed requests

### Forbidden Patterns

❌ **Never use hardcoded data arrays**
❌ **Never skip array validation**  
❌ **Never ignore TypeScript errors**
❌ **Never use cached data without refresh capability**

### Recovery Commands

If forms are not loading data:
```bash
# 1. Check if useQuery is properly imported
grep -r "useQuery" client/src/pages/

# 2. Verify API endpoints are called
grep -r "queryKey.*api" client/src/pages/

# 3. Ensure no hardcoded data exists
grep -r "data: \[\]" client/src/pages/
```