import React from 'react'

export default function FileList({ files, onRename, onEdit, onDownload, onRemove }) {
  if (files.length === 0) return null

  return (
    <div className="file-list">
      <h2 className="file-list__title">File caricati ({files.length})</h2>
      <ul className="file-list__items">
        {files.map((fileEntry) => (
          <li key={fileEntry.id} className="file-list__item">
            <div className="file-list__item-left">
              <span className="file-list__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <div className="file-list__info">
                <span className="file-list__name">{fileEntry.file.name}</span>
                <span className="file-list__size">
                  {(fileEntry.file.size / 1024).toFixed(1)} KB
                  {fileEntry.fields && fileEntry.fields.length > 0 && (
                    <span className="file-list__badge">
                      {fileEntry.fields.length} {fileEntry.fields.length !== 1 ? 'campi' : 'campo'}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="file-list__item-right">
              <div className="file-list__rename">
                <label className="file-list__rename-label">Nome output:</label>
                <div className="file-list__rename-input-wrap">
                  <input
                    type="text"
                    className="file-list__rename-input"
                    value={fileEntry.outputName}
                    onChange={(e) => onRename(fileEntry.id, e.target.value)}
                    placeholder="nome-output"
                  />
                  <span className="file-list__rename-ext">.pdf</span>
                </div>
              </div>

              <div className="file-list__actions">
                <button
                  className="btn btn--primary"
                  onClick={() => onEdit(fileEntry.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editor
                </button>
                <button
                  className="btn btn--success"
                  onClick={() => onDownload(fileEntry.id)}
                  title="Scarica PDF con campi form"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download
                </button>
                <button
                  className="btn btn--danger"
                  onClick={() => onRemove(fileEntry.id)}
                  title="Rimuovi file"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
