-- Fix discount_codes table schema to use customer_name as primary identifier
-- First, we need to handle existing data where customer_email might be populated but customer_name might be null

-- Update existing records to populate customer_name from orders table where possible
UPDATE discount_codes dc
JOIN orders o ON dc.customer_email = o.customer_email
SET dc.customer_name = o.customer_name
WHERE dc.customer_name IS NULL OR dc.customer_name = '';

-- Make customer_name NOT NULL (this will fail if there are still records with null customer_name)
ALTER TABLE discount_codes MODIFY COLUMN customer_name varchar(100) NOT NULL;

-- Make customer_email nullable
ALTER TABLE discount_codes MODIFY COLUMN customer_email varchar(150);