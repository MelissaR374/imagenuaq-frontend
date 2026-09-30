import {
    MdClose,
} from "react-icons/md";

import "./FlowModal.css";

// Ventana emergente del diseñador. Quien la abre decide el título, la descripción y el error
// que se muestra; `type` solo cambia la clase de la ventana.
function FlowModal({
    type,
    titulo,
    descripcion,
    error,
    onClose,
    onSubmit,
    children,
}) {

    const isPhase = type === "phase";

    return (

        <div
            className="flow-modal-overlay"
            onMouseDown={onClose}
        >

            <div
                className={`flow-modal ${isPhase ? "phase-modal" : ""}`}
                onMouseDown={(event) =>
                    event.stopPropagation()
                }
            >

                {/* =================================================
                   HEADER
                   ================================================= */}

                <div className="modal-header">

                    <div>

                        <h2>
                            {titulo}
                        </h2>

                        {descripcion && (
                            <p>
                                {descripcion}
                            </p>
                        )}

                    </div>


                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        <MdClose />
                    </button>

                </div>


                {/* =================================================
                   CONTENIDO
                   ================================================= */}

                <form onSubmit={onSubmit}>

                    {/* El servidor explica por qué no aceptó lo que se mandó. */}
                    {error && (
                        <p className="flow-modal-error">
                            {error}
                        </p>
                    )}

                    {children}

                </form>

            </div>

        </div>
    );
}


export default FlowModal;
