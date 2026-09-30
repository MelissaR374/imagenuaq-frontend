import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import FlowDesigner from "../FlowDesigner/FlowDesigner.jsx";
import RequesterInput from "./requesterInput.jsx";
import "./requestDetail.css";

// Una solicitud con todo lo que trae, y el paso a proyecto.
//
// La tira de «Recorrido» es el de DATAMODEL.md §8.2 visto desde una sola solicitud: en qué paso
// está y qué falta para el siguiente. Está aquí porque los pasos 2 y 3 los mueve una mano y no un
// automatismo, así que la pantalla tiene que decir cuál es esa mano y qué le toca; si no, la
// solicitud se queda quieta y nadie sabe por qué.
//
// Lo capturado se muestra con los campos del formato con el que se capturó, no con el formato
// de hoy: una versión publicada no se edita, así que una solicitud vieja se sigue leyendo como
// se llenó. Lo que venga de una hoja trae además el renglón crudo, con las columnas que el
// mapeo ignoró (RF-SOL-06).

// Los pasos del recorrido que le tocan a una solicitud. El 1 ya pasó si estamos viéndola; del 5
// en adelante son del proyecto y se ven en su propia pantalla.
const RECORRIDO = [
  {
    clave: "nacio",
    titulo: "1. Recibida",
    mueve: "Se capturó a mano o llegó de un libro de Excel.",
  },
  {
    clave: "repartir",
    titulo: "2. Con flujo",
    mueve:
      "Falta decidir por qué áreas va a pasar. Aplica una plantilla o diseña su flujo en «Flujo», aquí abajo.",
  },
  {
    clave: "atender",
    titulo: "3. En atención",
    mueve:
      "Las áreas de la primera fase la tienen en su bandeja y actualizan el estatus conforme avanza.",
  },
  {
    clave: "convertir",
    titulo: "4. Convertida en proyecto",
    mueve: "Ya es un proyecto: se llevó su flujo y todos los datos capturados.",
  },
];

// Cuál de los pasos es el actual. Una convertida ya pasó por todos, aunque su estatus siga
// diciendo «Recibido» (DATAMODEL.md §8.4, costura 1). Una con área asignada a mano, de antes de
// los flujos, cuenta como repartida.
function pasoActualDe(detalle) {
  if (detalle.projectId !== null) {
    return "convertir";
  }
  // La fila de la bandeja trae `hasFlow`; el detalle ya cargado trae `flow`.
  const tieneFlujo = Boolean(detalle.flow) || Boolean(detalle.hasFlow);
  if (!tieneFlujo && detalle.areaId === null) {
    return "repartir";
  }
  return "atender";
}

// Un valor capturado como texto legible: los booleanos como sí/no y lo demás tal cual.
function formatearValor(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
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

// La tira del recorrido. El paso actual va marcado y es el único que explica qué lo mueve: los
// demás ya pasaron o todavía no tocan.
function Recorrido({ pasoActual }) {
  const indiceActual = RECORRIDO.findIndex((paso) => paso.clave === pasoActual);

  return (
    <ol className="request-detail-walk">
      {RECORRIDO.map((paso, indice) => {
        let estado = "pendiente";
        if (indice < indiceActual) {
          estado = "hecho";
        }
        if (indice === indiceActual) {
          estado = "actual";
        }

        let explicacion = null;
        if (estado === "actual") {
          explicacion = <p className="request-detail-walk-help">{paso.mueve}</p>;
        }

        return (
          <li className={`request-detail-walk-step is-${estado}`} key={paso.clave}>
            {paso.titulo}
            {explicacion}
          </li>
        );
      })}
    </ol>
  );
}

// Lo capturado, en el orden del formato, y debajo lo que la captura trae pero el formato ya no
// pide: no se pierde nada.
function ValoresCapturados({ campos, data }) {
  const capturado = data ?? {};
  const codigosDelFormato = campos.map((campo) => campo.code);
  const sobrantes = Object.keys(capturado).filter(
    (clave) => !codigosDelFormato.includes(clave),
  );

  return (
    <table className="request-detail-data">
      <tbody>
        {campos.map((campo) => (
          <tr key={campo.code}>
            <th>{campo.name}</th>
            <td>{formatearValor(capturado[campo.code])}</td>
          </tr>
        ))}
        {sobrantes.map((clave) => (
          <tr className="request-detail-extra" key={clave}>
            <th>{clave} (fuera del formato)</th>
            <td>{formatearValor(capturado[clave])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Corregir lo capturado antes de que se vuelva proyecto.
//
// Quien llena la hoja de Excel se equivoca --- deja un campo obligatorio vacío, escribe una fecha
// en la casilla del tiraje --- y hasta ahora la única salida era vivir con el dato malo o volver a
// importar. Al convertir, cada valor pasa a `project_field_values` y ahí ya lo leen la orden de
// impresión y facturación, así que **éste es el momento de arreglarlo**: después la solicitud se
// cierra a los cambios justamente para que el proyecto no pierda lo que contesta.
//
// Se corrige contra los campos de la versión con la que se capturó, no con el formato de hoy: una
// versión publicada no se edita, así que una solicitud vieja se sigue leyendo como se llenó.
function EditorDeCaptura({ campos, data, ocupado, onGuardar, onCancelar }) {
  const [valores, setValores] = useState(() => ({ ...(data ?? {}) }));

  function cambiar(code, valor) {
    setValores({ ...valores, [code]: valor });
  }

  function enviar(evento) {
    evento.preventDefault();
    onGuardar(valores);
  }

  let textoDelBoton = "Guardar lo corregido";
  if (ocupado) {
    textoDelBoton = "Guardando...";
  }

  return (
    <form className="request-detail-capture" onSubmit={enviar}>
      <p className="request-detail-help">
        El servidor revisa cada valor contra el tipo de su campo, igual que al importar: si algo no
        corresponde lo dice y no se guarda nada a medias.
      </p>

      <div className="request-detail-capture-fields">
        {campos.map((campo) => (
          <FieldInput
            key={campo.code}
            field={campo}
            value={valores[campo.code]}
            onChange={(valor) => cambiar(campo.code, valor)}
          />
        ))}
      </div>

      <div className="request-detail-actions">
        <button type="submit" disabled={ocupado}>
          {textoDelBoton}
        </button>
        <button type="button" onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// El renglón como lo tenía la hoja, columnas ignoradas incluidas (RF-SOL-06).
function RenglonOriginal({ sourceData }) {
  const [abierto, setAbierto] = useState(false);

  function alternar() {
    setAbierto(!abierto);
  }

  let texto = "Ver el valor original del registro de la hoja";
  if (abierto) {
    texto = "Ocultar el renglón original";
  }

  let tabla = null;
  if (abierto) {
    tabla = (
      <table className="request-detail-data">
        <tbody>
          {Object.keys(sourceData).map((columna) => (
            <tr key={columna}>
              <th>{columna}</th>
              <td>{formatearValor(sourceData[columna])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="request-detail-raw">
      <button type="button" onClick={alternar}>
        {texto}
      </button>
      {tabla}
    </div>
  );
}

// El paso 4 del recorrido. Lo que se deje vacío lo toma de la solicitud; las etapas salen de
// su flujo.
function FormularioDeConversion({ datos, flujo, ocupado, onCambiar, onEnviar, onCancelar }) {
  function cambiar(clave, valor) {
    onCambiar({ ...datos, [clave]: valor });
  }

  let avisoDelFlujo = (
    <p className="request-detail-help">
      Sin flujo: el proyecto nace sin etapas. Si ya sabes por qué áreas va a pasar, aplica o diseña
      su flujo antes de convertirla.
    </p>
  );
  if (flujo) {
    const etapas = flujo.phases.reduce((total, fase) => total + fase.stages.length, 0);
    avisoDelFlujo = (
      <p className="request-detail-help">
        El proyecto nace con el flujo de la solicitud: {flujo.phases.length}{" "}
        {flujo.phases.length === 1 ? "fase" : "fases"} y {etapas}{" "}
        {etapas === 1 ? "etapa" : "etapas"}. Las de la primera fase empiezan activas.
      </p>
    );
  }

  let textoDelBoton = "Crear el proyecto";
  if (ocupado) {
    textoDelBoton = "Convirtiendo...";
  }

  return (
    <form className="request-detail-convert" onSubmit={onEnviar}>
      <h4>Convertir en proyecto</h4>
      <p className="request-detail-help">
        Lo que se deje vacío se toma de la solicitud. Cada valor capturado pasa al proyecto con su
        clave, para que la orden de impresión y facturación lo lean sin recapturar.
      </p>

      <label className="request-detail-field">
        Llave del proyecto (vacío: se genera como PRY-000001)
        <input
          value={datos.key}
          onChange={(evento) => cambiar("key", evento.target.value)}
          placeholder="PAPEL-FCQ-03"
        />
      </label>

      <label className="request-detail-field">
        Título del proyecto
        <input value={datos.title} onChange={(evento) => cambiar("title", evento.target.value)} />
      </label>

      <label className="request-detail-field" htmlFor={datos.idDelSolicitante}>
        Entidad solicitante (este es el momento de corregir el nombre)
      </label>
      <RequesterInput
        id={datos.idDelSolicitante}
        value={datos.requester}
        onChange={(requester) => cambiar("requester", requester)}
      />

      <label className="request-detail-field">
        <input
          type="checkbox"
          checked={datos.hasCost}
          onChange={(evento) => cambiar("hasCost", evento.target.checked)}
        />
        Con costo
      </label>

      {avisoDelFlujo}

      <div className="request-detail-actions">
        <button type="submit" disabled={ocupado}>
          {textoDelBoton}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// El paso 2 del recorrido: el flujo decide a qué bandejas cae la solicitud (DATAMODEL.md §2.5).
// Con flujo se resume fase por fase; sin él se ofrece aplicar una plantilla o diseñarlo.
function FlujoDeLaSolicitud({ flujo, areaName, convertida, plantillas, ocupado, onAplicar, onDisenar, onQuitar }) {
  const activas = plantillas.filter((una) => una.isActive);
  const [elegida, setElegida] = useState("");

  let resumen = <p className="request-detail-flow-empty">Sin flujo.</p>;
  if (flujo) {
    resumen = (
      <>
        {flujo.workflowName && (
          <p className="request-detail-flow-origin">
            Copiado de la plantilla «{flujo.workflowName}» (versión {flujo.version}).
          </p>
        )}
        <ol className="request-detail-flow-phases">
          {flujo.phases.map((fase) => (
            <li key={fase.id}>
              <strong>{fase.name}:</strong>{" "}
              {[...new Set(fase.stages.map((etapa) => etapa.areaName))].join(", ")}
            </li>
          ))}
        </ol>
      </>
    );
  } else if (areaName) {
    // Una repartida a mano antes de que hubiera flujos.
    resumen = <p className="request-detail-flow-empty">Sin flujo; asignada a {areaName}.</p>;
  }

  // Ya convertida, el flujo es del proyecto: aquí solo se muestra.
  if (convertida) {
    return <div className="request-detail-flow">{resumen}</div>;
  }

  return (
    <div className="request-detail-flow">
      {resumen}

      <div className="request-detail-flow-actions">
        {flujo ? (
          <>
            <button type="button" onClick={onDisenar} disabled={ocupado}>
              Editar flujo
            </button>
            <button type="button" onClick={onQuitar} disabled={ocupado}>
              Quitar flujo
            </button>
          </>
        ) : (
          <>
            <select
              value={elegida}
              onChange={(evento) => setElegida(evento.target.value)}
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
              type="button"
              onClick={() => onAplicar(Number(elegida))}
              disabled={ocupado || elegida === ""}
            >
              Aplicar plantilla
            </button>
            <button type="button" onClick={onDisenar} disabled={ocupado}>
              Diseñar un flujo nuevo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RequestDetail({ solicitud, onCerrar, onCambio }) {
  const [detalle, setDetalle] = useState(solicitud);
  const [estatus, setEstatus] = useState([]);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const [corrigiendo, setCorrigiendo] = useState(false);

  // El formulario de conversión: null mientras no se abre.
  const [convertir, setConvertir] = useState(null);
  const [conflictos, setConflictos] = useState([]);

  // Las plantillas que se pueden aplicar, y si se está diseñando el flujo en el diseñador.
  const [plantillas, setPlantillas] = useState([]);
  const [disenando, setDisenando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      // El catálogo de estatus depende del área: los globales siempre, los del área solo si la
      // solicitud es de esa área.
      let filtroDeEstatus = {};
      if (solicitud.areaId !== null) {
        filtroDeEstatus = { areaId: solicitud.areaId };
      }

      try {
        const [respuestaSolicitud, respuestaEstatus, respuestaPlantillas] = await Promise.all([
          api.getRequest(solicitud.id),
          api.listStatuses(filtroDeEstatus),
          api.listWorkflows(),
        ]);
        if (cancelado) {
          return;
        }
        setDetalle(respuestaSolicitud.request);
        setEstatus(respuestaEstatus.statuses);
        setPlantillas(respuestaPlantillas.workflows);
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
  }, [solicitud.id, solicitud.areaId]);

  async function recargar() {
    const respuesta = await api.getRequest(detalle.id);
    setDetalle(respuesta.request);
    onCambio();
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

  async function corregirSolicitante() {
    setError(null);
    try {
      await api.updateRequest(detalle.id, { requester: detalle.requester });
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function guardarCaptura(data) {
    setOcupado(true);
    setError(null);
    try {
      await api.updateRequest(detalle.id, { data });
      await recargar();
      setCorrigiendo(false);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  function escribirSolicitante(requester) {
    setDetalle({ ...detalle, requester });
  }

  function escribirTitulo(title) {
    setDetalle({ ...detalle, title });
  }

  // El título de lo importado lo escribió una columna de Excel, así que puede llegar vacío de
  // sentido («Solicitud», «-», el nombre de quien llenó el formulario). Se corrige aquí, antes de
  // convertir: la bandeja lista por título, y el proyecto nace con este mismo.
  async function corregirTitulo() {
    setError(null);
    try {
      await api.updateRequest(detalle.id, { title: detalle.title });
      await recargar();
      onCambio();
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  // Paso 2 del recorrido: se le da un flujo, y con él las bandejas en las que cae.
  async function aplicarPlantilla(workflowId) {
    setOcupado(true);
    setError(null);
    try {
      await api.setRequestFlow(detalle.id, { workflowId });
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function quitarFlujo() {
    if (!window.confirm("¿Quitarle el flujo? Dejará de aparecer en las bandejas de sus áreas.")) {
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      await api.clearRequestFlow(detalle.id);
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  // El diseñador devuelve la solicitud ya con su flujo nuevo.
  async function flujoGuardado() {
    setDisenando(false);
    await recargar();
  }

  async function eliminar() {
    setOcupado(true);
    setError(null);
    try {
      await api.deleteRequest(detalle.id);
      onCambio();
      onCerrar();
    } catch (fallo) {
      setError(fallo.message);
      setOcupado(false);
    }
  }

  function abrirConversion() {
    setConvertir({
      key: "",
      title: detalle.title,
      requester: detalle.requester ?? "",
      hasCost: false,
      idDelSolicitante: `convertir-solicitante-${detalle.id}`,
    });
  }

  function cerrarConversion() {
    setConvertir(null);
  }

  async function convertirEnProyecto(evento) {
    evento.preventDefault();

    // Las etapas no se mandan: el proyecto se lleva el flujo de la solicitud, si tiene.
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

  const yaEsProyecto = detalle.projectId !== null;

  // Los campos del formato, en el orden en que se capturaron.
  let campos = [];
  if (detalle.fields !== null && detalle.fields !== undefined) {
    campos = [...detalle.fields.deliverables, ...detalle.fields.information];
  }

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="request-detail-error">{error}</p>;
  }

  // Diseñar el flujo ocupa la pantalla entera; al guardar o volver se regresa a la solicitud.
  if (disenando) {
    return (
      <FlowDesigner
        solicitud={detalle}
        onGuardado={flujoGuardado}
        onCerrar={() => setDisenando(false)}
      />
    );
  }

  let origen = detalle.source;
  if (detalle.sheetName !== null) {
    origen = `${detalle.source} — ${detalle.sheetName}`;
  }

  let bloqueDeDuplicado = null;
  if (detalle.duplicateOfFolio !== null) {
    bloqueDeDuplicado = (
      <>
        <dt>Posible duplicado de</dt>
        <dd>{detalle.duplicateOfFolio}</dd>
      </>
    );
  }

  // Ya convertida, el título es historia: lo que se lee es el del proyecto.
  let bloqueDeTitulo = <dd>{detalle.title}</dd>;
  if (!yaEsProyecto) {
    bloqueDeTitulo = (
      <dd>
        <input
          className="request-detail-title-input"
          value={detalle.title}
          onChange={(evento) => escribirTitulo(evento.target.value)}
          placeholder="Lo que es este trabajo"
        />
        <button
          type="button"
          onClick={corregirTitulo}
          disabled={ocupado || detalle.title.trim() === ""}
        >
          Guardar título
        </button>
      </dd>
    );
  }

  let bloqueDeProyecto = null;
  if (yaEsProyecto) {
    bloqueDeProyecto = (
      <>
        <dt>Proyecto</dt>
        <dd>
          {detalle.projectKey} — {detalle.projectTitle}
        </dd>
      </>
    );
  }

  // Corregir sólo mientras no sea proyecto: después la solicitud ya no se edita.
  let botonDeCorreccion = null;
  if (!yaEsProyecto && campos.length > 0 && !corrigiendo) {
    botonDeCorreccion = (
      <button type="button" onClick={() => setCorrigiendo(true)} disabled={ocupado}>
        Corregir lo capturado
      </button>
    );
  }

  let bloqueDeCaptura = <ValoresCapturados campos={campos} data={detalle.data} />;
  if (corrigiendo) {
    bloqueDeCaptura = (
      <EditorDeCaptura
        campos={campos}
        data={detalle.data}
        ocupado={ocupado}
        onGuardar={guardarCaptura}
        onCancelar={() => setCorrigiendo(false)}
      />
    );
  }

  let bloqueDelRenglon = null;
  if (detalle.sourceData !== null && detalle.sourceData !== undefined) {
    bloqueDelRenglon = <RenglonOriginal sourceData={detalle.sourceData} />;
  }

  let bloqueDeConflictos = null;
  if (conflictos.length > 0) {
    bloqueDeConflictos = (
      <div className="request-detail-conflicts">
        <h4>Valores que dos solicitudes traían distintos</h4>
        <ul>
          {conflictos.map((conflicto) => (
            <li key={conflicto.key}>
              <strong>{conflicto.key}</strong>: se guardó «{conflicto.kept}» y se descartó «
              {conflicto.discarded}» (de {conflicto.folio}).
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Las acciones del paso 4, o la razón por la que ya no hay ninguna.
  let bloqueDeAcciones;
  if (yaEsProyecto) {
    bloqueDeAcciones = (
      <p className="request-detail-converted">
        Ya es un proyecto, así que no se edita ni se elimina: el proyecto perdería lo que contesta.
        El solicitante sí se puede corregir; el título ya no, porque el proyecto lleva el suyo.
      </p>
    );
  } else {
    bloqueDeAcciones = (
      <>
        <button
          className="request-detail-primary"
          type="button"
          onClick={abrirConversion}
          disabled={ocupado}
        >
          Convertir en proyecto
        </button>
        <button
          className="request-detail-danger"
          type="button"
          onClick={eliminar}
          disabled={ocupado}
        >
          Eliminar
        </button>
      </>
    );
  }

  let formularioDeConversion = null;
  if (convertir !== null) {
    formularioDeConversion = (
      <FormularioDeConversion
        datos={convertir}
        flujo={detalle.flow ?? null}
        ocupado={ocupado}
        onCambiar={setConvertir}
        onEnviar={convertirEnProyecto}
        onCancelar={cerrarConversion}
      />
    );
  }

  return (
    <section className="request-detail">
      <header className="request-detail-header">
        <h3 className="request-detail-title">
          {detalle.folio} — {detalle.title}
        </h3>
        <button type="button" onClick={onCerrar}>
          Cerrar
        </button>
      </header>

      {bloqueDeError}

      <Recorrido pasoActual={pasoActualDe(detalle)} />

      <dl className="request-detail-facts">
        <dt>Título</dt>
        {bloqueDeTitulo}

        <dt>Formato</dt>
        <dd>
          {detalle.schemaName} (v{detalle.schemaVersion})
        </dd>

        <dt>Solicitante</dt>
        <dd>
          <RequesterInput
            id={`solicitante-${detalle.id}`}
            value={detalle.requester ?? ""}
            onChange={escribirSolicitante}
          />
          <button type="button" onClick={corregirSolicitante} disabled={ocupado}>
            Guardar solicitante
          </button>
        </dd>

        <dt>Flujo</dt>
        <dd>
          <FlujoDeLaSolicitud
            flujo={detalle.flow ?? null}
            areaName={detalle.areaName}
            convertida={yaEsProyecto}
            plantillas={plantillas}
            ocupado={ocupado}
            onAplicar={aplicarPlantilla}
            onDisenar={() => setDisenando(true)}
            onQuitar={quitarFlujo}
          />
        </dd>

        <dt>Estatus</dt>
        <dd>
          <select
            value={detalle.statusId}
            onChange={(evento) => cambiarEstatus(evento.target.value)}
            disabled={ocupado}
          >
            {estatus.map((uno) => {
              let sufijo = " (del área)";
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

        <dt>Cómo llegó</dt>
        <dd>{origen}</dd>

        <dt>Urgencia</dt>
        <dd>{detalle.priority}</dd>

        {bloqueDeDuplicado}
        {bloqueDeProyecto}
      </dl>

      <div className="request-detail-subhead">
        <h4 className="request-detail-subtitle">Lo capturado</h4>
        {botonDeCorreccion}
      </div>
      {bloqueDeCaptura}

      {bloqueDelRenglon}
      {bloqueDeConflictos}

      <div className="request-detail-actions">{bloqueDeAcciones}</div>

      {formularioDeConversion}
    </section>
  );
}

export default RequestDetail;
