# Database Architecture Reference
## Trip Transportation Workflow System

> **CRITICAL SYSTEM FOUNDATION**: This document outlines the core database architecture principles that ensure system reliability, data integrity, and compliance.

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Trip Transportation Workflow System              │
│                         Database-First Architecture                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Frontend      │    │   Backend API    │    │   PostgreSQL       │
│   React + TS    │◄──►│   Express + TS   │◄──►│   Single Instance   │
│                 │    │                  │    │                     │
│ • TanStack      │    │ • Authentication │    │ • ACID Compliance   │
│   Query         │    │ • Route Handler  │    │ • Transaction       │
│ • Wouter        │    │ • Permission     │    │   Atomicity         │
│ • shadcn/ui     │    │   Validation     │    │ • Real-time Budget  │
│                 │    │ • Audit Logging  │    │ • Workflow Steps    │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   External Services  │
                    │                      │
                    │ • OpenRouteService   │
                    │   (Distance Calc)    │
                    │ • Session Store      │
                    │ • File Upload        │
                    └──────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Database Schema Overview                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Users    │    │ Departments │    │  Projects   │    │    Sites    │
│             │    │             │    │             │    │             │
│ • id (PK)   │    │ • id (PK)   │    │ • id (PK)   │    │ • id (PK)   │
│ • username  │    │ • name      │    │ • name      │    │ • name      │
│ • role      │    │ • budget    │    │ • budget    │    │ • gps_lat   │
│ • dept      │◄──►│ • monthly   │◄──►│ • manager   │    │ • gps_lng   │
│ • active    │    │   bonus     │    │ • expiry    │    │ • active    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                                      │                  │
       │                                      │                  │
       ▼                                      ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│Trip Requests│    │Admin Requests│   │ Distances   │    │  KM Rates   │
│             │    │             │    │             │    │             │
│ • id (PK)   │    │ • id (PK)   │    │ • from_site │    │ • rate      │
│ • purpose   │    │ • type      │    │ • to_site   │    │ • effective │
│ • trip_type │    │ • amount    │    │ • distance  │    │   from/to   │
│ • status    │    │ • status    │    │ • cached    │    │ • active    │
│ • cost      │    │ • reason    │    └─────────────┘    └─────────────┘
└─────────────┘    └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────────────────────┐    ┌─────────────────────────────┐
│      Workflow Steps         │    │       Audit Logs           │
│                             │    │                             │
│ • request_id (FK)           │    │ • action                    │
│ • step_type                 │    │ • user_id (FK)              │
│ • required_role             │    │ • entity_type               │
│ • status                    │    │ • entity_id                 │
│ • approved_by               │    │ • timestamp                 │
│ • approved_at               │    │ • details (JSON)            │
└─────────────────────────────┘    └─────────────────────────────┘
```

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Request Processing Flow                     │
└─────────────────────────────────────────────────────────────────────┘

User Request ──► Frontend ──► API Route ──► Permission Check ──► Database
     │              │             │              │                   │
     │              │             │              ▼                   │
     │              │             │         ┌─────────────┐          │
     │              │             │         │ Workflow    │          │
     │              │             │         │ Steps Table │          │
     │              │             │         │ Validation  │          │
     │              │             │         └─────────────┘          │
     │              │             │              │                   │
     │              │             ▼              ▼                   ▼
     │              │      ┌─────────────┐ ┌─────────────┐    ┌─────────────┐
     │              │      │ Budget      │ │ Status      │    │ Audit Log   │
     │              │      │ Validation  │ │ Update      │    │ Creation    │
     │              │      │ (Atomic)    │ │ (Atomic)    │    │ (Atomic)    │
     │              │      └─────────────┘ └─────────────┘    └─────────────┘
     │              │              │              │                   │
     │              ◄──────────────┼──────────────┼───────────────────┘
     ◄──────────────┘              │              │
                                   ▼              ▼
                            Success Response ── or ── Error Response
                                 │                      │
                                 ▼                      ▼
                           Update UI Cache      Display Error Message
```

### Single PostgreSQL Instance with Full ACID Compliance

The system operates on a **single PostgreSQL database instance** providing enterprise-grade reliability through complete ACID compliance:

#### **Atomicity**
- All database operations are atomic - transactions either complete fully or are rolled back entirely
- Individual trip approvals execute as single atomic operations
- Bulk operations wrap multiple requests in single transactions ensuring all-or-nothing behavior
- Budget operations (allocation/deallocation) are atomic with status changes

#### **Consistency** 
- Database constraints and validations ensure data remains in a valid state
- Foreign key relationships maintain referential integrity
- Check constraints prevent invalid status transitions
- Budget totals remain mathematically consistent across all operations

#### **Isolation**
- Concurrent operations are isolated using PostgreSQL's transaction isolation levels
- Multiple users can approve requests simultaneously without data corruption
- Budget calculations account for concurrent operations through proper locking
- Real-time validation prevents race conditions in budget allocation

#### **Durability**
- Committed transactions are permanently stored and survive system failures
- All audit logs are durably stored with transaction completion
- Budget changes are permanently recorded with approval actions
- System recovery maintains complete transaction history

## Complete Transaction Atomicity for All Operations

### Individual Operations
Every single system operation uses atomic transactions:
```sql
BEGIN;
  -- Update trip request status
  -- Update workflow steps
  -- Modify project budget
  -- Create audit log entry
COMMIT; -- All operations succeed or all fail
```

### Bulk Operations
Multi-request operations maintain atomicity across entire batches:
```sql
BEGIN;
  -- Process Request 1: status + budget + audit
  -- Process Request 2: status + budget + audit  
  -- Process Request N: status + budget + audit
COMMIT; -- All requests succeed or all fail
```

### Budget Operations
Budget validation and modification occur within the same transaction:
```sql
BEGIN;
  -- Validate current budget availability
  -- Update trip request status to 'Approved'
  -- Deduct cost from project budget
  -- Log approval action
COMMIT; -- Budget consistency guaranteed
```

## Real-time Budget Tracking with Atomic Validations

### Atomic Budget Checks
- Budget validation and deduction occur within the same transaction
- No race conditions between budget check and budget modification
- Failed operations automatically restore budget state through transaction rollback

### Real-time Calculations
- Budget availability calculated in real-time considering all pending and approved requests
- Current budget queries include all committed transactions
- No stale budget data due to immediate consistency

### Cross-request Validation
- Bulk operations validate total budget impact before processing any individual request
- Partial failures trigger complete rollback of entire operation
- Budget constraints prevent over-allocation across concurrent operations

### Rollback Protection
- Any operation failure automatically restores original budget state
- No manual cleanup required for failed transactions
- Database consistency maintained even during system failures

## Database-First Permission System with Zero Hardcoded Logic

### Workflow Steps Table
All approval requirements stored in `workflow_steps` table:
```sql
-- Dynamic workflow generation based on database state
SELECT required_role, step_order, conditions 
FROM workflow_steps 
WHERE trip_request_id = ? 
ORDER BY step_order;
```

### Dynamic Permission Validation
Permissions determined by database relationships, not code logic:
- User roles queried from database at runtime
- Project assignments checked against database records
- Department relationships validated through database joins
- No hardcoded permission rules in application code

### Single Source of Truth
Database serves as authoritative source for all workflow decisions:
- Approval sequences generated from workflow_steps table
- Permission checks query current database relationships
- Status transitions controlled by database workflow state
- Business rule changes require only database updates

### No Hardcoded Rules
Business logic rules stored in database, not application code:
- Workflow sequences configurable through database records
- Approval hierarchies defined by database relationships
- Permission matrices stored in database tables
- Zero hardcoded approval logic in source code

## Comprehensive Audit Logging for Compliance

### Complete Action Tracking
Every system action logged with user, timestamp, and details:
```sql
INSERT INTO audit_logs (
  user_id, action, entity_type, entity_id, 
  changes, timestamp, request_details
) VALUES (?, ?, ?, ?, ?, NOW(), ?);
```

### Immutable Audit Trail
- Audit logs cannot be modified once created
- No DELETE operations permitted on audit_logs table
- Complete history preserved for regulatory compliance
- Audit integrity enforced through database constraints

### Bulk Operation Tracking
- Individual logs for each request in bulk operations
- Summary logs for batch operation metadata
- Detailed tracking of partial success scenarios
- Complete audit trail for compliance review

### Compliance Ready
Audit structure supports regulatory and organizational compliance:
- User action attribution for accountability
- Timestamp precision for sequence verification
- Change detail tracking for impact analysis
- Entity relationship tracking for comprehensive audit

## Performance and Scalability

### Connection Pooling
- Database connection pool manages concurrent user load
- Optimal connection reuse reduces overhead
- Pool sizing configured for 350+ concurrent users

### Query Optimization
- Indexed foreign keys for efficient joins
- Optimized queries in storage layer methods
- Proper query planning for complex operations

### Real-time Operations
- Efficient budget calculation queries
- Optimized permission validation queries
- Fast workflow step resolution
- Minimal latency for user operations

## System Reliability Guarantees

### Data Integrity
- Foreign key constraints prevent orphaned records
- Check constraints enforce valid data ranges
- Transaction atomicity prevents partial updates
- Referential integrity maintained across all operations

### Consistency Guarantees
- Budget totals always mathematically correct
- Workflow states always valid and traceable
- Audit logs always complete and accurate
- User permissions always current and valid

### Failure Recovery
- Automatic transaction rollback on any failure
- No manual cleanup required for failed operations
- System state always recoverable to last valid point
- Complete audit trail preserved through failures

## Monitoring and Maintenance

### Health Indicators
- Transaction success/failure rates
- Budget consistency validation
- Workflow completion statistics
- Audit log completeness verification

### Performance Metrics
- Query execution times
- Transaction throughput
- Connection pool utilization
- Index effectiveness

### Backup and Recovery
- Point-in-time recovery capability
- Complete transaction log preservation
- Automated backup scheduling
- Disaster recovery procedures

---

This database architecture ensures the Trip Transportation Workflow System operates with enterprise-grade reliability, complete data integrity, and regulatory compliance while maintaining optimal performance for 350+ concurrent users processing 8,000+ annual trip requests.