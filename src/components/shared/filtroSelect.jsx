// Un filtro de lista desplegable. Las opciones llegan ya armadas ({ valor, texto }) porque unas
// salen de un catálogo del servidor y otras están escritas a mano en cada pantalla.
function FiltroSelect({ clase, etiqueta, valor, opciones, onCambio }) {
  return (
    <label className={clase}>
      {etiqueta}
      <select value={valor} onChange={(evento) => onCambio(evento.target.value)}>
        {opciones.map((opcion) => (
          <option value={opcion.valor} key={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </label>
  );
}

export default FiltroSelect;
