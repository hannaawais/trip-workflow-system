# Security Guidelines and Authentication

## Authentication System

### User Authentication Pattern
**REQUIRED**: All protected routes must verify authentication:

```typescript
// MANDATORY: Authentication middleware
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

// Apply to all protected API routes
app.get("/api/protected-endpoint", isAuthenticated, handler);
```

### Role-Based Access Control
```typescript
// REQUIRED: Role validation for sensitive operations
const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};

// Usage examples
app.post("/api/admin-actions", isAuthenticated, requireRole(['Admin']), handler);
app.get("/api/finance-data", isAuthenticated, requireRole(['Finance', 'Admin']), handler);
app.post("/api/approve-request", isAuthenticated, requireRole(['Manager', 'Finance', 'Admin']), handler);
```

### Active Role Management
```typescript
// CRITICAL: Support for users with multiple roles
interface SessionData {
  activeRole?: string; // Current active role for managers
}

// Role switching for managers
app.post("/api/switch-role", isAuthenticated, async (req, res) => {
  const { newRole } = req.body;
  const user = req.user;
  
  // Validate user can switch to this role
  if (!canUserAccessRole(user, newRole)) {
    return res.status(403).json({ error: "Cannot switch to this role" });
  }
  
  req.session.activeRole = newRole;
  res.json({ success: true, activeRole: newRole });
});
```

## Password Security

### Password Hashing
```typescript
// REQUIRED: Secure password hashing with scrypt
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}
```

### Password Policy
```typescript
// REQUIRED: Password validation rules
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  
  return { valid: errors.length === 0, errors };
}
```

## Session Management

### Session Configuration
```typescript
// CRITICAL: Secure session configuration
const sessionSettings: session.SessionOptions = {
  secret: process.env.SESSION_SECRET!, // REQUIRED: Strong secret
  resave: false,
  saveUninitialized: false,
  store: storage.sessionStore, // Database session store
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'strict' // CSRF protection
  }
};
```

### Session Store Configuration
```typescript
// REQUIRED: Database session persistence
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool, // Database connection pool
      createTableIfMissing: true,
      tableName: 'session'
    });
  }
}
```

## API Endpoint Protection

### Request Validation
```typescript
// REQUIRED: Input validation for all endpoints
import { z } from 'zod';

const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  budget: z.number().positive(),
  managerId: z.number().positive(),
  monthlyBudgetBonus: z.number().default(0)
});

app.post("/api/departments", isAuthenticated, requireRole(['Admin']), async (req, res) => {
  try {
    const validatedData = createDepartmentSchema.parse(req.body);
    const department = await storage.createDepartment(validatedData);
    res.json(department);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    throw error;
  }
});
```

### Rate Limiting
```typescript
// RECOMMENDED: Rate limiting for sensitive endpoints
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 attempts per window
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

app.post("/api/login", authLimiter, passport.authenticate("local"), handler);
app.post("/api/register", authLimiter, handler);
```

## Data Access Controls

### Department-Based Access
```typescript
// REQUIRED: Users can only access their department's data
async function filterByDepartmentAccess(user: User, data: any[]): Promise<any[]> {
  if (user.role === 'Admin' || user.role === 'Finance') {
    return data; // Admin and Finance can see all
  }
  
  return data.filter(item => item.department === user.department);
}

// Apply to trip requests, admin requests, etc.
app.get("/api/trip-requests", isAuthenticated, async (req, res) => {
  const allRequests = await storage.getTripRequests();
  const filteredRequests = await filterByDepartmentAccess(req.user, allRequests);
  res.json({ trips: filteredRequests });
});
```

### Project-Based Access
```typescript
// REQUIRED: Project managers can only access assigned projects
async function getUserAccessibleProjects(userId: number): Promise<Project[]> {
  const userProjects = await storage.getUserProjects(userId);
  const managedProjects = await storage.getUserManagedProjects(userId);
  
  // Combine and deduplicate
  const allProjects = [...userProjects, ...managedProjects];
  return allProjects.filter((project, index, self) => 
    index === self.findIndex(p => p.id === project.id)
  );
}
```

## Audit Logging

### Security Event Logging
```typescript
// MANDATORY: Log all security-relevant events
async function logSecurityEvent(event: {
  userId?: number;
  action: string;
  resource?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}): Promise<void> {
  await storage.createAuditLog({
    userId: event.userId,
    action: event.action,
    targetType: event.resource || 'System',
    targetId: null,
    details: event.details || `${event.action} - ${event.success ? 'Success' : 'Failed'}`,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent
  });
}

// Usage examples
await logSecurityEvent({
  userId: req.user?.id,
  action: 'LOGIN_ATTEMPT',
  success: true,
  ipAddress: req.ip,
  userAgent: req.get('User-Agent')
});

await logSecurityEvent({
  userId: req.user.id,
  action: 'ROLE_SWITCH',
  success: true,
  details: `Switched from ${oldRole} to ${newRole}`,
  ipAddress: req.ip
});
```

## Environment Security

### Environment Variables
```bash
# REQUIRED: Secure environment configuration
NODE_ENV=production
DATABASE_URL=postgresql://secure_connection_string
SESSION_SECRET=cryptographically_secure_random_string_min_32_chars
OPENROUTESERVICE_API_KEY=api_key_here

# NEVER commit these to version control
# Use .env files locally and secure secret management in production
```

### Security Headers
```typescript
// RECOMMENDED: Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

## User Account Security

### Account Activation
```typescript
// REQUIRED: User account must be activated before use
async function createUser(userData: InsertUser): Promise<User> {
  const user = await storage.createUser({
    ...userData,
    isActive: false, // Require admin activation
    password: await hashPassword(userData.password)
  });
  
  // Log user creation
  await logSecurityEvent({
    action: 'USER_CREATED',
    resource: 'User',
    success: true,
    details: `User created: ${user.username}`
  });
  
  return user;
}
```

### Account Deactivation
```typescript
// REQUIRED: Secure account deactivation
app.post("/api/users/:id/deactivate", isAuthenticated, requireRole(['Admin']), async (req, res) => {
  const userId = parseInt(req.params.id);
  
  // Cannot deactivate self
  if (userId === req.user.id) {
    return res.status(400).json({ error: "Cannot deactivate your own account" });
  }
  
  const user = await storage.deactivateUser(userId);
  
  await logSecurityEvent({
    userId: req.user.id,
    action: 'USER_DEACTIVATED',
    resource: 'User',
    success: true,
    details: `Deactivated user: ${user.username}`,
    ipAddress: req.ip
  });
  
  res.json(user);
});
```