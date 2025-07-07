-- =======================================================================
-- Trip Transportation Workflow System - Complete Database Setup
-- =======================================================================
-- Single-file setup with complete production schema match
-- Includes all tables, constraints, functions, triggers, and data
-- =======================================================================

\echo '======================================================================='
\echo 'Trip Transportation Workflow System - FINAL Complete Setup'
\echo '======================================================================='

-- Drop existing types
DROP TYPE IF EXISTS workflow_step_status CASCADE;
DROP TYPE IF EXISTS workflow_step_type CASCADE;
DROP TYPE IF EXISTS cost_method_type CASCADE;
DROP TYPE IF EXISTS urgency_type CASCADE;
DROP TYPE IF EXISTS trip_type CASCADE;
DROP TYPE IF EXISTS request_type CASCADE;
DROP TYPE IF EXISTS request_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create enums (exact production match)  
CREATE TYPE user_role AS ENUM ('Employee', 'Department Manager', 'Project Manager', 'Finance', 'Admin', 'Manager');
CREATE TYPE request_status AS ENUM ('Pending', 'Approved', 'Rejected', 'Cancelled', 'Pending Department Approval', 'Pending Project Approval', 'Pending Finance Approval', 'Paid');
CREATE TYPE request_type AS ENUM ('Trip', 'Administrative');
CREATE TYPE trip_type AS ENUM ('Ticket', 'Planned', 'Urgent');
CREATE TYPE urgency_type AS ENUM ('Regular', 'Urgent');
CREATE TYPE workflow_step_type AS ENUM ('Department Manager', 'Second Department Manager', 'Tertiary Department Manager', 'Project Manager', 'Second Project Manager', 'Finance Approval', 'Admin Review');
CREATE TYPE workflow_step_status AS ENUM ('Pending', 'Approved', 'Rejected', 'Skipped');

-- Users table (exact production schema)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  company_number TEXT NOT NULL,
  department TEXT NOT NULL,
  email TEXT NOT NULL,
  home_address TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'Employee',
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  direct_manager_name TEXT,
  direct_cost_entry_permission BOOLEAN NOT NULL DEFAULT false,
  home_location TEXT
);

-- Add unique constraints for users
ALTER TABLE users ADD CONSTRAINT users_company_number_unique UNIQUE (company_number);
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);

-- Insert admin user with all required fields
INSERT INTO users (
  full_name, company_number, department, email, home_address, username, password, role, 
  is_active, direct_manager_name, direct_cost_entry_permission, home_location
) VALUES (
  'Admin User', 'ADMIN001', 'Administration', 'admin@company.com', 'Amman, Jordan',
  'admin', '$2b$10$BM9FrjPQCGw04876ELpiPeWveuB02MvMExWNYN6o34MRTFQtP4Dlq',
  'Admin', true, NULL, true, '31.9454,35.9284'
);

-- Departments table (exact production schema)
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  budget REAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  manager_id INTEGER REFERENCES users(id),
  second_manager_id INTEGER REFERENCES users(id),
  monthly_incident_budget REAL NOT NULL DEFAULT 0,
  third_manager_id INTEGER REFERENCES users(id),
  monthly_budget_bonus REAL NOT NULL DEFAULT 0,
  monthly_budget_bonus_reset_date TIMESTAMP,
  parent_department_id INTEGER REFERENCES departments(id)
);

-- Add unique constraint for departments
ALTER TABLE departments ADD CONSTRAINT departments_name_unique UNIQUE (name);

-- Insert departments
INSERT INTO departments (name, budget, is_active, manager_id, monthly_incident_budget, monthly_budget_bonus) VALUES 
('Administration', 10000.00, true, 1, 1000.00, 500.00),
('Engineering', 25000.00, true, 1, 2500.00, 1000.00),
('Finance', 15000.00, true, 1, 1500.00, 750.00),
('Operations', 20000.00, true, 1, 2000.00, 800.00),
('Human Resources', 8000.00, true, 1, 800.00, 400.00);

-- Projects table (exact production schema)
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  budget REAL NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  manager_id INTEGER REFERENCES users(id),
  second_manager_id INTEGER REFERENCES users(id),
  expiry_date DATE,
  department_id INTEGER REFERENCES departments(id),
  original_budget REAL,
  budget_adjustments REAL DEFAULT 0
);

-- Add unique constraint for projects
ALTER TABLE projects ADD CONSTRAINT projects_name_unique UNIQUE (name);

-- Insert projects with department_id references
INSERT INTO projects (name, budget, is_active, manager_id, second_manager_id, expiry_date, department_id, original_budget, budget_adjustments) VALUES 
('Digital Transformation Initiative', 50000.00, true, 1, NULL, '2025-12-31', 2, 50000.00, 0),
('Financial System Upgrade', 30000.00, true, 1, NULL, '2025-09-30', 3, 30000.00, 0),
('General Operations', 75000.00, true, 1, NULL, '2025-12-31', 4, 75000.00, 0);

-- Sites table (exact production schema with CHECK constraint, not ENUM)
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  abbreviation CHARACTER VARYING(10) NOT NULL,
  english_name CHARACTER VARYING(255) NOT NULL,
  city CHARACTER VARYING(100) NOT NULL,
  region CHARACTER VARYING(100) NOT NULL,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  site_type CHARACTER VARYING(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add production site type constraint
ALTER TABLE sites ADD CONSTRAINT sites_site_type_check 
CHECK (site_type = ANY (ARRAY['Hospital', 'Comprehensive clinic', 'Primary Clinic', 'Directory', 'Other']));

-- Add unique constraint for sites
ALTER TABLE sites ADD CONSTRAINT sites_abbreviation_key UNIQUE (abbreviation);

-- Insert sites with production-valid site types
INSERT INTO sites (abbreviation, english_name, city, region, gps_lat, gps_lng, site_type, is_active) VALUES 
('BASH', 'Bashiti Hospital', 'Amman', 'Central', 31.9454, 35.9284, 'Hospital', true),
('IRB', 'Irbid Comprehensive Clinic', 'Irbid', 'North', 32.5556, 35.8500, 'Comprehensive clinic', true),
('ZRQ', 'Zarqa Primary Clinic', 'Zarqa', 'Central', 32.0727, 36.0888, 'Primary Clinic', true),
('AQB', 'Aqaba Directory', 'Aqaba', 'South', 29.5267, 35.0067, 'Directory', true),
('DDS', 'Dead Sea Clinic', 'Dead Sea', 'Central', 31.7044, 35.5592, 'Hospital', true),
('PTR', 'Petra Medical Center', 'Petra', 'South', 30.3285, 35.4444, 'Hospital', true),
('KHB', 'Jordan Valley Clinic', 'Jordan Valley', 'Central', 31.8656, 35.5651, 'Primary Clinic', true),
('QAA', 'Airport Medical', 'Amman', 'Central', 31.7226, 35.9936, 'Other', true);

-- KM rates table (exact production schema)
CREATE TABLE km_rates (
  id SERIAL PRIMARY KEY,
  rate_value REAL NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER NOT NULL REFERENCES users(id),
  description TEXT
);

-- Insert KM rates
INSERT INTO km_rates (rate_value, effective_from, effective_to, created_by, description) VALUES 
(0.150, '2024-01-01', '2024-12-31', 1, 'Standard rate for 2024'),
(0.155, '2025-01-01', NULL, 1, 'Updated rate for 2025');

-- Project assignments table
CREATE TABLE project_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert project assignments
INSERT INTO project_assignments (user_id, project_id) VALUES 
(1, 1), (1, 2), (1, 3);

-- Project budget history table (exact production schema)
CREATE TABLE project_budget_history (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  transaction_type TEXT NOT NULL,
  amount REAL NOT NULL,
  running_balance REAL NOT NULL,
  reference_id INTEGER,
  reference_type TEXT,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Project documents table (exact production schema)
CREATE TABLE project_documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  upload_date TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- Trip requests table (exact production schema)
CREATE TABLE trip_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  department_id INTEGER REFERENCES departments(id),
  project_id INTEGER REFERENCES projects(id),
  trip_date TIMESTAMP NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  purpose TEXT NOT NULL,
  cost REAL NOT NULL,
  kilometers REAL,
  attachment_path TEXT,
  status request_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW(),
  department_manager_approved BOOLEAN,
  department_second_approved BOOLEAN,
  project_manager_approved BOOLEAN,
  project_second_approved BOOLEAN,
  finance_approved BOOLEAN,
  rejection_reason TEXT,
  notified BOOLEAN DEFAULT false,
  trip_type trip_type,
  urgency_type urgency_type,
  attachment_required BOOLEAN DEFAULT false,
  status_history JSONB DEFAULT '[]',
  last_updated_by INTEGER REFERENCES users(id),
  last_updated_at TIMESTAMP,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP,
  paid_by INTEGER REFERENCES users(id),
  cost_calculated_from_km BOOLEAN DEFAULT false,
  km_rate REAL,
  cost_method TEXT DEFAULT 'direct',
  cost_updated_at TIMESTAMP,
  cost_updated_by INTEGER REFERENCES users(id),
  km_rate_id INTEGER REFERENCES km_rates(id),
  km_rate_value REAL,
  original_distance REAL,
  ticket_no TEXT,
  home_deduction_km REAL,
  is_home_trip_origin BOOLEAN DEFAULT false,
  is_home_trip_destination BOOLEAN DEFAULT false,
  original_distance_before_deduction REAL,
  user_home_gps_used TEXT
);

-- Add production trip type validation
ALTER TABLE trip_requests ADD CONSTRAINT valid_trip_type_check 
CHECK (trip_type = ANY (ARRAY['Ticket'::trip_type, 'Planned'::trip_type, 'Urgent'::trip_type]));

-- Admin requests table (exact production schema)
CREATE TABLE admin_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_path TEXT,
  status request_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT NOW(),
  finance_approved BOOLEAN,
  request_type TEXT NOT NULL,
  requested_amount REAL,
  target_type TEXT,
  target_id INTEGER,
  rejection_reason TEXT,
  notified BOOLEAN DEFAULT false,
  status_history JSONB DEFAULT '[]',
  last_updated_by INTEGER REFERENCES users(id),
  last_updated_at TIMESTAMP,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP,
  paid_by INTEGER REFERENCES users(id),
  trip_request_id INTEGER REFERENCES trip_requests(id)
);

-- Add production admin request validation
ALTER TABLE admin_requests ADD CONSTRAINT valid_amount_or_trip_or_discrepancy 
CHECK (((requested_amount IS NOT NULL) AND (requested_amount >= 0)) OR (trip_request_id IS NOT NULL) OR (request_type = 'trip-payment-discrepancy'));

-- Workflow steps table (exact production schema)
CREATE TABLE workflow_steps (
  id SERIAL PRIMARY KEY,
  trip_request_id INTEGER NOT NULL REFERENCES trip_requests(id),
  step_order INTEGER NOT NULL,
  step_type workflow_step_type NOT NULL,
  approver_id INTEGER REFERENCES users(id),
  approver_name TEXT,
  status workflow_step_status NOT NULL DEFAULT 'Pending',
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id),
  rejection_reason TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit logs table (exact production schema)
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  details JSON,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Distances table (exact production schema)
CREATE TABLE distances (
  id SERIAL PRIMARY KEY,
  from_site_id INTEGER NOT NULL REFERENCES sites(id),
  to_site_id INTEGER NOT NULL REFERENCES sites(id),
  route_type CHARACTER VARYING(20) NOT NULL DEFAULT 'fastest',
  driving_distance NUMERIC NOT NULL,
  estimated_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add unique constraint for distances
ALTER TABLE distances ADD CONSTRAINT distances_from_site_id_to_site_id_route_type_key 
UNIQUE (from_site_id, to_site_id, route_type);

-- Insert sample distances
INSERT INTO distances (from_site_id, to_site_id, driving_distance, route_type, estimated_time) VALUES 
(1, 2, 85.3, 'fastest', 90), (1, 3, 25.7, 'fastest', 35), (1, 4, 335.2, 'fastest', 240),
(1, 5, 45.8, 'fastest', 55), (1, 6, 240.5, 'fastest', 180), (1, 7, 55.2, 'fastest', 65),
(1, 8, 35.4, 'fastest', 45), (2, 1, 85.3, 'fastest', 90), (2, 3, 90.5, 'fastest', 95),
(2, 4, 420.8, 'fastest', 280), (2, 5, 125.6, 'fastest', 120), (2, 6, 310.2, 'fastest', 220),
(2, 7, 85.7, 'fastest', 90), (2, 8, 115.8, 'fastest', 105), (3, 1, 25.7, 'fastest', 35),
(3, 2, 90.5, 'fastest', 95), (3, 4, 355.8, 'fastest', 250), (3, 5, 65.2, 'fastest', 70),
(3, 6, 260.7, 'fastest', 190), (3, 7, 45.8, 'fastest', 50), (3, 8, 55.6, 'fastest', 60),
(4, 5, 290.4, 'fastest', 210), (5, 6, 195.3, 'fastest', 145), (6, 7, 285.7, 'fastest', 200), (7, 8, 65.8, 'fastest', 75);

-- System settings table (exact production schema)
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  setting_key TEXT NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER REFERENCES users(id)
);

-- Add unique constraint for system settings
ALTER TABLE system_settings ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);

-- Insert system settings
INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES 
('maxKilometers', '75', 'Maximum kilometers allowed without requiring attachments', 1),
('home_deduction_enabled', 'true', 'Enable/disable home trip deduction feature', 1),
('home_deduction_km', '15', 'Amount in kilometers to deduct from home trips per company policy', 1),
('home_deduction_min_distance', '0', 'Minimum trip distance required to apply home deduction', 1),
('migration_department_enhancement', '2025-07-01 00:00:00+00', 'Added third manager, monthly budget bonus, and parent department fields', 1);

-- Session table (exact production schema)
CREATE TABLE session (
  sid VARCHAR NOT NULL,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL,
  PRIMARY KEY (sid)
);

-- Create all production indexes (exact match)
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_departments_manager_id ON departments(manager_id);
CREATE INDEX idx_departments_second_manager_id ON departments(second_manager_id);
CREATE INDEX idx_departments_parent ON departments(parent_department_id);
CREATE INDEX idx_projects_manager_id ON projects(manager_id);
CREATE INDEX idx_projects_second_manager_id ON projects(second_manager_id);
CREATE INDEX idx_trip_requests_user_id ON trip_requests(user_id);
CREATE INDEX idx_trip_requests_status ON trip_requests(status);
CREATE INDEX idx_trip_requests_project_id ON trip_requests(project_id);
CREATE INDEX idx_trip_requests_department_id ON trip_requests(department_id);
CREATE INDEX idx_trip_requests_trip_date ON trip_requests(trip_date);
CREATE INDEX idx_trip_requests_created_at ON trip_requests(created_at);
CREATE INDEX idx_trip_requests_km_rate_id ON trip_requests(km_rate_id);
CREATE INDEX idx_trip_requests_status_dept ON trip_requests(status, department_id);
CREATE INDEX idx_trip_requests_status_project ON trip_requests(status, project_id);
CREATE INDEX idx_trip_requests_user_status ON trip_requests(user_id, status);
CREATE INDEX idx_admin_requests_user_id ON admin_requests(user_id);
CREATE INDEX idx_admin_requests_trip_request_id ON admin_requests(trip_request_id);
CREATE INDEX idx_workflow_steps_trip_request_id ON workflow_steps(trip_request_id);
CREATE INDEX idx_workflow_steps_status ON workflow_steps(status);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_project_assignments_user_id ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_project_id ON project_assignments(project_id);
CREATE INDEX "IDX_session_expire" ON session(expire);

-- Create PostgreSQL functions (production requirements)
CREATE OR REPLACE FUNCTION check_and_deactivate_expired_projects()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    UPDATE projects 
    SET is_active = false
    WHERE expiry_date < CURRENT_DATE 
    AND is_active = true;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_project_expiry_date_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
        IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
            NEW.is_active := false;
        ELSIF OLD.is_active = false AND NEW.expiry_date >= CURRENT_DATE THEN
            NEW.is_active := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (exact production match)
CREATE TRIGGER project_expiry_date_trigger
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION handle_project_expiry_date_change();

-- Add all production constraints
ALTER TABLE trip_requests ADD CONSTRAINT positive_cost CHECK (cost >= 0);
ALTER TABLE trip_requests ADD CONSTRAINT positive_kilometers CHECK (kilometers IS NULL OR kilometers >= 0);
ALTER TABLE departments ADD CONSTRAINT positive_budget CHECK (budget >= 0);
ALTER TABLE projects ADD CONSTRAINT positive_project_budget CHECK (budget >= 0);
ALTER TABLE km_rates ADD CONSTRAINT valid_date_range CHECK (effective_to IS NULL OR effective_to >= effective_from);

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Insert audit log entry
INSERT INTO audit_logs (user_id, action, details) VALUES 
(1, 'Database Initialization', '{"message": "Database initialized with complete production schema including all constraints", "timestamp": "2025-07-01T13:00:00Z"}');

\echo '======================================================================='
\echo 'Database setup completed successfully!'
\echo '======================================================================='

-- Verification queries
SELECT 'Tables created: ' || COUNT(*) AS table_count FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT 'Enums created: ' || COUNT(*) AS enum_count FROM pg_type 
WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

SELECT 'Constraints: ' || COUNT(*) AS constraint_count FROM information_schema.table_constraints
WHERE table_schema = 'public' AND constraint_type IN ('CHECK', 'UNIQUE', 'FOREIGN KEY');

-- Data verification
SELECT 
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM departments) AS departments,
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM sites) AS sites,
  (SELECT COUNT(*) FROM system_settings) AS settings;

\echo ''
\echo 'Login Credentials:'
\echo '-----------------'
\echo 'Username: admin'
\echo 'Password: admin123'
\echo ''
\echo 'Complete production-identical database ready!'
\echo '======================================================================='