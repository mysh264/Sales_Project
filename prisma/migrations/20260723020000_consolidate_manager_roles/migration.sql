DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = '"UserRole"'::regtype
      AND enumlabel IN ('ACCOUNTANT', 'ACCOUNTANT_MANAGER')
  ) THEN
    UPDATE "User"
    SET
      "role" = 'MANAGER',
      "customRoleId" = (SELECT "id" FROM "Role" WHERE "name" = 'MANAGER' LIMIT 1),
      "sessionVersion" = "sessionVersion" + 1
    WHERE "role"::text IN ('ACCOUNTANT', 'ACCOUNTANT_MANAGER');

    UPDATE "User"
    SET
      "customRoleId" = (SELECT "id" FROM "Role" WHERE "name" = 'MANAGER' LIMIT 1),
      "sessionVersion" = "sessionVersion" + 1
    WHERE "customRoleId" IN (
      SELECT "id" FROM "Role" WHERE "name" IN ('ACCOUNTANT', 'ACCOUNTANT_MANAGER')
    )
      AND "role"::text NOT IN ('ACCOUNTANT', 'ACCOUNTANT_MANAGER');

    DELETE FROM "Role" WHERE "name" IN ('ACCOUNTANT', 'ACCOUNTANT_MANAGER');

    ALTER TYPE "UserRole" RENAME TO "UserRole_old";
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'LOADER', 'SALESMAN');
    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "UserRole"
      USING ("role"::text::"UserRole");
    DROP TYPE "UserRole_old";
  END IF;
END
$$;
