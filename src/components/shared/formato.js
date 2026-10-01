// Formatos de texto que comparten varias pantallas.

/** Un guion largo cuando no hay valor, para que una celda vacía no parezca un error. */
export function oGuion(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "—";
  }
  return valor;
}

/** La fecha sin hora, en el formato local. */
export function fechaCorta(valor) {
  return new Date(valor).toLocaleDateString();
}

/** La letra de columna de Excel para un índice base cero: 0 → A, 25 → Z, 26 → AA. */
export function letraDeColumna(indice) {
  let letra = "";
  let n = indice;
  while (n >= 0) {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  }
  return letra;
}
