// Un proyecto a pantalla completa, con su flujo vivo, sus etapas, sus valores y las solicitudes
// que contesta. Se abre encima de la lista y de la barra lateral porque lleva un proceso con
// muchas partes a la vez y, abierto bajo su renglón, quedaba interrumpido.
//
// Los dos vocabularios de estado existen por DATAMODEL.md §8.1 y no se tocan: el estatus es el
// del catálogo que coordinación edita en caliente y lo mueve una mano; el estado del trabajo es
// la máquina de etapas y lo mueve un visto bueno. Un proyecto puede decir «Recibido» con todas
// sus etapas concluidas, así que la pantalla los muestra juntos: es la única forma de que la
// contradicción se vea en lugar de esconderse.
//
// Un proyecto no tiene «etapa actual»: la etapa actual es el conjunto de etapas abiertas, porque
// un mismo proyecto puede estar en dos áreas a la vez (RF-FLW-09). Por eso el flujo se muestra
// completo, fase por fase y con su intento: cuando un visto bueno rechaza, la etapa se cierra y
// se abre otra vez con el intento siguiente, y las dos quedan a la vista.
//
// `done` no se pone a mano: una etapa la cierra un visto bueno (RF-FLW-03), y un visto bueno que
// deja su fase sin nada abierto abre la fase siguiente en la misma sentencia (§2.12). Concluir el
// proyecto vive al final del flujo, no en el pie, porque es el último paso del recorrido.
//
// Cancelar una etapa no se ofrece: no es una función del sistema, aunque la API la acepte.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta } from "../shared/formato.js";
import { nombreDeClave } from "../shared/vocabulario.js";
import Ayuda from "../shared/ayuda.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import "./projectDetail.css";

const ESTADOS_ETAPA = {
  pending: "Pendiente",
  active: "Activa",
  waiting_external: "En espera",
  done: "Concluida",
  cancelled: "Cancelada",
};

const ESTADOS_ABIERTOS = ["active", "waiting_external"];

/** Lo que se espera de un tercero, dicho como lo dice la gente (RF-FLW-07). */
const MOTIVOS = [
  "Visto bueno de la entidad",
  "Información de la entidad",
  "Material o proveedor",
  "Pago o anticipo",
];

/**
 * Dos claves que no salen de ningún formato: las pide finanzas con su propio endpoint y aquí se
 * leen como cualquier otro valor del proyecto.
 */
const CLAVES_DE_FINANZAS = {
  requiere_factura: { name: "Requiere factura", type: "boolean" },
  requiere_cotizacion: { name: "Requiere cotización", type: "boolean" },
};

/** El nombre y el tipo de una clave, mirando el vocabulario y las dos de finanzas. */
function campoDeClave(vocabulario, clave) {
  const deFinanzas = CLAVES_DE_FINANZAS[clave];
  if (deFinanzas !== undefined) {
    return { code: clave, ...deFinanzas };
  }
  const delVocabulario = vocabulario.get(clave);
  if (delVocabulario === undefined) {
    return { code: clave, name: clave, type: "text" };
  }
  return { code: clave, name: delVocabulario.name, type: delVocabulario.type };
}

/** Las etapas agrupadas por su fase: el mismo `seq` dos veces son dos etapas en paralelo. */
function fasesDe(stages) {
  const fases = new Map();
  for (const etapa of stages) {
    if (!fases.has(etapa.seq)) {
      fases.set(etapa.seq, { seq: etapa.seq, name: etapa.phaseName, stages: [] });
    }
    fases.get(etapa.seq).stages.push(etapa);
  }
  return [...fases.values()].sort((una, otra) => una.seq - otra.seq);
}

/** Si una clave ya tiene valor: es lo que el visto bueno exige (RF-FLW-06). */
function tieneValor(fieldValues, clave) {
  return fieldValues.some((valor) => valor.key === clave && valor.value !== "");
}

/**
 * Los dos vocabularios de estado, uno al lado del otro, y el aviso cuando se contradicen. No se
 * unen a propósito; lo que sí se puede hacer es que se vean.
 */
function ComoVa({ detalle, estatus, ocupado, onEstatus }) {
  const abiertas = detalle.stages.filter((etapa) => ESTADOS_ABIERTOS.includes(etapa.status));
  const concluidas = detalle.stages.filter((etapa) => etapa.status === "done");

  let trabajo = "Todavía sin etapas: se agregan al final del flujo.";
  if (abiertas.length > 0) {
    trabajo = `Se trabaja en ${abiertas
      .map((etapa) => `${etapa.title} (${etapa.areaName})`)
      .join(", ")}.`;
  } else if (concluidas.length > 0) {
    trabajo = `Ninguna etapa abierta; ${concluidas.length} ${
      concluidas.length === 1 ? "concluida" : "concluidas"
    }.`;
  }

  const trabajoTerminado =
    detalle.stages.length > 0 && abiertas.length === 0 && concluidas.length > 0;
  const estatusLoDice = detalle.statusIsTerminal || detalle.closedAt !== null;

  return (
    <section className="project-how">
      <div className="project-how-half">
        <h3>Estatus que se muestra</h3>
        <select
          value={detalle.statusId}
          onChange={(evento) => onEstatus(evento.target.value)}
          disabled={ocupado}
        >
          {estatus.map((uno) => (
            <option value={uno.id} key={uno.id}>
              {uno.label}
              {uno.isGlobal ? "" : ` (${uno.areaName})`}
            </option>
          ))}
        </select>
        <p className="project-note">
          Desde {fechaCorta(detalle.statusSince)}. Es lo que se le dice a quien preguntó, y se
          guarda al elegirlo.
        </p>
      </div>

      <div className="project-how-half">
        <h3>Estado del trabajo</h3>
        <p className="project-how-work">{trabajo}</p>
        <p className="project-note">La mueve un visto bueno, no el estatus.</p>
      </div>

      {trabajoTerminado && !estatusLoDice ? (
        <p className="project-warn">
          El trabajo ya no tiene etapas abiertas, pero el estatus sigue en «{detalle.statusLabel}».
          Nada lo mueve solo.
        </p>
      ) : null}
    </section>
  );
}

/** Una tarjeta de etapa en el flujo, con su estado y lo que debe entregar. */
function TarjetaDeEtapa({ etapa, fieldValues, vocabulario, elegida, onElegir }) {
  let clase = `project-card is-${etapa.status}`;
  if (elegida) {
    clase += " is-selected";
  }

  return (
    <button className={clase} type="button" onClick={() => onElegir(etapa.id)}>
      <span className="project-card-area">{etapa.areaName}</span>
      <strong>{etapa.title}</strong>
      <span className="project-card-meta">
        {ESTADOS_ETAPA[etapa.status] ?? etapa.status}
        {etapa.attempt > 1 ? ` · intento ${etapa.attempt}` : ""}
        {etapa.assignedToName === null ? "" : ` · ${etapa.assignedToName}`}
      </span>
      {etapa.outputs.length === 0 ? null : (
        <span className="project-card-outputs">
          {etapa.outputs.map((clave) => (
            <span
              className={
                tieneValor(fieldValues, clave) ? "project-owed is-done" : "project-owed"
              }
              key={clave}
            >
              {nombreDeClave(vocabulario, clave)}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

/**
 * El flujo vivo: fase tras fase, y al final la columna FIN, donde el proyecto se concluye. Es el
 * mismo lienzo del diseñador, con el estado de cada etapa.
 */
function FlujoVivo({
  detalle, fases, vocabulario, elegida, ocupado, abiertas,
  onElegir, onAgregar, onConcluir, onArchivarConcluido,
}) {
  const [tambienArchivar, setTambienArchivar] = useState(false);

  return (
    <div className="project-flow">
      {fases.map((fase, indice) => (
        <Fragment key={fase.seq}>
          {indice > 0 ? <div className="project-flow-arrow" /> : null}
          <div className="project-flow-phase">
            <span className="project-flow-phase-name">
              FASE {indice + 1}
              {fase.name === null ? "" : ` · ${fase.name}`}
            </span>
            {fase.stages.map((etapa) => (
              <TarjetaDeEtapa
                etapa={etapa}
                fieldValues={detalle.fieldValues}
                vocabulario={vocabulario}
                elegida={etapa.id === elegida}
                onElegir={onElegir}
                key={etapa.id}
              />
            ))}
          </div>
        </Fragment>
      ))}

      {fases.length > 0 ? <div className="project-flow-arrow" /> : null}

      <div className="project-flow-phase">
        <span className="project-flow-phase-name">Agregar</span>
        <button className="project-card-add" type="button" onClick={onAgregar} disabled={ocupado}>
          + Agregar etapa
        </button>
      </div>

      <div className="project-flow-arrow" />

      <div className="project-flow-phase project-flow-end">
        <span className="project-flow-phase-name">FIN</span>
        {detalle.closedAt === null ? (
          <div className="project-card is-end">
            <button
              className="project-btn is-primary"
              type="button"
              onClick={() => onConcluir(tambienArchivar)}
              disabled={ocupado || abiertas.length > 0}
            >
              Concluir proyecto
            </button>
            <label className="project-check">
              <input
                type="checkbox"
                checked={tambienArchivar}
                onChange={(evento) => setTambienArchivar(evento.target.checked)}
              />
              y archivarlo
              <Ayuda texto="Concluir dice que el trabajo terminó. Archivar lo quita de en medio sin decir nada del trabajo; se puede archivar después." />
            </label>
            {abiertas.length > 0 ? (
              <span className="project-card-why">
                {abiertas.length} {abiertas.length === 1 ? "etapa sigue" : "etapas siguen"} abiertas
              </span>
            ) : null}
          </div>
        ) : (
          <div className="project-card is-done">
            <strong>Concluido</strong>
            <span className="project-card-meta">{fechaCorta(detalle.closedAt)}</span>
            {detalle.archivedAt === null ? (
              <button
                className="project-btn"
                type="button"
                onClick={onArchivarConcluido}
                disabled={ocupado}
              >
                Archivar
              </button>
            ) : (
              <span className="project-card-meta">
                Archivado el {fechaCorta(detalle.archivedAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Qué le toca a quien está viendo, dicho en una frase. */
function miParteEn(etapa, usuario) {
  if (usuario === null || usuario === undefined) {
    return `La atiende ${etapa.areaName}.`;
  }
  if (etapa.assignedTo === usuario.id) {
    return "Te toca esta etapa.";
  }
  if (usuario.role === "admin") {
    return "Coordinas el proyecto.";
  }
  if (usuario.role === "finance") {
    return `Solo consulta: la atiende ${etapa.areaName}.`;
  }
  return `La atiende ${etapa.areaName}.`;
}

/**
 * La etapa elegida, bajo el flujo: lo que pide, lo que debe y lo que se puede hacer con ella. Lo
 * que se puede hacer depende del estado de la etapa y de quién la está viendo.
 */
function PanelDeEtapa({
  etapa, detalle, fases, vocabulario, usuario, gente, ocupado, falta, siguienteFase,
  onResponsable, onEsperar, onReanudar, onIniciar, onFirmar,
}) {
  const [motivo, setMotivo] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [firma, setFirma] = useState(null);

  const indiceDeFase = fases.findIndex((fase) => fase.seq === etapa.seq);

  let efectoDelVisto = `Aprobar concluye la etapa${
    siguienteFase === null
      ? " y, si no queda nada abierto en su fase, el proyecto se puede concluir."
      : ` y, si no queda nada abierto en su fase, abre la fase ${
          indiceDeFase + 2
        } (${siguienteFase.stages.map((una) => una.areaName).join(", ")}).`
  } Rechazar: la etapa vuelve como intento ${etapa.attempt + 1}.`;
  if (falta !== null) {
    efectoDelVisto = `No disponible: falta ${falta}.`;
  }

  return (
    <section className="project-stage">
      <header className="project-stage-head">
        <span className="project-stage-place">
          FASE {indiceDeFase + 1}
          {etapa.phaseName === null ? "" : ` · ${etapa.phaseName}`} · {etapa.areaName}
        </span>
        <h3>
          {etapa.title}
          <span className={`project-stage-state is-${etapa.status}`}>
            {ESTADOS_ETAPA[etapa.status] ?? etapa.status}
            {etapa.attempt > 1 ? ` · intento ${etapa.attempt}` : ""}
          </span>
        </h3>
        <p className="project-stage-mine">{miParteEn(etapa, usuario)}</p>
      </header>

      {etapa.status === "waiting_external" ? (
        <p className="project-warn">
          En espera desde {fechaCorta(etapa.startedAt)}: {etapa.blockedReason}
        </p>
      ) : null}

      <div className="project-stage-columns">
        <div>
          <h4>Lo que pide la etapa</h4>

          <div className="project-field">
            <span className="project-label">
              Responsable
              <Ayuda texto="Quien atiende la etapa. Se elige entre la gente del área; la responsable del área y coordinación pueden cambiarlo." />
            </span>
            <select
              value={etapa.assignedTo ?? ""}
              onChange={(evento) => onResponsable(etapa, evento.target.value)}
              disabled={ocupado || etapa.status === "done"}
            >
              <option value="">Sin responsable</option>
              {gente.map((persona) => (
                <option value={persona.id} key={persona.id}>
                  {persona.fullName}
                </option>
              ))}
            </select>
          </div>

          <h5>Necesita</h5>
          {etapa.inputs.length === 0 ? (
            <p className="project-note">Nada de otra etapa.</p>
          ) : (
            <ul className="project-io">
              {etapa.inputs.map((clave) => {
                const valor = detalle.fieldValues.find((uno) => uno.key === clave);
                return (
                  <li key={clave}>
                    <span className="project-label">{nombreDeClave(vocabulario, clave)}</span>
                    {valor === undefined || valor.value === "" ? (
                      <span className="project-missing">sin valor todavía</span>
                    ) : (
                      <span className="project-value">{valor.value}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <h5>
            Entrega{" "}
            {etapa.outputs.length === 0
              ? ""
              : `${etapa.outputs.filter((clave) => tieneValor(detalle.fieldValues, clave)).length} de ${etapa.outputs.length}`}
          </h5>
          {etapa.outputs.length === 0 ? (
            <p className="project-note">Nada que otra etapa espere.</p>
          ) : (
            <ul className="project-io">
              {etapa.outputs.map((clave) => {
                const valor = detalle.fieldValues.find((uno) => uno.key === clave);
                return (
                  <li key={clave}>
                    <span className="project-label">{nombreDeClave(vocabulario, clave)}</span>
                    {valor === undefined || valor.value === "" ? (
                      <span className="project-missing">sin valor todavía</span>
                    ) : (
                      <span className="project-value">{valor.value}</span>
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
        </div>

        <div>
          <h4>Acciones</h4>

          {etapa.status === "pending" ? (
            <div className="project-action">
              <button
                className="project-btn"
                type="button"
                onClick={() => onIniciar(etapa)}
                disabled={ocupado}
              >
                Iniciar ahora
              </button>
              <p className="project-note">
                Empieza sola cuando concluya la fase anterior. Iniciar ahora es la excepción.
              </p>
            </div>
          ) : null}

          {etapa.status === "waiting_external" ? (
            <div className="project-action">
              <button
                className="project-btn is-primary"
                type="button"
                onClick={() => onReanudar(etapa)}
                disabled={ocupado}
              >
                Ya respondieron: reanudar
              </button>
              <p className="project-note">Vuelve a quedar activa, con su mismo intento.</p>
            </div>
          ) : null}

          {etapa.status === "active" ? (
            <div className="project-action">
              {esperando ? (
                <form
                  className="project-wait"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    onEsperar(etapa, motivo);
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
                    {MOTIVOS.map((uno) => (
                      <button
                        className={motivo === uno ? "project-chip is-on" : "project-chip"}
                        type="button"
                        onClick={() => setMotivo(uno)}
                        key={uno}
                      >
                        {uno}
                      </button>
                    ))}
                  </div>
                  <input
                    value={motivo}
                    onChange={(evento) => setMotivo(evento.target.value)}
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
                      disabled={ocupado || motivo.trim() === ""}
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
                    disabled={ocupado}
                  >
                    Poner en espera
                    <Ayuda texto="Para cuando lo que falta no está en nuestras manos: un visto bueno de la entidad, material de un proveedor, un anticipo." />
                  </button>
                  <p className="project-note">Pide el motivo y lo deja a la vista.</p>
                </>
              )}
            </div>
          ) : null}

          {ESTADOS_ABIERTOS.includes(etapa.status) ? (
            <div className="project-action">
              {firma === null ? (
                <>
                  <button
                    className="project-btn is-primary"
                    type="button"
                    onClick={() => setFirma({ decision: "approved", comment: "" })}
                    disabled={ocupado || falta !== null}
                  >
                    Visto bueno
                  </button>
                  <p className={falta === null ? "project-note" : "project-note is-blocked"}>
                    {efectoDelVisto}
                  </p>
                </>
              ) : (
                <form
                  className="project-sign"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    onFirmar(etapa, firma);
                    setFirma(null);
                  }}
                >
                  <h5>Visto bueno de «{etapa.title}»</h5>
                  <div className="project-field">
                    <span className="project-label">Decisión</span>
                    <select
                      value={firma.decision}
                      onChange={(evento) => setFirma({ ...firma, decision: evento.target.value })}
                    >
                      <option value="approved">Aprobar</option>
                      <option value="rejected">Rechazar</option>
                    </select>
                  </div>
                  <p className="project-note">
                    {firma.decision === "approved"
                      ? efectoDelVisto
                      : `La etapa se cierra y vuelve a abrirse como intento ${
                          etapa.attempt + 1
                        }, para que el trabajo devuelto quede a la vista.`}
                  </p>
                  <div className="project-field">
                    <span className="project-label">
                      Comentario
                      <Ayuda texto="La conformidad del solicitante va aquí: el visto bueno es interno." />
                    </span>
                    <textarea
                      value={firma.comment}
                      onChange={(evento) => setFirma({ ...firma, comment: evento.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="project-action-row">
                    <button className="project-quiet" type="button" onClick={() => setFirma(null)}>
                      Cancelar
                    </button>
                    <button className="project-btn is-primary" type="submit" disabled={ocupado}>
                      Registrar
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          <h5>Vistos buenos</h5>
          {etapa.approvals.length === 0 ? (
            <p className="project-note">Ninguno todavía.</p>
          ) : (
            <ul className="project-approvals">
              {etapa.approvals.map((visto) => (
                <li key={visto.id}>
                  <span className="project-label">
                    {visto.decision === "approved" ? "Aprobó" : "Rechazó"} {visto.approverName} ·{" "}
                    {fechaCorta(visto.decidedAt)}
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

/** Agregar una etapa: la fase se elige por su nombre, no por un número de orden. */
function FormularioDeEtapa({ datos, areas, fases, vocabulario, ocupado, onCambiar, onEnviar, onCancelar }) {
  const claves = [...vocabulario.entries()];

  function cambiar(clave, valor) {
    onCambiar({ ...datos, [clave]: valor });
  }

  function alternarClave(cual, clave) {
    const actuales = datos[cual];
    cambiar(
      cual,
      actuales.includes(clave)
        ? actuales.filter((una) => una !== clave)
        : [...actuales, clave],
    );
  }

  return (
    <form className="project-stage-form" onSubmit={onEnviar}>
      <h3>Agregar una etapa</h3>

      <div className="project-grid">
        <label className="project-field">
          <span className="project-label">Área</span>
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

        <label className="project-field">
          <span className="project-label">Nombre de la etapa</span>
          <input
            value={datos.title}
            onChange={(evento) => cambiar("title", evento.target.value)}
            placeholder="Ej: Propuesta de diseño"
            required
          />
        </label>

        <label className="project-field">
          <span className="project-label">
            En qué fase
            <Ayuda texto="Dos etapas en la misma fase corren en paralelo: la fase concluye cuando no queda ninguna abierta." />
          </span>
          <select value={datos.seq} onChange={(evento) => cambiar("seq", evento.target.value)}>
            {fases.map((fase, indice) => (
              <option value={fase.seq} key={fase.seq}>
                {indice + 1}
                {fase.name === null ? "" : ` · ${fase.name}`}, en paralelo con lo que ya tiene
              </option>
            ))}
            <option value={fases.length === 0 ? 1 : fases[fases.length - 1].seq + 1}>
              Fase nueva, al final
            </option>
          </select>
        </label>

        <label className="project-field">
          <span className="project-label">Empieza</span>
          <select value={datos.status} onChange={(evento) => cambiar("status", evento.target.value)}>
            <option value="pending">Pendiente</option>
            <option value="active">Activa</option>
          </select>
        </label>
      </div>

      <h5>Qué necesita para trabajar</h5>
      <div className="project-chips">
        {claves.map(([clave, campo]) => (
          <button
            className={datos.inputs.includes(clave) ? "project-chip is-on" : "project-chip"}
            type="button"
            onClick={() => alternarClave("inputs", clave)}
            key={clave}
          >
            {campo.name}
          </button>
        ))}
      </div>

      <h5>Qué entrega</h5>
      <p className="project-note">
        Es una promesa: el visto bueno de esta etapa se niega mientras alguno no tenga valor, y por
        eso la etapa siguiente lo encuentra.
      </p>
      <div className="project-chips">
        {claves.map(([clave, campo]) => (
          <button
            className={datos.outputs.includes(clave) ? "project-chip is-on" : "project-chip"}
            type="button"
            onClick={() => alternarClave("outputs", clave)}
            key={clave}
          >
            {campo.name}
          </button>
        ))}
      </div>

      <div className="project-action-row">
        <button className="project-quiet" type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="project-btn is-primary" type="submit" disabled={ocupado}>
          Agregar etapa
        </button>
      </div>
    </form>
  );
}

function ProjectDetail({
  proyecto, areas, estatus: estatusIniciales, vocabulario, usuario,
  lugar, onAnterior, onSiguiente, onCerrar, onCambio,
}) {
  const [detalle, setDetalle] = useState(null);
  const [borrador, setBorrador] = useState(null);
  const [estatus, setEstatus] = useState(estatusIniciales ?? []);
  const [gente, setGente] = useState([]);
  const [elegida, setElegida] = useState(null);
  const [nuevaEtapa, setNuevaEtapa] = useState(null);
  const [claveNueva, setClaveNueva] = useState("");
  const [confirmandoArchivo, setConfirmandoArchivo] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const respuesta = await api.getProject(proyecto.id);
        if (cancelado) {
          return;
        }
        setDetalle(respuesta.project);
        setBorrador(desdeDetalle(respuesta.project));

        const conEtapa = [...new Set(respuesta.project.stages.map((etapa) => etapa.areaId))];
        const listas = await Promise.all([
          api.listStatuses(),
          ...conEtapa.map((id) => api.listStatuses({ areaId: id })),
        ]);
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

  useEffect(() => {
    function alTeclear(evento) {
      if (evento.key === "Escape") {
        onCerrar();
      }
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  const etapaElegida =
    detalle === null ? null : detalle.stages.find((etapa) => etapa.id === elegida) ?? null;
  const areaDeLaEtapa = etapaElegida === null ? null : etapaElegida.areaId;

  useEffect(() => {
    let cancelado = false;

    async function cargarGente() {
      if (areaDeLaEtapa === null) {
        return;
      }
      try {
        const respuesta = await api.listUsers({ areaId: areaDeLaEtapa });
        if (!cancelado) {
          setGente(respuesta.users);
        }
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      }
    }

    cargarGente();
    return () => {
      cancelado = true;
    };
  }, [areaDeLaEtapa]);

  /** El borrador: lo editable del proyecto y sus valores, tal como están guardados. */
  function desdeDetalle(actual) {
    const valores = {};
    for (const valor of actual.fieldValues) {
      valores[valor.key] = valor.value;
    }
    return {
      title: actual.title,
      requester: actual.requester ?? "",
      priority: String(actual.priority),
      startsOn: actual.startsOn ?? "",
      dueOn: actual.dueOn ?? "",
      hasCost: actual.hasCost,
      valores,
    };
  }

  async function recargar() {
    const respuesta = await api.getProject(proyecto.id);
    setDetalle(respuesta.project);
    setBorrador(desdeDetalle(respuesta.project));
    onCambio();
    return respuesta.project;
  }

  async function hacer(accion) {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      return await recargar();
    } catch (fallo) {
      setError(fallo.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  function escribir(clave, valor) {
    setBorrador((actual) => ({ ...actual, [clave]: valor }));
  }

  function escribirValor(clave, valor) {
    setBorrador((actual) => ({ ...actual, valores: { ...actual.valores, [clave]: valor } }));
  }

  function agregarClave(clave) {
    if (clave === "") {
      return;
    }
    escribirValor(clave, "");
    setClaveNueva("");
  }

  if (detalle === null) {
    return (
      <section className="project-full">
        <p className="project-loading">{error ?? "Abriendo el proyecto…"}</p>
      </section>
    );
  }

  const guardado = desdeDetalle(detalle);
  const cambiados = [];
  for (const clave of ["title", "requester", "priority", "startsOn", "dueOn", "hasCost"]) {
    if (String(borrador[clave]) !== String(guardado[clave])) {
      cambiados.push(clave);
    }
  }
  for (const clave of Object.keys(borrador.valores)) {
    if (String(borrador.valores[clave] ?? "") !== String(guardado.valores[clave] ?? "")) {
      cambiados.push(clave);
    }
  }
  const sucio = cambiados.length > 0;

  function marcar(clave, base) {
    return cambiados.includes(clave) ? `${base} is-changed` : base;
  }

  async function guardar() {
    const cambios = {};
    if (borrador.title !== guardado.title) {
      cambios.title = borrador.title;
    }
    if (borrador.requester !== guardado.requester) {
      cambios.requester = borrador.requester;
    }
    if (borrador.priority !== guardado.priority) {
      cambios.priority = Number(borrador.priority);
    }
    if (borrador.startsOn !== guardado.startsOn) {
      cambios.startsOn = borrador.startsOn === "" ? null : borrador.startsOn;
    }
    if (borrador.dueOn !== guardado.dueOn) {
      cambios.dueOn = borrador.dueOn === "" ? null : borrador.dueOn;
    }
    if (borrador.hasCost !== guardado.hasCost) {
      cambios.hasCost = borrador.hasCost;
    }

    await hacer(async () => {
      if (Object.keys(cambios).length > 0) {
        await api.updateProject(detalle.id, cambios);
      }
      for (const clave of Object.keys(borrador.valores)) {
        const antes = guardado.valores[clave];
        const ahora = borrador.valores[clave];
        if (String(ahora ?? "") === String(antes ?? "")) {
          continue;
        }
        if (ahora === "" || ahora === null || ahora === undefined) {
          if (antes !== undefined) {
            await api.deleteFieldValue(detalle.id, clave);
          }
          continue;
        }
        await api.setFieldValue(detalle.id, clave, String(ahora));
      }
    });
  }

  async function firmar(etapa, firma) {
    const despues = await hacer(() =>
      api.createApproval(detalle.id, etapa.id, {
        decision: firma.decision,
        comment: firma.comment || undefined,
      }),
    );
    if (despues !== null) {
      const abierta = despues.stages.find((una) => ESTADOS_ABIERTOS.includes(una.status));
      setElegida(abierta === undefined ? null : abierta.id);
    }
  }

  async function concluir(tambienArchivar) {
    await hacer(async () => {
      await api.closeProject(detalle.id);
      if (tambienArchivar) {
        await api.archiveProject(detalle.id);
      }
    });
  }

  async function agregarEtapa(evento) {
    evento.preventDefault();
    const hecho = await hacer(() =>
      api.createProjectStage(detalle.id, {
        areaId: Number(nuevaEtapa.areaId),
        title: nuevaEtapa.title,
        seq: Number(nuevaEtapa.seq),
        status: nuevaEtapa.status,
        inputs: nuevaEtapa.inputs,
        outputs: nuevaEtapa.outputs,
      }),
    );
    if (hecho !== null) {
      setNuevaEtapa(null);
    }
  }

  const fases = fasesDe(detalle.stages);
  const abiertas = detalle.stages.filter((etapa) => ESTADOS_ABIERTOS.includes(etapa.status));

  let falta = null;
  let siguienteFase = null;
  if (etapaElegida !== null) {
    const pendiente = etapaElegida.outputs.find(
      (clave) => !tieneValor(detalle.fieldValues, clave),
    );
    falta = pendiente === undefined ? null : nombreDeClave(vocabulario, pendiente);

    const indice = fases.findIndex((fase) => fase.seq === etapaElegida.seq);
    siguienteFase = fases[indice + 1] ?? null;
  }

  const claves = Object.keys(borrador.valores);
  const porAgregar = [...vocabulario.entries()].filter(([clave]) => !claves.includes(clave));

  let flujoDelProyecto = "sin flujo";
  if (fases.length > 0) {
    flujoDelProyecto = `${fases.length} ${fases.length === 1 ? "fase" : "fases"}`;
  }

  let estado = "abierto";
  if (detalle.archivedAt !== null) {
    estado = "archivado";
  } else if (detalle.closedAt !== null) {
    estado = "concluido";
  }

  return (
    <section className="project-full">
      <header className="project-bar">
        <button
          className="project-close"
          type="button"
          onClick={onCerrar}
          aria-label="Volver a la lista"
        >
          ✕
        </button>

        <div className="project-bar-text">
          <span className="project-bar-eyebrow">
            {detalle.key} · {detalle.requests.length === 0 ? "captura directa" : "de una solicitud"}{" "}
            · {flujoDelProyecto} · {estado}
          </span>
          <h2>{detalle.title}</h2>
        </div>

        {lugar === null ? null : (
          <div className="project-bar-move">
            <span>
              {lugar.posicion} de {lugar.de}
            </span>
            <button
              className="project-quiet"
              type="button"
              onClick={onAnterior}
              disabled={onAnterior === null}
              aria-label="Anterior"
            >
              ‹
            </button>
            <button
              className="project-quiet"
              type="button"
              onClick={onSiguiente}
              disabled={onSiguiente === null}
              aria-label="Siguiente"
            >
              ›
            </button>
          </div>
        )}
      </header>

      <div className="project-body">
        {error !== null ? <p className="project-error">{error}</p> : null}

        <ComoVa
          detalle={detalle}
          estatus={estatus}
          ocupado={ocupado}
          onEstatus={(valor) => hacer(() => api.setProjectStatus(detalle.id, Number(valor)))}
        />

        <section className="project-sec">
          <h3>Flujo</h3>
          <FlujoVivo
            detalle={detalle}
            fases={fases}
            vocabulario={vocabulario}
            elegida={elegida}
            ocupado={ocupado}
            abiertas={abiertas}
            onElegir={(id) => setElegida(id === elegida ? null : id)}
            onAgregar={() =>
              setNuevaEtapa({
                areaId: areas.length === 0 ? "" : areas[0].id,
                title: "",
                seq: fases.length === 0 ? 1 : fases[fases.length - 1].seq + 1,
                status: "pending",
                inputs: [],
                outputs: [],
              })
            }
            onConcluir={concluir}
            onArchivarConcluido={() => hacer(() => api.archiveProject(detalle.id))}
          />
        </section>

        {nuevaEtapa !== null ? (
          <FormularioDeEtapa
            datos={nuevaEtapa}
            areas={areas}
            fases={fases}
            vocabulario={vocabulario}
            ocupado={ocupado}
            onCambiar={setNuevaEtapa}
            onEnviar={agregarEtapa}
            onCancelar={() => setNuevaEtapa(null)}
          />
        ) : null}

        {etapaElegida === null ? null : (
          <PanelDeEtapa
            etapa={etapaElegida}
            detalle={detalle}
            fases={fases}
            vocabulario={vocabulario}
            usuario={usuario}
            gente={gente}
            ocupado={ocupado}
            falta={falta}
            siguienteFase={siguienteFase}
            onResponsable={(etapa, valor) =>
              hacer(() =>
                api.updateProjectStage(detalle.id, etapa.id, {
                  assignedTo: valor === "" ? null : Number(valor),
                }),
              )
            }
            onIniciar={(etapa) =>
              hacer(() => api.updateProjectStage(detalle.id, etapa.id, { status: "active" }))
            }
            onEsperar={(etapa, motivo) =>
              hacer(() =>
                api.updateProjectStage(detalle.id, etapa.id, {
                  status: "waiting_external",
                  blockedReason: motivo,
                }),
              )
            }
            onReanudar={(etapa) =>
              hacer(() => api.updateProjectStage(detalle.id, etapa.id, { status: "active" }))
            }
            onFirmar={firmar}
          />
        )}

        <div className="project-columns">
          <section className="project-sec">
            <h3>Proyecto</h3>
            <div className="project-grid">
              <label className={marcar("title", "project-field")}>
                <span className="project-label">Título</span>
                <input
                  value={borrador.title}
                  onChange={(evento) => escribir("title", evento.target.value)}
                />
              </label>

              <label className={marcar("requester", "project-field")}>
                <span className="project-label">Entidad solicitante</span>
                <input
                  value={borrador.requester}
                  onChange={(evento) => escribir("requester", evento.target.value)}
                />
              </label>

              <label className={marcar("priority", "project-field")}>
                <span className="project-label">
                  Urgencia
                  <Ayuda texto="Un número: mayor es más urgente. La imprenta y la producción priorizan por urgencia, nunca por orden de llegada (RF-FLW-08)." />
                </span>
                <input
                  type="number"
                  value={borrador.priority}
                  onChange={(evento) => escribir("priority", evento.target.value)}
                />
              </label>

              <label className={marcar("startsOn", "project-field")}>
                <span className="project-label">Empieza</span>
                <input
                  type="date"
                  value={borrador.startsOn}
                  onChange={(evento) => escribir("startsOn", evento.target.value)}
                />
              </label>

              <label className={marcar("dueOn", "project-field")}>
                <span className="project-label">Entrega</span>
                <input
                  type="date"
                  value={borrador.dueOn}
                  onChange={(evento) => escribir("dueOn", evento.target.value)}
                />
              </label>

              <label className={marcar("hasCost", "project-check")}>
                <input
                  type="checkbox"
                  checked={borrador.hasCost}
                  onChange={(evento) => escribir("hasCost", evento.target.checked)}
                />
                Con costo
              </label>
            </div>
          </section>

          <section className="project-sec">
            <h3>
              Valores del proyecto
              <Ayuda texto="Lo que una etapa produce y otra lee sin recapturar (RF-FLW-06): el número de orden, el folio del SIN, el pantone." />
            </h3>

            {claves.length === 0 ? (
              <p className="project-note">Todavía ninguno.</p>
            ) : (
              <div className="project-grid">
                {claves.map((clave) => {
                  const campo = campoDeClave(vocabulario, clave);
                  const guardadoAqui = detalle.fieldValues.find((uno) => uno.key === clave);

                  let origen = "nuevo, sin guardar";
                  if (guardadoAqui !== undefined) {
                    const etapa = detalle.stages.find(
                      (una) => una.id === guardadoAqui.producedByStageId,
                    );
                    origen =
                      guardadoAqui.producedByStageId === null
                        ? "de la solicitud"
                        : `lo produjo ${etapa?.title ?? "una etapa"}`;
                  }

                  return (
                    <div className={marcar(clave, "project-typed")} key={clave}>
                      <FieldInput
                        field={campo}
                        value={borrador.valores[clave]}
                        onChange={(valor) => escribirValor(clave, valor)}
                      />
                      <span className="project-origin">{origen}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="project-add-value">
              <select value={claveNueva} onChange={(evento) => agregarClave(evento.target.value)}>
                <option value="">Agregar un dato…</option>
                {porAgregar.map(([clave, campo]) => (
                  <option value={clave} key={clave}>
                    {campo.name}
                  </option>
                ))}
                {Object.keys(CLAVES_DE_FINANZAS)
                  .filter((clave) => !claves.includes(clave))
                  .map((clave) => (
                    <option value={clave} key={clave}>
                      {CLAVES_DE_FINANZAS[clave].name}
                    </option>
                  ))}
              </select>
            </div>
          </section>
        </div>

        <section className="project-sec">
          <h3>Solicitudes que contesta</h3>
          {detalle.requests.length === 0 ? (
            <p className="project-note">
              Ninguna: este proyecto se capturó directo, no salió de una solicitud.
            </p>
          ) : (
            <ul className="project-requests">
              {detalle.requests.map((solicitud) => (
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
        {detalle.archivedAt !== null ? (
          <p className="project-note">Archivado el {fechaCorta(detalle.archivedAt)}.</p>
        ) : confirmandoArchivo ? (
          <div className="project-action-row">
            <span className="project-confirm">
              Se quita de en medio. No dice nada del trabajo y se puede volver a ver en
              «Archivados».
            </span>
            <button
              className="project-btn"
              type="button"
              onClick={() => hacer(() => api.archiveProject(detalle.id))}
              disabled={ocupado}
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
            disabled={ocupado}
          >
            Archivar
          </button>
        )}

        <div className="project-foot-right">
          {sucio ? (
            <>
              <span className="project-dirty">
                {cambiados.length} {cambiados.length === 1 ? "cambio" : "cambios"} sin guardar
              </span>
              <button
                className="project-btn"
                type="button"
                onClick={() => setBorrador(desdeDetalle(detalle))}
                disabled={ocupado}
              >
                Descartar
              </button>
            </>
          ) : null}
          <button
            className="project-btn is-primary"
            type="button"
            onClick={guardar}
            disabled={ocupado || !sucio}
          >
            {ocupado ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </footer>
    </section>
  );
}

export default ProjectDetail;
