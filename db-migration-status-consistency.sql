-- Migration to ensure consistent usage of specific status values in trip_requests
-- This script converts 'Pending' status values to specific workflow status values
-- based on the approval flags and request types

-- First, update department requests that are pending department approval
UPDATE trip_requests
SET status = 'Pending Department Approval'
WHERE 
  status = 'Pending' 
  AND department_id IS NOT NULL 
  AND department_manager_approved IS NOT TRUE;

-- Next, update project requests that are pending project approval
-- (department approval already completed)
UPDATE trip_requests
SET status = 'Pending Project Approval'
WHERE 
  status = 'Pending' 
  AND project_id IS NOT NULL 
  AND department_manager_approved IS TRUE
  AND department_second_approved IS TRUE
  AND project_manager_approved IS NOT TRUE;

-- Finally, update requests that are pending finance approval
-- (all previous approvals completed)
UPDATE trip_requests
SET status = 'Pending Finance Approval'
WHERE 
  status = 'Pending' 
  AND (
    -- Department requests with department approval complete
    (department_id IS NOT NULL AND department_manager_approved IS TRUE AND department_second_approved IS TRUE AND project_id IS NULL)
    OR
    -- Project requests with both department and project approval complete
    (project_id IS NOT NULL AND department_manager_approved IS TRUE AND department_second_approved IS TRUE AND project_manager_approved IS TRUE)
  );

-- Log the migration for audit purposes
INSERT INTO audit_logs (action, details, user_id, timestamp)
VALUES (
  'Database Migration', 
  'Updated trip request status values for consistency', 
  (SELECT id FROM users WHERE role = 'Admin' LIMIT 1), 
  NOW()
);