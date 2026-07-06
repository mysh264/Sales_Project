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
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatDateTimeDMY(value: Date | string | number) {
  const date = toValidDate(value);
  return `${formatDateDMY(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

