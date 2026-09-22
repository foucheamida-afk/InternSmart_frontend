/**
 * Request body ceilings.
 *
 * express.json() defaults to 100 kB, which is far below a real report: the writing
 * workspace sends the whole editor document on every autosave, and a report with
 * pictures in it measured 6.5 MB on a 100-page thesis. At the default the save was
 * answered with 413, which the client can only show as "Offline - saved locally" -
 * the edits stopped reaching the server without saying so.
 *
 * The larger ceiling is applied to `/api/workspace` only, so every other endpoint
 * keeps the 100 kB default. It sits above `REPORT_CONTENT_MAX_MB` (see
 * utils/storedContentLimit.js) so that a document the application is willing to
 * store cannot be rejected earlier by the body parser: the size check that runs
 * after parsing is the one that explains itself to the user.
 */
export const WORKSPACE_JSON_LIMIT = "16mb";

/**
 * Raw-body ceiling for replacing the file behind a PDF report.
 *
 * A PDF is never stored in the database - only its name and location are - so
 * REPORT_CONTENT_MAX_MB does not apply to it. The whole document is buffered
 * once and then written back over the original file, and this bounds that
 * buffer. It sits above the 10 MB upload cap so any PDF the application accepted
 * can also be saved again after being edited.
 */
export const PDF_SAVE_LIMIT = "25mb";

export default { WORKSPACE_JSON_LIMIT, PDF_SAVE_LIMIT };
