import { PDFDocument, rgb } from 'pdf-lib'

export async function addFormFields(pdfBytes, fields) {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const form = pdfDoc.getForm()
  const pages = pdfDoc.getPages()

  // Campi rilevati marcati per eliminazione: azzera il rect (li rende invisibili)
  const toHide = fields.filter(f => f.isDetected && f.deleted)
  for (const field of toHide) {
    try {
      const existing = form.getField(field.originalName)
      if (existing) {
        const widgets = existing.acroField.getWidgets()
        for (const w of widgets) w.setRectangle({ x: 0, y: 0, width: 0, height: 0 })
      }
    } catch (e) { console.warn('skip field removal:', e) }
  }

  // Nuovi campi utente
  const newFields = fields.filter(f => !f.isDetected && !f.deleted)
  for (const field of newFields) {
    const page = pages[field.page ?? 0]
    if (!page) continue
    const name = (field.label?.trim() || 'field') + '_' + field.id
    const tf = form.createTextField(name)
    tf.addToPage(page, {
      x: field.pdfX,
      y: field.pdfY,
      width: field.pdfWidth,
      height: field.pdfHeight,
      borderColor: rgb(0.2, 0.5, 1),
      borderWidth: 1,
      backgroundColor: rgb(0.95, 0.97, 1),
    })
    if (!field.autoFit && field.fontSize > 0) {
      tf.setFontSize(field.fontSize)
    }
    // se autoFit o fontSize===0: non chiamare setFontSize, pdf-lib usa auto di default
  }

  return await pdfDoc.save()
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
