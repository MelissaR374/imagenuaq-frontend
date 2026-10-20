// What the task screens share that is not a component: the week the load is counted over, its
// days, and how a stage's state reads.

/** How a stage's state reads beside it; the same words as the project detail. */
export const STAGE_STATUS_LABELS = {
  pending: "Pendiente",
  active: "Activa",
  waiting_external: "En espera",
  done: "Concluida",
  cancelled: "Cancelada",
};

/** Today and six days on, as YYYY-MM-DD: the week the load panel counts absences over. */
export function thisWeek() {
  const from = new Date();
  const to = new Date(from.getTime() + 6 * 86_400_000);
  return { from: localDate(from), to: localDate(to) };
}

/**
 * The seven days from `from` (YYYY-MM-DD), each with its date and the initial of its weekday.
 *
 * @returns {{ date: string, initial: string, label: string }[]}
 */
export function weekDays(from) {
  const [year, month, day] = from.split("-").map(Number);
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(year, month - 1, day + offset);
    return {
      date: localDate(date),
      initial: date.toLocaleDateString("es-MX", { weekday: "narrow" }).toUpperCase(),
      label: date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }),
    };
  });
}

function localDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
