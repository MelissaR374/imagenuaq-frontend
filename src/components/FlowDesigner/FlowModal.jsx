// Ventana emergente del diseñador. Quien la abre decide el título, la descripción y el error
// que se muestra; `type` solo cambia la clase de la ventana.
import {
    MdClose,
} from "react-icons/md";

import "./FlowModal.css";

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

                <form onSubmit={onSubmit}>

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
