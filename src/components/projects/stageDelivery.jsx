// What a stage delivered (RF-FLW-03): the written evidence and, optionally, a file that lands in the
// project's folder. Whoever is on the stage hands it in before the sign-off, and whoever signs reads
// it here. A second delivery on the same attempt replaces the first; a rerun starts blank.
import { useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import { saveBlob } from "../shared/download.js";
import FileIcon from "../shared/fileIcon.jsx";
import "./projectDetail.css";

const OPEN = ["active", "waiting_external"];

/**
 * @param {{ stage: object, busy: boolean, onDeliver: (note: string, file: File|null) => Promise<boolean> }} props
 */
function StageDelivery({ stage, busy, onDeliver }) {
  const delivered = stage.deliveredAt !== null && stage.deliveredAt !== undefined;
  const open = OPEN.includes(stage.status);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  async function download() {
    setError(null);
    try {
      saveBlob(await api.downloadFile(stage.deliveryFileId), stage.deliveryFileName);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (await onDeliver(note, file)) {
      setEditing(false);
      setFile(null);
    }
  }

  const showForm = open && (editing || !delivered);

  return (
    <div className="project-delivery">
      <h5>Evidencia de entrega</h5>

      {delivered && !editing ? (
        <div className="project-delivery-done">
          <p className="project-delivery-note">{stage.deliveryNote}</p>
          {stage.deliveryFileName ? (
            <button className="project-delivery-file" type="button" onClick={download}>
              <FileIcon name={stage.deliveryFileName} />
              {stage.deliveryFileName}
            </button>
          ) : null}
          <span className="project-note">
            Entregó {stage.deliveredByName ?? "alguien"} el {shortDate(stage.deliveredAt)}.
          </span>
          {open ? (
            <button
              className="project-quiet"
              type="button"
              onClick={() => {
                setNote(stage.deliveryNote ?? "");
                setEditing(true);
              }}
            >
              Cambiar la entrega
            </button>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <form className="project-delivery-form" onSubmit={submit}>
          <label className="project-field">
            <span className="project-label">Qué se entregó</span>
            <textarea
              rows={3}
              required
              maxLength={4000}
              value={note}
              placeholder="Ej: arte final en PDF, revisado con la facultad el martes"
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <label className="project-field">
            <span className="project-label">Archivo (opcional)</span>
            <input type="file" onChange={(event) => setFile(event.target.files[0] ?? null)} />
          </label>
          <p className="project-note">El archivo se guarda en la carpeta del proyecto.</p>
          <div className="project-action-row">
            {editing ? (
              <button className="project-quiet" type="button" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            ) : null}
            <button className="project-btn is-primary" type="submit" disabled={busy || note.trim() === ""}>
              Entregar
            </button>
          </div>
        </form>
      ) : null}

      {!delivered && !open ? (
        <p className="project-note">
          {stage.status === "pending" ? "Se entrega cuando la etapa esté en curso." : "Sin entrega registrada."}
        </p>
      ) : null}

      {error !== null ? <p className="project-error">{error}</p> : null}
    </div>
  );
}

export default StageDelivery;
