// The semester closure windows (RF-CAL-03): the weeks in which the financial system is closed and
// costed projects are not carried out. Coordination enters them here; the calendar marks those days
// and the costed projects that fall in them, without blocking anything.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { dayDate } from "../shared/format.js";

const EMPTY = { id: null, name: "", startsOn: "", endsOn: "" };

/**
 * @param {{ onChanged: () => void, onClose: () => void }} props
 */
function Closures({ onChanged, onClose }) {
  const [closures, setClosures] = useState(null);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .listClosures()
      .then((data) => {
        if (!cancelled) setClosures(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: draft.name, startsOn: draft.startsOn, endsOn: draft.endsOn };
      if (draft.id === null) await api.createClosure(body);
      else await api.updateClosure(draft.id, body);
      setDraft(EMPTY);
      setReload(reload + 1);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(closure) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteClosure(closure.id);
      if (draft.id === closure.id) setDraft(EMPTY);
      setReload(reload + 1);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="calendar-closures">
      <header className="calendar-closures-head">
        <h3>Ventanas de cierre de semestre</h3>
        <button className="calendar-btn" type="button" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <p className="calendar-form-note">
        Mientras dure una ventana no se ejecutan proyectos con costo. Los que caen en ella se marcan; no se bloquean.
      </p>

      {closures === null ? (
        <p className="calendar-note">Cargando…</p>
      ) : closures.length === 0 ? (
        <p className="calendar-note">Todavía no hay ventanas registradas.</p>
      ) : (
        <ul className="calendar-closure-list">
          {closures.map((closure) => (
            <li className="calendar-closure" key={closure.id}>
              <strong>{closure.name}</strong>
              <span>
                {dayDate(closure.startsOn)} — {dayDate(closure.endsOn)}
              </span>
              <button className="calendar-btn" type="button" disabled={busy} onClick={() => setDraft(closure)}>
                Editar
              </button>
              <button className="calendar-btn is-danger" type="button" disabled={busy} onClick={() => remove(closure)}>
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="calendar-form" onSubmit={save}>
        <h4>{draft.id === null ? "Nueva ventana" : `Editar «${draft.name}»`}</h4>
        <div className="calendar-form-row">
          <label className="calendar-field">
            <span>Nombre</span>
            <input
              value={draft.name}
              required
              maxLength={200}
              placeholder="Ej: Cierre 2026-2"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="calendar-field">
            <span>Desde</span>
            <input type="date" value={draft.startsOn} required onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} />
          </label>
          <label className="calendar-field">
            <span>Hasta</span>
            <input
              type="date"
              value={draft.endsOn}
              min={draft.startsOn}
              required
              onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })}
            />
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

export default Closures;
