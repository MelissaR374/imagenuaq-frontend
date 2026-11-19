// The words for a photo folio's status, shared by the desk and the client portal.

/** Each status in the order a folio goes through them, with how the desk names it. */
export const STATUS_LABELS = {
  generated: "Sin registrar",
  registered: "Registrado",
  paid: "Pagado",
  proofs: "Muestras listas",
  selected: "Elección enviada",
  ready: "Fotos listas",
  printed: "Impreso",
  delivered: "Entregado",
};

/** The same steps as the client reads them on their page. */
export const PORTAL_STEPS = [
  { status: "registered", label: "Tus datos" },
  { status: "paid", label: "Pago" },
  { status: "proofs", label: "Elige tus fotos" },
  { status: "selected", label: "En edición" },
  { status: "ready", label: "Descarga" },
];

/** Whether `status` is at `step` or past it. */
export function reached(status, step) {
  const order = Object.keys(STATUS_LABELS);
  return order.indexOf(status) >= order.indexOf(step);
}

/** An amount as pesos, from the two-decimal string the server sends. */
export function pesos(amount) {
  return amount === null || amount === undefined
    ? "—"
    : Number(amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
