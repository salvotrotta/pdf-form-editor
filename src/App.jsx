import React, { useState, useCallback } from 'react'
import DropZone from './components/DropZone.jsx'
import FileList from './components/FileList.jsx'
import PdfEditor from './components/PdfEditor.jsx'
import { addFormFields, readFileAsArrayBuffer, downloadPdf } from './utils/pdfUtils.js'

let idCounter = 0
const genId = () => `file_${++idCounter}_${Date.now()}`

export default function App() {
  const [files, setFiles] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const handleFilesAdded = useCallback((newFiles) => {
    const entries = newFiles.map((file) => ({
      id: genId(),
      file,
      outputName: file.name.replace(/\.pdf$/i, '') + '_modificato',
      fields: [],
    }))
    setFiles((prev) => [...prev, ...entries])
  }, [])

  const handleRename = useCallback((id, newName) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, outputName: newName } : f))
    )
  }, [])

  const handleEdit = useCallback((id) => {
    setEditingId(id)
  }, [])

  const handleEditorSave = useCallback((id, fields) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, fields } : f))
    )
  }, [])

  const handleEditorClose = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleDownload = useCallback(async (id) => {
    const entry = files.find((f) => f.id === id)
    if (!entry) return

    setDownloading(id)
    try {
      const arrayBuffer = await readFileAsArrayBuffer(entry.file)
      const modifiedBytes = await addFormFields(arrayBuffer, entry.fields)
      downloadPdf(modifiedBytes, entry.outputName)
    } catch (err) {
      console.error('Errore durante il download:', err)
      alert('Errore durante la generazione del PDF: ' + err.message)
    } finally {
      setDownloading(null)
    }
  }, [files])

  const handleRemove = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const editingEntry = editingId ? files.find((f) => f.id === editingId) : null

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>PDF Form Editor</span>
          </div>
          <p className="app-header__subtitle">
            Aggiungi campi form interattivi ai tuoi PDF
          </p>
        </div>
      </header>

      <main className="app-main">
        <DropZone onFilesAdded={handleFilesAdded} />

        {downloading && (
          <div className="toast toast--loading">
            <span className="spinner" />
            Generazione PDF in corso…
          </div>
        )}

        <FileList
          files={files}
          onRename={handleRename}
          onEdit={handleEdit}
          onDownload={handleDownload}
          onRemove={handleRemove}
        />
      </main>

      {editingEntry && (
        <PdfEditor
          fileEntry={editingEntry}
          onSave={handleEditorSave}
          onClose={handleEditorClose}
        />
      )}
    </div>
  )
}
