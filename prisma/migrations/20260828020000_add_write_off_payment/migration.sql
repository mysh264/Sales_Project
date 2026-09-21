-- Add WRITE_OFF to the PaymentMethod enum so debt write-offs are recorded in the DebtPayment ledger
-- (distinct from cash collection, which uses method CASH).

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WRITE_OFF';
