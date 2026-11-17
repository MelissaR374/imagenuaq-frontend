// What one event says inside its bar on the month: a project's due date, a stage with its person, an
// absence, a vehicle booking, a dated or timed institutional event, a closure window, or a note drawn as a post-it.
import { MdFlag, MdLocalShipping } from "react-icons/md";

import { VEHICLE_KINDS } from "./calendarText.js";

/**
 * @param {{ item: { kind: string, event?: object, closure?: object }, timeText?: string }} props
 */
function EventContent({ item, timeText = "" }) {
  const { kind, event, closure } = item;

  if (kind === "note") {
    return (
      <div className="calendar-postit" title={event.title}>
        <span className="calendar-postit-body">{event.title}</span>
        {event.noteScope === "personal" ? null : (
          <span className="calendar-postit-scope">{event.noteScope === "area" ? event.areaName : "Todos"}</span>
        )}
      </div>
    );
  }

  if (kind === "due") {
    return (
      <span className="calendar-ev-line" title={`Entrega de ${event.projectKey} ${event.projectTitle}`}>
        <MdFlag className="calendar-ev-flag" aria-hidden="true" />
        <span className="calendar-ev-title">{event.projectTitle}</span>
        <span className="calendar-ev-who">{event.projectKey}</span>
      </span>
    );
  }

  if (kind === "closure") {
    return <span className="calendar-ev-title">Cierre: {closure.name}</span>;
  }

  if (kind === "absence") {
    return (
      <span className="calendar-ev-title" title="Ausencia registrada">
        {event.userName ?? event.areaName ?? "Alguien"} · fuera
      </span>
    );
  }

  if (kind === "vehicle") {
    const what = VEHICLE_KINDS[event.bookingKind] ?? "";
    const hint = [event.vehicleName, what, event.destination, event.bookedByName];
    if (event.projectKey) hint.push(event.projectKey);
    return (
      <span className="calendar-ev-line" title={hint.join(" · ")}>
        <MdLocalShipping className="calendar-ev-flag" aria-hidden="true" />
        {timeText === "" ? null : <span className="calendar-ev-time">{timeText}</span>}
        <span className="calendar-ev-title">
          {event.vehicleName} · {what}
        </span>
        <span className="calendar-ev-who">{event.destination}</span>
      </span>
    );
  }

  if (kind === "stage") {
    const stageName = event.title.replace(`${event.projectKey} · `, "");
    const who = event.userName ?? "Sin responsable";
    const hint = [`${event.projectKey} ${event.projectTitle}`, stageName, who];
    if (event.inClosure) hint.push("Con costo, en ventana de cierre");
    return (
      <span className="calendar-ev-line" title={hint.join(" · ")}>
        <span className="calendar-ev-title">{stageName}</span>
        <span className="calendar-ev-who">{who}</span>
      </span>
    );
  }

  return (
    <span className="calendar-ev-line" title={event.title}>
      {timeText === "" ? null : <span className="calendar-ev-time">{timeText}</span>}
      <span className="calendar-ev-title">{event.title}</span>
    </span>
  );
}

export default EventContent;
