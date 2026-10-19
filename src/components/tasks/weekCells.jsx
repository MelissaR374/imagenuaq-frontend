// The week as seven cells with the days a person is away shaded. It says when, never why
// (RF-TSK-07): the server does not send the reason.
import { weekDays } from "./taskText.js";

/**
 * @param {{ from: string, awayDates: string[] }} props `from` is the window's first day.
 */
function WeekCells({ from, awayDates }) {
  const away = new Set(awayDates);
  return (
    <span className="tasks-week">
      {weekDays(from).map((day) => (
        <span
          className={away.has(day.date) ? "tasks-day is-away" : "tasks-day"}
          title={away.has(day.date) ? `Fuera el ${day.label}` : day.label}
          key={day.date}
        >
          {day.initial}
        </span>
      ))}
    </span>
  );
}

export default WeekCells;
