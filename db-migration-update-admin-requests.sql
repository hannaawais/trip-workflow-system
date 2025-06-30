-- Migration script to update admin_requests with trip_request_id references
-- This ensures complete source of truth relationship between admin requests and trip requests

-- First, identify admin requests that should be linked to trip requests (those related to trip payments)
-- Update admin requests that have a matching trip request from the same user on the same date
UPDATE admin_requests a
SET trip_request_id = (
  SELECT t.id FROM trip_requests t 
  WHERE t.user_id = a.user_id 
  AND DATE(t.created_at) = DATE(a.created_at)
  AND a.trip_request_id IS NULL
  AND a.request_type ILIKE '%trip%'
  ORDER BY t.id DESC
  LIMIT 1
)
WHERE a.trip_request_id IS NULL 
AND a.request_type ILIKE '%trip%';

-- For requests where we can't find an exact date match, try to find a trip request 
-- from the same user within 3 days (some might be submitted shortly after the trip)
UPDATE admin_requests a
SET trip_request_id = (
  SELECT t.id FROM trip_requests t 
  WHERE t.user_id = a.user_id 
  AND t.created_at BETWEEN a.created_at - INTERVAL '3 days' AND a.created_at + INTERVAL '3 days'
  AND a.trip_request_id IS NULL
  AND a.request_type ILIKE '%trip%'
  ORDER BY t.created_at DESC
  LIMIT 1
)
WHERE a.trip_request_id IS NULL 
AND a.request_type ILIKE '%trip%';

-- For remaining unmatched trip-related admin requests, 
-- explicitly link them based on the requested_amount matching the trip cost
UPDATE admin_requests a
SET trip_request_id = (
  SELECT t.id FROM trip_requests t 
  WHERE t.user_id = a.user_id 
  AND ABS(t.cost - a.requested_amount) < 0.01  -- Match if costs are the same (within rounding error)
  AND a.trip_request_id IS NULL
  AND a.request_type ILIKE '%trip%'
  ORDER BY t.created_at DESC
  LIMIT 1
)
WHERE a.trip_request_id IS NULL 
AND a.request_type ILIKE '%trip%'
AND a.requested_amount IS NOT NULL;

-- Add statement to log completion
SELECT 'Admin request migration complete. Updated links between admin requests and trip requests.';