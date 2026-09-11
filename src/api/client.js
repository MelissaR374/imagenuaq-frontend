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
