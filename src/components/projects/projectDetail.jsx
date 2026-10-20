// A project at full screen, over the list and over the sidebar. A header says everything about the
// project at a glance and edits it in place; below it, tabs split the rest: the stages, the values,
// the files and the requests it answers. In «Etapas» the flow is a list of phases on the left and
// the chosen stage opens beside it, so a click never sends the reader scrolling to find its panel.
//
// The two vocabularies of state exist because of DATAMODEL.md §8.1 and do not touch: the status is
// the one from the catalog coordination edits live, moved by a hand; the state of the work is the
// stage machine, moved by a sign-off. The header shows both, and warns when the work is finished
// but the status does not say so.
//
// A project has no "current stage": the current stage is the set of open stages, because one
// project can be in two areas at once (RF-FLW-09). The list shows each stage's latest attempt; the
// sign-offs of earlier attempts stay in its panel, so a rejection's reason is not lost.
//
// `done` is never set by hand: a sign-off closes a stage (RF-FLW-03), and a sign-off that leaves
// its phase with nothing open starts the next phase in the same statement (§2.12). Concluding the
// project closes the list of stages, because it is the walk's last step. Cancelling a stage is not
// offered: it is not a feature of the system, even though the API takes it.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate, dayDate, daysBetween, daysUntil } from "../shared/format.js";
import { nameOfKey } from "../shared/vocabulary.js";
import Help from "../shared/help.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import FolderBrowser from "../documents/folderBrowser.jsx";
import StageModal from "../FlowDesigner/StageModal.jsx";
import { STAGE_STATUS_LABELS } from "../tasks/taskText.js";
import StageDelivery from "./stageDelivery.jsx";
import "./projectDetail.css";

const OPEN_STATES = ["active", "waiting_external"];

/** What is being waited on from a third party, said the way people say it (RF-FLW-07). */
const REASONS = [
  "Visto bueno de la entidad",
  "Información de la entidad",
  "Material o proveedor",
  "Pago o anticipo",
];

const TABS = [
  { key: "stages", label: "Etapas" },
  { key: "data", label: "Datos" },
  { key: "files", label: "Archivos" },
  { key: "requests", label: "Solicitudes" },
];

/** The header fields «Editar» changes, as the draft keeps them. */
const HEADER_KEYS = ["title", "requester", "priority", "startsOn", "dueOn", "hasCost"];

/** A key as `FieldInput` draws it: its name, type and note from the vocabulary. */
function fieldOfKey(vocabulary, key) {
  const known = vocabulary.get(key);
  if (known === undefined) {
    return { code: key, name: key, type: "text", note: null };
  }
  return { code: key, name: known.name, type: known.type, note: known.note };
}

/** Whether a stage can still be delivered: open, so its values can still change. */
function isOpen(stage) {
  return OPEN_STATES.includes(stage.status);
}

/** Each stage definition's latest attempt: what the list shows. Earlier attempts are history. */
function latestAttempts(stages) {
  const latest = new Map();
  for (const stage of stages) {
    const seen = latest.get(stage.flowStageId);
    if (seen === undefined || stage.attempt > seen.attempt) {
      latest.set(stage.flowStageId, stage);
    }
  }
  return [...latest.values()];
}

/** The stages grouped by their phase: the same `seq` twice is two stages running in parallel. */
function phasesOf(stages) {
  const phases = new Map();
  for (const stage of stages) {
    if (!phases.has(stage.seq)) {
      phases.set(stage.seq, { seq: stage.seq, name: stage.phaseName, stages: [] });
    }
    phases.get(stage.seq).stages.push(stage);
  }
  return [...phases.values()]
    .sort((one, other) => one.seq - other.seq)
    .map((phase) => ({ ...phase, stages: phase.stages.sort((a, b) => a.position - b.position) }));
}

/** "Fase 2 · Producción", without repeating a name that only says its number. */
function phaseLabel(index, name) {
  const number = `Fase ${index + 1}`;
  if (name === null || name === undefined || name.trim() === "" || name.trim().toLowerCase() === number.toLowerCase()) {
    return number;
  }
  return `${number} · ${name}`;
}

/** Whether a key already has a value: it is what the sign-off demands (RF-FLW-06). */
function hasValue(fieldValues, key) {
  return fieldValues.some((value) => value.key === key && value.value !== "");
}

/** The draft of the header: what «Editar» changes, as it stands saved. */
function headerFrom(project) {
  return {
    title: project.title,
    requester: project.requester ?? "",
    priority: String(project.priority),
    startsOn: project.startsOn ?? "",
    dueOn: project.dueOn ?? "",
    hasCost: project.hasCost,
  };
}

/** The draft of the values, keyed by their field key. */
function valuesFrom(project) {
  const values = {};
  for (const value of project.fieldValues) {
    values[value.key] = value.value;
  }
  return values;
}

/** The due date with what is left of it, or how long ago it passed. */
function dueNote(dueOn, closed) {
  if (dueOn === null || dueOn === undefined) return { text: "Sin fecha de entrega", late: false };
  const days = daysUntil(dueOn);
  let left = `en ${days} d`;
  if (days === 0) left = "hoy";
  if (days < 0) left = `vencido hace ${-days} d`;
  return { text: closed ? dayDate(dueOn) : `${dayDate(dueOn)} · ${left}`, late: !closed && days < 0 };
}

/** What belongs to whoever is looking, said in one sentence. */
function myPartIn(stage, user) {
  if (user === null || user === undefined) {
    return `La atiende ${stage.areaName}.`;
  }
  if (stage.assignedTo === user.id) {
    return "Te toca esta etapa.";
  }
  if (user.role === "admin") {
    return "Coordinas el proyecto.";
  }
  if (user.role === "finance") {
    return `Solo consulta: la atiende ${stage.areaName}.`;
  }
  return `La atiende ${stage.areaName}.`;
}

/**
 * The top of the project: who asked for it, its status, its dates and how far the work has gone.
 * «Editar» turns the same strip into the form that changes it, saved from right there.
 */
function ProjectHead({
  detail, statuses, stages, busy, place, onPrevious, onNext, onClose, onStatus, onSaveHeader, onArchive,
}) {
  const [editing, setEditing] = useState(false);
  const [header, setHeader] = useState(() => headerFrom(detail));
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const closed = detail.closedAt !== null || detail.archivedAt !== null;
  const due = dueNote(detail.dueOn, closed);
  const done = stages.filter((stage) => stage.status === "done").length;
  const waiting = stages.filter((stage) => stage.status === "waiting_external").length;
  const open = stages.filter((stage) => OPEN_STATES.includes(stage.status)).length;
  const workFinished = stages.length > 0 && open === 0 && done > 0;
  const statusSaysSo = detail.statusIsTerminal || detail.closedAt !== null;

  let state = "Abierto";
  if (detail.archivedAt !== null) state = `Archivado el ${shortDate(detail.archivedAt)}`;
  else if (detail.closedAt !== null) state = `Concluido el ${shortDate(detail.closedAt)}`;

  function write(key, value) {
    setHeader({ ...header, [key]: value });
  }

  async function save(event) {
    event.preventDefault();
    if (await onSaveHeader(header)) setEditing(false);
  }

  return (
    <header className="project-head">
      <div className="project-head-top">
        <button className="project-close" type="button" onClick={onClose} aria-label="Volver a la lista">
          ✕
        </button>
        <div className="project-head-title">
          <span className="project-bar-eyebrow">
            {detail.key} · {detail.requests.length === 0 ? "captura directa" : "de una solicitud"} · {state}
          </span>
          <h2>{detail.title}</h2>
          <span className="project-head-requester">{detail.requester || "Sin entidad solicitante"}</span>
        </div>

        <div className="project-head-actions">
          {editing ? null : (
            <button
              className="project-btn"
              type="button"
              onClick={() => {
                setHeader(headerFrom(detail));
                setEditing(true);
              }}
              disabled={busy}
            >
              Editar
            </button>
          )}
          {detail.archivedAt !== null ? null : confirmingArchive ? (
            <span className="project-confirm">
              Se quita de en medio; se puede ver en «Archivados».
              <button className="project-btn" type="button" onClick={onArchive} disabled={busy}>
                Archivar
              </button>
              <button className="project-quiet" type="button" onClick={() => setConfirmingArchive(false)}>
                Dejarlo
              </button>
            </span>
          ) : (
            <button className="project-quiet" type="button" onClick={() => setConfirmingArchive(true)} disabled={busy}>
              Archivar
            </button>
          )}
          {place === null ? null : (
            <div className="project-bar-move">
              <span>
                {place.position} de {place.total}
              </span>
              <button className="project-quiet" type="button" onClick={onPrevious} disabled={onPrevious === null} aria-label="Anterior">
                ‹
              </button>
              <button className="project-quiet" type="button" onClick={onNext} disabled={onNext === null} aria-label="Siguiente">
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <form className="project-head-form" onSubmit={save}>
          <label className="project-field is-wide">
            <span className="project-label">Título</span>
            <input value={header.title} required onChange={(event) => write("title", event.target.value)} />
          </label>
          <label className="project-field is-wide">
            <span className="project-label">Entidad solicitante</span>
            <input value={header.requester} onChange={(event) => write("requester", event.target.value)} />
          </label>
          <label className="project-field">
            <span className="project-label">
              Urgencia
              <Help text="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
            </span>
            <input type="number" value={header.priority} onChange={(event) => write("priority", event.target.value)} />
          </label>
          <label className="project-field">
            <span className="project-label">Empieza</span>
            <input type="date" value={header.startsOn} onChange={(event) => write("startsOn", event.target.value)} />
          </label>
          <label className="project-field">
            <span className="project-label">Entrega</span>
            <input type="date" value={header.dueOn} onChange={(event) => write("dueOn", event.target.value)} />
          </label>
          <label className="project-check">
            <input type="checkbox" checked={header.hasCost} onChange={(event) => write("hasCost", event.target.checked)} />
            Con costo
          </label>
          <div className="project-action-row">
            <button className="project-quiet" type="button" onClick={() => setEditing(false)}>
              Cancelar
            </button>
            <button className="project-btn is-primary" type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="project-facts">
          <div className="project-fact">
            <dt>Estatus</dt>
            <dd>
              <select value={detail.statusId} onChange={(event) => onStatus(event.target.value)} disabled={busy}>
                {statuses.map((one) => (
                  <option value={one.id} key={one.id}>
                    {one.label}
                    {one.isGlobal ? "" : ` (${one.areaName})`}
                  </option>
                ))}
              </select>
              <span className="project-fact-note">desde {shortDate(detail.statusSince)}</span>
            </dd>
          </div>
          <div className="project-fact">
            <dt>Entrega</dt>
            <dd className={due.late ? "is-late" : undefined}>{due.text}</dd>
          </div>
          <div className="project-fact">
            <dt>Empieza</dt>
            <dd>{detail.startsOn === null ? "Sin fecha" : dayDate(detail.startsOn)}</dd>
          </div>
          <div className="project-fact">
            <dt>Urgencia</dt>
            <dd>{detail.priority}</dd>
          </div>
          <div className="project-fact">
            <dt>Costo</dt>
            <dd>
              {detail.hasCost ? "Con costo" : "Sin costo"}
              {detail.inClosure ? <span className="project-closure">En ventana de cierre</span> : null}
            </dd>
          </div>
        </dl>
      )}

      <div className="project-progress">
        <div
          className="project-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={stages.length}
          aria-valuenow={done}
          aria-label="Etapas concluidas"
        >
          <span style={{ width: stages.length === 0 ? "0%" : `${(done / stages.length) * 100}%` }} />
        </div>
        <span className="project-progress-text">
          {stages.length === 0
            ? "Todavía sin etapas."
            : `${done} de ${stages.length} ${stages.length === 1 ? "etapa concluida" : "etapas concluidas"}`}
          {open - waiting > 0 ? ` · ${open - waiting} en curso` : ""}
          {waiting > 0 ? ` · ${waiting} en espera` : ""}
        </span>
      </div>

      {workFinished && !statusSaysSo ? (
        <p className="project-warn">
          El trabajo ya no tiene etapas abiertas, pero el estatus sigue en «{detail.statusLabel}». Nada lo mueve solo.
        </p>
      ) : null}
    </header>
  );
}

/** One stage in the list: its state as a mark, its area and title, and who has it. */
function StageRow({ stage, fieldValues, selected, onSelect }) {
  const owed = stage.outputs.filter((key) => !hasValue(fieldValues, key)).length;
  let who = stage.assignedToName ?? "Sin responsable";
  if (stage.status === "waiting_external") who = "En espera";
  if (stage.status === "done" && stage.startedAt !== null && stage.endedAt !== null) {
    who = `${stage.assignedToName ?? "Concluida"} · ${daysBetween(stage.startedAt, stage.endedAt)} d`;
  }

  return (
    <li>
      <button
        className={`project-row is-${stage.status}${selected ? " is-selected" : ""}`}
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(stage.id)}
      >
        <span className="project-row-mark" aria-label={STAGE_STATUS_LABELS[stage.status] ?? stage.status} />
        <span className="project-row-main">
          <span className="project-row-area">{stage.areaName}</span>
          <span className="project-row-title">{stage.title}</span>
        </span>
        <span className="project-row-side">
          <span className="project-row-who">{who}</span>
          {stage.attempt > 1 ? <span className="project-row-tag">intento {stage.attempt}</span> : null}
          {owed > 0 && stage.status !== "done" ? <span className="project-row-tag is-owed">debe {owed}</span> : null}
        </span>
      </button>
    </li>
  );
}

/** The flow as a list: phase after phase, then adding a stage and concluding the project. */
function StageList({ detail, phases, openStages, selected, busy, onSelect, onAdd, onConclude, onArchiveClosed }) {
  const [alsoArchive, setAlsoArchive] = useState(false);

  return (
    <div className="project-list">
      <div className="project-list-head">
        <h3>Flujo</h3>
        <button className="project-btn" type="button" onClick={onAdd} disabled={busy}>
          + Etapa
        </button>
      </div>

      {phases.length === 0 ? <p className="project-note">Todavía sin etapas: agrega la primera.</p> : null}

      {phases.map((phase, index) => (
        <section className="project-phase" key={phase.seq}>
          <h4>{phaseLabel(index, phase.name)}</h4>
          <ul className="project-rows">
            {phase.stages.map((stage) => (
              <StageRow
                stage={stage}
                fieldValues={detail.fieldValues}
                selected={stage.id === selected}
                onSelect={onSelect}
                key={stage.id}
              />
            ))}
          </ul>
        </section>
      ))}

      <section className="project-phase is-end">
        <h4>Fin</h4>
        {detail.closedAt === null ? (
          <div className="project-end">
            <button
              className="project-btn is-primary"
              type="button"
              onClick={() => onConclude(alsoArchive)}
              disabled={busy || openStages.length > 0}
            >
              Concluir proyecto
            </button>
            <label className="project-check">
              <input type="checkbox" checked={alsoArchive} onChange={(event) => setAlsoArchive(event.target.checked)} />
              y archivarlo
              <Help text="Concluir dice que el trabajo terminó. Archivar lo quita de en medio sin decir nada del trabajo; se puede archivar después." />
            </label>
            {openStages.length > 0 ? (
              <span className="project-note">
                {openStages.length} {openStages.length === 1 ? "etapa sigue abierta" : "etapas siguen abiertas"}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="project-end">
            <strong>Concluido el {shortDate(detail.closedAt)}</strong>
            {detail.archivedAt === null ? (
              <button className="project-btn" type="button" onClick={onArchiveClosed} disabled={busy}>
                Archivar
              </button>
            ) : (
              <span className="project-note">Archivado el {shortDate(detail.archivedAt)}</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The values a stage delivers (RF-FLW-06), written where the stage is delivered and saved as
 * produced by it. While the stage is open they can be changed; once it is signed they only read.
 */
function StageOutputs({ stage, detail, vocabulary, busy, onSave }) {
  const saved = valuesFrom(detail);
  const [values, setValues] = useState(() =>
    Object.fromEntries(stage.outputs.map((key) => [key, saved[key] ?? ""])),
  );
  const changed = stage.outputs.filter((key) => String(values[key] ?? "") !== String(saved[key] ?? ""));

  if (!isOpen(stage)) {
    return (
      <ul className="project-io">
        {stage.outputs.map((key) => (
          <li key={key}>
            <span className="project-label">{nameOfKey(vocabulary, key)}</span>
            {hasValue(detail.fieldValues, key) ? (
              <span className="project-value">{saved[key]}</span>
            ) : (
              <span className="project-missing">sin escribir</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="project-outputs">
      <div className="project-grid">
        {stage.outputs.map((key) => (
          <div className={changed.includes(key) ? "project-typed is-changed" : "project-typed"} key={key}>
            <FieldInput
              field={fieldOfKey(vocabulary, key)}
              value={values[key]}
              onChange={(value) => setValues({ ...values, [key]: value })}
            />
          </div>
        ))}
      </div>
      {changed.length === 0 ? null : (
        <div className="project-action-row">
          <button className="project-quiet" type="button" onClick={() => setValues(Object.fromEntries(stage.outputs.map((key) => [key, saved[key] ?? ""])))}>
            Descartar
          </button>
          <button className="project-btn is-primary" type="button" disabled={busy} onClick={() => onSave(stage, values, saved)}>
            {busy ? "Guardando…" : "Guardar datos"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The selected stage: what it asks for, what it owes and what can be done with it. What can be
 * done depends on the stage's state and on who is looking at it.
 */
function StagePanel({
  stage, history, detail, phases, vocabulary, user, people, busy, missing, nextPhase,
  onAssignee, onHold, onResume, onStart, onSignOff, onDeliver, onSaveOutputs,
}) {
  const [reason, setReason] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [signing, setSigning] = useState(null);

  const phaseIndex = phases.findIndex((phase) => phase.seq === stage.seq);
  const approvals = history.flatMap((attempt) =>
    attempt.approvals.map((approval) => ({ ...approval, attempt: attempt.attempt })),
  );

  let signOffEffect = `Aprobar concluye la etapa${
    nextPhase === null
      ? " y, si no queda nada abierto en su fase, el proyecto se puede concluir."
      : ` y, si no queda nada abierto en su fase, abre la fase ${
          phaseIndex + 2
        } (${nextPhase.stages.map((one) => one.areaName).join(", ")}).`
  } Rechazar: la etapa vuelve como intento ${stage.attempt + 1}.`;
  if (missing !== null) {
    signOffEffect = `Para dar el visto bueno falta escribir «${missing}» en «Para entregar».`;
  }

  return (
    <section className="project-stage">
      <header className="project-stage-head">
        <span className="project-stage-place">
          {phaseLabel(phaseIndex, stage.phaseName)} · {stage.areaName}
        </span>
        <h3>
          {stage.title}
          <span className={`project-stage-state is-${stage.status}`}>
            {STAGE_STATUS_LABELS[stage.status] ?? stage.status}
            {stage.attempt > 1 ? ` · intento ${stage.attempt}` : ""}
          </span>
        </h3>
        <p className="project-stage-mine">{myPartIn(stage, user)}</p>
      </header>

      {stage.status === "waiting_external" ? (
        <p className="project-warn">
          En espera desde {shortDate(stage.startedAt)}: {stage.blockedReason}
        </p>
      ) : null}

      <div className="project-field">
        <span className="project-label">
          Responsable
          <Help text="Quien atiende la etapa. Se elige entre la gente del área; la responsable del área y coordinación pueden cambiarlo." />
        </span>
        <select
          value={stage.assignedTo ?? ""}
          onChange={(event) => onAssignee(stage, event.target.value)}
          disabled={busy || stage.status === "done"}
        >
          <option value="">Sin responsable</option>
          {people.map((person) => (
            <option value={person.id} key={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="project-stage-actions">
        {stage.status === "pending" ? (
          <div className="project-action">
            <button className="project-btn" type="button" onClick={() => onStart(stage)} disabled={busy}>
              Iniciar ahora
            </button>
            <p className="project-note">Empieza sola cuando concluya la fase anterior. Iniciar ahora es la excepción.</p>
          </div>
        ) : null}

        {stage.status === "waiting_external" ? (
          <div className="project-action">
            <button className="project-btn is-primary" type="button" onClick={() => onResume(stage)} disabled={busy}>
              Ya respondieron: reanudar
            </button>
            <p className="project-note">Vuelve a quedar activa, con su mismo intento.</p>
          </div>
        ) : null}

        {stage.status === "active" && !waiting && signing === null ? (
          <button className="project-btn" type="button" onClick={() => setWaiting(true)} disabled={busy}>
            Poner en espera
            <Help text="Para cuando lo que falta no está en nuestras manos: un visto bueno de la entidad, material de un proveedor, un anticipo." />
          </button>
        ) : null}

        {OPEN_STATES.includes(stage.status) && !waiting && signing === null ? (
          <button
            className="project-btn is-primary"
            type="button"
            onClick={() => setSigning({ decision: "approved", comment: "" })}
            disabled={busy || missing !== null}
          >
            Visto bueno
          </button>
        ) : null}
      </div>

      {OPEN_STATES.includes(stage.status) && !waiting && signing === null ? (
        <p className={missing === null ? "project-note" : "project-note is-blocked"}>{signOffEffect}</p>
      ) : null}

      {waiting ? (
        <form
          className="project-wait"
          onSubmit={(event) => {
            event.preventDefault();
            onHold(stage, reason);
            setWaiting(false);
            setReason("");
          }}
        >
          <h5>Poner en espera</h5>
          <p className="project-note">La etapa sigue siendo de su área, pero el tiempo que pase esperando queda dicho, no escondido.</p>
          <div className="project-chips">
            {REASONS.map((one) => (
              <button
                className={reason === one ? "project-chip is-on" : "project-chip"}
                type="button"
                onClick={() => setReason(one)}
                key={one}
              >
                {one}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej: esperamos el visto bueno de la facultad"
          />
          <div className="project-action-row">
            <button className="project-quiet" type="button" onClick={() => setWaiting(false)}>
              Cancelar
            </button>
            <button className="project-btn" type="submit" disabled={busy || reason.trim() === ""}>
              Poner en espera
            </button>
          </div>
        </form>
      ) : null}

      {signing === null ? null : (
        <form
          className="project-sign"
          onSubmit={(event) => {
            event.preventDefault();
            onSignOff(stage, signing);
            setSigning(null);
          }}
        >
          <h5>Visto bueno de «{stage.title}»</h5>
          <div className="project-field">
            <span className="project-label">Decisión</span>
            <select value={signing.decision} onChange={(event) => setSigning({ ...signing, decision: event.target.value })}>
              <option value="approved">Aprobar</option>
              <option value="rejected">Rechazar</option>
            </select>
          </div>
          <p className="project-note">
            {signing.decision === "approved"
              ? signOffEffect
              : `La etapa se cierra y vuelve a abrirse como intento ${stage.attempt + 1}, para que el trabajo devuelto quede a la vista.`}
          </p>
          <div className="project-field">
            <span className="project-label">
              Comentario
              <Help text="La conformidad del solicitante va aquí: el visto bueno es interno." />
            </span>
            <textarea value={signing.comment} onChange={(event) => setSigning({ ...signing, comment: event.target.value })} rows={3} />
          </div>
          <div className="project-action-row">
            <button className="project-quiet" type="button" onClick={() => setSigning(null)}>
              Cancelar
            </button>
            <button className="project-btn is-primary" type="submit" disabled={busy}>
              Registrar
            </button>
          </div>
        </form>
      )}

      <h4>Necesita</h4>
      {stage.inputNote ? <p className="project-stage-brief">{stage.inputNote}</p> : null}
      {stage.inputs.length === 0 ? (
        stage.inputNote ? null : <p className="project-note">Nada de otra etapa.</p>
      ) : (
        <ul className="project-io">
          {stage.inputs.map((key) => {
            const value = detail.fieldValues.find((one) => one.key === key);
            return (
              <li key={key}>
                <span className="project-label">{nameOfKey(vocabulary, key)}</span>
                {value === undefined || value.value === "" ? (
                  <span className="project-missing">todavía nadie lo escribe</span>
                ) : (
                  <span className="project-value">{value.value}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="project-handover">
        <h4>
          Para entregar
          {stage.outputs.length === 0
            ? ""
            : ` · ${stage.outputs.filter((key) => hasValue(detail.fieldValues, key)).length} de ${stage.outputs.length} datos`}
        </h4>
        {stage.outputNote ? <p className="project-stage-brief">{stage.outputNote}</p> : null}
        {stage.outputs.length === 0 ? null : (
          <StageOutputs stage={stage} detail={detail} vocabulary={vocabulary} busy={busy} onSave={onSaveOutputs} />
        )}
        <StageDelivery
          key={stage.id}
          stage={stage}
          busy={busy}
          onDeliver={(note, file) => onDeliver(stage, note, file)}
        />
      </section>

      <h4>Vistos buenos</h4>
      {approvals.length === 0 ? (
        <p className="project-note">Ninguno todavía.</p>
      ) : (
        <ul className="project-approvals">
          {approvals.map((approval) => (
            <li key={approval.id}>
              <span className="project-label">
                {approval.decision === "approved" ? "Aprobó" : "Rechazó"} {approval.approverName} ·{" "}
                {shortDate(approval.decidedAt)}
                {history.length > 1 ? ` · intento ${approval.attempt}` : ""}
              </span>
              {approval.comment === null ? null : <span>{approval.comment}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What a stage in a project needs on top of what a template stage has: the phase it joins and
 * whether it starts now. Rendered inside the flow designer's stage window, in its markup.
 */
function StageExtras({ draft, phases, onChange }) {
  const lastSeq = phases.length === 0 ? 0 : phases[phases.length - 1].seq;

  return (
    <>
      <div className="modal-field">
        <label htmlFor="stage-phase">
          En qué fase
          <Help text="Dos etapas en la misma fase corren en paralelo: la fase concluye cuando no queda ninguna abierta." />
        </label>
        <select id="stage-phase" value={draft.seq} onChange={(event) => onChange("seq", event.target.value)}>
          {phases.map((phase, index) => (
            <option value={phase.seq} key={phase.seq}>
              {phaseLabel(index, phase.name)}, en paralelo con lo que ya tiene
            </option>
          ))}
          <option value={lastSeq + 1}>Fase nueva, al final</option>
        </select>
      </div>

      <div className="modal-field">
        <label htmlFor="stage-start">Empieza</label>
        <select id="stage-start" value={draft.status} onChange={(event) => onChange("status", event.target.value)}>
          <option value="pending">Pendiente</option>
          <option value="active">Activa</option>
        </select>
      </div>
    </>
  );
}

/**
 * The project's values (RF-FLW-06), grouped by where they come from: what each stage delivers, and
 * what the request said. Nothing here asks the reader to pick a key; a value appears because a
 * stage declares it or the request brought it. Saved from this tab, apart from the header.
 */
function ProjectData({ detail, stages, vocabulary, busy, onSave }) {
  const saved = valuesFrom(detail);
  const delivering = stages.filter((stage) => stage.outputs.length > 0);
  const declared = new Set(delivering.flatMap((stage) => stage.outputs));
  const fromRequest = detail.fieldValues
    .filter((value) => !declared.has(value.key) && value.producedByStageId === null)
    .map((value) => value.key);
  const others = detail.fieldValues
    .filter((value) => !declared.has(value.key) && value.producedByStageId !== null)
    .map((value) => value.key);

  const [values, setValues] = useState(() => {
    const draft = { ...saved };
    for (const key of declared) draft[key] = saved[key] ?? "";
    return draft;
  });
  const changed = Object.keys(values).filter((key) => String(values[key] ?? "") !== String(saved[key] ?? ""));

  /** Which stage a key belongs to, so saving it records the stage as its source. */
  const producers = {};
  for (const stage of delivering) {
    for (const key of stage.outputs) producers[key] ??= stage.id;
  }

  function input(key) {
    return (
      <div className={changed.includes(key) ? "project-typed is-changed" : "project-typed"} key={key}>
        <FieldInput field={fieldOfKey(vocabulary, key)} value={values[key]} onChange={(value) => setValues({ ...values, [key]: value })} />
      </div>
    );
  }

  return (
    <div className="project-data">
      <section className="project-sec">
        <h3>
          Lo que entregan las etapas
          <Help text="Cada etapa declara qué datos deja escritos al terminar, como el número de orden o el costo total. Se escriben al entregarla; aquí se ven todos juntos y se pueden corregir." />
        </h3>
        {delivering.length === 0 ? (
          <p className="project-note">Ninguna etapa de este flujo pide escribir datos.</p>
        ) : (
          delivering.map((stage) => (
            <div className="project-data-group" key={stage.id}>
              <h4>
                {stage.title}
                <span className="project-data-who">
                  {stage.areaName}
                  {stage.status === "done" ? " · concluida" : ""}
                </span>
              </h4>
              <div className="project-grid">{stage.outputs.map(input)}</div>
            </div>
          ))
        )}
      </section>

      <section className="project-sec">
        <h3>
          De la solicitud
          <Help text="Lo que la entidad capturó al pedir el trabajo. Se copió al convertir la solicitud en proyecto." />
        </h3>
        {fromRequest.length === 0 ? (
          <p className="project-note">
            {detail.requests.length === 0 ? "Este proyecto se capturó directo, sin solicitud." : "La solicitud no traía datos."}
          </p>
        ) : (
          <div className="project-grid">{fromRequest.map(input)}</div>
        )}
      </section>

      {others.length === 0 ? null : (
        <section className="project-sec">
          <h3>Otros datos</h3>
          <div className="project-grid">{others.map(input)}</div>
        </section>
      )}

      {changed.length === 0 ? null : (
        <div className="project-save-bar">
          <span className="project-dirty">
            {changed.length} {changed.length === 1 ? "cambio" : "cambios"} sin guardar
          </span>
          <button className="project-btn" type="button" onClick={() => setValues({ ...saved })} disabled={busy}>
            Descartar
          </button>
          <button className="project-btn is-primary" type="button" onClick={() => onSave(values, saved, producers)} disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The project's folder (RF-ARC-01). The server creates it on first use and answers 404 when the
 * viewer's areas have no part in the project, which reads here as no access rather than an error.
 */
function ProjectFiles({ projectId, areas }) {
  const [folder, setFolder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getProjectFolder(projectId)
      .then((data) => {
        if (!cancelled) setFolder(data.folder);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.status === 404 ? "Sin acceso a los archivos de este proyecto." : err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error !== null) return <p className="project-note">{error}</p>;
  if (folder === null) return <p className="project-note">Cargando…</p>;
  return <FolderBrowser key={folder.id} root={folder} areas={areas} />;
}

function ProjectDetail({
  project, areas, statuses: initialStatuses, vocabulary, user,
  place, onPrevious, onNext, onClose, onChanged,
}) {
  const [detail, setDetail] = useState(null);
  const [statuses, setStatuses] = useState(initialStatuses ?? []);
  const [people, setPeople] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("stages");
  const [newStage, setNewStage] = useState(null);
  const [newStageMembers, setNewStageMembers] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [registered, setRegistered] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await api.getProject(project.id);
        if (cancelled) {
          return;
        }
        setDetail(response.project);

        const withStage = [...new Set(response.project.stages.map((stage) => stage.areaId))];
        const lists = await Promise.all([
          api.listStatuses(),
          ...withStage.map((id) => api.listStatuses({ areaId: id })),
        ]);
        if (cancelled) {
          return;
        }

        const byId = new Map();
        for (const list of lists) {
          for (const one of list.statuses) {
            byId.set(one.id, one);
          }
        }
        setStatuses([...byId.values()]);
      } catch (failure) {
        if (!cancelled) {
          setError(failure.message);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && newStage === null) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, newStage]);

  const known = new Map(vocabulary);
  for (const one of registered) known.set(one.key, { name: one.name, type: one.type, note: one.note || null });
  const stages = detail === null ? [] : latestAttempts(detail.stages);
  const phases = phasesOf(stages);
  const openStages = stages.filter((stage) => OPEN_STATES.includes(stage.status));
  const selectedStage =
    stages.find((stage) => stage.id === selected) ?? openStages[0] ?? stages[0] ?? null;
  const stageAreaId = selectedStage === null ? null : selectedStage.areaId;
  const newStageAreaId = newStage === null ? null : newStage.areaId;

  useEffect(() => {
    if (newStageAreaId === null || newStageAreaId === "") {
      return;
    }
    let cancelled = false;
    api
      .listUsers({ areaId: newStageAreaId })
      .then((response) => {
        if (!cancelled) {
          setNewStageMembers(response.users);
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(failure.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [newStageAreaId]);

  useEffect(() => {
    if (stageAreaId === null) {
      return;
    }
    let cancelled = false;
    api
      .listUsers({ areaId: stageAreaId })
      .then((response) => {
        if (!cancelled) {
          setPeople(response.users);
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          setError(failure.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [stageAreaId]);

  async function reload() {
    const response = await api.getProject(project.id);
    setDetail(response.project);
    setVersion((current) => current + 1);
    onChanged();
    return response.project;
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      return await reload();
    } catch (failure) {
      setError(failure.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (detail === null) {
    return (
      <section className="project-full">
        <p className="project-loading">{error ?? "Abriendo el proyecto…"}</p>
      </section>
    );
  }

  /** Saves the header's fields that changed; true when it went through. */
  async function saveHeader(header) {
    const saved = headerFrom(detail);
    const changes = {};
    for (const key of HEADER_KEYS) {
      if (String(header[key]) === String(saved[key])) continue;
      if (key === "priority") changes.priority = Number(header.priority);
      else if (key === "startsOn" || key === "dueOn") changes[key] = header[key] === "" ? null : header[key];
      else changes[key] = header[key];
    }
    if (Object.keys(changes).length === 0) return true;
    return (await run(() => api.updateProject(detail.id, changes))) !== null;
  }

  /** Writes the values that changed, each one recorded as produced by its stage when it has one. */
  async function saveValues(values, saved, producers = {}) {
    await run(async () => {
      for (const key of Object.keys(values)) {
        const before = saved[key];
        const now = values[key];
        if (String(now ?? "") === String(before ?? "")) {
          continue;
        }
        if (now === "" || now === null || now === undefined) {
          if (before !== undefined) {
            await api.deleteFieldValue(detail.id, key);
          }
          continue;
        }
        await api.setFieldValue(detail.id, key, String(now), producers[key] ?? null);
      }
    });
  }

  function saveOutputs(stage, values, saved) {
    return saveValues(values, saved, Object.fromEntries(stage.outputs.map((key) => [key, stage.id])));
  }

  async function signOff(stage, decision) {
    const after = await run(() =>
      api.createApproval(detail.id, stage.id, {
        decision: decision.decision,
        comment: decision.comment || undefined,
      }),
    );
    if (after !== null) {
      const stillOpen = latestAttempts(after.stages).find((one) => OPEN_STATES.includes(one.status));
      setSelected(stillOpen === undefined ? null : stillOpen.id);
    }
  }

  /** Records the delivery, uploading the optional file to the project's folder first. */
  async function deliver(stage, note, file) {
    const after = await run(() => api.deliverStage(detail.id, stage.id, note, file));
    return after !== null;
  }

  async function conclude(alsoArchive) {
    await run(async () => {
      await api.closeProject(detail.id);
      if (alsoArchive) {
        await api.archiveProject(detail.id);
      }
    });
  }

  function changeNewStage(field, value) {
    const next = { ...newStage, [field]: value };
    if (field === "areaId") {
      next.defaultAssigneeId = "";
      setNewStageMembers([]);
    }
    setNewStage(next);
  }

  async function addStage(event) {
    event.preventDefault();
    const done = await run(() =>
      api.createProjectStage(detail.id, {
        areaId: Number(newStage.areaId),
        title: newStage.title,
        seq: Number(newStage.seq),
        status: newStage.status,
        assignedTo: newStage.defaultAssigneeId === "" ? null : Number(newStage.defaultAssigneeId),
        inputs: newStage.inputs,
        outputs: newStage.outputs,
        inputNote: newStage.inputNote,
        outputNote: newStage.outputNote,
        estimatedDays: Number(newStage.estimatedDays),
      }),
    );
    if (done !== null) {
      setNewStage(null);
    }
  }

  let missing = null;
  let nextPhase = null;
  let history = [];
  if (selectedStage !== null) {
    const pending = selectedStage.outputs.find((key) => !hasValue(detail.fieldValues, key));
    missing = pending === undefined ? null : nameOfKey(known, pending);
    const index = phases.findIndex((phase) => phase.seq === selectedStage.seq);
    nextPhase = phases[index + 1] ?? null;
    history = detail.stages
      .filter((one) => one.flowStageId === selectedStage.flowStageId)
      .sort((a, b) => b.attempt - a.attempt);
  }

  const counts = { stages: stages.length, data: detail.fieldValues.length, requests: detail.requests.length };

  return (
    <section className="project-full">
      <ProjectHead
        detail={detail}
        statuses={statuses}
        stages={stages}
        busy={busy}
        place={place}
        onPrevious={onPrevious}
        onNext={onNext}
        onClose={onClose}
        onStatus={(value) => run(() => api.setProjectStatus(detail.id, Number(value)))}
        onSaveHeader={saveHeader}
        onArchive={() => run(() => api.archiveProject(detail.id))}
        key={`head-${version}`}
      />

      <nav className="project-tabs" role="tablist">
        {TABS.map((one) => (
          <button
            className={one.key === tab ? "project-tab is-active" : "project-tab"}
            type="button"
            role="tab"
            aria-selected={one.key === tab}
            onClick={() => setTab(one.key)}
            key={one.key}
          >
            {one.label}
            {counts[one.key] ? <span className="project-tab-count">{counts[one.key]}</span> : null}
          </button>
        ))}
      </nav>

      <div className="project-body">
        {error !== null ? <p className="project-error">{error}</p> : null}

        {tab === "stages" ? (
          <div className="project-split">
            <StageList
              detail={detail}
              phases={phases}
              openStages={openStages}
              selected={selectedStage?.id ?? null}
              busy={busy}
              onSelect={setSelected}
              onAdd={() =>
                setNewStage({
                  areaId: areas.length === 0 ? "" : areas[0].id,
                  title: "",
                  seq: phases.length === 0 ? 1 : phases[phases.length - 1].seq + 1,
                  status: "pending",
                  defaultAssigneeId: "",
                  inputs: [],
                  outputs: [],
                  inputNote: "",
                  outputNote: "",
                  estimatedDays: 1,
                })
              }
              onConclude={conclude}
              onArchiveClosed={() => run(() => api.archiveProject(detail.id))}
            />

            {selectedStage === null ? (
              <p className="project-stage is-empty">Agrega una etapa para empezar el flujo.</p>
            ) : (
              <StagePanel
                stage={selectedStage}
                history={history}
                detail={detail}
                phases={phases}
                vocabulary={known}
                user={user}
                people={people}
                busy={busy}
                missing={missing}
                nextPhase={nextPhase}
                onAssignee={(stage, value) =>
                  run(() => api.updateProjectStage(detail.id, stage.id, { assignedTo: value === "" ? null : Number(value) }))
                }
                onStart={(stage) => run(() => api.updateProjectStage(detail.id, stage.id, { status: "active" }))}
                onHold={(stage, reason) =>
                  run(() =>
                    api.updateProjectStage(detail.id, stage.id, { status: "waiting_external", blockedReason: reason }),
                  )
                }
                onResume={(stage) => run(() => api.updateProjectStage(detail.id, stage.id, { status: "active" }))}
                onSignOff={signOff}
                onDeliver={deliver}
                onSaveOutputs={saveOutputs}
                key={selectedStage.id}
              />
            )}
          </div>
        ) : null}

        {tab === "data" ? (
          <ProjectData
            detail={detail}
            stages={stages}
            vocabulary={known}
            busy={busy}
            onSave={saveValues}
            key={`data-${version}`}
          />
        ) : null}

        {tab === "files" ? (
          <section className="project-sec">
            <ProjectFiles projectId={detail.id} areas={areas} />
          </section>
        ) : null}

        {tab === "requests" ? (
          <section className="project-sec">
            {detail.requests.length === 0 ? (
              <p className="project-note">Ninguna: este proyecto se capturó directo, no salió de una solicitud.</p>
            ) : (
              <ul className="project-requests">
                {detail.requests.map((request) => (
                  <li key={request.id}>
                    <span className="project-label">{request.folio}</span>
                    {request.title}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      {newStage !== null ? (
        <StageModal
          etapa={newStage}
          areas={areas}
          miembros={newStageMembers}
          vocabulario={[...known.entries()].map(([key, field]) => ({
            key,
            name: field.name,
            type: field.type,
          }))}
          etiquetaPersona="Persona responsable"
          sinPersona="Sin responsable todavía"
          onCambiar={changeNewStage}
          onClose={() => setNewStage(null)}
          onSubmit={addStage}
          onDatoNuevo={(one) => setRegistered((current) => [...current, one])}
        >
          <StageExtras draft={newStage} phases={phases} onChange={changeNewStage} />
        </StageModal>
      ) : null}
    </section>
  );
}

export default ProjectDetail;
