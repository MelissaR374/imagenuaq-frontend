// A field's help: a (?) beside its label, shown on hover or when the keyboard reaches it. It is
// here so the explanation does not become running text on the screen, which is what filled the
// forms with paragraphs nobody reads.
//
// It is a <button> and not a <span> on purpose: that puts it in the tab order, so the explanation
// also appears for somebody using the keyboard. The text opens above the (?) unless the panel that
// holds it would cut it off there, as at the top of a scrolling tab; then it opens below.
import { useState } from "react";

import "./help.css";

/** Room the text needs above the (?), in pixels: a few lines of a 34-character column. */
const ROOM_ABOVE = 140;

/** The nearest ancestor that clips what overflows it, or null when only the window does. */
function clippingParent(node) {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "hidden") return parent;
  }
  return null;
}

/**
 * The (?) of a field.
 *
 * @param {{ text: string }} props `text` is what it explains, in a sentence or two, in Spanish:
 *   everything the user reads is.
 */
function Help({ text }) {
  const [below, setBelow] = useState(false);

  function place(event) {
    const top = event.currentTarget.getBoundingClientRect().top;
    const parent = clippingParent(event.currentTarget);
    const ceiling = parent === null ? 0 : parent.getBoundingClientRect().top;
    setBelow(top - ceiling < ROOM_ABOVE);
  }

  return (
    <button
      className={below ? "help is-below" : "help"}
      type="button"
      aria-label="Qué es este campo"
      onMouseEnter={place}
      onFocus={place}
    >
      <span className="help-mark" aria-hidden="true">
        ?
      </span>
      <span className="help-text" role="tooltip">
        {text}
      </span>
    </button>
  );
}

export default Help;
