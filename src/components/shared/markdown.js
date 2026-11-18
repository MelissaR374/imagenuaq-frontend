// A small Markdown reader for a format's text blocks. It returns plain data that React draws, so
// nothing passes through innerHTML, and a link opens only http, https or mailto addresses.

/** Bold, code, a link, then italic: the first one that matches at each point wins. */
const INLINE =
  /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/;

/** The addresses a link may open. Anything else is left as plain text. */
const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

/**
 * One line of text as a list of nodes: `text`, `code`, `strong`, `em` and `link`.
 *
 * @param {string} text
 * @returns {object[]}
 */
export function parseInline(text) {
  const nodes = [];
  let rest = text;
  while (rest !== "") {
    const match = INLINE.exec(rest);
    if (match === null) {
      nodes.push({ type: "text", value: rest });
      break;
    }
    if (match.index > 0) {
      nodes.push({ type: "text", value: rest.slice(0, match.index) });
    }
    const [whole, bold, code, label, href, star, underscore] = match;
    if (bold !== undefined) {
      nodes.push({ type: "strong", children: parseInline(bold) });
    } else if (code !== undefined) {
      nodes.push({ type: "code", value: code });
    } else if (label !== undefined) {
      nodes.push(
        SAFE_HREF.test(href)
          ? { type: "link", href, children: parseInline(label) }
          : { type: "text", value: whole },
      );
    } else {
      nodes.push({ type: "em", children: parseInline(star ?? underscore) });
    }
    rest = rest.slice(match.index + whole.length);
  }
  return nodes;
}

/**
 * A text as blocks: `heading`, `ul` and `ol` with their items, and `p` with its lines. A blank line
 * ends a paragraph or a list, and a single line break stays a line break.
 *
 * @param {string} source
 * @returns {object[]}
 */
export function parseMarkdown(source) {
  const blocks = [];
  let current = null;

  for (const line of source.split(/\r?\n/)) {
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (line.trim() === "") {
      current = null;
    } else if (heading !== null) {
      blocks.push({ type: "heading", children: parseInline(heading[1]) });
      current = null;
    } else if (bullet !== null || numbered !== null) {
      const type = bullet !== null ? "ul" : "ol";
      if (current === null || current.type !== type) {
        current = { type, items: [] };
        blocks.push(current);
      }
      current.items.push(parseInline((bullet ?? numbered)[1]));
    } else {
      if (current === null || current.type !== "p") {
        current = { type: "p", lines: [] };
        blocks.push(current);
      }
      current.lines.push(parseInline(line.trim()));
    }
  }
  return blocks;
}
