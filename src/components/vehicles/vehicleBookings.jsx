// «Vehículos» (RF-CAL-04): the bookings of the next weeks for delivering and picking up material,
// grouped by day. It also holds the button to book one and, for `vehicle.manage`, the catalog. Each
// booking also shows in the calendar. Only whoever booked it, or coordination, edits or cancels it.
import { useEffect, useState } from "react";
import { MdAdd, MdEdit, MdSettings } from "react-icons/md";

import * as api from "../../api/client.js";
import { VEHICLE_KINDS, addDays, isoDay } from "../calendar/calendarText.js";
import { dayDate } from "../shared/format.js";
import VehicleBookingForm from "./vehicleBookingForm.jsx";
import VehicleCatalog from "./vehicleCatalog.jsx";
import "../calendar/calendar.css";
import "./vehicleBookings.css";

/** How far ahead the list reads. The server allows at most 92 days per read. */
const DAYS_AHEAD = 90;

/** A time of day as HH:MM, in the browser's zone. */
function clock(value) {
  return new Date(value).toTimeString().slice(0, 5);
}

/** The bookings in runs of one local day each, in the order they come. */
function byDay(bookings) {
  const days = [];
  for (const booking of bookings) {
    const day = isoDay(new Date(booking.startsAt));
    if (days.length === 0 || days[days.length - 1].day !== day) days.push({ day, bookings: [] });
    days[days.length - 1].bookings.push(booking);
  }
  return days;
}

/**
 * @param {{ isAdmin: boolean, userId: number, canBook: boolean, canManage: boolean }} props
 */
function VehicleBookings({ isAdmin, userId, canBook, canManage }) {
  const [bookings, setBookings] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const from = isoDay(new Date());
    Promise.all([api.listVehicleBookings({ from, to: addDays(from, DAYS_AHEAD), vehicleId }), api.listVehicles()])
      .then(([bookingData, vehicleData]) => {
        if (cancelled) return;
        setBookings(bookingData.bookings);
        setVehicles(vehicleData.vehicles);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, reload]);

  function closeForm() {
    setEditing(null);
    setFormError(null);
  }

  /** Runs a write from the form, then closes it and reloads the list. */
  async function write(action) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      closeForm();
      setReload(reload + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const creating = editing !== null && editing.booking === null;
  const chips = [{ id: "", name: "Todos" }, ...vehicles.filter((vehicle) => vehicle.isActive)];

  return (
    <section className="vehicles">
      <header className="vehicles-header">
        <nav className="vehicles-filters" aria-label="Filtrar por vehículo">
          {chips.map((vehicle) => (
            <button
              className={String(vehicle.id) === vehicleId ? "vehicles-chip is-active" : "vehicles-chip"}
              type="button"
              aria-pressed={String(vehicle.id) === vehicleId}
              title={vehicle.plate ?? undefined}
              onClick={() => setVehicleId(String(vehicle.id))}
              key={vehicle.id}
            >
              {vehicle.name}
            </button>
          ))}
        </nav>
        <div className="vehicles-actions">
          {canManage ? (
            <button
              className={showCatalog ? "vehicles-btn is-active" : "vehicles-btn"}
              type="button"
              aria-pressed={showCatalog}
              onClick={() => setShowCatalog(!showCatalog)}
            >
              <MdSettings aria-hidden="true" /> Administrar vehículos
            </button>
          ) : null}
          {canBook ? (
            <button className="vehicles-btn is-primary" type="button" onClick={() => setEditing({ booking: null })}>
              <MdAdd aria-hidden="true" /> Reservar vehículo
            </button>
          ) : null}
        </div>
      </header>

      {showCatalog && canManage ? (
        <VehicleCatalog onChanged={() => setReload(reload + 1)} onClose={() => setShowCatalog(false)} />
      ) : null}

      {error === null ? null : <p className="vehicles-error">{error}</p>}

      {bookings === null ? (
        <p className="vehicles-empty">Cargando…</p>
      ) : bookings.length === 0 ? (
        <div className="vehicles-empty">
          <p>No hay reservas en los próximos {DAYS_AHEAD} días.</p>
          {vehicles.length === 0 && canManage ? <p>Primero da de alta un vehículo en «Administrar vehículos».</p> : null}
        </div>
      ) : (
        <div className="vehicles-agenda">
          {byDay(bookings).map((group) => (
            <section className="vehicles-day" key={group.day}>
              <h3 className="vehicles-day-title">{dayDate(group.day)}</h3>
              <ul className="vehicles-day-list">
                {group.bookings.map((booking) => (
                  <li className="vehicles-booking" key={booking.id}>
                    <span className="vehicles-booking-time">
                      {clock(booking.startsAt)}
                      <span className="vehicles-booking-until">{clock(booking.endsAt)}</span>
                    </span>
                    <span className={`vehicles-kind is-${booking.kind}`}>{VEHICLE_KINDS[booking.kind]}</span>
                    <div className="vehicles-booking-main">
                      <strong className="vehicles-booking-destination">{booking.destination}</strong>
                      <span className="vehicles-booking-meta">
                        {[booking.vehicleName, booking.projectKey, `Reservó ${booking.bookedByName}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {isAdmin || String(booking.bookedBy) === String(userId) ? (
                      <button
                        className="vehicles-btn is-quiet"
                        type="button"
                        aria-label={`Editar la reserva a ${booking.destination}`}
                        onClick={() => setEditing({ booking })}
                      >
                        <MdEdit aria-hidden="true" /> Editar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing === null ? null : (
        <div className="calendar-overlay" role="presentation" onClick={closeForm}>
          <div className="calendar-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <VehicleBookingForm
              booking={editing.booking}
              busy={busy}
              error={formError}
              onSave={(body) =>
                write(() =>
                  creating ? api.createVehicleBooking(body) : api.updateVehicleBooking(editing.booking.id, body),
                )
              }
              onDelete={creating ? null : () => write(() => api.deleteVehicleBooking(editing.booking.id))}
              onCancel={closeForm}
              key={editing.booking?.id ?? "new"}
            />
          </div>
        </div>
      )}
    </section>
  );
}

export default VehicleBookings;
