import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import ProjectDetail from "./projectDetail.jsx";
import ProjectForm from "./projectForm.jsx";
import StatusCatalog from "./statusCatalog.jsx";
import "./projects.css";

// El tablero de proyectos (RF-PRY-02). Por omisión los abiertos, los más urgentes arriba:
// aquí no hay orden de llegada, la urgencia la pone una persona (RF-FLW-08).
//
// «Estatus» y «Etapas abiertas» van pegadas a propósito: son los dos vocabularios de estado de
// DATAMODEL.md §8.1 y no se mueven solos ni juntos. Un proyecto con cero etapas abiertas y un
// estatus que no dice «terminado» es trabajo que nadie cerró, y así se ve desde la lista.
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

function oGuion(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  return valor;
}

function FiltroSelect({ etiqueta, valor, opciones, onCambio }) {
  return (
    <label className="projects-filter">
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

function FilaDeProyecto({ proyecto, onAbrir }) {
  return (
    <tr className="projects-row">
      <td className="projects-key">{proyecto.key}</td>
      <td>{proyecto.title}</td>
      <td>{oGuion(proyecto.requester)}</td>
      <td>{proyecto.statusLabel}</td>
      <td className="projects-cell-center">{proyecto.priority}</td>
      <td className="projects-cell-center">{proyecto.openStageCount}</td>
      <td className="projects-cell-center">{proyecto.requestCount}</td>
      <td>{oGuion(proyecto.dueOn)}</td>
      <td>
        <button type="button" onClick={() => onAbrir(proyecto)}>
          Abrir
        </button>
      </td>
    </tr>
  );
}

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

    async function cargarProyectos() {
      setCargando(true);
      try {
        const respuesta = await api.listProjects(filtros);
        if (!cancelado) {
          setProyectos(respuesta.projects);
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

    cargarProyectos();
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

  function terminarCaptura(proyecto) {
    setCapturando(false);
    recargar();
    setAbierto(proyecto);
  }

  function alternarCatalogo() {
    setVerCatalogo(!verCatalogo);
  }

  function cerrarDetalle() {
    setAbierto(null);
  }

  const opcionesDeEstado = [
    { valor: "open", texto: "Abiertos" },
    { valor: "closed", texto: "Cerrados" },
    { valor: "archived", texto: "Archivados" },
    { valor: "all", texto: "Todos" },
  ];

  const opcionesDeArea = [{ valor: "", texto: "Todas" }];
  for (const area of areas) {
    opcionesDeArea.push({ valor: String(area.id), texto: area.name });
  }

  const opcionesDeEstatus = [{ valor: "", texto: "Todos" }];
  for (const uno of estatus) {
    opcionesDeEstatus.push({ valor: String(uno.id), texto: uno.label });
  }

  const opcionesDeCosto = [
    { valor: "", texto: "Todos" },
    { valor: "true", texto: "Con costo" },
    { valor: "false", texto: "Sin costo" },
  ];

  const opcionesDeOrden = [
    { valor: "priority", texto: "Por urgencia" },
    { valor: "due", texto: "Por fecha de entrega" },
  ];

  let textoDelCatalogo = "Catálogo de estatus";
  if (verCatalogo) {
    textoDelCatalogo = "Ocultar catálogo de estatus";
  }

  let bloqueDeError = null;
  if (error !== null) {
    bloqueDeError = <p className="projects-error">{error}</p>;
  }

  let panelDelCatalogo = null;
  if (verCatalogo) {
    panelDelCatalogo = <StatusCatalog areas={areas} />;
  }

  let bloqueDeCarga = null;
  if (cargando) {
    bloqueDeCarga = <p className="projects-loading">Cargando...</p>;
  }

  let bloqueVacio = null;
  if (!cargando && proyectos.length === 0) {
    bloqueVacio = <p className="projects-empty">No hay proyectos con esos filtros.</p>;
  }

  let formularioDeCaptura = null;
  if (capturando) {
    formularioDeCaptura = (
      <ProjectForm areas={areas} onCreado={terminarCaptura} onCancelar={cerrarCaptura} />
    );
  }

  let detalle = null;
  if (abierto !== null) {
    detalle = (
      <ProjectDetail
        proyecto={abierto}
        areas={areas}
        usuario={usuario}
        onCerrar={cerrarDetalle}
        onCambio={recargar}
      />
    );
  }

  return (
    <section className="projects">
      <header className="projects-header">
        <h2 className="projects-title">Proyectos</h2>
        <div className="projects-header-actions">
          <button type="button" onClick={abrirCaptura}>
            Nuevo proyecto
          </button>
          <button type="button" onClick={alternarCatalogo}>
            {textoDelCatalogo}
          </button>
        </div>
      </header>

      {bloqueDeError}
      {panelDelCatalogo}

      <div className="projects-filters">
        <label className="projects-filter">
          Buscar
          <input
            value={filtros.q}
            onChange={(evento) => cambiarFiltro("q", evento.target.value)}
            placeholder="Título o llave"
          />
        </label>

        <FiltroSelect
          etiqueta="Estado"
          valor={filtros.state}
          opciones={opcionesDeEstado}
          onCambio={(valor) => cambiarFiltro("state", valor)}
        />

        <FiltroSelect
          etiqueta="Área con etapa"
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
          etiqueta="Costo"
          valor={filtros.hasCost}
          opciones={opcionesDeCosto}
          onCambio={(valor) => cambiarFiltro("hasCost", valor)}
        />

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
            <FilaDeProyecto proyecto={proyecto} onAbrir={setAbierto} key={proyecto.id} />
          ))}
        </tbody>
      </table>

      {bloqueVacio}
      {formularioDeCaptura}
      {detalle}
    </section>
  );
}

export default Projects;
