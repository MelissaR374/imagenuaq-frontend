// A request opened in place, under its row in the inbox, and the step into a project.
//
// The walk strip is the one in DATAMODEL.md §8.2 seen from a single request: which step it is on
// and what it needs for the next. It is here because steps 2 and 3 are moved by a hand and not by
// an automatism, so the screen has to say whose hand it is and what is theirs; otherwise the
// request sits still and nobody knows why.
//
// Everything editable is saved together, in one PATCH: people fill formats wrongly, and correcting
// one field at a time left half-saved what was still being thought through. What changed is marked
// amber, the footer counts the changes, and the blue action is "Guardar cambios" while there is
// something to save and "Convertir en proyecto" when there is not. The status is the exception: it
// has its own endpoint and is saved as soon as it is chosen.
//
// An imported request can arrive without a value its format marks required, because the tracker's
// row had it empty. It is said at the top, captured right here, and what is refused until it
// exists is turning the request into a project, the last moment where that is still cheap.
//
// What was captured is shown with the fields of the format it was captured with, not today's: a
// published version is not edited, so an old request keeps reading as it was filled. Anything that
// came from a sheet also carries its raw row, with the columns the mapping ignored (RF-SOL-06).
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import FlowDesigner from "../FlowDesigner/FlowDesigner.jsx";
import Help from "../shared/help.jsx";
import RequesterInput from "./requesterInput.jsx";
import "./requestDetail.css";

/**
 * The steps of the walk that belong to a request. Step 1 has already happened if we are looking at
 * it; from 5 on they belong to the project and are seen on its own screen.
 */
const WALK = [
  {
    key: "nacio",
    title: "Recibida",
    moves: "Se capturó a mano o llegó de un libro de Excel.",
  },
  {
    key: "repartir",
    title: "Con flujo",
    moves:
      "Falta decidir por qué áreas va a pasar: aplícale una plantilla, diséñale su flujo o asígnale un área.",
  },
  {
    key: "atender",
    title: "En atención",
    moves:
      "Las áreas de la primera fase la tienen en su bandeja y mueven el estatus conforme avanza.",
  },
  {
    key: "convertir",
    title: "Proyecto",
    moves: "Ya es un proyecto: se llevó su flujo y todos los datos capturados.",
  },
];

/** How it arrived, in words. */
const SOURCES = {
  manual: "Captura directa",
  email: "Correo",
  form: "Formulario",
  sheet: "Excel",
};

/**
 * Which step is the current one. A converted request has been through all of them, even if its
 * status still says "Recibido" (DATAMODEL.md §8.4, seam 1). One with an area assigned by hand,
 * from before flows existed, counts as routed.
 */
function currentStepOf(detail) {
  if (detail.projectId !== null) {
    return "convertir";
  }
  const hasFlow = Boolean(detail.flow) || Boolean(detail.hasFlow);
  if (!hasFlow && detail.areaId === null) {
    return "repartir";
  }
  return "atender";
}

/** The areas of the flow's first phase: the ones that receive it (DATAMODEL.md §2.5). */
function firstPhaseAreasOf(flow) {
  if (!flow || flow.phases.length === 0) {
    return [];
  }
  return [...new Set(flow.phases[0].stages.map((stage) => stage.areaId))];
}

/** A captured value as readable text: booleans as sí/no and everything else as it is. */
function readable(value) {
  if (value === null || value === undefined || value === "") {
    return "Sin valor todavía";
  }
  if (value === true) {
    return "Sí";
  }
  if (value === false) {
    return "No";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * The walk strip. The current step is marked and is the only one that explains what moves it: the
 * others have passed or are not due yet.
 */
function Walk({ currentStep }) {
  const currentIndex = WALK.findIndex((step) => step.key === currentStep);
  const current = WALK[currentIndex];

  return (
    <>
      <ol className="request-detail-walk">
        {WALK.map((step, index) => {
          let state = "pending";
          if (index < currentIndex) {
            state = "done";
          }
          if (index === currentIndex) {
            state = "current";
          }

          return (
            <li className={`request-detail-walk-step is-${state}`} key={step.key}>
              {step.title}
            </li>
          );
        })}
      </ol>
      <p className="request-detail-walk-says">{current.moves}</p>
    </>
  );
}

/**
 * The flow at full width: phase after phase, a card per stage and arrows between them. It is the
 * designer's dotted canvas, here only to be read.
 */
function FullWidthFlow({ flow }) {
  return (
    <div className="request-detail-flow-canvas">
      {flow.phases.map((phase, index) => (
        <Fragment key={phase.id}>
          {index > 0 ? <div className="request-detail-flow-arrow" /> : null}
          <div className="request-detail-flow-phase">
            <span className="request-detail-flow-phase-name">
              FASE {index + 1} · {phase.name}
            </span>
            {phase.stages.map((stage) => (
              <article
                className={
                  index === 0
                    ? "request-detail-flow-card is-first"
                    : "request-detail-flow-card"
                }
                key={stage.id}
              >
                <span className="request-detail-flow-card-area">{stage.areaName}</span>
                <strong>{stage.title}</strong>
                <span className="request-detail-flow-card-meta">
                  {stage.defaultAssigneeName ?? "Sin responsable"}
                  {stage.estimatedDays === null ? "" : ` · ${stage.estimatedDays} d`}
                </span>
              </article>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** The row as the sheet had it, ignored columns included (RF-SOL-06). */
function OriginalRow({ sourceData }) {
  return (
    <details className="request-detail-raw">
      <summary>El renglón como viene en el libro de Excel</summary>
      <dl className="request-detail-raw-list">
        {Object.keys(sourceData).map((columna) => (
          <Fragment key={columna}>
            <dt>{columna}</dt>
            <dd>{readable(sourceData[columna])}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}

/**
 * Step 4 of the walk, in the same place. Anything left empty is taken from the request; the stages
 * come from its flow. The key is left empty on purpose: the server numbers it, so two people
 * converting at once never collide on the same one.
 */
function ConversionForm({ data, flow, busy, onChange, onSubmit, onCancel }) {
  function change(key, value) {
    onChange({ ...data, [key]: value });
  }

  let flowNote =
    "Sin flujo: el proyecto nace sin etapas. Si ya sabes por qué áreas va a pasar, aplícale o diséñale su flujo antes de convertirla.";
  if (flow) {
    const stages = flow.phases.reduce((total, phase) => total + phase.stages.length, 0);
    flowNote = `El proyecto nace con el flujo de la solicitud: ${flow.phases.length} ${
      flow.phases.length === 1 ? "phase" : "fases"
    } y ${stages} ${stages === 1 ? "stage" : "stages"}. Las de la primera fase empiezan activas.`;
  }

  return (
    <form className="request-detail-convert" onSubmit={onSubmit}>
      <h3>
        Convertir en proyecto
        <Help text="Lo que se deje vacío se toma de la solicitud. Cada valor capturado pasa al proyecto con su clave, para que la orden de impresión y la facturación lo lean sin recapturar." />
      </h3>

      <div className="request-detail-grid">
        <label className="request-detail-field">
          <span className="request-detail-label">
            Llave del proyecto
            <Help text="Si se deja vacía, el servidor la numera como PRY-000001 al crear el proyecto. Escríbela solo si la coordinación ya usa una llave propia." />
          </span>
          <input
            value={data.key}
            onChange={(event) => change("key", event.target.value)}
            placeholder="Ej: PAPEL-FCQ-03"
          />
        </label>

        <label className="request-detail-field">
          <span className="request-detail-label">Título del proyecto</span>
          <input value={data.title} onChange={(event) => change("title", event.target.value)} />
        </label>

        <div className="request-detail-field">
          <span className="request-detail-label" id={`convertir-solicitante-${data.id}-label`}>
            Entidad solicitante
            <Help text="Este es el momento de corregir el nombre: el proyecto se queda con el que se escriba aquí." />
          </span>
          <RequesterInput
            id={`convertir-solicitante-${data.id}`}
            value={data.requester}
            onChange={(requester) => change("requester", requester)}
          />
        </div>

        <label className="request-detail-check">
          <input
            type="checkbox"
            checked={data.hasCost}
            onChange={(event) => change("hasCost", event.target.checked)}
          />
          Con costo
        </label>
      </div>

      <p className="request-detail-note">{flowNote}</p>

      <div className="request-detail-convert-actions">
        <button className="request-detail-btn" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="request-detail-btn is-primary" type="submit" disabled={busy}>
          {busy ? "Convirtiendo…" : "Crear el proyecto"}
        </button>
      </div>
    </form>
  );
}

function RequestDetail({ request, areas, onClose, onChanged }) {
  const [detail, setDetalle] = useState(request);
  const [draft, setBorrador] = useState(null);
  const [statuses, setEstatus] = useState([]);
  const [templates, setPlantillas] = useState([]);
  const [chosenTemplate, setPlantillaElegida] = useState("");
  const [error, setError] = useState(null);
  const [busy, setOcupado] = useState(false);
  const [conflicts, setConflictos] = useState([]);
  const [converting, setConvertir] = useState(null);
  const [designing, setDisenando] = useState(false);
  const [confirmingDelete, setConfirmandoBorrado] = useState(false);
  const [confirmingClearFlow, setConfirmandoQuitarFlujo] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [respuestaSolicitud, respuestaPlantillas] = await Promise.all([
          api.getRequest(request.id),
          api.listWorkflows(),
        ]);
        if (cancelled) {
          return;
        }
        setDetalle(respuestaSolicitud.request);
        setBorrador(draftFrom(respuestaSolicitud.request));
        setPlantillas(respuestaPlantillas.workflows);
        await loadStatuses(respuestaSolicitud.request, cancelled);
      } catch (failure) {
        if (!cancelled) {
          setError(failure.message);
        }
      }
    }

    /**
     * The statuses this request can take: the global ones plus those of every area that holds it.
     * With a flow there is no `areaId`, so the areas come from the first phase; asking only for
     * the global ones left out those of the area actually attending it.
     */
    async function loadStatuses(current, abortado) {
      const areaIds = firstPhaseAreasOf(current.flow ?? null);
      if (current.areaId !== null) {
        areaIds.push(current.areaId);
      }

      const responses = await Promise.all(
        areaIds.length === 0
          ? [api.listStatuses()]
          : [...new Set(areaIds)].map((areaId) => api.listStatuses({ areaId })),
      );
      if (abortado) {
        return;
      }

      const byId = new Map();
      for (const response of responses) {
        for (const one of response.statuses) {
          byId.set(one.id, one);
        }
      }
      setEstatus([...byId.values()]);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [request.id]);

  /** The draft: what is editable in the request, as it stands saved. */
  function draftFrom(current) {
    return {
      title: current.title,
      requester: current.requester ?? "",
      areaId: current.areaId === null ? "" : String(current.areaId),
      priority: String(current.priority),
      data: { ...(current.data ?? {}) },
    };
  }

  async function reload() {
    const response = await api.getRequest(detail.id);
    setDetalle(response.request);
    setBorrador(draftFrom(response.request));
    onChanged(response.request);
    return response.request;
  }

  function write(key, value) {
    setBorrador((current) => ({ ...current, [key]: value }));
  }

  function writeValue(code, value) {
    setBorrador((current) => ({ ...current, data: { ...current.data, [code]: value } }));
  }

  const isProject = detail.projectId !== null;

  let fields = [];
  if (detail.fields !== null && detail.fields !== undefined) {
    fields = [...detail.fields.deliverables, ...detail.fields.information];
  }

  /** What differs from what is saved: it is what gets the amber mark and what is counted. */
  const changed = [];
  if (draft !== null) {
    const saved = draftFrom(detail);
    for (const key of ["title", "requester", "areaId", "priority"]) {
      if (draft[key] !== saved[key]) {
        changed.push(key);
      }
    }
    for (const field of fields) {
      const before = saved.data[field.code] ?? "";
      const now = draft.data[field.code] ?? "";
      if (String(before) !== String(now)) {
        changed.push(field.code);
      }
    }
  }
  const dirty = changed.length > 0;

  function mark(key, base) {
    return changed.includes(key) ? `${base} is-changed` : base;
  }

  async function save() {
    const savedBefore = draftFrom(detail);
    const changes = {};
    if (draft.title !== savedBefore.title) {
      changes.title = draft.title;
    }
    if (draft.requester !== savedBefore.requester) {
      changes.requester = draft.requester;
    }
    if (draft.areaId !== savedBefore.areaId && draft.areaId !== "") {
      changes.areaId = Number(draft.areaId);
    }
    if (draft.priority !== savedBefore.priority) {
      changes.priority = Number(draft.priority);
    }
    if (fields.some((field) => changed.includes(field.code))) {
      changes.data = draft.data;
    }

    setOcupado(true);
    setError(null);
    try {
      await api.updateRequest(detail.id, changes);
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  function discard() {
    setBorrador(draftFrom(detail));
    setError(null);
  }

  async function changeStatus(statusId) {
    setOcupado(true);
    setError(null);
    try {
      await api.setRequestStatus(detail.id, Number(statusId));
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  async function applyTemplate() {
    setOcupado(true);
    setError(null);
    try {
      await api.setRequestFlow(detail.id, { workflowId: Number(chosenTemplate) });
      setPlantillaElegida("");
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  async function clearFlow() {
    setOcupado(true);
    setError(null);
    try {
      await api.clearRequestFlow(detail.id);
      setConfirmandoQuitarFlujo(false);
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  async function flowSaved() {
    setDisenando(false);
    await reload();
  }

  async function remove() {
    setOcupado(true);
    setError(null);
    try {
      await api.deleteRequest(detail.id);
      onChanged(null);
      onClose();
    } catch (failure) {
      setError(failure.message);
      setOcupado(false);
    }
  }

  function openConversion() {
    setConvertir({
      id: detail.id,
      key: "",
      title: detail.title,
      requester: detail.requester ?? "",
      hasCost: false,
    });
  }

  async function convertToProject(event) {
    event.preventDefault();

    setOcupado(true);
    setError(null);
    try {
      const response = await api.convertRequest(detail.id, {
        key: converting.key || undefined,
        title: converting.title || undefined,
        requester: converting.requester || undefined,
        hasCost: converting.hasCost,
      });
      setConflictos(response.conflicts);
      setConvertir(null);
      await reload();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  if (designing) {
    return (
      <FlowDesigner
        request={detail}
        onGuardado={flowSaved}
        onClose={() => setDisenando(false)}
      />
    );
  }

  if (draft === null) {
    return <p className="request-detail-loading">Abriendo la solicitud…</p>;
  }

  const flow = detail.flow ?? null;
  const active = templates.filter((una) => una.isActive);

  let source = SOURCES[detail.source] ?? detail.source;
  if (detail.sheetName !== null && detail.sheetName !== undefined) {
    source = `${source} · ${detail.sheetName}`;
  }

  return (
    <section className="request-detail">
      <header className="request-detail-head">
        <span className="request-detail-eyebrow">
          {detail.folio} · {detail.schemaName} v{detail.schemaVersion} · {source}
        </span>
        <button
          className="request-detail-close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar la solicitud"
        >
          ✕
        </button>
      </header>

      <Walk currentStep={currentStepOf(detail)} />

      {(detail.missingRequired ?? []).length > 0 ? (
        <p className="request-detail-dup">
          Le {detail.missingRequired.length === 1 ? "falta" : "faltan"}{" "}
          {detail.missingRequired.map((field) => field.name).join(", ")}: el formato{" "}
          {detail.missingRequired.length === 1 ? "lo pide" : "los pide"} y el libro de Excel{" "}
          {detail.missingRequired.length === 1 ? "lo traía" : "los traía"} vacío
          {detail.missingRequired.length === 1 ? "" : "s"}. Se puede capturar aquí abajo; hasta
          entonces no se puede converting en proyecto.
        </p>
      ) : null}

      {detail.duplicateOfFolio !== null && detail.duplicateOfFolio !== undefined ? (
        <p className="request-detail-dup">
          Se parece a {detail.duplicateOfFolio}: puede ser la misma petición capturada dos veces.
        </p>
      ) : null}

      {error !== null ? <p className="request-detail-error">{error}</p> : null}

      <div className="request-detail-columns">
        <section className="request-detail-sec">
          <h3>Solicitud</h3>

          <div className="request-detail-grid">
            <label className={mark("title", "request-detail-field")}>
              <span className="request-detail-label">Título</span>
              {isProject ? (
                <p className="request-detail-value">{detail.title}</p>
              ) : (
                <input
                  value={draft.title}
                  onChange={(event) => write("title", event.target.value)}
                  placeholder="Ej: Papelería institucional de la facultad"
                />
              )}
            </label>

            <div className={mark("requester", "request-detail-field")}>
              <span className="request-detail-label" id={`solicitante-${detail.id}-label`}>
                Entidad solicitante
                <Help text="No hay padrón de solicitantes: el nombre es una cadena y el autocompletado es lo que evita que se vuelva cuatro. Se puede corregir incluso después de convertir." />
              </span>
              <RequesterInput
                id={`solicitante-${detail.id}`}
                value={draft.requester}
                onChange={(requester) => write("requester", requester)}
              />
            </div>

            <label className={mark("areaId", "request-detail-field")}>
              <span className="request-detail-label">
                Área asignada
                <Help text="El área que atiende la solicitud mientras no tiene flujo. Con flujo, la reciben las áreas de su primera fase. Una vez asignada ya no se puede dejar sin área: solo cambiarla." />
              </span>
              {isProject ? (
                <p className="request-detail-value">{detail.areaName ?? "Sin asignar"}</p>
              ) : (
                <select
                  value={draft.areaId}
                  onChange={(event) => write("areaId", event.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {areas.map((area) => (
                    <option value={area.id} key={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="request-detail-field">
              <span className="request-detail-label">
                Estatus
                <Help text="El estatus se guarda al elegirlo, no con los demás cambios: tiene su propio registro con quién lo movió y cuándo (RF-EST-01). Se ofrecen los globales y los del área que la atiende." />
              </span>
              <select
                value={detail.statusId}
                onChange={(event) => changeStatus(event.target.value)}
                disabled={busy}
              >
                {statuses.map((one) => (
                  <option value={one.id} key={one.id}>
                    {one.label}
                    {one.isGlobal ? "" : " (del área)"}
                  </option>
                ))}
              </select>
            </label>

            <label className={mark("priority", "request-detail-field")}>
              <span className="request-detail-label">
                Urgencia
                <Help text="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
              </span>
              {isProject ? (
                <p className="request-detail-value">{detail.priority}</p>
              ) : (
                <input
                  type="number"
                  value={draft.priority}
                  onChange={(event) => write("priority", event.target.value)}
                />
              )}
            </label>

            {isProject ? (
              <div className="request-detail-field">
                <span className="request-detail-label">Proyecto</span>
                <p className="request-detail-value">
                  {detail.projectKey} — {detail.projectTitle}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="request-detail-sec">
          <h3>
            Lo capturado
            <span className="request-detail-sub">
              con {detail.schemaName} v{detail.schemaVersion}
            </span>
          </h3>

          {fields.length === 0 ? (
            <p className="request-detail-note">Este formato no pide ningún campo.</p>
          ) : (
            <div className="request-detail-captured">
              {fields.map((field) =>
                isProject ? (
                  <div className="request-detail-field" key={field.code}>
                    <span className="request-detail-label">{field.name}</span>
                    <p className="request-detail-value">
                      {readable(draft.data[field.code])}
                    </p>
                  </div>
                ) : (
                  <div className={mark(field.code, "request-detail-typed")} key={field.code}>
                    <FieldInput
                      field={field}
                      value={draft.data[field.code]}
                      onChange={(value) => writeValue(field.code, value)}
                    />
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>

      <section className="request-detail-sec">
        <div className="request-detail-sec-head">
          <h3>Flujo</h3>
          {flow && !isProject ? (
            <div className="request-detail-flow-actions">
              <button
                className="request-detail-quiet"
                type="button"
                onClick={() => setDisenando(true)}
                disabled={busy}
              >
                Editar el flow
              </button>
              {confirmingClearFlow ? (
                <>
                  <span className="request-detail-confirm">
                    Dejará de aparecer en las bandejas de sus áreas.
                  </span>
                  <button
                    className="request-detail-btn is-danger"
                    type="button"
                    onClick={clearFlow}
                    disabled={busy}
                  >
                    Quitarlo
                  </button>
                  <button
                    className="request-detail-quiet"
                    type="button"
                    onClick={() => setConfirmandoQuitarFlujo(false)}
                  >
                    Dejarlo
                  </button>
                </>
              ) : (
                <button
                  className="request-detail-quiet"
                  type="button"
                  onClick={() => setConfirmandoQuitarFlujo(true)}
                  disabled={busy}
                >
                  Quitar el flow
                </button>
              )}
            </div>
          ) : null}
        </div>

        {flow ? (
          <>
            {flow.workflowName ? (
              <p className="request-detail-note">
                Copiado de la plantilla «{flow.workflowName}», versión {flow.version}.
              </p>
            ) : null}
            <FullWidthFlow flow={flow} />
          </>
        ) : (
          <div className="request-detail-noflow">
            <p>
              {detail.areaName === null || detail.areaName === undefined
                ? "Sin flujo: todavía no pasa por ninguna área."
                : `Sin flujo: la atiende ${detail.areaName} por el área asignada.`}
            </p>
            {isProject ? null : (
              <div className="request-detail-noflow-actions">
                <select
                  value={chosenTemplate}
                  onChange={(event) => setPlantillaElegida(event.target.value)}
                  disabled={busy || active.length === 0}
                >
                  <option value="">Elige una plantilla</option>
                  {active.map((una) => (
                    <option value={una.id} key={una.id}>
                      {una.name}
                    </option>
                  ))}
                </select>
                <button
                  className="request-detail-btn"
                  type="button"
                  onClick={applyTemplate}
                  disabled={busy || chosenTemplate === ""}
                >
                  Aplicar
                </button>
                <span className="request-detail-or">o</span>
                <button
                  className="request-detail-btn"
                  type="button"
                  onClick={() => setDisenando(true)}
                  disabled={busy}
                >
                  Diseñar su flow
                </button>
              </div>
            )}
          </div>
        )}

        {detail.sourceData !== null && detail.sourceData !== undefined ? (
          <OriginalRow sourceData={detail.sourceData} />
        ) : null}
      </section>

      {conflicts.length > 0 ? (
        <section className="request-detail-sec">
          <h3>Valores que dos solicitudes traían distintos</h3>
          <ul className="request-detail-conflicts">
            {conflicts.map((conflicto) => (
              <li key={conflicto.key}>
                En <strong>{conflicto.key}</strong> se guardó «{conflicto.kept}» y se descartó «
                {conflicto.discarded}», que venía de {conflicto.folio}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {converting !== null ? (
        <ConversionForm
          data={converting}
          flow={flow}
          busy={busy}
          onChange={setConvertir}
          onSubmit={convertToProject}
          onCancel={() => setConvertir(null)}
        />
      ) : null}

      <footer className="request-detail-foot">
        {isProject ? (
          <p className="request-detail-note">
            Ya es un proyecto, así que no se edita ni se elimina: el proyecto perdería lo que
            contesta. El solicitante sí se puede corregir.
          </p>
        ) : confirmingDelete ? (
          <div className="request-detail-flow-actions">
            <span className="request-detail-confirm">
              Se quita de la bandeja. Lo que vino de Excel se puede volver a traer importando el
              libro otra vez.
            </span>
            <button
              className="request-detail-btn is-danger"
              type="button"
              onClick={remove}
              disabled={busy}
            >
              Eliminar
            </button>
            <button
              className="request-detail-quiet"
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
            >
              Conservarla
            </button>
          </div>
        ) : (
          <button
            className="request-detail-quiet is-danger"
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            disabled={busy}
          >
            Eliminar
          </button>
        )}

        {isProject ? null : (
          <div className="request-detail-foot-right">
            {dirty ? (
              <>
                <span className="request-detail-dirty">
                  {changed.length} {changed.length === 1 ? "cambio" : "cambios"} sin save
                </span>
                <button
                  className="request-detail-btn"
                  type="button"
                  onClick={discard}
                  disabled={busy}
                >
                  Descartar
                </button>
                <button
                  className="request-detail-btn is-primary"
                  type="button"
                  onClick={save}
                  disabled={busy || draft.title.trim() === ""}
                >
                  {busy ? "Guardando…" : "Guardar cambios"}
                </button>
              </>
            ) : (
              <>
                {(detail.missingRequired ?? []).length > 0 ? (
                  <span className="request-detail-dirty">
                    Falta capturar{" "}
                    {detail.missingRequired.map((field) => field.name).join(", ")}
                  </span>
                ) : null}
                <button
                  className="request-detail-btn is-primary"
                  type="button"
                  onClick={openConversion}
                  disabled={
                    busy ||
                    converting !== null ||
                    (detail.missingRequired ?? []).length > 0
                  }
                >
                  Convertir en proyecto
                </button>
              </>
            )}
          </div>
        )}
      </footer>
    </section>
  );
}

export default RequestDetail;
