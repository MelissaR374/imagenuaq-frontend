// The camera reads a QR code, for the photo desk and the photo portal. It opens only over HTTPS or on
// localhost, after the person allows it. Otherwise the screen says why and a typed code still works.
// It reports the same code twice in a row only once.
import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

import "./qrScan.css";

/** @param {{ onScan: (text: string) => void }} props */
function QrScan({ onScan }) {
  const video = useRef(null);
  const last = useRef(null);
  const report = useRef(onScan);
  const [error, setError] = useState(null);

  useEffect(() => {
    report.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new QrScanner(
      video.current,
      (result) => {
        if (result.data === last.current) return;
        last.current = result.data;
        report.current(result.data);
      },
      { preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true },
    );
    scanner.start().catch((failure) => {
      setError(
        window.isSecureContext
          ? `No se pudo abrir la cámara: ${failure?.message ?? failure}`
          : "La cámara solo se abre en una conexión segura (https).",
      );
    });
    return () => scanner.destroy();
  }, []);

  return (
    <div className="qr-scan">
      <video className="qr-scan-video" ref={video} muted playsInline />
      {error !== null ? <p className="qr-scan-error">{error}</p> : null}
    </div>
  );
}

export default QrScan;
