import api from '../api/axios'
import { getStoredToken } from '../utils/storage'

/**
 * PDF report workspace API.
 *
 * The server holds no PDF content: it reads the structure out of the file when
 * asked, and writes the regenerated file back when told to. So there are only
 * three calls here, and none of them ever sends a document tree to be stored.
 */

const base = (reportId) => `/workspace/reports/${reportId}/pdf`

/** The extracted structure, the file location and the per-user permissions. */
export const getPdfWorkspace = async (reportId) => {
  const { data } = await api.get(base(reportId))
  return data
}

/**
 * Replace the PDF file behind the report.
 *
 * The body is the PDF itself, not JSON, which is what keeps the document out of
 * the database: the file is the document.
 */
export const savePdfFile = async (reportId, blob) => {
  const { data } = await api.put(`${base(reportId)}/file`, blob, {
    headers: { 'Content-Type': 'application/pdf' },
    // The regenerated document can be a few megabytes; axios' default timeout is
    // generous enough, but the transform must not touch binary data.
    transformRequest: [(value) => value],
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })
  return data
}

/**
 * Where the file itself can be displayed.
 *
 * An <iframe> cannot carry an Authorization header, so the token rides in the
 * query string - the one endpoint that accepts that. `revision` busts the
 * browser's cache after a save so the viewer shows the file that was just
 * written rather than the previous one.
 */
export const pdfFileViewerUrl = (reportId, revision) => {
  const origin = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '')
  const token = getStoredToken() || ''
  const params = new URLSearchParams({ token })
  if (revision) params.set('v', String(revision))
  return `${origin}/api/workspace/reports/${reportId}/pdf/file?${params.toString()}`
}

/** Direct download of the file currently on the server. */
export const downloadPdfFile = async (reportId, fileName) => {
  const response = await api.get(`${base(reportId)}/file`, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName || 'report.pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const addPdfComment = async (reportId, { section, body }) => {
  const { data } = await api.post(`/workspace/reports/${reportId}/comments`, { section, body })
  return data.comment
}

export const deletePdfComment = async (reportId, commentId) => {
  await api.delete(`/workspace/reports/${reportId}/comments/${commentId}`)
}

export default {
  getPdfWorkspace,
  savePdfFile,
  pdfFileViewerUrl,
  downloadPdfFile,
  addPdfComment,
  deletePdfComment,
}
