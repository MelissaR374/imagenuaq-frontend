// Testing and importing a book (RF-MIG-01).
//
// Rows are independent: one that cannot be read is reported with its row number and its reason,
// and the rest go in. A row that was already imported is recognised by its hash and skipped, so
// importing twice duplicates nothing.
//
// The test writes nothing, and the import never writes into the book: what moves is this side. The
// imported rows arrive with no area and no flow, in the inbox's "Sin flujo" tab, which is where
// somebody decides what they go through.
import { Fragment, useEffect, useState } from "react";
import {
  MdCheckCircle,
  MdErrorOutline,
  MdRemoveCircleOutline,
  MdWarningAmber,
} from "react-icons/md";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import Help from "../shared/help.jsx";
import "./importConfig.css";

/**
 * A test row's verdict, with its symbol. A row that is only missing a required value does come in:
 * the request is born incomplete, and what is refused later is turning it into a project.
 */
function verdict(row) {
  if (row.alreadyImported) {
    return { text: "Ya se importó; se omite", className: "is-skip", Symbol: MdRemoveCircleOutline };
  }
  if (!row.ok) {
    return { text: "No se puede importar", className: "is-bad", Symbol: MdErrorOutline };
  }
  if ((row.warnings ?? []).length > 0) {
    return {
      text: "Se puede importar, pero entra incompleta",
      className: "is-warn",
      Symbol: MdWarningAmber,
    };
  }
  return { text: "Se puede importar", className: "is-ok", Symbol: MdCheckCircle };
}

/** One row of the test, which opens to show its values already read. */
function TestRow({ row, fields }) {
  const [isOpen, setAbierta] = useState(false);
  const mark = verdict(row);

  return (
    <li className={`imp-try ${mark.className}`}>
      <button className="imp-try-head" type="button" onClick={() => setAbierta(!isOpen)}>
        <span className="imp-try-row">Fila {row.index + 2}</span>
        <span className="imp-try-title">{row.title ?? "Sin título"}</span>
        <span className="imp-try-verdict">
          <mark.Symbol aria-hidden="true" />
          {mark.text}
        </span>
      </button>

      {row.errors?.length > 0 ? (
        <ul className="imp-try-errors">
          {row.errors.map((problem, index) => (
            <li key={index}>{problem.message ?? String(problem)}</li>
          ))}
        </ul>
      ) : null}

      {row.errors?.length === 0 && row.warnings?.length > 0 ? (
        <ul className="imp-try-warnings">
          {row.warnings.map((warning, index) => (
            <li key={index}>{warning.message ?? String(warning)}</li>
          ))}
        </ul>
      ) : null}

      {isOpen ? (
        <dl className="imp-try-values">
          <dt>Título</dt>
          <dd>{row.title ?? "—"}</dd>
          <dt>Entidad solicitante</dt>
          <dd>{row.requester ?? "—"}</dd>
          <dt>Estatus</dt>
          <dd>{row.statusCode ?? "el de siempre"}</dd>
          {fields.map((field) => (
            <Fragment key={field.code}>
              <dt>{field.name}</dt>
              <dd>{String(row.data?.[field.code] ?? "—")}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function ImportRun({ book, step, onChanged, onGo = null }) {
  const [fields, setCampos] = useState([]);
  const [test, setPrueba] = useState(null);
  const [count, setConteo] = useState(null);
  const [result, setResultado] = useState(null);
  const [history, setHistoria] = useState([]);
  const [confirming, setConfirmando] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setOcupado] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      try {
        if (book.schemaVersionId !== null) {
          const { version } = await api.getSchemaVersion(book.schemaVersionId);
          if (!cancelled) {
            setCampos([...version.fields.deliverables, ...version.fields.information]);
          }
        }

        if (step === "prueba") {
          const testResult = await api.previewSpreadsheetMapping(book.id, {});
          if (!cancelled) setPrueba(testResult);
        } else {
          const [{ import: run }, { imports }] = await Promise.all([
            api.importSpreadsheet(book.id, { dryRun: true }),
            api.listSpreadsheetImports(book.id),
          ]);
          if (!cancelled) {
            setConteo(run);
            setHistoria(imports);
          }
        }
      } catch (fallo) {
        if (!cancelled) setError(fallo.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [book.id, book.schemaVersionId, step]);

  async function run(accion) {
    setOcupado(true);
    setError(null);
    try {
      return await accion();
    } catch (fallo) {
      setError(fallo.message);
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function runImport() {
    const response = await run(() => api.importSpreadsheet(book.id, {}));
    if (response === null) return;
    setResultado(response.import);
    setConfirmando(null);
    const [{ import: run }, { imports }] = await Promise.all([
      api.importSpreadsheet(book.id, { dryRun: true }),
      api.listSpreadsheetImports(book.id),
    ]);
    setConteo(run);
    setHistoria(imports);
    onChanged();
  }

  async function markRows() {
    const response = await run(() => api.markSpreadsheetRows(book.id, {}));
    if (response === null) return;
    setConfirmando(null);
    const { import: run } = await api.importSpreadsheet(book.id, { dryRun: true });
    setConteo(run);
    onChanged();
  }

  async function clearMarks() {
    const response = await run(() => api.clearSpreadsheetMarks(book.id));
    if (response === null) return;
    setConfirmando(null);
    const { import: run } = await api.importSpreadsheet(book.id, { dryRun: true });
    setConteo(run);
    onChanged();
  }

  if (error !== null && test === null && count === null) {
    return <p className="imp-error">{error}</p>;
  }

  if (step === "prueba") {
    if (test === null) {
      return <p className="imp-note">Leyendo las primeras filas…</p>;
    }

    const willEnter = test.rows.filter((row) => row.ok && !row.alreadyImported).length;
    const alreadyIn = test.rows.filter((row) => row.alreadyImported).length;
    const failing = test.rows.filter((row) => !row.ok).length;

    return (
      <section className="imp-sec">
        <h3>Así quedarían las primeras filas</h3>
        <ul className="imp-tally">
          <li className="is-ok">
            <MdCheckCircle aria-hidden="true" />
            {willEnter} {willEnter === 1 ? "se puede importar" : "se pueden importar"}
          </li>
          <li className="is-skip">
            <MdRemoveCircleOutline aria-hidden="true" />
            {alreadyIn} {alreadyIn === 1 ? "ya se importó" : "ya se importaron"}
          </li>
          <li className="is-bad">
            <MdErrorOutline aria-hidden="true" />
            {failing} {failing === 1 ? "no se puede importar" : "no se pueden importar"}
          </li>
        </ul>
        <p className="imp-note">Esto no escribe nada, ni aquí ni en el libro.</p>

        {error !== null ? <p className="imp-error">{error}</p> : null}

        <ul className="imp-tries">
          {test.rows.map((row) => (
            <TestRow row={row} fields={fields} key={row.index} />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <>
      <section className="imp-sec">
        {count === null ? (
          <p className="imp-note">Contando las filas nuevas…</p>
        ) : (
          <>
            <h3>
              {count.rowsCreated === 0
                ? "No hay filas nuevas"
                : `Hay ${count.rowsCreated} ${
                    count.rowsCreated === 1 ? "row nueva" : "filas nuevas"
                  }`}
            </h3>
            <p className="imp-note">
              El book tiene {count.rowsRead}{" "}
              {count.rowsRead === 1 ? "fila" : "filas"} en total; {count.rowsSkipped}{" "}
              {count.rowsSkipped === 1 ? "ya se importó" : "ya se importaron"}
              {count.rowsFailed > 0
                ? ` y ${count.rowsFailed} ${
                    count.rowsFailed === 1 ? "no se puede leer" : "no se pueden leer"
                  }`
                : ""}
              .
            </p>

            {error !== null ? <p className="imp-error">{error}</p> : null}

            <div className="imp-action-row">
              <button
                className="imp-btn"
                type="button"
                onClick={async () => {
                  const response = await run(() =>
                    api.importSpreadsheet(book.id, { dryRun: true }),
                  );
                  if (response !== null) setConteo(response.import);
                }}
                disabled={busy}
              >
                Simular la importación
              </button>
              <button
                className="imp-btn is-primary"
                type="button"
                onClick={runImport}
                disabled={busy || count.rowsCreated === 0}
              >
                {busy
                  ? "Importando…"
                  : `Importar ${count.rowsCreated} ${
                      count.rowsCreated === 1 ? "row nueva" : "filas nuevas"
                    }`}
              </button>
            </div>
          </>
        )}
      </section>

      {result !== null ? (
        <section className="imp-sec">
          <h3>Lo que entró</h3>
          <p className="imp-note">
            Se crearon {result.rowsCreated}{" "}
            {result.rowsCreated === 1 ? "solicitud" : "solicitudes"}, se omitieron{" "}
            {result.rowsSkipped} que ya estaban
            {result.rowsFailed > 0 ? ` y ${result.rowsFailed} no se pudieron leer` : ""}.
            {result.rowsFlagged > 0
              ? ` ${result.rowsFlagged} quedaron marcadas como posible duplicado.`
              : ""}
          </p>

          {result.errors?.length > 0 ? (
            <ul className="imp-try-errors">
              {result.errors.map((problem, index) => (
                <li key={index}>
                  Fila {(problem.index ?? 0) + 2}: {problem.message}
                </li>
              ))}
            </ul>
          ) : null}

          {onGo !== null && result.rowsCreated > 0 ? (
            <button
              className="imp-quiet"
              type="button"
              onClick={() => onGo("Bandeja de solicitudes")}
            >
              Ver las solicitudes nuevas en la bandeja →
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="imp-sec imp-baseline">
        <h3>
          ¿Las filas actuales ya se atendieron?
          <Help text="Marcarlas no crea solicitudes: deja constancia de que ya se atendieron fuera del sistema, para que la siguiente importación solo traiga lo que llegue de aquí en adelante." />
        </h3>

        {book.markedRows > 0 ? (
          <p className="imp-note">
            Hay {book.markedRows} filas marcadas como ya atendidas.
          </p>
        ) : null}

        <div className="imp-action-row">
          {confirming === "marcar" ? (
            <>
              <span className="imp-confirm">
                Las filas que el libro tiene hoy dejarán de contar como nuevas y no se creará
                ninguna solicitud con ellas.
              </span>
              <button className="imp-btn" type="button" onClick={markRows} disabled={busy}>
                Marcarlas
              </button>
              <button className="imp-quiet" type="button" onClick={() => setConfirmando(null)}>
                Cancelar
              </button>
            </>
          ) : confirming === "desmarcar" ? (
            <>
              <span className="imp-confirm">
                Las {book.markedRows} filas marcadas volverán a contar como nuevas y entrarán
                como solicitudes en la próxima importación.
              </span>
              <button className="imp-btn" type="button" onClick={clearMarks} disabled={busy}>
                Quitar las marcas
              </button>
              <button className="imp-quiet" type="button" onClick={() => setConfirmando(null)}>
                Dejarlas
              </button>
            </>
          ) : (
            <>
              <button
                className="imp-btn"
                type="button"
                onClick={() => setConfirmando("marcar")}
                disabled={busy}
              >
                Marcar las filas de hoy como ya atendidas
              </button>
              {book.markedRows > 0 ? (
                <button
                  className="imp-quiet"
                  type="button"
                  onClick={() => setConfirmando("desmarcar")}
                >
                  Quitar las marcas
                </button>
              ) : null}
            </>
          )}
        </div>
      </section>

      {history.length === 0 ? null : (
        <details className="imp-history">
          <summary>Importaciones anteriores ({history.length})</summary>
          <ul>
            {history.map((run) => (
              <li key={run.id}>
                <span className="imp-label">
                  {shortDate(run.finishedAt ?? run.startedAt)}
                  {run.runByName === null ? "" : ` · ${run.runByName}`}
                </span>
                Se crearon {run.rowsCreated}, se omitieron {run.rowsSkipped}
                {run.rowsFailed > 0 ? `, ${run.rowsFailed} no se pudieron leer` : ""}.
                {run.errors?.length > 0 ? (
                  <details>
                    <summary>Por qué no entraron</summary>
                    <ul className="imp-try-errors">
                      {run.errors.map((problem, index) => (
                        <li key={index}>
                          Fila {(problem.index ?? 0) + 2}: {problem.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export default ImportRun;
