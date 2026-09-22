import { useState } from "react";

import "./schemaEditor.css";

// El armado de campos de un formato (RF-SOL-01). Son dos secciones y cada una un arreglo:
// `deliverables` es lo que hay que producir, `information` lo que hay que declarar.
//
// El `code` es la llave con la que el valor se guarda y con la que después lo leen la
// etiqueta, la orden de impresión y facturación, así que es snake_case y único entre ambas
// secciones. El servidor lo valida igual; aquí solo se avisa antes de mandarlo.
//
// **Una clave que ya existe se reusa, no se redefine.** El selector ofrece el vocabulario
// (`GET /api/schemas/field-keys`): al elegir una clave ya publicada, el nombre y el tipo se
// llenan solos y quedan bloqueados, porque el valor se guarda bajo esa clave en todo el sistema
// y si aquí fuera de otro tipo, el proyecto acabaría con dos cosas distintas bajo un nombre. El
// servidor rechaza publicarla con otro tipo, así que el bloqueo es lo que evita el viaje.
const SECCIONES = [
  { clave: "deliverables", titulo: "Entregables", ayuda: "Lo que el área tiene que producir" },
  { clave: "information", titulo: "Información", ayuda: "Lo que el solicitante declara" },
];

const CAMPO_VACIO = { code: "", name: "", type: "text", note: "", required: false };

// Un nombre a un código propuesto: sin acentos, en minúsculas y con guiones bajos.
function codigoSugerido(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
}

function SchemaEditor({
  tipos,
  vocabulario = [],
  inicial,
  titulo,
  onGuardar,
  onCancelar,
  error,
  guardando,
}) {
  // La clave a su definición publicada, para saber cuándo un campo está reusando una.
  const publicadas = new Map(vocabulario.map((una) => [una.key, una]));
  const [campos, setCampos] = useState(
    inicial ?? { deliverables: [{ ...CAMPO_VACIO }], information: [] },
  );

  function cambiarCampo(seccion, indice, cambios) {
    setCampos((actual) => ({
      ...actual,
      [seccion]: actual[seccion].map((campo, i) =>
        i === indice ? { ...campo, ...cambios } : campo,
      ),
    }));
  }

  function agregarCampo(seccion) {
    setCampos((actual) => ({ ...actual, [seccion]: [...actual[seccion], { ...CAMPO_VACIO }] }));
  }

  function quitarCampo(seccion, indice) {
    setCampos((actual) => ({
      ...actual,
      [seccion]: actual[seccion].filter((_, i) => i !== indice),
    }));
  }

  // Mueve un campo dentro de su sección: el orden del arreglo es el orden de captura.
  function mover(seccion, indice, salto) {
    const destino = indice + salto;
    setCampos((actual) => {
      const lista = [...actual[seccion]];
      if (destino < 0 || destino >= lista.length) return actual;
      [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
      return { ...actual, [seccion]: lista };
    });
  }

  // Los códigos repetidos se marcan aquí para no mandar algo que el servidor va a rechazar.
  const todos = [...campos.deliverables, ...campos.information].map((campo) => campo.code);
  const repetidos = new Set(todos.filter((code, i) => code !== "" && todos.indexOf(code) !== i));
  const vacio = todos.length === 0;

  function guardar(evento) {
    evento.preventDefault();
    onGuardar(campos);
  }

  return (
    <form className="schema-editor" onSubmit={guardar}>
      <h3 className="schema-editor-title">{titulo}</h3>

      {SECCIONES.map((seccion) => (
        <fieldset className="schema-section" key={seccion.clave}>
          <legend className="schema-section-title">
            {seccion.titulo} <span className="schema-section-help">— {seccion.ayuda}</span>
          </legend>

          <table className="schema-fields">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Clave</th>
                <th>Tipo</th>
                <th>Indicación</th>
                <th>Obligatorio</th>
                <th>Orden</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campos[seccion.clave].map((campo, indice) => (
                <tr className="schema-field-row" key={indice}>
                  <td>
                    <input
                      className="schema-input"
                      value={campo.name}
                      readOnly={publicadas.has(campo.code)}
                      onChange={(evento) => {
                        const name = evento.target.value;
                        // La clave se propone del nombre mientras nadie la haya tecleado.
                        const code = campo.code === "" ? codigoSugerido(name) : campo.code;
                        cambiarCampo(seccion.clave, indice, { name, code });
                      }}
                      required
                    />
                  </td>
                  <td>
                    <input
                      className={`schema-input ${repetidos.has(campo.code) ? "schema-input-bad" : ""}`}
                      value={campo.code}
                      list="schema-vocabulario"
                      onChange={(evento) => {
                        const code = evento.target.value;
                        const publicada = publicadas.get(code);
                        // Al caer en una clave que ya existe, su definición manda.
                        cambiarCampo(
                          seccion.clave,
                          indice,
                          publicada
                            ? {
                                code,
                                name: publicada.name,
                                type: publicada.type,
                                note: publicada.note ?? "",
                              }
                            : { code },
                        );
                      }}
                      required
                    />
                    {publicadas.has(campo.code) ? (
                      <p className="schema-reused">
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <select
                      className="schema-input"
                      value={campo.type}
                      disabled={publicadas.has(campo.code)}
                      onChange={(evento) =>
                        cambiarCampo(seccion.clave, indice, { type: evento.target.value })
                      }
                    >
                      {tipos.map((tipo) => (
                        <option value={tipo.code} key={tipo.code}>
                          {tipo.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="schema-input"
                      value={campo.note ?? ""}
                      onChange={(evento) =>
                        cambiarCampo(seccion.clave, indice, { note: evento.target.value })
                      }
                    />
                  </td>
                  <td className="schema-cell-center">
                    <input
                      type="checkbox"
                      checked={campo.required === true}
                      onChange={(evento) =>
                        cambiarCampo(seccion.clave, indice, { required: evento.target.checked })
                      }
                    />
                  </td>
                  <td className="schema-cell-center">
                    <button type="button" onClick={() => mover(seccion.clave, indice, -1)}>
                      ↑
                    </button>
                    <button type="button" onClick={() => mover(seccion.clave, indice, 1)}>
                      ↓
                    </button>
                  </td>
                  <td>
                    <button type="button" onClick={() => quitarCampo(seccion.clave, indice)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className="schema-add"
            type="button"
            onClick={() => agregarCampo(seccion.clave)}
          >
            Agregar campo a {seccion.titulo.toLowerCase()}
          </button>
        </fieldset>
      ))}

      {/* El vocabulario completo: una clave elegida de aquí se reusa con su definición. */}
      <datalist id="schema-vocabulario">
        {vocabulario.map((una) => (
          <option value={una.key} key={una.key}>
            {una.name} ({una.type})
          </option>
        ))}
      </datalist>

      <p className="schema-editor-help">
        Las claves con fondo bloqueado ya existen en otro formato: se reusan con su nombre y su
        tipo, porque el valor se guarda bajo esa clave en todo el sistema. Si necesitas algo
        distinto, usa otra clave.
      </p>

      {repetidos.size > 0 ? (
        <p className="schema-editor-error">
          Hay claves repetidas ({[...repetidos].join(", ")}). Cada campo necesita una distinta,
          también entre secciones.
        </p>
      ) : null}

      {vacio ? (
        <p className="schema-editor-error">Un formato necesita al menos un campo.</p>
      ) : null}

      {error ? <p className="schema-editor-error">{error}</p> : null}

      <div className="schema-editor-actions">
        <button type="submit" disabled={guardando || repetidos.size > 0 || vacio}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default SchemaEditor;
