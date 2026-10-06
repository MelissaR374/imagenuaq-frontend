// The project board (RF-PRY-02). The most urgent first: there is no order of arrival here, a
// person sets the urgency (RF-FLW-08).
//
// The tabs are the project's state and not one more filter, because they are exclusive and each
// carries its own rule. Beside them, "Mis proyectos" or "Todos": by default only what is mine,
// which is a project I created or one where I am responsible for a stage (`mine` on the server,
// which also marks every row). The counts follow that switch, so they cannot say one thing while
// the list says another.
//
// The "Dónde va" column names the open stages instead of counting them: "Diseño gráfico ·
// Propuesta" is something somebody can act on, a 2 is not. A project with no open stage whose
// status does not say it is finished is work nobody closed, and it carries the amber line.
//
// A project opens full screen, over the list and over the sidebar: it carries a live process with
// many parts, and in place under its row it was cut short.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import { vocabularyOf } from "../shared/vocabulary.js";
import ProjectDetail from "./projectDetail.jsx";
import ProjectForm from "./projectForm.jsx";
import "./projects.css";

const PER_PAGE = 20;

/** A project's states, each with the rule that defines it in one sentence. */
const TABS = [
  {
    key: "open",
    label: "Abiertos",
    rule: "Trabajo en curso: ni concluido ni quitado de en medio.",
  },
  {
    key: "closed",
    label: "Cerrados",
    rule: "Ya se concluyeron. Cerrar se niega mientras alguna etapa siga abierta.",
  },
  {
    key: "archived",
    label: "Archivados",
    rule: "Quitados de en medio. Archivar es otra cosa que concluir.",
  },
  { key: "all", label: "Todos", rule: "Todo lo que existe, en cualquier estado." },
];

const NO_FILTERS = {
  q: "",
  areaId: "",
  statusId: "",
  hasCost: "",
  fieldKey: "",
  fieldValue: "",
  sort: "priority",
};

/** The days between today and a date, to say "en 9 d" or "vencido hace 21 d". */
function daysUntil(fecha) {
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(fecha).setHours(0, 0, 0, 0) - today) / day);
}

/** The due date with what is left of it, or how long ago it passed. */
function DueDate({ dueOn, closed }) {
  if (dueOn === null || dueOn === undefined) {
    return <span className="projects-none">Sin fecha</span>;
  }

  const days = daysUntil(dueOn);

  let due = `en ${days} d`;
  let className = "projects-due-note";
  if (days === 0) {
    due = "hoy";
  } else if (days < 0) {
    due = `vencido hace ${-days} d`;
    className = "projects-due-note is-late";
  }
  if (closed) {
    due = "";
  }

  return (
    <>
      {shortDate(dueOn)}
      {due === "" ? null : <span className={className}>{due}</span>}
    </>
  );
}

/** Where it is: every open stage by its area and title, amber when it waits on a third party. */
function WhereItIs({ project }) {
  if (project.openStages.length === 0) {
    if (project.closedAt !== null || project.archivedAt !== null) {
      return <span className="projects-none">Nada abierto</span>;
    }
    return <span className="projects-stale">Sin etapas abiertas</span>;
  }

  return (
    <ul className="projects-stages">
      {project.openStages.map((stage) => (
        <li
          className={
            stage.status === "waiting_external" ? "projects-stage is-waiting" : "projects-stage"
          }
          key={stage.id}
        >
          <span className="projects-stage-area">{stage.areaName}</span>
          {stage.title}
          {stage.status === "waiting_external" ? " · en espera" : ""}
        </li>
      ))}
    </ul>
  );
}

function ProjectRow({ project, onOpen }) {
  let myPart = null;
  if (project.mineResponsible) {
    myPart = <span className="projects-mine">Eres responsable</span>;
  } else if (project.mineCreated) {
    myPart = <span className="projects-mine">Lo creaste</span>;
  }

  const unclosed =
    project.openStages.length === 0 &&
    project.closedAt === null &&
    project.archivedAt === null;

  return (
    <tr
      className={unclosed ? "projects-row is-stale" : "projects-row"}
      onClick={() => onOpen(project)}
    >
      <td className="projects-cell-main">
        <span className="projects-key">{project.key}</span>
        <span className="projects-row-title">{project.title}</span>
        {myPart}
      </td>
      <td>
        {project.requester === null || project.requester === "" ? (
          <span className="projects-none">Sin dato</span>
        ) : (
          project.requester
        )}
      </td>
      <td>
        <WhereItIs project={project} />
      </td>
      <td>{project.statusLabel}</td>
      <td className="projects-due">
        <DueDate
          dueOn={project.dueOn}
          closed={project.closedAt !== null || project.archivedAt !== null}
        />
      </td>
      <td className="projects-num">{project.priority}</td>
    </tr>
  );
}

function Projects({ user }) {
  const [projects, setProyectos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [statuses, setEstatus] = useState([]);
  const [vocabulary, setVocabulario] = useState(new Map());
  const [tab, setPestana] = useState("open");
  const [onlyMine, setSoloMios] = useState(true);
  const [counts, setCuentas] = useState({});
  const [filters, setFiltros] = useState(NO_FILTERS);
  const [page, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [opened, setAbierto] = useState(null);
  const [capturing, setCapturando] = useState(false);
  const [version, setVersion] = useState(0);

  const activeTab = TABS.find((one) => one.key === tab) ?? TABS[0];

  const filterSignature = JSON.stringify({
    q: filters.q,
    areaId: filters.areaId,
    statusId: filters.statusId,
    hasCost: filters.hasCost,
    fieldKey: filters.fieldKey,
    fieldValue: filters.fieldKey === "" ? "" : filters.fieldValue,
    mine: onlyMine ? "true" : "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      try {
        const [respuestaAreas, respuestaEstatus, respuestaFormatos] = await Promise.all([
          api.listAreas(),
          api.listStatuses(),
          api.listSchemas(),
        ]);
        if (cancelled) {
          return;
        }
        setAreas(respuestaAreas.areas);
        setEstatus(respuestaEstatus.statuses);
        setVocabulario(vocabularyOf(respuestaFormatos.schemas));
      } catch (failure) {
        if (!cancelled) {
          setError(failure.message);
        }
      }
    }

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      setCargando(true);
      try {
        const response = await api.listProjects({
          ...JSON.parse(filterSignature),
          state: tab,
          sort: filters.sort,
          limit: PER_PAGE,
          offset: page * PER_PAGE,
        });
        if (!cancelled) {
          setProyectos(response.projects);
          setTotal(response.total);
        }
      } catch (failure) {
        if (!cancelled) {
          setError(failure.message);
        }
      } finally {
        if (!cancelled) {
          setCargando(false);
        }
      }
    }

    loadProjects();
    return () => {
      cancelled = true;
    };
  }, [filterSignature, filters.sort, tab, version, page]);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      const base = JSON.parse(filterSignature);
      try {
        const responses = await Promise.all(
          TABS.map((one) => api.listProjects({ ...base, state: one.key, limit: 1 })),
        );
        if (cancelled) {
          return;
        }
        const fresh = {};
        TABS.forEach((one, index) => {
          fresh[one.key] = responses[index].total;
        });
        setCuentas(fresh);
      } catch (failure) {
        if (!cancelled) {
          setError(failure.message);
        }
      }
    }

    loadCounts();
    return () => {
      cancelled = true;
    };
  }, [filterSignature, version]);

  function changeFilter(key, value) {
    setFiltros((actual) => ({ ...actual, [key]: value }));
    setPagina(0);
  }

  function changeTab(key) {
    setPestana(key);
    setPagina(0);
  }

  function changeScope(mios) {
    setSoloMios(mios);
    setPagina(0);
  }

  function clearFilters() {
    setFiltros(NO_FILTERS);
    setPagina(0);
  }

  function reload() {
    setVersion((actual) => actual + 1);
  }

  function finishCapture(project) {
    setCapturando(false);
    reload();
    setAbierto(project);
  }

  /** Step to the neighbour in the list without closing: the ‹ › in the project's bar. */
  function moveTo(offset) {
    const index = projects.findIndex((one) => one.id === opened.id);
    const target = projects[index + offset];
    if (target !== undefined) {
      setAbierto(target);
    }
  }

  const filtered =
    filters.q !== "" ||
    filters.areaId !== "" ||
    filters.statusId !== "" ||
    filters.hasCost !== "" ||
    filters.fieldKey !== "";

  const first = total === 0 ? 0 : page * PER_PAGE + 1;
  const last = page * PER_PAGE + projects.length;
  const openIndex = opened === null ? -1 : projects.findIndex((one) => one.id === opened.id);

  if (opened !== null) {
    return (
      <ProjectDetail
        project={opened}
        areas={areas}
        statuses={statuses}
        vocabulary={vocabulary}
        user={user}
        place={openIndex === -1 ? null : { position: openIndex + 1, total: projects.length }}
        onAnterior={openIndex > 0 ? () => moveTo(-1) : null}
        onSiguiente={
          openIndex !== -1 && openIndex < projects.length - 1 ? () => moveTo(1) : null
        }
        onClose={() => {
          setAbierto(null);
          reload();
        }}
        onChanged={reload}
        key={opened.id}
      />
    );
  }

  return (
    <section className="projects">
      {error !== null ? <p className="projects-error">{error}</p> : null}

      <div className="projects-bar">
        <div className="projects-tabs">
          {TABS.map((one) => (
            <button
              className={one.key === tab ? "projects-tab is-active" : "projects-tab"}
              type="button"
              onClick={() => changeTab(one.key)}
              key={one.key}
            >
              {one.label}
              {counts[one.key] === undefined ? null : (
                <span className="projects-tab-count">{counts[one.key]}</span>
              )}
            </button>
          ))}

          <div className="projects-scope">
            <button
              className={onlyMine ? "projects-scope-btn is-on" : "projects-scope-btn"}
              type="button"
              onClick={() => changeScope(true)}
            >
              Mis projects
            </button>
            <button
              className={onlyMine ? "projects-scope-btn" : "projects-scope-btn is-on"}
              type="button"
              onClick={() => changeScope(false)}
            >
              Todos
            </button>
          </div>
        </div>

        <button
          className="projects-btn projects-btn-primary"
          type="button"
          onClick={() => setCapturando(true)}
        >
          Nuevo project
        </button>
      </div>

      <p className="projects-rule">
        {activeTab.rule}
        {onlyMine ? " Solo los que creaste o en los que eres responsable de una etapa." : ""}
      </p>

      <div className="projects-filters">
        <div className="projects-search">
          <input
            value={filters.q}
            onChange={(event) => changeFilter("q", event.target.value)}
            placeholder="Ej: llave o título"
            aria-label="Buscar"
          />
        </div>

        <select
          value={filters.areaId}
          onChange={(event) => changeFilter("areaId", event.target.value)}
          aria-label="Con etapa en un área"
        >
          <option value="">Con etapa en cualquier área</option>
          {areas.map((area) => (
            <option value={area.id} key={area.id}>
              Con stage en {area.name}
            </option>
          ))}
        </select>

        <select
          value={filters.statusId}
          onChange={(event) => changeFilter("statusId", event.target.value)}
          aria-label="Estatus"
        >
          <option value="">Todos los estatus</option>
          {statuses.map((one) => (
            <option value={one.id} key={one.id}>
              {one.label}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(event) => changeFilter("sort", event.target.value)}
          aria-label="Orden"
        >
          <option value="priority">Por urgencia</option>
          <option value="due">Por fecha de entrega</option>
        </select>

        <button
          className={filters.hasCost === "true" ? "projects-chip is-on" : "projects-chip"}
          type="button"
          onClick={() => changeFilter("hasCost", filters.hasCost === "true" ? "" : "true")}
        >
          Con costo
        </button>

        <select
          value={filters.fieldKey}
          onChange={(event) => changeFilter("fieldKey", event.target.value)}
          aria-label="Buscar por un dato"
        >
          <option value="">Buscar por un dato…</option>
          {[...vocabulary.entries()].map(([key, field]) => (
            <option value={key} key={key}>
              {field.name}
            </option>
          ))}
        </select>

        {filters.fieldKey === "" ? null : (
          <input
            className="projects-field-value"
            value={filters.fieldValue}
            onChange={(event) => changeFilter("fieldValue", event.target.value)}
            placeholder={`Valor de ${vocabulary.get(filters.fieldKey)?.name ?? filters.fieldKey}`}
          />
        )}

        {filtered ? (
          <button className="projects-clear" type="button" onClick={clearFilters}>
            Quitar filters
          </button>
        ) : null}
      </div>

      <div className="projects-table-wrap">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Solicitante</th>
              <th>Dónde va</th>
              <th>Estatus</th>
              <th>Entrega</th>
              <th className="projects-num">Urgencia</th>
            </tr>
          </thead>
          <tbody>
            {capturing ? (
              <tr className="projects-expanded">
                <td colSpan={6}>
                  <ProjectForm
                    onCreated={finishCapture}
                    onCancel={() => setCapturando(false)}
                  />
                </td>
              </tr>
            ) : null}

            {projects.map((project) => (
              <ProjectRow project={project} onOpen={setAbierto} key={project.id} />
            ))}

            {!loading && projects.length === 0 && !capturing ? (
              <tr>
                <td colSpan={6}>
                  <p className="projects-empty">
                    {onlyMine && !filtered
                      ? "No hay proyectos tuyos aquí."
                      : "Ningún proyecto coincide con lo que está filtrado."}
                    {onlyMine ? (
                      <button
                        className="projects-clear"
                        type="button"
                        onClick={() => changeScope(false)}
                      >
                        Ver todos
                      </button>
                    ) : null}
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {total > PER_PAGE ? (
        <div className="projects-pages">
          <p className="projects-range">
            {first}–{last} of {total}
          </p>
          <div className="projects-page-actions">
            <button
              className="projects-btn"
              type="button"
              onClick={() => setPagina(page - 1)}
              disabled={page === 0 || loading}
            >
              Anteriores
            </button>
            <button
              className="projects-btn"
              type="button"
              onClick={() => setPagina(page + 1)}
              disabled={last >= total || loading}
            >
              Siguientes
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default Projects;
