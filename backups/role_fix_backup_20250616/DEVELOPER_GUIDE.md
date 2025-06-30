# Developer Guide - Trip Transportation Workflow System

## Architecture Overview

This system is built using a full-stack TypeScript architecture with a database-first approach to ensure consistency and maintainability.

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Passport.js with session management
- **External APIs**: OpenRouteService for route calculation

## Project Structure

```
├── client/src/
│   ├── components/ui/     # shadcn/ui components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and configs
│   ├── pages/            # Page components
│   └── App.tsx           # Main app component
├── server/
│   ├── auth.ts           # Authentication setup
│   ├── db.ts             # Database connection
│   ├── routes.ts         # API endpoints
│   ├── storage.ts        # Database operations
│   └── permissions.ts    # Authorization logic
├── shared/
│   └── schema.ts         # Database schema and types
└── uploads/              # File upload storage
```

## Database Schema

### Core Tables
- **users**: User accounts with role assignments
- **departments**: Organizational structure with budget tracking
- **projects**: Project definitions with budget and expiry management
- **sites**: Location definitions for distance calculation
- **trip_requests**: Main trip request entities
- **admin_requests**: Administrative requests for system changes
- **workflow_steps**: Dynamic approval workflow management
- **audit_logs**: Complete action tracking for compliance

### Key Relationships
```sql
users -> departments (many-to-one)
trip_requests -> users (many-to-one)
trip_requests -> projects (many-to-one, optional)
workflow_steps -> trip_requests (many-to-one)
workflow_steps -> users (many-to-one)
```

## Database-First Architecture

### Workflow Management
All approval logic is driven by the `workflow_steps` table:
- Dynamic workflow generation based on trip type and organizational structure
- No hardcoded approval logic in application code
- Real-time permission validation through database queries

### Budget Protection
Budget validation uses real-time database queries:
```typescript
// Real-time budget checking
const budgetInfo = await storage.checkProjectBudgetForTrip(projectId, tripCost);
if (!budgetInfo.canApprove) {
  throw new Error(`Budget exceeded. Available: ${budgetInfo.availableBudget} JD`);
}
```

### Permission System
Permissions are determined by database state:
```typescript
// Permission validation
const canApprove = await PermissionService.canApproveTripRequest(
  userId, 
  tripRequestId, 
  userRole
);
```

## Development Setup

### Prerequisites
```bash
# Required versions
Node.js >= 20
PostgreSQL >= 14
```

### Environment Configuration
```bash
# Required environment variables
DATABASE_URL=postgresql://user:password@localhost:5432/transport_db
OPENROUTESERVICE_API_KEY=your_api_key_here
SESSION_SECRET=your_secure_session_secret
```

### Database Setup
```bash
# Initialize database schema
npm run db:push

# Generate migrations (when schema changes)
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit push
```

### Development Commands
```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Database operations
npm run db:studio    # Database GUI
npm run db:push      # Apply schema changes
```

## Frontend Development

### Component Structure
```typescript
// Example page component structure
export default function TripRequestPage() {
  const { user } = useAuth();
  const { data: sites, isLoading } = useQuery({ queryKey: ['/api/sites'] });
  
  if (isLoading) return <LoadingSpinner />;
  
  return <TripRequestForm sites={sites} user={user} />;
}
```

### State Management
Uses TanStack Query for server state:
```typescript
// Query configuration
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/trip-requests', userId],
  queryFn: getQueryFn(),
});

// Mutation with cache invalidation
const mutation = useMutation({
  mutationFn: async (data) => apiRequest('POST', '/api/trip-requests', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/trip-requests'] });
  },
});
```

### Form Handling
Uses react-hook-form with Zod validation:
```typescript
const form = useForm<InsertTripRequest>({
  resolver: zodResolver(tripRequestSchema),
  defaultValues: {
    purpose: '',
    fromSiteId: 0,
    toSiteId: 0,
  },
});
```

## Backend Development

### API Endpoint Structure
```typescript
// Example endpoint implementation
app.post('/api/trip-requests', async (req, res, next) => {
  try {
    // Validate request body
    const validatedData = tripRequestSchema.parse(req.body);
    
    // Check permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Business logic
    const tripRequest = await storage.createTripRequest({
      ...validatedData,
      userId: req.user.id,
    });
    
    res.status(201).json(tripRequest);
  } catch (error) {
    next(error);
  }
});
```

### Database Operations
```typescript
// Storage interface implementation
async createTripRequest(tripRequest: InsertTripRequest): Promise<TripRequest> {
  const [created] = await db
    .insert(tripRequests)
    .values(tripRequest)
    .returning();
  
  // Generate workflow steps
  await this.generateWorkflowForTrip(created);
  
  return created;
}
```

### Error Handling
Centralized error handling with specific error types:
```typescript
// Custom error classes
export class AppError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

// Usage
throw new AppError('Budget exceeded', 400);
```

## Authentication & Authorization

### Session Management
```typescript
// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new PostgreSQLStore({ pool }),
}));
```

### Role-Based Access
```typescript
// Permission checking
const hasPermission = await PermissionService.canPerformAction(
  userId,
  action,
  resourceId
);
```

## Testing Strategy

### Unit Tests
Focus on business logic and utility functions:
```typescript
describe('Cost Calculator', () => {
  it('should calculate trip cost correctly', () => {
    const cost = calculateTripCost(distance, kmRate);
    expect(cost).toBe(expectedCost);
  });
});
```

### Integration Tests
Test API endpoints with database:
```typescript
describe('Trip Request API', () => {
  it('should create trip request with workflow', async () => {
    const response = await request(app)
      .post('/api/trip-requests')
      .send(validTripData)
      .expect(201);
    
    expect(response.body).toHaveProperty('id');
  });
});
```

## Performance Considerations

### Database Optimization
- Indexed foreign keys for join performance
- Efficient query patterns in storage layer
- Connection pooling for concurrent requests

### Frontend Optimization
- Query result caching with TanStack Query
- Component lazy loading for large pages
- Optimistic updates for better UX

### Bulk Operations
Atomic sequential processing design for bulk approvals:
```typescript
// Bulk approval implementation with atomic operations
const results = [];
const errors = [];
let budgetAllocations = 0;

for (const requestId of selectedRequests) {
  try {
    // Real-time budget validation
    const budgetCheck = await storage.checkProjectBudgetForTrip(projectId, cost);
    if (!budgetCheck.canApprove) {
      errors.push({ requestId, error: "Budget exceeded" });
      continue;
    }
    
    // Atomic status update with database transaction
    const result = await storage.updateTripRequestStatus(requestId, approve, userId);
    results.push(result);
    budgetAllocations += cost;
  } catch (error) {
    errors.push({ requestId, error: error.message });
    // Automatic compensation for failed operations
    budgetAllocations -= cost;
  }
}
```

## Security Guidelines

### Input Validation
All inputs validated with Zod schemas:
```typescript
const tripRequestSchema = z.object({
  purpose: z.string().min(1).max(500),
  fromSiteId: z.number().positive(),
  toSiteId: z.number().positive(),
});
```

### SQL Injection Prevention
Using Drizzle ORM with parameterized queries:
```typescript
// Safe query construction
const trips = await db
  .select()
  .from(tripRequests)
  .where(eq(tripRequests.userId, userId));
```

### Session Security
- Secure session configuration
- CSRF protection enabled
- Role-based route protection

## Deployment

### Production Build
```bash
# Build frontend
npm run build

# Start production server
npm start
```

### Environment Configuration
Production environment requires:
- PostgreSQL connection string
- OpenRouteService API key
- Secure session secret
- File upload directory permissions

### Health Checks
System includes automated health monitoring:
- Database connection validation
- External API availability checks
- Performance metrics collection

## API Reference

### Authentication Endpoints
```
POST /api/register     # User registration
POST /api/login        # User authentication
POST /api/logout       # Session termination
GET  /api/user         # Current user info
```

### Trip Management
```
GET    /api/trip-requests              # List user's requests
POST   /api/trip-requests              # Create new request
GET    /api/trip-requests/:id          # Get specific request
PATCH  /api/trip-requests/:id/status   # Update request status
```

### Approval Operations
```
GET    /api/trip-requests/pending      # Get pending approvals
POST   /api/trip-requests/bulk-approve # Bulk approval
POST   /api/trip-requests/bulk-reject  # Bulk rejection
```

### Administrative
```
GET    /api/departments    # List departments
GET    /api/projects       # List projects
GET    /api/sites          # List sites
GET    /api/users          # List users (admin only)
```

## Troubleshooting

### Common Development Issues

**Database Connection Errors:**
- Verify DATABASE_URL environment variable
- Check PostgreSQL service status
- Validate connection string format

**TypeScript Errors:**
- Run `npm run type-check` for detailed error info
- Ensure shared schema types are properly exported
- Check import paths for typos

**Query Failures:**
- Use Drizzle Studio to inspect database state
- Check query syntax in storage functions
- Verify foreign key relationships

### Performance Issues
- Monitor query execution time in development
- Use database query logging for optimization
- Profile React components with browser dev tools

This guide provides the foundation for developing and maintaining the Trip Transportation Workflow System. Follow these patterns and principles to ensure consistent, maintainable code.