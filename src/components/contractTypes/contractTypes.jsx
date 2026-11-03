import { useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdSearch,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
  MdClose,
  MdSave,
  MdInfoOutline,
  MdCalendarMonth,
  MdWorkOutline,
  MdDescription,
} from "react-icons/md";

import * as api from "../../api/client.js";
import "./contractTypes.css";

// configuración inicial para la demostración.
// Los beneficios comienzan sin configurar; no son datos oficiales.
const CONFIGURACION_INICIAL = {
  description: "",
  vacationDays: "",
  sickDays: "",
  calendar: "uaq",
  vacationStart: "",
  vacationEnd: "",
};

function crearConfiguracion(contrato) {
  return {
    ...CONFIGURACION_INICIAL,
    id: contrato.id,
    name: contrato.name,
    description: contrato.description ?? "",
  };
}

function ContractTypes() {
  const [contratos, setContratos] = useState([]);
  const [configuraciones, setConfiguraciones] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminados, setEliminados] = useState([]);

  // carga los tipos de contrato reales
  useEffect(() => {
    let cancelado = false;

    async function cargarContratos() {
      try {
        const respuesta = await api.listContractTypes();

        if (cancelado) return;

        const lista = respuesta.contractTypes ?? [];

        setContratos(lista);
        setError("");
      } catch (err) {
        if (!cancelado) {
          setError(err.message || "No se pudieron cargar los contratos.");
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    cargarContratos();

    return () => {
      cancelado = true;
    };
  }, []);

  const contratosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return contratos.filter(
      (contrato) =>
        !eliminados.includes(contrato.id) && contrato.name.toLowerCase().includes(texto),
    );
  }, [contratos, busqueda, eliminados]);

  function obtenerConfiguracion(contrato) {
    return configuraciones[contrato.id] ?? crearConfiguracion(contrato);
  }

  function abrirEditor(contrato) {
    setConfirmandoEliminar(false); 

    if (abierto === contrato.id) {
      cerrarEditor();
      return;
    }

    setAbierto(contrato.id);
    setForm({ ...obtenerConfiguracion(contrato) });
    setMensaje("");
  }

  function cerrarEditor() {
    setConfirmandoEliminar(false); 
    setAbierto(null);
    setForm(null);
    setMensaje("");
  }

  function cambiarCampo(campo, valor) {
    setForm((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    setMensaje("");
  }

  //ELIMINACIÓN TEMPORAL de la interfaz
  //Esto únicamente quitará el contrato de la lista visible. No lo eliminará del servidor, y volverá a aparecer al recargar la página.
  function eliminarContrato() {
    if (!form) return;

    setEliminados((actual) => [...actual, form.id]);
    setConfirmandoEliminar(false);
    cerrarEditor();
  }

  function guardarCambios(event) {
    event.preventDefault();

    if (!form) return;

    const vacaciones = Number(form.vacationDays);
    const enfermedad = Number(form.sickDays);

    if (
      form.vacationDays === "" ||
      form.sickDays === "" ||
      !Number.isInteger(vacaciones) ||
      !Number.isInteger(enfermedad) ||
      vacaciones < 0 ||
      enfermedad < 0
    ) {
      setMensaje("Introduce cantidades válidas de días de vacaciones y enfermedad.");
      return;
    }

    if (
      (form.vacationStart && !form.vacationEnd) ||
      (!form.vacationStart && form.vacationEnd)
    ) {
      setMensaje("Debes seleccionar tanto el inicio como el fin de vacaciones.");
      return;
    }

    if (form.vacationStart && form.vacationEnd && form.vacationEnd < form.vacationStart) {
      setMensaje("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }

    setGuardando(true);

    // guarda datos temporal en React.
    // todo: Aquí conectaremos el endpoint de actualización posteriormente.
    setConfiguraciones((actual) => ({
      ...actual,
      [form.id]: {
        ...form,
        vacationDays: vacaciones,
        sickDays: enfermedad,
      },
    }));

    setGuardando(false);
    setMensaje("Cambios guardados temporalmente.");
  }

  function mostrarDias(valor) {
    if (valor === "" || valor == null) {
      return "Sin configurar";
    }

    return `${valor} ${Number(valor) === 1 ? "día" : "días"}`;
  }

  function mostrarPeriodo(configuracion) {
    if (!configuracion.vacationStart || !configuracion.vacationEnd) {
      return "Sin configurar";
    }

    function fechaCorta(valor) {
      const [anio, mes, dia] = valor.split("-");
      return `${dia}/${mes}/${anio}`;
    }

    return (
      `${fechaCorta(configuracion.vacationStart)} – ` +
      `${fechaCorta(configuracion.vacationEnd)}`
    );
  }

  return (
    <section className="contract-types">
      <div className="contract-types-toolbar">
        <div className="contract-types-summary">
          <span>
            {contratos.length}{" "}
            {contratos.length === 1 ? "tipo de contrato" : "tipos de contrato"}
          </span>

          <p>
            Selecciona un contrato para configurar sus beneficios y periodos vacacionales.
          </p>
        </div>

        <button
          type="button"
          className="contract-types-new"
          disabled
          title="La creación de contratos se habilitará al conectar el backend."
        >
          <MdAdd />
          Nuevo tipo de contrato
        </button>
      </div>

      <div className="contract-types-search">
        <MdSearch />
        <input
          type="search"
          placeholder="Buscar tipo de contrato..."
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
        />
      </div>

      {error && (
        <p className="contract-types-error" role="alert">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="contract-types-message">Cargando tipos de contrato...</p>
      ) : (
        <div className="contract-types-table-wrapper">
          <table className="contract-types-table">
            <thead>
              <tr>
                <th>Tipo de contrato</th>
                <th>Días de vacaciones</th>
                <th>Días de enfermedad</th>
                <th>Calendario</th>
                <th>Periodo vacacional</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>

            <tbody>
              {contratosFiltrados.map((contrato) => {
                const configuracion = obtenerConfiguracion(contrato);

                const expandido = abierto === contrato.id;

                return (
                  <tr
                    key={contrato.id}
                    className={expandido ? "contract-types-row-expanded" : ""}
                  >
                    <td colSpan={6} className="contract-types-row-cell">
                      <div className="contract-types-row-content">
                        <button
                          type="button"
                          className="contract-types-row-button"
                          onClick={() => abrirEditor(contrato)}
                          aria-expanded={expandido}
                        >
                          <span className="contract-types-name">
                            <MdWorkOutline />
                            <strong>{contrato.name}</strong>
                          </span>

                          <span>{mostrarDias(configuracion.vacationDays)}</span>

                          <span>{mostrarDias(configuracion.sickDays)}</span>

                          <span>
                            <span
                              className={
                                "contract-types-badge " +
                                (configuracion.calendar === "uaq" ? "uaq" : "independent")
                              }
                            >
                              {configuracion.calendar === "uaq"
                                ? "Calendario UAQ"
                                : "Independiente"}
                            </span>
                          </span>

                          <span>{mostrarPeriodo(configuracion)}</span>

                          <span className="contract-types-arrow">
                            {expandido ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                          </span>
                        </button>
                      </div>

                      {expandido && form && (
                        <form className="contract-types-editor" onSubmit={guardarCambios}>
                          <div className="contract-types-editor-header">
                            <div>
                              <span className="contract-types-eyebrow">
                                EDITANDO TIPO DE CONTRATO
                              </span>
                              <h2>{contrato.name}</h2>
                            </div>

                            <button
                              type="button"
                              className="contract-types-close"
                              onClick={cerrarEditor}
                              aria-label="Cerrar editor"
                            >
                              <MdClose />
                            </button>
                          </div>

                          <div className="contract-types-editor-body">
                            <div className="contract-types-editor-left">
                              <h3>Información del contrato</h3>

                              <label
                                className="contract-types-label"
                                htmlFor="contract-name"
                              >
                                Nombre del tipo de contrato
                              </label>

                              <input
                                id="contract-name"
                                className="contract-types-input"
                                value={form.name}
                                readOnly
                              />

                              <p className="contract-types-hint">
                                El nombre se obtiene del catálogo registrado en el
                                sistema.
                              </p>

                              <label
                                className="contract-types-label"
                                htmlFor="contract-description"
                              >
                                Descripción
                              </label>

                              <textarea
                                id="contract-description"
                                className="contract-types-textarea"
                                placeholder="Describe las características de este contrato..."
                                value={form.description}
                                onChange={(event) =>
                                  cambiarCampo("description", event.target.value)
                                }
                                rows={4}
                              />
                            </div>

                            <div className="contract-types-editor-right">
                              <h3>Beneficios del contrato</h3>

                              <div className="contract-types-fields">
                                <div className="contract-types-field">
                                  <label htmlFor="contract-vacation-days">
                                    Días de vacaciones
                                  </label>

                                  <input
                                    id="contract-vacation-days"
                                    type="number"
                                    min="0"
                                    step="1"
                                    required
                                    className="contract-types-input"
                                    value={form.vacationDays}
                                    onChange={(event) =>
                                      cambiarCampo("vacationDays", event.target.value)
                                    }
                                    placeholder="0"
                                  />
                                </div>

                                <div className="contract-types-field">
                                  <label htmlFor="contract-sick-days">
                                    Días de enfermedad
                                  </label>

                                  <input
                                    id="contract-sick-days"
                                    type="number"
                                    min="0"
                                    step="1"
                                    required
                                    className="contract-types-input"
                                    value={form.sickDays}
                                    onChange={(event) =>
                                      cambiarCampo("sickDays", event.target.value)
                                    }
                                    placeholder="0"
                                  />
                                </div>
                              </div>

                              <div className="contract-types-divider" />

                              <h3>
                                Configuración de vacaciones
                                <MdInfoOutline title="Determina si este contrato sigue el calendario institucional." />
                              </h3>

                              <div className="contract-types-radio-group">
                                <label>
                                  <input
                                    type="radio"
                                    name="contract-calendar"
                                    value="uaq"
                                    checked={form.calendar === "uaq"}
                                    onChange={() => cambiarCampo("calendar", "uaq")}
                                  />
                                  <span>
                                    <strong>Sigue el calendario UAQ</strong>
                                    <small>
                                      Se rige por los periodos institucionales.
                                    </small>
                                  </span>
                                </label>

                                <label>
                                  <input
                                    type="radio"
                                    name="contract-calendar"
                                    value="independent"
                                    checked={form.calendar === "independent"}
                                    onChange={() =>
                                      cambiarCampo("calendar", "independent")
                                    }
                                  />
                                  <span>
                                    <strong>Calendario independiente</strong>
                                    <small>
                                      No sigue automáticamente el calendario
                                      institucional.
                                    </small>
                                  </span>
                                </label>
                              </div>

                              <div className="contract-types-fields">
                                <div className="contract-types-field">
                                  <label htmlFor="contract-start">
                                    Inicio de vacaciones
                                  </label>

                                  <div className="contract-types-date">
                                    <input
                                      id="contract-start"
                                      type="date"
                                      className="contract-types-input"
                                      value={form.vacationStart}
                                      onChange={(event) =>
                                        cambiarCampo("vacationStart", event.target.value)
                                      }
                                    />
                                    <MdCalendarMonth />
                                  </div>
                                </div>

                                <div className="contract-types-field">
                                  <label htmlFor="contract-end">Fin de vacaciones</label>

                                  <div className="contract-types-date">
                                    <input
                                      id="contract-end"
                                      type="date"
                                      className="contract-types-input"
                                      min={form.vacationStart || undefined}
                                      value={form.vacationEnd}
                                      onChange={(event) =>
                                        cambiarCampo("vacationEnd", event.target.value)
                                      }
                                    />
                                    <MdCalendarMonth />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="contract-types-editor-footer">
                            {/*eliminar contrato */}
                            <div className="contract-types-delete-area">
                              {!confirmandoEliminar ? (
                                <button
                                  type="button"
                                  className="contract-types-delete"
                                  onClick={() => setConfirmandoEliminar(true)}
                                >
                                  Eliminar tipo de contrato
                                </button>
                              ) : (
                                <div className="contract-types-delete-confirm">
                                  <span>¿Eliminar este contrato de la lista?</span>

                                  <button
                                    type="button"
                                    onClick={() => setConfirmandoEliminar(false)}
                                  >
                                    Cancelar
                                  </button>

                                  <button
                                    type="button"
                                    className="contract-types-delete-confirm-button"
                                    onClick={eliminarContrato}
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              )}
                            </div>

                            <p className="contract-types-save-note">
                              {mensaje ||
                                "Los cambios son temporales y no se guardan en el servidor."}
                            </p>

                            <div className="contract-types-actions">
                              <button
                                type="button"
                                className="contract-types-cancel"
                                onClick={cerrarEditor}
                              >
                                Descartar
                              </button>

                              <button
                                type="submit"
                                className="contract-types-save"
                                disabled={guardando}
                              >
                                <MdSave />
                                {guardando ? "Guardando..." : "Guardar cambios"}
                              </button>
                            </div>
                          </div>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {contratosFiltrados.length === 0 && (
            <p className="contract-types-message">No se encontraron tipos de contrato.</p>
          )}
        </div>
      )}
    </section>
  );
}

export default ContractTypes;
