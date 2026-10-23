//Tabla reutilizable
//Esta tabla sirve tanto para proyectos identificados como para registros sin proyectos
import {
  MdOpenInNew,
  MdDescription,
  MdCheckCircle,
  MdWarningAmber,
  MdFileDownload,
} from "react-icons/md";

function BillingStatus({ data, type }) {
  if (!data) {
    return <span className="billing-muted">Sin información</span>;
  }

  const isAvailable = data.status === "available";
  const isMissing = data.status === "missing";
  const isPending = data.status === "pending";

  return (
    <div className="billing-status-cell">
      <span
        className={`billing-status ${
          isAvailable
            ? "success"
            : isMissing
              ? "danger"
              : isPending
                ? "warning"
                : "neutral"
        }`}
      >
        {isAvailable ? (
          <MdCheckCircle />
        ) : isPending ? (
          <MdWarningAmber />
        ) : (
          <MdDescription />
        )}

        {data.label}
      </span>

      {(type === "quotation" || type === "invoice") && data.fileName && (
        data.downloadUrl ? (
            <a 
                className="billing-file-download"
                href={data.downloadUrl}
                download={data.fileName}
                title={`Descargar ${data.fileName}`}
            >
                <MdFileDownload />
                <span>{data.fileName}</span>
            </a>
        ):(
            <span className="billing-file-name">{data.fileName}</span>
        )
      )}

      {type === "invoice" && isMissing && (
        <span className="billing-muted">
          No figura en el reporte
        </span>
      )}

      {type === "receipt" && (
        <>
          <span className="billing-receipt-folio">
            Folio {data.folio || "Sin folio"}
          </span>
          <span className="billing-muted">{data.date}</span>
        </>
      )}
    </div>
  );
}

function BillingTable({
  title,
  records = [],
  identified = true,
  totalCount,
  onOpenRecord,
}) {
  const formatMoney = (amount) => {
    if (amount == null) return "Sin dato";

    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const knownTotal = records.reduce(
    (total, record) => total + (Number(record.amount) || 0),
    0
  );

  return (
    <section className="billing-table-section">
      <div className="billing-table-heading">
        <h2>{title}</h2>
        <span>{totalCount ?? records.length} registros</span>
      </div>

      {!identified && (
        <div className="billing-warning">
          <MdWarningAmber />
          <span>
            Sin título, responsable, entidad ni monto en el Excel.
            El código en la columna Cotización es un identificador,
            no un archivo adjunto; por eso se marca “Falta cotización”.
          </span>
        </div>
      )}

      <div className="billing-table-scroll">
        <table className="billing-table">
          <thead>
            <tr>
              <th>
                {identified
                  ? "PROYECTO / RESPONSABLE"
                  : "REGISTRO / RESPONSABLE"}
              </th>
              <th>MONTO</th>
              <th>COTIZACIÓN</th>
              <th>FACTURA</th>
              <th>RECIBO / VENCIMIENTO</th>
              <th>VER</th>
            </tr>
          </thead>

          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="billing-empty">
                  No se encontraron registros.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="billing-project-info">
                      <span className="billing-project-code">
                        {record.code}
                      </span>

                      {identified ? (
                        <>
                          <button
                            type="button"
                            className="billing-project-link"
                            disabled= {!onOpenRecord || record.projectId == null}
                            onClick={() => onOpenRecord?.(record)}
                            title="Abrir detalle del proyecto"
                          >
                            {record.name}
                          </button>
                          <span>{record.responsible}</span>
                          <span>{record.entity}</span>
                        </>
                      ) : (
                        <span>{record.description}</span>
                      )}
                    </div>
                  </td>

                  <td className="billing-amount">
                    {formatMoney(record.amount)}
                  </td>

                  <td>
                    <BillingStatus
                      data={record.quotation}
                      type="quotation"
                    />
                  </td>

                  <td>
                    <BillingStatus
                      data={record.invoice}
                      type="invoice"
                    />
                  </td>

                  <td>
                    <BillingStatus
                      data={record.receipt}
                      type="receipt"
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      className="billing-open-button"
                      aria-label={`Ver registro ${record.code}`}
                      disabled = {
                        !identified ||
                        !onOpenRecord ||
                        record.projectId == null
                      }
                      onClick={() => onOpenRecord?.(record)}
                    >
                      <MdOpenInNew />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="billing-table-footer">
        <span>
          {records.length} de {totalCount ?? records.length} registros visibles
        </span>

        {identified && (
          <span>
            Montos conocidos: <strong>{formatMoney(knownTotal)}</strong>
          </span>
        )}
      </div>
    </section>
  );
}

export default BillingTable;