// A project at full screen, with its live flow, its stages, its values and the requests it
// answers. It opens over the list and over the sidebar because it carries a process with many
// parts at once and, opened under its row, it was cut short.
//
// The two vocabularies of state exist because of DATAMODEL.md §8.1 and do not touch: the status is
// the one from the catalog coordination edits live, moved by a hand; the state of the work is the
// stage machine, moved by a sign-off. A project can say "Recibido" with every stage concluded, so
// the screen shows them side by side: it is the only way for the contradiction to be seen instead
// of hidden.
//
// A project has no "current stage": the current stage is the set of open stages, because one
// project can be in two areas at once (RF-FLW-09). That is why the flow is shown whole, phase by
// phase and with its attempt: when a sign-off rejects, the stage closes and opens again as the
// next attempt, and both stay in sight.
//
// `done` is never set by hand: a sign-off closes a stage (RF-FLW-03), and a sign-off that leaves
// its phase with nothing open starts the next phase in the same statement (§2.12). Concluding the
// project lives at the end of the flow, not in the footer, because it is the walk's last step.
//
// Cancelling a stage is not offered: it is not a feature of the system, even though the API takes
// it.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate, daysBetween } from "../shared/format.js";
import { nameOfKey } from "../shared/vocabulary.js";
import Help from "../shared/help.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import FolderBrowser from "../documents/folderBrowser.jsx";
import StageModal from "../FlowDesigner/StageModal.jsx";
import StageDelivery from "./stageDelivery.jsx";
import "./projectDetail.css";

const STAGE_STATES = {
  pending: "Pendiente",
  active: "Activa",
  waiting_external: "En espera",
  done: "Concluida",
  cancelled: "Cancelada",
};

const OPEN_STATES = ["active", "waiting_external"];

/** What is being waited on from a third party, said the way people say it (RF-FLW-07). */
const REASONS = [
  "Visto bueno de la entidad",
  "Información de la entidad",
  "Material o proveedor",
  "Pago o anticipo",
];

/**
 * Two keys that come from no format: finance asks for them through its own endpoint, and here they
 * read like any other value of the project.
 */
const FINANCE_KEYS = {
  requiere_factura: { name: "Requiere factura", type: "boolean" },
  requiere_cotizacion: { name: "Requiere cotización", type: "boolean" },
};

/** A key's name and type, looking at the vocabulary and at the two finance ones. */
function fieldOfKey(vocabulary, key) {
  const financeKey = FINANCE_KEYS[key];
  if (financeKey !== undefined) {
    return { code: key, ...financeKey };
  }
  const fromVocabulary = vocabulary.get(key);
  if (fromVocabulary === undefined) {
    return { code: key, name: key, type: "text" };
  }
  return { code: key, name: fromVocabulary.name, type: fromVocabulary.type };
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
  return [...phases.values()].sort((one, other) => one.seq - other.seq);
}

/** Whether a key already has a value: it is what the sign-off demands (RF-FLW-06). */
function hasValue(fieldValues, key) {
  return fieldValues.some((value) => value.key === key && value.value !== "");
}

/**
 * The two vocabularies of state, side by side, and the warning when they contradict each other.
 * They are not merged on purpose; what can be done is to make them visible.
 */
function HowItIs({ detail, statuses, busy, onStatus }) {
  const openStages = detail.stages.filter((stage) => OPEN_STATES.includes(stage.status));
  const doneStages = detail.stages.filter((stage) => stage.status === "done");

  let work = "Todavía sin etapas: se agregan al final del flujo.";
  if (openStages.length > 0) {
    work = `Se trabaja en ${openStages
      .map((stage) => `${stage.title} (${stage.areaName})`)
      .join(", ")}.`;
  } else if (doneStages.length > 0) {
    work = `Ninguna etapa abierta; ${doneStages.length} ${
      doneStages.length === 1 ? "concluida" : "doneStages"
    }.`;
  }

  const workFinished =
    detail.stages.length > 0 && openStages.length === 0 && doneStages.length > 0;
  const statusSaysSo = detail.statusIsTerminal || detail.closedAt !== null;

  return (
    <section className="project-how">
      <div className="project-how-half">
        <h3>Estatus</h3>
        <select
          value={detail.statusId}
          onChange={(event) => onStatus(event.target.value)}
          disabled={busy}
        >
          {statuses.map((one) => (
            <option value={one.id} key={one.id}>
              {one.label}
              {one.isGlobal ? "" : ` (${one.areaName})`}
            </option>
          ))}
        </select>
        <p className="project-note">
          Desde {shortDate(detail.statusSince)}. 
        </p>
      </div>

      <div className="project-how-half">
        <h3>Estado del trabajo</h3>
        <p className="project-how-work">{work}</p>
      </div>

      {workFinished && !statusSaysSo ? (
        <p className="project-warn">
          El trabajo ya no tiene etapas abiertas, pero el estatus sigue en «{detail.statusLabel}».
          Nada lo mueve solo.
        </p>
      ) : null}
    </section>
  );
}

/** A stage card in the flow, with its state and what it owes. */
function StageCard({ stage, fieldValues, vocabulary, selected, onSelect }) {
  let className = `project-card is-${stage.status}`;
  if (selected) {
    className += " is-selected";
  }

  return (
    <button className={className} type="button" onClick={() => onSelect(stage.id)}>
      <span className="project-card-area">{stage.areaName}</span>
      <strong>{stage.title}</strong>
      <span className="project-card-meta">
        {STAGE_STATES[stage.status] ?? stage.status}
        {stage.attempt > 1 ? ` · intento ${stage.attempt}` : ""}
        {stage.assignedToName === null ? "" : ` · ${stage.assignedToName}`}
        {stage.startedAt !== null && stage.endedAt !== null
          ? ` · ${daysBetween(stage.startedAt, stage.endedAt)} d`
          : ""}
      </span>
      {stage.outputs.length === 0 ? null : (
        <span className="project-card-outputs">
          {stage.outputs.map((key) => (
            <span
              className={
                hasValue(fieldValues, key) ? "project-owed is-done" : "project-owed"
              }
              key={key}
            >
              {nameOfKey(vocabulary, key)}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

/**
 * The live flow: phase after phase, and at the end the FIN column, where the project is concluded.
 * It is the designer's canvas, with each stage's state.
 */
function LiveFlow({
  detail, phases, vocabulary, selected, busy, openStages,
  onSelect, onAdd, onConclude, onArchiveClosed,
}) {
  const [alsoArchive, setTambienArchivar] = useState(false);

  return (
    <div className="project-flow">
      {phases.map((phase, index) => (
        <Fragment key={phase.seq}>
          {index > 0 ? <div className="project-flow-arrow" /> : null}
          <div className="project-flow-phase">
            <span className="project-flow-phase-name">
              FASE {index + 1}
              {phase.name === null ? "" : ` · ${phase.name}`}
            </span>
            {phase.stages.map((stage) => (
              <StageCard
                stage={stage}
                fieldValues={detail.fieldValues}
                vocabulary={vocabulary}
                selected={stage.id === selected}
                onSelect={onSelect}
                key={stage.id}
              />
            ))}
          </div>
        </Fragment>
      ))}

      {phases.length > 0 ? <div className="project-flow-arrow" /> : null}

      <div className="project-flow-phase">
        <span className="project-flow-phase-name">Agregar</span>
        <button className="project-card-add" type="button" onClick={onAdd} disabled={busy}>
          + Agregar etapa
        </button>
      </div>

      <div className="project-flow-arrow" />

      <div className="project-flow-phase project-flow-end">
        <span className="project-flow-phase-name">FIN</span>
        {detail.closedAt === null ? (
          <div className="project-card is-end">
            <button
              className="project-btn is-primary"
              type="button"
              onClick={() => onConclude(alsoArchive)}
              disabled={busy || openStages.length > 0}
            >
              Concluir proyecto
            </button>
            <label className="project-check">
              <input
                type="checkbox"
                checked={alsoArchive}
                onChange={(event) => setTambienArchivar(event.target.checked)}
              />
              y archivarlo
              <Help text="Concluir dice que el trabajo terminó. Archivar lo quita de en medio sin decir nada del trabajo; se puede archivar después." />
            </label>
            {openStages.length > 0 ? (
              <span className="project-card-why">
                {openStages.length} {openStages.length === 1 ? "etapa sigue abierta" : "etapas siguen abiertas"}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="project-card is-done">
            <strong>Concluido</strong>
            <span className="project-card-meta">{shortDate(detail.closedAt)}</span>
            {detail.archivedAt === null ? (
              <button
                className="project-btn"
                type="button"
                onClick={onArchiveClosed}
                disabled={busy}
              >
                Archivar
              </button>
            ) : (
              <span className="project-card-meta">
                Archivado el {shortDate(detail.archivedAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
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
 * The selected stage, under the flow: what it asks for, what it owes and what can be done with it.
 * What can be done depends on the stage's state and on who is looking at it.
 */
function StagePanel({
  stage, detail, phases, vocabulary, user, people, busy, missing, nextPhase,
  onAssignee, onHold, onResume, onStart, onSignOff, onDeliver,
}) {
  const [reason, setMotivo] = useState("");
  const [waiting, setEsperando] = useState(false);
  const [signOff, setFirma] = useState(null);

  const phaseIndex = phases.findIndex((phase) => phase.seq === stage.seq);

  let signOffEffect = `Aprobar concluye la etapa${
    nextPhase === null
      ? " y, si no queda nada abierto en su fase, el proyecto se puede concluir."
      : ` y, si no queda nada abierto en su fase, abre la fase ${
          phaseIndex + 2
        } (${nextPhase.stages.map((one) => one.areaName).join(", ")}).`
  } Rechazar: la etapa vuelve como intento ${stage.attempt + 1}.`;
  if (missing !== null) {
    signOffEffect = `No disponible: falta ${missing}.`;
  }

  return (
    <section className="project-stage">
      <header className="project-stage-head">
        <span className="project-stage-place">
          FASE {phaseIndex + 1}
          {stage.phaseName === null ? "" : ` · ${stage.phaseName}`} · {stage.areaName}
        </span>
        <h3>
          {stage.title}
          <span className={`project-stage-state is-${stage.status}`}>
            {STAGE_STATES[stage.status] ?? stage.status}
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

      <div className="project-stage-columns">
        <div>
          <h4>Lo que pide la etapa</h4>

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
              {people.map((persona) => (
                <option value={persona.id} key={persona.id}>
                  {persona.fullName}
                </option>
              ))}
            </select>
          </div>

          <h5>Necesita</h5>
          {stage.inputs.length === 0 ? (
            <p className="project-note">Nada de otra etapa.</p>
          ) : (
            <ul className="project-io">
              {stage.inputs.map((key) => {
                const value = detail.fieldValues.find((one) => one.key === key);
                return (
                  <li key={key}>
                    <span className="project-label">{nameOfKey(vocabulary, key)}</span>
                    {value === undefined || value.value === "" ? (
                      <span className="project-missing">sin valor todavía</span>
                    ) : (
                      <span className="project-value">{value.value}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <h5>
            Entrega{" "}
            {stage.outputs.length === 0
              ? ""
              : `${stage.outputs.filter((key) => hasValue(detail.fieldValues, key)).length} de ${stage.outputs.length}`}
          </h5>
          {stage.outputs.length === 0 ? (
            <p className="project-note">Nada que otra etapa espere.</p>
          ) : (
            <ul className="project-io">
              {stage.outputs.map((key) => {
                const value = detail.fieldValues.find((one) => one.key === key);
                return (
                  <li key={key}>
                    <span className="project-label">{nameOfKey(vocabulary, key)}</span>
                    {value === undefined || value.value === "" ? (
                      <span className="project-missing">sin valor todavía</span>
                    ) : (
                      <span className="project-value">{value.value}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="project-note">
            Los valores se capturan abajo, en «Valores del proyecto», y se guardan con todo lo
            demás.
          </p>

          <StageDelivery
            key={stage.id}
            stage={stage}
            busy={busy}
            onDeliver={(note, file) => onDeliver(stage, note, file)}
          />
        </div>

        <div>
          <h4>Acciones</h4>

          {stage.status === "pending" ? (
            <div className="project-action">
              <button
                className="project-btn"
                type="button"
                onClick={() => onStart(stage)}
                disabled={busy}
              >
                Iniciar ahora
              </button>
              <p className="project-note">
                Empieza sola cuando concluya la fase anterior. Iniciar ahora es la excepción.
              </p>
            </div>
          ) : null}

          {stage.status === "waiting_external" ? (
            <div className="project-action">
              <button
                className="project-btn is-primary"
                type="button"
                onClick={() => onResume(stage)}
                disabled={busy}
              >
                Ya respondieron: reanudar
              </button>
              <p className="project-note">Vuelve a quedar activa, con su mismo intento.</p>
            </div>
          ) : null}

          {stage.status === "active" ? (
            <div className="project-action">
              {waiting ? (
                <form
                  className="project-wait"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onHold(stage, reason);
                    setEsperando(false);
                    setMotivo("");
                  }}
                >
                  <h5>Poner en espera</h5>
                  <p className="project-note">
                    La etapa sigue siendo de su área, pero el tiempo que pase esperando queda
                    dicho, no escondido.
                  </p>
                  <div className="project-chips">
                    {REASONS.map((one) => (
                      <button
                        className={reason === one ? "project-chip is-on" : "project-chip"}
                        type="button"
                        onClick={() => setMotivo(one)}
                        key={one}
                      >
                        {one}
                      </button>
                    ))}
                  </div>
                  <input
                    value={reason}
                    onChange={(event) => setMotivo(event.target.value)}
                    placeholder="Ej: esperamos el visto bueno de la facultad"
                  />
                  <div className="project-action-row">
                    <button
                      className="project-quiet"
                      type="button"
                      onClick={() => setEsperando(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="project-btn"
                      type="submit"
                      disabled={busy || reason.trim() === ""}
                    >
                      Poner en espera
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <button
                    className="project-btn"
                    type="button"
                    onClick={() => setEsperando(true)}
                    disabled={busy}
                  >
                    Poner en espera
                    <Help text="Para cuando lo que falta no está en nuestras manos: un visto bueno de la entidad, material de un proveedor, un anticipo." />
                  </button>
                  <p className="project-note">Pide el motivo y lo deja a la vista.</p>
                </>
              )}
            </div>
          ) : null}

          {OPEN_STATES.includes(stage.status) ? (
            <div className="project-action">
              {signOff === null ? (
                <>
                  <button
                    className="project-btn is-primary"
                    type="button"
                    onClick={() => setFirma({ decision: "approved", comment: "" })}
                    disabled={busy || missing !== null}
                  >
                    Visto bueno
                  </button>
                  <p className={missing === null ? "project-note" : "project-note is-blocked"}>
                    {signOffEffect}
                  </p>
                </>
              ) : (
                <form
                  className="project-sign"
                  onSubmit={(event) => {
                    event.preventDefault();
                    onSignOff(stage, signOff);
                    setFirma(null);
                  }}
                >
                  <h5>Visto bueno de «{stage.title}»</h5>
                  <div className="project-field">
                    <span className="project-label">Decisión</span>
                    <select
                      value={signOff.decision}
                      onChange={(event) => setFirma({ ...signOff, decision: event.target.value })}
                    >
                      <option value="approved">Aprobar</option>
                      <option value="rejected">Rechazar</option>
                    </select>
                  </div>
                  <p className="project-note">
                    {signOff.decision === "approved"
                      ? signOffEffect
                      : `La etapa se cierra y vuelve a abrirse como intento ${
                          stage.attempt + 1
                        }, para que el trabajo devuelto quede a la vista.`}
                  </p>
                  <div className="project-field">
                    <span className="project-label">
                      Comentario
                      <Help text="La conformidad del solicitante va aquí: el visto bueno es interno." />
                    </span>
                    <textarea
                      value={signOff.comment}
                      onChange={(event) => setFirma({ ...signOff, comment: event.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="project-action-row">
                    <button className="project-quiet" type="button" onClick={() => setFirma(null)}>
                      Cancelar
                    </button>
                    <button className="project-btn is-primary" type="submit" disabled={busy}>
                      Registrar
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          <h5>Vistos buenos</h5>
          {stage.approvals.length === 0 ? (
            <p className="project-note">Ninguno todavía.</p>
          ) : (
            <ul className="project-approvals">
              {stage.approvals.map((visto) => (
                <li key={visto.id}>
                  <span className="project-label">
                    {visto.decision === "approved" ? "Aprobó" : "Rechazó"} {visto.approverName} ·{" "}
                    {shortDate(visto.decidedAt)}
                  </span>
                  {visto.comment === null ? null : <span>{visto.comment}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** Adding a stage: the phase is chosen by its name, not by a presentation number. */
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
        <select
          id="stage-phase"
          value={draft.seq}
          onChange={(event) => onChange("seq", event.target.value)}
        >
          {phases.map((phase, index) => (
            <option value={phase.seq} key={phase.seq}>
              {index + 1}
              {phase.name === null ? "" : ` · ${phase.name}`}, en paralelo con lo que ya tiene
            </option>
          ))}
          <option value={lastSeq + 1}>Fase nueva, al final</option>
        </select>
      </div>

      <div className="modal-field">
        <label htmlFor="stage-start">Empieza</label>
        <select
          id="stage-start"
          value={draft.status}
          onChange={(event) => onChange("status", event.target.value)}
        >
          <option value="pending">Pendiente</option>
          <option value="active">Activa</option>
        </select>
      </div>
    </>
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
  const [detail, setDetalle] = useState(null);
  const [draft, setBorrador] = useState(null);
  const [statuses, setEstatus] = useState(initialStatuses ?? []);
  const [people, setGente] = useState([]);
  const [selected, setElegida] = useState(null);
  const [newStage, setNewStage] = useState(null);
  const [newStageMembers, setNewStageMembers] = useState([]);
  const [newKey, setClaveNueva] = useState("");
  const [confirmingArchive, setConfirmandoArchivo] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setOcupado] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await api.getProject(project.id);
        if (cancelled) {
          return;
        }
        setDetalle(response.project);
        setBorrador(draftFrom(response.project));

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
        setEstatus([...byId.values()]);
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
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectedStage =
    detail === null ? null : detail.stages.find((stage) => stage.id === selected) ?? null;
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
    let cancelled = false;

    async function loadPeople() {
      if (stageAreaId === null) {
        return;
      }
      try {
        const response = await api.listUsers({ areaId: stageAreaId });
        if (!cancelled) {
          setGente(response.users);
        }
      } catch (failure) {
        if (!cancelled) {
          setError(failure.message);
        }
      }
    }

    loadPeople();
    return () => {
      cancelled = true;
    };
  }, [stageAreaId]);

  /** The draft: what is editable in the project and its values, as they stand saved. */
  function draftFrom(actual) {
    const values = {};
    for (const value of actual.fieldValues) {
      values[value.key] = value.value;
    }
    return {
      title: actual.title,
      requester: actual.requester ?? "",
      priority: String(actual.priority),
      startsOn: actual.startsOn ?? "",
      dueOn: actual.dueOn ?? "",
      hasCost: actual.hasCost,
      values,
    };
  }

  async function reload() {
    const response = await api.getProject(project.id);
    setDetalle(response.project);
    setBorrador(draftFrom(response.project));
    onChanged();
    return response.project;
  }

  async function run(action) {
    setOcupado(true);
    setError(null);
    try {
      await action();
      return await reload();
    } catch (failure) {
      setError(failure.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  function write(key, value) {
    setBorrador((actual) => ({ ...actual, [key]: value }));
  }

  function writeValue(key, value) {
    setBorrador((actual) => ({ ...actual, values: { ...actual.values, [key]: value } }));
  }

  function addKey(key) {
    if (key === "") {
      return;
    }
    writeValue(key, "");
    setClaveNueva("");
  }

  if (detail === null) {
    return (
      <section className="project-full">
        <p className="project-loading">{error ?? "Abriendo el proyecto…"}</p>
      </section>
    );
  }

  const saved = draftFrom(detail);
  const changed = [];
  for (const key of ["title", "requester", "priority", "startsOn", "dueOn", "hasCost"]) {
    if (String(draft[key]) !== String(saved[key])) {
      changed.push(key);
    }
  }
  for (const key of Object.keys(draft.values)) {
    if (String(draft.values[key] ?? "") !== String(saved.values[key] ?? "")) {
      changed.push(key);
    }
  }
  const dirty = changed.length > 0;

  function mark(key, base) {
    return changed.includes(key) ? `${base} is-changed` : base;
  }

  async function save() {
    const changes = {};
    if (draft.title !== saved.title) {
      changes.title = draft.title;
    }
    if (draft.requester !== saved.requester) {
      changes.requester = draft.requester;
    }
    if (draft.priority !== saved.priority) {
      changes.priority = Number(draft.priority);
    }
    if (draft.startsOn !== saved.startsOn) {
      changes.startsOn = draft.startsOn === "" ? null : draft.startsOn;
    }
    if (draft.dueOn !== saved.dueOn) {
      changes.dueOn = draft.dueOn === "" ? null : draft.dueOn;
    }
    if (draft.hasCost !== saved.hasCost) {
      changes.hasCost = draft.hasCost;
    }

    await run(async () => {
      if (Object.keys(changes).length > 0) {
        await api.updateProject(detail.id, changes);
      }
      for (const key of Object.keys(draft.values)) {
        const before = saved.values[key];
        const now = draft.values[key];
        if (String(now ?? "") === String(before ?? "")) {
          continue;
        }
        if (now === "" || now === null || now === undefined) {
          if (before !== undefined) {
            await api.deleteFieldValue(detail.id, key);
          }
          continue;
        }
        await api.setFieldValue(detail.id, key, String(now));
      }
    });
  }

  async function signOff(stage, signOff) {
    const after = await run(() =>
      api.createApproval(detail.id, stage.id, {
        decision: signOff.decision,
        comment: signOff.comment || undefined,
      }),
    );
    if (after !== null) {
      const isOpen = after.stages.find((one) => OPEN_STATES.includes(one.status));
      setElegida(isOpen === undefined ? null : isOpen.id);
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

  const phases = phasesOf(detail.stages);
  const openStages = detail.stages.filter((stage) => OPEN_STATES.includes(stage.status));

  let missing = null;
  let nextPhase = null;
  if (selectedStage !== null) {
    const pending = selectedStage.outputs.find(
      (key) => !hasValue(detail.fieldValues, key),
    );
    missing = pending === undefined ? null : nameOfKey(vocabulary, pending);

    const index = phases.findIndex((phase) => phase.seq === selectedStage.seq);
    nextPhase = phases[index + 1] ?? null;
  }

  const keys = Object.keys(draft.values);
  const toAdd = [...vocabulary.entries()].filter(([key]) => !keys.includes(key));

  let projectFlow = "sin flujo";
  if (phases.length > 0) {
    projectFlow = `${phases.length} ${phases.length === 1 ? "fase" : "fases"}`;
  }

  let state = "abierto";
  if (detail.archivedAt !== null) {
    state = "archivado";
  } else if (detail.closedAt !== null) {
    state = "concluido";
  }

  return (
    <section className="project-full">
      <header className="project-bar">
        <button
          className="project-close"
          type="button"
          onClick={onClose}
          aria-label="Volver a la lista"
        >
          ✕
        </button>

        <div className="project-bar-text">
          <span className="project-bar-eyebrow">
            {detail.key} · {detail.requests.length === 0 ? "captura directa" : "de una solicitud"}{" "}
            · {projectFlow} · {state}
          </span>
          <h2>{detail.title}</h2>
        </div>

        {place === null ? null : (
          <div className="project-bar-move">
            <span>
              {place.position} de {place.total}
            </span>
            <button
              className="project-quiet"
              type="button"
              onClick={onPrevious}
              disabled={onPrevious === null}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              className="project-quiet"
              type="button"
              onClick={onNext}
              disabled={onNext === null}
              aria-label="Siguiente"
            >
              ›
            </button>
          </div>
        )}
      </header>

      <div className="project-body">
        {error !== null ? <p className="project-error">{error}</p> : null}

        <HowItIs
          detail={detail}
          statuses={statuses}
          busy={busy}
          onStatus={(value) => run(() => api.setProjectStatus(detail.id, Number(value)))}
        />

        <section className="project-sec">
          <h3>Flujo</h3>
          <LiveFlow
            detail={detail}
            phases={phases}
            vocabulary={vocabulary}
            selected={selected}
            busy={busy}
            openStages={openStages}
            onSelect={(id) => setElegida(id === selected ? null : id)}
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
        </section>

        {newStage !== null ? (
          <StageModal
            etapa={newStage}
            areas={areas}
            miembros={newStageMembers}
            vocabulario={[...vocabulary.entries()].map(([key, field]) => ({
              key,
              name: field.name,
              type: field.type,
            }))}
            etiquetaPersona="Persona responsable"
            sinPersona="Sin responsable todavía"
            onCambiar={changeNewStage}
            onClose={() => setNewStage(null)}
            onSubmit={addStage}
          >
            <StageExtras draft={newStage} phases={phases} onChange={changeNewStage} />
          </StageModal>
        ) : null}

        {selectedStage === null ? null : (
          <StagePanel
            stage={selectedStage}
            detail={detail}
            phases={phases}
            vocabulary={vocabulary}
            user={user}
            people={people}
            busy={busy}
            missing={missing}
            nextPhase={nextPhase}
            onAssignee={(stage, value) =>
              run(() =>
                api.updateProjectStage(detail.id, stage.id, {
                  assignedTo: value === "" ? null : Number(value),
                }),
              )
            }
            onStart={(stage) =>
              run(() => api.updateProjectStage(detail.id, stage.id, { status: "active" }))
            }
            onHold={(stage, reason) =>
              run(() =>
                api.updateProjectStage(detail.id, stage.id, {
                  status: "waiting_external",
                  blockedReason: reason,
                }),
              )
            }
            onResume={(stage) =>
              run(() => api.updateProjectStage(detail.id, stage.id, { status: "active" }))
            }
            onSignOff={signOff}
            onDeliver={deliver}
          />
        )}

        <div className="project-columns">
          <section className="project-sec">
            <h3>Proyecto</h3>
            <div className="project-grid">
              <label className={mark("title", "project-field")}>
                <span className="project-label">Título</span>
                <input
                  value={draft.title}
                  onChange={(event) => write("title", event.target.value)}
                />
              </label>

              <label className={mark("requester", "project-field")}>
                <span className="project-label">Entidad solicitante</span>
                <input
                  value={draft.requester}
                  onChange={(event) => write("requester", event.target.value)}
                />
              </label>

              <label className={mark("priority", "project-field")}>
                <span className="project-label">
                  Urgencia
                  <Help text="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
                </span>
                <input
                  type="number"
                  value={draft.priority}
                  onChange={(event) => write("priority", event.target.value)}
                />
              </label>

              <label className={mark("startsOn", "project-field")}>
                <span className="project-label">Empieza</span>
                <input
                  type="date"
                  value={draft.startsOn}
                  onChange={(event) => write("startsOn", event.target.value)}
                />
              </label>

              <label className={mark("dueOn", "project-field")}>
                <span className="project-label">Entrega</span>
                <input
                  type="date"
                  value={draft.dueOn}
                  onChange={(event) => write("dueOn", event.target.value)}
                />
              </label>

              <label className={mark("hasCost", "project-check")}>
                <input
                  type="checkbox"
                  checked={draft.hasCost}
                  onChange={(event) => write("hasCost", event.target.checked)}
                />
                Con costo
              </label>
            </div>
          </section>

          <section className="project-sec">
            <h3>
              Valores del proyecto
              <Help text="Lo que una etapa produce y otra lee sin recapturar (RF-FLW-06): el número de orden, el folio del SIN, el pantone." />
            </h3>

            {keys.length === 0 ? (
              <p className="project-note">Todavía ninguno.</p>
            ) : (
              <div className="project-grid">
                {keys.map((key) => {
                  const field = fieldOfKey(vocabulary, key);
                  const savedHere = detail.fieldValues.find((one) => one.key === key);

                  let origin = "nuevo, sin guardar";
                  if (savedHere !== undefined) {
                    const stage = detail.stages.find(
                      (one) => one.id === savedHere.producedByStageId,
                    );
                    origin =
                      savedHere.producedByStageId === null
                        ? "de la solicitud"
                        : `lo produjo ${stage?.title ?? "one stage"}`;
                  }

                  return (
                    <div className={mark(key, "project-typed")} key={key}>
                      <FieldInput
                        field={field}
                        value={draft.values[key]}
                        onChange={(value) => writeValue(key, value)}
                      />
                      <span className="project-origin">{origin}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="project-add-value">
              <select value={newKey} onChange={(event) => addKey(event.target.value)}>
                <option value="">Agregar un dato…</option>
                {toAdd.map(([key, field]) => (
                  <option value={key} key={key}>
                    {field.name}
                  </option>
                ))}
                {Object.keys(FINANCE_KEYS)
                  .filter((key) => !keys.includes(key))
                  .map((key) => (
                    <option value={key} key={key}>
                      {FINANCE_KEYS[key].name}
                    </option>
                  ))}
              </select>
            </div>
          </section>
        </div>

        <section className="project-sec">
          <h3>Archivos</h3>
          <ProjectFiles projectId={detail.id} areas={areas} />
        </section>

        <section className="project-sec">
          <h3>Solicitudes que contesta</h3>
          {detail.requests.length === 0 ? (
            <p className="project-note">
              Ninguna: este proyecto se capturó directo, no salió de una solicitud.
            </p>
          ) : (
            <ul className="project-requests">
              {detail.requests.map((solicitud) => (
                <li key={solicitud.id}>
                  <span className="project-label">{solicitud.folio}</span>
                  {solicitud.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="project-foot">
        {detail.archivedAt !== null ? (
          <p className="project-note">Archivado el {shortDate(detail.archivedAt)}.</p>
        ) : confirmingArchive ? (
          <div className="project-action-row">
            <span className="project-confirm">
              Se quita de en medio. No dice nada del work y se puede volver a ver en
              «Archivados».
            </span>
            <button
              className="project-btn"
              type="button"
              onClick={() => run(() => api.archiveProject(detail.id))}
              disabled={busy}
            >
              Archivar
            </button>
            <button
              className="project-quiet"
              type="button"
              onClick={() => setConfirmandoArchivo(false)}
            >
              Dejarlo
            </button>
          </div>
        ) : (
          <button
            className="project-quiet"
            type="button"
            onClick={() => setConfirmandoArchivo(true)}
            disabled={busy}
          >
            Archivar
          </button>
        )}

        <div className="project-foot-right">
          {dirty ? (
            <>
              <span className="project-dirty">
                {changed.length} {changed.length === 1 ? "cambio" : "cambios"} sin save
              </span>
              <button
                className="project-btn"
                type="button"
                onClick={() => setBorrador(draftFrom(detail))}
                disabled={busy}
              >
                Descartar
              </button>
            </>
          ) : null}
          <button
            className="project-btn is-primary"
            type="button"
            onClick={save}
            disabled={busy || !dirty}
          >
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </footer>
    </section>
  );
}

export default ProjectDetail;
