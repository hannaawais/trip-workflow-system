# System Configuration Documentation

## CRITICAL SERVER INITIALIZATION REQUIREMENTS

### Database Storage Configuration
**IMPLEMENTED**: System uses DatabaseStorage for all operations:

```typescript
// server/storage.ts - Current configuration
import { storage } from "./db_storage";
export { storage };

// server/db_storage.ts
export const storage = new DatabaseStorage();
```

**Note**: In-memory storage has been completely removed from the system.

### Required Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:port/database
OPENROUTESERVICE_API_KEY=your_api_key_here
SESSION_SECRET=your_session_secret_here
```

### Department Creation Bug Prevention
**CRITICAL**: All department creation must include monthlyBudgetBonus field:

```typescript
// CORRECT: Include all required fields
await storage.createDepartment({
  name: departmentName,
  budget: budgetAmount,
  managerId: managerId,
  monthlyBudgetBonus: 0, // REQUIRED - prevents initialization errors
});

// INCORRECT: Missing monthlyBudgetBonus (causes server startup failure)
await storage.createDepartment({
  name: departmentName,
  budget: budgetAmount,
  managerId: managerId,
  // monthlyBudgetBonus missing - WILL CAUSE ERRORS
});
```

## SERVER ROUTES INITIALIZATION

### Fixed Routes Initialization Pattern
**CRITICAL**: Proper async/await pattern prevents initialization failures:

```typescript
// server/routes.ts - CORRECT pattern
export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Ensure monthly budget reset check
  await checkAndResetMonthlyBudgetBonuses();
  
  // Register all API routes...
  
  const httpServer = createServer(app);
  return httpServer;
}
```

### Required Route Protection
```typescript
// MANDATORY: All routes must verify authentication
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Apply to all protected routes
app.get("/api/protected-endpoint", isAuthenticated, async (req, res) => {
  // Route implementation
});
```

## DATABASE SCHEMA REQUIREMENTS

### Critical Fields Validation
```sql
-- departments table MUST include:
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  budget DECIMAL NOT NULL,
  managerId INTEGER REFERENCES users(id),
  secondManagerId INTEGER REFERENCES users(id),
  monthlyBudgetBonus DECIMAL NOT NULL DEFAULT 0, -- CRITICAL
  monthlyBudgetBonusResetDate DATE,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### User Role Enforcement
```sql
-- users table role validation
CREATE TYPE user_role AS ENUM ('Employee', 'Manager', 'Finance', 'Admin');

ALTER TABLE users ADD CONSTRAINT valid_role 
CHECK (role IN ('Employee', 'Manager', 'Finance', 'Admin'));
```

## ERROR HANDLING CONFIGURATION

### Required Error Boundaries
```typescript
// server/error-handler.ts integration
import { errorHandler } from './error-handler';

// Apply global error handler
app.use(errorHandler);

// Specific error handling for department operations
app.post("/api/departments", async (req, res, next) => {
  try {
    // Validate monthlyBudgetBonus is included
    if (req.body.monthlyBudgetBonus === undefined) {
      req.body.monthlyBudgetBonus = 0;
    }
    
    const department = await storage.createDepartment(req.body);
    res.json(department);
  } catch (error) {
    next(error); // Passes to global error handler
  }
});
```

## AUTHENTICATION SETUP

### Session Configuration
```typescript
// server/auth.ts - Required session setup
const sessionSettings: session.SessionOptions = {
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore, // Uses database session store
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};
```

### Role-Based Access Control
```typescript
// Required role validation middleware
const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

// Usage example
app.post("/api/admin-action", isAuthenticated, requireRole(['Admin']), handler);
```

## OPENROUTESERVICE INTEGRATION

### API Configuration
```typescript
// Required for distance calculations
const OPENROUTESERVICE_CONFIG = {
  baseURL: 'https://api.openrouteservice.org',
  timeout: 30000,
  headers: {
    'Authorization': process.env.OPENROUTESERVICE_API_KEY,
    'Content-Type': 'application/json'
  }
};
```

### Distance Calculation Caching
```typescript
// REQUIRED: Cache distance calculations to reduce API calls
async calculateAndCacheDistance(fromSiteId: number, toSiteId: number) {
  // Check cache first
  const cached = await this.getDistance(fromSiteId, toSiteId);
  if (cached) return cached;
  
  // Calculate via OpenRouteService
  const distance = await this.callOpenRouteService(fromSite, toSite);
  
  // Cache result
  return await this.createDistance({
    fromSiteId,
    toSiteId,
    kilometers: distance,
    routeType: 'fastest'
  });
}
```

## DEPLOYMENT CONFIGURATION

### Production Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://production_connection_string
OPENROUTESERVICE_API_KEY=production_api_key
SESSION_SECRET=secure_production_secret
PORT=5000
```

### Database Migration Commands
```bash
# Required for schema updates
npm run db:push

# For production deployments
npm run build
npm start
```

## MONITORING AND LOGGING

### Required Audit Logging
```typescript
// MANDATORY: Log all critical operations
await storage.createAuditLog({
  userId: req.user.id,
  action: 'DEPARTMENT_CREATED',
  targetType: 'Department',
  targetId: department.id,
  details: `Created department: ${department.name}`,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
});
```

### Health Check Endpoints
```typescript
// Required for deployment monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected' // Add actual DB health check
  });
});
```