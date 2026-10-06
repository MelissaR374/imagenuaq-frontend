// The request inbox (RF-SOL-04): ordered and filterable, so nobody has to read mail, Excel, Teams
// and WhatsApp to find out what is theirs. The filters are the ones RF-SOL-05 names: name, entity,
// folio, assignee and status.
//
// An imported request may come in without a value its format marks required, because the tracker
// had the row half filled: it exists, it says here how many it owes, and what is refused is
// turning it into a project until they are there.
//
// The tabs are the steps of the walk in DATAMODEL.md §8.2, not one more filter: steps 2 and 3 are
// moved by a hand, so the inbox has to say how many are waiting for that hand. "Sin flujo" holds
// what no area has yet (`routed=false` on the server) and its count turns amber while it is not
// zero; an imported request would otherwise sit there forever with no screen saying so.
//
// Each count is its own call with `limit=1`, which is where `total` comes from: the server has no
// counts-per-step endpoint, and repeating the filters here would let the two stop agreeing.
//
// A request opens in place, under its row and at full width, because it is mostly a form: the rows
// above and below stay where they were. It is mounted with `key` on the request id and nothing
// else, so nothing that happens inside remounts it.
//
// `filterSignature` is the JSON of the filters the four tabs share: both effects depend on its
// contents rather than on a new object on every render.
import { Fragment, useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import RequestDetail from "./requestDetail.jsx";
import RequestForm from "./requestForm.jsx";
import "./inbox.css";

const PER_PAGE = 20;

/**
 * The steps of the walk, each with the rule that defines it in one sentence and the filters the
 * server brings it with. `routed` is "some area already has it": by flow or by assigned area.
 */
const TABS = [
  {
    key: "sinFlujo",
    label: "Sin flujo",
    rule:
      "Ninguna área la tiene todavía: falta aplicarle una plantilla, diseñarle un flujo o asignarle un área.",
    warns: true,
    filters: { converted: "false", routed: "false" },
  },
  {
    key: "enAtencion",
    label: "En atención",
    rule:
      "Las áreas de su primera fase ya la tienen en su bandeja y mueven su estatus conforme avanza.",
    filters: { converted: "false", routed: "true" },
  },
  {
    key: "convertidas",
    label: "Convertidas",
    rule: "Ya son proyecto: desde aquí no se editan, salvo el solicitante.",
    filters: { converted: "true" },
  },
  {
    key: "todas",
    label: "Todas",
    rule: "Todo lo que ha entrado, en cualquier paso.",
    filters: {},
  },
];

const NO_FILTERS = {
  q: "",
  areaId: "",
  statusId: "",
  duplicates: "",
  sort: "priority",
};

/** How it arrived, in words: the code is the server's and is shown to nobody. */
const SOURCES = {
  manual: "Captura directa",
  email: "Correo",
  form: "Formulario",
  sheet: "Excel",
};

/** The areas that have it in their inbox: those of its flow's first phase, or the assigned one. */
function areasOf(request) {
  if (request.hasFlow && request.firstPhaseAreas.length > 0) {
    return request.firstPhaseAreas.join(", ");
  }
  return request.areaName;
}

/** Whether nobody has it: no flow and no area. It is what carries the amber line. */
function unrouted(request) {
  return request.projectId === null && !request.hasFlow && request.areaId === null;
}

/** A value that may be missing, said in words when it is. */
function NoValue({ value }) {
  if (value === null || value === undefined || value === "") {
    return <span className="inbox-none">Sin dato</span>;
  }
  return value;
}

/** One row of the inbox. The whole row opens the request. */
function RequestRow({ request, opened, withProject, onOpen }) {
  let duplicateMark = null;
  if (request.possibleDuplicateOf !== null) {
    duplicateMark = <span className="inbox-dup">Posible duplicado</span>;
  }

  let missingMark = null;
  if (request.missingRequired > 0) {
    missingMark = (
      <span className="inbox-dup">
        Faltan {request.missingRequired}{" "}
        {request.missingRequired === 1 ? "dato obligatorio" : "datos obligatorios"}
      </span>
    );
  }

  let className = "inbox-row";
  if (opened) {
    className += " is-open";
  }
  if (unrouted(request) || request.missingRequired > 0) {
    className += " is-pending";
  }

  return (
    <tr className={className} onClick={() => onOpen(request)}>
      <td className="inbox-cell-main">
        <span className="inbox-folio">{request.folio}</span>
        <span className="inbox-row-title">{request.title}</span>
        {missingMark}
        {duplicateMark}
      </td>
      <td>
        <NoValue value={request.requester} />
      </td>
      <td>
        <NoValue value={areasOf(request)} />
      </td>
      <td>{request.statusLabel}</td>
      <td className="inbox-arrived">
        {SOURCES[request.source] ?? request.source}
        <span>{shortDate(request.createdAt)}</span>
      </td>
      <td className="inbox-num">{request.priority}</td>
      {withProject ? (
        <td>
          <NoValue value={request.projectKey} />
        </td>
      ) : null}
    </tr>
  );
}

function Inbox() {
  const [requests, setSolicitudes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [statuses, setEstatus] = useState([]);
  const [tab, setPestana] = useState("sinFlujo");
  const [counts, setCuentas] = useState({});
  const [filters, setFiltros] = useState(NO_FILTERS);
  const [page, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [opened, setAbierta] = useState(null);
  const [capturing, setCapturando] = useState(false);

  const [version, setVersion] = useState(0);

  const activeTab = TABS.find((one) => one.key === tab) ?? TABS[0];

  const filterSignature = JSON.stringify({
    q: filters.q,
    areaId: filters.areaId,
    statusId: filters.statusId,
    duplicates: filters.duplicates,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      try {
        const [areasResponse, statusesResponse] = await Promise.all([
          api.listAreas(),
          api.listStatuses(),
        ]);
        if (cancelled) {
          return;
        }
        setAreas(areasResponse.areas);
        setEstatus(statusesResponse.statuses);
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

    async function loadRequests() {
      setCargando(true);
      try {
        const response = await api.listRequests({
          ...JSON.parse(filterSignature),
          ...activeTab.filters,
          sort: filters.sort,
          limit: PER_PAGE,
          offset: page * PER_PAGE,
        });
        if (!cancelled) {
          setSolicitudes(response.requests);
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

    loadRequests();
    return () => {
      cancelled = true;
    };
  }, [filterSignature, filters.sort, activeTab, version, page]);

  useEffect(() => {
    let cancelled = false;

    async function loadCounts() {
      const base = JSON.parse(filterSignature);
      try {
        const responses = await Promise.all(
          TABS.map((one) => api.listRequests({ ...base, ...one.filters, limit: 1 })),
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

  useEffect(() => {
    if (opened === null && !capturing) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setAbierta(null);
        setCapturando(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [opened, capturing]);

  function changeFilter(key, value) {
    setFiltros((actual) => ({ ...actual, [key]: value }));
    setPagina(0);
  }

  function changeTab(key) {
    setPestana(key);
    setPagina(0);
  }

  function clearFilters() {
    setFiltros(NO_FILTERS);
    setPagina(0);
  }

  function reload() {
    setVersion((actual) => actual + 1);
  }

  /** Open and close with the same row: the one already open folds. */
  function toggleOpen(request) {
    setCapturando(false);
    setAbierta((actual) => (actual !== null && actual.id === request.id ? null : request));
  }

  function openCapture() {
    setAbierta(null);
    setCapturando(true);
  }

  function finishCapture(request) {
    setCapturando(false);
    reload();
    setAbierta(request);
  }

  /**
   * An open request follows its step: applying a flow or assigning an area moves it to another
   * tab, and the tab moves with it so the form does not vanish from under you.
   */
  function followTheStep(detail) {
    reload();
    if (detail === undefined || detail === null) {
      return;
    }

    let target = "enAtencion";
    if (detail.projectId !== null && detail.projectId !== undefined) {
      target = "convertidas";
    } else if (!detail.hasFlow && !detail.flow && detail.areaId === null) {
      target = "sinFlujo";
    }
    if (tab !== "todas" && tab !== target) {
      setPestana(target);
      setPagina(0);
    }
  }

  function close() {
    setAbierta(null);
    reload();
  }

  const filtered =
    filters.q !== "" ||
    filters.areaId !== "" ||
    filters.statusId !== "" ||
    filters.duplicates !== "";

  const first = total === 0 ? 0 : page * PER_PAGE + 1;
  const last = page * PER_PAGE + requests.length;
  const withProject = tab === "convertidas" || tab === "todas";
  const columns = withProject ? 7 : 6;

  let pagination = null;
  if (total > PER_PAGE) {
    pagination = (
      <div className="inbox-pages">
        <p className="inbox-range">
          {first}–{last} de {total}
        </p>
        <div className="inbox-page-actions">
          <button
            className="inbox-btn"
            type="button"
            onClick={() => setPagina(page - 1)}
            disabled={page === 0 || loading}
          >
            Anteriores
          </button>
          <button
            className="inbox-btn"
            type="button"
            onClick={() => setPagina(page + 1)}
            disabled={last >= total || loading}
          >
            Siguientes
          </button>
        </div>
      </div>
    );
  }

  let emptyRow = null;
  if (!loading && requests.length === 0 && !capturing) {
    let text = `Nada en «${activeTab.label}».`;
    if (filtered) {
      text = "Ninguna solicitud coincide con lo que está filtrado.";
    }
    emptyRow = (
      <tr>
        <td colSpan={columns}>
          <p className="inbox-empty">{text}</p>
        </td>
      </tr>
    );
  }

  return (
    <section className="inbox">
      {error !== null ? <p className="inbox-error">{error}</p> : null}

      <div className="inbox-bar">
        <div className="inbox-tabs">
          {TABS.map((one) => {
            const count = counts[one.key];

            let className = "inbox-tab";
            if (one.key === tab) {
              className += " is-active";
            }
            if (one.warns && count > 0) {
              className += " needs";
            }

            return (
              <button
                className={className}
                type="button"
                onClick={() => changeTab(one.key)}
                key={one.key}
              >
                {one.label}
                {count === undefined ? null : <span className="inbox-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        <button className="inbox-btn inbox-btn-primary" type="button" onClick={openCapture}>
          Nueva request
        </button>
      </div>

      <p className={activeTab.warns && counts[activeTab.key] > 0 ? "inbox-rule warn" : "inbox-rule"}>
        {activeTab.rule}
      </p>

      <div className="inbox-filters">
        <div className="inbox-search">
          <input
            value={filters.q}
            onChange={(event) => changeFilter("q", event.target.value)}
            placeholder="Ej: folio, título o solicitante"
            aria-label="Buscar"
          />
        </div>

        <select
          value={filters.areaId}
          onChange={(event) => changeFilter("areaId", event.target.value)}
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
          value={filters.statusId}
          onChange={(event) => changeFilter("statusId", event.target.value)}
          aria-label="Estatus"
        >
          <option value="">Todos los statuses</option>
          {statuses.map((uno) => (
            <option value={uno.id} key={uno.id}>
              {uno.label}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(event) => changeFilter("sort", event.target.value)}
          aria-label="Orden"
        >
          <option value="priority">Por urgencia</option>
          <option value="created">Por llegada</option>
        </select>

        <button
          className={filters.duplicates === "true" ? "inbox-chip is-on" : "inbox-chip"}
          type="button"
          onClick={() => changeFilter("duplicates", filters.duplicates === "true" ? "" : "true")}
        >
          Posibles duplicados
        </button>

        {filtered ? (
          <button className="inbox-clear" type="button" onClick={clearFilters}>
            Quitar filters
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
              {withProject ? <th>Proyecto</th> : null}
            </tr>
          </thead>
          <tbody>
            {capturing ? (
              <tr className="inbox-expanded is-new">
                <td colSpan={columns}>
                  <RequestForm
                    areas={areas}
                    onCreada={finishCapture}
                    onCancelar={() => setCapturando(false)}
                  />
                </td>
              </tr>
            ) : null}

            {requests.map((request) => {
              const isOpen = opened !== null && opened.id === request.id;

              return (
                <Fragment key={request.id}>
                  <RequestRow
                    request={request}
                    opened={isOpen}
                    withProject={withProject}
                    onOpen={toggleOpen}
                  />
                  {isOpen ? (
                    <tr className="inbox-expanded">
                      <td colSpan={columns}>
                        <RequestDetail
                          request={opened}
                          areas={areas}
                          onCerrar={close}
                          onCambio={followTheStep}
                          key={opened.id}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}

            {emptyRow}
          </tbody>
        </table>
      </div>

      {pagination}
    </section>
  );
}

export default Inbox;
