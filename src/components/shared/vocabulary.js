// The data vocabulary: a field's key with the name and the type it was registered under.
//
// A key is vocabulary shared between formats (DATAMODEL.md §2.13b): reusing one brings its name
// and its type, and publishing the same key with another type is refused. That is why the active
// formats are enough to know what `numero_orden` is called and what type it is, and why the
// screens can stop showing raw keys where a person expects a name.

/**
 * The vocabulary the formats declare, as a Map from key to `{ name, type, note }`.
 *
 * @param {Array<{fields: {deliverables: object[], information: object[]}|null}>} schemas What
 *   `listSchemas()` returns.
 * @returns {Map<string, {name: string, type: string, note: string|null}>}
 */
export function vocabularyOf(schemas) {
  const vocabulary = new Map();

  for (const format of schemas) {
    if (format.fields === null || format.fields === undefined) {
      continue;
    }
    for (const field of [...format.fields.deliverables, ...format.fields.information]) {
      if (!vocabulary.has(field.code)) {
        vocabulary.set(field.code, {
          name: field.name,
          type: field.type,
          note: field.note ?? null,
        });
      }
    }
  }

  return vocabulary;
}

/**
 * How a key reads: its name when the vocabulary knows it, and the key itself when it does not,
 * which is the only honest answer when a stage promises a value no format asks for yet.
 *
 * @param {Map<string, {name: string}>} vocabulary
 * @param {string} key
 * @returns {string}
 */
export function nameOfKey(vocabulary, key) {
  return vocabulary.get(key)?.name ?? key;
}
