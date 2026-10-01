// Diseñador de plantillas de flujo (RF-FLW-02, RF-PRY-06).
//
// Un flujo son fases en orden: las etapas de una fase trabajan en paralelo y la siguiente
// fase empieza cuando la anterior terminó. Cada etapa dice qué área la hace, quién suele
// hacerla, qué datos necesita y cuáles entrega (claves del vocabulario de los formatos, más
// una nota para leer) y cuántos días hábiles toma.
//
// Lo que se edita vive solo aquí hasta que se guarda. Guardar publica una versión nueva de la
// plantilla con el flujo completo; las versiones anteriores no cambian, así que un proyecto
// que ya salió de una no se mueve.
//
// Con `solicitud` edita el flujo de esa solicitud en vez de una plantilla: parte de una
// plantilla o de cero, y guardar reemplaza el flujo de la solicitud, que es el que decide a
// qué bandejas cae y el que se lleva el proyecto al convertirla.
import { useEffect, useState } from "react";

import {
    MdKeyboardArrowDown,
    MdEdit,
    MdClose,
} from "react-icons/md";

import FlowCard from "./FlowCard.jsx";
import FlowModal from "./FlowModal.jsx";

import * as api from "../../api/client.js";

import "./FlowDesigner.css";

// Clave local para React: las fases y etapas nuevas todavía no tienen id del servidor.
function nuevaClave() {
    return `${Date.now()}-${Math.random()}`;
}

// El organigrama es un árbol; aquí se necesita una lista de áreas con sus miembros.
function aplanar(nodos, acumulado = []) {
    for (const nodo of nodos) {
        acumulado.push({ id: nodo.id, name: nodo.name, members: nodo.members ?? [] });
        aplanar(nodo.children ?? [], acumulado);
    }
    return acumulado;
}

// "Manual de identidad" -> "manual_identidad": un código sugerido a partir del nombre.
function codigoDesde(nombre) {
    return nombre
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
}

function iniciales(nombre) {
    if (!nombre) return "--";
    return nombre
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte[0])
        .join("")
        .toUpperCase();
}

// Lo que manda el servidor, en la forma que usa el lienzo.
function fasesDesde(workflow) {
    return (workflow.phases ?? []).map((fase) => ({
        clave: String(fase.id),
        name: fase.name,
        etapas: fase.stages.map((etapa) => ({
            clave: String(etapa.id),
            areaId: etapa.areaId,
            title: etapa.title,
            defaultAssigneeId: etapa.defaultAssigneeId,
            inputs: etapa.inputs,
            outputs: etapa.outputs,
            inputNote: etapa.inputNote ?? "",
            outputNote: etapa.outputNote ?? "",
            estimatedDays: etapa.estimatedDays,
        })),
    }));
}

// Lo que se publica: el flujo completo, en el orden en que se ve.
function carga(fases) {
    return fases.map((fase) => ({
        name: fase.name,
        stages: fase.etapas.map((etapa) => ({
            areaId: Number(etapa.areaId),
            title: etapa.title,
            defaultAssigneeId: etapa.defaultAssigneeId ? Number(etapa.defaultAssigneeId) : null,
            inputs: etapa.inputs,
            outputs: etapa.outputs,
            inputNote: etapa.inputNote || null,
            outputNote: etapa.outputNote || null,
            estimatedDays: Number(etapa.estimatedDays),
        })),
    }));
}

function etapaVacia(areas) {
    return {
        clave: nuevaClave(),
        areaId: areas[0]?.id ?? "",
        title: "",
        defaultAssigneeId: "",
        inputs: [],
        outputs: [],
        inputNote: "",
        outputNote: "",
        estimatedDays: 1,
    };
}

function lienzoNuevo() {
    return [{ clave: nuevaClave(), name: "Fase 1", etapas: [] }];
}

// Una lista de claves de datos: se agregan desde el vocabulario (o escribiendo una nueva) y
// se quitan una por una.
function ListaDeClaves({ etiqueta, ayuda, claves, vocabulario, onCambiar }) {
    const [texto, setTexto] = useState("");

    function agregar() {
        const clave = texto.trim();
        if (clave && !claves.includes(clave)) onCambiar([...claves, clave]);
        setTexto("");
    }

    function nombreDe(clave) {
        return vocabulario.find((una) => una.key === clave)?.name ?? clave;
    }

    return (
        <div className="modal-field flow-key-list">
            <label>{etiqueta}</label>
            <p className="flow-field-help">{ayuda}</p>

            {claves.length > 0 && (
                <ul className="flow-key-chips">
                    {claves.map((clave) => (
                        <li key={clave} className="flow-key-chip">
                            <span>{nombreDe(clave)}</span>
                            <button
                                type="button"
                                className="flow-key-remove"
                                onClick={() => onCambiar(claves.filter((otra) => otra !== clave))}
                                aria-label={`Quitar ${clave}`}
                            >
                                <MdClose />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flow-key-add">
                <input
                    type="text"
                    list="flujo-vocabulario"
                    value={texto}
                    onChange={(event) => setTexto(event.target.value)}
                    onKeyDown={(event) => {
                        // Enter agrega la clave en vez de mandar el formulario.
                        if (event.key === "Enter") {
                            event.preventDefault();
                            agregar();
                        }
                    }}
                    placeholder="clave_del_dato"
                />
                <button type="button" className="modal-cancel" onClick={agregar}>
                    Agregar
                </button>
            </div>
        </div>
    );
}

function FlowDesigner({ solicitud = null, onGuardado, onCerrar }) {
    const deSolicitud = solicitud !== null;

    // Catálogos
    const [plantillas, setPlantillas] = useState([]);
    const [areas, setAreas] = useState([]);
    const [vocabulario, setVocabulario] = useState([]);

    // La plantilla abierta: null es una nueva que todavía no se guarda.
    const [plantillaId, setPlantillaId] = useState(null);
    const [version, setVersion] = useState(null);
    const [fases, setFases] = useState(() =>
        solicitud?.flow ? fasesDesde(solicitud.flow) : lienzoNuevo()
    );
    const [cambiado, setCambiado] = useState(false);

    // En una solicitud: la plantilla de la que se partió, mientras no se le cambie nada. Así se
    // guarda como copia de esa plantilla y la solicitud recuerda de dónde salió su flujo.
    const [origenId, setOrigenId] = useState(null);

    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);

    // La ventana abierta, con lo que se está editando en ella, o null.
    const [modal, setModal] = useState(null);
    const [modalError, setModalError] = useState(null);

    useEffect(() => {
        let cancelado = false;

        async function cargar() {
            try {
                const [lista, organigrama, claves] = await Promise.all([
                    api.listWorkflows(),
                    api.getOrgChart(),
                    api.listFieldKeys(),
                ]);
                if (cancelado) return;
                setPlantillas(lista.workflows);
                setAreas(aplanar(organigrama.roots));
                setVocabulario(claves.fieldKeys);

                // En una solicitud el lienzo ya trae su flujo; no se abre ninguna plantilla.
                if (deSolicitud) return;

                // Abre la primera plantilla, si hay alguna.
                const primera = lista.workflows.find((una) => una.isActive) ?? lista.workflows[0];
                if (primera) {
                    const respuesta = await api.getWorkflow(primera.id);
                    if (cancelado) return;
                    abrir(respuesta.workflow);
                }
            } catch (fallo) {
                if (!cancelado) setError(fallo.message);
            } finally {
                if (!cancelado) setCargando(false);
            }
        }

        cargar();
        return () => {
            cancelado = true;
        };
    }, [deSolicitud]);

    function abrir(workflow) {
        setPlantillaId(workflow.id);
        setVersion(workflow.version);
        setFases(fasesDesde(workflow));
        setCambiado(false);
    }

    // Toda llamada al servidor pasa por aquí: marca ocupado y muestra el error si falla.
    async function hacer(accion, { enModal = false } = {}) {
        setOcupado(true);
        setError(null);
        setModalError(null);
        try {
            await accion();
            return true;
        } catch (fallo) {
            if (enModal) setModalError(fallo.message);
            else setError(fallo.message);
            return false;
        } finally {
            setOcupado(false);
        }
    }

    async function recargarLista() {
        const lista = await api.listWorkflows();
        setPlantillas(lista.workflows);
    }

    // Cambiar de plantilla descarta lo que no se guardó, así que primero se pregunta.
    function puedeDescartar() {
        return !cambiado || window.confirm("Hay cambios sin guardar. ¿Descartarlos?");
    }

    function elegirPlantilla(id) {
        if (!puedeDescartar()) return;
        hacer(async () => {
            const respuesta = await api.getWorkflow(id);
            abrir(respuesta.workflow);
        });
    }

    function nuevaPlantilla() {
        if (!puedeDescartar()) return;
        setPlantillaId(null);
        setVersion(null);
        setFases(lienzoNuevo());
        setCambiado(false);
        setError(null);
    }

    function cambiarFases(nuevas) {
        setFases(nuevas);
        setCambiado(true);
        setOrigenId(null);
    }

    function cerrarModal() {
        setModal(null);
        setModalError(null);
    }

    // --- Guardar ---

    function guardar() {
        if (deSolicitud) {
            guardarEnSolicitud();
            return;
        }
        if (plantillaId === null) {
            abrirGuardarComo();
            return;
        }
        hacer(async () => {
            const respuesta = await api.publishWorkflowVersion(plantillaId, carga(fases));
            abrir({ ...respuesta.version, id: plantillaId });
            await recargarLista();
        });
    }

    // El flujo de la solicitud se reemplaza entero. Si es una plantilla tal cual, se guarda
    // como copia de ella para que la solicitud recuerde de dónde salió.
    function guardarEnSolicitud() {
        hacer(async () => {
            const cuerpo = origenId !== null ? { workflowId: origenId } : { phases: carga(fases) };
            const respuesta = await api.setRequestFlow(solicitud.id, cuerpo);
            setCambiado(false);
            onGuardado?.(respuesta.request);
        });
    }

    function cerrar() {
        if (!puedeDescartar()) return;
        onCerrar?.();
    }

    // En una solicitud, partir de una plantilla carga su última versión en el lienzo; no se
    // crea nada en el servidor hasta guardar.
    function abrirCargarPlantilla() {
        if (!puedeDescartar()) return;
        const activa = plantillas.find((una) => una.isActive);
        setModal({ tipo: "cargar", origenId: activa?.id ?? "" });
    }

    async function cargarPlantilla(event) {
        event.preventDefault();
        const hecho = await hacer(async () => {
            const respuesta = await api.getWorkflow(Number(modal.origenId));
            // Claves nuevas: son etapas de esta solicitud, no las de la plantilla.
            setFases(fasesDesde(respuesta.workflow).map((fase) => ({
                ...fase,
                clave: nuevaClave(),
                etapas: fase.etapas.map((etapa) => ({ ...etapa, clave: nuevaClave() })),
            })));
            setCambiado(true);
            setOrigenId(respuesta.workflow.id);
        }, { enModal: true });
        if (hecho) cerrarModal();
    }

    function abrirGuardarComo() {
        setModal({ tipo: "plantilla", name: "", code: "", codeTocado: false });
    }

    async function guardarComo(event) {
        event.preventDefault();
        const hecho = await hacer(async () => {
            const respuesta = await api.createWorkflow({
                code: modal.code,
                name: modal.name,
                phases: carga(fases),
            });
            abrir(respuesta.workflow);
            await recargarLista();
        }, { enModal: true });
        if (hecho) cerrarModal();
    }

    // --- Partir de una plantilla ---

    function abrirClonar() {
        if (!puedeDescartar()) return;
        setModal({ tipo: "clonar", origenId: plantillaId ?? plantillas[0]?.id ?? "", name: "", code: "", codeTocado: false });
    }

    async function clonar(event) {
        event.preventDefault();
        const hecho = await hacer(async () => {
            const respuesta = await api.cloneWorkflow(Number(modal.origenId), modal.code, modal.name);
            abrir(respuesta.workflow);
            await recargarLista();
        }, { enModal: true });
        if (hecho) cerrarModal();
    }

    // El código se sugiere desde el nombre hasta que alguien lo escribe a mano.
    function cambiarNombreModal(name) {
        setModal({ ...modal, name, code: modal.codeTocado ? modal.code : codigoDesde(name) });
    }

    // --- Fases ---

    function abrirFase(fase = null) {
        setModal({ tipo: "fase", faseClave: fase?.clave ?? null, name: fase?.name ?? "" });
    }

    function guardarFase(event) {
        event.preventDefault();
        const name = modal.name.trim();
        if (!name) return;

        if (modal.faseClave) {
            cambiarFases(fases.map((fase) => (fase.clave === modal.faseClave ? { ...fase, name } : fase)));
        } else {
            cambiarFases([...fases, { clave: nuevaClave(), name, etapas: [] }]);
        }
        cerrarModal();
    }

    function quitarFase(fase) {
        if (fase.etapas.length > 0 && !window.confirm(`¿Quitar "${fase.name}" y sus etapas?`)) return;
        cambiarFases(fases.filter((otra) => otra.clave !== fase.clave));
    }

    // --- Etapas ---

    function abrirEtapa(fase, etapa = null) {
        setModal({
            tipo: "etapa",
            faseClave: fase.clave,
            editando: etapa !== null,
            etapa: etapa ? { ...etapa } : etapaVacia(areas),
        });
    }

    function cambiarEtapa(clave, valor) {
        const etapa = { ...modal.etapa, [clave]: valor };
        // Si la persona sugerida no es del área nueva, se quita.
        if (clave === "areaId") {
            const area = areas.find((una) => String(una.id) === String(valor));
            const sigue = area?.members.some((m) => String(m.id) === String(etapa.defaultAssigneeId));
            if (!sigue) etapa.defaultAssigneeId = "";
        }
        setModal({ ...modal, etapa });
    }

    function guardarEtapa(event) {
        event.preventDefault();
        const etapa = modal.etapa;
        cambiarFases(fases.map((fase) => {
            if (fase.clave !== modal.faseClave) return fase;
            const etapas = modal.editando
                ? fase.etapas.map((otra) => (otra.clave === etapa.clave ? etapa : otra))
                : [...fase.etapas, etapa];
            return { ...fase, etapas };
        }));
        cerrarModal();
    }

    function quitarEtapa(fase, etapa) {
        cambiarFases(fases.map((otra) =>
            otra.clave === fase.clave
                ? { ...otra, etapas: otra.etapas.filter((una) => una.clave !== etapa.clave) }
                : otra
        ));
    }

    // --- Lo que se muestra ---

    function nombreDeArea(areaId) {
        return areas.find((area) => String(area.id) === String(areaId))?.name ?? "Área";
    }

    function nombreDePersona(areaId, personaId) {
        if (!personaId) return null;
        const area = areas.find((una) => String(una.id) === String(areaId));
        return area?.members.find((m) => String(m.id) === String(personaId))?.fullName ?? null;
    }

    function nombreDeClave(clave) {
        return vocabulario.find((una) => una.key === clave)?.name ?? clave;
    }

    const areasDistintas = new Set(fases.flatMap((fase) => fase.etapas.map((etapa) => String(etapa.areaId)))).size;

    // Las etapas de una fase trabajan a la vez, así que la fase dura lo que su etapa más larga.
    const totalDays = fases.reduce(
        (total, fase) => total + Math.max(0, ...fase.etapas.map((etapa) => Number(etapa.estimatedDays) || 0)),
        0
    );

    const plantillaActual = plantillas.find((una) => una.id === plantillaId);
    const miembrosDelArea =
        modal?.tipo === "etapa"
            ? areas.find((area) => String(area.id) === String(modal.etapa.areaId))?.members ?? []
            : [];

    if (cargando) return <p className="flow-loading">Cargando...</p>;

    return (

        <div className="flow-page">
            <header className="flow-header">
                <div className="flow-heading">
                    <h1 className="flow-title">
                        {deSolicitud ? "Flujo de la solicitud" : "Diseño de flujos"}
                    </h1>
                    <span className="flow-eyebrow">
                        {deSolicitud
                            ? `${solicitud.folio} · ${solicitud.title}`
                            : plantillaId === null
                                ? "PLANTILLA NUEVA · SIN GUARDAR"
                                : `GUARDAR PUBLICA UNA VERSIÓN NUEVA · VERSIÓN ${version}`}
                        {cambiado ? " · CAMBIOS SIN GUARDAR" : ""}
                    </span>

                    {/* La plantilla abierta */}
                    {!deSolicitud && (
                        <select
                            className="flow-template-picker"
                            value={plantillaId ?? ""}
                            onChange={(event) => elegirPlantilla(Number(event.target.value))}
                            disabled={ocupado}
                        >
                            {plantillaId === null && (
                                <option value="">Plantilla nueva</option>
                            )}
                            {plantillas.map((una) => (
                                <option key={una.id} value={una.id}>
                                    {una.name}{una.isActive ? "" : " (inactiva)"}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="flow-actions">
                    {deSolicitud ? (
                        <button
                            type="button"
                            className="template-button"
                            onClick={cerrar}
                            disabled={ocupado}
                        >
                            Volver a la solicitud
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="template-button"
                            onClick={nuevaPlantilla}
                            disabled={ocupado}
                        >
                            Nueva plantilla
                        </button>
                    )}
                    <button
                        type="button"
                        className="template-button"
                        onClick={deSolicitud ? abrirCargarPlantilla : abrirClonar}
                        disabled={ocupado || plantillas.length === 0}
                    >
                        Partir de una plantilla
                        <MdKeyboardArrowDown />
                    </button>
                    <button
                        type="button"
                        className="save-button"
                        onClick={guardar}
                        disabled={ocupado}
                    >
                        {ocupado ? "Guardando..." : "Guardar flujo"}
                    </button>
                </div>
            </header>

            {error && <p className="flow-error">{error}</p>}

            {/* resumen */}

            <div className="flow-summary">
                <div className="summary-text">
                    <span>
                        Pasa por <strong>{areasDistintas}</strong> áreas
                    </span>
                    <span>
                        en <strong>{fases.length}</strong> fases
                    </span>
                    <span>
                        {totalDays} días hábiles estimados
                    </span>
                </div>
                {plantillaActual && !plantillaActual.isActive && (
                    <span className="flow-inactive">
                        Esta plantilla está inactiva: no admite versiones nuevas.
                    </span>
                )}
            </div>

            {/* canvas*/}
            <main className="flow-canvas">
                <div className="phase-columns">

                    {fases.map((fase) => (
                        <section className="phase-column" key={fase.clave}>

                            {/* titulo de fase */}
                            <div className="phase-title">
                                <span>{fase.name}</span>
                                <button
                                    type="button"
                                    className="phase-edit-button"
                                    title="Editar fase"
                                    onClick={() => abrirFase(fase)}
                                >
                                    <MdEdit />
                                </button>
                                <button
                                    type="button"
                                    className="phase-remove-button"
                                    title="Quitar fase"
                                    onClick={() => quitarFase(fase)}
                                >
                                    <MdClose />
                                </button>
                            </div>

                            {/* tarjetas */}
                            {fase.etapas.map((etapa) => {
                                const persona = nombreDePersona(etapa.areaId, etapa.defaultAssigneeId);
                                const dias = Number(etapa.estimatedDays);
                                return (
                                    <FlowCard
                                        key={etapa.clave}
                                        area={nombreDeArea(etapa.areaId)}
                                        title={etapa.title}
                                        person={persona ?? "Sin persona sugerida"}
                                        initials={iniciales(persona)}
                                        entradas={etapa.inputs.map(nombreDeClave)}
                                        salidas={etapa.outputs.map(nombreDeClave)}
                                        notaEntrada={etapa.inputNote}
                                        notaSalida={etapa.outputNote}
                                        days={`${dias} día${dias !== 1 ? "s" : ""} hábil${dias !== 1 ? "es" : ""}`}
                                        onEdit={() => abrirEtapa(fase, etapa)}
                                        onRemove={() => quitarEtapa(fase, etapa)}
                                    />
                                );
                            })}

                            {/*agregar etapa*/}
                            <button
                                type="button"
                                className="add-area-button"
                                onClick={() => abrirEtapa(fase)}
                                disabled={areas.length === 0}
                            >
                                Agregar etapa
                            </button>

                        </section>
                    ))}

                    {/*agregar fase */}
                    <section className="add-phase-column">
                        <button
                            type="button"
                            className="add-phase-button"
                            onClick={() => abrirFase()}
                        >
                            <strong>Agregar fase</strong>
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
                <button
                    type="button"
                    className="footer-button"
                    onClick={abrirGuardarComo}
                    disabled={ocupado}
                >
                    Guardar este flujo como plantilla nueva
                </button>
            </footer>

            {/* Las claves que ya existen en algún formato, para elegirlas en vez de inventarlas. */}
            <datalist id="flujo-vocabulario">
                {vocabulario.map((una) => (
                    <option key={una.key} value={una.key}>
                        {una.name} ({una.type})
                    </option>
                ))}
            </datalist>

            {/* =================================================
                MODAL DE ETAPA
                ================================================= */}

            {modal?.tipo === "etapa" && (
                <FlowModal
                    type="area"
                    titulo={modal.editando ? "Editar etapa" : "Agregar etapa"}
                    descripcion="Define qué hará esta área dentro del flujo."
                    onClose={cerrarModal}
                    onSubmit={guardarEtapa}
                >
                    <div className="modal-field">
                        <label htmlFor="etapa-area">Área</label>
                        <select
                            id="etapa-area"
                            value={modal.etapa.areaId}
                            onChange={(event) => cambiarEtapa("areaId", event.target.value)}
                            required
                        >
                            {areas.map((area) => (
                                <option key={area.id} value={area.id}>{area.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="modal-field">
                        <label htmlFor="etapa-titulo">Título</label>
                        <input
                            id="etapa-titulo"
                            type="text"
                            value={modal.etapa.title}
                            onChange={(event) => cambiarEtapa("title", event.target.value)}
                            placeholder="Ej. Revisión de solicitud"
                            maxLength={300}
                            required
                        />
                    </div>

                    <div className="modal-field">
                        {/* En una solicitud es quien la va a hacer; en una plantilla, una sugerencia. */}
                        <label htmlFor="etapa-persona">
                            {deSolicitud ? "Persona responsable" : "Persona sugerida"}
                        </label>
                        <select
                            id="etapa-persona"
                            value={modal.etapa.defaultAssigneeId ?? ""}
                            onChange={(event) => cambiarEtapa("defaultAssigneeId", event.target.value)}
                        >
                            <option value="">{deSolicitud ? "Sin responsable todavía" : "Sin persona sugerida"}</option>
                            {miembrosDelArea.map((miembro) => (
                                <option key={miembro.id} value={miembro.id}>{miembro.fullName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Qué recibe y qué entrega la etapa, de dos maneras: como datos que el
                        sistema revisa, o como una nota que solo se lee. */}
                    <p className="flow-field-help">
                        Lo que la etapa recibe y entrega se puede anotar de dos formas. Los
                        <strong> datos</strong> son valores que se capturan en el proyecto, como
                        el número de orden o el tiraje, y se nombran con una clave (por ejemplo,
                        numero_orden); elige una de las que ya usan los formatos o escribe una
                        nueva. Las <strong>notas</strong> describen con tus palabras lo que no es
                        un dato: una aprobación, un archivo, una muestra física o la evidencia de
                        entrega.
                    </p>

                    <ListaDeClaves
                        etiqueta="Datos que necesita para empezar"
                        ayuda="Solo informan a quien atiende la etapa; que falte uno no detiene el trabajo."
                        claves={modal.etapa.inputs}
                        vocabulario={vocabulario}
                        onCambiar={(claves) => cambiarEtapa("inputs", claves)}
                    />

                    <div className="modal-field">
                        <label htmlFor="etapa-nota-entrada">Qué recibe (nota)</label>
                        <textarea
                            id="etapa-nota-entrada"
                            rows={3}
                            value={modal.etapa.inputNote}
                            onChange={(event) => cambiarEtapa("inputNote", event.target.value)}
                            placeholder="Ej. La cotización firmada por la entidad"
                            maxLength={2000}
                        />
                    </div>

                    <ListaDeClaves
                        etiqueta="Datos que debe capturar al terminar"
                        ayuda="El visto bueno de la etapa no se puede dar mientras alguno siga sin valor en el proyecto."
                        claves={modal.etapa.outputs}
                        vocabulario={vocabulario}
                        onCambiar={(claves) => cambiarEtapa("outputs", claves)}
                    />

                    <div className="modal-field">
                        <label htmlFor="etapa-nota-salida">Qué entrega (nota)</label>
                        <p className="flow-field-help">
                            Para señalar una entrega que no se captura como dato. Queda como aviso
                            para quien lee el flujo; el sistema no la revisa.
                        </p>
                        <textarea
                            id="etapa-nota-salida"
                            rows={3}
                            value={modal.etapa.outputNote}
                            onChange={(event) => cambiarEtapa("outputNote", event.target.value)}
                            placeholder="Ej. Propuesta aprobada por la entidad, o 300 manuales impresos con su evidencia de entrega"
                            maxLength={2000}
                        />
                    </div>

                    <div className="modal-field">
                        <label htmlFor="etapa-dias">Duración</label>
                        <div className="days-input">
                            <input
                                id="etapa-dias"
                                type="number"
                                min="1"
                                max="365"
                                value={modal.etapa.estimatedDays}
                                onChange={(event) => cambiarEtapa("estimatedDays", event.target.value)}
                                required
                            />
                            <span>días hábiles</span>
                        </div>
                    </div>

                    <div className="modal-actions">
                        {modal.editando && (
                            <button
                                type="button"
                                className="modal-cancel flow-modal-remove"
                                onClick={() => {
                                    const fase = fases.find((una) => una.clave === modal.faseClave);
                                    quitarEtapa(fase, modal.etapa);
                                    cerrarModal();
                                }}
                            >
                                Quitar esta etapa
                            </button>
                        )}
                        <button type="button" className="modal-cancel" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-primary">
                            {modal.editando ? "Guardar cambios" : "+ Agregar etapa"}
                        </button>
                    </div>
                </FlowModal>
            )}

            {/* =================================================
                MODAL DE FASE
                ================================================= */}

            {modal?.tipo === "fase" && (
                <FlowModal
                    type="phase"
                    titulo={modal.faseClave ? "Editar fase" : "Agregar fase"}
                    descripcion="Las etapas de una fase trabajan al mismo tiempo."
                    onClose={cerrarModal}
                    onSubmit={guardarFase}
                >
                    <div className="modal-field">
                        <label htmlFor="phase-name">Nombre de la fase</label>
                        <input
                            id="phase-name"
                            type="text"
                            value={modal.name}
                            onChange={(event) => setModal({ ...modal, name: event.target.value })}
                            placeholder="Ej. REVISIÓN"
                            maxLength={100}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="modal-cancel" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-primary">
                            {modal.faseClave ? "Guardar cambios" : "+ Agregar fase"}
                        </button>
                    </div>
                </FlowModal>
            )}

            {/* =================================================
                MODAL DE PLANTILLA NUEVA (guardar como)
                ================================================= */}

            {modal?.tipo === "plantilla" && (
                <FlowModal
                    type="phase"
                    titulo="Guardar como plantilla nueva"
                    descripcion="Se publica como la versión 1 de una plantilla nueva."
                    error={modalError}
                    onClose={cerrarModal}
                    onSubmit={guardarComo}
                >
                    <div className="modal-field">
                        <label htmlFor="plantilla-nombre">Nombre</label>
                        <input
                            id="plantilla-nombre"
                            type="text"
                            value={modal.name}
                            onChange={(event) => cambiarNombreModal(event.target.value)}
                            placeholder="Ej. Manual de identidad"
                            maxLength={300}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="modal-field">
                        <label htmlFor="plantilla-codigo">Código</label>
                        <input
                            id="plantilla-codigo"
                            type="text"
                            value={modal.code}
                            onChange={(event) => setModal({ ...modal, code: event.target.value, codeTocado: true })}
                            maxLength={50}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="modal-cancel" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-primary" disabled={ocupado}>
                            {ocupado ? "Guardando..." : "Guardar"}
                        </button>
                    </div>
                </FlowModal>
            )}

            {/* =================================================
                MODAL DE CARGAR UNA PLANTILLA (en una solicitud)
                ================================================= */}

            {modal?.tipo === "cargar" && (
                <FlowModal
                    type="phase"
                    titulo="Partir de una plantilla"
                    descripcion="Su última versión se copia en el lienzo; puedes ajustarla antes de guardar."
                    error={modalError}
                    onClose={cerrarModal}
                    onSubmit={cargarPlantilla}
                >
                    <div className="modal-field">
                        <label htmlFor="cargar-origen">Plantilla</label>
                        <select
                            id="cargar-origen"
                            value={modal.origenId}
                            onChange={(event) => setModal({ ...modal, origenId: event.target.value })}
                            required
                        >
                            {plantillas.filter((una) => una.isActive).map((una) => (
                                <option key={una.id} value={una.id}>{una.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="modal-cancel" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-primary" disabled={ocupado}>
                            {ocupado ? "Cargando..." : "Usar esta plantilla"}
                        </button>
                    </div>
                </FlowModal>
            )}

            {/* =================================================
                MODAL DE PARTIR DE UNA PLANTILLA
                ================================================= */}

            {modal?.tipo === "clonar" && (
                <FlowModal
                    type="phase"
                    titulo="Partir de una plantilla"
                    descripcion="Se crea una plantilla nueva con la última versión de la que elijas."
                    error={modalError}
                    onClose={cerrarModal}
                    onSubmit={clonar}
                >
                    <div className="modal-field">
                        <label htmlFor="clonar-origen">Plantilla de origen</label>
                        <select
                            id="clonar-origen"
                            value={modal.origenId}
                            onChange={(event) => setModal({ ...modal, origenId: event.target.value })}
                            required
                        >
                            {plantillas.map((una) => (
                                <option key={una.id} value={una.id}>{una.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="modal-field">
                        <label htmlFor="clonar-nombre">Nombre de la nueva</label>
                        <input
                            id="clonar-nombre"
                            type="text"
                            value={modal.name}
                            onChange={(event) => cambiarNombreModal(event.target.value)}
                            maxLength={300}
                            autoFocus
                            required
                        />
                    </div>
                    <div className="modal-field">
                        <label htmlFor="clonar-codigo">Código</label>
                        <input
                            id="clonar-codigo"
                            type="text"
                            value={modal.code}
                            onChange={(event) => setModal({ ...modal, code: event.target.value, codeTocado: true })}
                            maxLength={50}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="modal-cancel" onClick={cerrarModal}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-primary" disabled={ocupado}>
                            {ocupado ? "Creando..." : "Crear"}
                        </button>
                    </div>
                </FlowModal>
            )}
        </div>
    );
}


export default FlowDesigner;
