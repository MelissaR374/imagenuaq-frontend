// Mapping a book: where each piece of a request comes from (RF-MIG-02).
//
// It reads field by field and not column by column, because the question somebody arrives with is
// "where does the print run come from?", not "what is column F for?". The book's columns sit
// beside it, with their letter and a sample, saying which field each one feeds.
//
// **The target field's type decides the coercion, never the rule.** A rule may say what order a
// date is written in or which words mean yes, because only the sheet knows that; it may not say
// that a quantity should be read as a date.
//
// **Columns are named by their header text.** A tracker gets columns inserted and reordered all
// the time; renaming one is rarer and is a deliberate act. The cost, stated: a renamed header makes
// saving refuse and name the column that disappeared, rather than quietly importing another
// column's values.
//
// **A fixed value for the whole book is part of the mapping, not a shortcut.** A tracker often has
// no column for something that, in that book, is always the same -- the entity requesting, the
// status they come in with -- so it is said once at the top and applied to every row.
import { useEffect, useState } from "react";
import { MdArrowForward, MdErrorOutline } from "react-icons/md";

import * as api from "../../api/client.js";
import { columnLetter } from "../shared/format.js";
import Help from "../shared/help.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import TypeIcon from "../shared/typeIcon.jsx";
import "./importConfig.css";

/** An empty rule: this field is not filled. */
const NO_RULE = { op: "", column: "" };

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

/**
  * What each field type accepts, said on the screen and not only in the code. The texts follow
  * `src/utils/fieldValues.js`, which is what decides. A cell that does not fit is not half saved:
  * the whole row is reported and stays out.
  */
const ACCEPTS = {
  text: "Cualquier texto.",
  location: "Cualquier texto.",
  document: "Cualquier texto.",
  email: "Un correo con @. Si no lo es, la fila no entra.",
  phone: "Dígitos, espacios y ( ) + . - , de 5 a 50 caracteres.",
  url: "Un enlace http o https.",
  quantity: "Un número entero, de cero en adelante. Quita comas y espacios; un texto no entra.",
  currency: "Un monto. Quita el signo de pesos y las comas, y redondea a dos decimales.",
  percentage: "Un número de 0 a 100.",
  date: "Una fecha: el número de Excel, o escrita si eliges abajo en qué orden viene.",
  datetime: "Una fecha con hora, igual que una fecha.",
  boolean: "Sí o no: sí, si, verdadero, 1 / no, falso, 0.",
};

const RULE_KEYS = [
  "column",
  "columns",
  "value",
  "separator",
  "index",
  "from",
  "format",
  "default",
];

/** What a field accepts, in words. */
function acceptedBy(field) {
  return ACCEPTS[field.type] ?? ACCEPTS[field.baseType] ?? `Tipo «${field.type}».`;
}

/**
 * A rule ready to send, or `undefined` when it was not filled. It keeps only the keys its operation
 * uses, as the server does: a rule that still remembers the column somebody tried first reads like
 * a rule that uses it.
 */
function cleanRule(rule) {
  if (rule === undefined || rule === null || !rule.op) {
    return undefined;
  }
  const clean = { op: rule.op };
  for (const key of RULE_KEYS) {
    if (rule[key] !== undefined && rule[key] !== "") {
      clean[key] = rule[key];
    }
  }
  return clean;
}

/** A format's fields as one list: the key is unique across both sections. */
function fieldsOf(format) {
  if (!format) return [];
  return [
    ...format.fields.deliverables.map((field) => ({ ...field, section: "deliverables" })),
    ...format.fields.information.map((field) => ({ ...field, section: "information" })),
  ];
}

/** The rules it starts with: what was saved is kept and the rest starts empty. */
function rulesOf(fields, saved = {}) {
  const rules = {
    title: saved.title ?? { ...NO_RULE },
    requester: saved.requester ?? { ...NO_RULE },
    status: saved.status ?? { ...NO_RULE },
  };
  for (const field of fields) {
    rules[field.code] = saved.fields?.[field.code] ?? { ...NO_RULE };
  }
  return {
    rules,
    hashColumns: saved.hashColumns ?? [],
    equivalences: { ...(saved.status?.map ?? {}) },
  };
}

/** The value of the "sale de" picker for a rule. */
function sourceValue(rule) {
  if (!rule || !rule.op) return "";
  if (rule.op === "column") return `col:${rule.column ?? ""}`;
  return rule.op;
}

/** What the first rows give for a rule, worked out here from the sample. */
function sampleOf(rule, headers, rows) {
  if (!rule || !rule.op || rows.length === 0) {
    return null;
  }
  if (rule.op === "constant") {
    return rule.value === "" || rule.value === undefined ? null : String(rule.value);
  }

  const cell = (column, row) => {
    const index = headers.indexOf(column);
    return index === -1 ? "" : String(row[index] ?? "");
  };

  const row = rows[0];
  if (rule.op === "column") {
    return cell(rule.column, row);
  }
  if (rule.op === "concat") {
    return (rule.columns ?? [])
      .map((column) => cell(column, row))
      .filter((text) => text !== "")
      .join(rule.separator ?? " ");
  }
  if (rule.op === "split") {
    const parts = cell(rule.column, row).split(rule.separator || " ");
    return parts[Number(rule.index ?? 0)] ?? "";
  }
  return null;
}

/** The fixed value, drawn by its target's type. */
function FixedValue({ field, statuses, value, onChange }) {
  if (field.code === "status") {
    return (
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">Elige un estatus</option>
        {statuses.map((one) => (
          <option value={one.code} key={one.id}>
            {one.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === undefined) {
    return (
      <input value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    );
  }

  return (
    <FieldInput
      field={{ ...field, name: "Valor para todas las filas", required: false }}
      value={value ?? ""}
      onChange={onChange}
    />
  );
}

/**
 * One field of the mapping: where it comes from, what that "where" needs to know, and what the
 * first rows give.
 */
function MappedField({ field, rule, headers, rows, statuses, problem, onChange }) {
  const source = sourceValue(rule);
  const sample = sampleOf(rule, headers, rows);
  const isDate = field.type === "date" || field.type === "datetime";

  function chooseSource(value) {
    if (value === "") {
      onChange({ ...NO_RULE });
      return;
    }
    if (value.startsWith("col:")) {
      onChange({ op: "column", column: value.slice(4) });
      return;
    }
    if (value === "constant") {
      onChange({ op: "constant", value: "" });
      return;
    }
    if (value === "concat") {
      onChange({ op: "concat", columns: [], separator: " " });
      return;
    }
    onChange({ op: "split", column: "", separator: " ", index: 0 });
  }

  return (
    <div className="imp-field">
      <div className="imp-field-head">
        <span className="imp-field-name">
          {field.type === undefined ? null : <TypeIcon type={field.type} />}
          {field.name}
          {field.required ? <span className="imp-required">*</span> : null}
          <Help text={field.type === undefined ? field.acepta : acceptedBy(field)} />
        </span>
      </div>

      <div className="imp-field-body">
        <select value={source} onChange={(event) => chooseSource(event.target.value)}>
          <option value="">Dejar vacío</option>
          <option value="constant">Valor fijo</option>
          {headers.map((header, index) => (
            <option value={`col:${header}`} key={`${header}-${index}`}>
              {header === "" ? `(columna ${columnLetter(index)} sin encabezado)` : header}
              {rows.length > 0 && String(rows[0][index] ?? "") !== ""
                ? ` · ej. ${String(rows[0][index])}`
                : ""}
            </option>
          ))}
          <option value="concat">Unir dos columnas</option>
          <option value="split">Una parte de una columna</option>
        </select>

        {rule.op === "constant" ? (
          <FixedValue
            field={field}
            statuses={statuses}
            value={rule.value}
            onChange={(value) => onChange({ ...rule, value: value })}
          />
        ) : null}

        {rule.op === "concat" ? (
          <>
            <select
              value={rule.columns?.[0] ?? ""}
              onChange={(event) =>
                onChange({ ...rule, columns: [event.target.value, rule.columns?.[1] ?? ""] })
              }
            >
              <option value="">Primera columna</option>
              {headers.map((header, index) => (
                <option value={header} key={`a-${header}-${index}`}>
                  {header}
                </option>
              ))}
            </select>
            <select
              value={rule.columns?.[1] ?? ""}
              onChange={(event) =>
                onChange({ ...rule, columns: [rule.columns?.[0] ?? "", event.target.value] })
              }
            >
              <option value="">Segunda columna</option>
              {headers.map((header, index) => (
                <option value={header} key={`b-${header}-${index}`}>
                  {header}
                </option>
              ))}
            </select>
            <input
              className="imp-small"
              value={rule.separator ?? " "}
              onChange={(event) => onChange({ ...rule, separator: event.target.value })}
              aria-label="Qué va entre las dos"
              placeholder="Ej: —"
            />
          </>
        ) : null}

        {rule.op === "split" ? (
          <>
            <select
              value={rule.column ?? ""}
              onChange={(event) => onChange({ ...rule, column: event.target.value })}
            >
              <option value="">Elige una columna</option>
              {headers.map((header, index) => (
                <option value={header} key={`s-${header}-${index}`}>
                  {header}
                </option>
              ))}
            </select>
            <input
              className="imp-small"
              value={rule.separator ?? " "}
              onChange={(event) => onChange({ ...rule, separator: event.target.value })}
              aria-label="Dónde se parte"
              placeholder="Ej: ,"
            />
            <input
              className="imp-small"
              type="number"
              min="0"
              value={rule.index ?? 0}
              onChange={(event) => onChange({ ...rule, index: Number(event.target.value) })}
              aria-label="Qué parte"
            />
          </>
        ) : null}

        {isDate && rule.op === "column" ? (
          <select
            value={rule.format ?? ""}
            onChange={(event) => onChange({ ...rule, format: event.target.value })}
          >
            <option value="">Viene como número de Excel</option>
            {DATE_FORMATS.map((format) => (
              <option value={format} key={format}>
                Escrita {format}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {rule.op && rule.op !== "constant" ? (
        <label className="imp-field-default">
          <span className="imp-label">Si viene vacía…</span>
          <FixedValue
            field={field}
            statuses={statuses}
            value={rule.default}
            onChange={(value) => onChange({ ...rule, default: value })}
          />
        </label>
      ) : null}

      {problem !== null && problem !== undefined ? (
        <p className="imp-field-bad">
          <MdErrorOutline aria-hidden="true" />
          {problem.message ?? String(problem)}
        </p>
      ) : sample === null || sample === "" ? null : (
        <p className="imp-field-sample">
          <MdArrowForward aria-hidden="true" />
          {sample}
        </p>
      )}
    </div>
  );
}

function ImportMapper({ book, onDirty, onSaved, onContinue }) {
  const [formats, setFormatos] = useState([]);
  const [statuses, setEstatus] = useState([]);
  const [versionId, setVersionId] = useState("");
  const [rules, setReglas] = useState({});
  const [hashColumns, setHashColumns] = useState([]);
  const [equivalences, setEquivalencias] = useState({});
  const [headers, setHeaders] = useState([]);
  const [rows, setFilas] = useState([]);
  const [tested, setTested] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setAviso] = useState(null);
  const [busy, setOcupado] = useState(false);
  const [adding, setAgregando] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [{ schemas }, { statuses }, lectura] = await Promise.all([
          api.listSchemas(),
          api.listStatuses(),
          api.previewSpreadsheet(book.id),
        ]);
        if (cancelled) return;

        const usable = schemas.filter((one) => one.isActive && one.fields !== null);
        setFormatos(usable);
        setEstatus(statuses);
        setHeaders(lectura.headers.map((header) => String(header ?? "")));
        setFilas(lectura.rows ?? []);

        const already = usable.find(
          (one) => String(one.schemaVersionId) === String(book.schemaVersionId ?? ""),
        );
        if (already) {
          const initial = rulesOf(fieldsOf(already), book.columnMap ?? {});
          setVersionId(String(already.schemaVersionId));
          setReglas(initial.rules);
          setHashColumns(initial.hashColumns);
          setEquivalencias(initial.equivalences);
        }
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [book.id, book.schemaVersionId, book.columnMap]);

  const format = formats.find((one) => String(one.schemaVersionId) === String(versionId));
  const fields = fieldsOf(format);

  /** Los fields de la solicitud misma, que no salen del format. */
  const requestFields = [
    {
      code: "title",
      name: "Título de la solicitud",
      acepta: "Cualquier texto. Es lo único que una solicitud necesita para existir.",
      required: true,
    },
    {
      code: "requester",
      name: "Entidad solicitante",
      acepta: "El nombre de quien pide, como texto. No hay padrón: es una cadena.",
      required: false,
    },
    {
      code: "status",
      name: "Estatus",
      acepta: "Un estatus del catálogo. Abajo se dice qué valor de la columna es cuál.",
      required: false,
    },
  ];

  function touch() {
    if (onDirty) onDirty(true);
    setAviso(null);
  }

  function chooseVersion(value) {
    touch();
    setVersionId(value);
    setTested(null);

    const chosen = formats.find((one) => String(one.schemaVersionId) === String(value));
    const saved =
      String(book.schemaVersionId ?? "") === String(value) ? (book.columnMap ?? {}) : {};
    const initial = rulesOf(fieldsOf(chosen), saved);
    setReglas(initial.rules);
    setHashColumns(initial.hashColumns);
    setEquivalencias(initial.equivalences);
  }

  function changeRule(target, rule) {
    touch();
    setReglas((actual) => ({ ...actual, [target]: rule }));
  }

  function buildMap() {
    const fields = {};
    for (const field of fields) {
      const rule = cleanRule(rules[field.code]);
      if (rule !== undefined) fields[field.code] = rule;
    }

    const status = cleanRule(rules.status);
    if (status !== undefined && status.op === "column") {
      const table = {};
      for (const [text, code] of Object.entries(equivalences)) {
        if (text !== "" && code !== "") table[text] = code;
      }
      if (Object.keys(table).length > 0) status.map = table;
    }

    return {
      version: 1,
      title: cleanRule(rules.title),
      requester: cleanRule(rules.requester),
      status,
      hashColumns: hashColumns.length > 0 ? hashColumns : undefined,
      fields,
    };
  }

  async function runTest() {
    setOcupado(true);
    setError(null);
    try {
      const result = await api.previewSpreadsheetMapping(book.id, {
        columnMap: buildMap(),
        schemaVersionId: Number(versionId),
      });
      setTested(result);
      setAviso("Las primeras filas se leyeron con este mapeo, sin guardar nada.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  async function save() {
    setOcupado(true);
    setError(null);
    try {
      await api.setSpreadsheetMapping(book.id, {
        schemaVersionId: Number(versionId),
        columnMap: buildMap(),
        headers,
      });
      setAviso("Mapeo guardado. Ya se puede importar el libro.");
      onSaved();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  /** Los valores que la column de statuses trae de verdad, para armar las equivalences solas. */
  const statusValues = (() => {
    if (rules.status?.op !== "column" || !rules.status.column) return [];
    const index = headers.indexOf(rules.status.column);
    if (index === -1) return [];
    return [
      ...new Set(rows.map((row) => String(row[index] ?? "")).filter((text) => text !== "")),
    ];
  })();

  /**
   * The equivalences shown: the ones the column really carries in the sample, plus the ones
   * already saved even if the sample did not reach them. They are derived rather than stored, so
   * changing column does not leave the previous one's behind.
   */
  const equivalenceRows = [
    ...new Set([...statusValues, ...Object.keys(equivalences)]),
  ];

  /** Qué feeds cada column del book, para decirlo al lado. */
  function targetsOfColumn(header) {
    const names = [];
    for (const [target, rule] of Object.entries(rules)) {
      if (!rule || !rule.op) continue;
      const uses =
        (rule.op === "column" && rule.column === header) ||
        (rule.op === "split" && rule.column === header) ||
        (rule.op === "concat" && (rule.columns ?? []).includes(header));
      if (!uses) continue;
      const own = requestFields.find((one) => one.code === target);
      names.push(own?.name ?? fields.find((one) => one.code === target)?.name ?? target);
    }
    return names;
  }

  const fixed = Object.entries(rules).filter(([, rule]) => rule?.op === "constant");
  const notFixedYet = [...requestFields, ...fields].filter(
    (field) => !rules[field.code] || !rules[field.code].op,
  );

  const problems = {};
  if (tested !== null) {
    for (const row of tested.rows) {
      for (const problem of row.errors ?? []) {
        const field = [...requestFields, ...fields].find((one) =>
          String(problem).toLowerCase().includes(one.code.toLowerCase()),
        );
        if (field !== undefined && problems[field.code] === undefined) {
          problems[field.code] = problem;
        }
      }
    }
  }

  const sections = [
    { titulo: "La solicitud", list: requestFields },
    {
      titulo: "Entregables",
      list: fields.filter((field) => field.section === "deliverables"),
    },
    {
      titulo: "Información",
      list: fields.filter((field) => field.section === "information"),
    },
  ];

  return (
    <div className="imp-mapper">
      <div className="imp-mapper-main">
        {error !== null ? <p className="imp-error">{error}</p> : null}
        {notice !== null ? <p className="imp-ok">{notice}</p> : null}

        <section className="imp-sec">
          <div className="imp-grid">
            <label className="imp-field-plain">
              <span className="imp-label">A qué formato se parecen sus filas</span>
              <select value={versionId} onChange={(event) => chooseVersion(event.target.value)}>
                <option value="">Elige un formato</option>
                {formats.map((one) => (
                  <option value={one.schemaVersionId} key={one.id}>
                    {one.name} (v{one.version})
                  </option>
                ))}
              </select>
            </label>

            <label className="imp-field-plain">
              <span className="imp-label">
                Reconocer one row already importada por
                <Help text="Es la identidad de la fila. Una columna Id del formulario es mejor: corregir una errata en la hoja no se lee como una fila nueva. Con todas las columnas mapeadas, cualquier edición posterior entra como una solicitud nueva y se marca como posible duplicado." />
              </span>
              <select
                value={hashColumns[0] ?? ""}
                onChange={(event) => {
                  touch();
                  setHashColumns(event.target.value === "" ? [] : [event.target.value]);
                }}
              >
                <option value="">Todas las columnas mapeadas</option>
                {headers.map((header, index) => (
                  <option value={header} key={`h-${header}-${index}`}>
                    La column {header}
                    {header.toLowerCase() === "id" ? " (recomendado)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {versionId === "" ? (
          <p className="imp-note">Elige un formato y aparecerán sus campos.</p>
        ) : (
          <>
            <section className="imp-sec imp-fixed">
              <h3>
                Para todo el book
                <Help text="Valores que este libro da igual a todas sus filas, porque no tiene columna para ellos. Se escriben una vez aquí." />
              </h3>

              <div className="imp-chips">
                {fixed.map(([target, rule]) => {
                  const field =
                    requestFields.find((one) => one.code === target) ??
                    fields.find((one) => one.code === target);
                  return (
                    <span className="imp-chip" key={target}>
                      {field?.name ?? target} <b>{String(rule.value ?? "")}</b>
                      <button
                        type="button"
                        onClick={() => changeRule(target, { ...NO_RULE })}
                        aria-label="Quitar"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}

                <select
                  className="imp-add"
                  value={adding}
                  onChange={(event) => {
                    const target = event.target.value;
                    if (target === "") return;
                    changeRule(target, { op: "constant", value: "" });
                    setAgregando("");
                  }}
                >
                  <option value="">Agregar un dato con valor fijo…</option>
                  {notFixedYet.map((field) => (
                    <option value={field.code} key={field.code}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {sections.map((section) =>
              section.list.length === 0 ? null : (
                <section className="imp-sec" key={section.titulo}>
                  <h3>{section.titulo}</h3>
                  <div className="imp-fields">
                    {section.list.map((field) => (
                      <MappedField
                        field={field}
                        rule={rules[field.code] ?? NO_RULE}
                        headers={headers}
                        rows={rows}
                        statuses={statuses}
                        problem={problems[field.code]}
                        onChange={(rule) => changeRule(field.code, rule)}
                        key={field.code}
                      />
                    ))}
                  </div>
                </section>
              ),
            )}

            {statusValues.length > 0 ? (
              <section className="imp-sec">
                <h3>Qué estatus es cada valor de la columna</h3>
                <p className="imp-note">
                  Estos son los valores que la columna «{rules.status.column}» trae en las
                  primeras rows.
                </p>
                <div className="imp-equiv">
                  {equivalenceRows.map((text) => (
                    <label className="imp-field-plain" key={text}>
                      <span className="imp-label">«{text}»</span>
                      <select
                        value={equivalences[text] ?? ""}
                        onChange={(event) => {
                          touch();
                          const code = event.target.value;
                          setEquivalencias((actual) => ({ ...actual, [text]: code }));
                        }}
                      >
                        <option value="">Sin equivalencia</option>
                        {statuses.map((one) => (
                          <option value={one.code} key={one.id}>
                            {one.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}

                  <label className="imp-field-plain">
                    <span className="imp-label">Cualquier otro</span>
                    <select
                      value={rules.status.default ?? ""}
                      onChange={(event) =>
                        changeRule("status", {
                          ...rules.status,
                          default: event.target.value,
                        })
                      }
                    >
                      <option value="">Sin equivalencia</option>
                      {statuses.map((one) => (
                        <option value={one.code} key={one.id}>
                          {one.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            ) : null}
          </>
        )}

        <footer className="imp-foot">
          <p className="imp-note">Probar y guardar no escriben nada en el libro.</p>
          <div className="imp-foot-right">
            <button
              className="imp-btn"
              type="button"
              onClick={runTest}
              disabled={busy || versionId === ""}
            >
              {busy ? "Leyendo…" : "Probar con las primeras filas"}
            </button>
            <button
              className="imp-btn is-primary"
              type="button"
              onClick={save}
              disabled={busy || versionId === ""}
            >
              Guardar el mapeo
            </button>
            {book.mapped ? (
              <button className="imp-quiet" type="button" onClick={onContinue}>
                Seguir a la prueba →
              </button>
            ) : null}
          </div>
        </footer>
      </div>

      <aside className="imp-columns">
        <h3>Columnas del libro</h3>
        <ul>
          {headers.map((header, index) => {
            const feeds = targetsOfColumn(header);
            const sample = rows.length > 0 ? String(rows[0][index] ?? "") : "";
            return (
              <li key={`${header}-${index}`}>
                <span className="imp-col-letter">{columnLetter(index)}</span>
                <span className="imp-col-name">
                  {header === "" ? "(sin encabezado)" : header}
                  {sample === "" ? null : <span className="imp-col-sample">ej. {sample}</span>}
                </span>
                <span className={feeds.length === 0 ? "imp-col-free" : "imp-col-used"}>
                  {feeds.length === 0 ? (
                    "sin usar · se guarda tal cual"
                  ) : (
                    <>
                      <MdArrowForward aria-hidden="true" />
                      {feeds.join(", ")}
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}

export default ImportMapper;
