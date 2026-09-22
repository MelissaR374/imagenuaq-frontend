import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import ProjectDetail from "./projectDetail.jsx";
import ProjectForm from "./projectForm.jsx";
import StatusCatalog from "./statusCatalog.jsx";
import "./projects.css";

// El tablero de proyectos (RF-PRY-02). Por omisión los abiertos, los más urgentes arriba:
// aquí no hay orden de llegada, la urgencia la pone una persona (RF-FLW-08).
//
// El catálogo de estatus se edita desde esta misma pantalla, en un panel aparte, porque es
// donde se usa.
const FILTROS_VACIOS = {
  q: "",
  state: "open",
  areaId: "",
  statusId: "",
  hasCost: "",
  fieldKey: "",
  fieldValue: "",
  sort: "priority",
};

function Projects({ usuario }) {
  const [proyectos, setProyectos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [estatus, setEstatus] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [capturando, setCapturando] = useState(false);
  const [verCatalogo, setVerCatalogo] = useState(false);
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
        const { projects } = await api.listProjects(filtros);
        if (!cancelado) setProyectos(projects);
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
    <section className="projects">
      <header className="projects-header">
        <h2 className="projects-title">Proyectos</h2>
        <div className="projects-header-actions">
          <button type="button" onClick={() => setCapturando(true)}>
            Nuevo proyecto
          </button>
          <button type="button" onClick={() => setVerCatalogo(!verCatalogo)}>
            {verCatalogo ? "Ocultar catálogo de estatus" : "Catálogo de estatus"}
          </button>
        </div>
      </header>

      {error ? <p className="projects-error">{error}</p> : null}

      {verCatalogo ? <StatusCatalog areas={areas} /> : null}

      <div className="projects-filters">
        <label className="projects-filter">
          Buscar
          <input
            value={filtros.q}
            onChange={(evento) => cambiarFiltro("q", evento.target.value)}
            placeholder="Título o llave"
          />
        </label>

        <label className="projects-filter">
          Estado
          <select value={filtros.state} onChange={(evento) => cambiarFiltro("state", evento.target.value)}>
            <option value="open">Abiertos</option>
            <option value="closed">Cerrados</option>
            <option value="archived">Archivados</option>
            <option value="all">Todos</option>
          </select>
        </label>

        <label className="projects-filter">
          Área con etapa
          <select value={filtros.areaId} onChange={(evento) => cambiarFiltro("areaId", evento.target.value)}>
            <option value="">Todas</option>
            {areas.map((area) => (
              <option value={area.id} key={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="projects-filter">
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

        <label className="projects-filter">
          Costo
          <select value={filtros.hasCost} onChange={(evento) => cambiarFiltro("hasCost", evento.target.value)}>
            <option value="">Todos</option>
            <option value="true">Con costo</option>
            <option value="false">Sin costo</option>
          </select>
        </label>

        {/* RF-IMP-08: encontrar el proyecto por un valor que una etapa produjo. */}
        <label className="projects-filter">
          Por valor: clave
          <input
            value={filtros.fieldKey}
            onChange={(evento) => cambiarFiltro("fieldKey", evento.target.value)}
            placeholder="numero_orden"
          />
        </label>

        <label className="projects-filter">
          y valor
          <input
            value={filtros.fieldValue}
            onChange={(evento) => cambiarFiltro("fieldValue", evento.target.value)}
            placeholder="A-77"
          />
        </label>

        <label className="projects-filter">
          Orden
          <select value={filtros.sort} onChange={(evento) => cambiarFiltro("sort", evento.target.value)}>
            <option value="priority">Por urgencia</option>
            <option value="due">Por fecha de entrega</option>
          </select>
        </label>

        <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)}>
          Limpiar
        </button>
      </div>

      {cargando ? <p className="projects-loading">Cargando...</p> : null}

      <table className="projects-table">
        <thead>
          <tr>
            <th>Llave</th>
            <th>Título</th>
            <th>Solicitante</th>
            <th>Estatus</th>
            <th>Urgencia</th>
            <th>Etapas abiertas</th>
            <th>Solicitudes</th>
            <th>Entrega</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {proyectos.map((proyecto) => (
            <tr className="projects-row" key={proyecto.id}>
              <td className="projects-key">{proyecto.key}</td>
              <td>{proyecto.title}</td>
              <td>{proyecto.requester ?? "—"}</td>
              <td>{proyecto.statusLabel}</td>
              <td className="projects-cell-center">{proyecto.priority}</td>
              <td className="projects-cell-center">{proyecto.openStageCount}</td>
              <td className="projects-cell-center">{proyecto.requestCount}</td>
              <td>{proyecto.dueOn ?? "—"}</td>
              <td>
                <button type="button" onClick={() => setAbierto(proyecto)}>
                  Abrir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!cargando && proyectos.length === 0 ? (
        <p className="projects-empty">No hay proyectos con esos filtros.</p>
      ) : null}

      {capturando ? (
        <ProjectForm
          areas={areas}
          onCreado={(proyecto) => {
            setCapturando(false);
            setVersion((actual) => actual + 1);
            setAbierto(proyecto);
          }}
          onCancelar={() => setCapturando(false)}
        />
      ) : null}

      {abierto !== null ? (
        <ProjectDetail
          proyecto={abierto}
          areas={areas}
          usuario={usuario}
          onCerrar={() => setAbierto(null)}
          onCambio={() => setVersion((actual) => actual + 1)}
        />
      ) : null}
    </section>
  );
}

export default Projects;
