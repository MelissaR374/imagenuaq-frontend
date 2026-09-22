import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./requesterInput.css";

// El solicitante es una cadena, no un registro: no hay padrón de entidades. Para que no se
// vuelva cuatro formas de escribir la misma facultad, el campo sugiere las que ya están en
// uso, de más usada a menos (GET /api/requesters).
function RequesterInput({ value, onChange, id = "solicitante" }) {
  const [sugerencias, setSugerencias] = useState([]);

  useEffect(() => {
    let cancelado = false;

    async function buscar() {
      try {
        const { requesters } = await api.listRequesters(value ?? "");
        if (!cancelado) setSugerencias(requesters);
      } catch {
        // Si el autocompletado falla, el campo sigue sirviendo: es texto libre.
        if (!cancelado) setSugerencias([]);
      }
    }

    buscar();
    return () => {
      cancelado = true;
    };
  }, [value]);

  return (
    <div className="requester-input">
      <input
        className="requester-control"
        id={id}
        list={`${id}-lista`}
        value={value ?? ""}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder="Facultad de Química"
      />

      <datalist id={`${id}-lista`}>
        {sugerencias.map((sugerencia) => (
          <option value={sugerencia.name} key={sugerencia.name}>
            {sugerencia.uses === 1 ? "1 registro" : `${sugerencia.uses} registros`}
          </option>
        ))}
      </datalist>
    </div>
  );
}

export default RequesterInput;
