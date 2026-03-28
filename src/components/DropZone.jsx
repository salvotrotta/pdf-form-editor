import React, { useState, useCallback } from 'react'

export default function DropZone({ onFilesAdded }) {
  const [dragging, setDragging] = useState(false)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf'
      )
      if (files.length > 0) onFilesAdded(files)
    },
    [onFilesAdded]
  )

  const handleInputChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files).filter(
        (f) => f.type === 'application/pdf'
      )
      if (files.length > 0) onFilesAdded(files)
      e.target.value = ''
    },
    [onFilesAdded]
  )

  return (
    <div
      className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="dropzone__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      </div>
      <p className="dropzone__text">
        Trascina i tuoi file PDF qui
      </p>
      <p className="dropzone__subtext">oppure</p>
      <label className="dropzone__btn">
        Seleziona file
        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </label>
      <p className="dropzone__hint">Sono supportati file .pdf multipli</p>
    </div>
  )
}
