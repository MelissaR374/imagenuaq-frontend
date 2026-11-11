// Absence type catalogue (RF-AUS-03). Coordination manages absence types without a deploy:
// code, label, unit, whether it consumes a balance, whether it requires a backing document.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import Help from "../shared/help.jsx";

import "./absenceTypes.css";

const LABEL_MAX = 200;
const CODE_MAX = 50;
const CODE_FORMAT = /^[a-z][a-z0-9_]*$/;
const UNITS = [
  { value: "day", label: "Día" },
  { value: "hour", label: "Hora" },
];

/**
 * @param {{ code: string, label: string, unit: string, consumesBalance: boolean, requiresDocument: boolean }} draft
 */
function validate(draft) {
  if (!draft.label.trim()) return "El nombre es obligatorio.";
  if (draft.label.length > LABEL_MAX) return `El nombre no puede exceder ${LABEL_MAX} caracteres.`;
  if (draft.code && !CODE_FORMAT.test(draft.code)) return "El código debe ser letras minúsculas, dígitos y guiones bajos.";
  if (draft.code && draft.code.length > CODE_MAX) return `El código no puede exceder ${CODE_MAX} caracteres.`;
  return null;
}

function AbsenceTypes() {
  const [types, setTypes] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.listAbsenceTypes()
      .then((data) => { if (!cancelled) { setTypes(data.types ?? []); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [version]);

  function startNew() {
    setEditing("new");
    setDraft({ code: "", label: "", unit: "day", consumesBalance: true, requiresDocument: false });
  }

  function startEdit(type) {
    setEditing(type.id);
    setDraft({
      label: type.label,
      unit: type.unit,
      consumesBalance: type.consumesBalance,
      requiresDocument: type.requiresDocument,
      isActive: type.isActive,
    });
  }

  function cancel() {
    setEditing(null);
    setDraft(null);
  }

  async function save() {
    const err = validate(draft);
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      if (editing === "new") {
        await api.createAbsenceType(draft);
      } else {
        await api.updateAbsenceType(editing, draft);
      }
      setEditing(null);
      setDraft(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id, isActive) {
    setSaving(true);
    setError(null);
    try {
      await api.updateAbsenceType(id, { isActive });
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const loading = types === null && error === null;
  const list = types ?? [];

  return (
    <section className="absence-types">
      <header className="absence-types-header">
        <h2>Tipos de ausencia</h2>
        <Help text="Los tipos de ausencia que pueden solicitarse: permisos, incapacidades, días institucionales, etc. Solo la coordinación los administra." />
        {editing === null && (
          <button className="btn btn-primary" type="button" onClick={startNew}>
            Nuevo tipo
          </button>
        )}
      </header>

      {error && <p className="absence-types-error">{error}</p>}
      {loading && <p className="absence-types-loading">Cargando…</p>}

      {editing !== null && draft !== null && (
        <div className="absence-types-form">
          {editing === "new" && (
            <label className="absence-types-field">
              <span>Código</span>
              <input
                type="text"
                value={draft.code}
                maxLength={CODE_MAX}
                placeholder="permiso_economico"
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </label>
          )}
          <label className="absence-types-field">
            <span>Nombre</span>
            <input
              type="text"
              value={draft.label}
              maxLength={LABEL_MAX}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          <label className="absence-types-field">
            <span>Unidad</span>
            <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </label>
          <label className="absence-types-check">
            <input
              type="checkbox"
              checked={draft.consumesBalance}
              onChange={(e) => setDraft({ ...draft, consumesBalance: e.target.checked })}
            />
            <span>Consume dias de vacaciones</span>
            <Help text="Si el tipo consume los días o las horas asignadas al empleado en su esquema de contratación." />
          </label>
          <label className="absence-types-check">
            <input
              type="checkbox"
              checked={draft.requiresDocument}
              onChange={(e) => setDraft({ ...draft, requiresDocument: e.target.checked })}
            />
            <span>Requiere documento</span>
            <Help text="Si al registrar la ausencia se pide un archivo de respaldo (incapacidad, constancia, etc.)." />
          </label>
          {editing !== "new" && (
            <label className="absence-types-check">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              />
              <span>Activo</span>
            </label>
          )}
          <div className="absence-types-actions">
            <button className="btn btn-primary" type="button" disabled={saving} onClick={save}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button className="btn" type="button" disabled={saving} onClick={cancel}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {list.length > 0 && (
        <table className="absence-types-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Unidad</th>
              <th>Consume saldo</th>
              <th>Documento</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className={t.isActive ? "" : "inactive"}>
                <td className="mono">{t.code}</td>
                <td>{t.label}</td>
                <td>{t.unit === "day" ? "Día" : "Hora"}</td>
                <td>{t.consumesBalance ? "Sí" : "No"}</td>
                <td>{t.requiresDocument ? "Sí" : "No"}</td>
                <td>{t.isActive ? "Sí" : "No"}</td>
                <td className="absence-types-actions-cell">
                  <button
                    className="btn btn-small"
                    type="button"
                    disabled={editing !== null || saving}
                    onClick={() => startEdit(t)}
                  >
                    Editar
                  </button>
                  {t.isActive ? (
                    <button
                      className="btn btn-small btn-danger"
                      type="button"
                      disabled={editing !== null || saving}
                      onClick={() => toggleActive(t.id, false)}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      className="btn btn-small btn-success"
                      type="button"
                      disabled={editing !== null || saving}
                      onClick={() => toggleActive(t.id, true)}
                    >
                      Activar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default AbsenceTypes;
