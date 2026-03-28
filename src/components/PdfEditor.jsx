import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const SCALE = 1.5
const TEMPLATES_KEY = 'pdf-form-editor-templates'

function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]')
  } catch {
    return []
  }
}

function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export default function PdfEditor({ fileEntry, onSave, onClose }) {
  const [pdfDoc, setPdfDoc] = useState(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [pdfPageSize, setPdfPageSize] = useState({ width: 0, height: 0 })
  const [fields, setFields] = useState(() =>
    (fileEntry.fields || []).map(f => ({
      fontSize: 0,
      autoFit: true,
      ...f,
    }))
  )
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState(null)
  const [currentRect, setCurrentRect] = useState(null)
  const [activeFieldId, setActiveFieldId] = useState(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templates, setTemplates] = useState(loadTemplates)
  const [templateName, setTemplateName] = useState('')
  // Drag & drop state
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const renderTaskRef = useRef(null)

  // Load PDF and detect existing form fields
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const arrayBuffer = await fileEntry.file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
      const doc = await loadingTask.promise
      if (cancelled) return
      setPdfDoc(doc)
      setTotalPages(doc.numPages)

      // Detect existing form fields (annotations) in the PDF
      const detectedFields = []
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum)
        if (cancelled) return
        const viewport1 = page.getViewport({ scale: 1 })
        const pageH = viewport1.height
        const annotations = await page.getAnnotations()
        const widgets = annotations.filter(a => a.subtype === 'Widget')
        for (const ann of widgets) {
          const [x1, y1, x2, y2] = ann.rect
          const pdfX = x1
          const pdfY = y1
          const pdfWidth = x2 - x1
          const pdfHeight = y2 - y1
          // Convert PDF coords (bottom-left origin) to canvas coords (top-left origin)
          const canvasX = pdfX * SCALE
          const canvasY = (pageH - pdfY - pdfHeight) * SCALE
          const canvasWidth = pdfWidth * SCALE
          const canvasHeight = pdfHeight * SCALE
          detectedFields.push({
            id: `detected_${pageNum}_${ann.fieldName || Date.now()}_${Math.random().toString(36).slice(2)}`,
            label: ann.fieldName || '',
            originalName: ann.fieldName || '',
            isDetected: true,
            deleted: false,
            page: pageNum - 1,
            x: canvasX,
            y: canvasY,
            width: canvasWidth,
            height: canvasHeight,
            pdfX,
            pdfY,
            pdfWidth,
            pdfHeight,
            fontSize: 0,
            autoFit: true,
          })
        }
      }

      if (detectedFields.length > 0) {
        setFields(prev => {
          // Avoid duplicating already-detected fields on re-mount
          const existingDetected = prev.filter(f => f.isDetected).map(f => f.originalName)
          const newDetected = detectedFields.filter(
            d => !existingDetected.includes(d.originalName)
          )
          return [...prev, ...newDetected]
        })
      }
    }
    load()
    return () => { cancelled = true }
  }, [fileEntry.file])

  // Render current page
  useEffect(() => {
    if (!pdfDoc) return
    let cancelled = false

    const render = async () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel() } catch {}
      }

      const page = await pdfDoc.getPage(currentPage)
      if (cancelled) return

      const viewport = page.getViewport({ scale: SCALE })
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = viewport.width
      canvas.height = viewport.height
      setPageSize({ width: viewport.width, height: viewport.height })
      setPdfPageSize({
        width: page.getViewport({ scale: 1 }).width,
        height: page.getViewport({ scale: 1 }).height,
      })

      const ctx = canvas.getContext('2d')
      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      try {
        await task.promise
      } catch (e) {
        if (e?.name !== 'RenderingCancelledException') console.error(e)
      }
    }

    render()
    return () => { cancelled = true }
  }, [pdfDoc, currentPage])

  const getRelativePos = (e) => {
    const rect = overlayRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.field-overlay')) return
    const pos = getRelativePos(e)
    setDrawing(true)
    setStartPos(pos)
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!drawing || !startPos) return
    const pos = getRelativePos(e)
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(pos.x - startPos.x),
      height: Math.abs(pos.y - startPos.y),
    })
  }, [drawing, startPos])

  const handleMouseUp = useCallback((e) => {
    if (!drawing) return
    setDrawing(false)

    if (!currentRect || currentRect.width < 10 || currentRect.height < 8) {
      setCurrentRect(null)
      setStartPos(null)
      return
    }

    const scaleX = pdfPageSize.width / pageSize.width
    const scaleY = pdfPageSize.height / pageSize.height

    const newField = {
      id: `field_${Date.now()}`,
      label: '',
      page: currentPage - 1,
      isDetected: false,
      deleted: false,
      fontSize: 0,
      autoFit: true,
      x: currentRect.x,
      y: currentRect.y,
      width: currentRect.width,
      height: currentRect.height,
      pdfX: currentRect.x * scaleX,
      pdfY: pdfPageSize.height - (currentRect.y + currentRect.height) * scaleY,
      pdfWidth: currentRect.width * scaleX,
      pdfHeight: currentRect.height * scaleY,
    }

    setFields((prev) => [...prev, newField])
    setActiveFieldId(newField.id)
    setCurrentRect(null)
    setStartPos(null)
  }, [drawing, currentRect, pageSize, pdfPageSize, currentPage])

  const handleLabelChange = (id, value) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label: value } : f)))
  }

  const handleFontSizeChange = (id, value) => {
    const num = Math.max(6, Math.min(72, parseInt(value, 10) || 6))
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, fontSize: num } : f)))
  }

  const handleAutoFitChange = (id, checked) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, autoFit: checked, fontSize: checked ? 0 : (f.fontSize || 10) } : f))
    )
  }

  const removeField = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
    if (activeFieldId === id) setActiveFieldId(null)
  }

  const toggleDeleteDetected = (id) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, deleted: !f.deleted } : f))
    )
  }

  const currentPageFields = fields.filter((f) => f.page === currentPage - 1)
  const userFields = fields.filter((f) => !f.isDetected)
  const detectedFields = fields.filter((f) => f.isDetected)

  const handleSave = () => {
    onSave(fileEntry.id, fields)
    onClose()
  }

  // --- Templates ---
  const handleSaveTemplate = () => {
    const name = templateName.trim()
    if (!name) return
    const activeFields = fields.filter(f => !f.deleted)
    // We need page dimensions to compute normalized coords.
    // We use pdfPageSize for the current page; for multi-page templates we store relX/relY based on the page dims.
    // Since pdfPageSize is per-page, we store it per field using pdfWidth/pdfHeight from the doc.
    // For simplicity: normalise using pdfPageSize (current page). Multi-page PDFs will use the same normalisation.
    // A robust approach would re-derive per-page dims; here we store enough to re-apply.
    const templateFields = activeFields.map(f => ({
      label: f.label,
      fontSize: f.fontSize,
      autoFit: f.autoFit,
      isDetected: f.isDetected,
      originalName: f.originalName,
      pageIndex: f.page,
      // Normalised coordinates (0-1) relative to PDF page dimensions
      relX: f.pdfX / (pdfPageSize.width || 1),
      relY: f.pdfY / (pdfPageSize.height || 1),
      relWidth: f.pdfWidth / (pdfPageSize.width || 1),
      relHeight: f.pdfHeight / (pdfPageSize.height || 1),
    }))
    const newTemplate = {
      id: `tpl_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      fields: templateFields,
    }
    const updated = [...templates, newTemplate]
    setTemplates(updated)
    saveTemplates(updated)
    setTemplateName('')
  }

  const handleDeleteTemplate = (id) => {
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    saveTemplates(updated)
  }

  const handleApplyTemplate = (template) => {
    const newFields = template.fields.map((tf, i) => {
      const pdfX = tf.relX * pdfPageSize.width
      const pdfY = tf.relY * pdfPageSize.height
      const pdfWidth = tf.relWidth * pdfPageSize.width
      const pdfHeight = tf.relHeight * pdfPageSize.height
      // Canvas coords
      const x = pdfX * SCALE
      const y = (pdfPageSize.height - pdfY - pdfHeight) * SCALE
      const width = pdfWidth * SCALE
      const height = pdfHeight * SCALE
      return {
        id: `tpl_applied_${Date.now()}_${i}`,
        label: tf.label,
        fontSize: tf.fontSize,
        autoFit: tf.autoFit,
        isDetected: false,
        deleted: false,
        page: tf.pageIndex ?? 0,
        x,
        y,
        width,
        height,
        pdfX,
        pdfY,
        pdfWidth,
        pdfHeight,
      }
    })
    setFields(prev => [...prev, ...newFields])
    setShowTemplateModal(false)
  }

  // --- Drag & Drop reorder (user fields only) ---
  const handleDragStart = (e, index) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    setFields(prev => {
      const userOnes = prev.filter(f => !f.isDetected)
      const detectedOnes = prev.filter(f => f.isDetected)
      const reordered = [...userOnes]
      const [moved] = reordered.splice(dragIndex, 1)
      reordered.splice(dropIndex, 0, moved)
      return [...reordered, ...detectedOnes]
    })
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="editor-overlay">
      <div className="editor-modal">
        {/* Header */}
        <div className="editor-header">
          <div className="editor-header__left">
            <button className="btn btn--ghost" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Indietro
            </button>
            <span className="editor-header__filename">{fileEntry.file.name}</span>
          </div>
          <div className="editor-header__right">
            <span className="editor-header__hint">
              Clicca e trascina per aggiungere un campo
            </span>
            <button className="btn btn--ghost" onClick={() => setShowTemplateModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Template
            </button>
            <button className="btn btn--success" onClick={handleSave}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Salva campi
            </button>
          </div>
        </div>

        <div className="editor-body">
          {/* Canvas area */}
          <div className="editor-canvas-wrap">
            {totalPages > 1 && (
              <div className="editor-pagination">
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ‹ Prec
                </button>
                <span className="editor-pagination__info">
                  Pagina {currentPage} / {totalPages}
                </span>
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Succ ›
                </button>
              </div>
            )}

            <div className="editor-canvas-container">
              <canvas ref={canvasRef} className="editor-canvas" />
              <div
                ref={overlayRef}
                className="editor-canvas-overlay"
                style={{ width: pageSize.width, height: pageSize.height }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                {/* Active drawing rect */}
                {drawing && currentRect && currentRect.width > 0 && (
                  <div
                    className="field-drawing"
                    style={{
                      left: currentRect.x,
                      top: currentRect.y,
                      width: currentRect.width,
                      height: currentRect.height,
                    }}
                  />
                )}

                {/* Placed fields for current page */}
                {currentPageFields.map((field) => {
                  if (field.deleted) return null
                  const isDetected = field.isDetected
                  const isActive = activeFieldId === field.id
                  let cls = 'field-overlay'
                  if (isDetected) cls += ' field-overlay--detected'
                  if (isActive) cls += ' field-overlay--active'
                  return (
                    <div
                      key={field.id}
                      className={cls}
                      style={{
                        left: field.x,
                        top: field.y,
                        width: field.width,
                        height: field.height,
                      }}
                      onClick={() => setActiveFieldId(field.id)}
                    >
                      <span className="field-overlay__label">
                        {field.label || <em>{isDetected ? field.originalName || 'rilevato' : 'senza nome'}</em>}
                      </span>
                      {!isDetected && (
                        <button
                          className="field-overlay__remove"
                          onClick={(e) => { e.stopPropagation(); removeField(field.id) }}
                          title="Rimuovi campo"
                        >×</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="editor-panel">
            <h3 className="editor-panel__title">
              Campi ({fields.length})
            </h3>

            {fields.length === 0 ? (
              <div className="editor-panel__empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                  <line x1="12" y1="9" x2="12" y2="15" />
                </svg>
                <p>Nessun campo ancora.<br />Clicca e trascina sul PDF per aggiungerne uno.</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* User fields section */}
                {userFields.length > 0 && (
                  <div className="editor-panel__section">
                    <div className="editor-panel__section-title">
                      <span className="badge badge--user">UTENTE</span>
                      {userFields.length} campo{userFields.length !== 1 ? 'i' : ''}
                    </div>
                    <ul className="editor-panel__list" style={{ flex: 'none' }}>
                      {userFields.map((field, index) => (
                        <li
                          key={field.id}
                          className={[
                            'editor-panel__field',
                            activeFieldId === field.id ? 'editor-panel__field--active' : '',
                            dragIndex === index ? 'editor-panel__field--dragging' : '',
                            dragOverIndex === index && dragIndex !== index ? 'editor-panel__field--dragover' : '',
                          ].filter(Boolean).join(' ')}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setActiveFieldId(field.id)}
                        >
                          <div className="editor-panel__field-header">
                            <span className="drag-handle" title="Trascina per riordinare">⠿</span>
                            <span className="editor-panel__field-num">#{index + 1}</span>
                            <span className="editor-panel__field-page">p.{field.page + 1}</span>
                            <button
                              className="editor-panel__field-remove"
                              onClick={(e) => { e.stopPropagation(); removeField(field.id) }}
                            >×</button>
                          </div>
                          <input
                            type="text"
                            className="editor-panel__field-input"
                            placeholder="Nome campo (es: Nome, Email…)"
                            value={field.label}
                            onChange={(e) => handleLabelChange(field.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="field-format">
                            <div className="field-format__row">
                              <label className="field-format__autofit-label" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={field.autoFit}
                                  onChange={(e) => handleAutoFitChange(field.id, e.target.checked)}
                                  style={{ marginRight: 4 }}
                                />
                                Auto
                              </label>
                              {!field.autoFit && (
                                <div className="field-format__size-control" onClick={(e) => e.stopPropagation()}>
                                  <span className="field-format__label">pt:</span>
                                  <input
                                    type="number"
                                    className="field-format__size-input"
                                    min={6}
                                    max={72}
                                    value={field.fontSize || 10}
                                    onChange={(e) => handleFontSizeChange(field.id, e.target.value)}
                                  />
                                  <span className="field-format__unit">pt</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="editor-panel__field-coords">
                            {Math.round(field.width)}×{Math.round(field.height)} px
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Detected fields section */}
                {detectedFields.length > 0 && (
                  <div className="editor-panel__section">
                    <div className="editor-panel__section-title">
                      <span className="badge badge--detected">RILEVATI DAL PDF</span>
                      {detectedFields.length} campo{detectedFields.length !== 1 ? 'i' : ''}
                    </div>
                    {detectedFields.length === 0 ? (
                      <div className="editor-panel__empty editor-panel__empty--sm">
                        Nessun campo rilevato
                      </div>
                    ) : (
                      <ul className="editor-panel__list" style={{ flex: 'none' }}>
                        {detectedFields.map((field, index) => (
                          <li
                            key={field.id}
                            className={[
                              'editor-panel__field',
                              activeFieldId === field.id ? 'editor-panel__field--active' : '',
                              field.deleted ? 'editor-panel__field--deleted' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => !field.deleted && setActiveFieldId(field.id)}
                          >
                            <div className="editor-panel__field-header">
                              <span className="editor-panel__field-num">#{index + 1}</span>
                              <span className="editor-panel__field-page">p.{field.page + 1}</span>
                              {!field.deleted ? (
                                <button
                                  className="editor-panel__field-remove"
                                  title="Segna come eliminato"
                                  onClick={(e) => { e.stopPropagation(); toggleDeleteDetected(field.id) }}
                                >×</button>
                              ) : (
                                <button
                                  className="editor-panel__field-remove editor-panel__field-restore"
                                  title="Ripristina"
                                  onClick={(e) => { e.stopPropagation(); toggleDeleteDetected(field.id) }}
                                >↩</button>
                              )}
                            </div>
                            <input
                              type="text"
                              className="editor-panel__field-input"
                              placeholder={field.originalName || 'Campo rilevato'}
                              value={field.label}
                              onChange={(e) => handleLabelChange(field.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              disabled={field.deleted}
                            />
                            <div className="field-format">
                              <div className="field-format__row">
                                <label className="field-format__autofit-label" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={field.autoFit}
                                    disabled={field.deleted}
                                    onChange={(e) => handleAutoFitChange(field.id, e.target.checked)}
                                    style={{ marginRight: 4 }}
                                  />
                                  Auto
                                </label>
                                {!field.autoFit && !field.deleted && (
                                  <div className="field-format__size-control" onClick={(e) => e.stopPropagation()}>
                                    <span className="field-format__label">pt:</span>
                                    <input
                                      type="number"
                                      className="field-format__size-input"
                                      min={6}
                                      max={72}
                                      value={field.fontSize || 10}
                                      onChange={(e) => handleFontSizeChange(field.id, e.target.value)}
                                    />
                                    <span className="field-format__unit">pt</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="editor-panel__field-coords">
                              {field.originalName && (
                                <span style={{ color: 'var(--warning)', marginRight: 4 }}>
                                  {field.originalName}
                                </span>
                              )}
                              {Math.round(field.width)}×{Math.round(field.height)} px
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {userFields.length === 0 && detectedFields.length === 0 && (
                  <div className="editor-panel__empty">
                    <p>Nessun campo ancora.</p>
                  </div>
                )}
              </div>
            )}

            <div className="editor-panel__footer">
              <button className="btn btn--success btn--full" onClick={handleSave}>
                Salva e chiudi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="template-modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="template-modal__header">
              <h3>Template campi</h3>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowTemplateModal(false)}>×</button>
            </div>
            <div className="template-modal__body">
              {/* Save current fields as template */}
              <div className="template-save-form">
                <label>Salva configurazione corrente come template</label>
                <div className="template-save-row">
                  <input
                    type="text"
                    className="editor-panel__field-input"
                    placeholder="Nome template…"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate() }}
                  />
                  <button
                    className="btn btn--primary"
                    onClick={handleSaveTemplate}
                    disabled={!templateName.trim()}
                  >
                    Salva
                  </button>
                </div>
              </div>

              {/* Templates list */}
              <div>
                <div className="editor-panel__section-title" style={{ borderBottom: 'none', padding: '0 0 8px 0' }}>
                  Template salvati
                </div>
                {templates.length === 0 ? (
                  <div className="template-empty">Nessun template salvato</div>
                ) : (
                  <ul className="template-list">
                    {templates.map((tpl) => (
                      <li key={tpl.id} className="template-item">
                        <div className="template-item__info">
                          <span className="template-item__name">{tpl.name}</span>
                          <span className="template-item__count">
                            {tpl.fields.length} campo{tpl.fields.length !== 1 ? 'i' : ''} · {new Date(tpl.createdAt).toLocaleDateString('it-IT')}
                          </span>
                        </div>
                        <div className="template-item__actions">
                          <button
                            className="btn btn--primary btn--sm"
                            onClick={() => handleApplyTemplate(tpl)}
                          >
                            Applica
                          </button>
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDeleteTemplate(tpl.id)}
                          >
                            Elimina
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
