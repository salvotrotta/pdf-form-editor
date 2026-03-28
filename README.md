# PDF Form Editor

An open-source desktop application to add editable form fields to any PDF file — locally, without uploading anything to the cloud.

Built with React + Vite and packaged as a native desktop app via Electron.

---

## Features

- **Batch upload** — drag & drop or select multiple PDF files at once
- **Visual field editor** — click and drag on the PDF to draw form fields at any position
- **Font size control** — set a fixed font size (pt) or enable auto-fit to shrink text to the box
- **Wizard** — automatically detects existing form fields in the PDF; edit or delete them
- **Templates** — save your field layout and reapply it to other PDFs in one click
- **Drag & drop reorder** — reorder fields in the panel with a drag handle
- **File renaming** — customize the output filename before downloading
- **100% local** — no server, no cloud, no data leaves your machine

---

## Getting Started

### Run in the browser (dev mode)

```bash
git clone https://github.com/salvotrotta/pdf-form-editor.git
cd pdf-form-editor
npm install
npm run dev
# → open http://localhost:5173
```

### Run as a desktop app (Electron)

```bash
npm install
npm run electron:dev
```

---

## Build Windows Installer

### Option A — GitHub Actions (recommended)

1. Go to the **Actions** tab on this repository
2. Select **Build Windows Installer**
3. Click **Run workflow**
4. Download the `.exe` from the **Artifacts** section once the build completes (~5 min)

### Option B — Build locally on Windows

```bash
npm install
npm run electron:build
# → dist-electron/pdf-form-editor Setup.exe
```

### Creating a versioned release

```bash
git tag v1.0.0
git push origin v1.0.0
# GitHub Actions will build and publish a release with the .exe attached
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Vite |
| PDF rendering | pdf.js (pdfjs-dist) |
| PDF manipulation | pdf-lib |
| Desktop packaging | Electron + electron-builder |
| CI/CD | GitHub Actions |

---

## Project Structure

```
pdf-form-editor/
├── electron/
│   ├── main.cjs          # Electron main process
│   └── preload.cjs       # Preload script (context bridge)
├── src/
│   ├── components/
│   │   ├── DropZone.jsx  # Drag & drop upload area
│   │   ├── FileList.jsx  # Uploaded files list
│   │   └── PdfEditor.jsx # PDF viewer + field editor
│   └── utils/
│       └── pdfUtils.js   # pdf-lib helpers
├── .github/workflows/
│   └── build.yml         # Windows installer CI
└── vite.config.js
```

---

## License

MIT — free to use, modify and distribute.
