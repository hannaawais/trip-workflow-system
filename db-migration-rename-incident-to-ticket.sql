-- Phase 1: Safe migration from incident_no to ticket_no column
-- This migration adds the new ticket_no column and sets up synchronization
-- without disrupting any existing functionality

-- Step 1: Add new ticket_no column alongside existing incident_no
ALTER TABLE trip_requests 
ADD COLUMN ticket_no TEXT;

-- Step 2: Copy existing data from incident_no to ticket_no
UPDATE trip_requests 
SET ticket_no = incident_no 
WHERE incident_no IS NOT NULL;

-- Step 3: Create trigger to keep both columns synchronized during transition
CREATE OR REPLACE FUNCTION sync_ticket_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT: sync ticket_no to incident_no if only one is provided
    IF TG_OP = 'INSERT' THEN
        IF NEW.ticket_no IS NOT NULL AND NEW.incident_no IS NULL THEN
            NEW.incident_no = NEW.ticket_no;
        ELSIF NEW.incident_no IS NOT NULL AND NEW.ticket_no IS NULL THEN
            NEW.ticket_no = NEW.incident_no;
        END IF;
        RETURN NEW;
    END IF;
    
    -- On UPDATE: sync both directions
    IF TG_OP = 'UPDATE' THEN
        -- If ticket_no changed, update incident_no
        IF NEW.ticket_no IS DISTINCT FROM OLD.ticket_no THEN
            NEW.incident_no = NEW.ticket_no;
        -- If incident_no changed, update ticket_no  
        ELSIF NEW.incident_no IS DISTINCT FROM OLD.incident_no THEN
            NEW.ticket_no = NEW.incident_no;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger on trip_requests table
DROP TRIGGER IF EXISTS sync_ticket_columns_trigger ON trip_requests;
CREATE TRIGGER sync_ticket_columns_trigger
    BEFORE INSERT OR UPDATE ON trip_requests
    FOR EACH ROW
    EXECUTE FUNCTION sync_ticket_columns();

-- Step 5: Verify data consistency
DO $$
DECLARE
    inconsistent_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO inconsistent_count
    FROM trip_requests 
    WHERE COALESCE(ticket_no, '') != COALESCE(incident_no, '');
    
    IF inconsistent_count > 0 THEN
        RAISE NOTICE 'Found % inconsistent records between ticket_no and incident_no', inconsistent_count;
    ELSE
        RAISE NOTICE 'All records are synchronized between ticket_no and incident_no columns';
    END IF;
END $$;

-- Migration completed successfully
-- Phase 1 complete: Both columns exist and are synchronized
-- System can continue using incident_no while we prepare Phase 2 (schema updates)