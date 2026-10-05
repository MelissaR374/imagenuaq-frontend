// La ayuda de un campo: un (?) junto a su etiqueta que se muestra al pasar el ratón o al llegar
// con el teclado. Está aparte para que la explicación no se vuelva texto corrido en la pantalla,
// que es lo que llenaba los formularios de párrafos que nadie lee.
//
// Es un <button> y no un <span> a propósito: así entra en el orden de tabulación y la
// explicación también aparece con el teclado.
import "./ayuda.css";

/**
 * El (?) de un campo.
 *
 * @param {{ texto: string }} props `texto` es lo que explica, en una o dos frases.
 */
function Ayuda({ texto }) {
  return (
    <button className="ayuda" type="button" aria-label="Qué es este campo">
      <span className="ayuda-marca" aria-hidden="true">
        ?
      </span>
      <span className="ayuda-texto" role="tooltip">
        {texto}
      </span>
    </button>
  );
}

export default Ayuda;
