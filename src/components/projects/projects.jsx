// El tablero de proyectos (RF-PRY-02). Los más urgentes arriba: aquí no hay orden de llegada, la
// urgencia la pone una persona (RF-FLW-08).
//
// Las pestañas son el estado del proyecto y no un filtro más, porque son excluyentes y cada una
// tiene su propia regla. Al lado, «Mis proyectos» o «Todos»: por omisión solo lo que me toca, que
// es un proyecto que yo creé o uno donde soy responsable de una etapa (`mine` en el servidor, que
// además marca cada renglón). Las cuentas siguen ese interruptor, para que no digan una cosa y la
// lista otra.
//
// La columna «Dónde va» nombra las etapas abiertas en lugar de contarlas: «Diseño gráfico ·
// Propuesta» es algo sobre lo que alguien puede actuar, un 2 no. Un proyecto sin etapas abiertas
// cuyo estatus no dice que terminó es trabajo que nadie cerró, y lleva la línea ámbar.
//
// El proyecto se abre a pantalla completa, encima de la lista y de la barra lateral: lleva un
// proceso vivo con muchas partes y en su lugar, bajo el renglón, se interrumpía.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta } from "../shared/formato.js";
import { vocabularioDeFormatos } from "../shared/vocabulario.js";
import ProjectDetail from "./projectDetail.jsx";
import ProjectForm from "./projectForm.jsx";
import "./projects.css";

const POR_PAGINA = 20;

/** Los estados de un proyecto, cada uno con la regla que lo define en una frase. */
const PESTANAS = [
  {
    clave: "open",
    etiqueta: "Abiertos",
    regla: "Trabajo en curso: ni concluido ni quitado de en medio.",
  },
  {
    clave: "closed",
    etiqueta: "Cerrados",
    regla: "Ya se concluyeron. Cerrar se niega mientras alguna etapa siga abierta.",
  },
  {
    clave: "archived",
    etiqueta: "Archivados",
    regla: "Quitados de en medio. Archivar es otra cosa que concluir.",
  },
  { clave: "all", etiqueta: "Todos", regla: "Todo lo que existe, en cualquier estado." },
];

const FILTROS_VACIOS = {
  q: "",
  areaId: "",
  statusId: "",
  hasCost: "",
  fieldKey: "",
  fieldValue: "",
  sort: "priority",
};

/** Los días entre hoy y una fecha, para decir «en 9 d» o «vencido hace 21 d». */
function diasHasta(fecha) {
  const dia = 24 * 60 * 60 * 1000;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(fecha).setHours(0, 0, 0, 0) - hoy) / dia);
}

/** La fecha de entrega con lo que falta o lo que ya se pasó. */
function Entrega({ dueOn, cerrado }) {
  if (dueOn === null || dueOn === undefined) {
    return <span className="projects-none">Sin fecha</span>;
  }

  const dias = diasHasta(dueOn);

  let plazo = `en ${dias} d`;
  let clase = "projects-due-note";
  if (dias === 0) {
    plazo = "hoy";
  } else if (dias < 0) {
    plazo = `vencido hace ${-dias} d`;
    clase = "projects-due-note is-late";
  }
  if (cerrado) {
    plazo = "";
  }

  return (
    <>
      {fechaCorta(dueOn)}
      {plazo === "" ? null : <span className={clase}>{plazo}</span>}
    </>
  );
}

/** Dónde va: cada etapa abierta por su área y su título, en ámbar la que espera a un tercero. */
function DondeVa({ proyecto }) {
  if (proyecto.openStages.length === 0) {
    if (proyecto.closedAt !== null || proyecto.archivedAt !== null) {
      return <span className="projects-none">Nada abierto</span>;
    }
    return <span className="projects-stale">Sin etapas abiertas</span>;
  }

  return (
    <ul className="projects-stages">
      {proyecto.openStages.map((etapa) => (
        <li
          className={
            etapa.status === "waiting_external" ? "projects-stage is-waiting" : "projects-stage"
          }
          key={etapa.id}
        >
          <span className="projects-stage-area">{etapa.areaName}</span>
          {etapa.title}
          {etapa.status === "waiting_external" ? " · en espera" : ""}
        </li>
      ))}
    </ul>
  );
}

function FilaDeProyecto({ proyecto, onAbrir }) {
  let miParte = null;
  if (proyecto.mineResponsible) {
    miParte = <span className="projects-mine">Eres responsable</span>;
  } else if (proyecto.mineCreated) {
    miParte = <span className="projects-mine">Lo creaste</span>;
  }

  const sinCerrar =
    proyecto.openStages.length === 0 &&
    proyecto.closedAt === null &&
    proyecto.archivedAt === null;

  return (
    <tr
      className={sinCerrar ? "projects-row is-stale" : "projects-row"}
      onClick={() => onAbrir(proyecto)}
    >
      <td className="projects-cell-main">
        <span className="projects-key">{proyecto.key}</span>
        <span className="projects-row-title">{proyecto.title}</span>
        {miParte}
      </td>
      <td>
        {proyecto.requester === null || proyecto.requester === "" ? (
          <span className="projects-none">Sin dato</span>
        ) : (
          proyecto.requester
        )}
      </td>
      <td>
        <DondeVa proyecto={proyecto} />
      </td>
      <td>{proyecto.statusLabel}</td>
      <td className="projects-due">
        <Entrega
          dueOn={proyecto.dueOn}
          cerrado={proyecto.closedAt !== null || proyecto.archivedAt !== null}
        />
      </td>
      <td className="projects-num">{proyecto.priority}</td>
    </tr>
  );
}

function Projects({ usuario }) {
  const [proyectos, setProyectos] = useState([]);
  const [areas, setAreas] = useState([]);
  const [estatus, setEstatus] = useState([]);
  const [vocabulario, setVocabulario] = useState(new Map());
  const [pestana, setPestana] = useState("open");
  const [soloMios, setSoloMios] = useState(true);
  const [cuentas, setCuentas] = useState({});
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [capturando, setCapturando] = useState(false);
  const [version, setVersion] = useState(0);

  const activa = PESTANAS.find((una) => una.clave === pestana) ?? PESTANAS[0];

  const firmaDeFiltros = JSON.stringify({
    q: filtros.q,
    areaId: filtros.areaId,
    statusId: filtros.statusId,
    hasCost: filtros.hasCost,
    fieldKey: filtros.fieldKey,
    fieldValue: filtros.fieldKey === "" ? "" : filtros.fieldValue,
    mine: soloMios ? "true" : "",
  });

  useEffect(() => {
    let cancelado = false;

    async function cargarCatalogos() {
      try {
        const [respuestaAreas, respuestaEstatus, respuestaFormatos] = await Promise.all([
          api.listAreas(),
          api.listStatuses(),
          api.listSchemas(),
        ]);
        if (cancelado) {
          return;
        }
        setAreas(respuestaAreas.areas);
        setEstatus(respuestaEstatus.statuses);
        setVocabulario(vocabularioDeFormatos(respuestaFormatos.schemas));
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
        const respuesta = await api.listProjects({
          ...JSON.parse(firmaDeFiltros),
          state: pestana,
          sort: filtros.sort,
          limit: POR_PAGINA,
          offset: pagina * POR_PAGINA,
        });
        if (!cancelado) {
          setProyectos(respuesta.projects);
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

    cargarProyectos();
    return () => {
      cancelado = true;
    };
  }, [firmaDeFiltros, filtros.sort, pestana, version, pagina]);

  useEffect(() => {
    let cancelado = false;

    async function cargarCuentas() {
      const base = JSON.parse(firmaDeFiltros);
      try {
        const respuestas = await Promise.all(
          PESTANAS.map((una) => api.listProjects({ ...base, state: una.clave, limit: 1 })),
        );
        if (cancelado) {
          return;
        }
        const nuevas = {};
        PESTANAS.forEach((una, indice) => {
          nuevas[una.clave] = respuestas[indice].total;
        });
        setCuentas(nuevas);
      } catch (fallo) {
        if (!cancelado) {
          setError(fallo.message);
        }
      }
    }

    cargarCuentas();
    return () => {
      cancelado = true;
    };
  }, [firmaDeFiltros, version]);

  function cambiarFiltro(clave, valor) {
    setFiltros((actual) => ({ ...actual, [clave]: valor }));
    setPagina(0);
  }

  function cambiarPestana(clave) {
    setPestana(clave);
    setPagina(0);
  }

  function cambiarAlcance(mios) {
    setSoloMios(mios);
    setPagina(0);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setPagina(0);
  }

  function recargar() {
    setVersion((actual) => actual + 1);
  }

  function terminarCaptura(proyecto) {
    setCapturando(false);
    recargar();
    setAbierto(proyecto);
  }

  /** Pasar al vecino de la lista sin cerrar: el ‹ › de la barra del proyecto. */
  function moverse(salto) {
    const indice = proyectos.findIndex((uno) => uno.id === abierto.id);
    const destino = proyectos[indice + salto];
    if (destino !== undefined) {
      setAbierto(destino);
    }
  }

  const filtrado =
    filtros.q !== "" ||
    filtros.areaId !== "" ||
    filtros.statusId !== "" ||
    filtros.hasCost !== "" ||
    filtros.fieldKey !== "";

  const primera = total === 0 ? 0 : pagina * POR_PAGINA + 1;
  const ultima = pagina * POR_PAGINA + proyectos.length;
  const indiceAbierto = abierto === null ? -1 : proyectos.findIndex((uno) => uno.id === abierto.id);

  if (abierto !== null) {
    return (
      <ProjectDetail
        proyecto={abierto}
        areas={areas}
        estatus={estatus}
        vocabulario={vocabulario}
        usuario={usuario}
        lugar={indiceAbierto === -1 ? null : { posicion: indiceAbierto + 1, de: proyectos.length }}
        onAnterior={indiceAbierto > 0 ? () => moverse(-1) : null}
        onSiguiente={
          indiceAbierto !== -1 && indiceAbierto < proyectos.length - 1 ? () => moverse(1) : null
        }
        onCerrar={() => {
          setAbierto(null);
          recargar();
        }}
        onCambio={recargar}
        key={abierto.id}
      />
    );
  }

  return (
    <section className="projects">
      {error !== null ? <p className="projects-error">{error}</p> : null}

      <div className="projects-bar">
        <div className="projects-tabs">
          {PESTANAS.map((una) => (
            <button
              className={una.clave === pestana ? "projects-tab is-active" : "projects-tab"}
              type="button"
              onClick={() => cambiarPestana(una.clave)}
              key={una.clave}
            >
              {una.etiqueta}
              {cuentas[una.clave] === undefined ? null : (
                <span className="projects-tab-count">{cuentas[una.clave]}</span>
              )}
            </button>
          ))}

          <div className="projects-scope">
            <button
              className={soloMios ? "projects-scope-btn is-on" : "projects-scope-btn"}
              type="button"
              onClick={() => cambiarAlcance(true)}
            >
              Mis proyectos
            </button>
            <button
              className={soloMios ? "projects-scope-btn" : "projects-scope-btn is-on"}
              type="button"
              onClick={() => cambiarAlcance(false)}
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
          Nuevo proyecto
        </button>
      </div>

      <p className="projects-rule">
        {activa.regla}
        {soloMios ? " Solo los que creaste o en los que eres responsable de una etapa." : ""}
      </p>

      <div className="projects-filters">
        <div className="projects-search">
          <input
            value={filtros.q}
            onChange={(evento) => cambiarFiltro("q", evento.target.value)}
            placeholder="Ej: llave o título"
            aria-label="Buscar"
          />
        </div>

        <select
          value={filtros.areaId}
          onChange={(evento) => cambiarFiltro("areaId", evento.target.value)}
          aria-label="Con etapa en un área"
        >
          <option value="">Con etapa en cualquier área</option>
          {areas.map((area) => (
            <option value={area.id} key={area.id}>
              Con etapa en {area.name}
            </option>
          ))}
        </select>

        <select
          value={filtros.statusId}
          onChange={(evento) => cambiarFiltro("statusId", evento.target.value)}
          aria-label="Estatus"
        >
          <option value="">Todos los estatus</option>
          {estatus.map((uno) => (
            <option value={uno.id} key={uno.id}>
              {uno.label}
            </option>
          ))}
        </select>

        <select
          value={filtros.sort}
          onChange={(evento) => cambiarFiltro("sort", evento.target.value)}
          aria-label="Orden"
        >
          <option value="priority">Por urgencia</option>
          <option value="due">Por fecha de entrega</option>
        </select>

        <button
          className={filtros.hasCost === "true" ? "projects-chip is-on" : "projects-chip"}
          type="button"
          onClick={() => cambiarFiltro("hasCost", filtros.hasCost === "true" ? "" : "true")}
        >
          Con costo
        </button>

        <select
          value={filtros.fieldKey}
          onChange={(evento) => cambiarFiltro("fieldKey", evento.target.value)}
          aria-label="Buscar por un dato"
        >
          <option value="">Buscar por un dato…</option>
          {[...vocabulario.entries()].map(([clave, campo]) => (
            <option value={clave} key={clave}>
              {campo.name}
            </option>
          ))}
        </select>

        {filtros.fieldKey === "" ? null : (
          <input
            className="projects-field-value"
            value={filtros.fieldValue}
            onChange={(evento) => cambiarFiltro("fieldValue", evento.target.value)}
            placeholder={`Valor de ${vocabulario.get(filtros.fieldKey)?.name ?? filtros.fieldKey}`}
          />
        )}

        {filtrado ? (
          <button className="projects-clear" type="button" onClick={limpiarFiltros}>
            Quitar filtros
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
            {capturando ? (
              <tr className="projects-expanded">
                <td colSpan={6}>
                  <ProjectForm
                    onCreado={terminarCaptura}
                    onCancelar={() => setCapturando(false)}
                  />
                </td>
              </tr>
            ) : null}

            {proyectos.map((proyecto) => (
              <FilaDeProyecto proyecto={proyecto} onAbrir={setAbierto} key={proyecto.id} />
            ))}

            {!cargando && proyectos.length === 0 && !capturando ? (
              <tr>
                <td colSpan={6}>
                  <p className="projects-empty">
                    {soloMios && !filtrado
                      ? "No hay proyectos tuyos aquí."
                      : "Ningún proyecto coincide con lo que está filtrado."}
                    {soloMios ? (
                      <button
                        className="projects-clear"
                        type="button"
                        onClick={() => cambiarAlcance(false)}
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

      {total > POR_PAGINA ? (
        <div className="projects-pages">
          <p className="projects-range">
            {primera}–{ultima} de {total}
          </p>
          <div className="projects-page-actions">
            <button
              className="projects-btn"
              type="button"
              onClick={() => setPagina(pagina - 1)}
              disabled={pagina === 0 || cargando}
            >
              Anteriores
            </button>
            <button
              className="projects-btn"
              type="button"
              onClick={() => setPagina(pagina + 1)}
              disabled={ultima >= total || cargando}
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
