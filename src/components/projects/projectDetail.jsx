import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./projectDetail.css";

// Un proyecto con sus etapas, sus vistos buenos y los valores que cruzan etapas.
//
// El bloque «Cómo va» existe por DATAMODEL.md §8.1: hay dos vocabularios de estado y no se
// tocan. El estatus es el del catálogo que coordinación edita en caliente y lo mueve una mano;
// el estado del trabajo es la máquina de etapas y lo mueve un visto bueno. Un proyecto puede
// decir «Recibido» con todas sus etapas concluidas, así que la pantalla los muestra juntos: es
// la única forma de que la contradicción se vea en lugar de esconderse.
//
// Un proyecto no tiene «etapa actual»: la etapa actual es el conjunto de etapas activas, porque
// un mismo proyecto puede estar en dos áreas a la vez (RF-FLW-09). Por eso la lista de etapas se
// muestra completa, con su intento: cuando un visto bueno rechaza, la etapa se cierra y se abre
// otra vez con el intento siguiente, y las dos quedan a la vista.
//
// `done` no se pone a mano: una etapa la cierra un visto bueno (RF-FLW-03).
const TRANSICIONES = {
  pending: [
    { status: "active", label: "Iniciar" },
    { status: "cancelled", label: "Cancelar" },
  ],
  active: [
    { status: "waiting_external", label: "Marcar en espera" },
    { status: "cancelled", label: "Cancelar" },
  ],
  waiting_external: [
    { status: "active", label: "Reanudar" },
    { status: "cancelled", label: "Cancelar" },
  ],
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

const ESTADOS_ABIERTOS = ["active", "waiting_external"];

// Las claves que una etapa puede declarar: las que el proyecto ya tiene y las que otras etapas
// ya nombraron. Es una sugerencia, no un catálogo cerrado: una etapa puede prometer una clave que
// todavía no existe, que es justamente lo normal —la promete porque la va a producir—.
function clavesConocidas(detalle) {
  const claves = new Set();
  for (const valor of detalle.fieldValues) {
    claves.add(valor.key);
  }
  for (const etapa of detalle.stages) {
    for (const clave of etapa.inputs) {
      claves.add(clave);
    }
    for (const clave of etapa.outputs) {
      claves.add(clave);
    }
  }
  return [...claves].sort();
}

// «dependencia, tiraje» a ["dependencia", "tiraje"]. El servidor valida que sean snake_case.
function listaDeClaves(texto) {
  if (texto === null || texto === undefined) {
    return [];
  }
  return texto
    .split(",")
    .map((clave) => clave.trim())
    .filter((clave) => clave !== "");
}

function oGuion(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  return valor;
}

function fechaCorta(valor) {
  return new Date(valor).toLocaleDateString();
}

// Los dos vocabularios de estado, uno al lado del otro (DATAMODEL.md §8.1), y el aviso cuando se
// contradicen. No se unen a propósito; lo que sí se puede hacer es que se vean.
function ComoVa({ detalle }) {
  const abiertas = detalle.stages.filter((etapa) => ESTADOS_ABIERTOS.includes(etapa.status));
  const concluidas = detalle.stages.filter((etapa) => etapa.status === "done");

  let trabajo = "Todavía sin etapas: las etapas se agregan a mano.";
  if (abiertas.length > 0) {
    const nombres = abiertas.map((etapa) => `${etapa.title} (${etapa.areaName})`);
    trabajo = `Trabajando en ${nombres.join(", ")}.`;
  } else if (concluidas.length > 0) {
    trabajo = `Ninguna etapa abierta; ${concluidas.length} concluida${
      concluidas.length === 1 ? "" : "s"
    }.`;
  }

  // El trabajo terminó pero el estatus visible no lo dice. Nada lo mueve solo: por eso el aviso.
  const trabajoTerminado =
    detalle.stages.length > 0 && abiertas.length === 0 && concluidas.length > 0;
  const estatusLoDice = detalle.statusIsTerminal || detalle.closedAt !== null;

  let aviso = null;
  if (trabajoTerminado && !estatusLoDice) {
    aviso = (
      <p className="project-detail-warning">
        El trabajo ya no tiene etapas abiertas, pero el estatus sigue en «{detalle.statusLabel}».
        Nada lo mueve solo: el estatus es el que se muestra a quien preguntó, y lo cambia una
        persona.
      </p>
    );
  }

  return (
    <div className="project-detail-how">
      <div className="project-detail-how-half">
        <h4 className="project-detail-how-title">Estatus que se muestra</h4>
        <p>
          {detalle.statusLabel}, desde {fechaCorta(detalle.statusSince)}
        </p>
        <p className="project-detail-help">
          Del catálogo que coordinación edita. Lo mueve una mano, aquí abajo.
        </p>
      </div>
      <div className="project-detail-how-half">
        <h4 className="project-detail-how-title">Estado del trabajo</h4>
        <p>{trabajo}</p>
        <p className="project-detail-help">
          La máquina de etapas. La mueve un visto bueno, no el estatus.
        </p>
      </div>
      {aviso}
    </div>
  );
}

// Las salidas que una etapa prometió, con la que ya tiene valor marcada: el visto bueno se niega
// mientras falte alguna (RF-FLW-06).
function SalidasDeLaEtapa({ outputs, fieldValues }) {
  if (outputs.length === 0) {
    return null;
  }

  return (
    <p className="project-stage-io">
      Entrega:{" "}
      {outputs.map((clave) => {
        const tiene = fieldValues.some((valor) => valor.key === clave && valor.value !== "");

        let clase = "project-output-missing";
        let marca = " (falta)";
        if (tiene) {
          clase = "project-output-done";
          marca = " ✓";
        }

        return (
          <span className={clase} key={clave}>
            {clave}
            {marca}{" "}
          </span>
        );
      })}
    </p>
  );
}

function FilaDeEtapa({ etapa, fieldValues, ocupado, onTransicion, onBloquear, onFirmar }) {
  let espera = null;
  if (etapa.blockedReason !== null) {
    espera = <p className="project-stage-blocked">Espera: {etapa.blockedReason}</p>;
  }

  let entradas = null;
  if (etapa.inputs.length > 0) {
    entradas = <p className="project-stage-io">Necesita: {etapa.inputs.join(", ")}</p>;
  }

  let vistosBuenos = "—";
  if (etapa.approvals.length > 0) {
    vistosBuenos = etapa.approvals.map((visto) => {
      let verbo = "Rechazó";
      if (visto.decision === "approved") {
        verbo = "Aprobó";
      }

      let comentario = null;
      if (visto.comment !== null) {
        comentario = `: ${visto.comment}`;
      }

      return (
        <p className="project-approval" key={visto.id}>
          {verbo} {visto.approverName}
          {comentario}
        </p>
      );
    });
  }

  // Los botones son las transiciones legales de este estado, y ninguna otra: `done` no está.
  const botones = TRANSICIONES[etapa.status].map((paso) => {
    // Esperar a un tercero pide el motivo que RF-FLW-07 quiere, así que va por otro camino.
    if (paso.status === "waiting_external") {
      return (
        <button type="button" key={paso.status} onClick={() => onBloquear(etapa)} disabled={ocupado}>
          {paso.label}
        </button>
      );
    }
    return (
      <button
        type="button"
        key={paso.status}
        onClick={() => onTransicion(etapa, paso.status)}
        disabled={ocupado}
      >
        {paso.label}
      </button>
    );
  });

  let botonDeFirma = null;
  if (ESTADOS_ABIERTOS.includes(etapa.status)) {
    botonDeFirma = (
      <button type="button" onClick={() => onFirmar(etapa)} disabled={ocupado}>
        Visto bueno
      </button>
    );
  }

  return (
    <tr className="project-stage-row">
      <td>
        {etapa.title}
        {espera}
        {entradas}
        <SalidasDeLaEtapa outputs={etapa.outputs} fieldValues={fieldValues} />
      </td>
      <td>{etapa.areaName}</td>
      <td className="project-cell-center">{etapa.attempt}</td>
      <td>{ESTADOS_ETAPA[etapa.status] ?? etapa.status}</td>
      <td>{vistosBuenos}</td>
      <td className="project-stage-actions">
        {botones}
        {botonDeFirma}
      </td>
    </tr>
  );
}

function FormularioDeEtapa({
  datos, areas, claves, listaId, ocupado, onCambiar, onEnviar, onCancelar,
}) {
  function cambiar(clave, valor) {
    onCambiar({ ...datos, [clave]: valor });
  }

  return (
    <form className="project-detail-panel" onSubmit={onEnviar}>
      <label className="project-detail-field">
        Área
        <select
          value={datos.areaId}
          onChange={(evento) => cambiar("areaId", evento.target.value)}
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
          value={datos.title}
          onChange={(evento) => cambiar("title", evento.target.value)}
          required
        />
      </label>

      <label className="project-detail-field">
        Orden de presentación
        <input
          type="number"
          value={datos.seq}
          onChange={(evento) => cambiar("seq", evento.target.value)}
        />
      </label>

      <label className="project-detail-field">
        Empieza
        <select value={datos.status} onChange={(evento) => cambiar("status", evento.target.value)}>
          <option value="pending">Pendiente</option>
          <option value="active">Activa</option>
        </select>
      </label>

      <label className="project-detail-field">
        Entradas: qué datos necesita para trabajar
        <input
          value={datos.inputs}
          onChange={(evento) => cambiar("inputs", evento.target.value)}
          list={listaId}
          placeholder="dependencia, tiraje"
        />
      </label>

      <label className="project-detail-field">
        Salidas: qué datos entrega
        <input
          value={datos.outputs}
          onChange={(evento) => cambiar("outputs", evento.target.value)}
          list={listaId}
          placeholder="numero_orden"
        />
      </label>

      {/* Las claves que ya andan por el proyecto, como sugerencia. */}
      <datalist id={listaId}>
        {claves.map((clave) => (
          <option value={clave} key={clave} />
        ))}
      </datalist>

      <p className="project-detail-help">
        Separadas por comas. Las salidas son una promesa: el visto bueno de esta etapa se niega
        mientras alguna no tenga valor, y por eso la etapa siguiente la encuentra.
      </p>

      <div className="project-detail-actions">
        <button type="submit" disabled={ocupado}>
          Agregar
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioDeFirma({ datos, ocupado, onCambiar, onEnviar, onCancelar }) {
  function cambiar(clave, valor) {
    onCambiar({ ...datos, [clave]: valor });
  }

  return (
    <form className="project-detail-panel" onSubmit={onEnviar}>
      <h4>Visto bueno de «{datos.stageTitle}»</h4>
      <p className="project-detail-help">
        Aprobar concluye la etapa. Rechazar también la concluye y abre otra vez la misma etapa con
        el intento siguiente, para que el trabajo devuelto quede a la vista. La conformidad del
        solicitante va en el comentario: el visto bueno es interno.
      </p>
      <p className="project-detail-help">
        Aprobar <strong>no</strong> abre la etapa siguiente: cuál sigue es asunto del flujo, y el
        flujo declarativo todavía no existe. Por ahora la siguiente se inicia a mano.
      </p>

      <label className="project-detail-field">
        Decisión
        <select
          value={datos.decision}
          onChange={(evento) => cambiar("decision", evento.target.value)}
        >
          <option value="approved">Aprobar</option>
          <option value="rejected">Rechazar</option>
        </select>
      </label>

      <label className="project-detail-field">
        Comentario
        <textarea
          value={datos.comment}
          onChange={(evento) => cambiar("comment", evento.target.value)}
          rows={3}
        />
      </label>

      <div className="project-detail-actions">
        <button type="submit" disabled={ocupado}>
          Registrar
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// Los valores que cruzan de una etapa a otra. Se editan en su lugar: el valor se guarda al salir
// del campo, y solo si cambió y no quedó vacío —vaciarlo es quitarlo, y eso tiene su botón—.
function ValoresDelProyecto({ detalle, ocupado, onGuardar, onQuitar }) {
  function nombreDeLaEtapa(producedByStageId) {
    if (producedByStageId === null) {
      return "la solicitud";
    }
    const etapa = detalle.stages.find((una) => una.id === producedByStageId);
    if (etapa === undefined) {
      return "una etapa";
    }
    return etapa.title;
  }

  function alSalirDelCampo(valor, escrito) {
    if (escrito !== valor.value && escrito !== "") {
      onGuardar(valor.key, escrito);
    }
  }

  return (
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
                onBlur={(evento) => alSalirDelCampo(valor, evento.target.value)}
              />
            </td>
            <td>{nombreDeLaEtapa(valor.producedByStageId)}</td>
            <td>
              <button type="button" onClick={() => onQuitar(valor.key)} disabled={ocupado}>
                Quitar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PedidoAFinanzas({ datos, ocupado, onCambiar, onEnviar, onRetirar }) {
  function cambiar(clave, valor) {
    onCambiar({ ...datos, [clave]: valor });
  }

  return (
    <form className="project-detail-panel" onSubmit={onEnviar}>
      <h4>Pedir cotización o factura</h4>
      <p className="project-detail-help">
        Queda como un valor del proyecto (`requiere_cotizacion` o `requiere_factura`), así que el
        tablero lo encuentra filtrando por esa clave. Pedirlo no edita nada más del proyecto.
      </p>

      <label className="project-detail-field">
        Qué se necesita
        <select value={datos.kind} onChange={(evento) => cambiar("kind", evento.target.value)}>
          <option value="invoice">Factura</option>
          <option value="quote">Cotización</option>
        </select>
      </label>

      <label className="project-detail-field">
        Nota para quien lleva el proyecto
        <input
          value={datos.note}
          onChange={(evento) => cambiar("note", evento.target.value)}
          placeholder="Falta el desglose por partida"
        />
      </label>

      <div className="project-detail-actions">
        <button type="submit" disabled={ocupado}>
          Pedir
        </button>
        <button type="button" onClick={onRetirar} disabled={ocupado}>
          Retirar el pedido
        </button>
      </div>
    </form>
  );
}

function SolicitudesQueContesta({ requests }) {
  if (requests.length === 0) {
    return (
      <p className="project-detail-help">
        Ninguna: este proyecto se capturó directo, no salió de una solicitud.
      </p>
    );
  }

  return (
    <ul className="project-requests">
      {requests.map((solicitud) => (
        <li key={solicitud.id}>
          {solicitud.folio} — {solicitud.title}
        </li>
      ))}
    </ul>
  );
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
        const respuesta = await api.getProject(proyecto.id);
        if (cancelado) {
          return;
        }
        setDetalle(respuesta.project);

        // Los estatus que puede vestir: los globales más los de las áreas con etapa aquí.
        const areasConEtapa = [...new Set(respuesta.project.stages.map((etapa) => etapa.areaId))];
        const peticiones = [api.listStatuses()];
        for (const id of areasConEtapa) {
          peticiones.push(api.listStatuses({ areaId: id }));
        }

        const listas = await Promise.all(peticiones);
        if (cancelado) {
          return;
        }

        const porId = new Map();
        for (const lista of listas) {
          for (const uno of lista.statuses) {
            porId.set(uno.id, uno);
          }
        }
        setEstatus([...porId.values()]);
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [proyecto.id]);

  async function recargar() {
    const respuesta = await api.getProject(proyecto.id);
    setDetalle(respuesta.project);
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

  function cambiarEstatus(valor) {
    hacer(() => api.setProjectStatus(detalle.id, Number(valor)));
  }

  function cerrarProyecto() {
    hacer(() => api.closeProject(detalle.id));
  }

  function archivarProyecto() {
    hacer(() => api.archiveProject(detalle.id));
  }

  function moverEtapa(etapa, status) {
    hacer(() => api.updateProjectStage(detalle.id, etapa.id, { status }));
  }

  async function bloquearEtapa(etapa) {
    const motivo = window.prompt("¿Qué se está esperando?");
    if (motivo === null || motivo.trim() === "") {
      return;
    }
    await hacer(() =>
      api.updateProjectStage(detalle.id, etapa.id, {
        status: "waiting_external",
        blockedReason: motivo,
      }),
    );
  }

  function abrirFirma(etapa) {
    setFirma({ stageId: etapa.id, stageTitle: etapa.title, decision: "approved", comment: "" });
  }

  function cerrarFirma() {
    setFirma(null);
  }

  async function firmar(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.createApproval(detalle.id, firma.stageId, {
        decision: firma.decision,
        comment: firma.comment || undefined,
      }),
    );
    if (hecho) {
      setFirma(null);
    }
  }

  function abrirEtapa() {
    let areaId = "";
    if (areas.length > 0) {
      areaId = areas[0].id;
    }

    setNuevaEtapa({
      areaId,
      title: "",
      seq: detalle.stages.length + 1,
      status: "pending",
      inputs: "",
      outputs: "",
    });
  }

  function cerrarEtapa() {
    setNuevaEtapa(null);
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
    if (hecho) {
      setNuevaEtapa(null);
    }
  }

  function guardarValorExistente(key, value) {
    hacer(() => api.setFieldValue(detalle.id, key, value));
  }

  function quitarValor(key) {
    hacer(() => api.deleteFieldValue(detalle.id, key));
  }

  async function guardarValorNuevo(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.setFieldValue(detalle.id, nuevoValor.key, nuevoValor.value),
    );
    if (hecho) {
      setNuevoValor({ key: "", value: "" });
    }
  }

  async function pedirFinanzas(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.requestFinance(detalle.id, {
        kind: pedido.kind,
        note: pedido.note || undefined,
      }),
    );
    if (hecho) {
      setPedido({ ...pedido, note: "" });
    }
  }

  function retirarPedido() {
    hacer(() => api.requestFinance(detalle.id, { kind: pedido.kind, needed: false }));
  }

  if (detalle === null) {
    let mensaje = <p>Cargando proyecto...</p>;
    if (error !== null) {
      mensaje = <p className="project-detail-error">{error}</p>;
    }
    return <section className="project-detail">{mensaje}</section>;
  }

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="project-detail-error">{error}</p>;
  }

  let bloqueDeCierre = null;
  if (detalle.closedAt !== null) {
    bloqueDeCierre = (
      <>
        <dt>Cerrado</dt>
        <dd>{fechaCorta(detalle.closedAt)}</dd>
      </>
    );
  }

  let formularioDeEtapa = null;
  if (nuevaEtapa !== null) {
    formularioDeEtapa = (
      <FormularioDeEtapa
        datos={nuevaEtapa}
        areas={areas}
        claves={clavesConocidas(detalle)}
        listaId={`claves-${detalle.id}`}
        ocupado={ocupado}
        onCambiar={setNuevaEtapa}
        onEnviar={agregarEtapa}
        onCancelar={cerrarEtapa}
      />
    );
  }

  let formularioDeFirma = null;
  if (firma !== null) {
    formularioDeFirma = (
      <FormularioDeFirma
        datos={firma}
        ocupado={ocupado}
        onCambiar={setFirma}
        onEnviar={firmar}
        onCancelar={cerrarFirma}
      />
    );
  }

  // Finanzas pide, y administración también, porque es quien acompaña el trámite.
  let rol = null;
  if (usuario !== null && usuario !== undefined) {
    rol = usuario.role;
  }

  let panelDeFinanzas = null;
  if (rol === "finance" || rol === "admin") {
    panelDeFinanzas = (
      <PedidoAFinanzas
        datos={pedido}
        ocupado={ocupado}
        onCambiar={setPedido}
        onEnviar={pedirFinanzas}
        onRetirar={retirarPedido}
      />
    );
  }

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

      {bloqueDeError}

      <ComoVa detalle={detalle} />

      <dl className="project-detail-facts">
        <dt>Solicitante</dt>
        <dd>{oGuion(detalle.requester)}</dd>

        <dt>Estatus</dt>
        <dd>
          <select
            value={detalle.statusId}
            onChange={(evento) => cambiarEstatus(evento.target.value)}
            disabled={ocupado}
          >
            {estatus.map((uno) => {
              let sufijo = ` (${uno.areaName})`;
              if (uno.isGlobal) {
                sufijo = "";
              }
              return (
                <option value={uno.id} key={uno.id}>
                  {uno.label}
                  {sufijo}
                </option>
              );
            })}
          </select>
        </dd>

        <dt>Con costo</dt>
        <dd>{detalle.hasCost ? "Sí" : "No"}</dd>

        <dt>Urgencia</dt>
        <dd>{detalle.priority}</dd>

        <dt>Entrega</dt>
        <dd>{detalle.dueOn ?? "sin fecha"}</dd>

        {bloqueDeCierre}
      </dl>

      <div className="project-detail-actions">
        <button
          type="button"
          onClick={cerrarProyecto}
          disabled={ocupado || detalle.closedAt !== null}
        >
          Cerrar el proyecto
        </button>
        <button
          type="button"
          onClick={archivarProyecto}
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
            <FilaDeEtapa
              etapa={etapa}
              fieldValues={detalle.fieldValues}
              ocupado={ocupado}
              onTransicion={moverEtapa}
              onBloquear={bloquearEtapa}
              onFirmar={abrirFirma}
              key={etapa.id}
            />
          ))}
        </tbody>
      </table>

      <button type="button" onClick={abrirEtapa} disabled={ocupado}>
        Agregar etapa
      </button>

      {formularioDeEtapa}
      {formularioDeFirma}

      <h4 className="project-detail-subtitle">Valores del proyecto</h4>
      <p className="project-detail-help">
        Lo que una etapa produce y otra lee sin recapturar (RF-FLW-06): el número de orden, el
        folio del SIN, el pantone.
      </p>
      <ValoresDelProyecto
        detalle={detalle}
        ocupado={ocupado}
        onGuardar={guardarValorExistente}
        onQuitar={quitarValor}
      />

      <form className="project-detail-inline" onSubmit={guardarValorNuevo}>
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

      {panelDeFinanzas}

      <h4 className="project-detail-subtitle">Solicitudes que contesta</h4>
      <SolicitudesQueContesta requests={detalle.requests} />
    </section>
  );
}

export default ProjectDetail;
