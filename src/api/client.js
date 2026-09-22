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

// --- Mi perfil ---
//
// Lo que cada quien puede cambiar de su propio registro. El servidor toma el id de la
// sesión, nunca de la URL, así que no hay forma de llegar al registro de alguien más.

// El registro propio completo, con cumpleaños y tipo de contrato: { user }.
export const getProfile = () => request("/auth/me/profile");

// Solo fullName, email y birthday; cualquier otra llave el servidor la ignora.
export const updateProfile = (changes) =>
  request("/auth/me", { method: "PATCH", body: changes });

// Pide la contraseña actual antes de cambiarla. Las demás sesiones abiertas siguen vivas.
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/me/password", { method: "PUT", body: { currentPassword, newPassword } });

// La foto de perfil de alguien como Blob, o null si no tiene. Va aparte de request()
// porque la respuesta es una imagen, no JSON, y una etiqueta <img> no puede mandar el
// token: hay que pedirla con fetch y mostrarla con URL.createObjectURL.
export async function getPicture(userId) {
  const response = await fetch(`${BASE}/users/${userId}/picture`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error?.message ?? `Error ${response.status}.`, response.status);
  }

  return response.blob();
}

// Sube la foto propia tal cual, sin multipart: el cuerpo es el archivo y el tipo va en el
// encabezado. Acepta PNG, JPEG o WebP de hasta 2 MB; lo demás el servidor lo rechaza.
export async function setMyPicture(file) {
  const response = await fetch(`${BASE}/auth/me/picture`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error?.message ?? `Error ${response.status}.`, response.status);
  }
}

export const clearMyPicture = () => request("/auth/me/picture", { method: "DELETE" });

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

// --- Formatos de solicitud (RF-SOL-01) ---
//
// Un formato es la identidad; lo que pide vive en sus versiones, y una versión publicada no
// se edita: "editar" es publicar la siguiente. Los campos van en dos secciones,
// `deliverables` e `information`, cada una un arreglo de { code, name, type, note, required }.

export const listSchemas = () => request("/schemas");

export const getSchema = (id) => request(`/schemas/${id}`);

export const listSchemaVersions = (id) => request(`/schemas/${id}/versions`);

// Una versión por su propio id: es a lo que apuntan las solicitudes y los proyectos.
export const getSchemaVersion = (versionId) => request(`/schemas/versions/${versionId}`);

export const createSchema = (input) => request("/schemas", { method: "POST", body: input });

// Publica la siguiente versión. Las anteriores quedan intactas.
export const createSchemaVersion = (id, fields) =>
  request(`/schemas/${id}/versions`, { method: "POST", body: { fields } });

// Un formato nuevo que empieza con los campos del último del otro (plantilla).
export const cloneSchema = (id, code, name) =>
  request(`/schemas/${id}/clone`, { method: "POST", body: { code, name } });

// Solo nombre y activo; los campos no se editan por aquí.
export const updateSchema = (id, changes) =>
  request(`/schemas/${id}`, { method: "PATCH", body: changes });

export const deleteSchema = (id) => request(`/schemas/${id}`, { method: "DELETE" });

// El vocabulario de claves: cada clave publicada alguna vez, con su definición más reciente y
// en qué formatos vive. Una clave significa una sola cosa en todo el sistema, así que el
// constructor de formatos la reusa en vez de redefinirla.
export const listFieldKeys = () => request("/schemas/field-keys");

// El catálogo de tipos de campo. Es de solo lectura: cada tipo es una regla de conversión
// que el servidor implementa.
export const listDataTypes = () => request("/data-types");

// --- Catálogo de estatus (RF-EST-02) ---
//
// Sin área es el catálogo global, del que parten todas; con área, los de esa área. Un área
// puede reusar un código global. Nada se borra: dar de baja es desactivar.

export const listStatuses = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== null && value !== ""),
  );
  return request(`/statuses?${search}`);
};

export const createStatus = (input) => request("/statuses", { method: "POST", body: input });

// El código y el área no se editan: son bajo lo que se archivó lo anterior.
export const updateStatus = (id, changes) =>
  request(`/statuses/${id}`, { method: "PATCH", body: changes });

export const deleteStatus = (id) => request(`/statuses/${id}`, { method: "DELETE" });

// --- Solicitantes (RF-SOL-07) ---

// Las cadenas en uso, de más usada a menos, para el autocompletado. No hay padrón de
// solicitantes: el nombre es una cadena y esto es lo que evita que se vuelva cuatro.
export const listRequesters = (q = "") =>
  request(`/requesters?${new URLSearchParams(q ? { q } : {})}`);

// --- Solicitudes (RF-SOL-03 a RF-SOL-08) ---

export const listRequests = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== null && value !== ""),
  );
  return request(`/requests?${search}`);
};

// La solicitud con los campos del formato con que se capturó, para poder mostrarla.
export const getRequest = (id) => request(`/requests/${id}`);

// { schemaId | schemaVersionId, title, requester, data, areaId, priority, source }.
// Los valores se convierten según el tipo de cada campo; un error trae todas las quejas.
export const createRequest = (input) => request("/requests", { method: "POST", body: input });

export const updateRequest = (id, changes) =>
  request(`/requests/${id}`, { method: "PATCH", body: changes });

export const setRequestStatus = (id, statusId) =>
  request(`/requests/${id}/status`, { method: "PUT", body: { statusId } });

export const deleteRequest = (id) => request(`/requests/${id}`, { method: "DELETE" });

// Convierte en proyecto: devuelve { project, conflicts }. Lo que se omite se toma de la
// solicitud, y cada valor capturado viaja al proyecto con su clave.
export const convertRequest = (id, input = {}) =>
  request(`/requests/${id}/convert`, { method: "POST", body: input });

// --- Proyectos (RF-PRY-02) ---

export const listProjects = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== null && value !== ""),
  );
  return request(`/projects?${search}`);
};

// El proyecto con sus etapas (y los vistos buenos de cada una), sus valores y las
// solicitudes que contesta.
export const getProject = (id) => request(`/projects/${id}`);

// La llave se genera si no se manda. `stages` abre las primeras etapas: la de menor `seq`
// arranca activa.
export const createProject = (input) => request("/projects", { method: "POST", body: input });

export const updateProject = (id, changes) =>
  request(`/projects/${id}`, { method: "PATCH", body: changes });

export const setProjectStatus = (id, statusId) =>
  request(`/projects/${id}/status`, { method: "PUT", body: { statusId } });

// Se niega mientras alguna etapa siga activa o en espera.
export const closeProject = (id) => request(`/projects/${id}/close`, { method: "POST" });

export const archiveProject = (id) => request(`/projects/${id}/archive`, { method: "POST" });

export const deleteProject = (id) => request(`/projects/${id}`, { method: "DELETE" });

export const listProjectStages = (id) => request(`/projects/${id}/stages`);

export const createProjectStage = (id, input) =>
  request(`/projects/${id}/stages`, { method: "POST", body: input });

// Mueve la etapa: pending → active, active ↔ waiting_external (con motivo), → cancelled.
// `done` no se pone a mano: la etapa la cierra un visto bueno.
export const updateProjectStage = (id, stageId, changes) =>
  request(`/projects/${id}/stages/${stageId}`, { method: "PATCH", body: changes });

// El visto bueno (RF-FLW-03). Devuelve { approval, stage, reopened }: rechazar cierra el
// intento y abre el siguiente.
export const createApproval = (id, stageId, input) =>
  request(`/projects/${id}/stages/${stageId}/approvals`, { method: "POST", body: input });

export const listFieldValues = (id) => request(`/projects/${id}/field-values`);

// Un valor que una etapa produce y otra lee (RF-FLW-06). Una corrección es este mismo PUT.
export const setFieldValue = (id, key, value, producedByStageId = null) =>
  request(`/projects/${id}/field-values/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: producedByStageId === null ? { value } : { value, producedByStageId },
  });

export const deleteFieldValue = (id, key) =>
  request(`/projects/${id}/field-values/${encodeURIComponent(key)}`, { method: "DELETE" });

// Finanzas señala que el proyecto necesita cotización o factura, sin editar el proyecto.
// `needed: false` retira el pedido. Necesita el permiso `finance.request`.
export const requestFinance = (id, input) =>
  request(`/projects/${id}/finance-request`, { method: "POST", body: input });
