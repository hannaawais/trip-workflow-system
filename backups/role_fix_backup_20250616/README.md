# Trip Transportation Workflow Management System

An advanced internal transportation and budget request workflow management system with intelligent multi-stage authorization and granular user role management.

## Overview

This system manages approximately 8,000 annual trip requests from 350 users across multiple departments and projects. It provides comprehensive workflow automation, budget enforcement, and audit compliance for organizational transportation needs.

## Key Features

### 🚗 Trip Request Management
- **Multiple Trip Types**: Ticket, Planned (project-based), and Urgent (pre-approved) trips
- **Intelligent Workflow Routing**: Automatic approval path determination based on trip type and organizational structure
- **Real-time Cost Calculation**: Automatic distance and cost computation using OpenRouteService integration
- **Budget Protection**: Prevents over-allocation with real-time budget validation

### 🏢 Organizational Management
- **Department Management**: Hierarchical department structure with multi-level manager approval
- **Project Management**: Project-based trip approval with budget tracking and expiration automation
- **Site Management**: 400+ predefined sites with distance caching for accurate cost calculation
- **User Role Management**: Dynamic role switching and granular permission control

### 💰 Financial Controls
- **Multi-Currency Support**: Jordanian Dinar (JD) primary currency with configurable exchange rates
- **Budget Tracking**: Real-time project and department budget monitoring
- **Automated Allocation**: Budget deduction on approval with automatic restoration on rejection
- **Financial Approval**: Mandatory finance department approval for all trip types

### ⚡ Advanced Features
- **Bulk Operations**: Batch approval and rejection with partial success handling
- **Audit Trail**: Comprehensive logging of all actions and status changes
- **Project Expiration**: Automatic project deactivation and trip prevention for expired projects
- **Sequential Workflows**: Database-driven approval sequences with no hardcoded logic
- **Enterprise Cache Management**: Multi-PC data consistency for 350+ users with intelligent cache invalidation

## Technology Stack

- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session management
- **Real-time Features**: WebSocket integration for live updates
- **External APIs**: OpenRouteService for route calculation

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenRouteService API key

### Installation
```bash
# Clone and install dependencies
npm install

# Set up environment variables
# Add DATABASE_URL and OPENROUTESERVICE_API_KEY to environment

# Initialize database
npm run db:push

# Start development server
npm run dev
```

### Default Access
The system requires initial user creation through the registration interface. Admin privileges can be assigned through database management.

## System Architecture

### Database-First Architecture with ACID Compliance
**Single PostgreSQL Instance** with enterprise-grade reliability:
- **Full ACID Compliance**: Atomicity, Consistency, Isolation, Durability guaranteed for all operations
- **Complete Transaction Atomicity**: Individual and bulk operations wrapped in atomic transactions
- **Real-time Budget Tracking**: Atomic budget validations prevent over-allocation
- **Zero Hardcoded Logic**: All business rules stored in database, not application code
- **Comprehensive Audit Logging**: Immutable audit trail for regulatory compliance

**Database-Driven Operations**:
- **Workflow Steps Table**: Manages all approval sequences dynamically
- **Permission Validation**: Real-time checks based on database relationships
- **Budget Protection**: Atomic budget allocation and deallocation with rollback protection

### Permission System
- **Role-Based Access**: Employee, Department Manager, Project Manager, Finance, Admin
- **Dynamic Permissions**: Context-aware access based on assignments and active roles
- **Workflow Integration**: Approval rights determined by database workflow steps

### Budget Management
- **Project Budgets**: Individual project allocation and tracking
- **Department Budgets**: Monthly budget with bonus allocation system
- **Real-time Protection**: Prevents over-allocation through database validation
- **Automatic Restoration**: Budget restoration on trip rejection or cancellation

## User Roles

| Role | Capabilities |
|------|-------------|
| **Employee** | Submit trip requests, view personal requests |
| **Department Manager** | Approve department ticket trips, manage department settings |
| **Project Manager** | Approve project-based trips, manage project budgets |
| **Finance** | Final approval authority, payment processing, budget oversight |
| **Admin** | System configuration, user management, override capabilities |

## Trip Approval Workflows

### Ticket Trips
```
Employee → Department Approval → Finance Approval → Payment
```

### Planned Trips (Project-based)
```
Employee → Project Approval (Budget Deducted) → Finance Approval → Payment
```

### Urgent Trips (Pre-approved)
```
Employee (with documentation) → Finance Approval → Payment
```

## Documentation Structure

- **[User Guide](USER_GUIDE.md)** - End-user instructions for all system features
- **[Developer Guide](DEVELOPER_GUIDE.md)** - Technical implementation details
- **[API Reference](API_REFERENCE.md)** - Complete endpoint documentation
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production setup procedures
- **[Technical Documentation](technical/)** - Database schema, workflows, security

## Support and Maintenance

### System Health
- Automated project expiration management
- Daily budget validation checks
- Performance optimization with database indexing
- Comprehensive error logging and recovery procedures

### Compliance
- Complete audit trail for all actions
- Role-based access control with session management
- Budget allocation tracking with automatic reconciliation
- Workflow enforcement preventing unauthorized access

## Contributing

This system follows enterprise development practices:
- TypeScript for type safety
- Comprehensive error handling
- Database-first architecture
- Real-time validation and audit logging

For technical details, see the [Developer Guide](DEVELOPER_GUIDE.md).

## License

Internal organizational use only.