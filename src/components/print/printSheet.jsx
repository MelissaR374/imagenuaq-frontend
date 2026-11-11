// The printable work order ("Orden de Trabajo") handed to machine operators (RF-IMP-04, RF-IMP-07).
// Screen shows it styled. Ctrl+P produces a clean black-and-white sheet.
import { MdArrowBack, MdPrint } from "react-icons/md";

import { orDash } from "../shared/format.js";

import "./printSheet.css";

function yesNo(value) {
  return value ? "Si" : "—";
}

function formatDate(value) {
  if (!value) return new Date().toLocaleDateString();
  return new Date(value).toLocaleDateString();
}

/** @param {{ order: object, onBack: () => void }} props */
function PrintSheet({ order, onBack }) {
  function handlePrint() {
    const prev = document.title;
    document.title = `orden de impresion_${order.orderNumber}_${order.entityName ?? "sin dependencia"}`;
    window.print();
    document.title = prev;
  }

  return (
    <section className="print-sheet-container">
      <div className="print-sheet-toolbar no-print">
        <button className="po-btn" onClick={onBack}><MdArrowBack /> Volver</button>
        <button className="po-btn po-btn-primary" onClick={handlePrint}><MdPrint /> Imprimir</button>
      </div>

      <div className="print-sheet">
        <div className="print-sheet-header">
          <span className="print-sheet-date">{formatDate(order.createdAt)}</span>
          <h2>ORDEN DE TRABAJO</h2>
          <div className="print-sheet-meta">
            <span className="print-sheet-machine">{order.machineName ?? "—"}</span>
            <span className="print-sheet-number">{order.orderNumber}</span>
          </div>
        </div>

        <table className="print-sheet-table">
          <tbody>
            <tr>
              <th>Dependencia</th>
              <td colSpan="3">{orDash(order.entityName)}</td>
            </tr>
            <tr>
              <th>Pantone</th>
              <td>{orDash(order.pantoneCode)}</td>
              <th>Pantalla</th>
              <td>{orDash(order.pantalla)}</td>
            </tr>
            <tr>
              <th>Trabajo</th>
              <td colSpan="3">{orDash(order.trabajo)}</td>
            </tr>
            <tr>
              <th>Papel</th>
              <td>{orDash(order.papelType)}</td>
              <th>Tamano</th>
              <td>{orDash(order.papelSize)}</td>
            </tr>
            <tr>
              <th>Cantidad</th>
              <td>{orDash(order.cantidad)}</td>
              <th>Laminas</th>
              <td>{orDash(order.laminas)}</td>
            </tr>
            <tr>
              <th>Frente</th>
              <td>{yesNo(order.frente)}</td>
              <th>Vuelta</th>
              <td>{yesNo(order.vuelta)}</td>
            </tr>
            <tr>
              <th>Corte</th>
              <td>{orDash(order.corte)}</td>
              <th>Folio</th>
              <td>{orDash(order.folio)}</td>
            </tr>
            <tr>
              <th>Paquetes D</th>
              <td>{orDash(order.paquetesD)}</td>
              <th>Pegado</th>
              <td>{yesNo(order.pegado)}</td>
            </tr>
            <tr>
              <th>Copiante</th>
              <td colSpan="3">{yesNo(order.copiante)}</td>
            </tr>
            {order.notes ? (
              <tr>
                <th>Notas</th>
                <td colSpan="3">{order.notes}</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="print-sheet-footer">
          <div className="print-sheet-sig">
            <div className="print-sheet-sig-line" />
            <span>Elaboro</span>
          </div>
          <div className="print-sheet-sig">
            <div className="print-sheet-sig-line" />
            <span>Autorizo</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default PrintSheet;
