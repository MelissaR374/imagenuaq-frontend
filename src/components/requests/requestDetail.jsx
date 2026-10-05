// Una solicitud abierta en su lugar, bajo su renglón de la bandeja, y el paso a proyecto.
//
// La tira de «Recorrido» es el de DATAMODEL.md §8.2 visto desde una sola solicitud: en qué paso
// está y qué falta para el siguiente. Está aquí porque los pasos 2 y 3 los mueve una mano y no un
// automatismo, así que la pantalla tiene que decir cuál es esa mano y qué le toca; si no, la
// solicitud se queda quieta y nadie sabe por qué.
//
// Todo lo editable se guarda junto, en un solo PATCH: la gente llena los formatos mal y corregir
// un campo a la vez dejaba medio guardado lo que todavía se estaba pensando. Lo cambiado se marca
// en ámbar, el pie cuenta los cambios y la acción azul es «Guardar cambios» mientras haya algo
// que guardar y «Convertir en proyecto» cuando no. El estatus es la excepción: tiene su propio
// endpoint y se guarda al elegirlo.
//
// Lo capturado se muestra con los campos del formato con el que se capturó, no con el formato
// de hoy: una versión publicada no se edita, así que una solicitud vieja se sigue leyendo como
// se llenó. Lo que venga de una hoja trae además el renglón crudo, con las columnas que el
// mapeo ignoró (RF-SOL-06).
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import FlowDesigner from "../FlowDesigner/FlowDesigner.jsx";
import Ayuda from "../shared/ayuda.jsx";
import RequesterInput from "./requesterInput.jsx";
import "./requestDetail.css";

/**
 * Los pasos del recorrido que le tocan a una solicitud. El 1 ya pasó si estamos viéndola; del 5
 * en adelante son del proyecto y se ven en su propia pantalla.
 */
const RECORRIDO = [
  {
    clave: "nacio",
    titulo: "Recibida",
    mueve: "Se capturó a mano o llegó de un libro de Excel.",
  },
  {
    clave: "repartir",
    titulo: "Con flujo",
    mueve:
      "Falta decidir por qué áreas va a pasar: aplícale una plantilla, diséñale su flujo o asígnale un área.",
  },
  {
    clave: "atender",
    titulo: "En atención",
    mueve:
      "Las áreas de la primera fase la tienen en su bandeja y mueven el estatus conforme avanza.",
  },
  {
    clave: "convertir",
    titulo: "Proyecto",
    mueve: "Ya es un proyecto: se llevó su flujo y todos los datos capturados.",
  },
];

/** Cómo llegó, en palabras. */
const ORIGENES = {
  manual: "Captura directa",
  email: "Correo",
  form: "Formulario",
  sheet: "Excel",
};

/**
 * Cuál de los pasos es el actual. Una convertida ya pasó por todos, aunque su estatus siga
 * diciendo «Recibido» (DATAMODEL.md §8.4, costura 1). Una con área asignada a mano, de antes de
 * los flujos, cuenta como repartida.
 */
function pasoActualDe(detalle) {
  if (detalle.projectId !== null) {
    return "convertir";
  }
  const tieneFlujo = Boolean(detalle.flow) || Boolean(detalle.hasFlow);
  if (!tieneFlujo && detalle.areaId === null) {
    return "repartir";
  }
  return "atender";
}

/** Las áreas de la primera fase del flujo: las que la reciben (DATAMODEL.md §2.5). */
function areasDeLaPrimeraFase(flujo) {
  if (!flujo || flujo.phases.length === 0) {
    return [];
  }
  return [...new Set(flujo.phases[0].stages.map((etapa) => etapa.areaId))];
}

/** Un valor capturado como texto legible: los booleanos como sí/no y lo demás tal cual. */
function formatearValor(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "Sin valor todavía";
  }
  if (valor === true) {
    return "Sí";
  }
  if (valor === false) {
    return "No";
  }
  if (typeof valor === "object") {
    return JSON.stringify(valor);
  }
  return String(valor);
}

/**
 * La tira del recorrido. El paso actual va marcado y es el único que explica qué lo mueve: los
 * demás ya pasaron o todavía no tocan.
 */
function Recorrido({ pasoActual }) {
  const indiceActual = RECORRIDO.findIndex((paso) => paso.clave === pasoActual);
  const actual = RECORRIDO[indiceActual];

  return (
    <>
      <ol className="request-detail-walk">
        {RECORRIDO.map((paso, indice) => {
          let estado = "pendiente";
          if (indice < indiceActual) {
            estado = "hecho";
          }
          if (indice === indiceActual) {
            estado = "actual";
          }

          return (
            <li className={`request-detail-walk-step is-${estado}`} key={paso.clave}>
              {paso.titulo}
            </li>
          );
        })}
      </ol>
      <p className="request-detail-walk-says">{actual.mueve}</p>
    </>
  );
}

/**
 * El flujo a todo lo ancho: fase tras fase, con una tarjeta por etapa y flechas entre fases. Es
 * el mismo lienzo punteado del diseñador, aquí nada más para leerse.
 */
function FlujoExtendido({ flujo }) {
  return (
    <div className="request-detail-flow-canvas">
      {flujo.phases.map((fase, indice) => (
        <Fragment key={fase.id}>
          {indice > 0 ? <div className="request-detail-flow-arrow" /> : null}
          <div className="request-detail-flow-phase">
            <span className="request-detail-flow-phase-name">
              FASE {indice + 1} · {fase.name}
            </span>
            {fase.stages.map((etapa) => (
              <article
                className={
                  indice === 0
                    ? "request-detail-flow-card is-first"
                    : "request-detail-flow-card"
                }
                key={etapa.id}
              >
                <span className="request-detail-flow-card-area">{etapa.areaName}</span>
                <strong>{etapa.title}</strong>
                <span className="request-detail-flow-card-meta">
                  {etapa.defaultAssigneeName ?? "Sin responsable"}
                  {etapa.estimatedDays === null ? "" : ` · ${etapa.estimatedDays} d`}
                </span>
              </article>
            ))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** El renglón como lo tenía la hoja, columnas ignoradas incluidas (RF-SOL-06). */
function RenglonOriginal({ sourceData }) {
  return (
    <details className="request-detail-raw">
      <summary>El renglón como viene en el libro de Excel</summary>
      <dl className="request-detail-raw-list">
        {Object.keys(sourceData).map((columna) => (
          <Fragment key={columna}>
            <dt>{columna}</dt>
            <dd>{formatearValor(sourceData[columna])}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}

/**
 * El paso 4 del recorrido, en el mismo lugar. Lo que se deje vacío lo toma de la solicitud; las
 * etapas salen de su flujo. La llave se deja vacía a propósito: la numera el servidor, para que
 * dos personas convirtiendo a la vez no choquen en la misma.
 */
function FormularioDeConversion({ datos, flujo, ocupado, onCambiar, onEnviar, onCancelar }) {
  function cambiar(clave, valor) {
    onCambiar({ ...datos, [clave]: valor });
  }

  let avisoDelFlujo =
    "Sin flujo: el proyecto nace sin etapas. Si ya sabes por qué áreas va a pasar, aplícale o diséñale su flujo antes de convertirla.";
  if (flujo) {
    const etapas = flujo.phases.reduce((total, fase) => total + fase.stages.length, 0);
    avisoDelFlujo = `El proyecto nace con el flujo de la solicitud: ${flujo.phases.length} ${
      flujo.phases.length === 1 ? "fase" : "fases"
    } y ${etapas} ${etapas === 1 ? "etapa" : "etapas"}. Las de la primera fase empiezan activas.`;
  }

  return (
    <form className="request-detail-convert" onSubmit={onEnviar}>
      <h3>
        Convertir en proyecto
        <Ayuda texto="Lo que se deje vacío se toma de la solicitud. Cada valor capturado pasa al proyecto con su clave, para que la orden de impresión y la facturación lo lean sin recapturar." />
      </h3>

      <div className="request-detail-grid">
        <label className="request-detail-field">
          <span className="request-detail-label">
            Llave del proyecto
            <Ayuda texto="Si se deja vacía, el servidor la numera como PRY-000001 al crear el proyecto. Escríbela solo si la coordinación ya usa una llave propia." />
          </span>
          <input
            value={datos.key}
            onChange={(evento) => cambiar("key", evento.target.value)}
            placeholder="Ej: PAPEL-FCQ-03"
          />
        </label>

        <label className="request-detail-field">
          <span className="request-detail-label">Título del proyecto</span>
          <input value={datos.title} onChange={(evento) => cambiar("title", evento.target.value)} />
        </label>

        <div className="request-detail-field">
          <span className="request-detail-label" id={`convertir-solicitante-${datos.id}-label`}>
            Entidad solicitante
            <Ayuda texto="Este es el momento de corregir el nombre: el proyecto se queda con el que se escriba aquí." />
          </span>
          <RequesterInput
            id={`convertir-solicitante-${datos.id}`}
            value={datos.requester}
            onChange={(requester) => cambiar("requester", requester)}
          />
        </div>

        <label className="request-detail-check">
          <input
            type="checkbox"
            checked={datos.hasCost}
            onChange={(evento) => cambiar("hasCost", evento.target.checked)}
          />
          Con costo
        </label>
      </div>

      <p className="request-detail-note">{avisoDelFlujo}</p>

      <div className="request-detail-convert-actions">
        <button className="request-detail-btn" type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="request-detail-btn is-primary" type="submit" disabled={ocupado}>
          {ocupado ? "Convirtiendo…" : "Crear el proyecto"}
        </button>
      </div>
    </form>
  );
}

function RequestDetail({ solicitud, areas, onCerrar, onCambio }) {
  const [detalle, setDetalle] = useState(solicitud);
  const [borrador, setBorrador] = useState(null);
  const [estatus, setEstatus] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaElegida, setPlantillaElegida] = useState("");
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [conflictos, setConflictos] = useState([]);
  const [convertir, setConvertir] = useState(null);
  const [disenando, setDisenando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [confirmandoQuitarFlujo, setConfirmandoQuitarFlujo] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const [respuestaSolicitud, respuestaPlantillas] = await Promise.all([
          api.getRequest(solicitud.id),
          api.listWorkflows(),
        ]);
        if (cancelado) {
          return;
        }
        setDetalle(respuestaSolicitud.request);
        setBorrador(desdeDetalle(respuestaSolicitud.request));
        setPlantillas(respuestaPlantillas.workflows);
        await cargarEstatus(respuestaSolicitud.request, cancelado);
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      }
    }

    /**
     * Los estatus que esta solicitud puede tomar: los globales más los de cada área que la
     * tiene. Con flujo no hay `areaId`, así que las áreas salen de la primera fase; pedir solo
     * los globales dejaba fuera los del área que la está atendiendo.
     */
    async function cargarEstatus(actual, abortado) {
      const areaIds = areasDeLaPrimeraFase(actual.flow ?? null);
      if (actual.areaId !== null) {
        areaIds.push(actual.areaId);
      }

      const respuestas = await Promise.all(
        areaIds.length === 0
          ? [api.listStatuses()]
          : [...new Set(areaIds)].map((areaId) => api.listStatuses({ areaId })),
      );
      if (abortado) {
        return;
      }

      const porId = new Map();
      for (const respuesta of respuestas) {
        for (const uno of respuesta.statuses) {
          porId.set(uno.id, uno);
        }
      }
      setEstatus([...porId.values()]);
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [solicitud.id]);

  /** El borrador: lo editable de la solicitud, tal como está guardado. */
  function desdeDetalle(actual) {
    return {
      title: actual.title,
      requester: actual.requester ?? "",
      areaId: actual.areaId === null ? "" : String(actual.areaId),
      priority: String(actual.priority),
      data: { ...(actual.data ?? {}) },
    };
  }

  async function recargar() {
    const respuesta = await api.getRequest(detalle.id);
    setDetalle(respuesta.request);
    setBorrador(desdeDetalle(respuesta.request));
    onCambio(respuesta.request);
    return respuesta.request;
  }

  function escribir(clave, valor) {
    setBorrador((actual) => ({ ...actual, [clave]: valor }));
  }

  function escribirDato(code, valor) {
    setBorrador((actual) => ({ ...actual, data: { ...actual.data, [code]: valor } }));
  }

  const yaEsProyecto = detalle.projectId !== null;

  let campos = [];
  if (detalle.fields !== null && detalle.fields !== undefined) {
    campos = [...detalle.fields.deliverables, ...detalle.fields.information];
  }

  /** Qué está cambiado respecto de lo guardado: es lo que se marca en ámbar y lo que se cuenta. */
  const cambiados = [];
  if (borrador !== null) {
    const guardado = desdeDetalle(detalle);
    for (const clave of ["title", "requester", "areaId", "priority"]) {
      if (borrador[clave] !== guardado[clave]) {
        cambiados.push(clave);
      }
    }
    for (const campo of campos) {
      const antes = guardado.data[campo.code] ?? "";
      const ahora = borrador.data[campo.code] ?? "";
      if (String(antes) !== String(ahora)) {
        cambiados.push(campo.code);
      }
    }
  }
  const sucio = cambiados.length > 0;

  function marcar(clave, base) {
    return cambiados.includes(clave) ? `${base} is-changed` : base;
  }

  async function guardar() {
    const guardadoAntes = desdeDetalle(detalle);
    const cambios = {};
    if (borrador.title !== guardadoAntes.title) {
      cambios.title = borrador.title;
    }
    if (borrador.requester !== guardadoAntes.requester) {
      cambios.requester = borrador.requester;
    }
    if (borrador.areaId !== guardadoAntes.areaId && borrador.areaId !== "") {
      cambios.areaId = Number(borrador.areaId);
    }
    if (borrador.priority !== guardadoAntes.priority) {
      cambios.priority = Number(borrador.priority);
    }
    if (campos.some((campo) => cambiados.includes(campo.code))) {
      cambios.data = borrador.data;
    }

    setOcupado(true);
    setError(null);
    try {
      await api.updateRequest(detalle.id, cambios);
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  function descartar() {
    setBorrador(desdeDetalle(detalle));
    setError(null);
  }

  async function cambiarEstatus(statusId) {
    setOcupado(true);
    setError(null);
    try {
      await api.setRequestStatus(detalle.id, Number(statusId));
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function aplicarPlantilla() {
    setOcupado(true);
    setError(null);
    try {
      await api.setRequestFlow(detalle.id, { workflowId: Number(plantillaElegida) });
      setPlantillaElegida("");
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function quitarFlujo() {
    setOcupado(true);
    setError(null);
    try {
      await api.clearRequestFlow(detalle.id);
      setConfirmandoQuitarFlujo(false);
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function flujoGuardado() {
    setDisenando(false);
    await recargar();
  }

  async function eliminar() {
    setOcupado(true);
    setError(null);
    try {
      await api.deleteRequest(detalle.id);
      onCambio(null);
      onCerrar();
    } catch (fallo) {
      setError(fallo.message);
      setOcupado(false);
    }
  }

  function abrirConversion() {
    setConvertir({
      id: detalle.id,
      key: "",
      title: detalle.title,
      requester: detalle.requester ?? "",
      hasCost: false,
    });
  }

  async function convertirEnProyecto(evento) {
    evento.preventDefault();

    setOcupado(true);
    setError(null);
    try {
      const respuesta = await api.convertRequest(detalle.id, {
        key: convertir.key || undefined,
        title: convertir.title || undefined,
        requester: convertir.requester || undefined,
        hasCost: convertir.hasCost,
      });
      setConflictos(respuesta.conflicts);
      setConvertir(null);
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  if (disenando) {
    return (
      <FlowDesigner
        solicitud={detalle}
        onGuardado={flujoGuardado}
        onCerrar={() => setDisenando(false)}
      />
    );
  }

  if (borrador === null) {
    return <p className="request-detail-loading">Abriendo la solicitud…</p>;
  }

  const flujo = detalle.flow ?? null;
  const activas = plantillas.filter((una) => una.isActive);

  let origen = ORIGENES[detalle.source] ?? detalle.source;
  if (detalle.sheetName !== null && detalle.sheetName !== undefined) {
    origen = `${origen} · ${detalle.sheetName}`;
  }

  return (
    <section className="request-detail">
      <header className="request-detail-head">
        <span className="request-detail-eyebrow">
          {detalle.folio} · {detalle.schemaName} v{detalle.schemaVersion} · {origen}
        </span>
        <button
          className="request-detail-close"
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar la solicitud"
        >
          ✕
        </button>
      </header>

      <Recorrido pasoActual={pasoActualDe(detalle)} />

      {detalle.duplicateOfFolio !== null && detalle.duplicateOfFolio !== undefined ? (
        <p className="request-detail-dup">
          Se parece a {detalle.duplicateOfFolio}: puede ser la misma petición capturada dos veces.
        </p>
      ) : null}

      {error !== null ? <p className="request-detail-error">{error}</p> : null}

      <div className="request-detail-columns">
        <section className="request-detail-sec">
          <h3>Solicitud</h3>

          <div className="request-detail-grid">
            <label className={marcar("title", "request-detail-field")}>
              <span className="request-detail-label">Título</span>
              {yaEsProyecto ? (
                <p className="request-detail-value">{detalle.title}</p>
              ) : (
                <input
                  value={borrador.title}
                  onChange={(evento) => escribir("title", evento.target.value)}
                  placeholder="Ej: Papelería institucional de la facultad"
                />
              )}
            </label>

            <div className={marcar("requester", "request-detail-field")}>
              <span className="request-detail-label" id={`solicitante-${detalle.id}-label`}>
                Entidad solicitante
                <Ayuda texto="No hay padrón de solicitantes: el nombre es una cadena y el autocompletado es lo que evita que se vuelva cuatro. Se puede corregir incluso después de convertir." />
              </span>
              <RequesterInput
                id={`solicitante-${detalle.id}`}
                value={borrador.requester}
                onChange={(requester) => escribir("requester", requester)}
              />
            </div>

            <label className={marcar("areaId", "request-detail-field")}>
              <span className="request-detail-label">
                Área asignada
                <Ayuda texto="El área que atiende la solicitud mientras no tiene flujo. Con flujo, la reciben las áreas de su primera fase. Una vez asignada ya no se puede dejar sin área: solo cambiarla." />
              </span>
              {yaEsProyecto ? (
                <p className="request-detail-value">{detalle.areaName ?? "Sin asignar"}</p>
              ) : (
                <select
                  value={borrador.areaId}
                  onChange={(evento) => escribir("areaId", evento.target.value)}
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
                <Ayuda texto="El estatus se guarda al elegirlo, no con los demás cambios: tiene su propio registro con quién lo movió y cuándo (RF-EST-01). Se ofrecen los globales y los del área que la atiende." />
              </span>
              <select
                value={detalle.statusId}
                onChange={(evento) => cambiarEstatus(evento.target.value)}
                disabled={ocupado}
              >
                {estatus.map((uno) => (
                  <option value={uno.id} key={uno.id}>
                    {uno.label}
                    {uno.isGlobal ? "" : " (del área)"}
                  </option>
                ))}
              </select>
            </label>

            <label className={marcar("priority", "request-detail-field")}>
              <span className="request-detail-label">
                Urgencia
                <Ayuda texto="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
              </span>
              {yaEsProyecto ? (
                <p className="request-detail-value">{detalle.priority}</p>
              ) : (
                <input
                  type="number"
                  value={borrador.priority}
                  onChange={(evento) => escribir("priority", evento.target.value)}
                />
              )}
            </label>

            {yaEsProyecto ? (
              <div className="request-detail-field">
                <span className="request-detail-label">Proyecto</span>
                <p className="request-detail-value">
                  {detalle.projectKey} — {detalle.projectTitle}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="request-detail-sec">
          <h3>
            Lo capturado
            <span className="request-detail-sub">
              con {detalle.schemaName} v{detalle.schemaVersion}
            </span>
          </h3>

          {campos.length === 0 ? (
            <p className="request-detail-note">Este formato no pide ningún campo.</p>
          ) : (
            <div className="request-detail-captured">
              {campos.map((campo) =>
                yaEsProyecto ? (
                  <div className="request-detail-field" key={campo.code}>
                    <span className="request-detail-label">{campo.name}</span>
                    <p className="request-detail-value">
                      {formatearValor(borrador.data[campo.code])}
                    </p>
                  </div>
                ) : (
                  <div className={marcar(campo.code, "request-detail-typed")} key={campo.code}>
                    <FieldInput
                      field={campo}
                      value={borrador.data[campo.code]}
                      onChange={(valor) => escribirDato(campo.code, valor)}
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
          {flujo && !yaEsProyecto ? (
            <div className="request-detail-flow-actions">
              <button
                className="request-detail-quiet"
                type="button"
                onClick={() => setDisenando(true)}
                disabled={ocupado}
              >
                Editar el flujo
              </button>
              {confirmandoQuitarFlujo ? (
                <>
                  <span className="request-detail-confirm">
                    Dejará de aparecer en las bandejas de sus áreas.
                  </span>
                  <button
                    className="request-detail-btn is-danger"
                    type="button"
                    onClick={quitarFlujo}
                    disabled={ocupado}
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
                  disabled={ocupado}
                >
                  Quitar el flujo
                </button>
              )}
            </div>
          ) : null}
        </div>

        {flujo ? (
          <>
            {flujo.workflowName ? (
              <p className="request-detail-note">
                Copiado de la plantilla «{flujo.workflowName}», versión {flujo.version}.
              </p>
            ) : null}
            <FlujoExtendido flujo={flujo} />
          </>
        ) : (
          <div className="request-detail-noflow">
            <p>
              {detalle.areaName === null || detalle.areaName === undefined
                ? "Sin flujo: todavía no pasa por ninguna área."
                : `Sin flujo: la atiende ${detalle.areaName} por el área asignada.`}
            </p>
            {yaEsProyecto ? null : (
              <div className="request-detail-noflow-actions">
                <select
                  value={plantillaElegida}
                  onChange={(evento) => setPlantillaElegida(evento.target.value)}
                  disabled={ocupado || activas.length === 0}
                >
                  <option value="">Elige una plantilla</option>
                  {activas.map((una) => (
                    <option value={una.id} key={una.id}>
                      {una.name}
                    </option>
                  ))}
                </select>
                <button
                  className="request-detail-btn"
                  type="button"
                  onClick={aplicarPlantilla}
                  disabled={ocupado || plantillaElegida === ""}
                >
                  Aplicar
                </button>
                <span className="request-detail-or">o</span>
                <button
                  className="request-detail-btn"
                  type="button"
                  onClick={() => setDisenando(true)}
                  disabled={ocupado}
                >
                  Diseñar su flujo
                </button>
              </div>
            )}
          </div>
        )}

        {detalle.sourceData !== null && detalle.sourceData !== undefined ? (
          <RenglonOriginal sourceData={detalle.sourceData} />
        ) : null}
      </section>

      {conflictos.length > 0 ? (
        <section className="request-detail-sec">
          <h3>Valores que dos solicitudes traían distintos</h3>
          <ul className="request-detail-conflicts">
            {conflictos.map((conflicto) => (
              <li key={conflicto.key}>
                En <strong>{conflicto.key}</strong> se guardó «{conflicto.kept}» y se descartó «
                {conflicto.discarded}», que venía de {conflicto.folio}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {convertir !== null ? (
        <FormularioDeConversion
          datos={convertir}
          flujo={flujo}
          ocupado={ocupado}
          onCambiar={setConvertir}
          onEnviar={convertirEnProyecto}
          onCancelar={() => setConvertir(null)}
        />
      ) : null}

      <footer className="request-detail-foot">
        {yaEsProyecto ? (
          <p className="request-detail-note">
            Ya es un proyecto, así que no se edita ni se elimina: el proyecto perdería lo que
            contesta. El solicitante sí se puede corregir.
          </p>
        ) : confirmandoBorrado ? (
          <div className="request-detail-flow-actions">
            <span className="request-detail-confirm">
              Se quita de la bandeja. Lo que vino de Excel se puede volver a traer importando el
              libro otra vez.
            </span>
            <button
              className="request-detail-btn is-danger"
              type="button"
              onClick={eliminar}
              disabled={ocupado}
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
            disabled={ocupado}
          >
            Eliminar
          </button>
        )}

        {yaEsProyecto ? null : (
          <div className="request-detail-foot-right">
            {sucio ? (
              <>
                <span className="request-detail-dirty">
                  {cambiados.length} {cambiados.length === 1 ? "cambio" : "cambios"} sin guardar
                </span>
                <button
                  className="request-detail-btn"
                  type="button"
                  onClick={descartar}
                  disabled={ocupado}
                >
                  Descartar
                </button>
                <button
                  className="request-detail-btn is-primary"
                  type="button"
                  onClick={guardar}
                  disabled={ocupado || borrador.title.trim() === ""}
                >
                  {ocupado ? "Guardando…" : "Guardar cambios"}
                </button>
              </>
            ) : (
              <button
                className="request-detail-btn is-primary"
                type="button"
                onClick={abrirConversion}
                disabled={ocupado || convertir !== null}
              >
                Convertir en proyecto
              </button>
            )}
          </div>
        )}
      </footer>
    </section>
  );
}

export default RequestDetail;
