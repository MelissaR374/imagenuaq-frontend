import {
    MdClose,
} from "react-icons/md";

import "./FlowModal.css";

//ventana emergente
function FlowModal({
    type,
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
                            {isPhase
                                ? "Agregar fase"
                                : "Agregar área"
                            }
                        </h2>

                        <p>
                            {isPhase
                                ? "Escribe el nombre de la nueva fase."
                                : "Define qué hará esta área dentro del flujo."
                            }
                        </p>

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

                    {children}

                </form>

            </div>

        </div>
    );
}


export default FlowModal;