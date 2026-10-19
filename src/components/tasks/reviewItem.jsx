// One delivered stage waiting for the reader's sign-off (RF-FLW-03): what it is, who delivered it, and,
// opened in place, the delivery itself, its file shown when the browser can draw it, and the approve
// and send-back buttons. Approving closes it and starts the next stage; sending it back opens it again
// for the same person.
import { useState } from "react";

import StageDelivery from "../projects/stageDelivery.jsx";
import FilePreview from "../shared/filePreview.jsx";
import { shortDate } from "../shared/format.js";
import DueNote from "./dueNote.jsx";

/**
 * @param {{ stage: object, busy: boolean,
 *   onSignOff: (decision: "approved"|"rejected", comment: string) => Promise<boolean>,
 *   onOpenProject?: ((projectId: number) => void) | null }} props
 */
function ReviewItem({ stage, busy, onSignOff, onOpenProject = null }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function sign(decision) {
    if (await onSignOff(decision, comment)) setComment("");
  }

  return (
    <li className="tasks-item">
      <div className="tasks-item-main">
        <span className="tasks-eyebrow">
          {stage.projectKey} · {stage.areaName} · {stage.phaseName}
        </span>
        <strong>{stage.title}</strong>
        <span className="tasks-meta">
          {stage.projectTitle} · entregó {stage.deliveredByName ?? "alguien"} el {shortDate(stage.deliveredAt)}
          {stage.assignedToName && stage.assignedToName !== stage.deliveredByName
            ? ` · responsable: ${stage.assignedToName}`
            : ""}
        </span>
        {open ? (
          <>
            <StageDelivery stage={stage} />
            {stage.deliveryFileId && stage.deliveryFileName ? (
              <FilePreview fileId={stage.deliveryFileId} name={stage.deliveryFileName} />
            ) : null}
            <div className="tasks-review">
              <label className="tasks-field">
                <span>Comentario (opcional)</span>
                <textarea
                  rows={2}
                  value={comment}
                  placeholder="Ej: falta el logo de la facultad en la portada"
                  onChange={(event) => setComment(event.target.value)}
                />
              </label>
              <div className="tasks-review-actions">
                <button className="tasks-btn" type="button" disabled={busy} onClick={() => sign("rejected")}>
                  Devolver
                </button>
                <button className="tasks-btn is-primary" type="button" disabled={busy} onClick={() => sign("approved")}>
                  Dar visto bueno
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
      <div className="tasks-item-side">
        <span className="tasks-badge is-delivered">Por revisar</span>
        <DueNote dueOn={stage.dueOn} />
        {onOpenProject === null ? null : (
          <button className="tasks-btn" type="button" onClick={() => onOpenProject(stage.projectId)}>
            Abrir proyecto
          </button>
        )}
        <button
          className={open ? "tasks-btn" : "tasks-btn is-primary"}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Cerrar" : "Revisar"}
        </button>
      </div>
    </li>
  );
}

export default ReviewItem;
