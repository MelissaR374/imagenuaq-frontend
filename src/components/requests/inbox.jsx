import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import RequestDetail from "./requestDetail.jsx";
import RequestForm from "./requestForm.jsx";
import "./inbox.css";

// La bandeja de solicitudes (RF-SOL-04): ordenada y filtrable, para que nadie tenga que
// revisar correo, Excel, Teams y WhatsApp para saber qué le toca. Los filtros son los que
// RF-SOL-05 nombra: nombre, entidad, folio, responsable y estatus.
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

    async function cargar() {
      try {
        const [{ areas: areasRes }, { statuses }] = await Promise.all([
          api.listAreas(),
          api.listStatuses(),
        ]);
        if (cancelado) return;
        setAreas(areasRes);
        setEstatus(statuses);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      try {
        const { requests } = await api.listRequests(filtros);
        if (!cancelado) setSolicitudes(requests);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [filtros, version]);

  function cambiarFiltro(clave, valor) {
    setFiltros((actual) => ({ ...actual, [clave]: valor }));
  }

  return (
    <section className="inbox">
      <header className="inbox-header">
        <h2 className="inbox-title">Bandeja de solicitudes</h2>
        <button type="button" onClick={() => setCapturando(true)}>
          Nueva solicitud
        </button>
      </header>

      {error ? <p className="inbox-error">{error}</p> : null}

      <div className="inbox-filters">
        <label className="inbox-filter">
          Buscar
          <input
            value={filtros.q}
            onChange={(evento) => cambiarFiltro("q", evento.target.value)}
            placeholder="Título o folio"
          />
        </label>

        <label className="inbox-filter">
          Área
          <select value={filtros.areaId} onChange={(evento) => cambiarFiltro("areaId", evento.target.value)}>
            <option value="">Todas</option>
            {areas.map((area) => (
              <option value={area.id} key={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="inbox-filter">
          Estatus
          <select value={filtros.statusId} onChange={(evento) => cambiarFiltro("statusId", evento.target.value)}>
            <option value="">Todos</option>
            {estatus.map((uno) => (
              <option value={uno.id} key={uno.id}>
                {uno.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inbox-filter">
          Convertidas
          <select value={filtros.converted} onChange={(evento) => cambiarFiltro("converted", evento.target.value)}>
            <option value="false">Pendientes</option>
            <option value="true">Ya convertidas</option>
            <option value="">Todas</option>
          </select>
        </label>

        <label className="inbox-filter">
          Duplicados
          <select value={filtros.duplicates} onChange={(evento) => cambiarFiltro("duplicates", evento.target.value)}>
            <option value="">Todas</option>
            <option value="true">Posibles duplicados</option>
          </select>
        </label>

        <label className="inbox-filter">
          Orden
          <select value={filtros.sort} onChange={(evento) => cambiarFiltro("sort", evento.target.value)}>
            <option value="priority">Por urgencia</option>
            <option value="created">Por llegada</option>
          </select>
        </label>

        <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)}>
          Limpiar
        </button>
      </div>

      {cargando ? <p className="inbox-loading">Cargando...</p> : null}

      <table className="inbox-table">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Título</th>
            <th>Solicitante</th>
            <th>Área</th>
            <th>Estatus</th>
            <th>Urgencia</th>
            <th>Origen</th>
            <th>Proyecto</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((solicitud) => (
            <tr className="inbox-row" key={solicitud.id}>
              <td className="inbox-folio">{solicitud.folio}</td>
              <td>
                {solicitud.title}
                {solicitud.possibleDuplicateOf ? (
                  <span className="inbox-badge"> posible duplicado</span>
                ) : null}
              </td>
              <td>{solicitud.requester ?? "—"}</td>
              <td>{solicitud.areaName ?? "—"}</td>
              <td>{solicitud.statusLabel}</td>
              <td className="inbox-cell-center">{solicitud.priority}</td>
              <td>{solicitud.source}</td>
              <td>{solicitud.projectKey ?? "—"}</td>
              <td>
                <button type="button" onClick={() => setAbierta(solicitud)}>
                  Abrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!cargando && solicitudes.length === 0 ? (
        <p className="inbox-empty">No hay solicitudes con esos filtros.</p>
      ) : null}

      {capturando ? (
        <RequestForm
          areas={areas}
          onCreada={(solicitud) => {
            setCapturando(false);
            setVersion((actual) => actual + 1);
            setAbierta(solicitud);
          }}
          onCancelar={() => setCapturando(false)}
        />
      ) : null}

      {abierta !== null ? (
        <RequestDetail
          solicitud={abierta}
          areas={areas}
          onCerrar={() => setAbierta(null)}
          onCambio={() => setVersion((actual) => actual + 1)}
        />
      ) : null}
    </section>
  );
}

export default Inbox;
