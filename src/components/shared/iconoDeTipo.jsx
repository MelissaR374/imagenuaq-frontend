// El símbolo de un tipo de dato. Es lo que deja leer una lista de campos de un vistazo: el tipo
// se reconoce por su forma antes de leer su nombre.
//
// Las claves son los `data_types.code` sembrados. Un tipo que se registre después y no esté aquí
// cae en el símbolo de texto, que es lo que el servidor también hace al no reconocer un formato.
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

const SIMBOLOS = {
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
 * El símbolo de un tipo de dato, decorativo: el nombre del tipo va al lado, escrito.
 *
 * @param {{ tipo: string }} props `tipo` es un `data_types.code`.
 */
function IconoDeTipo({ tipo }) {
  const Simbolo = SIMBOLOS[tipo] ?? MdShortText;
  return <Simbolo className="icono-de-tipo" aria-hidden="true" />;
}

export default IconoDeTipo;
