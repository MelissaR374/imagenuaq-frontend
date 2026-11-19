// «Escanear folio»: the desk on a phone or laptop. A scan of a person's sheet, or its typed code,
// opens that folio with its actions. Staff pick the folio from the person's own sheet, not by name.
import { useState } from "react";

import * as api from "../../api/client.js";
import QrScan from "../shared/qrScan.jsx";
import FolioPanel from "./folioPanel.jsx";
import "./photos.css";

/** @param {{ canManage: boolean }} props */
function PhotoScan({ canManage }) {
  const [folioId, setFolioId] = useState(null);
  const [scanning, setScanning] = useState(true);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(null);

  async function open(code) {
    setError(null);
    try {
      const result = await api.lookupPhotoFolio(code);
      setFolioId(result.folio.id);
      setScanning(false);
    } catch (failure) {
      setError(failure.status === 404 ? "Ese código no corresponde a ningún folio." : failure.message);
    }
  }

  function again() {
    setFolioId(null);
    setTyped("");
    setError(null);
    setScanning(true);
  }

  return (
    <div className="photos photo-scan">
      {scanning ? (
        <>
          <QrScan onScan={open} />
          <form
            className="photos-inline"
            onSubmit={(event) => {
              event.preventDefault();
              open(typed);
            }}
          >
            <input
              className="photo-code-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="O escribe el código: ABCD-1234"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="photos-btn" type="submit">
              Abrir
            </button>
          </form>
        </>
      ) : (
        <button className="photos-btn" type="button" onClick={again}>
          Escanear otro folio
        </button>
      )}

      {error !== null ? <p className="photos-error">{error}</p> : null}

      {folioId !== null ? <FolioPanel key={folioId} folioId={folioId} canManage={canManage} /> : null}
    </div>
  );
}

export default PhotoScan;
