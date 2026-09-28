import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import RequestDetail from "./requestDetail.jsx";
import RequestForm from "./requestForm.jsx";
import "./inbox.css";

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
const FILTROS_VACIOS = {
  q: "",
  areaId: "",
  statusId: "",
  converted: "false",
  duplicates: "",
  sort: "priority",
};

// Los pasos del recorrido en los que puede estar una solicitud, con lo que le falta para pasar al
// siguiente. El paso 1 (nacer) ya ocurrió si está en la lista.
const PASOS = {
  sinRepartir: {
    etiqueta: "Sin repartir",
    ayuda: "Paso 2: falta decirle a qué área le toca.",
  },
  repartida: {
    etiqueta: "En el área",
    ayuda: "Paso 3: se atiende como solicitud, y luego se convierte en proyecto.",
  },
  convertida: {
    etiqueta: "Convertida",
    ayuda: "Paso 4: ya es un proyecto, y desde aquí no se edita.",
  },
};

// En qué paso está una solicitud. El orden de las preguntas importa: una convertida ya pasó por
// el reparto, aunque hoy su estatus siga diciendo «Recibido» (DATAMODEL.md §8.4, costura 1).
function pasoDe(solicitud) {
  if (solicitud.projectId !== null) {
    return PASOS.convertida;
  }
  if (solicitud.areaId === null) {
    return PASOS.sinRepartir;
  }
  return PASOS.repartida;
}

// Un valor que puede venir vacío, como se escribe en una tabla.
function oGuion(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  return valor;
}

// Un filtro de lista desplegable. Las opciones llegan ya armadas porque unas salen de un catálogo
// del servidor y otras están escritas a mano aquí.
function FiltroSelect({ etiqueta, valor, opciones, onCambio }) {
  return (
    <label className="inbox-filter">
      {etiqueta}
      <select value={valor} onChange={(evento) => onCambio(evento.target.value)}>
        {opciones.map((opcion) => (
          <option value={opcion.valor} key={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

// Un renglón de la bandeja.
function FilaDeSolicitud({ solicitud, onAbrir }) {
  const paso = pasoDe(solicitud);

  let marcaDeDuplicado = null;
  if (solicitud.possibleDuplicateOf !== null) {
    marcaDeDuplicado = <span className="inbox-badge"> posible duplicado</span>;
  }

  return (
    <tr className="inbox-row">
      <td className="inbox-folio">{solicitud.folio}</td>
      <td>
        {solicitud.title}
        {marcaDeDuplicado}
      </td>
      <td>{oGuion(solicitud.requester)}</td>
      <td>{oGuion(solicitud.areaName)}</td>
      <td>{solicitud.statusLabel}</td>
      <td>
        <span className="inbox-step" title={paso.ayuda}>
          {paso.etiqueta}
        </span>
      </td>
      <td className="inbox-cell-center">{solicitud.priority}</td>
      <td>{solicitud.source}</td>
      <td>{oGuion(solicitud.projectKey)}</td>
      <td>
        <button type="button" onClick={() => onAbrir(solicitud)}>
          Abrir
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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [capturando, setCapturando] = useState(false);

  // Sube cada vez que algo cambia, para volver a pedir la lista.
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
        const respuesta = await api.listRequests(filtros);
        if (!cancelado) {
          setSolicitudes(respuesta.requests);
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
  }, [filtros, version]);

  function cambiarFiltro(clave, valor) {
    setFiltros((actual) => ({ ...actual, [clave]: valor }));
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
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

  // Las opciones de cada filtro. «Sin área» es el paso 2 del recorrido: lo importado de Excel
  // llega sin área y aquí es donde se encuentra para repartirlo.
  const opcionesDeArea = [
    { valor: "", texto: "Todas" },
    { valor: "none", texto: "Sin área (sin repartir)" },
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

  // Cuántas están esperando el paso 2. Se cuenta sobre lo que trajo el filtro, así que es un
  // recordatorio de lo que hay a la vista y no un total del sistema.
  const sinRepartir = solicitudes.filter((solicitud) => pasoDe(solicitud) === PASOS.sinRepartir);

  let avisoDeReparto = null;
  if (sinRepartir.length > 0) {
    avisoDeReparto = (
      <p className="inbox-notice">
        {sinRepartir.length} solicitud{sinRepartir.length === 1 ? "" : "es"} sin área. Ábrela y
        dile a qué área le toca: mientras no lo tenga, nadie la ve en su bandeja.
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
          etiqueta="Área"
          valor={filtros.areaId}
          opciones={opcionesDeArea}
          onCambio={(valor) => cambiarFiltro("areaId", valor)}
        />

        <FiltroSelect
          etiqueta="Estatus"
          valor={filtros.statusId}
          opciones={opcionesDeEstatus}
          onCambio={(valor) => cambiarFiltro("statusId", valor)}
        />

        <FiltroSelect
          etiqueta="Convertidas"
          valor={filtros.converted}
          opciones={opcionesDeConversion}
          onCambio={(valor) => cambiarFiltro("converted", valor)}
        />

        <FiltroSelect
          etiqueta="Duplicados"
          valor={filtros.duplicates}
          opciones={opcionesDeDuplicados}
          onCambio={(valor) => cambiarFiltro("duplicates", valor)}
        />

        <FiltroSelect
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
            <FilaDeSolicitud solicitud={solicitud} onAbrir={setAbierta} key={solicitud.id} />
          ))}
        </tbody>
      </table>

      {bloqueVacio}
      {formularioDeCaptura}
      {detalle}
    </section>
  );
}

export default Inbox;
