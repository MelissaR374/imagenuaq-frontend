// A field's help: a (?) beside its label, shown on hover or when the keyboard reaches it. It is
// here so the explanation does not become running text on the screen, which is what filled the
// forms with paragraphs nobody reads.
//
// It is a <button> and not a <span> on purpose: that puts it in the tab order, so the explanation
// also appears for somebody using the keyboard.
import "./help.css";

/**
 * The (?) of a field.
 *
 * @param {{ text: string }} props `text` is what it explains, in a sentence or two, in Spanish:
 *   everything the user reads is.
 */
function Help({ text }) {
  return (
    <button className="help" type="button" aria-label="Qué es este campo">
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
