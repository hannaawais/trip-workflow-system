-- Project Expiration Automation System
-- This migration creates automatic triggers for project expiration

-- Function to automatically deactivate expired projects
CREATE OR REPLACE FUNCTION check_and_deactivate_expired_projects()
RETURNS void AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- Update expired projects to inactive status
    UPDATE projects 
    SET is_active = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE expiry_date < CURRENT_DATE 
    AND is_active = true;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log the action if any projects were deactivated
    IF expired_count > 0 THEN
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (
            1, -- System user
            'SYSTEM_PROJECT_EXPIRATION',
            json_build_object(
                'expired_projects_count', expired_count,
                'action_type', 'automatic_deactivation',
                'timestamp', CURRENT_TIMESTAMP
            )
        );
        
        RAISE NOTICE 'Automatically deactivated % expired project(s)', expired_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check project expiration before trip request creation
CREATE OR REPLACE FUNCTION validate_project_not_expired()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the project is expired
    IF NEW.project_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM projects 
            WHERE id = NEW.project_id 
            AND expiry_date < CURRENT_DATE
        ) THEN
            RAISE EXCEPTION 'Cannot create trip request for expired project. Project ID: %', NEW.project_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent trip requests for expired projects
DROP TRIGGER IF EXISTS prevent_expired_project_trips ON trip_requests;
CREATE TRIGGER prevent_expired_project_trips
    BEFORE INSERT OR UPDATE ON trip_requests
    FOR EACH ROW
    EXECUTE FUNCTION validate_project_not_expired();

-- Function to automatically update project status on expiry date change
CREATE OR REPLACE FUNCTION handle_project_expiry_date_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If expiry date is being set to past, automatically deactivate
    IF NEW.expiry_date IS NOT NULL AND NEW.expiry_date < CURRENT_DATE THEN
        NEW.is_active = false;
        
        -- Log the automatic deactivation
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (
            COALESCE(NEW.updated_by, 1),
            'PROJECT_AUTO_DEACTIVATED_ON_EXPIRY',
            json_build_object(
                'project_id', NEW.id,
                'project_name', NEW.name,
                'expiry_date', NEW.expiry_date,
                'reason', 'expiry_date_in_past'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for project expiry date changes
DROP TRIGGER IF EXISTS project_expiry_date_trigger ON projects;
CREATE TRIGGER project_expiry_date_trigger
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION handle_project_expiry_date_change();

-- Add updated_at and updated_by columns to projects if they don't exist
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- Create index for efficient expiry date queries
CREATE INDEX IF NOT EXISTS idx_projects_expiry_date ON projects(expiry_date) WHERE is_active = true;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_and_deactivate_expired_projects() TO PUBLIC;
GRANT EXECUTE ON FUNCTION validate_project_not_expired() TO PUBLIC;
GRANT EXECUTE ON FUNCTION handle_project_expiry_date_change() TO PUBLIC;