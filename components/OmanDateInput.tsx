"use client";

import { useEffect, useState } from "react";
import { formatIsoDateDMY, parseDmyDateToIso } from "@/lib/date-format";

type OmanDateInputProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  required?: boolean;
  id?: string;
};

export function OmanDateInput({
  name,
  value,
  defaultValue = "",
  onValueChange,
  className,
  required,
  id,
}: OmanDateInputProps) {
  const initialIsoValue = value ?? defaultValue;
  const [displayValue, setDisplayValue] = useState(formatIsoDateDMY(initialIsoValue));
  const [isoValue, setIsoValue] = useState(initialIsoValue);

  useEffect(() => {
    if (value === undefined) return;
    setIsoValue(value);
    setDisplayValue(formatIsoDateDMY(value));
  }, [value]);

  return (
    <>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        aria-label="Date in DD/MM/YYYY format"
        value={displayValue}
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        title="Enter the date as DD/MM/YYYY"
        className={className}
        onChange={(event) => {
          const nextDisplayValue = event.target.value;
          const nextIsoValue = parseDmyDateToIso(nextDisplayValue);
          setDisplayValue(nextDisplayValue);
          setIsoValue(nextIsoValue);
          if (nextIsoValue || nextDisplayValue === "") {
            onValueChange?.(nextIsoValue);
          }
        }}
      />
      {name ? <input type="hidden" name={name} value={isoValue} /> : null}
    </>
  );
}
