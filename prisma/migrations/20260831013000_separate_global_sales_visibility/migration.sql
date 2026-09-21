UPDATE "User"
SET "hasGlobalAccess" = false
WHERE "role" NOT IN ('ADMIN', 'GENERAL_MANAGER')
  AND "allowGlobalSalesView" = true
  AND "hasGlobalAccess" = true;
