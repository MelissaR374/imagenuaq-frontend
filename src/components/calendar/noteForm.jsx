// A post-it for one day: a short text and who reads it — only its author, an area they belong to, or,
// for coordination, everyone. Opened by clicking a day, or a note one wrote, to change or remove it.
import { useState } from "react";

import { NOTE_SCOPES } from "./calendarText.js";
import { dayDate } from "../shared/format.js";

/**
 * @param {{ note: { id?: number, day: string, text?: string, scope?: string, areaId?: number | null },
 *   areas: { id: number, name: string }[], isAdmin: boolean, busy: boolean, error: string | null,
 *   onSave: (body: object) => void, onDelete?: (() => void) | null, onCancel: () => void }} props
 */
function NoteForm({ note, areas, isAdmin, busy, error, onSave, onDelete = null, onCancel }) {
  const [text, setText] = useState(note.text ?? "");
  const [scope, setScope] = useState(note.scope ?? "personal");
  const [areaId, setAreaId] = useState(String(note.areaId ?? areas[0]?.id ?? ""));
  const editing = note.id !== undefined;

  const scopes = Object.entries(NOTE_SCOPES).filter(
    ([value]) => (value !== "area" || areas.length > 0) && (value !== "global" || isAdmin),
  );

  function submit(event) {
    event.preventDefault();
    onSave(editing ? { text } : { day: note.day, text, scope, areaId: scope === "area" ? Number(areaId) : null });
  }

  return (
    <form className="calendar-postit-form" onSubmit={submit}>
      <header className="calendar-postit-form-head">
        <h3>{editing ? "Nota" : "Nueva nota"}</h3>
        <span>{dayDate(note.day)}</span>
      </header>

      <textarea
        className="calendar-postit-text"
        rows={3}
        maxLength={300}
        required
        autoFocus
        value={text}
        placeholder="Ej: llevar la cámara a rectoría"
        onChange={(e) => setText(e.target.value)}
      />

      {editing ? (
        <p className="calendar-form-note">La ve: {NOTE_SCOPES[note.scope]}</p>
      ) : (
        <div className="calendar-form-row">
          <label className="calendar-field">
            <span>¿Quién la ve?</span>
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              {scopes.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {scope === "area" ? (
            <label className="calendar-field">
              <span>Área</span>
              <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {areas.map((area) => (
                  <option value={area.id} key={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      )}

      {error === null ? null : <p className="calendar-error">{error}</p>}

      <div className="calendar-form-actions">
        {onDelete === null ? null : (
          <button className="calendar-btn is-danger" type="button" disabled={busy} onClick={onDelete}>
            Quitar
          </button>
        )}
        <button className="calendar-btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="calendar-btn is-primary" type="submit" disabled={busy}>
          {editing ? "Guardar" : "Pegar nota"}
        </button>
      </div>
    </form>
  );
}

export default NoteForm;
