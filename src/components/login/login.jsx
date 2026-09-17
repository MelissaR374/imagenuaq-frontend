// Tiene dos modos porque las cuentas las crea un administrador sin contraseña: la persona
// recibe una invitación y la canjea aquí eligiendo la suya. Después ya entra normal.
import { useState } from "react";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";

import canelita from "../../assets/Canela_29.png"

import * as api from "../../api/client.js";
import { INVITE_PARAM } from "../../config.js";
import "./login.css";

function invitacionEnLaUrl() {
  return new URLSearchParams(window.location.search).get(INVITE_PARAM) ?? "";
}

function Login({ onEntrar }) {
  const [invitacion, setInvitacion] = useState(invitacionEnLaUrl);
  const [modo, setModo] = useState(invitacion ? "activar" : "entrar"); // "entrar" o "activar"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const activando = modo === "activar";

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      // Los dos caminos devuelven lo mismo: { token, user }.
      const respuesta = activando
        ? await api.activate(invitacion.trim(), password)
        : await api.login(email.trim(), password);

      api.setToken(respuesta.token);
      onEntrar(respuesta.user);
    } catch (err) {
      setError(err.message);
      setPassword("");
    } finally {
      setEnviando(false);
    }
  }

  function cambiarModo() {
    setModo(activando ? "entrar" : "activar");
    setError(null);
    setPassword("");
  }

  return (
    <div className="login-page">
      <div className="loginleft">
        <header className="headerleft">UNIVERSIDAD AUTÓNOMA DE QUERÉTARO</header>

        <div className="content-left">
          <img src={canelita} alt="" className="canelita" />
          <h1 className="loginleft-title">Imagen UAQ</h1>
          <p className="loginleft-subtitle">Plataforma Institucional de Gestión de Proyectos y Producción Multimedios</p>
        </div>


      </div>
      <main className="login-panel">
        <h1 className="login-title">Iniciar Sesión</h1>

        <p className="login-subtitle">
          {activando
            ? "Activa tu cuenta con la invitación que te enviaron"
            : "Sistema de gestión de trabajo"}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          {/* INVITACIÓN o CORREO, según el modo */}
          {activando ? (
            <div className="login-field">
              <label className="login-label" htmlFor="login-invite">
                Token de invitación
              </label>
              <p className="login-hint">
                Es el texto largo que aparece en el correo o mensaje de invitación.
              </p>

              <textarea
                className="login-input"
                id="login-invite"
                rows={3}
                required
                value={invitacion}
                onChange={(event) => setInvitacion(event.target.value)}
              />

              
            </div>
          ) : (
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">
                Correo institucional
              </label>

              <input
                className="login-input"
                id="login-email"
                type="email"
                required
                autoComplete="username"
                placeholder="nombre@uaq.mx"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}

          {/* CONTRASEÑA */}
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              {activando ? "Elige una contraseña" : "Contraseña"}
            </label>

            <div className="password-container">
                <input
                className="login-input"
                id="login-password"
                type={mostrarPassword ? "text" : "password"}
                required
                autoComplete={activando ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <button
                type = "button"
                className="password-toggle"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                {mostrarPassword ? <MdVisibilityOff/> : <MdVisibility/>}
              </button>
            </div>
            {activando && <p className="login-hint">Mínimo 8 caracteres.</p>}
          </div>

          {/* ERROR */}
          <p className="login-error" role="alert">
            {error}
          </p>

          <button className="login-submit" type="submit" disabled={enviando}>
            {enviando ? "Un momento..." : activando ? "Activar cuenta" : "Entrar"}
          </button>
        </form>

        <button className="login-switch" type="button" onClick={cambiarModo}>
          {activando
            ? "Ya tengo contraseña, quiero entrar"
            : "Tengo una invitación por activar"}
        </button>
      </main>
    </div>
  );
}

export default Login;
