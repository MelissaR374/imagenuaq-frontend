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
