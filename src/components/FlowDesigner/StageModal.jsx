// La ventana para agregar o editar una etapa: qué área la hace, quién, qué datos necesita y
// cuáles entrega, sus notas y cuántos días hábiles toma. La usan el diseñador de flujos y la ficha
// del proyecto; aquí solo se edita la etapa, y quien abre la ventana decide qué hacer al guardar.
import { useState } from "react";

import {
    MdClose,
} from "react-icons/md";

import FlowModal from "./FlowModal.jsx";

/**
 * Una lista de claves de datos: se agregan desde el vocabulario (o escribiendo una nueva) y
 * se quitan una por una.
 */
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

/**
 * La ventana de una etapa. `etapa` es el borrador con `areaId`, `title`, `defaultAssigneeId`,
 * `inputs`, `outputs`, `inputNote`, `outputNote` y `estimatedDays`; cada cambio llega por
 * `onCambiar(campo, valor)`. `children` son campos de más que se muestran bajo el título.
 *
 * @param {object} props
 * @param {object[]} props.miembros Las personas del área elegida, `{ id, fullName }`.
 * @param {object[]} props.vocabulario Las claves conocidas, `{ key, name, type }`.
 * @param {(() => void)|null} [props.onQuitar] Sin él no se ofrece quitar la etapa.
 */
function StageModal({
    etapa,
    editando = false,
    areas,
    miembros,
    vocabulario,
    etiquetaPersona,
    sinPersona,
    onCambiar,
    onClose,
    onSubmit,
    onQuitar = null,
    children = null,
}) {
    return (
        <>
            <datalist id="flujo-vocabulario">
                {vocabulario.map((una) => (
                    <option key={una.key} value={una.key}>
                        {una.name} ({una.type})
                    </option>
                ))}
            </datalist>

            <FlowModal
                type="area"
                titulo={editando ? "Editar etapa" : "Agregar etapa"}
                descripcion="Define qué hará esta área dentro del flujo."
                onClose={onClose}
                onSubmit={onSubmit}
            >
                <div className="modal-field">
                    <label htmlFor="etapa-area">Área</label>
                    <select
                        id="etapa-area"
                        value={etapa.areaId}
                        onChange={(event) => onCambiar("areaId", event.target.value)}
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
                        value={etapa.title}
                        onChange={(event) => onCambiar("title", event.target.value)}
                        placeholder="Ej. Revisión de solicitud"
                        maxLength={300}
                        required
                    />
                </div>

                {children}

                <div className="modal-field">
                    <label htmlFor="etapa-persona">
                        {etiquetaPersona}
                    </label>
                    <select
                        id="etapa-persona"
                        value={etapa.defaultAssigneeId ?? ""}
                        onChange={(event) => onCambiar("defaultAssigneeId", event.target.value)}
                    >
                        <option value="">{sinPersona}</option>
                        {miembros.map((miembro) => (
                            <option key={miembro.id} value={miembro.id}>{miembro.fullName}</option>
                        ))}
                    </select>
                </div>

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
                    claves={etapa.inputs}
                    vocabulario={vocabulario}
                    onCambiar={(claves) => onCambiar("inputs", claves)}
                />

                <div className="modal-field">
                    <label htmlFor="stage-note-input">Qué recibe (nota)</label>
                    <textarea
                        id="stage-note-input"
                        rows={3}
                        value={etapa.inputNote}
                        onChange={(event) => onCambiar("inputNote", event.target.value)}
                        placeholder="Ej. La cotización firmada por la entidad"
                        maxLength={2000}
                    />
                </div>

                <ListaDeClaves
                    etiqueta="Datos que debe capturar al terminar"
                    ayuda="El visto bueno de la etapa no se puede dar mientras alguno siga sin valor en el proyecto."
                    claves={etapa.outputs}
                    vocabulario={vocabulario}
                    onCambiar={(claves) => onCambiar("outputs", claves)}
                />

                <div className="modal-field">
                    <label htmlFor="stage-note-output">Qué entrega (nota)</label>
                    <p className="flow-field-help">
                        Para señalar una entrega que no se captura como dato. Queda como aviso
                        para quien lee el flujo; el sistema no la revisa.
                    </p>
                    <textarea
                        id="stage-note-output"
                        rows={3}
                        value={etapa.outputNote}
                        onChange={(event) => onCambiar("outputNote", event.target.value)}
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
                            value={etapa.estimatedDays}
                            onChange={(event) => onCambiar("estimatedDays", event.target.value)}
                            required
                        />
                        <span>días hábiles</span>
                    </div>
                </div>

                <div className="modal-actions">
                    {editando && onQuitar !== null && (
                    <button
                        type="button"
                        className="modal-cancel flow-modal-remove"
                        onClick={onQuitar}
                    >
                        Quitar esta etapa
                    </button>
                )}
                <button type="button" className="modal-cancel" onClick={onClose}>
                        Cancelar
                    </button>
                    <button type="submit" className="modal-primary">
                        {editando ? "Guardar cambios" : "+ Agregar etapa"}
                    </button>
                </div>
            </FlowModal>
        </>
    );
}

export default StageModal;
