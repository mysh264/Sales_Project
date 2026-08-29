-- Backfill operations previously shipped as one-off .sql scripts (update_tax_rate.sql,
-- update_admin_role.sql). Folding them into a proper migration makes the data changes
-- reproducible and removes the orphaned scripts that compose copied into the image but
-- never executed.

-- Ensure the Suhar main branch tax rate is set to 5%.
UPDATE "Branch"
SET "defaultTaxRate" = 5.0000
WHERE "code" = 'SUHAR_MAIN'
  AND "defaultTaxRate" IS DISTINCT FROM 5.0000;

-- Ensure the bootstrap admin account exists with the ADMIN role. The actual record is
-- created by the seed; this guards the role field in case it was ever changed.
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" = 'admin@mahmoudbox.com'
  AND "role" <> 'ADMIN';
