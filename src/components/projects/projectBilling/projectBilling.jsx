/**
 * Esta primera versión permite seleccionar archivos, mostrarlos y descargarlos durante la sesión. Todavía no los guarda en PostgreSQL ni MinIO; al recargar la página desaparecerán. Tampoco revoca todavía las URLs temporales, por lo que antes de usarlo en producción habrá que agregar esa limpieza o sustituirlas por descargas del backend.
 */


import { useRef, useState } from "react";
import {
  MdOutlineDescription,
  MdReceiptLong,
  MdUpload,
  MdAdd,
  MdDownload,
  MdMoreVert,
  MdInfoOutline,
} from "react-icons/md";

import "./projectBilling.css";

function DocumentSection({
  title,
  type,
  documents,
  onUpload,
}) {
  const inputRef = useRef(null);

  const isQuotation = type === "quotation";

  function handleFiles(event) {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      onUpload(type, files);
    }

    event.target.value = "";
  }

  return (
    <section className="project-billing-section">
      <header className="project-billing-section-head">
        <h4>{title}</h4>

        <span className="project-billing-count">
          {documents.length} documentos
        </span>
      </header>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.doc,.docx,.xml"
        hidden
        onChange={handleFiles}
      />

      {documents.length === 0 ? (
        <div className="project-billing-empty">
          <div className="project-billing-empty-icon">
            {isQuotation ? (
              <MdOutlineDescription />
            ) : (
              <MdReceiptLong />
            )}
          </div>

          <div>
            <strong>
              {isQuotation
                ? "Sin cotizaciones registradas"
                : "Sin facturas registradas"}
            </strong>

            <p>
              {isQuotation
                ? "Agrega la primera cotización de este proyecto."
                : "Sube una factura para vincularla a este proyecto."}
            </p>
          </div>
        </div>
      ) : (
        <div className="project-billing-files">
          {documents.map((document) => (
            <article
              className="project-billing-file"
              key={document.id}
            >
              <div className="project-billing-file-preview">
                {isQuotation ? (
                  <MdOutlineDescription />
                ) : (
                  <MdReceiptLong />
                )}
              </div>

              <div className="project-billing-file-info">
                <strong title={document.name}>
                  {document.name}
                </strong>

                <span>
                  {document.size
                    ? `${(document.size / 1024).toFixed(1)} KB`
                    : "Documento"}
                </span>
              </div>

              <a
                href={document.url}
                download={document.name}
                className="project-billing-download"
                aria-label={`Descargar ${document.name}`}
                title="Descargar archivo"
              >
                <MdDownload />
              </a>
            </article>
          ))}
        </div>
      )}

      <button
        type="button"
        className="project-billing-upload"
        onClick={() => inputRef.current?.click()}
      >
        {isQuotation ? <MdAdd /> : <MdUpload />}

        {isQuotation
          ? "Agregar cotización"
          : "Subir factura"}
      </button>
    </section>
  );
}

function ProjectBilling({ projectId }) {
  // 🟢 NUEVO: estado temporal para la interfaz.
  // Después se sustituirá por datos del backend.
  const [documents, setDocuments] = useState({
    quotation: [],
    invoice: [],
  });

  function handleUpload(type, files) {
    const uploaded = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file),
    }));

    setDocuments((current) => ({
      ...current,
      [type]: [...current[type], ...uploaded],
    }));
  }

  return (
    <section className="project-billing">
      <header className="project-billing-header">
        <MdOutlineDescription />
        <h3>Cotizaciones y facturas</h3>
      </header>

      {documents.quotation.length === 0 &&
        documents.invoice.length === 0 && (
          <div className="project-billing-notice">
            <MdInfoOutline />

            <div>
              <strong>
                Sin documentos financieros vinculados a este proyecto
              </strong>

              <p>
                Todavía no se han agregado cotizaciones
                ni facturas.
              </p>
            </div>
          </div>
        )}

      <div className="project-billing-grid">
        <DocumentSection
          title="Cotizaciones"
          type="quotation"
          documents={documents.quotation}
          onUpload={handleUpload}
        />

        <DocumentSection
          title="Facturas"
          type="invoice"
          documents={documents.invoice}
          onUpload={handleUpload}
        />
      </div>
    </section>
  );
}

export default ProjectBilling;
