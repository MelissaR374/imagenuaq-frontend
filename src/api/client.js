import { API_URL } from "../config.js";

const BASE = API_URL;

const TOKEN_KEY = "imagenuaq.token";

// Un error que el servidor devolvió a propósito, con su mensaje y su código.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Hace una petición y devuelve el JSON ya listo. Si el servidor responde con un error,
// lanza un ApiError con el mensaje que él mismo mandó.
async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // 204 significa "listo, sin contenido".
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(data?.error?.message ?? `Error ${response.status}.`, response.status);
  }

  return data;
}

// --- Sesión ---

export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password }, auth: false });

// Canjea la invitación que dio un administrador y devuelve una sesión, igual que login.
export const activate = (token, password) =>
  request("/auth/activate", { method: "POST", body: { token, password }, auth: false });

// Quién dice el servidor que eres con el token guardado.
export const session = () => request("/auth/me");

// --- Usuarios ---

export const listUsers = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== null && value !== ""),
  );
  return request(`/users?${search}`);
};

// Devuelve { user, inviteToken }. El token de invitación no se guarda en ningún lado:
// esta respuesta es la única vez que se puede ver.
export const createUser = (input) => request("/users", { method: "POST", body: input });

export const updateUser = (id, changes) =>
  request(`/users/${id}`, { method: "PATCH", body: changes });

export const deleteUser = (id) => request(`/users/${id}`, { method: "DELETE" });

// Una invitación nueva, solo si la cuenta todavía no se ha activado.
export const reinviteUser = (id) => request(`/users/${id}/invite`, { method: "POST" });

// --- Catálogos ---

export const listRoles = () => request("/roles");

// El catálogo completo de permisos, no los de un rol en particular.
export const listPermissions = () => request("/roles/permissions");

export const listAreas = () => request("/areas");

export const listContractTypes = () => request("/contract-types");

// --- Áreas ---

// El organigrama completo: { roots: [...] }, cada nodo con parentAreaId, leaders y children.
export const getOrgChart = () => request("/areas/orgchart");

// Sin parentAreaId el servidor cuelga el área bajo Coordinación; con parentAreaId: null
// la deja como raíz.
export const createArea = (input) => request("/areas", { method: "POST", body: input });

// Solo name y description; el padre se cambia con setAreaParent / clearAreaParent.
export const updateArea = (id, changes) =>
  request(`/areas/${id}`, { method: "PATCH", body: changes });

// Falla con 409 mientras el área tenga gente asignada.
export const deleteArea = (id) => request(`/areas/${id}`, { method: "DELETE" });

export const setAreaParent = (id, parentAreaId) =>
  request(`/areas/${id}/parent`, { method: "PUT", body: { parentAreaId } });

export const clearAreaParent = (id) => request(`/areas/${id}/parent`, { method: "DELETE" });

// Un upsert: agrega a la persona al área o, si ya está, cambia si la encabeza.
export const setAreaMember = (areaId, userId, isAreaLeader) =>
  request(`/areas/${areaId}/members/${userId}`, { method: "PUT", body: { isAreaLeader } });

// Quita la pertenencia al área, no la cuenta.
export const removeAreaMember = (areaId, userId) =>
  request(`/areas/${areaId}/members/${userId}`, { method: "DELETE" });

// --- Roles y permisos ---

export const createRole = (input) => request("/roles", { method: "POST", body: input });

// Renombrar un rol saca a quienes lo tienen hasta que vuelvan a entrar: el servidor compara
// el nombre que trae la sesión con el de la tabla.
export const updateRole = (id, changes) =>
  request(`/roles/${id}`, { method: "PATCH", body: changes });

// Falla con 409 mientras alguien tenga el rol.
export const deleteRole = (id) => request(`/roles/${id}`, { method: "DELETE" });

// Lo que un rol puede hacer: { permissions: [...] }, cada uno con code y label.
export const getRolePermissions = (id) => request(`/roles/${id}/permissions`);

// Reemplaza todos los permisos del rol por la lista de códigos que se manda.
export const setRolePermissions = (id, codes) =>
  request(`/roles/${id}/permissions`, { method: "PUT", body: { permissions: codes } });

// --- Registro de aplicación de Azure (solo admin) ---

// Qué registro usa el servidor: { source, tenantId, clientId, hasSecret, redirectUri, ... }.
// Nunca trae el secreto, sólo si hay uno.
export const getMicrosoftApp = () => request("/microsoft/app");

// Guarda { tenantId, clientId, clientSecret }. El secreto se puede omitir si ya hay uno.
export const setMicrosoftApp = (input) =>
  request("/microsoft/app", { method: "PUT", body: input });

// Olvida el registro guardado; si .env tiene uno, vuelve a aplicar ése.
export const clearMicrosoftApp = () => request("/microsoft/app", { method: "DELETE" });

// --- Cuentas Microsoft ---

// Devuelve { url }: a dónde mandar al navegador para iniciar sesión con Microsoft. Al
// terminar, Microsoft regresa al servidor y éste vuelve aquí con ?microsoft=connected.
export const connectMicrosoft = () => request("/microsoft/connect", { method: "POST" });

// Las cuentas propias; un administrador ve las de todos. Nunca trae el token.
export const listMicrosoftAccounts = () => request("/microsoft/accounts");

// Retira el acceso. La cuenta queda marcada como revocada, no se borra.
export const revokeMicrosoftAccount = (id) =>
  request(`/microsoft/accounts/${id}`, { method: "DELETE" });

// --- Hojas de cálculo ---

export const listSpreadsheets = () => request("/spreadsheets");

// Lo que hay detrás de un enlace compartido, visto con esa cuenta: driveId, itemId, nombre
// y las tablas y hojas del libro, para elegir una y registrarla.
export const resolveSpreadsheet = (accountId, url) =>
  request(`/spreadsheets/resolve?${new URLSearchParams({ accountId, url })}`);

// Registra { accountId, name, driveId, itemId, tableName, webUrl }. No consulta Microsoft.
export const registerSpreadsheet = (input) =>
  request("/spreadsheets", { method: "POST", body: input });

// La fila de encabezados, leída en vivo. Falla con 409 si la cuenta hay que reconectarla.
export const previewSpreadsheet = (id) => request(`/spreadsheets/${id}/preview`);

export const deleteSpreadsheet = (id) => request(`/spreadsheets/${id}`, { method: "DELETE" });
