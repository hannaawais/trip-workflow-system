-- WORKFLOW CORRUPTION CLEANUP SCRIPT
-- This script fixes workflow steps that were approved out of sequence
-- due to the previous isRequired-based status determination bug

-- BEFORE RUNNING: Backup the workflow_steps table
-- CREATE TABLE workflow_steps_backup AS SELECT * FROM workflow_steps;

BEGIN;

-- Step 1: Identify all corrupted workflows
CREATE TEMP TABLE corrupted_workflows AS
WITH workflow_violations AS (
  SELECT 
    ws.trip_request_id,
    MIN(CASE WHEN ws.status = 'Pending' THEN ws.step_order END) as first_pending_step,
    MIN(CASE WHEN ws.status = 'Approved' THEN ws.step_order END) as first_approved_step,
    tr.status as trip_status
  FROM workflow_steps ws
  JOIN trip_requests tr ON tr.id = ws.trip_request_id
  GROUP BY ws.trip_request_id, tr.status
)
SELECT 
  trip_request_id,
  first_pending_step,
  first_approved_step,
  trip_status
FROM workflow_violations
WHERE first_approved_step < first_pending_step;

-- Step 2: Reset corrupted workflow steps to pending status
UPDATE workflow_steps 
SET 
  status = 'Pending',
  approved_at = NULL
WHERE trip_request_id IN (SELECT trip_request_id FROM corrupted_workflows)
  AND status = 'Approved';

-- Step 3: Update trip statuses back to first workflow step
UPDATE trip_requests 
SET status = 'Pending Department Approval'
WHERE id IN (SELECT trip_request_id FROM corrupted_workflows);

-- Step 4: Clear status history for corrupted trips (will be rebuilt on re-approval)
UPDATE trip_requests 
SET status_history = '[]'::jsonb
WHERE id IN (SELECT trip_request_id FROM corrupted_workflows);

-- Step 5: Log the cleanup action
INSERT INTO audit_logs (user_id, action, details)
VALUES (
  1, -- System user
  'WORKFLOW_CORRUPTION_CLEANUP',
  jsonb_build_object(
    'corrupted_trips', (SELECT array_agg(trip_request_id) FROM corrupted_workflows),
    'total_affected', (SELECT count(*) FROM corrupted_workflows),
    'cleanup_timestamp', NOW()
  )
);

-- Display summary of changes
SELECT 
  'Workflow Corruption Cleanup Summary' as summary_type,
  count(*) as total_trips_affected,
  array_agg(trip_request_id) as affected_trip_ids
FROM corrupted_workflows;

COMMIT;

-- VERIFICATION QUERY (run after cleanup):
-- SELECT ws.trip_request_id, ws.step_order, ws.step_type, ws.status 
-- FROM workflow_steps ws 
-- WHERE ws.trip_request_id IN (120, 121, 122, 123, 124, 125, 126)
-- ORDER BY ws.trip_request_id, ws.step_order;