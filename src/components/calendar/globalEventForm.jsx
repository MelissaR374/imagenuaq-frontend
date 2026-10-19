// The form for a global event, the kind everyone sees: a festivo or a general announcement, on one
// day or several, at a time or all day, once, every year or on some weekdays (RF-CAL-02). The end day
// is the last day it covers, as people say it; the server keeps the next midnight.
import { useState } from "react";

import { RULE_DAYS, addDays, isoDay, parseDay } from "./calendarText.js";

/** The form's fields for an existing event, read from its series rather than from the clicked occurrence. */
function initialFields(event) {
  if (event === null) {
    const today = isoDay(new Date());
    return {
      title: "", type: "festivo", allDay: true, startDay: today, endDay: today,
      startTime: "09:00", endTime: "10:00", repeat: "none", weekdays: [], untilDay: "",
    };
  }
  const start = new Date(event.seriesStartsAt ?? event.startsAt);
  const end = new Date(event.seriesEndsAt ?? event.endsAt);
  const rule = event.rule ?? "";
  const time = (date) => date.toTimeString().slice(0, 5);
  return {
    title: event.title,
    type: event.type,
    allDay: event.allDay,
    startDay: isoDay(start),
    endDay: isoDay(event.allDay ? new Date(end.getTime() - 1) : end),
    startTime: time(start),
    endTime: time(end),
    repeat: rule.startsWith("FREQ=YEARLY") ? "yearly" : rule.startsWith("FREQ=WEEKLY") ? "weekly" : "none",
    weekdays: (rule.match(/BYDAY=([A-Z,]+)/)?.[1] ?? "").split(",").filter(Boolean),
    untilDay: event.until ? isoDay(new Date(event.until)) : "",
  };
}

/**
 * @param {{ event: object | null, busy: boolean, error: string | null,
 *   onSave: (body: object) => void, onDelete?: (() => void) | null, onCancel: () => void }} props
 */
function GlobalEventForm({ event, busy, error, onSave, onDelete = null, onCancel }) {
  const [fields, setFields] = useState(() => initialFields(event));

  function write(key, value) {
    setFields({ ...fields, [key]: value });
  }

  function toggleDay(code) {
    write("weekdays", fields.weekdays.includes(code) ? fields.weekdays.filter((day) => day !== code) : [...fields.weekdays, code]);
  }

  function submit(formEvent) {
    formEvent.preventDefault();
    const startsAt = fields.allDay ? parseDay(fields.startDay) : new Date(`${fields.startDay}T${fields.startTime}`);
    const endsAt = fields.allDay
      ? parseDay(addDays(fields.endDay, 1))
      : new Date(`${fields.endDay}T${fields.endTime}`);
    const weekdays = RULE_DAYS.map((day) => day.code).filter((code) => fields.weekdays.includes(code));
    let rule = null;
    if (fields.repeat === "yearly") rule = "FREQ=YEARLY";
    if (fields.repeat === "weekly") {
      rule = `FREQ=WEEKLY;BYDAY=${(weekdays.length > 0 ? weekdays : [RULE_DAYS[(startsAt.getDay() + 6) % 7].code]).join(",")}`;
    }
    onSave({
      type: fields.type,
      title: fields.title,
      allDay: fields.allDay,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      rule,
      until: rule !== null && fields.untilDay !== "" ? new Date(`${fields.untilDay}T23:59:59`).toISOString() : null,
    });
  }

  return (
    <form className="calendar-form" onSubmit={submit}>
      <h3>{event === null ? "Nuevo evento" : "Editar evento"}</h3>
      <p className="calendar-form-note">Lo ven todas las áreas.</p>

      <label className="calendar-field">
        <span>Título</span>
        <input value={fields.title} required maxLength={300} onChange={(e) => write("title", e.target.value)} />
      </label>

      <label className="calendar-field">
        <span>Tipo</span>
        <select value={fields.type} onChange={(e) => write("type", e.target.value)}>
          <option value="festivo">Día no laborable</option>
          <option value="general">Evento general</option>
        </select>
      </label>

      <label className="calendar-check">
        <input type="checkbox" checked={fields.allDay} onChange={(e) => write("allDay", e.target.checked)} />
        Todo el día
      </label>

      <div className="calendar-form-row">
        <label className="calendar-field">
          <span>Desde</span>
          <input type="date" value={fields.startDay} required onChange={(e) => write("startDay", e.target.value)} />
        </label>
        {fields.allDay ? null : (
          <label className="calendar-field">
            <span>Hora</span>
            <input type="time" value={fields.startTime} required onChange={(e) => write("startTime", e.target.value)} />
          </label>
        )}
        <label className="calendar-field">
          <span>Hasta</span>
          <input type="date" value={fields.endDay} min={fields.startDay} required onChange={(e) => write("endDay", e.target.value)} />
        </label>
        {fields.allDay ? null : (
          <label className="calendar-field">
            <span>Hora</span>
            <input type="time" value={fields.endTime} required onChange={(e) => write("endTime", e.target.value)} />
          </label>
        )}
      </div>

      <label className="calendar-field">
        <span>Se repite</span>
        <select value={fields.repeat} onChange={(e) => write("repeat", e.target.value)}>
          <option value="none">No se repite</option>
          <option value="yearly">Cada año</option>
          <option value="weekly">Cada semana</option>
        </select>
      </label>

      {fields.repeat === "weekly" ? (
        <fieldset className="calendar-weekdays">
          <legend>Los días</legend>
          {RULE_DAYS.map((day) => (
            <label className="calendar-check" key={day.code}>
              <input type="checkbox" checked={fields.weekdays.includes(day.code)} onChange={() => toggleDay(day.code)} />
              {day.label}
            </label>
          ))}
        </fieldset>
      ) : null}

      {fields.repeat === "none" ? null : (
        <label className="calendar-field">
          <span>Hasta el (opcional)</span>
          <input type="date" value={fields.untilDay} min={fields.startDay} onChange={(e) => write("untilDay", e.target.value)} />
        </label>
      )}

      {error === null ? null : <p className="calendar-error">{error}</p>}

      <div className="calendar-form-actions">
        {onDelete === null ? null : (
          <button className="calendar-btn is-danger" type="button" disabled={busy} onClick={onDelete}>
            Eliminar
          </button>
        )}
        <button className="calendar-btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="calendar-btn is-primary" type="submit" disabled={busy}>
          Guardar
        </button>
      </div>
    </form>
  );
}

export default GlobalEventForm;
