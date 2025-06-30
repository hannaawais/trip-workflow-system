-- Database Performance Optimization Migration
-- Creates missing indexes for frequently queried columns
-- Expected impact: 50-80% query performance improvement

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_number ON users(company_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users(is_active);

-- Trip requests table indexes (critical for performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_status ON trip_requests(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_requester_id ON trip_requests(requester_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_department_id ON trip_requests(department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_project_id ON trip_requests(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_created_at ON trip_requests(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_trip_date ON trip_requests(trip_date);

-- Compound indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_status_dept ON trip_requests(status, department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_status_project ON trip_requests(status, project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trip_requests_requester_status ON trip_requests(requester_id, status);

-- Admin requests table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_requests_status ON admin_requests(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_requests_requester_id ON admin_requests(requester_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_requests_department ON admin_requests(department);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_requests_created_at ON admin_requests(created_at);

-- Audit logs table indexes (critical for audit queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action);

-- Workflow steps table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_steps_trip_request_id ON workflow_steps(trip_request_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_steps_approver_id ON workflow_steps(approver_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workflow_steps_step_type ON workflow_steps(step_type);

-- Departments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_manager_id ON departments(manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_second_manager_id ON departments(second_manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_third_manager_id ON departments(third_manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_departments_active ON departments(is_active);

-- Projects table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_second_manager_id ON projects(second_manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_department_id ON projects(department_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_active ON projects(is_active);

-- Project assignments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_project_id ON project_assignments(project_id);

-- Sites and distances table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sites_active ON sites(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sites_abbreviation ON sites(abbreviation);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_distances_from_site_id ON distances(from_site_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_distances_to_site_id ON distances(to_site_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_distances_route_type ON distances(route_type);

-- KM rates table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_km_rates_effective_from ON km_rates(effective_from);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_km_rates_active ON km_rates(is_active);

-- System settings table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_system_settings_updated_by ON system_settings(updated_by);

-- Project documents table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_documents_uploaded_by ON project_documents(uploaded_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_documents_is_deleted ON project_documents(is_deleted);

-- Performance monitoring queries to verify index usage
-- Run these after migration to confirm indexes are being used:

-- EXPLAIN ANALYZE SELECT * FROM trip_requests WHERE status = 'Pending Department Approval';
-- EXPLAIN ANALYZE SELECT * FROM trip_requests WHERE requester_id = 1 AND status = 'Approved';
-- EXPLAIN ANALYZE SELECT * FROM audit_logs WHERE user_id = 1 ORDER BY timestamp DESC LIMIT 50;
-- EXPLAIN ANALYZE SELECT * FROM workflow_steps WHERE trip_request_id IN (SELECT id FROM trip_requests WHERE status = 'Pending Department Approval');

-- Cleanup old unused indexes (run carefully)
-- DROP INDEX CONCURRENTLY IF EXISTS old_index_name;

-- Note: CONCURRENTLY option allows indexes to be created without blocking other operations
-- This is crucial for production systems with ongoing operations