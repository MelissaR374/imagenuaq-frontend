import { useState } from "react";

import {
    MdKeyboardArrowDown,
    MdEdit,
} from "react-icons/md";

import FlowCard from "./FlowCard";
import FlowModal from "./FlowModal";

import "./FlowDesigner.css";

//DATOS PRUEBA
const INITIAL_PROJECT = {
    id: 427,
    code: "P-0427",
    name: "Manual de identidad FCQ",
    estimatedDays: 14,
};


//Áreas
const INITIAL_AREAS = [
    {
        id: 1,
        name: "Coordinación",
    },
    {
        id: 2,
        name: "Diseño gráfico",
    },
    {
        id: 3,
        name: "Imprenta",
    },
    {
        id: 4,
        name: "Administrativo",
    },
];


//USUARIOS FIJOS ANTES DEL BACKEND
const INITIAL_USERS = [
    {
        id: 1,
        name: "Juan López",
        initials: "JL",
    },
    {
        id: 2,
        name: "Daniel Ibarra",
        initials: "DI",
    },
    {
        id: 3,
        name: "Jorge Trejo",
        initials: "JT",
    },
    {
        id: 4,
        name: "Paola Vega",
        initials: "PV",
    },
    {
        id: 5,
        name: "Rocío Salas",
        initials: "RS",
    },
];

/* =========================================================
   FASES / FLUJO DE PRUEBA
   ---------------------------------------------------------
   Esta es la estructura que posteriormente puede venir
   directamente de PostgreSQL mediante el backend.
   ========================================================= */

const INITIAL_PHASES = [
    {
        id: 1,
        name: "FASE 1 · RECEPCIÓN",
        areas: [
            {
                id: 101,
                areaId: 1,
                title: "Revisión de solicitud",
                personId: 1,
                input: "Oficio de la entidad",
                output: "Proyecto con folio",
                days: 1,
                active: false,
            },
            {
                id: 102,
                areaId: 4,
                title: "Clasificar costo",
                personId: 4,
                input: "Proyecto con folio",
                output: "Cotización por firma",
                days: 1,
                active: false,
            },
        ],
    },

    {
        id: 2,
        name: "FASE 2 · DISEÑO",
        areas: [
            {
                id: 201,
                areaId: 2,
                title: "Propuesta de diseño",
                personId: 2,
                input: "Cotización firmada",
                output: "PDF de propuesta",
                days: 4,
                active: true,
            },
            {
                id: 202,
                areaId: 2,
                title: "V.B. interno",
                personId: 5,
                input: "PDF de propuesta",
                output: "Visto bueno firmado",
                days: 1,
                active: false,
            },
        ],
    },
    {
        id: 3,
        name: "FASE 3 · PRODUCCIÓN",
        areas: [
            {
                id: 301,
                areaId: 3,
                title: "Producción",
                personId: 3,
                input: "Archivos abiertos",
                output: "300 manuales + evidencia",
                days: 4,
                active: false,
            },
        ],
    },
    {
        id: 4,
        name: "FASE 4 · CIERRE",
        areas: [
            {
                id: 401,
                areaId: 4,
                title: "Factura y entrega",
                personId: 4,
                input: "Evidencia de entrega",
                output: "Factura y acuse",
                days: 2,
                active: false,
            },
        ],
    },
];

function FlowDesigner({
    /*
     * Estos valores podrán ser enviados desde App.jsx
     * cuando tengamos el backend.
     *
     * Mientras tanto usamos los datos de PRUEBA.
    */
    project: projectFromProps = INITIAL_PROJECT,
    phases: phasesFromProps = INITIAL_PHASES,
    areas: areasFromProps = INITIAL_AREAS,
    users: usersFromProps = INITIAL_USERS,

    /* Callbacks preparados para backend.*/
    onAddArea,
    onEditArea,
    onAddPhase,
    onEditPhase,

}) {
    /* DATOS LOCALES
       Por ahora usamos estado para poder probar la interfaz.
       Cuando conectemos el backend, estos estados podrán
       ser reemplazados por los datos recibidos desde API.
    */
    const [project] = useState(projectFromProps);
    const [phases, setPhases] = useState(phasesFromProps);
    const [areas] = useState(areasFromProps);
    const [users] = useState(usersFromProps);

    //ventana emergente modal
    const [showAreaModal, setShowAreaModal] = useState(false);
    const [showPhaseModal, setShowPhaseModal] = useState(false);

    //elemento seleccionado
    const [selectedPhase, setSelectedPhase] = useState(null);
    const [selectedArea, setSelectedArea] = useState(null);

    //fase
    const [phaseName, setPhaseName] = useState("");

    //abrir ventana emergente (modal) para agregar fase
    function handleOpenAddArea(phase) {
        setSelectedPhase(phase);
        setSelectedArea(null);
        setShowAreaModal(true);
    }

    //abrir ventana emergente (modal) para editar fase
    function handleOpenEditArea(area, phase) {
        setSelectedPhase(phase);
        setSelectedArea(area);
        setShowAreaModal(true);
    }

    //cerrar modal de área
    function handleCloseAreaModal() {
        setShowAreaModal(false);
        setSelectedPhase(null);
        setSelectedArea(null);
    }

    //guardar área
    function handleSubmitArea(event) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const areaData = {
            
            /* Si estamos editando existe un id.
             * Si es nueva área será null.*/

            id: selectedArea?.id ?? null,
            phaseId: selectedPhase?.id ?? null,
            areaId: Number(
                formData.get("areaId")
            ),
            title: formData.get("title"),
            personId: Number(
                formData.get("personId")
            ),
            input: formData.get("input"),
            output: formData.get("output"),
            days: Number(
                formData.get("days")
            ),
        };

        /*AQUÍ EN EL BACKEND:
           await api.createArea(areaData)
           o
           await api.updateArea(areaData.id, areaData)
        */

        if (selectedArea) {

            //ACTUALIZACIÓN LOCAL
            setPhases((currentPhases) =>
                currentPhases.map((phase) => {
                    if (
                        phase.id !== selectedPhase.id
                    ) {
                        return phase;
                    }
                    return {
                        ...phase,
                        areas: phase.areas.map((area) =>
                            area.id === selectedArea.id
                                ? {
                                    ...area,
                                    ...areaData,
                                }
                                : area
                        ),
                    };

                })
            );

            //Callback para backend.
            onEditArea?.(areaData);
        } else {

            //se genera un ID TEMPORAL
            const newArea = {
                ...areaData,
                id: Date.now(),
                active: false,
            };

            //Actualizacion LOCAL
            setPhases((currentPhases) =>
                currentPhases.map((phase) => {
                    if (
                        phase.id !== selectedPhase.id
                    ) {
                        return phase;
                    }
                    return {
                        ...phase,
                        areas: [
                            ...phase.areas,
                            newArea,
                        ],
                    };
                })
            );

            //callback para backend
            onAddArea?.(newArea);
        }

        handleCloseAreaModal();
    }

    //abrir ventana emergente de fase
    function handleOpenPhaseModal(phase = null) {
        setSelectedPhase(phase);
        setPhaseName(
            phase?.name ?? ""
        );
        setShowPhaseModal(true);
    }
    
    //cerrar ventana de fase
    function handleClosePhaseModal() {
        setShowPhaseModal(false);
        setSelectedPhase(null);
        setPhaseName("");
    }

    //guardar fase
    function handleSubmitPhase(event) {
        event.preventDefault();
        const name = phaseName.trim();
        if (!name) {
            return;
        }

        //Editar fase
        if (selectedPhase) {
            const updatedPhase = {
                ...selectedPhase,
                name,
            };
        
            setPhases((currentPhases) =>
                currentPhases.map((phase) =>
                    phase.id === selectedPhase.id
                        ? updatedPhase
                        : phase
                )
            );

            //callback para backend "preparado"
            onEditPhase?.(updatedPhase);
        }

        //crear fase
        else {
            const newPhase = {
                id: Date.now(),
                name,
                areas: [],
            };

            setPhases((currentPhases) => [
                ...currentPhases,
                newPhase,
            ]);

            //callback backend
            onAddPhase?.(newPhase);
        }
        handleClosePhaseModal();
    }

    //CALCULAR DÍAS TOTALES
    const totalDays = phases.reduce(
        (phaseTotal, phase) => {
            const phaseDays = phase.areas.reduce(
                (areaTotal, area) =>
                    areaTotal + Number(area.days || 0),
                0
            );
            return phaseTotal + phaseDays;
        },
        0
    );
    return (

        <div className="flow-page">
            <header className="flow-header">
                <div className="flow-heading">
                    <h1 className="flow-title">Diseño de flujos</h1>
                    <span className="flow-eyebrow">
                        EL FLUJO SE DISEÑA POR PROYECTO
                    </span>
                    <button
                        type="button"
                        className="project-selector"
                    >
                        <span className="project-code">
                            {project.code}
                        </span>
                        <span className="project-name">
                            {project.name}
                        </span>
                        <MdKeyboardArrowDown />
                    </button>
                </div>
                <div className="flow-actions">
                    <button
                        type="button"
                        className="template-button"
                    >

                        Partir de una plantilla

                        <MdKeyboardArrowDown />
                    </button>
                    <button
                        type="button"
                        className="save-button"
                    >
                        Guardar flujo
                    </button>
                </div>
            </header>


            {/* resumen */}

            <div className="flow-summary">
                <div className="summary-text">
                    <span>
                        Pasa por{" "}
                        <strong>
                            {phases.reduce(
                                (total, phase) =>
                                    total + phase.areas.length,
                                0
                            )}
                        </strong>{" "}
                        áreas
                    </span>
                    <span>
                        en{" "}
                        <strong>
                            {phases.length}
                        </strong>{" "}
                        fases
                    </span>

                    <span>
                        {totalDays} días hábiles estimados
                    </span>
                </div>


                <span className="drag-hint">

                    Arrastra de un punto a otro
                    para conectar nodos

                </span>


            </div>

            {/* canvas*/}
            <main className="flow-canvas">
                <div className="phase-columns">

                    {/* fases */}
                    {phases.map((phase) => (
                        <section
                            className="phase-column"
                            key={phase.id}
                        >
                            {/* titulo de fase */}
                            <div className="phase-title">
                                <span>
                                    {phase.name}
                                </span>
                                <button
                                    type="button"
                                    className="phase-edit-button"
                                    title="Editar fase"
                                    onClick={() =>
                                        handleOpenPhaseModal(
                                            phase
                                        )
                                    }
                                >
                                    <MdEdit />
                                </button>
                            </div>

                            {/* tarjetas */}

                            {phase.areas.map((area) => {
                                const areaInfo =
                                areas.find(
                                        (item) =>
                                            item.id === area.areaId
                                );
                                const userInfo =
                                    users.find(
                                        (item) =>
                                            item.id === area.personId
                                );
                                return (
                                    <FlowCard
                                        key={area.id}
                                        area={
                                            areaInfo?.name ??
                                            "Área"
                                        }
                                        title={
                                            area.title
                                        }
                                        person={
                                            userInfo?.name ??
                                            "Sin asignar"
                                        }
                                        initials={
                                            userInfo?.initials ??
                                            "--"
                                        }
                                        input={
                                            area.input
                                        }
                                        output={
                                            area.output
                                        }
                                        days={
                                            `${area.days} día${area.days !== 1 ? "s" : ""} hábil${area.days !== 1 ? "es" : ""}`
                                        }
                                        active={
                                            area.active
                                        }
                                        onEdit={() =>
                                            handleOpenEditArea(
                                                area,
                                                phase
                                            )
                                        }
                                    />
                                );
                            })}

                            {/*agregar área*/}

                            <button
                                type="button"
                                className="add-area-button"
                                onClick={() =>
                                    handleOpenAddArea(
                                        phase
                                    )
                                }
                            >
                                Agregar área
                            </button>


                        </section>

                    ))}

                    {/*agregar fase */}

                    <section className="add-phase-column">
                        <button
                            type="button"
                            className="add-phase-button"
                            onClick={() =>
                                handleOpenPhaseModal()
                            }
                        >
                            <strong>
                                Agregar fase
                            </strong>

                            <span>
                                El proceso puede crecer

                                <br />
                                sin cambiar de forma
                            </span>
                        </button>
                    </section>
                </div>
            </main>

            {/* =================================================
                FOOTER
                ================================================= */}

            <footer className="flow-footer">


                <span>
                    Ninguna área avanza sin entregar su salida
                    — aunque la salida sea solo evidencia.
                </span>


                <button type="button" className="footer-button">
                    Guardar este flujo como plantilla
                </button>


            </footer>


            {/* =================================================
                MODAL DE ÁREA
                ================================================= */}

            {showAreaModal && (

                <FlowModal

                    type="area"

                    onClose={
                        handleCloseAreaModal
                    }

                    onSubmit={
                        handleSubmitArea
                    }

                >


                    {/* =========================================
                        ÁREA
                        ========================================= */}

                    <div className="modal-field">


                        <label>
                            Área
                        </label>


                        <select
                            name="areaId"
                            defaultValue={
                                selectedArea?.areaId ?? ""
                            }
                            required
                        >

                            <option value="">
                                Selecciona un área
                            </option>


                            {areas.map((area) => (

                                <option
                                    key={area.id}
                                    value={area.id}
                                >
                                    {area.name}
                                </option>

                            ))}


                        </select>


                    </div>


                    {/* =========================================
                        TÍTULO
                        ========================================= */}

                    <div className="modal-field">


                        <label>
                            Título
                        </label>


                        <input
                            name="title"
                            type="text"
                            defaultValue={
                                selectedArea?.title ?? ""
                            }
                            placeholder="Ej. Revisión de solicitud"
                            required
                        />


                    </div>


                    {/* =========================================
                        RESPONSABLE
                        ========================================= */}

                    <div className="modal-field">


                        <label>
                            Persona responsable
                        </label>


                        <select
                            name="personId"
                            defaultValue={
                                selectedArea?.personId ?? ""
                            }
                            required
                        >

                            <option value="">
                                Selecciona una persona
                            </option>


                            {users.map((user) => (

                                <option
                                    key={user.id}
                                    value={user.id}
                                >
                                    {user.name}
                                </option>

                            ))}


                        </select>


                    </div>


                    {/* =========================================
                        ENTRADA / SALIDA
                        ========================================= */}

                    <div className="modal-row">


                        <div className="modal-field">


                            <label>
                                Entrada
                            </label>


                            <input
                                name="input"
                                type="text"
                                defaultValue={
                                    selectedArea?.input ?? ""
                                }
                                placeholder="Documento inicial"
                                required
                            />


                        </div>


                        <div className="modal-field">


                            <label>
                                Salida
                            </label>


                            <input
                                name="output"
                                type="text"
                                defaultValue={
                                    selectedArea?.output ?? ""
                                }
                                placeholder="Entregable final"
                                required
                            />


                        </div>


                    </div>


                    {/* =========================================
                        DÍAS
                        ========================================= */}

                    <div className="modal-field">


                        <label>
                            Fecha en días
                        </label>


                        <div className="days-input">


                            <input
                                name="days"
                                type="number"
                                min="1"
                                defaultValue={
                                    selectedArea?.days ?? 1
                                }
                                required
                            />


                            <span>
                                días
                            </span>


                        </div>


                    </div>


                    {/* =========================================
                        BOTONES
                        ========================================= */}

                    <div className="modal-actions">


                        <button
                            type="button"
                            className="modal-cancel"
                            onClick={
                                handleCloseAreaModal
                            }
                        >
                            Cancelar
                        </button>


                        <button
                            type="submit"
                            className="modal-primary"
                        >

                            {selectedArea
                                ? "Guardar cambios"
                                : "+ Agregar área"
                            }

                        </button>


                    </div>


                </FlowModal>

            )}


            {/* =================================================
                MODAL DE FASE
                ================================================= */}

            {showPhaseModal && (

                <FlowModal

                    type="phase"

                    onClose={
                        handleClosePhaseModal
                    }

                    onSubmit={
                        handleSubmitPhase
                    }

                >


                    <div className="modal-field">


                        <label htmlFor="phase-name">
                            Nombre de la fase
                        </label>


                        <input
                            id="phase-name"
                            name="phaseName"
                            type="text"
                            value={phaseName}
                            onChange={(event) =>
                                setPhaseName(
                                    event.target.value
                                )
                            }
                            placeholder="Ej. REVISIÓN"
                            autoFocus
                            required
                        />


                    </div>


                    <div className="modal-actions">


                        <button
                            type="button"
                            className="modal-cancel"
                            onClick={
                                handleClosePhaseModal
                            }
                        >
                            Cancelar
                        </button>


                        <button
                            type="submit"
                            className="modal-primary"
                        >

                            {selectedPhase
                                ? "Guardar cambios"
                                : "+ Agregar fase"
                            }

                        </button>


                    </div>


                </FlowModal>

            )}


        </div>
    );
}


export default FlowDesigner;