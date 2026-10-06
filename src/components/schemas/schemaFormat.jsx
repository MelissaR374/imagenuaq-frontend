// A format opened at full screen: building its fields (RF-SOL-01) with the capture form beside
// it, because a format is a builder and the only thing that says whether it is right is how it is
// going to look.
//
// It is two sections and each one an array: `deliverables` is what has to be produced,
// `information` what has to be declared. The fields are a list, not a table of inputs: one row per
// field with its name, its key and its type, and the editor opens in its place.
//
// The `code` is the key the value is stored under, and the one the label, the print order and the
// invoicing read it by, so it is snake_case and unique across both sections.
//
// **A key that already exists is reused, not redefined.** Choosing one from the vocabulary
// (`GET /api/schemas/field-keys`) fills the name and the type and leaves them firm, because the
// value is stored under that key across the whole system, and if it were another type here the
// project would end up with two different things under one name. The server refuses to publish it
// with another type, so showing it here is what saves the trip.
//
// A field's key is suggested from its name until somebody touches it: suggesting only while it was
// empty left `c` when typing "Contacto".
//
// Publishing creates the next version and does not touch the previous one: the footer says so in
// this format's own numbers, which is the only way for the warning to mean anything.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { shortDate } from "../shared/format.js";
import Help from "../shared/help.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import TypeIcon from "../shared/typeIcon.jsx";
import "./schemaFormat.css";

const SECTIONS = [
  {
    key: "deliverables",
    titulo: "Entregables",
    ayuda: "Lo que el área tiene que producir",
  },
  {
    key: "information",
    titulo: "Información",
    ayuda: "Lo que el solicitante declara",
  },
];

const EMPTY_FIELD = { code: "", name: "", type: "text", note: "", required: false };

/** A name into a proposed key: no accents, lower case, underscores. */
function suggestedKey(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

/**
 * Why a field's name and type come from somewhere else. The key is shared vocabulary
 * (DATAMODEL.md §2.13b): it already has captured values under it, so changing them would make what
 * was captured a lie. It can be reused; it cannot be redefined.
 */
function reuseText(published) {
  const usedIn = published.schemas ?? [];
  if (usedIn.length === 0) {
    return "Esta clave ya se publicó antes: su nombre y su tipo vienen de ahí.";
  }
  return `Dato compartido con ${usedIn.join(", ")}: su nombre y su tipo vienen de ahí.`;
}

/** A field's editor, opened in place inside the list. */
function FieldEditor({
  field, types, published, repeated, suggestions, listId, onChange, onRemove, onClose,
}) {
  const [keyTouched, setClaveTocada] = useState(field.code !== "");

  function writeName(name) {
    if (published !== undefined) {
      return;
    }
    const changes = { name };
    if (!keyTouched) {
      changes.code = suggestedKey(name);
    }
    onChange(changes);
  }

  return (
    <div className="format-field-editor">
      <div className="format-grid">
        <label className="format-field">
          <span className="format-label">Nombre</span>
          <input
            value={field.name}
            onChange={(event) => writeName(event.target.value)}
            readOnly={published !== undefined}
            placeholder="Ej: Medidas del impreso"
          />
        </label>

        <label className="format-field">
          <span className="format-label">
            Clave
            <Help text="Con esta clave se guarda el valor en todo el sistema, y con ella lo leen la orden de impresión y la facturación. Se sugiere desde el nombre hasta que la escribas tú." />
          </span>
          <input
            className={repeated ? "format-key is-bad" : "format-key"}
            value={field.code}
            list={listId}
            onChange={(event) => {
              const code = event.target.value;
              setClaveTocada(true);
              const existing = suggestions.find((one) => one.key === code);
              onChange(
                existing === undefined
                  ? { code }
                  : {
                      code,
                      name: existing.name,
                      type: existing.type,
                      note: existing.note ?? "",
                    },
              );
            }}
            placeholder="Ej: medidas"
          />
          <datalist id={listId}>
            {suggestions.map((one) => (
              <option value={one.key} key={one.key}>
                {one.name} · {types.find((type) => type.code === one.type)?.name ?? one.type}
              </option>
            ))}
          </datalist>
        </label>

        <label className="format-field">
          <span className="format-label">
            Tipo de dato
            {published === undefined ? null : (
              <Help text={reuseText(published)} />
            )}
          </span>
          {published === undefined ? (
            <select
              value={field.type}
              onChange={(event) => onChange({ type: event.target.value })}
            >
              {types.map((type) => (
                <option value={type.code} key={type.code}>
                  {type.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="format-value">
              <TypeIcon type={field.type} />{" "}
              {types.find((type) => type.code === field.type)?.name ?? field.type}
            </p>
          )}
        </label>

        <label className="format-field">
          <span className="format-label">
            Indicación
            <Help text="Lo que aparece en el (?) del campo al capturar. No se muestra como texto corrido." />
          </span>
          <input
            value={field.note ?? ""}
            onChange={(event) => onChange({ note: event.target.value })}
            placeholder="Ej: en centímetros, ancho por alto"
          />
        </label>

        <label className="format-check">
          <input
            type="checkbox"
            checked={field.required === true}
            onChange={(event) => onChange({ required: event.target.checked })}
          />
          Obligatorio
        </label>
      </div>

      {repeated ? (
        <p className="format-bad">
          Esa key ya la tiene otro field de este format. Cada field necesita one distinta,
          también entre secciones: el valor se guarda bajo su clave y dos campos la pisarían.
        </p>
      ) : null}

      {published === undefined ? null : (
        <p className="format-note">{reuseText(published)}</p>
      )}

      <div className="format-action-row">
        <button className="format-quiet is-danger" type="button" onClick={onRemove}>
          Quitar el field
        </button>
        <button className="format-quiet" type="button" onClick={onClose}>
          Listo
        </button>
      </div>
    </div>
  );
}

function SchemaFormat({ format, formats, types, vocabulary, onChanged, onClose }) {
  const publishedKeys = new Map(vocabulary.map((one) => [one.key, one]));

  const [fields, setCampos] = useState(
    format?.fields ?? { deliverables: [], information: [] },
  );
  const [draftFormat, setNuevo] = useState({ code: "", name: "", startFrom: "" });
  const [keyTouched, setClaveTocada] = useState(false);
  const [editing, setEditando] = useState(null);
  const [versions, setVersiones] = useState([]);
  const [cloning, setClonando] = useState(null);
  const [confirmingDeactivate, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setOcupado] = useState(false);

  const isNew = format === null || format === undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadVersions() {
      if (isNew) {
        return;
      }
      try {
        const { versions } = await api.listSchemaVersions(format.id);
        if (!cancelled) setVersiones(versions);
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }

    loadVersions();
    return () => {
      cancelled = true;
    };
  }, [isNew, format?.id, format?.version]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function changeField(section, index, changes) {
    setCampos((actual) => ({
      ...actual,
      [section]: actual[section].map((field, i) =>
        i === index ? { ...field, ...changes } : field,
      ),
    }));
  }

  function addField(section, base = EMPTY_FIELD) {
    setCampos((actual) => {
      const list = [...actual[section], { ...base }];
      setEditando({ section, index: list.length - 1 });
      return { ...actual, [section]: list };
    });
  }

  function removeField(section, index) {
    setCampos((actual) => ({
      ...actual,
      [section]: actual[section].filter((_, i) => i !== index),
    }));
    setEditando(null);
  }

  function move(section, index, salto) {
    const target = index + salto;
    setCampos((actual) => {
      const list = [...actual[section]];
      if (target < 0 || target >= list.length) return actual;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...actual, [section]: list };
    });
    setEditando(null);
  }

  /** Partir de otro format: sus fields entran tal cual, con sus keys compartidas. */
  function startFrom(id) {
    setNuevo((actual) => ({ ...actual, startFrom: id }));
    if (id === "") {
      setCampos({ deliverables: [], information: [] });
      return;
    }
    const base = formats.find((one) => String(one.id) === String(id));
    if (base !== undefined && base.fields !== null) {
      setCampos({
        deliverables: base.fields.deliverables.map((field) => ({ ...field })),
        information: base.fields.information.map((field) => ({ ...field })),
      });
    }
  }

  const everyField = [...fields.deliverables, ...fields.information];
  const keys = everyField.map((field) => field.code);
  const repeatedKeys = [...new Set(keys.filter((code, i) => code !== "" && keys.indexOf(code) !== i))];

  let problem = null;
  if (everyField.length === 0) {
    problem = "Un formato necesita al menos un campo.";
  } else if (everyField.some((field) => field.name.trim() === "" || field.code.trim() === "")) {
    problem = "Hay un campo sin nombre o sin clave.";
  } else if (repeatedKeys.length > 0) {
    problem = `Clave repetida: ${repeatedKeys.join(", ")}.`;
  } else if (isNew && (draftFormat.name.trim() === "" || draftFormat.code.trim() === "")) {
    problem = "El formato necesita un nombre y una clave.";
  }

  const savedFields = JSON.stringify(format?.fields ?? { deliverables: [], information: [] });
  const dirty = JSON.stringify(fields) !== savedFields;
  const next = isNew ? 1 : (format.version ?? 0) + 1;

  async function publish() {
    setOcupado(true);
    setError(null);
    try {
      if (isNew) {
        const { schema } = await api.createSchema({
          code: draftFormat.code,
          name: draftFormat.name,
          fields: fields,
        });
        onChanged(schema.id);
      } else {
        await api.createSchemaVersion(format.id, fields);
        onChanged(format.id);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  async function clone(event) {
    event.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      const { schema } = await api.cloneSchema(format.id, cloning.code, cloning.name);
      setClonando(null);
      onChanged(schema.id);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  async function toggleActive() {
    setOcupado(true);
    setError(null);
    try {
      if (format.isActive) {
        await api.deleteSchema(format.id);
      } else {
        await api.updateSchema(format.id, { isActive: true });
      }
      setConfirmandoBaja(false);
      onChanged(format.id);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="format-full">
      <header className="format-bar">
        <button
          className="format-close"
          type="button"
          onClick={onClose}
          aria-label="Volver a la lista"
        >
          ✕
        </button>

        <div className="format-bar-text">
          <span className="format-bar-eyebrow">
            {isNew ? "Formato nuevo" : format.code}
            {isNew || format.isActive ? "" : " · inactivo"}
          </span>
          <h2>{isNew ? draftFormat.name || "Sin nombre todavía" : format.name}</h2>
        </div>

        {isNew ? null : (
          <div className="format-bar-actions">
            <button
              className="format-quiet"
              type="button"
              onClick={() =>
                setClonando({ code: "", name: `${format.name} (copia)` })
              }
              disabled={busy}
            >
              Clonar como format draftFormat
            </button>

            {confirmingDeactivate ? (
              <>
                <span className="format-confirm">
                  Deja de ofrecerse al capturar. Lo capturado con él se sigue leyendo, y se puede
                  reactivar.
                </span>
                <button
                  className="format-btn"
                  type="button"
                  onClick={toggleActive}
                  disabled={busy}
                >
                  Desactivar
                </button>
                <button
                  className="format-quiet"
                  type="button"
                  onClick={() => setConfirmandoBaja(false)}
                >
                  Dejarlo
                </button>
              </>
            ) : (
              <button
                className="format-quiet"
                type="button"
                onClick={() => (format.isActive ? setConfirmandoBaja(true) : toggleActive())}
                disabled={busy}
              >
                {format.isActive ? "Desactivar" : "Reactivar"}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="format-body">
        {error !== null ? <p className="format-error">{error}</p> : null}

        {cloning !== null ? (
          <form className="format-clone" onSubmit={clone}>
            <h3>Clonar como formato nuevo</h3>
            <p className="format-note">
              El formato nuevo empieza con los campos de este, en su versión 1. Este no se toca.
            </p>
            <div className="format-grid">
              <label className="format-field">
                <span className="format-label">Nombre</span>
                <input
                  value={cloning.name}
                  onChange={(event) => setClonando({ ...cloning, name: event.target.value })}
                  required
                />
              </label>
              <label className="format-field">
                <span className="format-label">Clave</span>
                <input
                  className="format-key"
                  value={cloning.code}
                  onChange={(event) => setClonando({ ...cloning, code: event.target.value })}
                  placeholder="Ej: papel_fcq"
                  required
                />
              </label>
            </div>
            <div className="format-action-row">
              <button className="format-quiet" type="button" onClick={() => setClonando(null)}>
                Cancelar
              </button>
              <button className="format-btn is-primary" type="submit" disabled={busy}>
                Clonar
              </button>
            </div>
          </form>
        ) : null}

        {isNew ? (
          <section className="format-sec">
            <h3>El formato</h3>
            <div className="format-grid">
              <label className="format-field">
                <span className="format-label">Nombre</span>
                <input
                  value={draftFormat.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setNuevo((actual) => ({
                      ...actual,
                      name,
                      code: keyTouched ? actual.code : suggestedKey(name),
                    }));
                  }}
                  placeholder="Ej: Papelería institucional"
                  required
                />
              </label>

              <label className="format-field">
                <span className="format-label">
                  Clave
                  <Help text="Identifica el formato en el sistema y no se cambia después. Se sugiere desde el nombre hasta que la escribas tú." />
                </span>
                <input
                  className="format-key"
                  value={draftFormat.code}
                  onChange={(event) => {
                    setClaveTocada(true);
                    setNuevo((actual) => ({ ...actual, code: event.target.value }));
                  }}
                  placeholder="Ej: papeleria_institucional"
                  required
                />
              </label>

              <label className="format-field">
                <span className="format-label">
                  Partir de
                  <Help text="Copia los campos de otro formato en su versión más reciente. El otro no se toca." />
                </span>
                <select
                  value={draftFormat.startFrom}
                  onChange={(event) => startFrom(event.target.value)}
                >
                  <option value="">En blanco</option>
                  {formats
                    .filter((one) => one.isActive && one.fields !== null)
                    .map((one) => (
                      <option value={one.id} key={one.id}>
                        {one.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        <div className="format-columns">
          <div>
            {SECTIONS.map((section) => (
              <section className="format-sec" key={section.key}>
                <h3>
                  {section.titulo}
                  <span className="format-sub">{section.ayuda}</span>
                </h3>

                <ul className="format-fields">
                  {fields[section.key].map((field, index) => {
                    const published = publishedKeys.get(field.code);
                    const repeated = field.code !== "" && repeatedKeys.includes(field.code);
                    const isOpen =
                      editing !== null &&
                      editing.section === section.key &&
                      editing.index === index;

                    return (
                      <li
                        className={`format-field-row${isOpen ? " is-open" : ""}${
                          repeated ? " is-bad" : ""
                        }`}
                        key={index}
                      >
                        <div className="format-field-head">
                          <span className="format-move">
                            <button
                              type="button"
                              onClick={() => move(section.key, index, -1)}
                              aria-label="Subir"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => move(section.key, index, 1)}
                              aria-label="Bajar"
                            >
                              ↓
                            </button>
                          </span>

                          <button
                            className="format-field-open"
                            type="button"
                            onClick={() =>
                              setEditando(isOpen ? null : { section: section.key, index })
                            }
                          >
                            <span className="format-field-name">
                              {field.name === "" ? "Campo sin nombre" : field.name}
                            </span>
                            <span className="format-field-key">
                              {field.code === "" ? "sin clave" : field.code}
                              {repeated ? (
                                <span className="format-repeated">clave repetida</span>
                              ) : null}
                            </span>
                          </button>

                          <span className="format-type">
                            <TypeIcon type={field.type} />
                            {types.find((type) => type.code === field.type)?.name ?? field.type}
                          </span>
                          <span
                            className={
                              field.required ? "format-required is-on" : "format-required"
                            }
                          >
                            {field.required ? "Obligatorio" : "Opcional"}
                          </span>
                        </div>

                        {isOpen ? (
                          <FieldEditor
                            field={field}
                            types={types}
                            published={published}
                            repeated={repeated}
                            suggestions={vocabulary.filter(
                              (one) => one.key === field.code || !keys.includes(one.key),
                            )}
                            listId={`vocabulario-${section.key}-${index}`}
                            onChange={(changes) => changeField(section.key, index, changes)}
                            onRemove={() => removeField(section.key, index)}
                            onClose={() => setEditando(null)}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <div className="format-add-row">
                  <button
                    className="format-add"
                    type="button"
                    onClick={() => addField(section.key)}
                  >
                    + Agregar field
                  </button>

                  <select
                    value=""
                    onChange={(event) => {
                      const published = publishedKeys.get(event.target.value);
                      if (published !== undefined) {
                        addField(section.key, {
                          code: published.key,
                          name: published.name,
                          type: published.type,
                          note: published.note ?? "",
                          required: false,
                        });
                      }
                    }}
                    aria-label="Usar un dato que ya existe"
                  >
                    <option value="">o usar un dato que ya existe…</option>
                    {vocabulary
                      .filter((one) => !keys.includes(one.key))
                      .map((one) => (
                        <option value={one.key} key={one.key}>
                          {one.name} ({one.type})
                        </option>
                      ))}
                  </select>
                </div>
              </section>
            ))}

            {isNew || versions.length <= 1 ? null : (
              <details className="format-versions">
                <summary>Versiones anteriores ({versions.length - 1})</summary>
                <ul>
                  {versions.slice(1).map((version) => {
                    const total =
                      version.fields.deliverables.length + version.fields.information.length;
                    return (
                      <li key={version.id}>
                        <span className="format-label">Versión {version.version}</span>
                        {shortDate(version.publishedAt)} · {total}{" "}
                        {total === 1 ? "campo" : "campos"}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </div>

          <section className="format-sec format-preview">
            <h3>Así se ve al capturar</h3>
            {everyField.length === 0 ? (
              <p className="format-note">Agrega un campo y aparecerá aquí.</p>
            ) : (
              SECTIONS.map((section) =>
                fields[section.key].length === 0 ? null : (
                  <div className="format-preview-sec" key={section.key}>
                    <h4>{section.titulo}</h4>
                    <div className="format-grid">
                      {fields[section.key].map((field, index) => (
                        <FieldInput
                          field={{
                            ...field,
                            code: field.code === "" ? `sin-clave-${index}` : field.code,
                            name: field.name === "" ? "Campo sin nombre" : field.name,
                          }}
                          value=""
                          onChange={() => {}}
                          key={index}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )
            )}
          </section>
        </div>
      </div>

      <footer className="format-foot">
        {problem !== null ? (
          <p className="format-problem">{problem}</p>
        ) : dirty ? (
          <p className="format-note">
            {isNew
              ? "Se crea con su versión 1."
              : `Las solicitudes nuevas se capturan con la versión ${next}. Las ${
                  format.requestCount
                } capturadas antes se siguen leyendo con la suya.${
                  format.sheetCount > 0
                    ? ` ${format.sheetCount} ${
                        format.sheetCount === 1 ? "libro de Excel sigue" : "libros de Excel siguen"
                      } mapeados a la versión ${format.version} hasta que se remapeen.`
                    : ""
                }`}
          </p>
        ) : (
          <p className="format-note">
            {isNew ? "" : `Versión ${format.version}, sin cambios por publicar.`}
          </p>
        )}

        <div className="format-foot-right">
          {dirty && !isNew ? (
            <button
              className="format-btn"
              type="button"
              onClick={() => setCampos(format.fields ?? { deliverables: [], information: [] })}
              disabled={busy}
            >
              Descartar
            </button>
          ) : null}
          <button
            className="format-btn is-primary"
            type="button"
            onClick={publish}
            disabled={busy || problem !== null || (!dirty && !isNew)}
          >
            {busy
              ? "Publicando…"
              : isNew
                ? "Crear formato"
                : `Publicar versión ${next}`}
            {isNew ? null : (
              <Help
                text={`Crea la versión ${next} con estos campos. La ${format.version} queda intacta, porque lo capturado con ella se sigue leyendo como se capturó.`}
              />
            )}
          </button>
        </div>
      </footer>
    </section>
  );
}

export default SchemaFormat;
