import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import SchemaEditor from "./schemaEditor.jsx";
import "./schemas.css";

// Los formatos de solicitud (RF-SOL-01). Un formato es la identidad; lo que pide vive en sus
// versiones, y una versión publicada no se edita: "editar" es publicar la siguiente, para que
// lo capturado con la anterior siga leyéndose como se capturó.
//
// Clonar es lo que hace de un formato una plantilla: el nuevo empieza con los campos del
// último del otro. Los cinco formatos sembrados están precisamente para eso.
function Schemas() {
  const [formatos, setFormatos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Qué está abierto: null, { modo: "nuevo" }, { modo: "version", formato } o
  // { modo: "clon", formato }.
  const [panel, setPanel] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorPanel, setErrorPanel] = useState(null);

  const [nuevo, setNuevo] = useState({ code: "", name: "" });
  const [versiones, setVersiones] = useState({ formatoId: null, lista: [] });

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const [formatosRes, tiposRes] = await Promise.all([api.listSchemas(), api.listDataTypes()]);
        if (cancelado) return;
        setFormatos(formatosRes.schemas);
        setTipos(tiposRes.dataTypes);
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
  }, []);

  async function recargar() {
    const { schemas } = await api.listSchemas();
    setFormatos(schemas);
  }

  function abrir(modo, formato = null) {
    setPanel({ modo, formato });
    setErrorPanel(null);
    setNuevo({ code: "", name: formato ? `${formato.name} (copia)` : "" });
  }

  async function crear(campos) {
    setGuardando(true);
    setErrorPanel(null);
    try {
      await api.createSchema({ code: nuevo.code, name: nuevo.name, fields: campos });
      await recargar();
      setPanel(null);
      setAviso("Formato creado.");
    } catch (fallo) {
      setErrorPanel(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  async function publicarVersion(campos) {
    setGuardando(true);
    setErrorPanel(null);
    try {
      await api.createSchemaVersion(panel.formato.id, campos);
      await recargar();
      setPanel(null);
      setAviso(
        "Formato actualizado. Se publicó una versión nueva y la anterior quedó intacta, así que " +
          "lo capturado con ella se sigue leyendo igual.",
      );
    } catch (fallo) {
      setErrorPanel(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  async function clonar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setErrorPanel(null);
    try {
      await api.cloneSchema(panel.formato.id, nuevo.code, nuevo.name);
      await recargar();
      setPanel(null);
      setAviso("Formato clonado con los campos del original.");
    } catch (fallo) {
      setErrorPanel(fallo.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(formato) {
    setError(null);
    try {
      if (formato.isActive) await api.deleteSchema(formato.id);
      else await api.updateSchema(formato.id, { isActive: true });
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function verVersiones(formato) {
    if (versiones.formatoId === formato.id) {
      setVersiones({ formatoId: null, lista: [] });
      return;
    }
    try {
      const { versions } = await api.listSchemaVersions(formato.id);
      setVersiones({ formatoId: formato.id, lista: versions });
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  if (cargando) return <p className="schemas-loading">Cargando formatos...</p>;

  return (
    <section className="schemas">
      <header className="schemas-header">
        <h2 className="schemas-title">Esquemas de datos</h2>
        <button type="button" onClick={() => abrir("nuevo")}>
          Nuevo formato
        </button>
      </header>

      {error ? <p className="schemas-error">{error}</p> : null}
      {aviso ? <p className="schemas-notice">{aviso}</p> : null}

      <table className="schemas-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Clave</th>
            <th>Versión</th>
            <th>Campos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {formatos.map((formato) => (
            <tr className="schemas-row" key={formato.id}>
              <td>{formato.name}</td>
              <td className="schemas-code">{formato.code}</td>
              <td>{formato.version ?? "—"}</td>
              <td>
                {formato.fields
                  ? `${formato.fields.deliverables.length} entregables, ${formato.fields.information.length} de información`
                  : "sin versión"}
              </td>
              <td>{formato.isActive ? "Activo" : "Inactivo"}</td>
              <td className="schemas-actions">
                <button type="button" onClick={() => verVersiones(formato)}>
                  {versiones.formatoId === formato.id ? "Ocultar versiones" : "Versiones"}
                </button>
                <button
                  type="button"
                  onClick={() => abrir("version", formato)}
                  disabled={!formato.isActive}
                >
                  Actualizar
                </button>
                <button type="button" onClick={() => abrir("clon", formato)}>
                  Clonar
                </button>
                <button type="button" onClick={() => cambiarActivo(formato)}>
                  {formato.isActive ? "Desactivar" : "Reactivar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {versiones.formatoId !== null ? (
        <div className="schemas-versions">
          <h3>Versiones</h3>
          <ul>
            {versiones.lista.map((version) => (
              <li key={version.id}>
                v{version.version} — {version.fields.deliverables.length} entregables,{" "}
                {version.fields.information.length} de información
                {version.publishedAt
                  ? ` — publicada el ${new Date(version.publishedAt).toLocaleDateString()}`
                  : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {panel?.modo === "nuevo" ? (
        <div className="schemas-panel">
          <label className="schemas-field">
            Clave del formato
            <input
              value={nuevo.code}
              onChange={(evento) => setNuevo({ ...nuevo, code: evento.target.value })}
              placeholder="papel_institucional"
            />
          </label>
          <label className="schemas-field">
            Nombre
            <input
              value={nuevo.name}
              onChange={(evento) => setNuevo({ ...nuevo, name: evento.target.value })}
              placeholder="Papel institucional"
            />
          </label>

          <SchemaEditor
            tipos={tipos}
            titulo="Campos del formato"
            onGuardar={crear}
            onCancelar={() => setPanel(null)}
            error={errorPanel}
            guardando={guardando}
          />
        </div>
      ) : null}

      {panel?.modo === "version" ? (
        <div className="schemas-panel">
          <p className="schemas-panel-help">
            Actualizar <strong>{panel.formato.name}</strong>. Los campos se guardan como una
            versión nueva y la anterior no se toca: lo capturado con ella se sigue leyendo como se
            capturó.
          </p>
          <SchemaEditor
            tipos={tipos}
            inicial={panel.formato.fields ?? undefined}
            titulo={`Campos del formato (quedará como versión ${(panel.formato.version ?? 0) + 1})`}
            onGuardar={publicarVersion}
            onCancelar={() => setPanel(null)}
            error={errorPanel}
            guardando={guardando}
          />
        </div>
      ) : null}

      {panel?.modo === "clon" ? (
        <form className="schemas-panel" onSubmit={clonar}>
          <p className="schemas-panel-help">
            El formato nuevo empieza con los campos de <strong>{panel.formato.name}</strong>.
          </p>
          <label className="schemas-field">
            Clave del formato nuevo
            <input
              value={nuevo.code}
              onChange={(evento) => setNuevo({ ...nuevo, code: evento.target.value })}
              required
            />
          </label>
          <label className="schemas-field">
            Nombre
            <input
              value={nuevo.name}
              onChange={(evento) => setNuevo({ ...nuevo, name: evento.target.value })}
              required
            />
          </label>
          {errorPanel ? <p className="schemas-error">{errorPanel}</p> : null}
          <div className="schemas-panel-actions">
            <button type="submit" disabled={guardando}>
              {guardando ? "Clonando..." : "Clonar"}
            </button>
            <button type="button" onClick={() => setPanel(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default Schemas;
