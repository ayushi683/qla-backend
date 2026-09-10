import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function PdfViewerModal({ path, filename, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = null;
    api.getViewUrl(path)
      .then((u) => { objectUrl = u; setUrl(u); })
      .catch((e) => setError(e.message || "Could not load file"));
    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel pdf-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-case-ref">{filename || "Document"}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="pdf-modal-body">
          {error && <div className="flash flash-error" style={{ margin: 20 }}>{error}</div>}
          {!error && !url && <p className="no-recs" style={{ padding: 20 }}>Loading…</p>}
          {url && <iframe src={url} title={filename || "PDF"} className="pdf-modal-iframe" />}
        </div>
      </div>
    </div>
  );
}