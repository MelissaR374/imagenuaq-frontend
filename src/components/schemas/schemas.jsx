// The request formats (RF-SOL-01). A format is the identity; what it asks for lives in its
// versions, and a published version is not edited: "editing" is publishing the next one, so what
// was captured with the previous one keeps reading as it was captured.
//
// The list is light on purpose: no buttons per row, because a format opens and everything that can
// be done to it lives inside, next to what it will change. The versions are said in one quiet line
// under the name: they matter when updating and when looking back, not when choosing.
//
// What each format is used by -- how many requests were captured with it and how many Excel
// workbooks are mapped to it -- comes from the server, because it is what makes the warning about
// publishing concrete: earlier requests keep being read with their version, and a workbook stays
// on its own until somebody remaps it.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import SchemaFormat from "./schemaFormat.jsx";
import "./schemas.css";

const TABS = [
  {
    key: "activos",
    label: "Activos",
    rule: "Los que se pueden elegir al capturar una solicitud.",
  },
  {
    key: "inactivos",
    label: "Inactivos",
    rule:
      "Ya no se ofrecen al capturar. Nada se borra: lo capturado con ellos se sigue leyendo.",
  },
];

/** How many fields a format asks for, of what kind, and how many are required. */
function fieldTally(format) {
  if (format.fields === null || format.fields === undefined) {
    return "Sin versión publicada";
  }
  const deliverables = format.fields.deliverables;
  const information = format.fields.information;
  const total = deliverables.length + information.length;
  const required = [...deliverables, ...information].filter((campo) => campo.required).length;

  return `${total} ${total === 1 ? "campo" : "campos"} · ${required} ${
    required === 1 ? "obligatorio" : "required"
  } · ${deliverables.length} de entrega`;
}

/** What it is used by: what makes the warning about publishing a version concrete. */
function usage(format) {
  const parts = [];
  if (format.requestCount > 0) {
    parts.push(
      `${format.requestCount} ${format.requestCount === 1 ? "solicitud" : "solicitudes"}`,
    );
  }
  if (format.sheetCount > 0) {
    parts.push(
      `${format.sheetCount} ${format.sheetCount === 1 ? "libro de Excel" : "libros de Excel"}`,
    );
  }
  if (parts.length === 0) {
    return "Sin uso todavía";
  }
  return parts.join(" · ");
}

function FormatRow({ format, onOpen }) {
  return (
    <tr className="schemas-row" onClick={() => onOpen(format)}>
      <td className="schemas-cell-main">
        <span className="schemas-code">{format.code}</span>
        <span className="schemas-row-name">{format.name}</span>
        <span className="schemas-version-line">
          {format.version === null ? "Sin versión" : `Versión ${format.version}`}
          {format.publishedAt === null ? "" : ` · ${shortDate(format.publishedAt)}`}
          {format.publishedByName === null ? "" : ` · ${format.publishedByName}`}
        </span>
      </td>
      <td>{fieldTally(format)}</td>
      <td>{usage(format)}</td>
    </tr>
  );
}

function Schemas() {
  const [formats, setFormatos] = useState([]);
  const [types, setTipos] = useState([]);
  const [vocabulary, setVocabulario] = useState([]);
  const [tab, setPestana] = useState("activos");
  const [search, setBusqueda] = useState("");
  const [opened, setAbierto] = useState(null);
  const [creating, setNuevo] = useState(false);
  const [loading, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [formatosRes, tiposRes, clavesRes] = await Promise.all([
          api.listSchemas(),
          api.listDataTypes(),
          api.listFieldKeys(),
        ]);
        if (cancelled) return;
        setFormatos(formatosRes.schemas);
        setTipos(tiposRes.dataTypes);
        setVocabulario(clavesRes.fieldKeys);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      } finally {
        if (!cancelled) setCargando(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    try {
      const [{ schemas }, { fieldKeys }] = await Promise.all([
        api.listSchemas(),
        api.listFieldKeys(),
      ]);
      setFormatos(schemas);
      setVocabulario(fieldKeys);
      return schemas;
    } catch (failure) {
      setError(failure.message);
      return formats;
    }
  }

  /** On publishing or cloning, the open format stays open, holding what was just saved. */
  async function onFormatChanged(id) {
    const list = await reload();
    if (id === undefined || id === null) {
      return;
    }
    const found = list.find((one) => one.id === id);
    if (found !== undefined) {
      setAbierto(found);
      setNuevo(false);
    }
  }

  if (creating || opened !== null) {
    return (
      <SchemaFormat
        format={creating ? null : opened}
        formats={formats}
        types={types}
        vocabulary={vocabulary}
        onChanged={onFormatChanged}
        onClose={() => {
          setAbierto(null);
          setNuevo(false);
          reload();
        }}
        key={creating ? "nuevo" : opened.id}
      />
    );
  }

  const activeTab = TABS.find((one) => one.key === tab) ?? TABS[0];
  const text = search.trim().toLowerCase();
  const visible = formats.filter((format) => {
    if (format.isActive !== (tab === "activos")) {
      return false;
    }
    if (text === "") {
      return true;
    }
    return (
      format.name.toLowerCase().includes(text) || format.code.toLowerCase().includes(text)
    );
  });

  return (
    <section className="schemas">
      {error !== null ? <p className="schemas-error">{error}</p> : null}

      <div className="schemas-bar">
        <div className="schemas-tabs">
          {TABS.map((one) => {
            const count = formats.filter(
              (format) => format.isActive === (one.key === "activos"),
            ).length;
            return (
              <button
                className={one.key === tab ? "schemas-tab is-active" : "schemas-tab"}
                type="button"
                onClick={() => setPestana(one.key)}
                key={one.key}
              >
                {one.label}
                <span className="schemas-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <button
          className="schemas-btn schemas-btn-primary"
          type="button"
          onClick={() => setNuevo(true)}
        >
          Nuevo format
        </button>
      </div>

      <p className="schemas-rule">{activeTab.rule}</p>

      <div className="schemas-filters">
        <div className="schemas-search">
          <input
            value={search}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Ej: nombre o clave"
            aria-label="Buscar"
          />
        </div>
      </div>

      <div className="schemas-table-wrap">
        <table className="schemas-table">
          <thead>
            <tr>
              <th>Formato</th>
              <th>Qué pide</th>
              <th>En uso</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((format) => (
              <FormatRow format={format} onOpen={setAbierto} key={format.id} />
            ))}

            {!loading && visible.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <p className="schemas-empty">
                    {text === ""
                      ? `Nada en «${activeTab.label}».`
                      : "Ningún formato coincide con lo que buscas."}
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Schemas;
