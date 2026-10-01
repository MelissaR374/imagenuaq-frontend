import { API_URL } from "../config.js";

const TOKEN_KEY = "imagenuaq.token";

/** Un error que el servidor devolvió a propósito, con su mensaje y su código. */
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

/**
 * Hace una petición y devuelve el JSON ya listo. Si el servidor responde con un error,
 * lanza un ApiError con el mensaje que él mismo mandó.
 */
async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  const token = auth ? getToken() : null;

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  if (!response.ok) throw await toError(response);
  return response.json().catch(() => null);
}

/** El ApiError con el mensaje que mandó el servidor, o uno genérico con el código. */
async function toError(response) {
  const data = await response.json().catch(() => null);
  return new ApiError(data?.error?.message ?? `Error ${response.status}.`, response.status);
}

/** La ruta con sus filtros como query string, omitiendo los vacíos. */
function withQuery(path, params = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== ""),
  );
  return `${path}?${search}`;
}

export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: { email, password }, auth: false });

/** Canjea la invitación que dio un administrador y devuelve una sesión, igual que login. */
export const activate = (token, password) =>
  request("/auth/activate", { method: "POST", body: { token, password }, auth: false });

/** Quién dice el servidor que eres con el token guardado. */
export const session = () => request("/auth/me");

/** El registro propio completo, con cumpleaños y tipo de contrato: { user }. */
export const getProfile = () => request("/auth/me/profile");

/** Solo fullName, email y birthday; cualquier otra llave el servidor la ignora. */
export const updateProfile = (changes) =>
  request("/auth/me", { method: "PATCH", body: changes });

/** Pide la contraseña actual antes de cambiarla. Las demás sesiones abiertas siguen vivas. */
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/me/password", { method: "PUT", body: { currentPassword, newPassword } });

/**
 * La foto de perfil de alguien como Blob, o null si no tiene. Va aparte de request()
 * porque la respuesta es una imagen, no JSON, y una etiqueta <img> no puede mandar el
 * token: hay que pedirla con fetch y mostrarla con URL.createObjectURL.
 */
export async function getPicture(userId) {
  const response = await fetch(`${API_URL}/users/${userId}/picture`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw await toError(response);
  }

  return response.blob();
}

/**
 * Sube la foto propia tal cual, sin multipart: el cuerpo es el archivo y el tipo va en el
 * encabezado. Acepta PNG, JPEG o WebP de hasta 2 MB; lo demás el servidor lo rechaza.
 */
export async function setMyPicture(file) {
  const response = await fetch(`${API_URL}/auth/me/picture`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": file.type },
    body: file,
  });

  if (!response.ok) {
    throw await toError(response);
  }
}

export const clearMyPicture = () => request("/auth/me/picture", { method: "DELETE" });

export const listUsers = (params = {}) => request(withQuery("/users", params));

/**
 * Devuelve { user, inviteToken }. El token de invitación no se guarda en ningún lado:
 * esta respuesta es la única vez que se puede ver.
 */
export const createUser = (input) => request("/users", { method: "POST", body: input });

export const updateUser = (id, changes) =>
  request(`/users/${id}`, { method: "PATCH", body: changes });

export const deleteUser = (id) => request(`/users/${id}`, { method: "DELETE" });

/** Una invitación nueva, solo si la cuenta todavía no se ha activado. */
export const reinviteUser = (id) => request(`/users/${id}/invite`, { method: "POST" });

export const listRoles = () => request("/roles");

/** El catálogo completo de permisos, no los de un rol en particular. */
export const listPermissions = () => request("/roles/permissions");

export const listAreas = () => request("/areas");

export const listContractTypes = () => request("/contract-types");

/**
 * El organigrama completo: { roots: [...] }, cada nodo con parentAreaId, leaders y children.
 */
export const getOrgChart = () => request("/areas/orgchart");

/**
 * Sin parentAreaId el servidor cuelga el área bajo Coordinación; con parentAreaId: null
 * la deja como raíz.
 */
export const createArea = (input) => request("/areas", { method: "POST", body: input });

/** Solo name y description; el padre se cambia con setAreaParent / clearAreaParent. */
export const updateArea = (id, changes) =>
  request(`/areas/${id}`, { method: "PATCH", body: changes });

/** Falla con 409 mientras el área tenga gente asignada. */
export const deleteArea = (id) => request(`/areas/${id}`, { method: "DELETE" });

export const setAreaParent = (id, parentAreaId) =>
  request(`/areas/${id}/parent`, { method: "PUT", body: { parentAreaId } });

export const clearAreaParent = (id) => request(`/areas/${id}/parent`, { method: "DELETE" });

/** Un upsert: agrega a la persona al área o, si ya está, cambia si la encabeza. */
export const setAreaMember = (areaId, userId, isAreaLeader) =>
  request(`/areas/${areaId}/members/${userId}`, { method: "PUT", body: { isAreaLeader } });

/** Quita la pertenencia al área, no la cuenta. */
export const removeAreaMember = (areaId, userId) =>
  request(`/areas/${areaId}/members/${userId}`, { method: "DELETE" });

export const createRole = (input) => request("/roles", { method: "POST", body: input });

/**
 * Renombrar un rol saca a quienes lo tienen hasta que vuelvan a entrar: el servidor compara
 * el nombre que trae la sesión con el de la tabla.
 */
export const updateRole = (id, changes) =>
  request(`/roles/${id}`, { method: "PATCH", body: changes });

/** Falla con 409 mientras alguien tenga el rol. */
export const deleteRole = (id) => request(`/roles/${id}`, { method: "DELETE" });

/** Lo que un rol puede hacer: { permissions: [...] }, cada uno con code y label. */
export const getRolePermissions = (id) => request(`/roles/${id}/permissions`);

/** Reemplaza todos los permisos del rol por la lista de códigos que se manda. */
export const setRolePermissions = (id, codes) =>
  request(`/roles/${id}/permissions`, { method: "PUT", body: { permissions: codes } });

/**
 * Qué registro usa el servidor: { source, tenantId, clientId, hasSecret, redirectUri, ... }.
 * Nunca trae el secreto, sólo si hay uno.
 */
export const getMicrosoftApp = () => request("/microsoft/app");

/** Guarda { tenantId, clientId, clientSecret }. El secreto se puede omitir si ya hay uno. */
export const setMicrosoftApp = (input) =>
  request("/microsoft/app", { method: "PUT", body: input });

/** Olvida el registro guardado; si .env tiene uno, vuelve a aplicar ése. */
export const clearMicrosoftApp = () => request("/microsoft/app", { method: "DELETE" });

/**
 * Devuelve { url }: a dónde mandar al navegador para iniciar sesión con Microsoft. Al
 * terminar, Microsoft regresa al servidor y éste vuelve aquí con ?microsoft=connected.
 */
export const connectMicrosoft = () => request("/microsoft/connect", { method: "POST" });

/** Las cuentas propias; un administrador ve las de todos. Nunca trae el token. */
export const listMicrosoftAccounts = () => request("/microsoft/accounts");

/** Retira el acceso. La cuenta queda marcada como revocada, no se borra. */
export const revokeMicrosoftAccount = (id) =>
  request(`/microsoft/accounts/${id}`, { method: "DELETE" });

export const listSpreadsheets = () => request("/spreadsheets");

/**
 * Lo que hay detrás de un enlace compartido, visto con esa cuenta: driveId, itemId, nombre
 * y las tablas y hojas del libro, para elegir una y registrarla.
 */
export const resolveSpreadsheet = (accountId, url) =>
  request(`/spreadsheets/resolve?${new URLSearchParams({ accountId, url })}`);

/** Registra { accountId, name, driveId, itemId, tableName, webUrl }. No consulta Microsoft. */
export const registerSpreadsheet = (input) =>
  request("/spreadsheets", { method: "POST", body: input });

/** La fila de encabezados, leída en vivo. Falla con 409 si la cuenta hay que reconectarla. */
export const previewSpreadsheet = (id) => request(`/spreadsheets/${id}/preview`);

export const deleteSpreadsheet = (id) => request(`/spreadsheets/${id}`, { method: "DELETE" });

export const listSchemas = () => request("/schemas");

export const getSchema = (id) => request(`/schemas/${id}`);

export const listSchemaVersions = (id) => request(`/schemas/${id}/versions`);

/** Una versión por su propio id: es a lo que apuntan las solicitudes y los proyectos. */
export const getSchemaVersion = (versionId) => request(`/schemas/versions/${versionId}`);

export const createSchema = (input) => request("/schemas", { method: "POST", body: input });

/** Publica la siguiente versión. Las anteriores quedan intactas. */
export const createSchemaVersion = (id, fields) =>
  request(`/schemas/${id}/versions`, { method: "POST", body: { fields } });

/** Un formato nuevo que empieza con los campos del último del otro (plantilla). */
export const cloneSchema = (id, code, name) =>
  request(`/schemas/${id}/clone`, { method: "POST", body: { code, name } });

/** Solo nombre y activo; los campos no se editan por aquí. */
export const updateSchema = (id, changes) =>
  request(`/schemas/${id}`, { method: "PATCH", body: changes });

export const deleteSchema = (id) => request(`/schemas/${id}`, { method: "DELETE" });

/**
 * El vocabulario de claves: cada clave publicada alguna vez, con su definición más reciente y
 * en qué formatos vive. Una clave significa una sola cosa en todo el sistema, así que el
 * constructor de formatos la reusa en vez de redefinirla.
 */
export const listFieldKeys = () => request("/schemas/field-keys");

/**
 * El catálogo de tipos de campo. Es de solo lectura: cada tipo es una regla de conversión
 * que el servidor implementa.
 */
export const listDataTypes = () => request("/data-types");

export const listWorkflows = () => request("/workflows");

export const getWorkflow = (id) => request(`/workflows/${id}`);

export const listWorkflowVersions = (id) => request(`/workflows/${id}/versions`);

export const getWorkflowVersion = (versionId) => request(`/workflows/versions/${versionId}`);

export const createWorkflow = (input) => request("/workflows", { method: "POST", body: input });

/** Publica la siguiente versión con el flujo completo. Las anteriores quedan intactas. */
export const publishWorkflowVersion = (id, phases) =>
  request(`/workflows/${id}/versions`, { method: "POST", body: { phases } });

/** Una plantilla nueva que empieza con la última versión de otra. */
export const cloneWorkflow = (id, code, name) =>
  request(`/workflows/${id}/clone`, { method: "POST", body: { code, name } });

/** Solo nombre y activo; el flujo no se edita por aquí. */
export const updateWorkflow = (id, changes) =>
  request(`/workflows/${id}`, { method: "PATCH", body: changes });

export const deleteWorkflow = (id) => request(`/workflows/${id}`, { method: "DELETE" });

export const listStatuses = (params = {}) => request(withQuery("/statuses", params));

export const createStatus = (input) => request("/statuses", { method: "POST", body: input });

/** El código y el área no se editan: son bajo lo que se archivó lo anterior. */
export const updateStatus = (id, changes) =>
  request(`/statuses/${id}`, { method: "PATCH", body: changes });

export const deleteStatus = (id) => request(`/statuses/${id}`, { method: "DELETE" });

/**
 * Las cadenas en uso, de más usada a menos, para el autocompletado. No hay padrón de
 * solicitantes: el nombre es una cadena y esto es lo que evita que se vuelva cuatro.
 */
export const listRequesters = (q = "") =>
  request(withQuery("/requesters", { q }));

export const listRequests = (params = {}) => request(withQuery("/requests", params));

/** La solicitud con los campos del formato con que se capturó, para poder mostrarla. */
export const getRequest = (id) => request(`/requests/${id}`);

/**
 * { schemaId | schemaVersionId, title, requester, data, areaId, priority, source }.
 * Los valores se convierten según el tipo de cada campo; un error trae todas las quejas.
 */
export const createRequest = (input) => request("/requests", { method: "POST", body: input });

export const updateRequest = (id, changes) =>
  request(`/requests/${id}`, { method: "PATCH", body: changes });

export const setRequestStatus = (id, statusId) =>
  request(`/requests/${id}/status`, { method: "PUT", body: { statusId } });

export const deleteRequest = (id) => request(`/requests/${id}`, { method: "DELETE" });

/**
 * Convierte en proyecto: devuelve { project, conflicts, discardedFlows }. Lo que se omite se
 * toma de la solicitud, cada valor capturado viaja al proyecto con su clave, y si la solicitud
 * tiene flujo el proyecto nace con él.
 */
export const convertRequest = (id, input = {}) =>
  request(`/requests/${id}/convert`, { method: "POST", body: input });

/**
 * El flujo de una solicitud, que decide a qué bandejas cae. `{ workflowId }` copia una
 * plantilla; `{ phases }` es un flujo diseñado para ella. Reemplaza el que tuviera.
 */
export const setRequestFlow = (id, body) =>
  request(`/requests/${id}/flow`, { method: "PUT", body });

export const clearRequestFlow = (id) => request(`/requests/${id}/flow`, { method: "DELETE" });

export const listProjects = (params = {}) => request(withQuery("/projects", params));

/**
 * El proyecto con sus etapas (y los vistos buenos de cada una), sus valores y las
 * solicitudes que contesta.
 */
export const getProject = (id) => request(`/projects/${id}`);

/**
 * La llave se genera si no se manda. `stages` abre las primeras etapas: la de menor `seq`
 * arranca activa.
 */
export const createProject = (input) => request("/projects", { method: "POST", body: input });

export const updateProject = (id, changes) =>
  request(`/projects/${id}`, { method: "PATCH", body: changes });

export const setProjectStatus = (id, statusId) =>
  request(`/projects/${id}/status`, { method: "PUT", body: { statusId } });

/** Se niega mientras alguna etapa siga activa o en espera. */
export const closeProject = (id) => request(`/projects/${id}/close`, { method: "POST" });

export const archiveProject = (id) => request(`/projects/${id}/archive`, { method: "POST" });

export const deleteProject = (id) => request(`/projects/${id}`, { method: "DELETE" });

export const listProjectStages = (id) => request(`/projects/${id}/stages`);

export const createProjectStage = (id, input) =>
  request(`/projects/${id}/stages`, { method: "POST", body: input });

/**
 * Mueve la etapa: pending → active, active ↔ waiting_external (con motivo), → cancelled.
 * `done` no se pone a mano: la etapa la cierra un visto bueno.
 */
export const updateProjectStage = (id, stageId, changes) =>
  request(`/projects/${id}/stages/${stageId}`, { method: "PATCH", body: changes });

/**
 * El visto bueno (RF-FLW-03). Devuelve { approval, stage, reopened }: rechazar cierra el
 * intento y abre el siguiente.
 */
export const createApproval = (id, stageId, input) =>
  request(`/projects/${id}/stages/${stageId}/approvals`, { method: "POST", body: input });

export const listFieldValues = (id) => request(`/projects/${id}/field-values`);

/** Un valor que una etapa produce y otra lee (RF-FLW-06). Una corrección es este mismo PUT. */
export const setFieldValue = (id, key, value, producedByStageId = null) =>
  request(`/projects/${id}/field-values/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: producedByStageId === null ? { value } : { value, producedByStageId },
  });

export const deleteFieldValue = (id, key) =>
  request(`/projects/${id}/field-values/${encodeURIComponent(key)}`, { method: "DELETE" });

/**
 * Finanzas señala que el proyecto necesita cotización o factura, sin editar el proyecto.
 * `needed: false` retira el pedido. Necesita el permiso `finance.request`.
 */
export const requestFinance = (id, input) =>
  request(`/projects/${id}/finance-request`, { method: "POST", body: input });

export const setSpreadsheetMapping = (id, input) =>
  request(`/spreadsheets/${id}/mapping`, { method: "PUT", body: input });

export const clearSpreadsheetMapping = (id) =>
  request(`/spreadsheets/${id}/mapping`, { method: "DELETE" });

/**
 * Las primeras filas como las leería el mapeo, sin escribir nada. Se le puede pasar un mapeo
 * que todavía no se guarda, que es la única forma honesta de juzgarlo: las preguntas que
 * contesta son sobre los datos.
 */
export const previewSpreadsheetMapping = (id, input = {}) =>
  request(`/spreadsheets/${id}/mapping/preview`, { method: "POST", body: input });

/**
 * Convierte las filas en solicitudes. `dryRun` cuenta sin escribir. Las filas ya importadas
 * no se vuelven a crear: la huella de la fila ya se conoce.
 */
export const importSpreadsheet = (id, input = {}) =>
  request(`/spreadsheets/${id}/import`, { method: "POST", body: input });

export const listSpreadsheetImports = (id) => request(`/spreadsheets/${id}/imports`);

/** Marcar las filas de hoy como ya vistas, sin crear solicitudes, y deshacerlo. */
export const markSpreadsheetRows = (id, input = {}) =>
  request(`/spreadsheets/${id}/baseline`, { method: "POST", body: input });

export const clearSpreadsheetMarks = (id) =>
  request(`/spreadsheets/${id}/baseline`, { method: "DELETE" });
