// La bandeja de solicitudes (RF-SOL-04): ordenada y filtrable, para que nadie tenga que
// revisar correo, Excel, Teams y WhatsApp para saber qué le toca. Los filtros son los que
// RF-SOL-05 nombra: nombre, entidad, folio, responsable y estatus.
//
// Las pestañas son los pasos del recorrido de DATAMODEL.md §8.2, no un filtro más: los pasos 2
// y 3 los mueve una mano, así que la bandeja tiene que decir cuántas esperan esa mano. «Sin
// flujo» trae lo que ninguna área tiene todavía (`routed=false` en el servidor) y su cuenta se
// pone en ámbar mientras no sea cero; una solicitud importada se quedaría ahí para siempre sin
// que eso se note en ninguna pantalla.
//
// Cada cuenta es una llamada aparte con `limit=1`, que es de donde sale `total`: el servidor no
// tiene un endpoint de cuentas por paso y repetir los filtros aquí los dejaría de coincidir.
//
// La solicitud se abre en su lugar, bajo su renglón y a todo lo ancho, porque es sobre todo un
// formulario: los renglones de arriba y de abajo se quedan donde estaban. Se monta con `key` en
// el id de la solicitud y nada más, para que nada de lo que pase adentro la vuelva a montar.
//
// `firmaDeFiltros` es el JSON de los filtros que las cuatro pestañas comparten: los dos efectos
// dependen de su contenido y no de un objeto nuevo en cada render.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta } from "../shared/formato.js";
import RequestDetail from "./requestDetail.jsx";
import RequestForm from "./requestForm.jsx";
import "./inbox.css";

const POR_PAGINA = 20;

/**
 * Los pasos del recorrido, cada uno con la regla que lo define en una frase y los filtros con
 * que el servidor lo trae. `routed` es «alguna área ya la tiene»: con flujo o con área asignada.
 */
const PESTANAS = [
  {
    clave: "sinFlujo",
    etiqueta: "Sin flujo",
    regla:
      "Ninguna área la tiene todavía: falta aplicarle una plantilla, diseñarle un flujo o asignarle un área.",
    avisa: true,
    filtros: { converted: "false", routed: "false" },
  },
  {
    clave: "enAtencion",
    etiqueta: "En atención",
    regla:
      "Las áreas de su primera fase ya la tienen en su bandeja y mueven su estatus conforme avanza.",
    filtros: { converted: "false", routed: "true" },
  },
  {
    clave: "convertidas",
    etiqueta: "Convertidas",
    regla: "Ya son proyecto: desde aquí no se editan, salvo el solicitante.",
    filtros: { converted: "true" },
  },
  {
    clave: "todas",
    etiqueta: "Todas",
    regla: "Todo lo que ha entrado, en cualquier paso.",
    filtros: {},
  },
];

const FILTROS_VACIOS = {
  q: "",
  areaId: "",
  statusId: "",
  duplicates: "",
  sort: "priority",
};

/** Cómo llegó, en palabras: el código es del servidor y no se le muestra a nadie. */
const ORIGENES = {
  manual: "Captura directa",
  email: "Correo",
  form: "Formulario",
  sheet: "Excel",
};

/** Las áreas que la tienen en su bandeja: las de la primera fase de su flujo, o la asignada. */
function areasDe(solicitud) {
  if (solicitud.hasFlow && solicitud.firstPhaseAreas.length > 0) {
    return solicitud.firstPhaseAreas.join(", ");
  }
  return solicitud.areaName;
}

/** Si nadie la tiene: ni flujo ni área. Es lo que lleva la línea ámbar. */
function sinRepartir(solicitud) {
  return solicitud.projectId === null && !solicitud.hasFlow && solicitud.areaId === null;
}

/** Un valor que puede faltar, dicho en palabras cuando falta. */
function SinDato({ valor }) {
  if (valor === null || valor === undefined || valor === "") {
    return <span className="inbox-none">Sin dato</span>;
  }
  return valor;
}

/** Un renglón de la bandeja. Todo el renglón abre la solicitud. */
function FilaDeSolicitud({ solicitud, abierta, conProyecto, onAbrir }) {
  let marcaDeDuplicado = null;
  if (solicitud.possibleDuplicateOf !== null) {
    marcaDeDuplicado = <span className="inbox-dup">Posible duplicado</span>;
  }

  let clase = "inbox-row";
  if (abierta) {
    clase += " is-open";
  }
  if (sinRepartir(solicitud)) {
    clase += " is-pending";
  }

  return (
    <tr className={clase} onClick={() => onAbrir(solicitud)}>
      <td className="inbox-cell-main">
        <span className="inbox-folio">{solicitud.folio}</span>
        <span className="inbox-row-title">{solicitud.title}</span>
        {marcaDeDuplicado}
      </td>
      <td>
        <SinDato valor={solicitud.requester} />
      </td>
      <td>
        <SinDato valor={areasDe(solicitud)} />
      </td>
      <td>{solicitud.statusLabel}</td>
      <td className="inbox-arrived">
        {ORIGENES[solicitud.source] ?? solicitud.source}
        <span>{fechaCorta(solicitud.createdAt)}</span>
      </td>
      <td className="inbox-num">{solicitud.priority}</td>
      {conProyecto ? (
        <td>
          <SinDato valor={solicitud.projectKey} />
        </td>
      ) : null}
    </tr>
  );
}

function Inbox() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [estatus, setEstatus] = useState([]);
  const [pestana, setPestana] = useState("sinFlujo");
  const [cuentas, setCuentas] = useState({});
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [capturando, setCapturando] = useState(false);

  const [version, setVersion] = useState(0);

  const activa = PESTANAS.find((una) => una.clave === pestana) ?? PESTANAS[0];

  const firmaDeFiltros = JSON.stringify({
    q: filtros.q,
    areaId: filtros.areaId,
    statusId: filtros.statusId,
    duplicates: filtros.duplicates,
  });

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
          ...JSON.parse(firmaDeFiltros),
          ...activa.filtros,
          sort: filtros.sort,
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
  }, [firmaDeFiltros, filtros.sort, activa, version, pagina]);

  useEffect(() => {
    let cancelado = false;

    async function cargarCuentas() {
      const base = JSON.parse(firmaDeFiltros);
      try {
        const respuestas = await Promise.all(
          PESTANAS.map((una) => api.listRequests({ ...base, ...una.filtros, limit: 1 })),
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

  useEffect(() => {
    if (abierta === null && !capturando) {
      return undefined;
    }

    function alTeclear(evento) {
      if (evento.key === "Escape") {
        setAbierta(null);
        setCapturando(false);
      }
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta, capturando]);

  function cambiarFiltro(clave, valor) {
    setFiltros((actual) => ({ ...actual, [clave]: valor }));
    setPagina(0);
  }

  function cambiarPestana(clave) {
    setPestana(clave);
    setPagina(0);
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setPagina(0);
  }

  function recargar() {
    setVersion((actual) => actual + 1);
  }

  /** Abrir y cerrar con el mismo renglón: el que ya está abierto se dobla. */
  function alternarAbierta(solicitud) {
    setCapturando(false);
    setAbierta((actual) => (actual !== null && actual.id === solicitud.id ? null : solicitud));
  }

  function abrirCaptura() {
    setAbierta(null);
    setCapturando(true);
  }

  function terminarCaptura(solicitud) {
    setCapturando(false);
    recargar();
    setAbierta(solicitud);
  }

  /**
   * Una solicitud abierta sigue su paso: al aplicarle un flujo o asignarle un área cambia de
   * pestaña, y la pestaña se cambia con ella para que el formulario no desaparezca de abajo.
   */
  function seguirElPaso(detalle) {
    recargar();
    if (detalle === undefined || detalle === null) {
      return;
    }

    let destino = "enAtencion";
    if (detalle.projectId !== null && detalle.projectId !== undefined) {
      destino = "convertidas";
    } else if (!detalle.hasFlow && !detalle.flow && detalle.areaId === null) {
      destino = "sinFlujo";
    }
    if (pestana !== "todas" && pestana !== destino) {
      setPestana(destino);
      setPagina(0);
    }
  }

  function cerrar() {
    setAbierta(null);
    recargar();
  }

  const filtrado =
    filtros.q !== "" ||
    filtros.areaId !== "" ||
    filtros.statusId !== "" ||
    filtros.duplicates !== "";

  const primera = total === 0 ? 0 : pagina * POR_PAGINA + 1;
  const ultima = pagina * POR_PAGINA + solicitudes.length;
  const conProyecto = pestana === "convertidas" || pestana === "todas";
  const columnas = conProyecto ? 7 : 6;

  let paginacion = null;
  if (total > POR_PAGINA) {
    paginacion = (
      <div className="inbox-pages">
        <p className="inbox-range">
          {primera}–{ultima} de {total}
        </p>
        <div className="inbox-page-actions">
          <button
            className="inbox-btn"
            type="button"
            onClick={() => setPagina(pagina - 1)}
            disabled={pagina === 0 || cargando}
          >
            Anteriores
          </button>
          <button
            className="inbox-btn"
            type="button"
            onClick={() => setPagina(pagina + 1)}
            disabled={ultima >= total || cargando}
          >
            Siguientes
          </button>
        </div>
      </div>
    );
  }

  let renglonVacio = null;
  if (!cargando && solicitudes.length === 0 && !capturando) {
    let texto = `Nada en «${activa.etiqueta}».`;
    if (filtrado) {
      texto = "Ninguna solicitud coincide con lo que está filtrado.";
    }
    renglonVacio = (
      <tr>
        <td colSpan={columnas}>
          <p className="inbox-empty">{texto}</p>
        </td>
      </tr>
    );
  }

  return (
    <section className="inbox">
      {error !== null ? <p className="inbox-error">{error}</p> : null}

      <div className="inbox-bar">
        <div className="inbox-tabs">
          {PESTANAS.map((una) => {
            const cuenta = cuentas[una.clave];

            let clase = "inbox-tab";
            if (una.clave === pestana) {
              clase += " is-active";
            }
            if (una.avisa && cuenta > 0) {
              clase += " needs";
            }

            return (
              <button
                className={clase}
                type="button"
                onClick={() => cambiarPestana(una.clave)}
                key={una.clave}
              >
                {una.etiqueta}
                {cuenta === undefined ? null : <span className="inbox-tab-count">{cuenta}</span>}
              </button>
            );
          })}
        </div>

        <button className="inbox-btn inbox-btn-primary" type="button" onClick={abrirCaptura}>
          Nueva solicitud
        </button>
      </div>

      <p className={activa.avisa && cuentas[activa.clave] > 0 ? "inbox-rule warn" : "inbox-rule"}>
        {activa.regla}
      </p>

      <div className="inbox-filters">
        <div className="inbox-search">
          <input
            value={filtros.q}
            onChange={(evento) => cambiarFiltro("q", evento.target.value)}
            placeholder="Ej: folio, título o solicitante"
            aria-label="Buscar"
          />
        </div>

        <select
          value={filtros.areaId}
          onChange={(evento) => cambiarFiltro("areaId", evento.target.value)}
          aria-label="Área"
        >
          <option value="">Todas las áreas</option>
          {areas.map((area) => (
            <option value={area.id} key={area.id}>
              {area.name}
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
          <option value="created">Por llegada</option>
        </select>

        <button
          className={filtros.duplicates === "true" ? "inbox-chip is-on" : "inbox-chip"}
          type="button"
          onClick={() => cambiarFiltro("duplicates", filtros.duplicates === "true" ? "" : "true")}
        >
          Posibles duplicados
        </button>

        {filtrado ? (
          <button className="inbox-clear" type="button" onClick={limpiarFiltros}>
            Quitar filtros
          </button>
        ) : null}
      </div>

      <div className="inbox-table-wrap">
        <table className="inbox-table">
          <thead>
            <tr>
              <th>Solicitud</th>
              <th>Solicitante</th>
              <th>Área</th>
              <th>Estatus</th>
              <th>Llegó</th>
              <th className="inbox-num">Urgencia</th>
              {conProyecto ? <th>Proyecto</th> : null}
            </tr>
          </thead>
          <tbody>
            {capturando ? (
              <tr className="inbox-expanded is-new">
                <td colSpan={columnas}>
                  <RequestForm
                    areas={areas}
                    onCreada={terminarCaptura}
                    onCancelar={() => setCapturando(false)}
                  />
                </td>
              </tr>
            ) : null}

            {solicitudes.map((solicitud) => {
              const estaAbierta = abierta !== null && abierta.id === solicitud.id;

              return (
                <Fragment key={solicitud.id}>
                  <FilaDeSolicitud
                    solicitud={solicitud}
                    abierta={estaAbierta}
                    conProyecto={conProyecto}
                    onAbrir={alternarAbierta}
                  />
                  {estaAbierta ? (
                    <tr className="inbox-expanded">
                      <td colSpan={columnas}>
                        <RequestDetail
                          solicitud={abierta}
                          areas={areas}
                          onCerrar={cerrar}
                          onCambio={seguirElPaso}
                          key={abierta.id}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

            {renglonVacio}
          </tbody>
        </table>
      </div>

      {paginacion}
    </section>
  );
}

export default Inbox;
