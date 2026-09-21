ALTER TABLE "Invoice"
  ADD COLUMN "writtenOffAmount" DECIMAL(12,3) NOT NULL DEFAULT 0;

WITH write_off_totals AS (
  SELECT
    debt."invoiceId" AS "invoiceId",
    SUM(payment."amount")::DECIMAL(12,3) AS amount
  FROM "DebtPayment" AS payment
  INNER JOIN "CustomerDebt" AS debt ON debt.id = payment."debtId"
  WHERE payment.method = 'WRITE_OFF'
  GROUP BY debt."invoiceId"
)
UPDATE "Invoice" AS invoice
SET
  "writtenOffAmount" = totals.amount,
  "paidAmount" = GREATEST(invoice."paidAmount" - totals.amount, 0)
FROM write_off_totals AS totals
WHERE invoice.id = totals."invoiceId";
