// Pestaña "Mi perfil": se abre al hacer clic en el usuario de la barra lateral o en el
// nombre del encabezado. Cada quien edita su propio registro: foto, nombre, correo,
// cumpleaños y contraseña. Los estilos van en profile.css.
//
// Lo que no se puede cambiar aquí (rol, área, tipo de contrato) se muestra pero no se
// edita: son decisiones de coordinación y se cambian desde "Empleados". El servidor de
// todos modos ignora esas llaves si llegaran.
//
// La foto no se pone directo en un <img src="/api/..."> porque esa etiqueta no puede mandar
// el token; se pide con fetch y se muestra con un object URL, que vive en App.jsx para que
// la barra lateral la comparta.
import { useEffect, useState } from "react";

import * as api from "../../api/client.js";
import "./profile.css";

// Lo que acepta el servidor; el input lo usa como filtro del selector de archivos.
const TIPOS_DE_IMAGEN = "image/png,image/jpeg,image/webp";
const TAMANO_MAXIMO = 2 * 1024 * 1024;

const CONTRASENA_VACIA = { actual: "", nueva: "", confirmacion: "" };

// `usuario` es la sesión; `foto` el object URL de la imagen actual o null. `onActualizar`
// recibe los datos nuevos para que el encabezado y la barra lateral los reflejen;
// `onFoto` recibe el Blob nuevo o null cuando se quita.
function Profile({ usuario, foto, onActualizar, onFoto }) {
  // El registro completo, con cumpleaños y áreas; la sesión sola no lo trae.
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // El formulario de datos
  const [form, setForm] = useState({ fullName: "", email: "", birthday: "" });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);
  const [guardado, setGuardado] = useState(false);

  // El formulario de contraseña
  const [contrasena, setContrasena] = useState(CONTRASENA_VACIA);
  const [cambiando, setCambiando] = useState(false);
  const [errorContrasena, setErrorContrasena] = useState(null);
  const [contrasenaCambiada, setContrasenaCambiada] = useState(false);

  // La foto
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState(null);

  // Al abrir la pestaña se pide el registro completo y se llena el formulario con él.
  useEffect(() => {
    api
      .getProfile()
      .then((data) => {
        setPerfil(data.user);
        setForm({
          fullName: data.user.fullName ?? "",
          email: data.user.email ?? "",
          birthday: data.user.birthday ?? "",
        });
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
    setGuardado(false);
  }

  async function handleGuardar(event) {
    event.preventDefault();
    setErrorForm(null);
    setGuardando(true);

    try {
      const data = await api.updateProfile({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        birthday: form.birthday || null,
      });
      setPerfil({ ...perfil, ...data.user });
      setGuardado(true);
      onActualizar(data.user);
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  function handleChangeContrasena(event) {
    const { name, value } = event.target;
    setContrasena({ ...contrasena, [name]: value });
    setContrasenaCambiada(false);
  }

  async function handleCambiarContrasena(event) {
    event.preventDefault();
    setErrorContrasena(null);

    // La confirmación se revisa aquí; el servidor solo ve la actual y la nueva.
    if (contrasena.nueva !== contrasena.confirmacion) {
      setErrorContrasena("La contraseña nueva y su confirmación no coinciden.");
      return;
    }

    setCambiando(true);

    try {
      await api.changePassword(contrasena.actual, contrasena.nueva);
      setContrasena(CONTRASENA_VACIA);
      setContrasenaCambiada(true);
    } catch (err) {
      setErrorContrasena(err.message);
    } finally {
      setCambiando(false);
    }
  }

  async function handleFoto(event) {
    const archivo = event.target.files[0];
    // Para poder volver a elegir el mismo archivo después de un error.
    event.target.value = "";
    if (!archivo) return;

    setErrorFoto(null);

    if (archivo.size > TAMANO_MAXIMO) {
      setErrorFoto("La imagen no puede pesar más de 2 MB.");
      return;
    }

    setSubiendo(true);

    try {
      await api.setMyPicture(archivo);
      onFoto(archivo);
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function handleQuitarFoto() {
    setErrorFoto(null);
    setSubiendo(true);

    try {
      await api.clearMyPicture();
      onFoto(null);
    } catch (err) {
      setErrorFoto(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  // Las iniciales, igual que en la barra lateral, para cuando no hay foto.
  const iniciales = (perfil?.fullName ?? usuario.fullName ?? "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  if (cargando) return <p className="profile-loading">Cargando...</p>;

  return (
    <section className="profile">
      <header className="profile-header">
        <h1 className="profile-title">Mi perfil</h1>
      </header>

      <p className="profile-error" role="alert">
        {error}
      </p>

      {/* FOTO */}
      <div className="profile-picture">
        <div className="profile-avatar">
          {foto ? (
            <img className="profile-avatar-image" src={foto} alt="Foto de perfil" />
          ) : (
            <span className="profile-avatar-initials">{iniciales}</span>
          )}
        </div>

        <div className="profile-picture-actions">
          <label className="profile-picture-upload" htmlFor="profile-picture-file">
            {subiendo ? "Subiendo..." : foto ? "Cambiar foto" : "Subir foto"}
          </label>

          <input
            className="profile-picture-input"
            id="profile-picture-file"
            type="file"
            accept={TIPOS_DE_IMAGEN}
            disabled={subiendo}
            onChange={handleFoto}
          />

          {foto && (
            <button
              className="profile-picture-remove"
              type="button"
              disabled={subiendo}
              onClick={handleQuitarFoto}
            >
              Quitar foto
            </button>
          )}

          <p className="profile-picture-hint">PNG, JPEG o WebP de hasta 2 MB.</p>

          <p className="profile-error" role="alert">
            {errorFoto}
          </p>
        </div>
      </div>

      {/* DATOS QUE NO SE EDITAN AQUÍ */}
      <dl className="profile-summary">
        <div className="profile-summary-item">
          <dt className="profile-summary-label">Rol</dt>
          {/* El nombre del rol tal como está registrado en "Roles y permisos", igual que
              lo muestra la barra lateral. */}
          <dd className="profile-summary-value">{perfil?.role ?? "—"}</dd>
        </div>

        <div className="profile-summary-item">
          <dt className="profile-summary-label">Áreas</dt>
          <dd className="profile-summary-value">
            {perfil?.areas?.length
              ? perfil.areas
                  .map((area) =>
                    area.isAreaLeader ? `${area.name} (responsable)` : area.name,
                  )
                  .join(", ")
              : "Sin área"}
          </dd>
        </div>
      </dl>

      {/* DATOS */}
      <form className="profile-form" onSubmit={handleGuardar}>
        <h2 className="profile-form-title">Mis datos</h2>

        <div className="profile-form-field">
          <label className="profile-form-label" htmlFor="profile-name">
            Nombre completo
          </label>

          <input
            className="profile-form-input"
            id="profile-name"
            name="fullName"
            type="text"
            required
            maxLength={200}
            value={form.fullName}
            onChange={handleChange}
          />
        </div>

        <div className="profile-form-field">
          <label className="profile-form-label" htmlFor="profile-email">
            Correo
          </label>

          <input
            className="profile-form-input"
            id="profile-email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div className="profile-form-field">
          <label className="profile-form-label" htmlFor="profile-birthday">
            Cumpleaños (opcional)
          </label>

          <input
            className="profile-form-input"
            id="profile-birthday"
            name="birthday"
            type="date"
            value={form.birthday}
            onChange={handleChange}
          />
        </div>

        <p className="profile-form-error" role="alert">
          {errorForm}
        </p>

        <p className="profile-form-success" role="status">
          {guardado ? "Datos guardados." : ""}
        </p>

        <button className="profile-form-submit" type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* CONTRASEÑA */}
      <form className="profile-form profile-form-password" onSubmit={handleCambiarContrasena}>
        <h2 className="profile-form-title">Cambiar contraseña</h2>

        <div className="profile-form-field">
          <label className="profile-form-label" htmlFor="profile-password-current">
            Contraseña actual
          </label>

          <input
            className="profile-form-input"
            id="profile-password-current"
            name="actual"
            type="password"
            required
            autoComplete="current-password"
            value={contrasena.actual}
            onChange={handleChangeContrasena}
          />
        </div>

        <div className="profile-form-field">
          <label className="profile-form-label" htmlFor="profile-password-new">
            Contraseña nueva
          </label>

          <input
            className="profile-form-input"
            id="profile-password-new"
            name="nueva"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={contrasena.nueva}
            onChange={handleChangeContrasena}
          />
        </div>

        <div className="profile-form-field">
          <label className="profile-form-label" htmlFor="profile-password-confirm">
            Confirmar contraseña nueva
          </label>

          <input
            className="profile-form-input"
            id="profile-password-confirm"
            name="confirmacion"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={contrasena.confirmacion}
            onChange={handleChangeContrasena}
          />
        </div>

        <p className="profile-form-error" role="alert">
          {errorContrasena}
        </p>

        <p className="profile-form-success" role="status">
          {contrasenaCambiada ? "Contraseña cambiada." : ""}
        </p>

        <button className="profile-form-submit" type="submit" disabled={cambiando}>
          {cambiando ? "Cambiando..." : "Cambiar contraseña"}
        </button>
      </form>
    </section>
  );
}

export default Profile;
