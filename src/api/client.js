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

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("No se pudo conectar con el servidor. Intenta de nuevo.", 0);
  }

  if (response.status === 204) return null;

  if (!response.ok) throw await toError(response);
  return response.json().catch(() => null);
}

/** Los rechazos por permiso, que el servidor dice con el código del permiso que falta. */
const NO_PERMISSION = /^(Missing permission|Needs one of these permissions|Insufficient role)/;

/** El mensaje que se le muestra a la persona: los rechazos más comunes, en español. */
function readable(message) {
  if (NO_PERMISSION.test(message)) return "Tu rol no tiene permiso para hacer esto.";
  if (message === "Invalid email or password.") return "Correo o contraseña incorrectos.";
  return message;
}

/** El ApiError con el mensaje que mandó el servidor, o uno genérico con el código. */
async function toError(response) {
  const data = await response.json().catch(() => null);
  return new ApiError(readable(data?.error?.message ?? `Error ${response.status}.`), response.status);
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

/** Cambia el rol de otra persona; pide `user.role`. */
export const setUserRole = (id, roleId) =>
  request(`/users/${id}/role`, { method: "PUT", body: { roleId } });

export const listRoles = () => request("/roles");

/** El catálogo completo de permisos, no los de un rol en particular. */
export const listPermissions = () => request("/roles/permissions");

/** Las áreas en uso; con `includeRetired`, también las retiradas. */
export const listAreas = (params = {}) => request(withQuery("/areas", params));

/** Quién está en un área; lo puede leer cualquier sesión. */
export const listAreaMembers = (areaId) => request(`/areas/${areaId}/members`);

export const listContractTypes = () => request("/contract-types");

export const createContractType = (name) =>
  request("/contract-types", { method: "POST", body: { name } });

/** Desactiva un tipo de contrato: sale de la lista, y quien ya lo tiene lo conserva. */
export const deleteContractType = (id) =>
  request(`/contract-types/${id}`, { method: "DELETE" });

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

/** Los enlaces públicos vigentes de un formato. */
export const listFormLinks = (id) => request(`/schemas/${id}/links`);

/** Un enlace público, con libro opcional. Su token sólo viene en esta respuesta. */
export const createFormLink = (id, sheetId = null) =>
  request(`/schemas/${id}/links`, { method: "POST", body: { sheetId } });

export const revokeFormLink = (id, linkId) =>
  request(`/schemas/${id}/links/${linkId}`, { method: "DELETE" });

/** El formato detrás de un enlace público: nombre y campos. Sin sesión. */
export const getPublicForm = (token) =>
  request(`/forms/${encodeURIComponent(token)}`, { auth: false });

/** Una respuesta al formulario. Devuelve `{ folio, uploadKey }`. Sin sesión. */
export const submitPublicForm = (token, input) =>
  request(`/forms/${encodeURIComponent(token)}`, { method: "POST", body: input, auth: false });

/** Termina la respuesta: el servidor escribe su fila en el Excel. Sin sesión. */
export const finishPublicForm = (token, key) =>
  request(`/forms/${encodeURIComponent(token)}/finish`, { method: "POST", body: { key }, auth: false });

/** Sube el archivo de un campo `document` de una respuesta recién enviada. Sin sesión. */
export async function uploadPublicFile(token, key, field, file) {
  const query = new URLSearchParams({ key, field, name: file.name });
  const response = await fetch(`${API_URL}/forms/${encodeURIComponent(token)}/files?${query}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/** Sube el archivo de un campo `document` de una solicitud a su carpeta. */
export async function uploadRequestFile(requestId, field, file) {
  const query = new URLSearchParams({ field, name: file.name });
  const response = await fetch(`${API_URL}/requests/${requestId}/files?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!response.ok) throw await toError(response);
  return response.json();
}

/**
 * El vocabulario de claves: cada clave publicada alguna vez, con su definición más reciente y
 * en qué formatos vive. Una clave significa una sola cosa en todo el sistema, así que el
 * constructor de formatos la reusa en vez de redefinirla.
 */
export const listFieldKeys = () => request("/schemas/field-keys");

/**
 * Registra un dato que ningún formato pide, con su nombre y su tipo, para que una etapa lo pida o
 * lo entregue. Sin `key`, la clave sale del nombre; si ya existe con el mismo tipo, la devuelve.
 */
export const createFieldKey = (body) => request("/schemas/field-keys", { method: "POST", body });

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

export const setSpreadsheetSync = (id, input) =>
  request(`/spreadsheets/${id}/sync`, { method: "PUT", body: input });

export const getProjectFolder = (projectId) => request(`/projects/${projectId}/folder`);

export const listTopFolders = () => request("/documents/folders");

export const getFolder = (id) => request(`/documents/folders/${id}`);

/** Todos los enlaces vigentes, con la carpeta y la ruta hasta ella. Requiere `document.share`. */
export const listLinks = () => request("/documents/links");

/**
 * Archivos cuyo nombre contiene `q` y, sin `folderId`, carpetas de proyecto por clave o título;
 * cada uno con la ruta de carpetas hasta él. `folderId` acota la búsqueda.
 */
export function searchFiles(q, folderId = null) {
  const params = new URLSearchParams({ q });
  if (folderId !== null) params.set("folderId", folderId);
  return request(`/documents/search?${params}`);
}

export const createFolder = (parentId, name) =>
  request("/documents/folders", { method: "POST", body: { parentId, name } });

export const updateFolder = (id, changes) =>
  request(`/documents/folders/${id}`, { method: "PATCH", body: changes });

export const deleteFolder = (id) => request(`/documents/folders/${id}`, { method: "DELETE" });

/** Reemplaza las áreas con que se comparte la carpeta: `[{ areaId, level: "read"|"write" }]`. */
export const setFolderAreas = (id, areas) =>
  request(`/documents/folders/${id}/areas`, { method: "PUT", body: { areas } });

/** Sube el archivo tal cual, sin multipart: el cuerpo es el archivo y el nombre va en la URL. */
export async function uploadFile(folderId, file) {
  const response = await fetch(
    `${API_URL}/documents/folders/${folderId}/files?name=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    },
  );

  if (!response.ok) {
    throw await toError(response);
  }
  return response.json();
}

const CHUNK_SIZE = 50 * 1024 * 1024;

/**
 * Sube un archivo en partes para sortear el límite de 100 MB de Cloudflare Tunnel.
 * Cada parte se envía como un PUT independiente. Al terminar se ensambla en el servidor.
 *
 * @param {number} folderId
 * @param {File} file
 * @param {{chunkSize?: number, onProgress?: function}} options
 */
export async function uploadFileChunked(folderId, file, { chunkSize = CHUNK_SIZE, onProgress } = {}) {
  const token = getToken();
  const auth = { Authorization: `Bearer ${token}` };

  const initRes = await fetch(`${API_URL}/documents/folders/${folderId}/uploads`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, mime: file.type || "application/octet-stream" }),
  });
  if (!initRes.ok) throw await toError(initRes);
  const { uploadId } = await initRes.json();

  const totalParts = Math.ceil(file.size / chunkSize);
  let loaded = 0;

  try {
    for (let i = 0; i < totalParts; i++) {
      const start = i * chunkSize;
      const blob = file.slice(start, start + chunkSize);
      const partRes = await fetch(`${API_URL}/documents/uploads/${uploadId}/${i + 1}`, {
        method: "PUT",
        headers: { ...auth, "Content-Type": "application/octet-stream" },
        body: blob,
      });
      if (!partRes.ok) throw await toError(partRes);
      loaded += blob.size;
      onProgress?.({ loaded, total: file.size });
    }

    const completeRes = await fetch(`${API_URL}/documents/uploads/${uploadId}/complete`, {
      method: "POST",
      headers: auth,
    });
    if (!completeRes.ok) throw await toError(completeRes);
    return completeRes.json();
  } catch (err) {
    fetch(`${API_URL}/documents/uploads/${uploadId}`, { method: "DELETE", headers: auth }).catch(() => {});
    throw err;
  }
}

/**
 * Elige la subida normal para archivos chicos y la de partes para los grandes.
 *
 * @param {number} folderId
 * @param {File} file
 * @param {{onProgress?: function}} options
 */
export async function smartUpload(folderId, file, { onProgress } = {}) {
  if (file.size <= CHUNK_SIZE) return uploadFile(folderId, file);
  return uploadFileChunked(folderId, file, { onProgress });
}

/** El contenido de un archivo como Blob; se pide con fetch porque un enlace no manda el token. */
export async function downloadFile(id) {
  const response = await fetch(`${API_URL}/documents/${id}/content`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!response.ok) {
    throw await toError(response);
  }
  return response.blob();
}

/** Los datos de un archivo: nombre, tipo y tamaño. */
export const getFile = (id) => request(`/documents/${id}`);

export const updateFile = (id, changes) =>
  request(`/documents/${id}`, { method: "PATCH", body: changes });

export const deleteFile = (id) => request(`/documents/${id}`, { method: "DELETE" });

export const listFolderLinks = (id) => request(`/documents/folders/${id}/links`);

/** Un enlace de solo lectura que vence en `expiresAt`. Su token sólo viene en esta respuesta. */
export const createFolderLink = (id, expiresAt) =>
  request(`/documents/folders/${id}/links`, { method: "POST", body: { expiresAt } });

export const revokeLink = (id) => request(`/documents/links/${id}`, { method: "DELETE" });

export const getRetention = () => request("/documents/retention");

export const setRetention = (months) =>
  request("/documents/retention", { method: "PUT", body: { months } });

/** Lo que muestra un enlace de solo lectura: su carpeta, o `folderId` si está debajo. Sin sesión. */
export const getSharedFolder = (token, folderId = null) =>
  request(
    folderId === null
      ? `/shared/${encodeURIComponent(token)}`
      : `/shared/${encodeURIComponent(token)}/folders/${folderId}`,
    { auth: false },
  );

/** La URL de descarga bajo un enlace; no lleva token de sesión, así que sirve en un <a>. */
export const sharedFileUrl = (token, fileId) =>
  `${API_URL}/shared/${encodeURIComponent(token)}/files/${fileId}/content`;

/** El contenido de un archivo bajo un enlace, como Blob, para la vista previa. Sin sesión. */
export async function downloadSharedFile(token, fileId) {
  const response = await fetch(sharedFileUrl(token, fileId));
  if (!response.ok) {
    throw await toError(response);
  }
  return response.blob();
}

/** Las etapas abiertas a cargo del usuario, con lo que ya entregó en cada una. */
export const listMyTasks = () => request("/tasks/mine");

/** Lo que el área todavía tiene que repartir: sus etapas abiertas sin responsable. */
export const listUnassigned = (areaId) => request(withQuery("/tasks/unassigned", { areaId }));

/** La carga de cada integrante del área, del menos cargado al más; `from` y `to` en AAAA-MM-DD. */
export const getWorkload = (areaId, window = {}) =>
  request(withQuery("/tasks/workload", { areaId, ...window }));

/**
 * Cada área en que el usuario reparte trabajo (todas para coordinación), con lo que le falta
 * asignar y la carga de su gente; `from` y `to` en AAAA-MM-DD.
 */
export const getTaskOverview = (window = {}) => request(withQuery("/tasks/overview", window));

/** Las etapas entregadas que esperan el visto bueno de quien consulta: las de sus áreas, o todas para coordinación. */
export const listToReview = () => request("/tasks/review");

/** El visto bueno desde la cola de revisión: `decision` es "approved" o "rejected", con comentario opcional. */
export const signOffStage = (stageId, decision, comment = null) =>
  request(`/tasks/stages/${stageId}/approvals`, { method: "POST", body: { decision, comment } });

/** Le da una etapa sin responsable a un integrante de su área; `userId` nulo la regresa a la bandeja. */
export const assignStage = (stageId, userId) =>
  request(`/tasks/stages/${stageId}/assignee`, { method: "PUT", body: { userId } });

/**
 * Entrega una etapa abierta: la evidencia escrita y, opcional, un archivo, que primero se sube a
 * la carpeta del proyecto.
 */
export async function deliverStage(projectId, stageId, note, file = null) {
  let fileId = null;
  if (file !== null) {
    const { folder } = await getProjectFolder(projectId);
    fileId = (await uploadFile(folder.id, file)).file.id;
  }
  return request(`/projects/${projectId}/stages/${stageId}/delivery`, {
    method: "PUT",
    body: { note, fileId },
  });
}

/** Entrega una etapa propia desde «Mis tareas», que no pide ver el proyecto. */
export async function deliverTask(stageId, note, file = null) {
  let fileId = null;
  if (file !== null) {
    const { folder } = await request(`/tasks/stages/${stageId}/folder`);
    fileId = (await uploadFile(folder.id, file)).file.id;
  }
  return request(`/tasks/stages/${stageId}/delivery`, { method: "PUT", body: { note, fileId } });
}

/**
 * Lo que pasa entre `from` y `to` (YYYY-MM-DD): etapas, ausencias sin motivo, eventos globales y
 * ventanas de cierre. `scope` es "mine", "area" o "all" (solo coordinación).
 */
export const getCalendar = (params) => request(withQuery("/calendar", params));

/** Un evento global, que ven todos: festivo o general, una vez o repitiéndose. */
export const createCalendarEvent = (body) => request("/calendar/events", { method: "POST", body });

/** Cambia o mueve un evento global; los campos que no se mandan se quedan como estaban. */
export const updateCalendarEvent = (eventId, body) =>
  request(`/calendar/events/${eventId}`, { method: "PATCH", body });

export const deleteCalendarEvent = (eventId) => request(`/calendar/events/${eventId}`, { method: "DELETE" });

/** Todas las ventanas de cierre de semestre, de la más antigua a la más reciente. */
export const listClosures = () => request("/calendar/closures");

export const createClosure = (body) => request("/calendar/closures", { method: "POST", body });

export const updateClosure = (closureId, body) =>
  request(`/calendar/closures/${closureId}`, { method: "PATCH", body });

export const deleteClosure = (closureId) => request(`/calendar/closures/${closureId}`, { method: "DELETE" });

/** Pega una nota en un día: `scope` es "personal", "area" (con `areaId`) o "global" (solo coordinación). */
export const createNote = (body) => request("/calendar/notes", { method: "POST", body });

/** Cambia el texto de una nota propia o la pasa a otro día (`day`). */
export const updateNote = (noteId, body) => request(`/calendar/notes/${noteId}`, { method: "PATCH", body });

export const deleteNote = (noteId) => request(`/calendar/notes/${noteId}`, { method: "DELETE" });

/** Los vehículos que se reservan para entregar y recoger material, activos o no (RF-CAL-04). */
export const listVehicles = () => request("/vehicles");

export const createVehicle = (body) => request("/vehicles", { method: "POST", body });

/** Renombra un vehículo o lo da de baja con `isActive: false`; sus reservas se quedan. */
export const updateVehicle = (vehicleId, body) => request(`/vehicles/${vehicleId}`, { method: "PATCH", body });

/** Las reservas que tocan `from`..`to` (a lo más 92 días), opcionalmente de un `vehicleId`. */
export const listVehicleBookings = (params) => request(withQuery("/vehicles/bookings", params));

/** Reserva un vehículo: `kind` es "delivery" o "pickup"; dos reservas del mismo vehículo no se empalman. */
export const createVehicleBooking = (body) => request("/vehicles/bookings", { method: "POST", body });

/** Cambia o mueve una reserva propia (o cualquiera, para coordinación). */
export const updateVehicleBooking = (bookingId, body) =>
  request(`/vehicles/bookings/${bookingId}`, { method: "PATCH", body });

export const deleteVehicleBooking = (bookingId) => request(`/vehicles/bookings/${bookingId}`, { method: "DELETE" });

/** Projects with their finance standing, the most missing invoices first; `flag` filters by flag, `completed` lists the finished ones. */
export const listFinanceProjects = (params = {}) => request(withQuery("/finance/projects", params));

/** The full finance summary for one project: standing plus quotes, invoices, oficios, payments, receipts. */
export const getFinanceSummary = (projectId) => request(`/finance/projects/${projectId}`);

/** Marca completo para finanzas un proyecto (`true`) o lo reabre (`false`); responde el mismo resumen. */
export const setFinanceComplete = (projectId, complete) =>
  request(`/finance/projects/${projectId}/complete`, { method: "PUT", body: { complete } });

/**
 * Pide a quien subió un registro que lo corrija, con la nota de qué está mal.
 *
 * @param {"quotes"|"invoices"|"oficios"|"payments"|"receipts"} kind
 */
export const requestCorrection = (kind, id, note) =>
  request(`/finance/${kind}/${id}/correction`, { method: "POST", body: { note } });

export const listProviders = (params = {}) => request(withQuery("/finance/providers", params));

export const getProvider = (id) => request(`/finance/providers/${id}`);

export const listQuotes = (params = {}) => request(withQuery("/finance/quotes", params));

export const getQuote = (id) => request(`/finance/quotes/${id}`);

export const listInvoices = (params = {}) => request(withQuery("/finance/invoices", params));

export const getInvoice = (id) => request(`/finance/invoices/${id}`);

export const listOficios = (params = {}) => request(withQuery("/finance/oficios", params));

export const getOficio = (id) => request(`/finance/oficios/${id}`);

export const listPayments = (params = {}) => request(withQuery("/finance/payments", params));

export const getPayment = (id) => request(`/finance/payments/${id}`);

export const listReceipts = (params = {}) => request(withQuery("/finance/receipts", params));

export const getReceipt = (id) => request(`/finance/receipts/${id}`);

/** Registra un proveedor. */
export const createProvider = (input) => request("/finance/providers", { method: "POST", body: input });

/** Corrige un proveedor existente. */
export const updateProvider = (id, changes) => request(`/finance/providers/${id}`, { method: "PATCH", body: changes });

/** Baja lógica de un proveedor. */
export const deleteProvider = (id) => request(`/finance/providers/${id}`, { method: "DELETE" });

/** Registra una cotización en un proyecto. */
export const createQuote = (projectId, input) =>
  request(`/finance/projects/${projectId}/quotes`, { method: "POST", body: input });

/** Corrige una cotización; atiende la corrección pendiente. */
export const updateQuote = (id, changes) => request(`/finance/quotes/${id}`, { method: "PATCH", body: changes });

/** Elimina una cotización a la que no apunta ninguna factura. */
export const deleteQuote = (id) => request(`/finance/quotes/${id}`, { method: "DELETE" });

/** Sube una factura a un proyecto. */
export const createInvoice = (projectId, input) =>
  request(`/finance/projects/${projectId}/invoices`, { method: "POST", body: input });

/** Corrige una factura; atiende la corrección pendiente. */
export const updateInvoice = (id, changes) => request(`/finance/invoices/${id}`, { method: "PATCH", body: changes });

/** Elimina una factura. */
export const deleteInvoice = (id) => request(`/finance/invoices/${id}`, { method: "DELETE" });

/** Emite un oficio de cobro para un proyecto. */
export const createOficio = (projectId, input) =>
  request(`/finance/projects/${projectId}/oficios`, { method: "POST", body: input });

/** Corrige un oficio o cambia sus facturas; atiende la corrección pendiente. */
export const updateOficio = (id, changes) => request(`/finance/oficios/${id}`, { method: "PATCH", body: changes });

/** Elimina un oficio y suelta sus facturas. */
export const deleteOficio = (id) => request(`/finance/oficios/${id}`, { method: "DELETE" });

/** Registra un pago (incoming a un oficio, outgoing a una factura). */
export const createPayment = (projectId, input) =>
  request(`/finance/projects/${projectId}/payments`, { method: "POST", body: input });

/** Corrige un pago (típicamente para agregar el folio de seguimiento). */
export const updatePayment = (id, changes) => request(`/finance/payments/${id}`, { method: "PATCH", body: changes });

/** Elimina un pago. */
export const deletePayment = (id) => request(`/finance/payments/${id}`, { method: "DELETE" });

/** Registra un recibo referenciado en un proyecto. */
export const createReceipt = (projectId, input) =>
  request(`/finance/projects/${projectId}/receipts`, { method: "POST", body: input });

/** Corrige un recibo; atiende la corrección pendiente. */
export const updateReceipt = (id, changes) => request(`/finance/receipts/${id}`, { method: "PATCH", body: changes });

/** Elimina un recibo. */
export const deleteReceipt = (id) => request(`/finance/receipts/${id}`, { method: "DELETE" });

/** Las notificaciones de quien tiene la sesión, de la más reciente a la más antigua; `{ limit, offset }`. */
export const listNotifications = (params = {}) =>
  request(withQuery("/notifications", params));

/** Cuántas notificaciones sin leer tiene quien tiene la sesión: `{ unreadCount }`. */
export const countUnreadNotifications = () =>
  request("/notifications/unread-count");

/** Marca una notificación propia como leída; 404 si es ajena o ya estaba leída. */
export const markNotificationAsRead = (id) =>
  request(`/notifications/${id}/read`, {
    method: "PATCH",
  });

/** Marca como leídas todas las notificaciones de quien tiene la sesión. */
export const markAllNotificationsAsRead = () =>
  request("/notifications/read-all", {
    method: "PATCH",
  });

export const listAbsenceTypes = () => request("/absences/types");

export const createAbsenceType = (input) =>
  request("/absences/types", { method: "POST", body: input });

export const updateAbsenceType = (id, changes) =>
  request(`/absences/types/${id}`, { method: "PATCH", body: changes });

export const listAbsences = (params = {}) =>
  request(withQuery("/absences", params));

export const getAbsence = (id) => request(`/absences/${id}`);

export const createAbsence = (input) =>
  request("/absences", { method: "POST", body: input });

export const setAbsenceStatus = (id, input) =>
  request(`/absences/${id}/status`, { method: "POST", body: input });

export const updateAbsence = (id, changes) =>
  request(`/absences/${id}`, { method: "PATCH", body: changes });

export const deleteAbsence = (id) =>
  request(`/absences/${id}`, { method: "DELETE" });

/** Uploads the backing document ("oficio") for an absence. Returns `{ file: { id, name, size } }`. */
export async function uploadAbsenceDocument(absenceId, file) {
  const response = await fetch(
    `${API_URL}/absences/${absenceId}/document?name=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    },
  );
  if (!response.ok) throw await toError(response);
  return response.json();
}

export const getAbsenceHistory = (id) => request(`/absences/${id}/history`);

export const getAvailability = (params = {}) =>
  request(withQuery("/absences/availability", params));

export const getBalances = (userId) => request(`/absences/balances/${userId}`);

export const listEntitlements = (contractTypeId) =>
  request(`/contract-types/${contractTypeId}/entitlements`);

export const createEntitlement = (contractTypeId, input) =>
  request(`/contract-types/${contractTypeId}/entitlements`, { method: "POST", body: input });

export const updateEntitlement = (contractTypeId, entitlementId, changes) =>
  request(`/contract-types/${contractTypeId}/entitlements/${entitlementId}`, { method: "PATCH", body: changes });

export const listPrintOrders = (params = {}) => request(withQuery("/print/orders", params));
export const getPrintOrder = (id) => request(`/print/orders/${id}`);
export const createPrintOrder = (input) => request("/print/orders", { method: "POST", body: input });
export const updatePrintOrder = (id, input) => request(`/print/orders/${id}`, { method: "PATCH", body: input });
export const setPrintOrderStatus = (id, input) => request(`/print/orders/${id}/status`, { method: "POST", body: input });
export const deletePrintOrder = (id) => request(`/print/orders/${id}`, { method: "DELETE" });

export const listPrintMachines = () => request("/print/machines");
export const createPrintMachine = (input) => request("/print/machines", { method: "POST", body: input });
export const updatePrintMachine = (id, input) => request(`/print/machines/${id}`, { method: "PATCH", body: input });

export const listPantones = (params = {}) => request(withQuery("/print/pantones", params));
export const lookupPantones = (entity) => request(withQuery("/print/pantones/lookup", { entity }));
export const createPantone = (input) => request("/print/pantones", { method: "POST", body: input });
export const updatePantone = (id, input) => request(`/print/pantones/${id}`, { method: "PATCH", body: input });
export const deletePantone = (id) => request(`/print/pantones/${id}`, { method: "DELETE" });

/** Cuántos días se pueden descargar las fotos: lo copia cada grupo nuevo. */
export const getPhotoRetention = () => request("/photos/retention");
export const setPhotoRetention = (days) => request("/photos/retention", { method: "PUT", body: { days } });

/** El catálogo de precios del servicio de fotografía, activos y retirados. */
export const listPhotoPackages = () => request("/photos/packages");
export const createPhotoPackage = (input) => request("/photos/packages", { method: "POST", body: input });
/** Edita un paquete o lo retira con `isActive: false`. Lo ya cobrado no cambia. */
export const updatePhotoPackage = (id, input) => request(`/photos/packages/${id}`, { method: "PATCH", body: input });

export const listPhotoGroups = () => request("/photos/groups");
export const getPhotoGroup = (id) => request(`/photos/groups/${id}`);
/** Crea el grupo y sus `size` folios, cada uno con su código. */
export const createPhotoGroup = (input) => request("/photos/groups", { method: "POST", body: input });
export const updatePhotoGroup = (id, input) => request(`/photos/groups/${id}`, { method: "PATCH", body: input });
export const listPhotoFolios = (groupId) => request(`/photos/groups/${groupId}/folios`);
export const addPhotoFolios = (groupId, count) =>
  request(`/photos/groups/${groupId}/folios`, { method: "POST", body: { count } });
/** Los folios con su código, para imprimir las hojas. */
export const listPhotoSheets = (groupId) => request(`/photos/groups/${groupId}/sheets`);

/** El folio de un código tecleado o leído con el escáner (acepta también la liga completa). */
export const lookupPhotoFolio = (code) => request(withQuery("/photos/folios/lookup", { code }));
export const getPhotoFolio = (id) => request(`/photos/folios/${id}`);
export const updatePhotoFolio = (id, input) => request(`/photos/folios/${id}`, { method: "PATCH", body: input });
export const recordPhotoPayment = (id, input) => request(`/photos/folios/${id}/payment`, { method: "POST", body: input });
/** `step` es "ready", "printed" o "delivered". */
export const advancePhotoFolio = (id, step) => request(`/photos/folios/${id}/${step}`, { method: "POST" });
export const deletePhotoFile = (fileId) => request(`/photos/files/${fileId}`, { method: "DELETE" });

/** El tamaño de cada parte al subir o bajar una foto: chico para pasar sin problema por un túnel de Cloudflare. */
const PHOTO_CHUNK = 8 * 1024 * 1024;

/**
 * Sube una foto en partes de PHOTO_CHUNK. `kind` es "proof" (muestra) o "final" (editada). Si una
 * parte falla, cancela la subida en el servidor.
 */
export async function uploadPhoto(folioId, kind, file) {
  const { uploadId } = await request(`/photos/folios/${folioId}/uploads`, {
    method: "POST",
    body: { kind, name: file.name, mime: file.type || null },
  });
  try {
    for (let part = 1, start = 0; start < file.size || part === 1; part += 1, start += PHOTO_CHUNK) {
      const response = await fetch(`${API_URL}/photos/uploads/${uploadId}/${part}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/octet-stream" },
        body: file.slice(start, start + PHOTO_CHUNK),
      });
      if (!response.ok) throw await toError(response);
    }
    return await request(`/photos/uploads/${uploadId}/complete`, { method: "POST" });
  } catch (failure) {
    request(`/photos/uploads/${uploadId}`, { method: "DELETE" }).catch(() => {});
    throw failure;
  }
}

/**
 * Baja un archivo en pedazos de PHOTO_CHUNK con encabezados Range y los junta en un Blob. Si el
 * servidor manda el archivo entero, lo toma tal cual.
 */
async function fetchInChunks(url, headers = {}) {
  const pieces = [];
  let start = 0;
  let total;
  let type = "";
  do {
    let response;
    try {
      response = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${start + PHOTO_CHUNK - 1}` } });
    } catch {
      throw new ApiError("No se pudo conectar con el servidor. Intenta de nuevo.", 0);
    }
    if (!response.ok) throw await toError(response);
    type = response.headers.get("Content-Type") || type;
    const piece = await response.blob();
    if (response.status !== 206) return piece;
    pieces.push(piece);
    total = Number(response.headers.get("Content-Range")?.split("/")[1]);
    start += piece.size;
  } while (start < total && Number.isFinite(total));
  return new Blob(pieces, { type });
}

/** Una foto como Blob para la mesa: la vista previa con marca de agua, o la original con `original`. */
export function getPhotoBlob(fileId, original = false) {
  return fetchInChunks(`${API_URL}/photos/files/${fileId}/${original ? "content" : "preview"}`, {
    Authorization: `Bearer ${getToken()}`,
  });
}

/** El folio que abre un código, como lo ve su dueño. Sin sesión: el código es la credencial. */
export const getPortalFolio = (code) => request(`/photo/${encodeURIComponent(code)}`, { auth: false });
export const registerPortalFolio = (code, input) =>
  request(`/photo/${encodeURIComponent(code)}/registration`, { method: "PUT", body: input, auth: false });
/** Guarda la elección entre las muestras. Con `lock: true` la envía a edición. */
export const selectPortalPhotos = (code, fileIds, lock = false) =>
  request(`/photo/${encodeURIComponent(code)}/selection`, { method: "PUT", body: { fileIds, lock }, auth: false });
/** La dirección de una vista previa, para un <img>: no necesita token. */
export const portalPreviewUrl = (code, fileId) => `${API_URL}/photo/${encodeURIComponent(code)}/previews/${fileId}`;
/** La miniatura de una foto editada, para un <img>: no necesita token ni cuenta como descarga. */
export const portalThumbnailUrl = (code, fileId) => `${API_URL}/photo/${encodeURIComponent(code)}/thumbnails/${fileId}`;

/** Una foto editada del propio folio como Blob, bajada en pedazos. */
export const downloadPortalPhoto = (code, fileId) =>
  fetchInChunks(`${API_URL}/photo/${encodeURIComponent(code)}/files/${fileId}`);
