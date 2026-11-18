// A format's text block as every form draws it: an optional heading and the text it explains with.
import "./textBlock.css";

/** @param {{ block: { title: string, text: string } }} props */
function TextBlock({ block }) {
  return (
    <div className="text-block">
      {block.title ? <h4 className="text-block-title">{block.title}</h4> : null}
      <p className="text-block-text">{block.text}</p>
    </div>
  );
}

export default TextBlock;
