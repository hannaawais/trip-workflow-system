# Architecture Overview

## Overview

This application is a comprehensive Trip Transportation Workflow Management System that allows employees to submit trip requests, administrative requests, and manages approval workflows. The system tracks budgets at both department and project levels and provides reporting capabilities.

The architecture follows a modern full-stack JavaScript approach with a client-server model:

- **Frontend**: React-based single-page application (SPA) with TypeScript
- **Backend**: Node.js server using Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based authentication with Passport.js

## System Architecture

### High-Level Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  React Frontend │◄────►│  Express Server │◄────►│  PostgreSQL DB  │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

The application follows a client-server architecture with clear separation of concerns:

1. **Client**: React SPA with React-Query for data fetching and state management
2. **Server**: Express.js API server that handles business logic and database operations
3. **Database**: PostgreSQL with Drizzle ORM for typesafe database access

### Directory Structure

```
/
├── client/                  # Frontend React application
│   ├── src/                 # Source code
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # Utility functions
│   │   ├── pages/           # Page components
│   │   ├── App.tsx          # Main application component
│   │   └── main.tsx         # Entry point
│   └── index.html           # HTML template
├── server/                  # Backend Express application
│   ├── auth.ts              # Authentication logic
│   ├── db.ts                # Database connection
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Data access interface
│   ├── db_storage.ts        # Database implementation
│   └── vite.ts              # Development server setup
├── shared/                  # Shared code between client and server
│   └── schema.ts            # Database schema and validation
└── migrations/              # Database migrations
```

## Key Components

### Frontend

1. **Component Library**: Uses ShadCN UI components based on Radix UI primitives for accessible and consistent UI
2. **State Management**: TanStack React Query for server state management and caching
3. **Routing**: Wouter for lightweight client-side routing
4. **Form Handling**: React Hook Form with Zod for form validation
5. **Styling**: Tailwind CSS for utility-first styling approach

The frontend is organized around feature-based pages with reusable components:

- **Layout**: Main application layout with navigation
- **Pages**: Feature-specific views like dashboard, trip requests, approvals, etc.
- **Components**: Reusable UI components
- **Hooks**: Custom hooks for authentication, toast notifications, etc.

### Backend

1. **API Server**: Express.js for handling HTTP requests
2. **Authentication**: Passport.js with local strategy for username/password auth
3. **Session Management**: Express-session with PostgreSQL store for persistent sessions
4. **Database Access**: Drizzle ORM with PostgreSQL for type-safe database operations
5. **File Uploads**: Multer for handling multipart/form-data for document uploads

The backend follows a repository pattern with:

- **Routes**: API endpoint definitions
- **Storage Interface**: Abstract data access layer
- **Database Implementation**: Concrete implementation of the storage interface

### Database Schema

The application uses a relational database with the following key entities:

1. **Users**: Employee records with authentication information
2. **Departments**: Organizational units with budgets
3. **Projects**: Project entities with budgets
4. **Trip Requests**: Employee travel requests with approval workflows
5. **Admin Requests**: Administrative requests (budget increases, etc.)
6. **Audit Logs**: System activity tracking
7. **Km Rates**: Configurable rates for travel reimbursement

Recent migrations indicate a move towards making `trip_requests` the single source of truth for cost data, maintaining consistency across the system.

## Data Flow

### Authentication Flow

1. User submits credentials via login form
2. Server validates credentials using Passport.js
3. On success, a session is created and stored in the database
4. The session ID is stored in a cookie on the client
5. Subsequent requests include the cookie for authentication

### Request Approval Flow

1. Employee creates a trip request or admin request
2. Request enters the workflow based on type:
   - Trip requests follow: Department → Project (if applicable) → Finance
   - Admin requests follow a similar approval chain
3. Managers/Approvers see pending requests in their approval dashboard
4. Each approval/rejection triggers status updates and notifications
5. Finance team handles final approvals and payment status

### Budget Management

1. Department and project budgets are managed separately
2. Trip costs impact relevant budgets based on the request type
3. Admin requests can be used to request budget increases
4. The system tracks budget usage and provides reporting

## External Dependencies

### Frontend Dependencies

- React ecosystem (React, React DOM)
- TanStack React Query for data fetching
- Radix UI primitives for accessible components
- React Hook Form and Zod for form validation
- Tailwind CSS for styling
- Recharts for data visualization

### Backend Dependencies

- Express.js for API routing
- Passport.js for authentication
- Drizzle ORM for database access
- Neon database client for PostgreSQL connectivity
- Multer for file uploads
- Various utilities (crypto for password hashing, etc.)

## Deployment Strategy

The application is set up for deployment on Replit, as indicated by the `.replit` configuration file. The deployment strategy involves:

1. **Build Process**:
   - Frontend is built using Vite
   - Backend is compiled using esbuild
   - Assets are bundled into a distribution directory

2. **Runtime Configuration**:
   - Environment variables control database connections and other settings
   - Production mode disables development features

3. **Scaling Approach**:
   - The application is designed for "autoscale" deployment on Replit
   - PostgreSQL database is likely hosted on Neon (based on the imports)

4. **Database Migrations**:
   - Drizzle handles schema migrations
   - Migration scripts are included for data transformations

## Security Considerations

1. **Authentication**: Session-based with proper password hashing using scrypt
2. **Authorization**: Role-based access control (Employee, Manager, Finance, Admin)
3. **Data Validation**: Zod schemas for request validation
4. **Session Management**: Secure session handling with proper cookie settings
5. **File Upload Security**: Restricted to PDFs with size limits

## UI Layout Standards

The application maintains consistent UI layout patterns across its forms, especially in key features like the Trip Request form. These standards are documented in `TRIP_REQUEST_LAYOUT_GUIDE.md` and include:

1. **Form Organization**: Two-column layouts with logical field grouping
2. **Field Spacing**: Consistent vertical spacing (mt-6) between field groups
3. **Visual Styling**: Clear UI hierarchy with section headers and appropriate whitespace
4. **Role-Based Interfaces**: Different interfaces for users with different permissions
5. **Field Validation**: Visual indicators for required fields and validation states
6. **Default Values**: Default trip type set to "Ticket" for better usability

## Future Considerations

Based on the migration files and code structure, future architectural improvements may include:

1. Enhanced single source of truth for cost data (already in progress)
2. Better integration between trip requests and admin requests
3. User activation/deactivation functionality
4. Expanded reporting capabilities
5. Potential for real-time notifications
6. Standardized UI layout patterns across all forms and interfaces