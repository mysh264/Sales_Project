import type { ProductPriceBand } from "@/lib/product-pricing";

export type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  address: string;
  vatNumber: string;
};

export type ProductOption = {
  id: string;
  name: string;
  cylinderSize: string;
  pressure: string | null;
  prices: Record<string, ProductPriceBand>;
};

export type ProductRow = {
  id: string;
  productId: string;
  full: string;
  empty: string;
  price: string;
};

export type CustomerDraft = {
  name: string;
  phone: string;
  address: string;
  vatNumber: string;
};

export type SavedInvoiceData = {
  submissionToken: string;
  customerQuery: string;
  selectedCustomerId: string | null;
  customerDraft: CustomerDraft;
  showAdvanced: boolean;
  manualSerialValue: string;
  currency: string;
  taxRate: string;
  cashAmount: string;
  checkAmount: string;
  checkNumber: string;
  checkDate: string;
  transferAmount: string;
  transferReference: string;
  debtCollectionAmount: string;
  applyDebtCollection: boolean;
  useCheck: boolean;
  useTransfer: boolean;
  productRows: ProductRow[];
};

export type NewInvoiceFormProps = {
  salesmanName: string;
  branchName: string;
  defaultCurrency: string;
  defaultTaxRate: string;
  invoiceSerial: string;
  action: (formData: FormData) => Promise<void>;
  customers: CustomerOption[];
  products: ProductOption[];
  customerDebtBalances: Record<string, Record<string, string>>;
  customerCreditBalances: Record<string, string>;
  searchCustomersAction?: (query: string) => Promise<
    Array<{
      id: string;
      name: string;
      phone: string;
      address: string;
      vatNumber: string;
    }>
  >;
  errorMessage?: string;
  initialCustomerId?: string;
};

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatOmr(value: number, currencyCode = "OMR") {
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export function percentRate(value: string) {
  return toNumber(value) / 100;
}

export function fieldClass(value: string, extra = "") {
  return ["ui-input", value.trim() ? "border-emerald-300 bg-emerald-50/60" : "", extra].filter(Boolean).join(" ");
}

export const STORAGE_KEY = "newInvoiceData";
