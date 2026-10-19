// «Mis tareas»: the open stages a person is responsible for, most urgent project first (RF-TSK-03).
// A stage is finished from here by delivering it (RF-FLW-03); it then waits for its sign-off, which
// closes it and starts the next one, and until then it stays on the list marked as delivered. Area
// leaders and coordination also see, first, what others delivered and waits for their sign-off.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { dayDate } from "../shared/format.js";
import StageDelivery from "../projects/stageDelivery.jsx";
import ReviewItem from "./reviewItem.jsx";
import { thisWeek } from "./taskText.js";
import "./tasks.css";

const STAGE_STATES = {
  pending: "Por empezar",
  active: "En curso",
  waiting_external: "En espera",
};

/**
 * @param {{ canReview?: boolean, onOpenProject?: ((projectId: number) => void) | null }} props
 *   `canReview` (`task.write`) adds the sign-off queue. Without `onOpenProject`, as for someone who
 *   cannot see «Proyectos», there is no button to open the project.
 */
function MyTasks({ canReview = false, onOpenProject = null }) {
  const [stages, setStages] = useState(null);
  const [review, setReview] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listMyTasks()
      .then((data) => {
        if (!cancelled) setStages(data.stages);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    api
      .listToReview()
      .then((data) => {
        if (!cancelled) setReview(data.stages);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [canReview]);

  async function signOff(stage, decision, comment) {
    setBusy(true);
    setError(null);
    try {
      await api.signOffStage(stage.id, decision, comment.trim() === "" ? null : comment.trim());
      const [queue, mine] = await Promise.all([api.listToReview(), api.listMyTasks()]);
      setReview(queue.stages);
      setStages(mine.stages);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deliver(stage, note, file) {
    setBusy(true);
    setError(null);
    try {
      await api.deliverStage(stage.projectId, stage.id, note, file);
      setStages((await api.listMyTasks()).stages);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (stages === null) {
    return error === null ? <p className="tasks-note">Cargando…</p> : <p className="tasks-error">{error}</p>;
  }

  const today = thisWeek().from;

  return (
    <div className="tasks">
      {error !== null ? <p className="tasks-error">{error}</p> : null}

      {review.length > 0 ? (
        <section className="tasks-sec">
          <h3>Por revisar ({review.length})</h3>
          <ul className="tasks-list">
            {review.map((stage) => (
              <ReviewItem
                stage={stage}
                busy={busy}
                onSignOff={(decision, comment) => signOff(stage, decision, comment)}
                onOpenProject={onOpenProject}
                key={stage.id}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {review.length > 0 ? <h3 className="tasks-sec-title">A tu cargo</h3> : null}

      {stages.length === 0 ? (
        <p className="tasks-empty">No tienes etapas abiertas a tu nombre.</p>
      ) : (
        <ul className="tasks-list">
          {stages.map((stage) => {
            const delivered = stage.deliveredAt !== null;
            const late = stage.dueOn !== null && String(stage.dueOn).slice(0, 10) < today;
            const expanded = openId === stage.id;
            return (
              <li className="tasks-item" key={stage.id}>
                <div className="tasks-item-main">
                  <span className="tasks-eyebrow">
                    {stage.projectKey} · {stage.areaName} · {stage.phaseName}
                  </span>
                  <strong>{stage.title}</strong>
                  <span className="tasks-meta">{stage.projectTitle}</span>
                  {stage.inputNote ? <p className="tasks-detail">Recibe: {stage.inputNote}</p> : null}
                  {stage.outputNote ? <p className="tasks-detail">Entrega: {stage.outputNote}</p> : null}
                  {expanded ? (
                    <StageDelivery stage={stage} busy={busy} onDeliver={(note, file) => deliver(stage, note, file)} />
                  ) : null}
                </div>
                <div className="tasks-item-side">
                  {delivered ? (
                    <span className="tasks-badge is-delivered">Entregada, espera visto bueno</span>
                  ) : (
                    <span className={`tasks-badge is-${stage.status}`}>
                      {STAGE_STATES[stage.status] ?? stage.status}
                    </span>
                  )}
                  <span className={late ? "tasks-meta is-late" : "tasks-meta"}>
                    Para el {stage.dueOn ? dayDate(stage.dueOn) : "sin fecha"}
                  </span>
                  {onOpenProject === null ? null : (
                    <button className="tasks-btn" type="button" onClick={() => onOpenProject(stage.projectId)}>
                      Abrir proyecto
                    </button>
                  )}
                  <button
                    className={expanded || delivered ? "tasks-btn" : "tasks-btn is-primary"}
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpenId(expanded ? null : stage.id)}
                  >
                    {expanded ? "Cerrar" : delivered ? "Ver entrega" : "Entregar"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default MyTasks;
