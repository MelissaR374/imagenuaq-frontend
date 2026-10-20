// The data vocabulary: a field's key with the name and the type it was registered under.
//
// A key is vocabulary shared between formats (DATAMODEL.md §2.13b): reusing one brings its name
// and its type, and publishing the same key with another type is refused. The server's list holds
// every key a format ever published plus those registered on their own for a stage, which is why
// the screens can show a name where a person expects one instead of the raw key.

/**
 * The vocabulary as a Map from key to `{ name, type, note }`.
 *
 * @param {Array<{key: string, name: string, type: string, note?: string}>} fieldKeys What
 *   `listFieldKeys()` returns.
 * @returns {Map<string, {name: string, type: string, note: string|null}>}
 */
export function vocabularyOf(fieldKeys) {
  return new Map(
    fieldKeys.map((one) => [one.key, { name: one.name, type: one.type, note: one.note || null }]),
  );
}

/**
 * How a key reads: its name when the vocabulary knows it, and the key itself when it does not,
 * which is the only honest answer when a stage promises a value nobody registered.
 *
 * @param {Map<string, {name: string}>} vocabulary
 * @param {string} key
 * @returns {string}
 */
export function nameOfKey(vocabulary, key) {
  return vocabulary.get(key)?.name ?? key;
}
