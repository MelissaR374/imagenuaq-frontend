// A data type's symbol. It is what makes a list of fields readable at a glance: the type is
// recognised by its shape before its name is read.
//
// The keys are the seeded `data_types.code` values. A type registered later and missing from here
// falls back to the text symbol, which is what the server does with a format it cannot read.
import {
  MdShortText,
  MdMail,
  MdPhone,
  MdPlace,
  MdTag,
  MdAttachMoney,
  MdPercent,
  MdEvent,
  MdSchedule,
  MdToggleOn,
  MdLink,
  MdAttachFile,
} from "react-icons/md";

const SYMBOLS = {
  text: MdShortText,
  email: MdMail,
  phone: MdPhone,
  location: MdPlace,
  quantity: MdTag,
  currency: MdAttachMoney,
  percentage: MdPercent,
  date: MdEvent,
  datetime: MdSchedule,
  boolean: MdToggleOn,
  url: MdLink,
  document: MdAttachFile,
};

/**
 * A data type's symbol, decorative: the type's name is written beside it.
 *
 * @param {{ type: string }} props `type` is a `data_types.code`.
 */
function TypeIcon({ type }) {
  const Symbol = SYMBOLS[type] ?? MdShortText;
  return <Symbol className="type-icon" aria-hidden="true" />;
}

export default TypeIcon;
