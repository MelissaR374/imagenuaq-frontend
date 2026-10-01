// Una etapa de la plantilla: qué área la hace, quién suele hacerla, qué datos necesita y
// cuáles entrega (con su nota para leer) y cuántos días toma.
import {
    MdEdit,
    MdClose,
} from "react-icons/md";

import "./FlowCard.css";

function FlowCard({
    area,
    title,
    person,
    initials,
    entradas,
    salidas,
    notaEntrada,
    notaSalida,
    days,
    onEdit,
    onRemove,
}) {

    return (

        <article className="flow-card">

            <button
                type="button"
                className="flow-card-edit"
                title="Editar etapa"
                onClick={() => onEdit?.()}
            >
                <MdEdit />
            </button>

            <button
                type="button"
                className="flow-card-remove"
                title="Quitar etapa"
                onClick={() => onRemove?.()}
            >
                <MdClose />
            </button>

            <span className="flow-card-area">
                {area}
            </span>

            <h3>
                {title}
            </h3>

            <div className="flow-person">

                <span className="person-avatar">
                    {initials}
                </span>

                <span className="person-name">
                    {person}
                </span>

            </div>

            <div className="flow-io">

                <div>

                    <span>
                        ENTRA
                    </span>

                    {entradas.length > 0 && (
                        <ul className="flow-io-keys">
                            {entradas.map((clave, i) => (
                                <li key={i}>{clave}</li>
                            ))}
                        </ul>
                    )}

                    {notaEntrada && (
                        <p>
                            {notaEntrada}
                        </p>
                    )}

                </div>

                <div>

                    <span>
                        SALE
                    </span>

                    {salidas.length > 0 && (
                        <ul className="flow-io-keys">
                            {salidas.map((clave, i) => (
                                <li key={i}>{clave}</li>
                            ))}
                        </ul>
                    )}

                    {notaSalida && (
                        <p>
                            {notaSalida}
                        </p>
                    )}

                </div>

            </div>

            <span className="flow-days">
                {days}
            </span>

        </article>
    );
}

export default FlowCard;
