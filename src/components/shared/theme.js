// The theme for a page outside the app's shell, such as a share link or a public form. Those
// pages render without App.jsx, so they read the viewer's choice themselves.

/**
 * The theme the viewer last chose in the app, or their system's, as App.jsx decides it.
 *
 * @returns {"dark-mode" | "light-mode"}
 */
export function themeClass() {
  let saved;
  try {
    saved = localStorage.getItem("theme");
  } catch {
    saved = null;
  }
  const dark = saved
    ? saved === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  return dark ? "dark-mode" : "light-mode";
}
