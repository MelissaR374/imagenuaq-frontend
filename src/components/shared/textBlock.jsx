// A format's text block as every form draws it: an optional heading and its text.
// The text is simple Markdown (markdown.js), drawn as React elements and never as raw HTML.
import { parseMarkdown } from "./markdown.js";
import "./textBlock.css";

/** Inline nodes from markdown.js as elements. */
function inline(nodes) {
  return nodes.map((node, index) => {
    if (node.type === "strong") return <strong key={index}>{inline(node.children)}</strong>;
    if (node.type === "em") return <em key={index}>{inline(node.children)}</em>;
    if (node.type === "code") return <code key={index}>{node.value}</code>;
    if (node.type === "link") {
      return (
        <a href={node.href} target="_blank" rel="noopener noreferrer" key={index}>
          {inline(node.children)}
        </a>
      );
    }
    return node.value;
  });
}

/** @param {{ block: { title: string, text: string } }} props */
function TextBlock({ block }) {
  return (
    <div className="text-block">
      {block.title ? <h4 className="text-block-title">{block.title}</h4> : null}
      <div className="text-block-text">
        {parseMarkdown(block.text).map((part, index) => {
          if (part.type === "heading") {
            return <h5 key={index}>{inline(part.children)}</h5>;
          }
          if (part.type === "ul" || part.type === "ol") {
            const List = part.type;
            return (
              <List key={index}>
                {part.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{inline(item)}</li>
                ))}
              </List>
            );
          }
          return (
            <p key={index}>
              {part.lines.map((line, lineIndex) => (
                <span key={lineIndex}>
                  {lineIndex > 0 ? <br /> : null}
                  {inline(line)}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default TextBlock;
