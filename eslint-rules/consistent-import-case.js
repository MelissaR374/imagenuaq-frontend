import fs from 'node:fs'
import path from 'node:path'

// Windows resolves `./Sidebar.css` to a file named `sidebar.css` without complaint, so a
// case-mismatched relative import runs fine in dev and breaks in two places that are hard
// to connect back to it:
//
//   - Vite keys its module graph by the specifier as written, while chokidar reports the
//     change under the real path. They never match, so the file silently stops hot-reloading
//     (this is why editing sidebar.css did nothing until a server restart).
//   - The nginx image in Dockerfile builds on Linux, where the same import is simply
//     unresolved and the build fails.
//
// No off-the-shelf rule covers this without pulling in a resolver plugin, and the check we
// need is small: compare every relative specifier against the real directory listing.

// readdirSync per import would be wasteful on a repeat lint; the process is short-lived and
// the tree does not change under it, so cache the listings for its lifetime.
const dirCache = new Map()

function readDir(dir) {
  if (!dirCache.has(dir)) {
    let entries = null
    try {
      entries = fs.readdirSync(dir)
    } catch {
      // Missing or unreadable directory: not a casing problem, leave it to the bundler.
    }
    dirCache.set(dir, entries)
  }
  return dirCache.get(dir)
}

// Vite lets an import omit the extension or point at a directory holding an index file, so
// one specifier segment can legitimately match several real filenames.
const EXTENSIONS = ['', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css']

// A directory import (`./components/sidebar`) needs no special case: the directory name is
// itself an entry, so the exact-match check below already covers it.
function candidatesFor(segment, isLast) {
  if (!isLast) return [segment]
  return EXTENSIONS.map((ext) => segment + ext)
}

// Returns the correctly-cased specifier when it differs from the one written, null when the
// import is fine or cannot be checked.
function findCaseMismatch(specifier, fromDir) {
  // `./styles.css?inline` and `./worker.js?worker` are Vite specifiers; only the path is a
  // filename.
  const [filePath] = specifier.split(/[?#]/)
  const segments = filePath.split('/')

  let dir = fromDir
  const corrected = []

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i]
    const isLast = i === segments.length - 1

    if (segment === '.' || segment === '..' || segment === '') {
      corrected.push(segment)
      dir = path.resolve(dir, segment)
      continue
    }

    const entries = readDir(dir)
    if (!entries) return null

    const candidates = candidatesFor(segment, isLast)
    if (candidates.some((candidate) => entries.includes(candidate))) {
      corrected.push(segment)
      dir = path.join(dir, segment)
      continue
    }

    // Nothing matched exactly. If something matches ignoring case, the import only works
    // because the filesystem is case-insensitive.
    const lowered = candidates.map((candidate) => candidate.toLowerCase())
    const match = entries.find((entry) => lowered.includes(entry.toLowerCase()))
    if (!match) return null // Genuinely unresolved; no-undef territory, not ours to report.

    // Report the real name, minus whatever extension the author chose to leave off.
    const extension = isLast && !match.toLowerCase().endsWith(segment.toLowerCase())
      ? match.slice(segment.length)
      : ''
    corrected.push(extension ? match.slice(0, match.length - extension.length) : match)
    dir = path.join(dir, match)
  }

  const result = corrected.join('/') + specifier.slice(filePath.length)
  return result === specifier ? null : result
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require relative import paths to match the real filename casing, which Windows ignores and Vite HMR and Linux builds do not',
    },
    fixable: 'code',
    schema: [],
    messages: {
      caseMismatch:
        'Import "{{written}}" does not match the file on disk. Use "{{corrected}}" — the casing as written breaks Vite HMR and fails to resolve on Linux.',
    },
  },

  create(context) {
    const fromDir = path.dirname(context.filename)

    function check(node) {
      // `export { x }` has no source, and a dynamic import()'s argument may be an expression.
      if (!node.source || node.source.type !== 'Literal') return
      const specifier = node.source.value
      if (typeof specifier !== 'string' || !specifier.startsWith('.')) return

      const corrected = findCaseMismatch(specifier, fromDir)
      if (!corrected) return

      context.report({
        node: node.source,
        messageId: 'caseMismatch',
        data: { written: specifier, corrected },
        fix: (fixer) => fixer.replaceText(node.source, JSON.stringify(corrected)),
      })
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: (node) => check({ source: node.source }),
    }
  },
}
