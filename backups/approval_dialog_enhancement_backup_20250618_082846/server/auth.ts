import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./db_storage";
import { User as SelectUser, registrationSchema } from "@shared/schema";
import { PermissionService } from "./permissions";

// Add type definition for the session data
declare module "express-session" {
  interface SessionData {
    activeRole?: string; // Custom property to store user's active role
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {
      activeRole?: string; // To store the current active role (for managers who can switch roles)
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "trip-transportation-workflow-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Convert username to lowercase for case-insensitive login
        const user = await storage.getUserByUsername(username.toLowerCase());
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    // Just store the user ID for compatibility with existing sessions
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      // Get the user from the database
      const user = await storage.getUser(id);
      
      if (user) {
        // For users who can switch roles, set default activeRole to their base role
        const canSwitchRoles = await PermissionService.canSwitchRoles(user.id, user.role);
        if (canSwitchRoles && !user.activeRole) {
          user.activeRole = user.role;
        }
      }
      
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate request body with enhanced schema
      const validationResult = registrationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const userData = validationResult.data;

      // Check for existing username (case-insensitive)
      const existingUserByUsername = await storage.getUserByUsername(userData.username.toLowerCase());
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check for existing email (case-insensitive)
      const existingUsers = await storage.getUsers();
      const existingUserByEmail = existingUsers.find(user => 
        user.email.toLowerCase() === userData.email.toLowerCase()
      );
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email address already exists" });
      }

      // Check for existing company number
      const existingUserByCompanyNumber = existingUsers.find(user => 
        user.companyNumber === userData.companyNumber
      );
      if (existingUserByCompanyNumber) {
        return res.status(400).json({ message: "Company number already exists" });
      }

      const hashedPassword = await hashPassword(userData.password);
      const finalUserData = {
        ...userData,
        password: hashedPassword,
        username: userData.username.toLowerCase(), // Store username in lowercase
        email: userData.email.toLowerCase(), // Store email in lowercase
      };

      const user = await storage.createUser(finalUserData);
      
      // Log user action
      await storage.createAuditLog({
        userId: user.id,
        action: "USER_REGISTERED",
        details: { 
          username: user.username,
          email: user.email,
          companyNumber: user.companyNumber
        }
      });

      req.login(user, (err) => {
        if (err) return next(err);
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      
      // Handle database constraint violations
      if (error.message && error.message.includes('duplicate key')) {
        if (error.message.includes('users_username_unique')) {
          return res.status(400).json({ message: "Username already exists" });
        } else if (error.message.includes('users_email_unique')) {
          return res.status(400).json({ message: "Email address already exists" });
        } else if (error.message.includes('users_company_number_unique')) {
          return res.status(400).json({ message: "Company number already exists" });
        }
      }
      
      next(error);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    // Check if remember me option is set
    const rememberMe = req.body.rememberMe === true;
    
    // Set cookie expiration based on remember me option
    if (rememberMe && req.session) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
    }
    
    // Log user action
    storage.createAuditLog({
      userId: req.user!.id,
      action: "USER_LOGGED_IN",
      details: { 
        username: req.user!.username,
        rememberMe: rememberMe
      }
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = req.user!;
    res.status(200).json(userWithoutPassword);
  });

  app.post("/api/logout", (req, res, next) => {
    // Log user action before logout
    if (req.user) {
      storage.createAuditLog({
        userId: req.user.id,
        action: "USER_LOGGED_OUT",
        details: { username: req.user.username }
      });
    }

    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user!;
    
    // Use PermissionService to check role switching capability
    const canSwitchRoles = await PermissionService.canSwitchRoles(req.user!.id, req.user!.role);
    if (canSwitchRoles) {
      const sessionActiveRole = req.session.activeRole;
      
      if (sessionActiveRole) {
        userWithoutPassword.activeRole = sessionActiveRole;
      }
    }
    
    res.json(userWithoutPassword);
  });

  // Route to toggle between Manager and Employee roles for users with Manager role
  app.post("/api/toggle-role", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    const canSwitchRoles = await PermissionService.canSwitchRoles(req.user!.id, req.user!.role);
    if (!canSwitchRoles) {
      return res.status(403).json({ message: "You don't have permission to perform this action" });
    }
    
    // Debug current state
    console.log("Before toggle - activeRole:", req.user!.activeRole);
    console.log("Before toggle - session activeRole:", req.session.activeRole);
    
    // FIXED: The problem is that activeRole in user object is always being set to Manager
    // at some point, but session has Employee, causing the toggle to always go one way
    
    // Get the role from session first, as it's most reliable
    const sessionRole = req.session.activeRole;
    
    // Toggle between available roles based on user's permissions
    const availableRoles = await PermissionService.getAvailableRoles(req.user!.id, req.user!.role);
    const currentIndex = availableRoles.indexOf(sessionRole || req.user!.role);
    const nextIndex = (currentIndex + 1) % availableRoles.length;
    const newRole = availableRoles[nextIndex];
    
    console.log("FIXING TOGGLE: session role =", sessionRole, "→ new role =", newRole);
    
    // Set the new role in both the user object and session 
    req.user!.activeRole = newRole;
    req.session.activeRole = newRole;
    
    console.log("TOGGLED ROLE from", sessionRole, "to", newRole);
    
    // Force save the session
    req.session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
      }
    });
    
    // Log the role switch
    storage.createAuditLog({
      userId: req.user!.id,
      action: "USER_TOGGLED_ROLE",
      details: {
        fromRole: sessionRole || req.user!.role,
        toRole: newRole
      }
    });
    
    // Return the updated user
    const { password, ...userWithoutPassword } = req.user!;
    userWithoutPassword.activeRole = newRole; // Ensure it's in the response
    res.json(userWithoutPassword);
  });
}
