// Un formato abierto a pantalla completa: el armado de sus campos (RF-SOL-01) con la captura al
// lado, porque un formato es un constructor y lo único que dice si está bien es cómo se va a ver.
//
// Son dos secciones y cada una un arreglo: `deliverables` es lo que hay que producir,
// `information` lo que hay que declarar. Los campos son una lista, no una tabla de inputs: un
// renglón por campo con su nombre, su clave y su tipo, y el editor se abre en su lugar.
//
// El `code` es la llave con la que el valor se guarda y con la que después lo leen la etiqueta, la
// orden de impresión y facturación, así que es snake_case y único entre ambas secciones.
//
// **Una clave que ya existe se reusa, no se redefine.** Al elegir una del vocabulario
// (`GET /api/schemas/field-keys`) el nombre y el tipo se llenan solos y quedan en firme, porque el
// valor se guarda bajo esa clave en todo el sistema y si aquí fuera de otro tipo, el proyecto
// acabaría con dos cosas distintas bajo un nombre. El servidor rechaza publicarla con otro tipo,
// así que mostrarlo aquí es lo que evita el viaje.
//
// La clave de un campo se sugiere desde su nombre mientras nadie la haya tocado: sugerirla solo
// mientras está vacía dejaba `c` al escribir «Contacto».
//
// Publicar crea la versión siguiente y no toca la anterior: el pie lo dice con los números de este
// formato, que es la única forma de que la advertencia signifique algo.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import { fechaCorta } from "../shared/formato.js";
import Ayuda from "../shared/ayuda.jsx";
import FieldInput from "../shared/fieldInput.jsx";
import IconoDeTipo from "../shared/iconoDeTipo.jsx";
import "./schemaFormat.css";

const SECCIONES = [
  {
    clave: "deliverables",
    titulo: "Entregables",
    ayuda: "Lo que el área tiene que producir",
  },
  {
    clave: "information",
    titulo: "Información",
    ayuda: "Lo que el solicitante declara",
  },
];

const CAMPO_VACIO = { code: "", name: "", type: "text", note: "", required: false };

/** Un nombre a una clave propuesta: sin acentos, en minúsculas y con guiones bajos. */
function claveSugerida(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

/**
 * Por qué el nombre y el tipo de un campo vienen de otro lado. La clave es vocabulario compartido
 * (DATAMODEL.md §2.13b): ya tiene valores capturados debajo, así que cambiarlos volvería mentira
 * lo capturado. Se puede reusar; no se puede redefinir.
 */
function textoDeReuso(publicada) {
  const donde = publicada.schemas ?? [];
  if (donde.length === 0) {
    return "Esta clave ya se publicó antes: su nombre y su tipo vienen de ahí.";
  }
  return `Dato compartido con ${donde.join(", ")}: su nombre y su tipo vienen de ahí.`;
}

/** El editor de un campo, abierto en su lugar dentro de la lista. */
function EditorDeCampo({
  campo, tipos, publicada, repetida, sugerencias, listaId, onCambiar, onQuitar, onCerrar,
}) {
  const [claveTocada, setClaveTocada] = useState(campo.code !== "");

  function escribirNombre(name) {
    if (publicada !== undefined) {
      return;
    }
    const cambios = { name };
    if (!claveTocada) {
      cambios.code = claveSugerida(name);
    }
    onCambiar(cambios);
  }

  return (
    <div className="format-field-editor">
      <div className="format-grid">
        <label className="format-field">
          <span className="format-label">Nombre</span>
          <input
            value={campo.name}
            onChange={(evento) => escribirNombre(evento.target.value)}
            readOnly={publicada !== undefined}
            placeholder="Ej: Medidas del impreso"
          />
        </label>

        <label className="format-field">
          <span className="format-label">
            Clave
            <Ayuda texto="Con esta clave se guarda el valor en todo el sistema, y con ella lo leen la orden de impresión y la facturación. Se sugiere desde el nombre hasta que la escribas tú." />
          </span>
          <input
            className={repetida ? "format-key is-bad" : "format-key"}
            value={campo.code}
            list={listaId}
            onChange={(evento) => {
              const code = evento.target.value;
              setClaveTocada(true);
              const existente = sugerencias.find((una) => una.key === code);
              onCambiar(
                existente === undefined
                  ? { code }
                  : {
                      code,
                      name: existente.name,
                      type: existente.type,
                      note: existente.note ?? "",
                    },
              );
            }}
            placeholder="Ej: medidas"
          />
          <datalist id={listaId}>
            {sugerencias.map((una) => (
              <option value={una.key} key={una.key}>
                {una.name} · {tipos.find((tipo) => tipo.code === una.type)?.name ?? una.type}
              </option>
            ))}
          </datalist>
        </label>

        <label className="format-field">
          <span className="format-label">
            Tipo de dato
            {publicada === undefined ? null : (
              <Ayuda texto={textoDeReuso(publicada)} />
            )}
          </span>
          {publicada === undefined ? (
            <select
              value={campo.type}
              onChange={(evento) => onCambiar({ type: evento.target.value })}
            >
              {tipos.map((tipo) => (
                <option value={tipo.code} key={tipo.code}>
                  {tipo.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="format-value">
              <IconoDeTipo tipo={campo.type} />{" "}
              {tipos.find((tipo) => tipo.code === campo.type)?.name ?? campo.type}
            </p>
          )}
        </label>

        <label className="format-field">
          <span className="format-label">
            Indicación
            <Ayuda texto="Lo que aparece en el (?) del campo al capturar. No se muestra como texto corrido." />
          </span>
          <input
            value={campo.note ?? ""}
            onChange={(evento) => onCambiar({ note: evento.target.value })}
            placeholder="Ej: en centímetros, ancho por alto"
          />
        </label>

        <label className="format-check">
          <input
            type="checkbox"
            checked={campo.required === true}
            onChange={(evento) => onCambiar({ required: evento.target.checked })}
          />
          Obligatorio
        </label>
      </div>

      {repetida ? (
        <p className="format-bad">
          Esa clave ya la tiene otro campo de este formato. Cada campo necesita una distinta,
          también entre secciones: el valor se guarda bajo su clave y dos campos la pisarían.
        </p>
      ) : null}

      {publicada === undefined ? null : (
        <p className="format-note">{textoDeReuso(publicada)}</p>
      )}

      <div className="format-action-row">
        <button className="format-quiet is-danger" type="button" onClick={onQuitar}>
          Quitar el campo
        </button>
        <button className="format-quiet" type="button" onClick={onCerrar}>
          Listo
        </button>
      </div>
    </div>
  );
}

function SchemaFormat({ formato, formatos, tipos, vocabulario, onCambio, onCerrar }) {
  const publicadas = new Map(vocabulario.map((una) => [una.key, una]));

  const [campos, setCampos] = useState(
    formato?.fields ?? { deliverables: [], information: [] },
  );
  const [nuevo, setNuevo] = useState({ code: "", name: "", partirDe: "" });
  const [claveTocada, setClaveTocada] = useState(false);
  const [editando, setEditando] = useState(null);
  const [versiones, setVersiones] = useState([]);
  const [clonando, setClonando] = useState(null);
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const esNuevo = formato === null || formato === undefined;

  useEffect(() => {
    let cancelado = false;

    async function cargarVersiones() {
      if (esNuevo) {
        return;
      }
      try {
        const { versions } = await api.listSchemaVersions(formato.id);
        if (!cancelado) setVersiones(versions);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargarVersiones();
    return () => {
      cancelado = true;
    };
  }, [esNuevo, formato?.id, formato?.version]);

  useEffect(() => {
    function alTeclear(evento) {
      if (evento.key === "Escape") {
        onCerrar();
      }
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  function cambiarCampo(seccion, indice, cambios) {
    setCampos((actual) => ({
      ...actual,
      [seccion]: actual[seccion].map((campo, i) =>
        i === indice ? { ...campo, ...cambios } : campo,
      ),
    }));
  }

  function agregarCampo(seccion, base = CAMPO_VACIO) {
    setCampos((actual) => {
      const lista = [...actual[seccion], { ...base }];
      setEditando({ seccion, indice: lista.length - 1 });
      return { ...actual, [seccion]: lista };
    });
  }

  function quitarCampo(seccion, indice) {
    setCampos((actual) => ({
      ...actual,
      [seccion]: actual[seccion].filter((_, i) => i !== indice),
    }));
    setEditando(null);
  }

  function mover(seccion, indice, salto) {
    const destino = indice + salto;
    setCampos((actual) => {
      const lista = [...actual[seccion]];
      if (destino < 0 || destino >= lista.length) return actual;
      [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
      return { ...actual, [seccion]: lista };
    });
    setEditando(null);
  }

  /** Partir de otro formato: sus campos entran tal cual, con sus claves compartidas. */
  function partirDe(id) {
    setNuevo((actual) => ({ ...actual, partirDe: id }));
    if (id === "") {
      setCampos({ deliverables: [], information: [] });
      return;
    }
    const base = formatos.find((uno) => String(uno.id) === String(id));
    if (base !== undefined && base.fields !== null) {
      setCampos({
        deliverables: base.fields.deliverables.map((campo) => ({ ...campo })),
        information: base.fields.information.map((campo) => ({ ...campo })),
      });
    }
  }

  const todos = [...campos.deliverables, ...campos.information];
  const claves = todos.map((campo) => campo.code);
  const repetidas = [...new Set(claves.filter((code, i) => code !== "" && claves.indexOf(code) !== i))];

  let problema = null;
  if (todos.length === 0) {
    problema = "Un formato necesita al menos un campo.";
  } else if (todos.some((campo) => campo.name.trim() === "" || campo.code.trim() === "")) {
    problema = "Hay un campo sin nombre o sin clave.";
  } else if (repetidas.length > 0) {
    problema = `Clave repetida: ${repetidas.join(", ")}.`;
  } else if (esNuevo && (nuevo.name.trim() === "" || nuevo.code.trim() === "")) {
    problema = "El formato necesita un nombre y una clave.";
  }

  const guardadas = JSON.stringify(formato?.fields ?? { deliverables: [], information: [] });
  const sucio = JSON.stringify(campos) !== guardadas;
  const siguiente = esNuevo ? 1 : (formato.version ?? 0) + 1;

  async function publicar() {
    setOcupado(true);
    setError(null);
    try {
      if (esNuevo) {
        const { schema } = await api.createSchema({
          code: nuevo.code,
          name: nuevo.name,
          fields: campos,
        });
        onCambio(schema.id);
      } else {
        await api.createSchemaVersion(formato.id, campos);
        onCambio(formato.id);
      }
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function clonar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      const { schema } = await api.cloneSchema(formato.id, clonando.code, clonando.name);
      setClonando(null);
      onCambio(schema.id);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarAlta() {
    setOcupado(true);
    setError(null);
    try {
      if (formato.isActive) {
        await api.deleteSchema(formato.id);
      } else {
        await api.updateSchema(formato.id, { isActive: true });
      }
      setConfirmandoBaja(false);
      onCambio(formato.id);
    } catch (fallo) {
      setError(fallo.message);
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
          onClick={onCerrar}
          aria-label="Volver a la lista"
        >
          ✕
        </button>

        <div className="format-bar-text">
          <span className="format-bar-eyebrow">
            {esNuevo ? "Formato nuevo" : formato.code}
            {esNuevo || formato.isActive ? "" : " · inactivo"}
          </span>
          <h2>{esNuevo ? nuevo.name || "Sin nombre todavía" : formato.name}</h2>
        </div>

        {esNuevo ? null : (
          <div className="format-bar-actions">
            <button
              className="format-quiet"
              type="button"
              onClick={() =>
                setClonando({ code: "", name: `${formato.name} (copia)` })
              }
              disabled={ocupado}
            >
              Clonar como formato nuevo
            </button>

            {confirmandoBaja ? (
              <>
                <span className="format-confirm">
                  Deja de ofrecerse al capturar. Lo capturado con él se sigue leyendo, y se puede
                  reactivar.
                </span>
                <button
                  className="format-btn"
                  type="button"
                  onClick={cambiarAlta}
                  disabled={ocupado}
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
                onClick={() => (formato.isActive ? setConfirmandoBaja(true) : cambiarAlta())}
                disabled={ocupado}
              >
                {formato.isActive ? "Desactivar" : "Reactivar"}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="format-body">
        {error !== null ? <p className="format-error">{error}</p> : null}

        {clonando !== null ? (
          <form className="format-clone" onSubmit={clonar}>
            <h3>Clonar como formato nuevo</h3>
            <p className="format-note">
              El formato nuevo empieza con los campos de este, en su versión 1. Este no se toca.
            </p>
            <div className="format-grid">
              <label className="format-field">
                <span className="format-label">Nombre</span>
                <input
                  value={clonando.name}
                  onChange={(evento) => setClonando({ ...clonando, name: evento.target.value })}
                  required
                />
              </label>
              <label className="format-field">
                <span className="format-label">Clave</span>
                <input
                  className="format-key"
                  value={clonando.code}
                  onChange={(evento) => setClonando({ ...clonando, code: evento.target.value })}
                  placeholder="Ej: papel_fcq"
                  required
                />
              </label>
            </div>
            <div className="format-action-row">
              <button className="format-quiet" type="button" onClick={() => setClonando(null)}>
                Cancelar
              </button>
              <button className="format-btn is-primary" type="submit" disabled={ocupado}>
                Clonar
              </button>
            </div>
          </form>
        ) : null}

        {esNuevo ? (
          <section className="format-sec">
            <h3>El formato</h3>
            <div className="format-grid">
              <label className="format-field">
                <span className="format-label">Nombre</span>
                <input
                  value={nuevo.name}
                  onChange={(evento) => {
                    const name = evento.target.value;
                    setNuevo((actual) => ({
                      ...actual,
                      name,
                      code: claveTocada ? actual.code : claveSugerida(name),
                    }));
                  }}
                  placeholder="Ej: Papelería institucional"
                  required
                />
              </label>

              <label className="format-field">
                <span className="format-label">
                  Clave
                  <Ayuda texto="Identifica el formato en el sistema y no se cambia después. Se sugiere desde el nombre hasta que la escribas tú." />
                </span>
                <input
                  className="format-key"
                  value={nuevo.code}
                  onChange={(evento) => {
                    setClaveTocada(true);
                    setNuevo((actual) => ({ ...actual, code: evento.target.value }));
                  }}
                  placeholder="Ej: papeleria_institucional"
                  required
                />
              </label>

              <label className="format-field">
                <span className="format-label">
                  Partir de
                  <Ayuda texto="Copia los campos de otro formato en su versión más reciente. El otro no se toca." />
                </span>
                <select
                  value={nuevo.partirDe}
                  onChange={(evento) => partirDe(evento.target.value)}
                >
                  <option value="">En blanco</option>
                  {formatos
                    .filter((uno) => uno.isActive && uno.fields !== null)
                    .map((uno) => (
                      <option value={uno.id} key={uno.id}>
                        {uno.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        <div className="format-columns">
          <div>
            {SECCIONES.map((seccion) => (
              <section className="format-sec" key={seccion.clave}>
                <h3>
                  {seccion.titulo}
                  <span className="format-sub">{seccion.ayuda}</span>
                </h3>

                <ul className="format-fields">
                  {campos[seccion.clave].map((campo, indice) => {
                    const publicada = publicadas.get(campo.code);
                    const repetida = campo.code !== "" && repetidas.includes(campo.code);
                    const abierto =
                      editando !== null &&
                      editando.seccion === seccion.clave &&
                      editando.indice === indice;

                    return (
                      <li
                        className={`format-field-row${abierto ? " is-open" : ""}${
                          repetida ? " is-bad" : ""
                        }`}
                        key={indice}
                      >
                        <div className="format-field-head">
                          <span className="format-move">
                            <button
                              type="button"
                              onClick={() => mover(seccion.clave, indice, -1)}
                              aria-label="Subir"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => mover(seccion.clave, indice, 1)}
                              aria-label="Bajar"
                            >
                              ↓
                            </button>
                          </span>

                          <button
                            className="format-field-open"
                            type="button"
                            onClick={() =>
                              setEditando(abierto ? null : { seccion: seccion.clave, indice })
                            }
                          >
                            <span className="format-field-name">
                              {campo.name === "" ? "Campo sin nombre" : campo.name}
                            </span>
                            <span className="format-field-key">
                              {campo.code === "" ? "sin clave" : campo.code}
                              {repetida ? (
                                <span className="format-repeated">clave repetida</span>
                              ) : null}
                            </span>
                          </button>

                          <span className="format-type">
                            <IconoDeTipo tipo={campo.type} />
                            {tipos.find((tipo) => tipo.code === campo.type)?.name ?? campo.type}
                          </span>
                          <span
                            className={
                              campo.required ? "format-required is-on" : "format-required"
                            }
                          >
                            {campo.required ? "Obligatorio" : "Opcional"}
                          </span>
                        </div>

                        {abierto ? (
                          <EditorDeCampo
                            campo={campo}
                            tipos={tipos}
                            publicada={publicada}
                            repetida={repetida}
                            sugerencias={vocabulario.filter(
                              (una) => una.key === campo.code || !claves.includes(una.key),
                            )}
                            listaId={`vocabulario-${seccion.clave}-${indice}`}
                            onCambiar={(cambios) => cambiarCampo(seccion.clave, indice, cambios)}
                            onQuitar={() => quitarCampo(seccion.clave, indice)}
                            onCerrar={() => setEditando(null)}
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
                    onClick={() => agregarCampo(seccion.clave)}
                  >
                    + Agregar campo
                  </button>

                  <select
                    value=""
                    onChange={(evento) => {
                      const publicada = publicadas.get(evento.target.value);
                      if (publicada !== undefined) {
                        agregarCampo(seccion.clave, {
                          code: publicada.key,
                          name: publicada.name,
                          type: publicada.type,
                          note: publicada.note ?? "",
                          required: false,
                        });
                      }
                    }}
                    aria-label="Usar un dato que ya existe"
                  >
                    <option value="">o usar un dato que ya existe…</option>
                    {vocabulario
                      .filter((una) => !claves.includes(una.key))
                      .map((una) => (
                        <option value={una.key} key={una.key}>
                          {una.name} ({una.type})
                        </option>
                      ))}
                  </select>
                </div>
              </section>
            ))}

            {esNuevo || versiones.length <= 1 ? null : (
              <details className="format-versions">
                <summary>Versiones anteriores ({versiones.length - 1})</summary>
                <ul>
                  {versiones.slice(1).map((version) => {
                    const total =
                      version.fields.deliverables.length + version.fields.information.length;
                    return (
                      <li key={version.id}>
                        <span className="format-label">Versión {version.version}</span>
                        {fechaCorta(version.publishedAt)} · {total}{" "}
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
            {todos.length === 0 ? (
              <p className="format-note">Agrega un campo y aparecerá aquí.</p>
            ) : (
              SECCIONES.map((seccion) =>
                campos[seccion.clave].length === 0 ? null : (
                  <div className="format-preview-sec" key={seccion.clave}>
                    <h4>{seccion.titulo}</h4>
                    <div className="format-grid">
                      {campos[seccion.clave].map((campo, indice) => (
                        <FieldInput
                          field={{
                            ...campo,
                            code: campo.code === "" ? `sin-clave-${indice}` : campo.code,
                            name: campo.name === "" ? "Campo sin nombre" : campo.name,
                          }}
                          value=""
                          onChange={() => {}}
                          key={indice}
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
        {problema !== null ? (
          <p className="format-problem">{problema}</p>
        ) : sucio ? (
          <p className="format-note">
            {esNuevo
              ? "Se crea con su versión 1."
              : `Las solicitudes nuevas se capturan con la versión ${siguiente}. Las ${
                  formato.requestCount
                } capturadas antes se siguen leyendo con la suya.${
                  formato.sheetCount > 0
                    ? ` ${formato.sheetCount} ${
                        formato.sheetCount === 1 ? "libro de Excel sigue" : "libros de Excel siguen"
                      } mapeados a la versión ${formato.version} hasta que se remapeen.`
                    : ""
                }`}
          </p>
        ) : (
          <p className="format-note">
            {esNuevo ? "" : `Versión ${formato.version}, sin cambios por publicar.`}
          </p>
        )}

        <div className="format-foot-right">
          {sucio && !esNuevo ? (
            <button
              className="format-btn"
              type="button"
              onClick={() => setCampos(formato.fields ?? { deliverables: [], information: [] })}
              disabled={ocupado}
            >
              Descartar
            </button>
          ) : null}
          <button
            className="format-btn is-primary"
            type="button"
            onClick={publicar}
            disabled={ocupado || problema !== null || (!sucio && !esNuevo)}
          >
            {ocupado
              ? "Publicando…"
              : esNuevo
                ? "Crear formato"
                : `Publicar versión ${siguiente}`}
            {esNuevo ? null : (
              <Ayuda
                texto={`Crea la versión ${siguiente} con estos campos. La ${formato.version} queda intacta, porque lo capturado con ella se sigue leyendo como se capturó.`}
              />
            )}
          </button>
        </div>
      </footer>
    </section>
  );
}

export default SchemaFormat;
