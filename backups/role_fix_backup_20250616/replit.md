# Trip Transportation Workflow Management System

## Overview

This is an enterprise-grade Trip Transportation Workflow Management System built with a full-stack TypeScript architecture. The system manages approximately 8,000 annual trip requests from 350+ users across multiple departments and projects, featuring intelligent multi-stage authorization, granular user role management, and comprehensive budget enforcement.

## System Architecture

### Technology Stack
- **Frontend**: React 18 with TypeScript, Vite build system
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM (type-safe operations)
- **Authentication**: Passport.js with session-based authentication
- **External APIs**: OpenRouteService for real-time distance calculation

### Architecture Pattern
The system follows a **database-first architecture** where all business logic is driven by real-time database state rather than hardcoded rules. This ensures the system adapts dynamically to organizational changes without code modifications.

## Key Components

### Frontend Architecture
- **Component Library**: shadcn/ui with consistent design system
- **Data Fetching**: TanStack Query with optimized caching strategies
- **Type Safety**: Full TypeScript implementation with shared schema types
- **Cache Management**: Enterprise-grade cache invalidation for 350+ concurrent users
- **Permission-Aware UI**: Dynamic interface rendering based on user permissions

### Backend Architecture
- **Express.js API**: RESTful endpoints with comprehensive error handling
- **Database Operations**: Drizzle ORM with ACID-compliant transactions
- **Permission Middleware**: Centralized authorization system
- **Audit System**: Comprehensive logging for regulatory compliance
- **File Management**: Secure document upload and storage

### Database Design
- **Single PostgreSQL Instance**: Full ACID compliance with transaction atomicity
- **Zero Hardcoded Logic**: All workflow rules stored in database tables
- **Real-time Budget Tracking**: Atomic budget validations with rollback protection
- **Dynamic Workflows**: Approval sequences generated from database relationships

## Data Flow

### Trip Request Workflow
1. **Request Creation**: Employee submits trip with automatic cost calculation
2. **Workflow Generation**: System creates approval steps based on trip type and organizational structure
3. **Sequential Approval**: Each approval step validates permissions and budget constraints
4. **Budget Management**: Atomic budget allocation/deallocation with real-time tracking
5. **Audit Trail**: Complete action logging for compliance and transparency

### Permission System
- **Database-First Validation**: All permissions determined by live database relationships
- **Role-Based Access Control**: Dynamic permission checking with active role switching
- **Workflow-Aware Authorization**: Users can only approve requests assigned to them in current workflow step
- **Multi-Level Management**: Support for department and project-based approval hierarchies

### Budget Enforcement
- **Real-time Validation**: Budget checks occur within atomic database transactions
- **Allocation Tracking**: Budget reserved on approval, released on rejection
- **Project Expiration**: Automatic project deactivation with trip prevention
- **Multi-Currency Support**: Jordanian Dinar primary with configurable exchange rates

## External Dependencies

### Required Services
- **PostgreSQL Database**: Primary data store with session management
- **OpenRouteService API**: Real-time distance calculation for cost determination
- **File Storage System**: Document upload and management (configurable)

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:port/database
OPENROUTESERVICE_API_KEY=your_api_key_here
SESSION_SECRET=your_session_secret_here
NODE_ENV=production
PORT=3000
```

### API Integrations
- **OpenRouteService**: Distance calculation with intelligent caching to minimize API calls
- **Session Store**: PostgreSQL-based session management for enterprise scalability

## Deployment Strategy

### Production Requirements
- **System**: Node.js 20+, PostgreSQL 14+, minimum 2GB RAM
- **Security**: SSL certificate recommended, secure session configuration
- **Performance**: Database indexes for optimal query performance
- **Scalability**: Connection pooling and cache management for 350+ concurrent users

### Development Setup
1. Clone repository and install dependencies
2. Configure PostgreSQL database and run migrations
3. Set environment variables for development
4. Start development server with hot reload

### Build Process
- **Frontend**: Vite build with TypeScript compilation and asset optimization
- **Backend**: esbuild compilation with ESM format and external package handling
- **Database**: Drizzle migrations with automatic schema synchronization

## Changelog
- June 16, 2025: Fixed role change functionality by adding role handling to admin user update endpoint
- June 15, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.