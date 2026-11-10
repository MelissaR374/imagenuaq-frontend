// One workbook's setup and import: its columns, a preview and the import itself (RF-MIG-02).
//
// "Libros de Excel" opens it from a book's row. It fills the screen because the columns are read
// against the book's own columns, and with the list above them the two did not fit.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import ImportMapper from "./importMapper.jsx";
import ImportRun from "./importRun.jsx";
import "./importConfig.css";

const STEPS = [
  { key: "mapeo", label: "Columnas" },
  { key: "prueba", label: "Revisar" },
  { key: "importacion", label: "Importar" },
];

function ImportConfig({ book: first, onClose, onGo = null }) {
  const [books, setLibros] = useState([]);
  const [step, setPaso] = useState(first.mapped ? "importacion" : "mapeo");
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
      setSaliendo({ target });
      return;
    }
    goTo(target);
  }

  function goTo(target) {
    setSaliendo(null);
    setSucio(false);
    if (target === null) {
      onClose();
      return;
    }
    setPaso(target);
  }

  if (loading) {
    return <p className="imp-note">Cargando…</p>;
  }

  const book = books.find((one) => one.id === first.id) ?? first;

  return (
    <section className="imp-full">
      <header className="imp-bar">
        <button
          className="imp-close"
          type="button"
          onClick={() => tryToGo(null)}
          aria-label="Volver a mis libros"
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
          <p>Hiciste cambios que todavía no se han guardado.</p>
          <div className="imp-action-row">
            <button className="imp-quiet" type="button" onClick={() => setSaliendo(null)}>
              Seguir editando
            </button>
            <button className="imp-btn" type="button" onClick={() => goTo(leaving.target)}>
              Salir sin guardar
            </button>
          </div>
        </div>
      ) : null}

      {error !== null ? <p className="imp-error">{error}</p> : null}

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

export default ImportConfig;
