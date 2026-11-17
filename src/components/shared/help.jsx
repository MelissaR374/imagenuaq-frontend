// A field's help: a (?) beside its label, shown on hover or when the keyboard reaches it. It is
// here so the explanation does not become running text on the screen, which is what filled the
// forms with paragraphs nobody reads.
//
// It is a <button> and not a <span> on purpose: that puts it in the tab order, so the explanation
// also appears for somebody using the keyboard. The text is fixed to the window, so a scrolling
// table or panel cannot cut it off. It opens above the (?) unless the window has no room there.
import { useState } from "react";

import "./help.css";

/** Room the text needs above the (?), in pixels: a few lines of a 34-character column. */
const ROOM_ABOVE = 140;

/** The widest the text gets, in pixels, so it can be kept inside the window. */
const TEXT_WIDTH = 280;

/** The gap between the (?) and its text, in pixels. */
const GAP = 6;

/**
 * The (?) of a field.
 *
 * @param {{ text: string }} props `text` is what it explains, in a sentence or two, in Spanish:
 *   everything the user reads is.
 */
function Help({ text }) {
  const [below, setBelow] = useState(false);
  const [position, setPosition] = useState({});

  function place(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const opensBelow = box.top < ROOM_ABOVE;
    const left = Math.max(8, Math.min(box.left - 8, window.innerWidth - TEXT_WIDTH - 8));
    setBelow(opensBelow);
    setPosition(opensBelow ? { top: box.bottom + GAP, left } : { top: box.top - GAP, left });
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
      <span className="help-text" role="tooltip" style={position}>
        {text}
      </span>
    </button>
  );
}

export default Help;
