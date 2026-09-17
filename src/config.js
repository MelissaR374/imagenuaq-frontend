// Los dos valores de entorno que la aplicación necesita saber sobre dónde vive: la URL del
// backend y su propio dominio público.
//
// Vite solo expone al navegador las variables que empiezan con VITE_, y las reemplaza en el
// código durante `npm run build`: lo que quede en dist/ es el valor que tenía .env cuando se
// compiló, no algo que se pueda cambiar después reiniciando nginx. Cambiarlo es volver a
// compilar. La imagen de Docker no lee .env (.dockerignore lo excluye), así que ahí los
// valores entran como build args -- ver Dockerfile.
//
// VITE_FRONTEND_DOMAIN tiene que coincidir con FRONTEND_DOMAIN del backend: ese valor va
// firmado dentro de cada token de sesión como `aud` y el servidor lo vuelve a revisar en
// cada petición, así que si no coinciden los tokens se rechazan en vez de fallar de a poco.

// A dónde se manda cada petición. Absoluta apunta directo al backend, sin proxy inverso en
// medio, y entonces el backend tiene que permitir este origen en su CORS_ORIGIN. El valor
// "/api" a secas deja todo en el mismo origen y delega el reenvío a Vite o a nginx.
export const API_URL = import.meta.env.VITE_API_URL ?? "/api";

// El origen público de esta aplicación, para armar enlaces que apunten de vuelta aquí. Sin
// diagonal al final. Si no está definido se usa el origen del navegador, que es lo correcto
// mientras la aplicación se abra desde el mismo lugar que quiere enlazar.
export const FRONTEND_DOMAIN = (
  import.meta.env.VITE_FRONTEND_DOMAIN ?? window.location.origin
).replace(/\/+$/, "");

// Nombre del parámetro donde viaja la invitación en el enlace de activación.
export const INVITE_PARAM = "invite";

// Nombre del parámetro con el que el servidor regresa aquí después de iniciar sesión con
// Microsoft: "connected", o "error" acompañado de reason y description.
export const MICROSOFT_PARAM = "microsoft";

/**
 * El enlace que se le manda a alguien recién invitado para que active su cuenta. Lo abre en
 * esta misma aplicación con el token ya puesto; ver components/login/login.jsx.
 *
 * @param {string} token
 * @returns {string}
 */
export function activationLink(token) {
  return `${FRONTEND_DOMAIN}/?${INVITE_PARAM}=${encodeURIComponent(token)}`;
}
