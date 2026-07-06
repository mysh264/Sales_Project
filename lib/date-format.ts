function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function toValidDate(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return date;
}

export function formatDateDMY(value: Date | string | number) {
  const date = toValidDate(value);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeDMY(value: Date | string | number) {
  const date = toValidDate(value);
  const dateText = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${dateText} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
