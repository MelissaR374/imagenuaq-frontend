// The form for booking a vehicle to deliver or pick up material (RF-CAL-04). It asks for the vehicle,
// the purpose, the day and hours, the destination and an optional project. The server refuses a
// booking that overlaps another of the same vehicle, and the form shows its reason.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { VEHICLE_KINDS, isoDay } from "../calendar/calendarText.js";
import "./vehicleBookings.css";

/** The form's fields for a booking as `/api/vehicles/bookings` returns it, or for a new one on `day`. */
function initialFields(booking, day) {
  if (booking === null) {
    return {
      vehicleId: "", kind: "delivery", day: day ?? isoDay(new Date()),
      startTime: "09:00", endTime: "11:00", destination: "", projectId: "", notes: "",
    };
  }
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const time = (date) => date.toTimeString().slice(0, 5);
  return {
    vehicleId: String(booking.vehicleId),
    kind: booking.kind,
    day: isoDay(start),
    startTime: time(start),
    endTime: time(end),
    destination: booking.destination,
    projectId: booking.projectId === null ? "" : String(booking.projectId),
    notes: booking.notes ?? "",
  };
}

/**
 * @param {{ booking: object | null, day?: string | null, busy: boolean, error: string | null,
 *   onSave: (body: object) => void, onDelete?: (() => void) | null, onCancel: () => void }} props
 */
function VehicleBookingForm({ booking, day = null, busy, error, onSave, onDelete = null, onCancel }) {
  const [fields, setFields] = useState(() => initialFields(booking, day));
  const [vehicles, setVehicles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectQuery, setProjectQuery] = useState(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listVehicles()
      .then((data) => {
        if (!cancelled) setVehicles(data.vehicles);
      })
      .catch(() => {});
    api
      .listProjects()
      .then((data) => {
        if (!cancelled) setProjects(data.projects ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function write(key, value) {
    setFields({ ...fields, [key]: value });
  }

  function submit(formEvent) {
    formEvent.preventDefault();
    onSave({
      vehicleId: Number(fields.vehicleId),
      kind: fields.kind,
      destination: fields.destination,
      projectId: fields.projectId === "" ? null : Number(fields.projectId),
      notes: fields.notes === "" ? null : fields.notes,
      startsAt: new Date(`${fields.day}T${fields.startTime}`).toISOString(),
      endsAt: new Date(`${fields.day}T${fields.endTime}`).toISOString(),
    });
  }

  /** Sets or clears the project and leaves the search, showing the chosen one's name. */
  function pickProject(project) {
    write("projectId", project === null ? "" : String(project.id));
    setProjectQuery(null);
    setProjectOpen(false);
  }

  /** Leaving the search keeps the chosen project. Emptying the text clears it. */
  function leaveProject() {
    if (projectQuery === "") write("projectId", "");
    setProjectQuery(null);
    setProjectOpen(false);
  }

  /** Arrows move through the matches, Enter picks one, Escape closes the list. */
  function projectKey(keyEvent) {
    if (keyEvent.key === "ArrowDown" || keyEvent.key === "ArrowUp") {
      keyEvent.preventDefault();
      setProjectOpen(true);
      const step = keyEvent.key === "ArrowDown" ? 1 : -1;
      setActive(Math.min(Math.max(active + step, 0), Math.max(matches.length - 1, 0)));
    } else if (keyEvent.key === "Enter" && listOpen) {
      keyEvent.preventDefault();
      if (matches.length > 0) pickProject(matches[active]);
    } else if (keyEvent.key === "Escape" && projectOpen) {
      keyEvent.preventDefault();
      setProjectQuery(null);
      setProjectOpen(false);
    }
  }

  const choices = vehicles.filter((vehicle) => vehicle.isActive || String(vehicle.id) === fields.vehicleId);
  const selected = projects.find((project) => String(project.id) === fields.projectId);
  const selectedLabel = selected ? `${selected.key} · ${selected.title}` : fields.projectId === "" ? "" : (booking?.projectKey ?? "");
  const query = (projectQuery ?? "").trim().toLowerCase();
  const matches = projects
    .filter(
      (project) =>
        query === "" ||
        (project.key ?? "").toLowerCase().includes(query) ||
        project.title.toLowerCase().includes(query) ||
        (project.requester ?? "").toLowerCase().includes(query),
    )
    .slice(0, 12);
  const listOpen = projectOpen && projects.length > 0;

  return (
    <form className="calendar-form vehicle-booking-form" onSubmit={submit}>
      <h3>{booking === null ? "Reservar vehículo" : "Editar reserva"}</h3>
      <p className="calendar-form-note">Todas las áreas ven cuándo está ocupado el vehículo.</p>

      <div className="calendar-form-row">
        <label className="calendar-field">
          <span>Vehículo</span>
          <select value={fields.vehicleId} required onChange={(e) => write("vehicleId", e.target.value)}>
            <option value="">Elige uno</option>
            {choices.map((vehicle) => (
              <option value={vehicle.id} key={vehicle.id}>
                {vehicle.plate ? `${vehicle.name} (${vehicle.plate})` : vehicle.name}
              </option>
            ))}
          </select>
        </label>
        <label className="calendar-field">
          <span>Para</span>
          <select value={fields.kind} onChange={(e) => write("kind", e.target.value)}>
            {Object.entries(VEHICLE_KINDS).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="calendar-form-row">
        <label className="calendar-field">
          <span>Día</span>
          <input type="date" value={fields.day} required onChange={(e) => write("day", e.target.value)} />
        </label>
        <label className="calendar-field">
          <span>Sale</span>
          <input type="time" value={fields.startTime} required onChange={(e) => write("startTime", e.target.value)} />
        </label>
        <label className="calendar-field">
          <span>Regresa</span>
          <input type="time" value={fields.endTime} required onChange={(e) => write("endTime", e.target.value)} />
        </label>
      </div>

      <label className="calendar-field">
        <span>Destino</span>
        <input value={fields.destination} required maxLength={300} onChange={(e) => write("destination", e.target.value)} />
      </label>

      <div className="calendar-field vehicle-project">
        <label htmlFor="vehicle-project-input">Proyecto (opcional)</label>
        <div className="vehicle-project-box">
          <input
            id="vehicle-project-input"
            className="vehicle-project-input"
            type="text"
            role="combobox"
            autoComplete="off"
            placeholder="Busca por clave, título o solicitante"
            aria-expanded={listOpen}
            aria-controls="vehicle-project-options"
            aria-activedescendant={listOpen && matches.length > 0 ? `vehicle-project-${matches[active].id}` : undefined}
            value={projectQuery ?? selectedLabel}
            onChange={(e) => {
              setProjectQuery(e.target.value);
              setProjectOpen(true);
              setActive(0);
            }}
            onFocus={() => setProjectOpen(true)}
            onBlur={leaveProject}
            onKeyDown={projectKey}
          />
          {fields.projectId === "" ? null : (
            <button
              className="vehicle-project-clear"
              type="button"
              aria-label="Quitar el proyecto"
              onClick={() => pickProject(null)}
            >
              ×
            </button>
          )}
        </div>
        {listOpen ? (
          <ul className="vehicle-project-options" id="vehicle-project-options" role="listbox">
            {matches.length === 0 ? (
              <li className="vehicle-project-none">Ningún proyecto coincide.</li>
            ) : (
              matches.map((project, index) => (
                <li
                  className={index === active ? "vehicle-project-option is-active" : "vehicle-project-option"}
                  id={`vehicle-project-${project.id}`}
                  role="option"
                  aria-selected={String(project.id) === fields.projectId}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickProject(project)}
                  onMouseEnter={() => setActive(index)}
                  key={project.id}
                >
                  <strong className="vehicle-project-key">{project.key}</strong>
                  <span className="vehicle-project-title">{project.title}</span>
                  {project.requester ? <span className="vehicle-project-requester">{project.requester}</span> : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <label className="calendar-field">
        <span>Notas (opcional)</span>
        <textarea value={fields.notes} maxLength={2000} onChange={(e) => write("notes", e.target.value)} />
      </label>

      {error === null ? null : <p className="calendar-error">{error}</p>}

      <div className="calendar-form-actions">
        {onDelete === null ? null : (
          <button className="calendar-btn is-danger" type="button" disabled={busy} onClick={onDelete}>
            Cancelar reserva
          </button>
        )}
        <button className="calendar-btn" type="button" onClick={onCancel}>
          Volver
        </button>
        <button className="calendar-btn is-primary" type="submit" disabled={busy}>
          Guardar
        </button>
      </div>
    </form>
  );
}

export default VehicleBookingForm;
