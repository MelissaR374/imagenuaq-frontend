import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./projectDetail.css";

// Un proyecto con sus etapas, sus vistos buenos y los valores que cruzan etapas.
//
// Un proyecto no tiene "etapa actual": la etapa actual es el conjunto de etapas activas,
// porque un mismo proyecto puede estar en dos áreas a la vez (RF-FLW-09). Por eso la lista de
// etapas se muestra completa, con su intento: cuando un visto bueno rechaza, la etapa se cierra
// y se abre otra vez con el intento siguiente, y las dos quedan a la vista.
//
// `done` no se pone a mano: una etapa la cierra un visto bueno (RF-FLW-03).
const TRANSICIONES = {
  pending: [{ status: "active", label: "Iniciar" }, { status: "cancelled", label: "Cancelar" }],
  active: [
    { status: "waiting_external", label: "Marcar en espera" },
    { status: "cancelled", label: "Cancelar" },
  ],
  waiting_external: [{ status: "active", label: "Reanudar" }, { status: "cancelled", label: "Cancelar" }],
  done: [],
  cancelled: [],
};

const ESTADOS_ETAPA = {
  pending: "Pendiente",
  active: "Activa",
  waiting_external: "En espera de un tercero",
  done: "Concluida",
  cancelled: "Cancelada",
};

// Las claves que una etapa puede declarar: las que el proyecto ya tiene y las de su formato.
// Es una sugerencia, no un catálogo cerrado: una etapa puede prometer una clave que todavía no
// existe, que es justamente lo normal —la promete porque la va a producir—.
function clavesConocidas(detalle) {
  const claves = new Set(detalle.fieldValues.map((valor) => valor.key));
  for (const etapa of detalle.stages) {
    for (const clave of [...etapa.inputs, ...etapa.outputs]) claves.add(clave);
  }
  return [...claves].sort();
}

function ProjectDetail({ proyecto, areas, usuario, onCerrar, onCambio }) {
  const [detalle, setDetalle] = useState(null);
  const [estatus, setEstatus] = useState([]);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const [nuevaEtapa, setNuevaEtapa] = useState(null);
  const [firma, setFirma] = useState(null);
  const [nuevoValor, setNuevoValor] = useState({ key: "", value: "" });
  const [pedido, setPedido] = useState({ kind: "invoice", note: "" });

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const { project } = await api.getProject(proyecto.id);
        if (cancelado) return;
        setDetalle(project);

        // Los estatus que puede vestir: los globales más los de las áreas con etapa aquí.
        const areasConEtapa = [...new Set(project.stages.map((etapa) => etapa.areaId))];
        const listas = await Promise.all([
          api.listStatuses(),
          ...areasConEtapa.map((id) => api.listStatuses({ areaId: id })),
        ]);
        if (cancelado) return;
        const porId = new Map();
        for (const lista of listas) {
          for (const uno of lista.statuses) porId.set(uno.id, uno);
        }
        setEstatus([...porId.values()]);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [proyecto.id]);

  async function recargar() {
    const { project } = await api.getProject(proyecto.id);
    setDetalle(project);
    onCambio();
  }

  // Envuelve una acción: apaga los botones, muestra el error del servidor y recarga.
  async function hacer(accion) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      await recargar();
      return true;
    } catch (fallo) {
      setError(fallo.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function firmar(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.createApproval(detalle.id, firma.stageId, {
        decision: firma.decision,
        comment: firma.comment || undefined,
      }),
    );
    if (hecho) setFirma(null);
  }

  async function agregarEtapa(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.createProjectStage(detalle.id, {
        areaId: Number(nuevaEtapa.areaId),
        title: nuevaEtapa.title,
        seq: Number(nuevaEtapa.seq),
        status: nuevaEtapa.status,
        inputs: listaDeClaves(nuevaEtapa.inputs),
        outputs: listaDeClaves(nuevaEtapa.outputs),
      }),
    );
    if (hecho) setNuevaEtapa(null);
  }

  async function bloquear(etapa) {
    const motivo = window.prompt("¿Qué se está esperando?");
    if (motivo === null || motivo.trim() === "") return;
    await hacer(() =>
      api.updateProjectStage(detalle.id, etapa.id, {
        status: "waiting_external",
        blockedReason: motivo,
      }),
    );
  }

  async function pedirFinanzas(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.requestFinance(detalle.id, {
        kind: pedido.kind,
        note: pedido.note || undefined,
      }),
    );
    if (hecho) setPedido({ ...pedido, note: "" });
  }

  async function guardarValor(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.setFieldValue(detalle.id, nuevoValor.key, nuevoValor.value),
    );
    if (hecho) setNuevoValor({ key: "", value: "" });
  }

  if (detalle === null) {
    return (
      <section className="project-detail">
        {error ? <p className="project-detail-error">{error}</p> : <p>Cargando proyecto...</p>}
      </section>
    );
  }

  const abiertas = detalle.stages.filter(
    (etapa) => etapa.status === "active" || etapa.status === "waiting_external",
  );

  return (
    <section className="project-detail">
      <header className="project-detail-header">
        <h3 className="project-detail-title">
          {detalle.key} — {detalle.title}
        </h3>
        <button type="button" onClick={onCerrar}>
          Cerrar
        </button>
      </header>

      {error ? <p className="project-detail-error">{error}</p> : null}

      <dl className="project-detail-facts">
        <dt>Solicitante</dt>
        <dd>{detalle.requester ?? "—"}</dd>

        <dt>Estatus</dt>
        <dd>
          <select
            value={detalle.statusId}
            onChange={(evento) =>
              hacer(() => api.setProjectStatus(detalle.id, Number(evento.target.value)))
            }
            disabled={ocupado}
          >
            {estatus.map((uno) => (
              <option value={uno.id} key={uno.id}>
                {uno.label}
                {uno.isGlobal ? "" : ` (${uno.areaName})`}
              </option>
            ))}
          </select>
          <span className="project-detail-since">
            {" "}
            desde {new Date(detalle.statusSince).toLocaleDateString()}
          </span>
        </dd>

        <dt>Etapas activas</dt>
        <dd>
          {abiertas.length === 0
            ? "ninguna"
            : abiertas.map((etapa) => `${etapa.title} (${etapa.areaName})`).join(", ")}
        </dd>

        <dt>Con costo</dt>
        <dd>{detalle.hasCost ? "Sí" : "No"}</dd>

        <dt>Urgencia</dt>
        <dd>{detalle.priority}</dd>

        <dt>Entrega</dt>
        <dd>{detalle.dueOn ?? "sin fecha"}</dd>

        {detalle.closedAt ? (
          <>
            <dt>Cerrado</dt>
            <dd>{new Date(detalle.closedAt).toLocaleDateString()}</dd>
          </>
        ) : null}
      </dl>

      <div className="project-detail-actions">
        <button
          type="button"
          onClick={() => hacer(() => api.closeProject(detalle.id))}
          disabled={ocupado || detalle.closedAt !== null}
        >
          Cerrar el proyecto
        </button>
        <button
          type="button"
          onClick={() => hacer(() => api.archiveProject(detalle.id))}
          disabled={ocupado || detalle.archivedAt !== null}
        >
          Archivar
        </button>
      </div>
      <p className="project-detail-help">
        Cerrar se niega mientras alguna etapa siga activa o en espera. Archivar es otra cosa:
        trabajo terminado contra quitado de en medio.
      </p>

      <h4 className="project-detail-subtitle">Etapas</h4>
      <table className="project-stages">
        <thead>
          <tr>
            <th>Etapa</th>
            <th>Área</th>
            <th>Intento</th>
            <th>Estado</th>
            <th>Vistos buenos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {detalle.stages.map((etapa) => (
            <tr className="project-stage-row" key={etapa.id}>
              <td>
                {etapa.title}
                {etapa.blockedReason ? (
                  <p className="project-stage-blocked">Espera: {etapa.blockedReason}</p>
                ) : null}
                {etapa.inputs.length > 0 ? (
                  <p className="project-stage-io">Necesita: {etapa.inputs.join(", ")}</p>
                ) : null}
                {etapa.outputs.length > 0 ? (
                  <p className="project-stage-io">
                    Entrega:{" "}
                    {etapa.outputs.map((clave) => {
                      const tiene = detalle.fieldValues.some(
                        (valor) => valor.key === clave && valor.value !== "",
                      );
                      return (
                        <span
                          className={tiene ? "project-output-done" : "project-output-missing"}
                          key={clave}
                        >
                          {clave}
                          {tiene ? " ✓" : " (falta)"}{" "}
                        </span>
                      );
                    })}
                  </p>
                ) : null}
              </td>
              <td>{etapa.areaName}</td>
              <td className="project-cell-center">{etapa.attempt}</td>
              <td>{ESTADOS_ETAPA[etapa.status] ?? etapa.status}</td>
              <td>
                {etapa.approvals.length === 0
                  ? "—"
                  : etapa.approvals.map((visto) => (
                      <p className="project-approval" key={visto.id}>
                        {visto.decision === "approved" ? "Aprobó" : "Rechazó"} {visto.approverName}
                        {visto.comment ? `: ${visto.comment}` : null}
                      </p>
                    ))}
              </td>
              <td className="project-stage-actions">
                {TRANSICIONES[etapa.status].map((paso) =>
                  paso.status === "waiting_external" ? (
                    <button type="button" key={paso.status} onClick={() => bloquear(etapa)} disabled={ocupado}>
                      {paso.label}
                    </button>
                  ) : (
                    <button
                      type="button"
                      key={paso.status}
                      onClick={() =>
                        hacer(() =>
                          api.updateProjectStage(detalle.id, etapa.id, { status: paso.status }),
                        )
                      }
                      disabled={ocupado}
                    >
                      {paso.label}
                    </button>
                  ),
                )}

                {etapa.status === "active" || etapa.status === "waiting_external" ? (
                  <button
                    type="button"
                    onClick={() => setFirma({ stageId: etapa.id, decision: "approved", comment: "" })}
                    disabled={ocupado}
                  >
                    Visto bueno
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() =>
          setNuevaEtapa({
            areaId: areas[0]?.id ?? "",
            title: "",
            seq: detalle.stages.length + 1,
            status: "pending",
            inputs: "",
            outputs: "",
          })
        }
        disabled={ocupado}
      >
        Agregar etapa
      </button>

      {nuevaEtapa !== null ? (
        <form className="project-detail-panel" onSubmit={agregarEtapa}>
          <label className="project-detail-field">
            Área
            <select
              value={nuevaEtapa.areaId}
              onChange={(evento) => setNuevaEtapa({ ...nuevaEtapa, areaId: evento.target.value })}
              required
            >
              {areas.map((area) => (
                <option value={area.id} key={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          <label className="project-detail-field">
            Nombre de la etapa
            <input
              value={nuevaEtapa.title}
              onChange={(evento) => setNuevaEtapa({ ...nuevaEtapa, title: evento.target.value })}
              required
            />
          </label>

          <label className="project-detail-field">
            Orden de presentación
            <input
              type="number"
              value={nuevaEtapa.seq}
              onChange={(evento) => setNuevaEtapa({ ...nuevaEtapa, seq: evento.target.value })}
            />
          </label>

          <label className="project-detail-field">
            Empieza
            <select
              value={nuevaEtapa.status}
              onChange={(evento) => setNuevaEtapa({ ...nuevaEtapa, status: evento.target.value })}
            >
              <option value="pending">Pendiente</option>
              <option value="active">Activa</option>
            </select>
          </label>

          <label className="project-detail-field">
            Entradas: qué datos necesita para trabajar
            <input
              value={nuevaEtapa.inputs}
              onChange={(evento) => setNuevaEtapa({ ...nuevaEtapa, inputs: evento.target.value })}
              list={`claves-${detalle.id}`}
              placeholder="dependencia, tiraje"
            />
          </label>

          <label className="project-detail-field">
            Salidas: qué datos entrega
            <input
              value={nuevaEtapa.outputs}
              onChange={(evento) => setNuevaEtapa({ ...nuevaEtapa, outputs: evento.target.value })}
              list={`claves-${detalle.id}`}
              placeholder="numero_orden"
            />
          </label>

          {/* Las claves que ya andan por el proyecto, como sugerencia. */}
          <datalist id={`claves-${detalle.id}`}>
            {clavesConocidas(detalle).map((clave) => (
              <option value={clave} key={clave} />
            ))}
          </datalist>

          <p className="project-detail-help">
            Separadas por comas. Las salidas son una promesa: el visto bueno de esta etapa se
            niega mientras alguna no tenga valor, y por eso la etapa siguiente la encuentra.
          </p>

          <div className="project-detail-actions">
            <button type="submit" disabled={ocupado}>
              Agregar
            </button>
            <button type="button" onClick={() => setNuevaEtapa(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {firma !== null ? (
        <form className="project-detail-panel" onSubmit={firmar}>
          <h4>Visto bueno</h4>
          <p className="project-detail-help">
            Aprobar concluye la etapa. Rechazar también la concluye y abre otra vez la misma
            etapa con el intento siguiente, para que el trabajo devuelto quede a la vista. La
            conformidad del solicitante va en el comentario: el visto bueno es interno.
          </p>

          <label className="project-detail-field">
            Decisión
            <select
              value={firma.decision}
              onChange={(evento) => setFirma({ ...firma, decision: evento.target.value })}
            >
              <option value="approved">Aprobar</option>
              <option value="rejected">Rechazar</option>
            </select>
          </label>

          <label className="project-detail-field">
            Comentario
            <textarea
              value={firma.comment}
              onChange={(evento) => setFirma({ ...firma, comment: evento.target.value })}
              rows={3}
            />
          </label>

          <div className="project-detail-actions">
            <button type="submit" disabled={ocupado}>
              Registrar
            </button>
            <button type="button" onClick={() => setFirma(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <h4 className="project-detail-subtitle">Valores del proyecto</h4>
      <p className="project-detail-help">
        Lo que una etapa produce y otra lee sin recapturar (RF-FLW-06): el número de orden, el
        folio del SIN, el pantone.
      </p>
      <table className="project-values">
        <thead>
          <tr>
            <th>Clave</th>
            <th>Valor</th>
            <th>La produjo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {detalle.fieldValues.map((valor) => (
            <tr key={valor.key}>
              <td className="project-value-key">{valor.key}</td>
              <td>
                <input
                  className="project-value-input"
                  defaultValue={valor.value}
                  onBlur={(evento) => {
                    if (evento.target.value !== valor.value && evento.target.value !== "") {
                      hacer(() => api.setFieldValue(detalle.id, valor.key, evento.target.value));
                    }
                  }}
                />
              </td>
              <td>
                {valor.producedByStageId === null
                  ? "la solicitud"
                  : (detalle.stages.find((etapa) => etapa.id === valor.producedByStageId)?.title ??
                    "una etapa")}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => hacer(() => api.deleteFieldValue(detalle.id, valor.key))}
                  disabled={ocupado}
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="project-detail-inline" onSubmit={guardarValor}>
        <input
          placeholder="numero_orden"
          value={nuevoValor.key}
          onChange={(evento) => setNuevoValor({ ...nuevoValor, key: evento.target.value })}
          required
        />
        <input
          placeholder="A-77"
          value={nuevoValor.value}
          onChange={(evento) => setNuevoValor({ ...nuevoValor, value: evento.target.value })}
          required
        />
        <button type="submit" disabled={ocupado}>
          Guardar valor
        </button>
      </form>

      {usuario?.role === "finance" || usuario?.role === "admin" ? (
        <form className="project-detail-panel" onSubmit={pedirFinanzas}>
          <h4>Pedir cotización o factura</h4>
          <p className="project-detail-help">
            Queda como un valor del proyecto (`requiere_cotizacion` o `requiere_factura`), así que
            el tablero lo encuentra filtrando por esa clave. Pedirlo no edita nada más del
            proyecto.
          </p>

          <label className="project-detail-field">
            Qué se necesita
            <select
              value={pedido.kind}
              onChange={(evento) => setPedido({ ...pedido, kind: evento.target.value })}
            >
              <option value="invoice">Factura</option>
              <option value="quote">Cotización</option>
            </select>
          </label>

          <label className="project-detail-field">
            Nota para quien lleva el proyecto
            <input
              value={pedido.note}
              onChange={(evento) => setPedido({ ...pedido, note: evento.target.value })}
              placeholder="Falta el desglose por partida"
            />
          </label>

          <div className="project-detail-actions">
            <button type="submit" disabled={ocupado}>
              Pedir
            </button>
            <button
              type="button"
              onClick={() => hacer(() => api.requestFinance(detalle.id, { kind: pedido.kind, needed: false }))}
              disabled={ocupado}
            >
              Retirar el pedido
            </button>
          </div>
        </form>
      ) : null}

      <h4 className="project-detail-subtitle">Solicitudes que contesta</h4>
      {detalle.requests.length === 0 ? (
        <p className="project-detail-help">
          Ninguna: este proyecto se capturó directo, no salió de una solicitud.
        </p>
      ) : (
        <ul className="project-requests">
          {detalle.requests.map((solicitud) => (
            <li key={solicitud.id}>
              {solicitud.folio} — {solicitud.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// «dependencia, tiraje» a ["dependencia", "tiraje"]. El servidor valida que sean snake_case.
function listaDeClaves(texto) {
  return (texto ?? "")
    .split(",")
    .map((clave) => clave.trim())
    .filter((clave) => clave !== "");
}

export default ProjectDetail;
