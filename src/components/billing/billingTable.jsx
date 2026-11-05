// Finance project table: one row per project with counts and flags from shapeStanding.
import { MdOpenInNew, MdWarningAmber } from "react-icons/md";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const FLAG_LABELS = {
  missing_invoices: "Faltan facturas",
  costed_no_quote: "Sin cotización",
  delivered_no_invoice: "Entregado sin factura",
  invoice_not_in_oficio: "Factura sin oficio",
  oficio_unanswered: "Oficio sin respuesta",
  payment_no_folio: "Pago sin folio",
  no_finance_records: "Sin registros",
};

function BillingTable({ records = [], totalCount, loading, onOpenRecord }) {
  const knownTotal = records.reduce((sum, p) => sum + Number(p.invoiced ?? 0), 0);

  return (
    <section className="billing-table-section">
      <div className="billing-table-heading">
        <h2>Proyectos</h2>
        <span>{totalCount ?? records.length} registros</span>
      </div>

      <div className="billing-table-scroll">
        <table className="billing-table">
          <thead>
            <tr>
              <th>PROYECTO</th>
              <th>SOLICITANTE</th>
              <th>COTIZACIONES</th>
              <th>FACTURAS</th>
              <th>OFICIOS</th>
              <th>MONTO FACTURADO</th>
              <th>ALERTAS</th>
              <th>VER</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="billing-empty">Cargando…</td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className="billing-empty">No se encontraron registros.</td>
              </tr>
            ) : (
              records.map((p) => (
                <tr key={p.projectId}>
                  <td>
                    <div className="billing-project-info">
                      <span className="billing-project-code">{p.key}</span>
                      <button
                        type="button"
                        className="billing-project-link"
                        disabled={!onOpenRecord}
                        onClick={() => onOpenRecord?.({ projectId: p.projectId })}
                        title="Abrir detalle del proyecto"
                      >
                        {p.title ?? "—"}
                      </button>
                    </div>
                  </td>

                  <td>{p.requester ?? "—"}</td>

                  <td className="billing-amount">{p.quotes}</td>

                  <td className="billing-amount">
                    {p.uploadedInvoices}
                    {p.expectedInvoices != null && ` / ${p.expectedInvoices}`}
                  </td>

                  <td className="billing-amount">{p.oficios}</td>

                  <td className="billing-amount">{MXN.format(p.invoiced ?? 0)}</td>

                  <td>
                    <div className="billing-flags">
                      {(p.flags ?? []).map((flag) => (
                        <span key={flag} className="billing-flag">
                          <MdWarningAmber />
                          {FLAG_LABELS[flag] ?? flag}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="billing-open-button"
                      aria-label={`Ver proyecto ${p.key}`}
                      disabled={!onOpenRecord}
                      onClick={() => onOpenRecord?.({ projectId: p.projectId })}
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
        <span>{records.length} de {totalCount ?? records.length} registros visibles</span>
        <span>Monto facturado: <strong>{MXN.format(knownTotal)}</strong></span>
      </div>
    </section>
  );
}

export default BillingTable;
