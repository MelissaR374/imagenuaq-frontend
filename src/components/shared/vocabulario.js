// El vocabulario de datos: la clave de un campo con el nombre y el tipo con que se registró.
//
// Una clave es vocabulario compartido entre formatos (DATAMODEL.md §2.13b): reusarla trae su
// nombre y su tipo, y publicar la misma clave con otro tipo se niega. Por eso los formatos
// activos alcanzan para saber cómo se llama y de qué tipo es `numero_orden`, y las pantallas
// pueden dejar de mostrar claves crudas donde una persona espera un nombre.

/**
 * El vocabulario que los formatos declaran, como Map de clave a `{ name, type, note }`.
 *
 * @param {Array<{fields: {deliverables: object[], information: object[]}|null}>} schemas Lo que
 *   devuelve `listSchemas()`.
 * @returns {Map<string, {name: string, type: string, note: string|null}>}
 */
export function vocabularioDeFormatos(schemas) {
  const vocabulario = new Map();

  for (const formato of schemas) {
    if (formato.fields === null || formato.fields === undefined) {
      continue;
    }
    for (const campo of [...formato.fields.deliverables, ...formato.fields.information]) {
      if (!vocabulario.has(campo.code)) {
        vocabulario.set(campo.code, {
          name: campo.name,
          type: campo.type,
          note: campo.note ?? null,
        });
      }
    }
  }

  return vocabulario;
}

/**
 * Cómo se lee una clave: su nombre si el vocabulario la conoce, y si no la clave misma, que es
 * lo único honesto cuando una etapa promete un dato que ningún formato pide todavía.
 *
 * @param {Map<string, {name: string}>} vocabulario
 * @param {string} clave
 * @returns {string}
 */
export function nombreDeClave(vocabulario, clave) {
  return vocabulario.get(clave)?.name ?? clave;
}
