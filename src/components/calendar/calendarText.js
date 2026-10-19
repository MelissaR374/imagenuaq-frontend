// What the calendar screens share: the layers, the note scopes and the day arithmetic. Days are the
// browser's local days, which for this coordination are Querétaro's, as the server cuts them.

/** The layers a viewer can switch off, keyed by the `kind` they show; they double as the legend. */
export const LAYERS = [
  { kind: "due", label: "Entregas" },
  { kind: "stage", label: "Etapas" },
  { kind: "absence", label: "Ausencias" },
  { kind: "global", label: "Institucionales" },
  { kind: "note", label: "Notas" },
  { kind: "closure", label: "Cierre de semestre" },
];

export const NOTE_SCOPES = {
  personal: "Solo yo",
  area: "Mi área",
  global: "Todos",
};

export const RULE_DAYS = [
  { code: "MO", label: "L" },
  { code: "TU", label: "M" },
  { code: "WE", label: "M" },
  { code: "TH", label: "J" },
  { code: "FR", label: "V" },
  { code: "SA", label: "S" },
  { code: "SU", label: "D" },
];

/** A local day as YYYY-MM-DD. */
export function isoDay(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The local day a YYYY-MM-DD names, at midnight. */
export function parseDay(text) {
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** The YYYY-MM-DD `days` after `text`. */
export function addDays(text, days) {
  const date = parseDay(text);
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** Whole days from one YYYY-MM-DD to another; negative when `to` comes first. */
export function daysApart(from, to) {
  return Math.round((parseDay(to) - parseDay(from)) / 86_400_000);
}
