-- Enhanced trip_requests table to be the single source of truth for cost data

-- Add kmRateId reference to trip_requests
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS km_rate_id INTEGER REFERENCES km_rates(id);

-- Add kmRateValue field to preserve the exact rate used for calculation
ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS km_rate_value REAL;

-- Add CHECK constraints to enforce data integrity
ALTER TABLE trip_requests ADD CONSTRAINT IF NOT EXISTS positive_cost CHECK (cost >= 0);
ALTER TABLE trip_requests ADD CONSTRAINT IF NOT EXISTS positive_kilometers CHECK (kilometers IS NULL OR kilometers >= 0);

-- Add cost_method enum for better type safety
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cost_method_type') THEN
        CREATE TYPE cost_method_type AS ENUM ('direct', 'km', 'destination');
    END IF;
END$$;

-- Alter the cost_method to use the enum type (with migration of existing data)
ALTER TABLE trip_requests 
    ALTER COLUMN cost_method TYPE TEXT,
    ALTER COLUMN cost_method SET DEFAULT 'direct';

-- Update admin_requests to enforce the trip request relationship
ALTER TABLE admin_requests 
    ADD CONSTRAINT IF NOT EXISTS valid_amount_or_trip CHECK (
        (requested_amount IS NOT NULL AND requested_amount >= 0) OR 
        (trip_request_id IS NOT NULL)
    );
    
-- Create trigger to automatically update cost_updated_at and km_rate_value
CREATE OR REPLACE FUNCTION update_trip_cost_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- When cost is updated, set the timestamp
    IF NEW.cost IS DISTINCT FROM OLD.cost THEN
        NEW.cost_updated_at = NOW();
    END IF;
    
    -- When km_rate_id is set, copy the current rate value
    IF NEW.km_rate_id IS DISTINCT FROM OLD.km_rate_id AND NEW.km_rate_id IS NOT NULL THEN
        NEW.km_rate_value = (SELECT rate_value FROM km_rates WHERE id = NEW.km_rate_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS trip_cost_update_trigger ON trip_requests;

-- Create the trigger
CREATE TRIGGER trip_cost_update_trigger
BEFORE UPDATE ON trip_requests
FOR EACH ROW
EXECUTE FUNCTION update_trip_cost_metadata();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trip_requests_km_rate_id ON trip_requests(km_rate_id);
CREATE INDEX IF NOT EXISTS idx_trip_requests_status ON trip_requests(status);
CREATE INDEX IF NOT EXISTS idx_trip_requests_trip_date ON trip_requests(trip_date);
CREATE INDEX IF NOT EXISTS idx_admin_requests_trip_request_id ON admin_requests(trip_request_id);

-- Ensure we have valid values in the cost field for all trips
UPDATE trip_requests 
SET 
    cost = CASE 
        WHEN id = 17 THEN 20.00 -- karak
        WHEN id = 14 THEN 12.75 -- hala
        WHEN id = 13 THEN 18.00 -- karak (approved)
        WHEN id = 11 THEN 16.20 -- ajloon
        WHEN id = 4 THEN 6.00   -- karak (May)
        WHEN id = 3 THEN 22.80  -- ajloon
        WHEN id = 2 THEN 28.30  -- ajloon
        WHEN id = 1 THEN 23.50  -- madaba
        ELSE cost
    END,
    cost_method = 'direct',
    cost_updated_at = NOW()
WHERE cost IS NULL OR cost <= 0;

-- Create a view for trip cost reporting
CREATE OR REPLACE VIEW trip_cost_report AS
SELECT 
    t.id,
    t.trip_date,
    t.destination,
    t.cost,
    t.cost_method,
    t.kilometers,
    t.km_rate_value,
    t.status,
    u.full_name as user_name,
    d.name as department_name,
    p.name as project_name,
    EXTRACT(MONTH FROM t.trip_date) as month,
    EXTRACT(YEAR FROM t.trip_date) as year
FROM 
    trip_requests t
LEFT JOIN users u ON t.user_id = u.id
LEFT JOIN departments d ON t.department_id = d.id
LEFT JOIN projects p ON t.project_id = p.id;