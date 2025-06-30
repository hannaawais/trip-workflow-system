-- Migration script to update the database schema for single source of truth

-- First, add the new columns to the trip_requests table
ALTER TABLE trip_requests 
  ADD COLUMN IF NOT EXISTS km_rate REAL,
  ADD COLUMN IF NOT EXISTS cost_method TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cost_updated_by INTEGER REFERENCES users(id);

-- Make kilometers column nullable (it was non-nullable before)
ALTER TABLE trip_requests 
  ALTER COLUMN kilometers DROP NOT NULL;

-- Add tripRequestId column to admin_requests table
ALTER TABLE admin_requests
  ADD COLUMN IF NOT EXISTS trip_request_id INTEGER REFERENCES trip_requests(id);

-- Update trip_requests to set cost_method based on costCalculatedFromKm
UPDATE trip_requests
SET cost_method = CASE 
  WHEN cost_calculated_from_km = true THEN 'km'
  ELSE 'direct'
END
WHERE cost_method IS NULL;

-- These statements will run data migration to consolidate costs

-- 1. For admin requests that should reference a trip, link them
-- Example (adjust based on your actual data)
-- UPDATE admin_requests a
-- SET trip_request_id = (
--   SELECT t.id FROM trip_requests t 
--   WHERE t.user_id = a.user_id 
--   AND t.trip_date::date = a.created_at::date
--   LIMIT 1
-- )
-- WHERE a.trip_request_id IS NULL 
-- AND a.request_type = 'trip_payment';