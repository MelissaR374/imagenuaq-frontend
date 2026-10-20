// «Archivos»: every folder, for anyone holding `document.read` (RF-ARC-02). Reading is open to
// all; a folder's area grants decide only who uploads and deletes. The top level lists every
// root: a project's folder carries the project's key as its name.
import FolderBrowser from "./folderBrowser.jsx";

/** The top level, which is the list of every root rather than a folder of its own. */
const TOP = { id: null, name: "Archivos" };

/** @param {{ canShare: boolean }} props Whether the viewer's role holds `document.share`. */
function Documents({ canShare }) {
  return <FolderBrowser root={TOP} canShare={canShare} />;
}

export default Documents;
