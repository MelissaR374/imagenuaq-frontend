// Importing from Excel: what a book's columns mean and how its rows become requests (RF-MIG-02).
//
// Registering a book happens once and lives in "Libros de Excel"; routing the requests happens
// afterwards and lives in the inbox. What is left here are the three steps that really belong to
// this screen: the mapping, the test and the import.
//
// A book opens at full screen because the mapping is read against the book's columns, and with the
// list above them the two did not fit.
import { useEffect, useState } from "react";
import { MdCheckCircle, MdErrorOutline, MdWarningAmber } from "react-icons/md";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import ImportMapper from "./importMapper.jsx";
import ImportRun from "./importRun.jsx";
import "./importConfig.css";

const STEPS = [
  { key: "mapeo", label: "Mapeo" },
  { key: "prueba", label: "Prueba" },
  { key: "importacion", label: "Importación" },
];

/** Where a book stands, in one sentence. */
function bookState(book) {
  if (book.accountRevoked) {
    return {
      text: "No se puede leer: la cuenta está desconectada",
      className: "is-bad",
      Symbol: MdErrorOutline,
    };
  }
  if (!book.mapped) {
    return { text: "Falta el mapeo", className: "is-pending", Symbol: MdWarningAmber };
  }
  return { text: "Mapeado, listo para importar", className: "is-ready", Symbol: MdCheckCircle };
}

/** When the last import ran and how it went. */
function lastImport(book) {
  if (book.lastImport === null) {
    if (book.markedRows > 0) {
      return `${book.markedRows} filas marcadas como ya atendidas`;
    }
    return "Nunca se ha importado";
  }
  return `${shortDate(book.lastImport.finishedAt)} · ${book.lastImport.created} ${
    book.lastImport.created === 1 ? "nueva" : "nuevas"
  }`;
}

function ImportConfig({ onGo = null }) {
  const [books, setLibros] = useState([]);
  const [opened, setAbierto] = useState(null);
  const [step, setPaso] = useState("mapeo");
  const [loading, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reloads, setRecarga] = useState(0);
  const [dirty, setSucio] = useState(false);
  const [leaving, setSaliendo] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setCargando(true);
      try {
        const response = await api.listSpreadsheets();
        if (!cancelled) setLibros(response.sheets);
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
  }, [reloads]);

  function reload() {
    setRecarga((actual) => actual + 1);
  }

  /** Salir del mapeo con cambios sin guardar pregunta antes, en lugar de tirarlos. */
  function tryToGo(target) {
    if (step === "mapeo" && dirty) {
      setSaliendo(target);
      return;
    }
    goTo(target);
  }

  function goTo(target) {
    setSaliendo(null);
    setSucio(false);
    if (target === null) {
      setAbierto(null);
      reload();
      return;
    }
    setPaso(target);
  }

  if (loading) {
    return <p className="imp-note">Cargando…</p>;
  }

  if (opened !== null) {
    const book = books.find((one) => one.id === opened.id) ?? opened;

    return (
      <section className="imp-full">
        <header className="imp-bar">
          <button
            className="imp-close"
            type="button"
            onClick={() => tryToGo(null)}
            aria-label="Volver a la lista"
          >
            ✕
          </button>

          <div className="imp-bar-text">
            <span className="imp-eyebrow">
              {book.tableName === null ? "Hoja" : `Tabla · ${book.tableName}`}
            </span>
            <h2>{book.name}</h2>
          </div>

          <ol className="imp-steps">
            {STEPS.map((one, index) => (
              <li key={one.key}>
                <button
                  className={one.key === step ? "imp-step is-now" : "imp-step"}
                  type="button"
                  onClick={() => tryToGo(one.key)}
                  disabled={one.key !== "mapeo" && !book.mapped}
                >
                  {index + 1}. {one.label}
                </button>
              </li>
            ))}
          </ol>
        </header>

        {leaving !== null ? (
          <div className="imp-leaving">
            <p>El mapeo tiene cambios sin guardar.</p>
            <div className="imp-action-row">
              <button className="imp-quiet" type="button" onClick={() => setSaliendo(null)}>
                Quedarme en el mapeo
              </button>
              <button className="imp-btn" type="button" onClick={() => goTo(leaving)}>
                Descartar los cambios
              </button>
            </div>
          </div>
        ) : null}

        <div className="imp-body">
          {step === "mapeo" ? (
            <ImportMapper
              book={book}
              onDirty={setSucio}
              onSaved={() => {
                setSucio(false);
                reload();
              }}
              onContinue={() => tryToGo("prueba")}
            />
          ) : (
            <ImportRun book={book} step={step} onChanged={reload} onGo={onGo} />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="imp">
      {error !== null ? <p className="imp-error">{error}</p> : null}

      <p className="imp-count">
        {books.length} {books.length === 1 ? "libro registrado" : "libros registrados"}
      </p>

      <div className="imp-table-wrap">
        <table className="imp-table">
          <thead>
            <tr>
              <th>Libro</th>
              <th>Formato</th>
              <th>En qué va</th>
              <th>Última importación</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => {
              const state = bookState(book);
              return (
                <tr
                  className={state.className === "is-bad" ? "imp-row is-stale" : "imp-row"}
                  onClick={() => {
                    setAbierto(book);
                    setPaso(book.mapped ? "importacion" : "mapeo");
                  }}
                  key={book.id}
                >
                  <td className="imp-cell-main">
                    <span className="imp-kind">
                      {book.tableName === null ? "Hoja" : `Tabla · ${book.tableName}`}
                    </span>
                    <span className="imp-row-name">{book.name}</span>
                  </td>
                  <td>
                    {book.mapped ? (
                      `${book.schemaName} v${book.schemaVersion}`
                    ) : (
                      <span className="imp-off">Sin formato</span>
                    )}
                  </td>
                  <td>
                    <span className={`imp-state ${state.className}`}>
                      <state.Symbol aria-hidden="true" />
                      {state.text}
                    </span>
                  </td>
                  <td>{lastImport(book)}</td>
                </tr>
              );
            })}

            {books.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <p className="imp-empty">
                    No hay libros registrados. Se dan de alta en «Libros de Excel», con la cuenta
                    con la que se van a leer; aquí se decide qué significan sus columnas.
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

export default ImportConfig;
