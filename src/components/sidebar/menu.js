// Las pestañas del menú lateral en los modos Coordinación y Fotografía, y las reglas para mostrarlas.
// Las generales las ve todo usuario. Las demás dependen del catálogo de permisos por rol (RF-USR-02,
// RF-USR-05). Solo Roles y permisos y Tipos de contrato quedan reservadas a admin.
import {
  MdNotificationsNone,
  MdInbox,
  MdFolder,
  MdPeople,
  MdSchedule,
  MdAccountTree,
  MdBusiness,
  MdDescription,
  MdReceipt,
  MdCheckBox,
  MdAttachFile,
  MdAttachMoney,
  MdBadge,
  MdContacts,
  MdAdminPanelSettings,
  MdLabel,
  MdSchema,
  MdViewQuilt,
  MdCalendarMonth,
  MdWork,
  MdEventBusy,
  MdPrint,
  MdPalette,
  MdStore,
  MdLocalShipping,
  MdPhotoCamera,
  MdQrCodeScanner,
  MdTimer,
} from "react-icons/md";

export const menuSections = [
  {
    title: null,
    items: [
      { label: "Notificaciones", icon: MdNotificationsNone },
      { label: "Mis tareas", icon: MdCheckBox, permission: "task.read" },
      { label: "Calendario", icon: MdCalendarMonth, permission: "calendar.read" },
      { label: "Cronograma", icon: MdSchedule, permission: "calendar.read" },
      { label: "Vehículos", icon: MdLocalShipping, permission: "calendar.read" },
      { label: "Organigrama", icon: MdContacts },
    ],
  },
  {
    title: "PROYECTOS",
    items: [
      { label: "Bandeja de solicitudes", icon: MdInbox, permission: "request.read" },
      { label: "Proyectos", icon: MdFolder, permission: "project.read" },
      { label: "Archivos", icon: MdAttachFile, permission: "document.read" },
      { label: "Órdenes de impresión", icon: MdPrint, permission: "print.read" },
    ],
  },
  {
    title: "LÍDER",
    items: [
      { label: "Panorama de áreas", icon: MdViewQuilt, permission: "task.write" },
      { label: "Por asignar", icon: MdInbox, permission: "task.write" },
      { label: "Equipo", icon: MdPeople, permission: "task.write" },
    ],
  },
  {
    title: "FINANZAS",
    items: [
      { label: "Facturación", icon: MdReceipt, permission: "finance.read" },
      { label: "Cotizaciones", icon: MdAttachMoney, permission: "finance.read" },
      { label: "Proveedores", icon: MdStore, permission: "finance.read" },
    ],
  },
  {
    title: "PERSONAL",
    items: [
      { label: "Ausencias", icon: MdEventBusy, permission: "absence.read" },
      { label: "Empleados", icon: MdBadge, roles: ["admin"], permission: "user.role" },
      { label: "Áreas y usuarios", icon: MdBusiness, permission: "area.manage" },
      { label: "Roles y permisos", icon: MdAdminPanelSettings, roles: ["admin"] },
      { label: "Tipos de contrato", icon: MdWork, roles: ["admin"] },
      { label: "Tipos de ausencia", icon: MdEventBusy, permission: "absence.manage" },
    ],
  },
  {
    title: "CONFIGURACIÓN",
    items: [
      { label: "Formatos de solicitud", icon: MdDescription, permission: "schema.manage" },
      { label: "Diseñador de flujos", icon: MdAccountTree, permission: "workflow.manage" },
      { label: "Catálogo de estatus", icon: MdLabel, permission: "status.manage" },
      { label: "Libros de Excel", icon: MdSchema, permission: "spreadsheet.read" },
      { label: "Retención de archivos", icon: MdAttachFile, permission: "document.manage" },
      { label: "Pantones y máquinas", icon: MdPalette, permission: "print.manage" },
    ],
  },
];

/** Las pestañas del modo Fotografía, el servicio de fotos de graduación (RF-PRY-06). */
export const photoSections = [
  {
    title: "FOTOGRAFÍA",
    items: [
      { label: "Grupos", icon: MdPhotoCamera, permission: "photo.read" },
      { label: "Escanear folio", icon: MdQrCodeScanner, permission: "photo.read" },
    ],
  },
  {
    title: "CONFIGURACIÓN",
    items: [
      { label: "Catálogo de precios", icon: MdAttachMoney, permission: "photo.manage" },
      { label: "Conservación de fotos", icon: MdTimer, permission: "photo.manage" },
    ],
  },
];

/** Las pestañas de los dos modos juntas, para buscar una por su nombre. */
const allItems = () => [...menuSections, ...photoSections].flatMap((section) => section.items);

/**
 * Lo que es cada vista, en una frase declarativa: el encabezado nombra la pantalla y la
 * sitúa en el proceso, sin instrucciones ni controles.
 */
export const descripciones = {
  Organigrama: "Las áreas de la coordinación y quién está en cada una.",
  Notificaciones: "Lo que pasó en tus solicitudes, proyectos y etapas.",
  "Mi perfil": "Tus datos de cuenta y tu foto.",
  Empleados: "Las personas registradas y el rol de cada una.",
  "Áreas y usuarios":
    "El organigrama de la coordinación y quién está en cada área.",
  "Roles y permisos": "Lo que puede hacer cada rol.",
  "Tipos de contrato": "Configura los tipos de contrato y los beneficios que se asignan a los empleados.",
  Ausencias: "Las ausencias del personal: permisos, incapacidades y días institucionales, con su estado de aprobación.",
  "Tipos de ausencia": "El catálogo de tipos de ausencia y sus reglas: si consumen saldo, si requieren documento.",
  "Formatos de solicitud":
    "Los formatos de captura de datos para generar un proyecto.",
  "Libros de Excel":
    "Tus libros de Excel: conéctalos, indica qué columna es cada dato e importa las filas nuevas.",
  "Bandeja de solicitudes":
    "Solicitudes recibidas que todavía no son proyecto.",
  Proyectos: "Los proyectos y el avance de sus etapas.",
  "Catálogo de estatus":
    "Los estatus con que se muestran solicitudes y proyectos, globales y por área.",
  "Diseñador de flujos":
    "Plantillas para definir cómo se va a tratar un proyecto, para agilizar la asignación de tareas",
  Archivos: "Todas las carpetas de cada proyecto.",
  "Retención de archivos": "Cuánto tiempo se conservan los archivos.",
  "Mis tareas": "Las etapas de desarrollo de un proyecto a tu cargo",
  "Por asignar": "Las etapas de tu área que todavía no tienen responsable",
  Equipo: "Las etapas abiertas de cada persona del área y quién falta esta semana.",
  "Panorama de áreas": "Lo que cada área tiene por asignar y la carga de su gente esta semana.",
  Calendario: "Las etapas, ausencias, reservas de vehículo y fechas institucionales del mes, y las ventanas de cierre de semestre.",
  Vehículos: "Las reservas de vehículo para entregar y recoger material, y el catálogo de vehículos.",
  Cronograma: "Qué tan ocupada está cada área día por día, contando a quién le falta gente.",
  Facturación: "Los proyectos con su estado de cobro y las facturas de todos ellos.",
  Cotizaciones: "Las cotizaciones subidas a cada proyecto.",
  Proveedores: "El directorio de proveedores con sus datos de contacto.",
  "Órdenes de impresión": "Las órdenes de trabajo para las máquinas de impresión.",
  "Pantones y máquinas": "Catálogo de colores Pantone y máquinas de impresión.",
  Grupos: "Los grupos de las sesiones de fotos, con sus folios, cobros y entregas.",
  "Escanear folio": "El folio de una hoja, abierto con la cámara o con su código.",
  "Catálogo de precios": "Los paquetes del servicio de fotografía y su precio.",
  "Conservación de fotos": "Cuántos días se pueden descargar las fotos antes de borrarse.",
};

/** Las etiquetas del menú en el orden que dejó el usuario al arrastrarlas; se guarda en este navegador. */
export function leerOrden() {
  try {
    return JSON.parse(localStorage.getItem("menuOrden")) ?? [];
  } catch {
    return [];
  }
}

/** Ordena `items` según `orden`; los que no aparecen ahí quedan al final, en su orden de siempre. */
export function ordenar(items, orden) {
  const posicion = (item) => {
    const i = orden.indexOf(item.label);
    return i === -1 ? orden.length + items.indexOf(item) : i;
  };
  return [...items].sort((a, b) => posicion(a) - posicion(b));
}

/**
 * Si el elemento del menú se ve:
 * - Por `roles` si la define y el rol está en la lista (exclusivo para admin).
 * - Por `permission` si la define (gestión por catálogo de permisos de roles). Con las dos,
 *   basta cualquiera: «Empleados» la ve coordinación y quien tenga `user.role`.
 * - Si no define ninguna (pestañas generales), visible para cualquier usuario autenticado.
 */
export function itemVisible(item, role, permissions) {
  if (item.roles?.includes(role)) {
    return true;
  }
  if (item.permission) {
    return permissions.includes(item.permission);
  }
  if (item.roles) {
    return item.roles.includes(role);
  }
  return true;
}

/** Las pestañas que abre el permiso `code`, para decirlo en «Roles y permisos». */
export function tabsFor(code) {
  return allItems()
    .filter((item) => item.permission === code)
    .map((item) => item.label);
}

/** Si la pestaña `label` se ve; una que no está en el menú, como «Mi perfil», siempre se ve. */
export function canSee(label, role, permissions) {
  const item = allItems().find((candidate) => candidate.label === label);
  return !item || itemVisible(item, role, permissions);
}

/** Si la pestaña `label` es del modo Fotografía. */
export function isPhotoTab(label) {
  return photoSections.some((section) => section.items.some((item) => item.label === label));
}

/**
 * Los modos que puede abrir alguien: Fotografía con `photo.read`, Coordinación si ve alguna
 * pestaña de trabajo más allá de las generales que ven todos. `work` dice si en Coordinación tiene
 * algo más que el calendario: quien no, trabaja en Fotografía y entra por ahí.
 *
 * @returns {{ coordination: boolean, photo: boolean, work: boolean }}
 */
export function modesFor(role, permissions) {
  const seen = menuSections
    .flatMap((section) => section.items)
    .filter((item) => (item.permission || item.roles) && itemVisible(item, role, permissions));
  return {
    coordination: seen.length > 0,
    work: seen.some((item) => item.permission !== "calendar.read"),
    photo: permissions.includes("photo.read"),
  };
}
