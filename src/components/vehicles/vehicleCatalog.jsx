// The vehicles coordination books for deliveries and pickups (RF-CAL-04). Whoever holds
// `vehicle.manage` adds, renames and retires them here. A retired vehicle keeps its bookings and
// takes no new ones.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";

const EMPTY = { id: null, name: "", plate: "" };

/**
 * @param {{ onChanged: () => void, onClose: () => void }} props
 */
function VehicleCatalog({ onChanged, onClose }) {
  const [vehicles, setVehicles] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listVehicles()
      .then((data) => {
        if (!cancelled) setVehicles(data.vehicles);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  /** Runs a write, then reloads the list and the calendar. */
  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReload(reload + 1);
      onChanged();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    const body = { name: draft.name, plate: draft.plate };
    const saved = await run(() => (draft.id === null ? api.createVehicle(body) : api.updateVehicle(draft.id, body)));
    if (saved) setDraft(EMPTY);
  }

  return (
    <section className="vehicle-catalog">
      <header className="vehicle-catalog-head">
        <h3>Catálogo de vehículos</h3>
        <button className="calendar-btn" type="button" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <p className="vehicle-catalog-note">Los vehículos que se reservan para entregar y recoger material.</p>

      {vehicles === null ? (
        <p className="vehicle-catalog-note">Cargando…</p>
      ) : vehicles.length === 0 ? (
        <p className="vehicle-catalog-note">Todavía no hay vehículos registrados.</p>
      ) : (
        <ul className="vehicle-catalog-list">
          {vehicles.map((vehicle) => (
            <li className={vehicle.isActive ? "vehicle-catalog-item" : "vehicle-catalog-item is-off"} key={vehicle.id}>
              <strong className="vehicle-catalog-name">{vehicle.name}</strong>
              <span className="vehicle-catalog-plate">{vehicle.plate ?? "Sin placas"}{vehicle.isActive ? "" : " · De baja"}</span>
              <button
                className="calendar-btn"
                type="button"
                disabled={busy}
                onClick={() => setDraft({ id: vehicle.id, name: vehicle.name, plate: vehicle.plate ?? "" })}
              >
                Editar
              </button>
              <button
                className="calendar-btn"
                type="button"
                disabled={busy}
                onClick={() => run(() => api.updateVehicle(vehicle.id, { isActive: !vehicle.isActive }))}
              >
                {vehicle.isActive ? "Dar de baja" : "Reactivar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="calendar-form vehicle-catalog-form" onSubmit={save}>
        <h4>{draft.id === null ? "Nuevo vehículo" : `Editar «${draft.name}»`}</h4>
        <div className="calendar-form-row">
          <label className="calendar-field">
            <span>Nombre</span>
            <input
              value={draft.name}
              required
              maxLength={100}
              placeholder="Ej: Camioneta blanca"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="calendar-field">
            <span>Placas (opcional)</span>
            <input value={draft.plate} maxLength={20} onChange={(e) => setDraft({ ...draft, plate: e.target.value })} />
          </label>
        </div>
        {error === null ? null : <p className="calendar-error">{error}</p>}
        <div className="calendar-form-actions">
          {draft.id === null ? null : (
            <button className="calendar-btn" type="button" onClick={() => setDraft(EMPTY)}>
              Cancelar
            </button>
          )}
          <button className="calendar-btn is-primary" type="submit" disabled={busy}>
            Guardar
          </button>
        </div>
      </form>
    </section>
  );
}

export default VehicleCatalog;
