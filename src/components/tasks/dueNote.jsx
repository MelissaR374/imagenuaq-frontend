// A due date as what is left of it ("en 9 d", "hoy", "vencido hace 2 d"), the way «Proyectos»
// reads its Entrega column.
import { dayDate, daysUntil } from "../shared/format.js";

/**
 * @param {{ dueOn: string | null }} props
 */
function DueNote({ dueOn }) {
  if (dueOn === null || dueOn === undefined) return <span className="tasks-none">Sin fecha</span>;

  const days = daysUntil(dueOn);
  let left = `en ${days} d`;
  if (days === 0) left = "hoy";
  if (days < 0) left = `vencido hace ${-days} d`;

  return (
    <span className={days < 0 ? "tasks-due is-late" : "tasks-due"} title={dayDate(dueOn)}>
      {left}
    </span>
  );
}

export default DueNote;
