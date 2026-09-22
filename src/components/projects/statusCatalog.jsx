import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./statusCatalog.css";

// El catálogo de estatus (RF-EST-02), editable desde aquí porque es donde se usa.
//
// Sin área es el catálogo global, del que parten todas; con área, los de esa área, que puede
// reusar un código global. Nada se borra: los proyectos y las solicitudes apuntan a estas
// filas, así que dar de baja es desactivar, y ni el código ni el área se editan —son bajo lo
// que se archivó lo anterior—.
const NUEVO_VACIO = { code: "", label: "", sortOrder: 0, isTerminal: false };

function StatusCatalog({ areas }) {
  const [areaId, setAreaId] = useState("");
  const [estatus, setEstatus] = useState([]);
  const [verInactivos, setVerInactivos] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO_VACIO);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const { statuses } = await api.listStatuses({
          areaId,
          includeInactive: verInactivos ? "true" : "",
        });
        if (!cancelado) setEstatus(statuses);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [areaId, verInactivos, version]);

  async function agregar(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      await api.createStatus({
        areaId: areaId === "" ? null : Number(areaId),
        code: nuevo.code,
        label: nuevo.label,
        sortOrder: Number(nuevo.sortOrder),
        isTerminal: nuevo.isTerminal,
      });
      setNuevo(NUEVO_VACIO);
      setVersion((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function editar(uno, cambios) {
    setError(null);
    try {
      await api.updateStatus(uno.id, cambios);
      setVersion((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function cambiarActivo(uno) {
    setError(null);
    try {
      if (uno.isActive) await api.deleteStatus(uno.id);
      else await api.updateStatus(uno.id, { isActive: true });
      setVersion((actual) => actual + 1);
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  return (
    <section className="status-catalog">
      <h3 className="status-catalog-title">Catálogo de estatus</h3>
      <p className="status-catalog-help">
        Sin área es el catálogo global, del que parten todas. Un área puede reusar un código
        global. Los estatus no se borran: se desactivan, porque los proyectos y las solicitudes
        que ya los usaron los siguen nombrando.
      </p>

      <div className="status-catalog-filters">
        <label className="status-catalog-filter">
          Catálogo
          <select value={areaId} onChange={(evento) => setAreaId(evento.target.value)}>
            <option value="">Global</option>
            {areas.map((area) => (
              <option value={area.id} key={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="status-catalog-filter">
          <input
            type="checkbox"
            checked={verInactivos}
            onChange={(evento) => setVerInactivos(evento.target.checked)}
          />
          Ver también los inactivos
        </label>
      </div>

      {error ? <p className="status-catalog-error">{error}</p> : null}

      <table className="status-catalog-table">
        <thead>
          <tr>
            <th>Etiqueta</th>
            <th>Código</th>
            <th>Orden</th>
            <th>Cierra</th>
            <th>Catálogo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {estatus.map((uno) => (
            <tr className={`status-row ${uno.isActive ? "" : "status-row-inactive"}`} key={uno.id}>
              <td>
                <input
                  className="status-input"
                  defaultValue={uno.label}
                  onBlur={(evento) => {
                    if (evento.target.value !== uno.label) editar(uno, { label: evento.target.value });
                  }}
                />
              </td>
              <td className="status-code">{uno.code}</td>
              <td>
                <input
                  className="status-input status-input-short"
                  type="number"
                  defaultValue={uno.sortOrder}
                  onBlur={(evento) => {
                    if (Number(evento.target.value) !== uno.sortOrder) {
                      editar(uno, { sortOrder: Number(evento.target.value) });
                    }
                  }}
                />
              </td>
              <td className="status-cell-center">
                <input
                  type="checkbox"
                  checked={uno.isTerminal}
                  onChange={(evento) => editar(uno, { isTerminal: evento.target.checked })}
                />
              </td>
              <td>{uno.isGlobal ? "Global" : uno.areaName}</td>
              <td>
                {/* Un estatus global solo se toca desde el catálogo global. */}
                <button type="button" onClick={() => cambiarActivo(uno)}>
                  {uno.isActive ? "Desactivar" : "Reactivar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="status-catalog-new" onSubmit={agregar}>
        <h4>Agregar al catálogo {areaId === "" ? "global" : "del área"}</h4>

        <label className="status-catalog-field">
          Etiqueta
          <input
            value={nuevo.label}
            onChange={(evento) => setNuevo({ ...nuevo, label: evento.target.value })}
            placeholder="En prensa"
            required
          />
        </label>

        <label className="status-catalog-field">
          Código
          <input
            value={nuevo.code}
            onChange={(evento) => setNuevo({ ...nuevo, code: evento.target.value })}
            placeholder="en_prensa"
            required
          />
        </label>

        <label className="status-catalog-field">
          Orden
          <input
            type="number"
            value={nuevo.sortOrder}
            onChange={(evento) => setNuevo({ ...nuevo, sortOrder: evento.target.value })}
          />
        </label>

        <label className="status-catalog-field">
          <input
            type="checkbox"
            checked={nuevo.isTerminal}
            onChange={(evento) => setNuevo({ ...nuevo, isTerminal: evento.target.checked })}
          />
          Con este estatus el trabajo se considera cerrado
        </label>

        <button type="submit" disabled={ocupado}>
          Agregar
        </button>
      </form>
    </section>
  );
}

export default StatusCatalog;
