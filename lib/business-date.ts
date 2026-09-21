const BUSINESS_TIME_ZONE = "Asia/Muscat";
const MUSCAT_OFFSET_MS = 4 * 60 * 60 * 1000;

function muscatParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function businessDate(date = new Date()) {
  const { year, month, day } = muscatParts(date);
  return new Date(Date.UTC(year, month - 1, day));
}

export function businessDayRange(date = new Date()) {
  const { year, month, day } = muscatParts(date);
  const start = new Date(Date.UTC(year, month - 1, day) - MUSCAT_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
