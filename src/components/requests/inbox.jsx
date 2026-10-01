// La bandeja de solicitudes (RF-SOL-04): ordenada y filtrable, para que nadie tenga que
// revisar correo, Excel, Teams y WhatsApp para saber qué le toca. Los filtros son los que
// RF-SOL-05 nombra: nombre, entidad, folio, responsable y estatus.
//
// La columna «Paso» sigue el recorrido de DATAMODEL.md §8.2, que es el que describe qué mueve
// una solicitud al siguiente estado. Se muestra porque los pasos 2 y 3 los mueve una mano: si no
// se ven, nadie sabe que le toca moverlos, y una solicitud importada se queda sin área para
// siempre sin que eso se note en ninguna pantalla.
//
// Por omisión muestra lo que todavía no se ha convertido, que es lo que un área tiene
// pendiente; `converted` en el servidor sin valor trae todo, así que aquí se manda explícito.
// Cuántas se ven de un jalón. Una importación mete decenas de renglones de golpe, así que la
// bandeja se pagina: el total viene del servidor (`total`, que cuenta lo filtrado y no la página),
// de modo que se puede decir cuánto falta por ver en lugar de adivinarlo.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { oGuion } from "../shared/formato.js";
import FiltroSelect from "../shared/filtroSelect.jsx";
import RequestDetail from "./requestDetail.jsx";
import RequestForm from "./requestForm.jsx";
import "./inbox.css";

const POR_PAGINA = 20;

const FILTROS_VACIOS = {
  q: "",
  areaId: "",
  statusId: "",
  converted: "false",
  duplicates: "",
  sort: "priority",
};

/**
 * Los pasos del recorrido en los que puede estar una solicitud, con lo que le falta para pasar al
 * siguiente. El paso 1 (nacer) ya ocurrió si está en la lista.
 */
const PASOS = {
  sinRepartir: {
    etiqueta: "Sin flujo",
    ayuda: "Paso 2: falta decidir por qué áreas va a pasar.",
  },
  repartida: {
    etiqueta: "En atención",
    ayuda: "Paso 3: las áreas de la primera fase la atienden; después se convierte en proyecto.",
  },
  convertida: {
    etiqueta: "Convertida",
    ayuda: "Paso 4: ya es un proyecto y desde aquí no se edita.",
  },
};

/**
 * En qué paso está una solicitud. El orden de las preguntas importa: una convertida ya pasó por
 * el reparto, aunque hoy su estatus siga diciendo «Recibido» (DATAMODEL.md §8.4, costura 1). Una
 * con área asignada a mano, de antes de los flujos, cuenta como repartida.
 */
function pasoDe(solicitud) {
  if (solicitud.projectId !== null) {
    return PASOS.convertida;
  }
  if (!solicitud.hasFlow && solicitud.areaId === null) {
    return PASOS.sinRepartir;
  }
  return PASOS.repartida;
}

/**
 * Las áreas que la tienen en su bandeja: las de la primera fase de su flujo, o la asignada a mano.
 */
function areasDe(solicitud) {
  if (solicitud.hasFlow && solicitud.firstPhaseAreas.length > 0) {
    return solicitud.firstPhaseAreas.join(", ");
  }
  return solicitud.areaName;
}

/** Un renglón de la bandeja. */
function FilaDeSolicitud({ solicitud, onAbrir, onEliminar, ocupado }) {
  const paso = pasoDe(solicitud);

  let marcaDeDuplicado = null;
  if (solicitud.possibleDuplicateOf !== null) {
    marcaDeDuplicado = <span className="inbox-badge"> posible duplicado</span>;
  }

  const yaEsProyecto = solicitud.projectId !== null;

  let ayudaDeBorrado = "Quita la solicitud de la bandeja";
  if (yaEsProyecto) {
    ayudaDeBorrado = `No se puede: ya es el proyecto ${solicitud.projectKey}`;
  }

  return (
    <tr className="inbox-row">
      <td className="inbox-folio">{solicitud.folio}</td>
      <td>
        {solicitud.title}
        {marcaDeDuplicado}
      </td>
      <td>{oGuion(solicitud.requester)}</td>
      <td>{oGuion(areasDe(solicitud))}</td>
      <td>{solicitud.statusLabel}</td>
      <td>
        <span className="inbox-step" title={paso.ayuda}>
          {paso.etiqueta}
        </span>
      </td>
      <td className="inbox-cell-center">{solicitud.priority}</td>
      <td>{solicitud.source}</td>
      <td>{oGuion(solicitud.projectKey)}</td>
      <td className="inbox-cell-actions">
        <button type="button" onClick={() => onAbrir(solicitud)}>
          Abrir
        </button>
        <button
          className="inbox-action-danger"
          type="button"
          onClick={() => onEliminar(solicitud)}
          disabled={yaEsProyecto || ocupado}
          title={ayudaDeBorrado}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

function Inbox() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [estatus, setEstatus] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [capturando, setCapturando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargarCatalogos() {
      try {
        const [respuestaAreas, respuestaEstatus] = await Promise.all([
          api.listAreas(),
          api.listStatuses(),
        ]);
        if (cancelado) {
          return;
        }
        setAreas(respuestaAreas.areas);
        setEstatus(respuestaEstatus.statuses);
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      }
    }

    cargarCatalogos();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargarSolicitudes() {
      setCargando(true);
      try {
        const respuesta = await api.listRequests({
          ...filtros,
          limit: POR_PAGINA,
          offset: pagina * POR_PAGINA,
        });
        if (!cancelado) {
          setSolicitudes(respuesta.requests);
          setTotal(respuesta.total);
        }
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    cargarSolicitudes();
    return () => {
      cancelado = true;
    };
  }, [filtros, version, pagina]);

  function cambiarFiltro(clave, valor) {
    setFiltros((actual) => ({ ...actual, [clave]: valor }));
    setPagina(0);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setPagina(0);
  }

  function anterior() {
    setPagina(pagina - 1);
  }

  function siguiente() {
    setPagina(pagina + 1);
  }

  function recargar() {
    setVersion((actual) => actual + 1);
  }

  function abrirCaptura() {
    setCapturando(true);
  }

  function cerrarCaptura() {
    setCapturando(false);
  }

  function terminarCaptura(solicitud) {
    setCapturando(false);
    recargar();
    setAbierta(solicitud);
  }

  function cerrarDetalle() {
    setAbierta(null);
  }

  async function eliminar(solicitud) {
    const seguro = window.confirm(
      `¿Eliminar ${solicitud.folio} — ${solicitud.title}?

Se quita de la bandeja. Lo importado de Excel se puede volver a traer importando el libro otra vez.`,
    );
    if (!seguro) {
      return;
    }

    setBorrando(true);
    setError(null);
    try {
      await api.deleteRequest(solicitud.id);
      if (abierta?.id === solicitud.id) {
        setAbierta(null);
      }
      recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setBorrando(false);
    }
  }

  const opcionesDeArea = [
    { valor: "", texto: "Todas" },
    { valor: "none", texto: "Sin flujo ni área" },
  ];
  for (const area of areas) {
    opcionesDeArea.push({ valor: String(area.id), texto: area.name });
  }

  const opcionesDeEstatus = [{ valor: "", texto: "Todos" }];
  for (const uno of estatus) {
    opcionesDeEstatus.push({ valor: String(uno.id), texto: uno.label });
  }

  const opcionesDeConversion = [
    { valor: "false", texto: "Pendientes" },
    { valor: "true", texto: "Ya convertidas" },
    { valor: "", texto: "Todas" },
  ];

  const opcionesDeDuplicados = [
    { valor: "", texto: "Todas" },
    { valor: "true", texto: "Posibles duplicados" },
  ];

  const opcionesDeOrden = [
    { valor: "priority", texto: "Por urgencia" },
    { valor: "created", texto: "Por llegada" },
  ];

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="inbox-error">{error}</p>;
  }

  let bloqueDeCarga = null;
  if (cargando) {
    bloqueDeCarga = <p className="inbox-loading">Cargando...</p>;
  }

  let bloqueVacio = null;
  if (!cargando && solicitudes.length === 0) {
    bloqueVacio = <p className="inbox-empty">No hay solicitudes con esos filtros.</p>;
  }

  const primera = total === 0 ? 0 : pagina * POR_PAGINA + 1;
  const ultima = pagina * POR_PAGINA + solicitudes.length;
  const hayMas = ultima < total;

  let paginacion = null;
  if (total > POR_PAGINA) {
    paginacion = (
      <div className="inbox-pages">
        <p className="inbox-range">
          {primera}–{ultima} de {total}
        </p>
        <div className="inbox-page-actions">
          <button type="button" onClick={anterior} disabled={pagina === 0 || cargando}>
            Anteriores
          </button>
          <button type="button" onClick={siguiente} disabled={!hayMas || cargando}>
            Siguientes
          </button>
        </div>
      </div>
    );
  }

  const sinRepartir = solicitudes.filter((solicitud) => pasoDe(solicitud) === PASOS.sinRepartir);

  let avisoDeReparto = null;
  if (sinRepartir.length > 0) {
    avisoDeReparto = (
      <p className="inbox-notice">
        {sinRepartir.length} de las {solicitudes.length} de esta página todavía no tienen flujo.
        Ábrelas y aplícales una plantilla o diseña su flujo: mientras no lo tengan, no aparecen en
        la bandeja de ninguna área. Para verlas todas, filtra por «Sin flujo ni área».
      </p>
    );
  }

  let formularioDeCaptura = null;
  if (capturando) {
    formularioDeCaptura = (
      <RequestForm areas={areas} onCreada={terminarCaptura} onCancelar={cerrarCaptura} />
    );
  }

  let detalle = null;
  if (abierta !== null) {
    detalle = (
      <RequestDetail
        solicitud={abierta}
        areas={areas}
        onCerrar={cerrarDetalle}
        onCambio={recargar}
      />
    );
  }

  return (
    <section className="inbox">
      <header className="inbox-header">
        <h2 className="inbox-title">Bandeja de solicitudes</h2>
        <p className="inbox-count">
          {total} solicitud{total === 1 ? "" : "es"} con estos filtros
        </p>
        <button type="button" onClick={abrirCaptura}>
          Nueva solicitud
        </button>
      </header>

      {bloqueDeError}
      {avisoDeReparto}

      <div className="inbox-filters">
        <label className="inbox-filter">
          Buscar
          <input
            value={filtros.q}
            onChange={(evento) => cambiarFiltro("q", evento.target.value)}
            placeholder="Título o folio"
          />
        </label>

        <FiltroSelect
          clase="inbox-filter"
          etiqueta="Área"
          valor={filtros.areaId}
          opciones={opcionesDeArea}
          onCambio={(valor) => cambiarFiltro("areaId", valor)}
        />

        <FiltroSelect
          clase="inbox-filter"
          etiqueta="Estatus"
          valor={filtros.statusId}
          opciones={opcionesDeEstatus}
          onCambio={(valor) => cambiarFiltro("statusId", valor)}
        />

        <FiltroSelect
          clase="inbox-filter"
          etiqueta="Convertidas"
          valor={filtros.converted}
          opciones={opcionesDeConversion}
          onCambio={(valor) => cambiarFiltro("converted", valor)}
        />

        <FiltroSelect
          clase="inbox-filter"
          etiqueta="Duplicados"
          valor={filtros.duplicates}
          opciones={opcionesDeDuplicados}
          onCambio={(valor) => cambiarFiltro("duplicates", valor)}
        />

        <FiltroSelect
          clase="inbox-filter"
          etiqueta="Orden"
          valor={filtros.sort}
          opciones={opcionesDeOrden}
          onCambio={(valor) => cambiarFiltro("sort", valor)}
        />

        <button type="button" onClick={limpiarFiltros}>
          Limpiar
        </button>
      </div>

      {bloqueDeCarga}

      <table className="inbox-table">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Título</th>
            <th>Solicitante</th>
            <th>Área</th>
            <th>Estatus</th>
            <th>Paso</th>
            <th>Urgencia</th>
            <th>Origen</th>
            <th>Proyecto</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((solicitud) => (
            <FilaDeSolicitud
              solicitud={solicitud}
              onAbrir={setAbierta}
              onEliminar={eliminar}
              ocupado={borrando}
              key={solicitud.id}
            />
          ))}
        </tbody>
      </table>

      {bloqueVacio}
      {paginacion}
      {formularioDeCaptura}
      {detalle}
    </section>
  );
}

export default Inbox;
