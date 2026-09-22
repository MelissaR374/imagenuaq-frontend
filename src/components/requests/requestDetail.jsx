import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import RequesterInput from "./requesterInput.jsx";
import "./requestDetail.css";

// Una solicitud con todo lo que trae, y el paso a proyecto.
//
// Lo capturado se muestra con los campos del formato con el que se capturó, no con el formato
// de hoy: una versión publicada no se edita, así que una solicitud vieja se sigue leyendo como
// se llenó. Lo que venga de una hoja trae además el renglón crudo, con las columnas que el
// mapeo ignoró (RF-SOL-06).
function RequestDetail({ solicitud, areas, onCerrar, onCambio }) {
  const [detalle, setDetalle] = useState(solicitud);
  const [estatus, setEstatus] = useState([]);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [verCrudo, setVerCrudo] = useState(false);

  // El formulario de conversión: lo que se omite lo toma de la solicitud.
  const [convertir, setConvertir] = useState(null);
  const [conflictos, setConflictos] = useState([]);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      try {
        const [{ request }, { statuses }] = await Promise.all([
          api.getRequest(solicitud.id),
          api.listStatuses(solicitud.areaId ? { areaId: solicitud.areaId } : {}),
        ]);
        if (cancelado) return;
        setDetalle(request);
        setEstatus(statuses);
      } catch (fallo) {
        if (!cancelado) setError(fallo.message);
      }
    }

    cargar();
    return () => {
      cancelado = true;
    };
  }, [solicitud.id, solicitud.areaId]);

  async function recargar() {
    const { request } = await api.getRequest(detalle.id);
    setDetalle(request);
    onCambio();
  }

  async function cambiarEstatus(statusId) {
    setOcupado(true);
    setError(null);
    try {
      await api.setRequestStatus(detalle.id, Number(statusId));
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  async function corregirSolicitante(requester) {
    setError(null);
    try {
      await api.updateRequest(detalle.id, { requester });
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    }
  }

  async function eliminar() {
    setOcupado(true);
    setError(null);
    try {
      await api.deleteRequest(detalle.id);
      onCambio();
      onCerrar();
    } catch (fallo) {
      setError(fallo.message);
      setOcupado(false);
    }
  }

  async function convertirEnProyecto(evento) {
    evento.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      const respuesta = await api.convertRequest(detalle.id, {
        key: convertir.key || undefined,
        title: convertir.title || undefined,
        requester: convertir.requester || undefined,
        hasCost: convertir.hasCost,
        stages:
          convertir.areaId === ""
            ? []
            : [{ areaId: Number(convertir.areaId), title: convertir.stageTitle || "Primera etapa" }],
      });
      setConflictos(respuesta.conflicts);
      setConvertir(null);
      await recargar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }

  // Los campos del formato, en el orden en que se capturaron, con su valor.
  const campos = detalle.fields
    ? [...detalle.fields.deliverables, ...detalle.fields.information]
    : [];

  return (
    <section className="request-detail">
      <header className="request-detail-header">
        <h3 className="request-detail-title">
          {detalle.folio} — {detalle.title}
        </h3>
        <button type="button" onClick={onCerrar}>
          Cerrar
        </button>
      </header>

      {error ? <p className="request-detail-error">{error}</p> : null}

      <dl className="request-detail-facts">
        <dt>Formato</dt>
        <dd>
          {detalle.schemaName} (v{detalle.schemaVersion})
        </dd>

        <dt>Solicitante</dt>
        <dd>
          <RequesterInput
            id={`solicitante-${detalle.id}`}
            value={detalle.requester ?? ""}
            onChange={(requester) => setDetalle({ ...detalle, requester })}
          />
          <button
            type="button"
            onClick={() => corregirSolicitante(detalle.requester)}
            disabled={ocupado}
          >
            Guardar solicitante
          </button>
        </dd>

        <dt>Área</dt>
        <dd>{detalle.areaName ?? "sin área"}</dd>

        <dt>Estatus</dt>
        <dd>
          <select
            value={detalle.statusId}
            onChange={(evento) => cambiarEstatus(evento.target.value)}
            disabled={ocupado}
          >
            {estatus.map((uno) => (
              <option value={uno.id} key={uno.id}>
                {uno.label}
                {uno.isGlobal ? "" : " (del área)"}
              </option>
            ))}
          </select>
        </dd>

        <dt>Cómo llegó</dt>
        <dd>
          {detalle.source}
          {detalle.sheetName ? ` — ${detalle.sheetName}` : null}
        </dd>

        <dt>Prioridad</dt>
        <dd>{detalle.priority}</dd>

        {detalle.duplicateOfFolio ? (
          <>
            <dt>Posible duplicado de</dt>
            <dd>{detalle.duplicateOfFolio}</dd>
          </>
        ) : null}

        {detalle.projectKey ? (
          <>
            <dt>Proyecto</dt>
            <dd>
              {detalle.projectKey} — {detalle.projectTitle}
            </dd>
          </>
        ) : null}
      </dl>

      <h4 className="request-detail-subtitle">Lo capturado</h4>
      <table className="request-detail-data">
        <tbody>
          {campos.map((campo) => (
            <tr key={campo.code}>
              <th>{campo.name}</th>
              <td>{formatearValor(detalle.data?.[campo.code])}</td>
            </tr>
          ))}
          {/* Lo que el formato ya no pide pero la captura sí trae: no se pierde nada. */}
          {Object.entries(detalle.data ?? {})
            .filter(([clave]) => !campos.some((campo) => campo.code === clave))
            .map(([clave, valor]) => (
              <tr className="request-detail-extra" key={clave}>
                <th>{clave} (fuera del formato)</th>
                <td>{formatearValor(valor)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {detalle.sourceData ? (
        <div className="request-detail-raw">
          <button type="button" onClick={() => setVerCrudo(!verCrudo)}>
            {verCrudo ? "Ocultar el renglón original" : "Ver el renglón original de la hoja"}
          </button>
          {verCrudo ? (
            <table className="request-detail-data">
              <tbody>
                {Object.entries(detalle.sourceData).map(([columna, valor]) => (
                  <tr key={columna}>
                    <th>{columna}</th>
                    <td>{formatearValor(valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}

      {conflictos.length > 0 ? (
        <div className="request-detail-conflicts">
          <h4>Valores que dos solicitudes traían distintos</h4>
          <ul>
            {conflictos.map((conflicto, indice) => (
              <li key={indice}>
                <strong>{conflicto.key}</strong>: se guardó «{conflicto.kept}» y se descartó «
                {conflicto.discarded}» (de {conflicto.folio}).
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="request-detail-actions">
        {detalle.projectId === null ? (
          <>
            <button
              type="button"
              onClick={() =>
                setConvertir({
                  key: "",
                  title: detalle.title,
                  requester: detalle.requester ?? "",
                  hasCost: false,
                  areaId: detalle.areaId ?? "",
                  stageTitle: "",
                })
              }
              disabled={ocupado}
            >
              Convertir en proyecto
            </button>
            <button type="button" onClick={eliminar} disabled={ocupado}>
              Eliminar
            </button>
          </>
        ) : (
          <p className="request-detail-converted">
            Ya es un proyecto, así que no se edita ni se elimina: el proyecto perdería lo que
            contesta. El solicitante sí se puede corregir.
          </p>
        )}
      </div>

      {convertir !== null ? (
        <form className="request-detail-convert" onSubmit={convertirEnProyecto}>
          <h4>Convertir en proyecto</h4>
          <p className="request-detail-help">
            Lo que se deje vacío se toma de la solicitud. Cada valor capturado pasa al proyecto
            con su clave, para que la orden de impresión y facturación lo lean sin recapturar.
          </p>

          <label className="request-detail-field">
            Llave del proyecto (vacío: se genera como PRY-000001)
            <input
              value={convertir.key}
              onChange={(evento) => setConvertir({ ...convertir, key: evento.target.value })}
              placeholder="PAPEL-FCQ-03"
            />
          </label>

          <label className="request-detail-field">
            Título del proyecto
            <input
              value={convertir.title}
              onChange={(evento) => setConvertir({ ...convertir, title: evento.target.value })}
            />
          </label>

          <label className="request-detail-field" htmlFor={`convertir-solicitante-${detalle.id}`}>
            Entidad solicitante (este es el momento de corregir el nombre)
          </label>
          <RequesterInput
            id={`convertir-solicitante-${detalle.id}`}
            value={convertir.requester}
            onChange={(requester) => setConvertir({ ...convertir, requester })}
          />

          <label className="request-detail-field">
            <input
              type="checkbox"
              checked={convertir.hasCost}
              onChange={(evento) => setConvertir({ ...convertir, hasCost: evento.target.checked })}
            />
            Con costo
          </label>

          <label className="request-detail-field">
            Primera etapa, en el área
            <select
              value={convertir.areaId}
              onChange={(evento) => setConvertir({ ...convertir, areaId: evento.target.value })}
            >
              <option value="">Sin etapas todavía</option>
              {areas.map((area) => (
                <option value={area.id} key={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>

          {convertir.areaId !== "" ? (
            <label className="request-detail-field">
              Nombre de la etapa
              <input
                value={convertir.stageTitle}
                onChange={(evento) => setConvertir({ ...convertir, stageTitle: evento.target.value })}
                placeholder="Diseño de la propuesta"
              />
            </label>
          ) : null}

          <div className="request-detail-actions">
            <button type="submit" disabled={ocupado}>
              {ocupado ? "Convirtiendo..." : "Crear el proyecto"}
            </button>
            <button type="button" onClick={() => setConvertir(null)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

// Un valor capturado como texto legible: los booleanos como sí/no y lo demás tal cual.
function formatearValor(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (valor === true) return "Sí";
  if (valor === false) return "No";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

export default RequestDetail;
