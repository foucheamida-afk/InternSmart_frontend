# PDF workspace — implementation notes

The PDF workspace lets a student and their supervisors work on an internship report
that was uploaded as a **PDF**, with the same real-time collaboration the Word
workspace already provides. The Word implementation is untouched: it still owns
`.docx` reports, and nothing about its conversion, editing or export changed.

---

## The one rule that shapes everything

> A PDF is a **file**, not stored document content.

For a Word report, the server converts the `.docx` into editor content and keeps
that content in `Reports.documentContent`. For a PDF:

| | Word report | PDF report |
|---|---|---|
| What the DB stores | the converted editor content | **only the file name and location** |
| On upload | converted to editor content (`mammoth`) | **not converted at all** |
| Where the document lives | `Reports.documentContent` | the PDF file in `uploads/` |
| What the workspace displays | the editor content | **the file itself** |
| What saving does | writes editor content to the DB | **writes the regenerated PDF over the file** |
| Collaboration state | persisted (`DocumentStates`) | in memory only, rebuilt from the file |

So for a PDF report `Reports.documentContent` stays `null` — permanently, from the
upload onwards. Three places enforce that, and each is covered by a check in the
verification suites:

- the upload (`studentController.submitReport`) skips conversion for a PDF;
- the PDF workspace never writes content (`pdfWorkspaceController`);
- opening a PDF through the *Word* workspace hands it over (`pdfWorkspace: true`)
  instead of lazily extracting and storing its text.

The similarity engine is unaffected: `plagiarism/internalProvider.textForVersion`
already falls back to reading the stored file when no editor tree exists.

---

## Flow

```text
                    upload (unchanged)             GET /api/workspace/reports/:id/pdf
   PDF file  ────────────────────────────►  ┌──────────────────────────────────────────┐
   uploads/x.pdf   (name + path only)       │ pdfStructureService: pdfjs-dist reads the │
                                            │ pages and keeps their LAYOUT - every block│
                                            │ of text with its position, width, size,   │
                                            │ family, weight and alignment, page by     │
                                            │ page, figures in their original boxes     │
                                            └──────────────────┬───────────────────────┘
                                                               │
                                            ┌──────────────────▼───────────────────────┐
                                            │ client/src/pages/PdfWorkspace.jsx        │
                                            │  · PDF pane: the file, displayed as-is   │
                                            │  · editor pane: the same pages, with the │
                                            │    text editable exactly where it was    │
                                            │  · comments pane (supervisors)           │
                                            └──────────────────┬───────────────────────┘
                                                               │ every edit
                                            ┌──────────────────▼───────────────────────┐
                                            │ Yjs ⇄ @hocuspocus/provider ⇄ collab server│
                                            │ document: report-pdf-<id>-v<layout>       │
                                            └──────────────────┬───────────────────────┘
                                                               │ debounced autosave
                                            ┌──────────────────▼───────────────────────┐
                                            │ pdfDocument.js: the same pages drawn at   │
                                            │ the same size and positions (jsPDF)       │
                                            │ PUT .../pdf/file → over the stored file   │
                                            └──────────────────────────────────────────┘
```

Editing does not touch the original PDF's drawing instructions, and it does not pour the
text into a new layout either. Each block keeps the page, position, width, size, family
and alignment it had, so the workspace shows the document that was uploaded and the
exporter draws that same page back out. Deleting a word reflows it inside its own column
instead of leaving a hole — and a cover sheet, a two-column page or a table stays where it
was rather than being flattened into one stream of paragraphs.

### How the layout survives

| What | Where it lives |
|---|---|
| page size and count | `pdfPage` attrs (`width`, `height`, `page`) |
| position and column width | `pdfBlock` attrs (`x`, `y`, `width`) |
| typography | `pdfBlock` attrs (`fontSize`, `fontFamily`, `fontName`, `lineHeight`, `align`, `ascent`) |
| bold and italic | ordinary marks on the text runs, so a bold word inside a normal paragraph survives |
| figures | `pdfFigure` attrs (`x`, `y`, `width`, `height`, `src`) with the bitmap as a data URI |

Two details make the round trip stable: the font **ascent** is recorded, so the exporter
puts the first baseline back exactly where it was, and the wrap width carries a little
slack, so a line that fitted in the original does not re-wrap in the (only
metric-compatible) font the exporter draws with. Measured on a 186-page thesis: 186 pages
in, 186 out, the same block count on every page, and **100% of blocks landing back within
2pt (worst 0.0pt)** with the text intact — asserted by the round-trip section of
`verifyPdfWorkspace.js`.

---

## Server

| File | Role |
|---|---|
| `services/pdfStructureService.js` | PDF → page-faithful document structure (pdfjs-dist, loaded lazily) |
| `utils/pngEncoder.js` | dependency-free PNG writer for figure bitmaps |
| `controllers/pdfWorkspaceController.js` | read structure / stream file / overwrite file |
| `routes/reportWorkspaceRoutes.js` | the three routes, plus the raw-body parser |
| `collaboration.js` | `report-pdf-<id>-v<n>` sessions: authorised, **not** persisted |
| `scripts/verifyPdfWorkspace.js` | end-to-end checks, including the layout round trip |

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/workspace/reports/:id/pdf` | structure, file URL, permissions, comments, page count, warnings |
| `GET` | `/api/workspace/reports/:id/pdf/file` | the PDF itself (`inline`, `no-store`); accepts `?token=` because an `<iframe>` cannot send a header |
| `PUT` | `/api/workspace/reports/:id/pdf/file` | raw `application/pdf` body; writes it over the stored file |

Saving is student-only and refused once the report is finalised (`lockedAt`). The
archived `ReportVersion`'s `fileHash` and `fileSize` are updated to describe the
bytes now on disk, because approvals are bound to that hash.

### Extraction quality

- Each page is read as a page: text is grouped into lines by baseline, and a gap several
  times wider than the page's own median word gap starts a new block, so a two-column
  cover or a table row does not become one run of spliced text.
- Lines are ordered column by column (grouped by their left edge) and then downwards, so
  the reading order of a multi-column page is the order a reader sees.
- Every block keeps its position, width, font size, family, weight, slant, alignment and
  line height. Bold and italic come from the resolved font (`Helvetica-Bold`), not from a
  guess about size.
- Running headers, footers and page numbers are detected by repetition and dropped.
- Figures are re-embedded as PNG/JPEG data URIs and keep their original box.
- A scanned PDF (no text layer) is reported as such: the file is still displayed.

A 29-page report is extracted in a few seconds, a 186-page one in about 40, and the result
is cached in-process (keyed by file size + mtime) so reopening is instant. A save
invalidates that cache, so the workspace always describes the file that is on disk.

---

## Client

| File | Role |
|---|---|
| `pages/PdfWorkspace.jsx` | the workspace: PDF pane, editor pane, outline, comments, saving |
| `components/PdfWorkspace/PdfFilePreview.jsx` | the file, displayed by the browser's own viewer |
| `components/PdfWorkspace/usePdfCollaboration.js` | Yjs + Hocuspocus session and the seeding election |
| `editor/pdfLayout.js` | the page-faithful nodes: `pdfPage`, `pdfBlock`, `pdfFigure` |
| `editor/pdfEditorExtensions.js` | the editor's schema, shared with the headless schema check |
| `editor/pdfDocument.js` | document helpers and the PDF renderer (page-faithful, with an A4 fallback) |
| `assets/css/pdf-workspace.css` | styling |

Entry points: My Reports ("Open in PDF Workspace", and an automatic jump after a PDF
upload), plus a redirect in the Word workspace — so every existing "open this report"
link, including both supervisor dashboards, lands in the right place for either format.

### Who fills the shared document?

The collaboration server keeps no copy of a PDF's content, so a fresh session starts
empty and the structure read from the file has to be placed into it exactly once.
While the document is empty and after both clients are synced, the connected **writer**
with the lowest Yjs client id seeds it; everyone else waits for that update. Two
clients seeding at once would insert the whole document twice, and CRDT merge cannot
undo that.

A supervisor who opens the report before the author sees the file, their comments and a
note saying the editable text will appear when the author opens it — not a blank page.

### Ordering: the editor is built *after* the provider exists

`CollaborationCaret` reads `provider.awareness` while its plugins are installed, and
TipTap installs plugins during editor construction — which happens on the first render.
The Hocuspocus provider is an external resource and is therefore created in an effect,
so the first render of a session has none. Building the editor there produced a blank
page and `Cannot read properties of null (reading 'awareness')`.

The editor therefore lives in its own component (`PdfEditableDocument`) which the page
mounts only once the provider is non-null, showing "Connecting to the shared document…"
until then. `npm run verify:caret` (client) asserts both halves of the requirement: a
null provider throws at that exact line, and a provider that merely has not connected
yet installs cleanly.

---

## Running it

```bash
# API + collaboration server (two processes)
cd server && npm start      # API on :3000
cd server && npm run collab # collaboration on :1234

# client
cd client && npm run dev
```

`VITE_API_URL` (default `http://localhost:3000/api`) and `VITE_COLLAB_URL`
(default `ws://localhost:1234`, derived from the API host) configure the client.

## Verifying

```bash
cd server && node scripts/verifyPdfWorkspace.js
```

Runs the real router in-process against a generated PDF — extraction, geometry, streaming,
saving, permissions, the locked-report rule, the "nothing is written to the database"
invariant, and a full layout round trip (read the file → draw it → read it again → every
block must land back within 3pt) — with only the database layer faked, so it needs no
MySQL (46 checks).

```bash
cd client && npm run verify:layout   # the extracted structure parses into the editor schema
cd client && npm run verify:caret    # CollaborationCaret needs a real provider (7 + 3 checks)
cd server && node scripts/verifyWordEndpoints.js   # Word path unchanged (20 checks)
cd server && node scripts/verifyReportFormats.js   # uploads + formats, needs MySQL (22 checks)
```

## Known limitations

- **Vector graphics are not redrawn.** Text and raster figures are reproduced at their
  original positions, but rules, table borders, coloured shapes and vector diagrams are
  drawing instructions the extractor does not reproduce, so they are gone after a save.
  This is the main remaining fidelity gap.
- **A PDF whose content stream writes two columns as one interleaved text run cannot be
  un-mixed.** Some template-generated cover pages store bilingual text as a single run
  ("REPUBLIC OF CAMEROON REPUBLIQUE DU CAMEROON"); that is what the file's text layer
  contains, so it is what any reader — including a copy-paste — would produce.
- Saving **replaces** the file with a PDF drawn from the edited structure. Unedited text
  lands back on its original coordinates, but the document is redrawn in the standard PDF
  fonts (Times/Helvetica/Courier), so an embedded custom font is substituted.
- Text that grows past its block's box overflows downwards; it does not push the blocks
  below it (that is what fixed positioning means). Adding a lot of text to a fixed-layout
  page is a manual adjustment, exactly as in any PDF editor's "edit text" mode.
- The client uses the browser's built-in PDF viewer, so inline display needs a browser
  that has one (Chromium, Edge, Firefox); elsewhere the file opens in a new tab.
- Supervisors read the live document and comment rather than editing it, matching the
  existing suggest-only policy for graded reports. Their comments never touch the file.
- The collaboration state for a PDF lives in the collaboration server's memory. It is
  rebuilt from the file on the next session, so a restart loses only *unsaved* live
  edits (the file is written on autosave every few seconds).
