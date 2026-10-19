// Text formats several screens share.

/** An em dash when there is no value, so an empty cell does not read as an error. */
export function orDash(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return value;
}

/** The date without its time, in the local format. */
export function shortDate(value) {
  return new Date(value).toLocaleDateString();
}

/** Excel's column letter for a zero-based index: 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index) {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/** The initials of a full name, for the small round mark that stands in for a photo. */
export function initials(fullName) {
  return fullName
    .split(" ")
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** A byte count as B, KB, MB or GB, one decimal past bytes. */
export function fileSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`;
}

/** Whole days between two moments, at least one: how long a stage took (RF-PRY-04). */
export function daysBetween(from, to) {
  return Math.max(1, Math.round((new Date(to) - new Date(from)) / 86_400_000));
}

