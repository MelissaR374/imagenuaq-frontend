// La ventana para agregar o editar una etapa: qué área la hace, quién, qué datos necesita y
// cuáles entrega, sus notas y cuántos días hábiles toma. La usan el diseñador de flujos y la ficha
// del proyecto; aquí solo se edita la etapa, y quien abre la ventana decide qué hacer al guardar.
//
// Un dato se busca por su nombre. Si no existe, se registra aquí mismo con su nombre y su tipo
// (DATAMODEL §2.13b): así el proyecto sabe cómo se llama y qué pedir, en vez de mostrar una clave.
import { useEffect, useState } from "react";

import {
    MdClose,
} from "react-icons/md";

import * as api from "../../api/client.js";
import FlowModal from "./FlowModal.jsx";

/**
 * Una lista de datos: se agregan buscando por nombre entre los que ya existen, o registrando uno
 * nuevo con su nombre y su tipo, y se quitan uno por uno.
 */
function ListaDeClaves({ id, etiqueta, ayuda, claves, vocabulario, tipos, onCambiar, onCreada }) {
    const [texto, setTexto] = useState("");
    const [nuevo, setNuevo] = useState(null);
    const [error, setError] = useState(null);
    const [ocupado, setOcupado] = useState(false);

    function nombreDe(clave) {
        return vocabulario.find((una) => una.key === clave)?.name ?? clave;
    }

    function poner(clave) {
        if (!claves.includes(clave)) onCambiar([...claves, clave]);
        setTexto("");
        setNuevo(null);
        setError(null);
    }

    function agregar() {
        const buscado = texto.trim();
        if (buscado === "") return;
        const minusculas = buscado.toLowerCase();
        const existente = vocabulario.find(
            (una) => una.name.toLowerCase() === minusculas || una.key === buscado,
        );
        if (existente) {
            poner(existente.key);
            return;
        }
        setNuevo({ name: buscado, type: "text" });
    }

    async function crear() {
        setOcupado(true);
        setError(null);
        try {
            const { fieldKey } = await api.createFieldKey(nuevo);
            onCreada(fieldKey);
            poner(fieldKey.key);
        } catch (falla) {
            setError(falla.message);
        } finally {
            setOcupado(false);
        }
    }

    return (
        <div className="modal-field flow-key-list">
            <label htmlFor={id}>{etiqueta}</label>
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
                                aria-label={`Quitar ${nombreDe(clave)}`}
                            >
                                <MdClose />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <div className="flow-key-add">
                <input
                    id={id}
                    type="text"
                    list="flujo-vocabulario"
                    value={texto}
                    onChange={(event) => {
                        setTexto(event.target.value);
                        setNuevo(null);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            agregar();
                        }
                    }}
                    placeholder="Ej. Número de orden"
                />
                <button type="button" className="modal-cancel" onClick={agregar}>
                    Agregar
                </button>
            </div>

            {nuevo === null ? null : (
                <div className="flow-key-new">
                    <p className="flow-field-help">
                        «{nuevo.name}» todavía no existe. Regístralo para que el proyecto sepa cómo
                        se llama y qué tipo de valor pedir.
                    </p>
                    <div className="flow-key-new-row">
                        <label>
                            Nombre
                            <input
                                type="text"
                                value={nuevo.name}
                                maxLength={200}
                                onChange={(event) => setNuevo({ ...nuevo, name: event.target.value })}
                            />
                        </label>
                        <label>
                            Tipo
                            <select
                                value={nuevo.type}
                                onChange={(event) => setNuevo({ ...nuevo, type: event.target.value })}
                            >
                                {tipos.map((tipo) => (
                                    <option key={tipo.code} value={tipo.code}>{tipo.name}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {error === null ? null : <p className="flow-key-error">{error}</p>}
                    <div className="flow-key-new-actions">
                        <button type="button" className="modal-cancel" onClick={() => setNuevo(null)}>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="modal-primary"
                            onClick={crear}
                            disabled={ocupado || nuevo.name.trim() === ""}
                        >
                            Registrar y agregar
                        </button>
                    </div>
                </div>
            )}
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
 * @param {object[]} props.vocabulario Los datos conocidos, `{ key, name, type }`.
 * @param {(() => void)|null} [props.onQuitar] Sin él no se ofrece quitar la etapa.
 * @param {((dato: object) => void)|null} [props.onDatoNuevo] Avisa del dato que se registró aquí.
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
    onDatoNuevo = null,
    children = null,
}) {
    const [tipos, setTipos] = useState([]);
    const [creados, setCreados] = useState([]);

    useEffect(() => {
        let cancelado = false;
        api.listDataTypes()
            .then((respuesta) => {
                if (!cancelado) setTipos(respuesta.dataTypes.filter((tipo) => tipo.isActive));
            })
            .catch(() => {});
        return () => {
            cancelado = true;
        };
    }, []);

    const conocidos = [
        ...vocabulario,
        ...creados.filter((dato) => !vocabulario.some((una) => una.key === dato.key)),
    ];

    function registrado(dato) {
        setCreados([...creados, dato]);
        if (onDatoNuevo !== null) onDatoNuevo(dato);
    }

    return (
        <>
            <datalist id="flujo-vocabulario">
                {conocidos.map((una) => (
                    <option key={una.key} value={una.name} />
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
                    Lo que la etapa recibe y entrega se anota de dos formas. Los
                    <strong> datos</strong> son valores que alguien escribe en el proyecto, como
                    el número de orden o el costo total: búscalos por su nombre o registra uno
                    nuevo. Las <strong>notas</strong> describen con tus palabras lo que no es un
                    dato: una aprobación, un archivo, una muestra física. Quien atiende la etapa
                    las ve junto a lo que tiene que entregar.
                </p>

                <ListaDeClaves
                    id="etapa-datos-entrada"
                    etiqueta="Datos que necesita para empezar"
                    ayuda="Solo informan a quien atiende la etapa; que falte uno no detiene el trabajo."
                    claves={etapa.inputs}
                    vocabulario={conocidos}
                    tipos={tipos}
                    onCambiar={(claves) => onCambiar("inputs", claves)}
                    onCreada={registrado}
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
                    id="etapa-datos-salida"
                    etiqueta="Datos que debe capturar al terminar"
                    ayuda="Quien atiende la etapa los escribe al entregarla; el visto bueno no se puede dar mientras falte alguno."
                    claves={etapa.outputs}
                    vocabulario={conocidos}
                    tipos={tipos}
                    onCambiar={(claves) => onCambiar("outputs", claves)}
                    onCreada={registrado}
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
