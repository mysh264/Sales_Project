"use client";

import { useEffect } from "react";

export function ClearNewInvoiceStorage() {
  useEffect(() => {
    window.localStorage.removeItem("newInvoiceData");
  }, []);

  return null;
}
