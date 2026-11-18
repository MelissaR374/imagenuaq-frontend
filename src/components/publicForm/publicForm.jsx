// The public form (RF-SOL-01, RF-MIG-01) that replaces Microsoft Forms, shown without a login.
// Sending takes three calls. The answer returns the folio and a key, each file goes up with it, and
// the finish writes the Excel row. A failed file keeps the folio, since the request exists.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import FieldInput from "../shared/fieldInput.jsx";
import { themeClass } from "../shared/theme.js";
import TextBlock from "../shared/textBlock.jsx";
import { GENERAL_BLOCK, SECTIONS, isTextBlock } from "../shared/vocabulary.js";
import "./publicForm.css";

/** @param {{ token: string }} props */
function PublicForm({ token }) {
  const [form, setForm] = useState(null);
  const [header, setHeader] = useState({ title: "", requester: "" });
  const [values, setValues] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [theme] = useState(themeClass);

  useEffect(() => {
    let cancelled = false;
    api
      .getPublicForm(token)
      .then((result) => {
        if (!cancelled) setForm(result.form);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function send(event) {
    event.preventDefault();
    setSending(true);
    setError(null);

    const files = Object.entries(values).filter(([, value]) => value instanceof File);
    const data = Object.fromEntries(
      Object.entries(values).filter(([, value]) => !(value instanceof File)),
    );

    let answer;
    try {
      answer = await api.submitPublicForm(token, { ...header, data });
    } catch (failure) {
      setError(failure.message);
      setSending(false);
      return;
    }

    let fileError = null;
    for (const [code, file] of files) {
      try {
        await api.uploadPublicFile(token, answer.uploadKey, code, file);
      } catch (failure) {
        fileError = `No se pudo subir «${file.name}»: ${failure.message}`;
      }
    }
    await api.finishPublicForm(token, answer.uploadKey).catch(() => null);

    setSent({ folio: answer.folio, fileError });
    setSending(false);
  }

  return (
    <div className={`app-container public-form-page ${theme}`}>
      <main className="public-form">
        <header className="public-form-head">
          <span className="public-form-brand">Imagen UAQ</span>
          <h1 className="public-form-title">{form?.name ?? "Formulario"}</h1>
        </header>

        {sent !== null ? (
          <section className="public-form-done">
            <h2>Recibimos tu solicitud</h2>
            <p>
              Tu folio es <strong className="public-form-folio">{sent.folio}</strong>. Guárdalo
              para dar seguimiento.
            </p>
            {sent.fileError !== null ? (
              <p className="public-form-error">
                {sent.fileError}. Envía el archivo a la coordinación mencionando tu folio.
              </p>
            ) : null}
          </section>
        ) : form === null ? (
          <p className="public-form-note">{error ?? "Cargando…"}</p>
        ) : (
          <form className="public-form-body" onSubmit={send}>
            <section className="public-form-sec">
              <label className="public-form-field">
                <span className="public-form-label">
                  {GENERAL_BLOCK.fields[0].publicName} <span className="field-required">*</span>
                </span>
                <input
                  className="field-control"
                  value={header.title}
                  onChange={(event) => setHeader({ ...header, title: event.target.value })}
                  placeholder="Ej: Papelería para el congreso de la facultad"
                  required
                />
              </label>
              <label className="public-form-field">
                <span className="public-form-label">
                  {GENERAL_BLOCK.fields[1].publicName} <span className="field-required">*</span>
                </span>
                <input
                  className="field-control"
                  value={header.requester}
                  onChange={(event) => setHeader({ ...header, requester: event.target.value })}
                  placeholder="Ej: Facultad de Química"
                  required
                />
              </label>
            </section>

            {SECTIONS.map((section) =>
              form.fields[section.key].length === 0 ? null : (
                <section className="public-form-sec" key={section.key}>
                  <h2>{section.publicTitle}</h2>
                  {form.fields[section.key].map((field, index) =>
                    isTextBlock(field) ? (
                      <TextBlock block={field} key={`texto-${index}`} />
                    ) : (
                      <FieldInput
                        key={field.code}
                        field={field}
                        value={values[field.code]}
                        onChange={(value) => setValues({ ...values, [field.code]: value })}
                        archivos
                      />
                    ),
                  )}
                </section>
              ),
            )}

            {error !== null ? <p className="public-form-error">{error}</p> : null}

            <footer className="public-form-foot">
              <button className="public-form-send" type="submit" disabled={sending}>
                {sending ? "Enviando…" : "Enviar solicitud"}
              </button>
            </footer>
          </form>
        )}
      </main>
    </div>
  );
}

export default PublicForm;
