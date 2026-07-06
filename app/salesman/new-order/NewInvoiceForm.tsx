"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  address: string;
  vatNumber: string;
};

type ProductOption = {
  id: string;
  name: string;
  cylinderSize: string;
  pressure: string | null;
  minPrice: string;
  maxPrice: string;
  defaultPrice: string;
};

type NewInvoiceFormProps = {
  salesmanName: string;
  branchName: string;
  defaultCurrency: string;
  defaultTaxRate: string;
  invoiceSerial: string;
  action: (formData: FormData) => Promise<void>;
  customers: CustomerOption[];
  products: ProductOption[];
};

type ProductRow = {
  id: string;
  productId: string;
  full: string;
  empty: string;
  price: string;
};

type CustomerDraft = {
  name: string;
  phone: string;
  address: string;
  vatNumber: string;
};

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatOmr(value: number) {
  return new Intl.NumberFormat("en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function fieldClass(value: string, extra = "") {
  return [
    "w-full rounded-xl border px-3 text-sm font-bold text-slate-900 outline-none transition-colors focus:border-slate-950",
    value.trim() ? "border-green-200 bg-green-50/70 shadow-sm" : "border-slate-300 bg-white",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function NewInvoiceForm({
  salesmanName,
  branchName,
  defaultCurrency,
  defaultTaxRate,
  invoiceSerial,
  action,
  customers,
  products,
}: NewInvoiceFormProps) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    name: "",
    phone: "",
    address: "",
    vatNumber: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [invoiceSerialValue, setInvoiceSerialValue] = useState(invoiceSerial);
  const [currency, setCurrency] = useState(defaultCurrency);
  const [taxRate, setTaxRate] = useState(defaultTaxRate);
  const [cashAmount, setCashAmount] = useState("");
  const [checkAmount, setCheckAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [useCheck, setUseCheck] = useState(false);
  const [useTransfer, setUseTransfer] = useState(false);
  const [productRows, setProductRows] = useState<ProductRow[]>(
    products.length > 0
      ? [
          {
            id: makeId(),
            productId: products[0].id,
            full: "",
            empty: "",
            price: products[0].defaultPrice,
          },
        ]
      : [
          {
            id: makeId(),
            productId: "",
            full: "",
            empty: "",
            price: "",
          },
        ],
  );

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();

    if (!query) {
      return customers.slice(0, 8);
    }

    return customers.filter((customer) => {
      const haystack = `${customer.name} ${customer.phone}`.toLowerCase();
      return haystack.includes(query);
    }).slice(0, 8);
  }, [customerQuery, customers]);

  function selectCustomer(customer: CustomerOption) {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setShowCustomerPicker(false);
    setCustomerDraft({
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      vatNumber: customer.vatNumber,
    });
  }

  function createCustomer() {
    setSelectedCustomer({
      id: "new",
      name: customerDraft.name || customerQuery || "New Customer",
      phone: customerDraft.phone,
      address: customerDraft.address,
      vatNumber: customerDraft.vatNumber,
    });
    setCustomerQuery(customerDraft.name || customerQuery);
    setShowCustomerModal(false);
    setShowCustomerPicker(false);
  }

  function updateRow(id: string, patch: Partial<ProductRow>) {
    setProductRows((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }

        const nextProductId = patch.productId ?? row.productId;
        const product = products.find((item) => item.id === nextProductId);

        return {
          ...row,
          ...patch,
          price: patch.productId && product ? product.defaultPrice : patch.price ?? row.price,
        };
      }),
    );
  }

  function addRow() {
    setProductRows((current) => [
      ...current,
      {
        id: makeId(),
        productId: products[0]?.id ?? "",
        full: "",
        empty: "",
        price: products[0]?.defaultPrice ?? "",
      },
    ]);
  }

  function removeRow(id: string) {
    setProductRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  const lineItems = useMemo(() => {
    return productRows.map((row) => {
      const product = products.find((item) => item.id === row.productId);
      const fullCount = toNumber(row.full);
      const emptyCount = toNumber(row.empty);
      const unitPrice = toNumber(row.price);
      const itemTotal = fullCount * unitPrice;

      return {
        ...row,
        product,
        fullCount,
        emptyCount,
        unitPrice,
        itemTotal,
      };
    });
  }, [productRows, products]);

  const itemsSubtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.itemTotal, 0), [lineItems]);
  const vatRateValue = useMemo(() => toNumber(taxRate), [taxRate]);
  const vatAmount = useMemo(() => itemsSubtotal * vatRateValue, [itemsSubtotal, vatRateValue]);
  const invoiceTotal = useMemo(() => itemsSubtotal + vatAmount, [itemsSubtotal, vatAmount]);
  const paidAmount = useMemo(
    () => toNumber(cashAmount) + (useCheck ? toNumber(checkAmount) : 0) + (useTransfer ? toNumber(transferAmount) : 0),
    [cashAmount, checkAmount, transferAmount, useCheck, useTransfer],
  );
  const remainingBalance = useMemo(() => Math.max(invoiceTotal - paidAmount, 0), [invoiceTotal, paidAmount]);
  const balancePaidInFull = remainingBalance === 0 && invoiceTotal > 0;
  const hasDebt = remainingBalance > 0;

  const selectedCustomerName = selectedCustomer?.name || customerQuery;
  const selectedCustomerPhone = selectedCustomer?.phone || customerDraft.phone;
  const selectedCustomerAddress = selectedCustomer?.address || customerDraft.address;
  const selectedCustomerVat = selectedCustomer?.vatNumber || customerDraft.vatNumber;

  return (
    <form
      action={action}
      encType="multipart/form-data"
      className="mx-auto flex max-w-7xl flex-col gap-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]"
    >
      <input type="hidden" name="invoiceSerial" value={invoiceSerialValue} />
      <input type="hidden" name="customerId" value={selectedCustomer?.id === "new" ? "" : selectedCustomer?.id ?? ""} />
      <input type="hidden" name="customerName" value={selectedCustomerName} />
      <input type="hidden" name="customerPhone" value={selectedCustomerPhone} />
      <input type="hidden" name="customerAddress" value={selectedCustomerAddress} />
      <input type="hidden" name="customerVatNumber" value={selectedCustomerVat} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="taxRate" value={taxRate} />

      <header className="rounded-lg bg-ink p-5 text-white shadow-lg">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-300">{branchName}</p>
        <h1 className="mt-1 text-3xl font-black leading-tight">New Invoice</h1>
        <p className="mt-2 text-base font-semibold text-slate-200">Salesman: {salesmanName}</p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-950">Customer</p>
                <p className="text-sm font-bold text-slate-500">Search existing customer or create a new one.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCustomerDraft((current) => ({ ...current, name: current.name || customerQuery }));
                  setShowCustomerModal(true);
                }}
                className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
              >
                Add New Customer
              </button>
            </div>

            <div className="mt-4 relative">
                <input
                  type="text"
                  value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  setShowCustomerPicker(true);
                  setSelectedCustomer(null);
                }}
                onFocus={() => setShowCustomerPicker(true)}
                placeholder="Search by name or phone"
                  className="h-14 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-lg font-bold outline-none transition-colors focus:border-slate-950"
                />

              {showCustomerPicker ? (
                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <p className="font-black text-slate-950">{customer.name}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {customer.phone || "No phone"} {customer.vatNumber ? `· VAT ${customer.vatNumber}` : ""}
                      </p>
                    </button>
                  ))}

                  {filteredCustomers.length === 0 ? (
                    <div className="px-4 py-4">
                      <p className="text-sm font-bold text-slate-500">No matching customer found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerDraft((current) => ({ ...current, name: current.name || customerQuery }));
                          setShowCustomerModal(true);
                        }}
                        className="mt-3 rounded bg-green-700 px-4 py-2 text-sm font-black text-white"
                      >
                        Add New Customer
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="block">
                <span className="text-sm font-black text-slate-700">Address</span>
                <input
                  value={selectedCustomerAddress}
                  readOnly
                  className={`mt-2 h-12 ${fieldClass(selectedCustomerAddress)}`}
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">VAT Number</span>
                <input
                  value={selectedCustomerVat}
                  readOnly
                  className={`mt-2 h-12 ${fieldClass(selectedCustomerVat)}`}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-950">Invoice Settings</p>
                <p className="text-sm font-bold text-slate-500">Values are locked once the invoice is saved.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="rounded bg-slate-950 px-3 py-2 text-xs font-black text-white"
              >
                ⚙ Advanced Settings
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className="block">
                <span className="text-sm font-black text-slate-700">Invoice Serial</span>
                <input
                  value={invoiceSerialValue}
                  readOnly
                  className={`mt-2 h-12 ${fieldClass(invoiceSerialValue)}`}
                />
              </label>

              {showAdvanced ? (
                <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                  <label className="block">
                    <span className="text-sm font-black text-slate-700">Currency</span>
                    <select
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className={`mt-2 h-12 ${fieldClass(currency)}`}
                    >
                      <option value="OMR">OMR</option>
                      <option value="USD">USD</option>
                      <option value="AED">AED</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-black text-slate-700">VAT Rate</span>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      className={`mt-2 h-12 ${fieldClass(taxRate)}`}
                    />
                  </label>
                  <label className="block md:col-span-1">
                    <span className="text-sm font-black text-slate-700">Invoice Serial Override</span>
                    <input
                      type="text"
                      value={invoiceSerialValue}
                      onChange={(event) => setInvoiceSerialValue(event.target.value)}
                      className={`mt-2 h-12 ${fieldClass(invoiceSerialValue)}`}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </section>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-black text-slate-950">Product Selection</p>
              <p className="text-sm font-bold text-slate-500">Add only the cylinders used on this invoice.</p>
            </div>
          </div>

          <div className="mt-4 hidden grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,1fr))_auto] gap-3 rounded-xl bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 md:grid">
            <div>Product</div>
            <div className="text-center">Full</div>
            <div className="text-center">Empty</div>
            <div className="text-center">Unit Price</div>
            <div className="text-right">Total</div>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {productRows.map((row, index) => (
              <article
                key={row.id}
                className={`rounded-xl border p-4 shadow-sm transition-colors ${
                  row.productId || row.full || row.empty || row.price ? "border-green-200 bg-green-50/30" : "border-slate-200 bg-white"
                }`}
              >
                <input type="hidden" name="rowProductId" value={row.productId} />
                <input type="hidden" name="rowFull" value={row.full} />
                <input type="hidden" name="rowEmpty" value={row.empty} />
                <input type="hidden" name="rowPrice" value={row.price} />

                <div className="grid grid-cols-1 gap-4">
                  <label className="block">
                    <span className="text-sm font-black text-slate-700">Product Name</span>
                    <select
                      value={row.productId}
                      onChange={(event) => updateRow(row.id, { productId: event.target.value })}
                      className={`mt-2 h-12 ${fieldClass(row.productId)}`}
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} {product.cylinderSize}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 md:hidden">Full Cylinders Delivered</span>
                      <input
                        type="number"
                        min="0"
                        value={row.full}
                        onChange={(event) => updateRow(row.id, { full: event.target.value })}
                        className={`mt-2 h-14 text-center text-2xl ${fieldClass(row.full)}`}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 md:hidden">Empty Cylinders Collected</span>
                      <input
                        type="number"
                        min="0"
                        value={row.empty}
                        onChange={(event) => updateRow(row.id, { empty: event.target.value })}
                        className={`mt-2 h-14 text-center text-2xl ${fieldClass(row.empty)}`}
                      />
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 md:hidden">Unit Price</span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={row.price}
                        onChange={(event) => updateRow(row.id, { price: event.target.value })}
                        className={`mt-2 h-14 text-center text-2xl ${fieldClass(row.price)}`}
                      />
                    </label>

                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 md:min-h-14 md:self-end">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 md:hidden">Item Total</p>
                        <p className="text-xs font-bold text-slate-500">Row Total</p>
                      </div>
                      <p className="text-2xl font-black text-slate-950">{formatOmr(lineItems[index]?.itemTotal ?? 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-500">
                    Default range: {products.find((product) => product.id === row.productId)?.minPrice ?? "0.000"} -{" "}
                    {products.find((product) => product.id === row.productId)?.maxPrice ?? "0.000"} OMR
                  </p>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-xl bg-green-700 px-4 py-4 text-base font-black text-white shadow-sm md:w-auto md:min-w-56"
            >
              Add Item
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Items Subtotal</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{formatOmr(itemsSubtotal)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">VAT</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{formatOmr(vatAmount)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Invoice Total</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{formatOmr(invoiceTotal)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-lg font-black text-slate-950">Payment</p>
            <p className="text-sm font-bold text-slate-500">Cash is primary. Check and transfer details are optional.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <label className="block">
            <span className="text-sm font-black text-slate-700">Cash Amount</span>
            <input
              name="cashAmount"
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              placeholder="0.000"
              value={cashAmount}
              onChange={(event) => setCashAmount(event.target.value)}
              className={`mt-2 h-16 text-2xl ${fieldClass(cashAmount)}`}
            />
          </label>

          <div
            className={`rounded-xl border px-4 py-4 text-center text-2xl font-black ${
              balancePaidInFull ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wide opacity-80">Remaining Balance</p>
            <p className="mt-2 text-4xl font-black">{formatOmr(remainingBalance)}</p>
            <p className="mt-2 text-sm font-bold">
              {balancePaidInFull ? "Paid in full" : "Balance still due"}
            </p>
          </div>

          {hasDebt ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-red-700">
              <p className="text-sm font-black uppercase tracking-wide">Debt Warning</p>
              <p className="mt-2 text-lg font-black leading-tight md:text-xl">
                Warning: Payment is incomplete. {formatOmr(remainingBalance)} will be recorded as Customer Debt.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useCheck}
                onChange={(event) => setUseCheck(event.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-sm font-black text-slate-800">Use Check Payment</span>
            </label>

            {useCheck ? (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Check Amount</span>
                  <input
                    name="checkAmount"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={checkAmount}
                    onChange={(event) => setCheckAmount(event.target.value)}
                    className={`mt-2 h-14 text-xl ${fieldClass(checkAmount)}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Check Number</span>
                  <input
                    name="checkNumber"
                    type="text"
                    placeholder="Check number"
                    className={`mt-2 h-12 ${fieldClass("")}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Check Date</span>
                  <input
                    name="checkDate"
                    type="date"
                    className={`mt-2 h-12 ${fieldClass("")}`}
                  />
                </label>
              </div>
            ) : (
              <input type="hidden" name="checkAmount" value="0" />
            )}

            <label className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                checked={useTransfer}
                onChange={(event) => setUseTransfer(event.target.checked)}
                className="h-5 w-5"
              />
              <span className="text-sm font-black text-slate-800">Use Bank Transfer</span>
            </label>

            {useTransfer ? (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Transfer Amount</span>
                  <input
                    name="bankTransferAmount"
                    type="number"
                    min="0"
                    step="0.001"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    className={`mt-2 h-14 text-xl ${fieldClass(transferAmount)}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Transfer Reference</span>
                  <input
                    name="transferReference"
                    type="text"
                    placeholder="Receipt or bank reference"
                    className={`mt-2 h-14 ${fieldClass("")}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Transfer Receipt Image</span>
                  <input
                    name="transferReceipt"
                    type="file"
                    accept="image/*"
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-700"
                  />
                </label>
              </div>
            ) : (
              <input type="hidden" name="bankTransferAmount" value="0" />
            )}
          </div>
        </div>
      </section>

      <section className="pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="submit"
            className="h-16 w-full rounded-xl bg-success px-4 text-xl font-black text-white shadow-sm active:scale-[0.99]"
          >
            {hasDebt ? "Save & Record Debt" : "Save Invoice & Print"}
          </button>
          <Link
            href="/salesman"
            className="flex h-16 w-full items-center justify-center rounded-xl bg-red-700 px-4 text-xl font-black text-white shadow-sm"
          >
            Cancel / Back to Dashboard
          </Link>
        </div>
      </section>

      {showCustomerModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-950">Add New Customer</p>
                <p className="text-sm font-bold text-slate-500">Enter the minimum customer details.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="rounded bg-slate-200 px-3 py-2 text-xs font-black text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="block">
                <span className="text-sm font-black text-slate-700">Name</span>
                <input
                  value={customerDraft.name}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Phone</span>
                <input
                  value={customerDraft.phone}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, phone: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">Address</span>
                <textarea
                  value={customerDraft.address}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, address: event.target.value }))}
                  className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-black text-slate-700">VAT Number</span>
                <input
                  value={customerDraft.vatNumber}
                  onChange={(event) => setCustomerDraft((current) => ({ ...current, vatNumber: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-300 px-3 text-sm font-bold"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={createCustomer}
                className="flex-1 rounded bg-green-700 px-4 py-3 text-sm font-black text-white"
              >
                Save Customer
              </button>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="rounded bg-slate-200 px-4 py-3 text-sm font-black text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
