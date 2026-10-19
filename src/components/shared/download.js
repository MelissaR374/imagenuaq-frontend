// Saving a file the API returned as a Blob. A plain link cannot carry the session token, so the
// bytes are fetched first and then handed to the browser.

/** Hands a Blob to the browser as a download under `name`. */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
