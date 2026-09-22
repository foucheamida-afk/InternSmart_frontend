import Report from "../models/reportModel.js";
import Student from "../models/studentModel.js";
import Internship from "../models/studentAssignmentModel.js";

/**
 * Word export for the writing workspace.
 *
 * Produces a Word-openable document (.doc) built from the report's stored editor
 * content. This deliberately needs NO new dependency: Word opens an HTML document
 * served with the Word MIME type, and it keeps headings, lists, bold/italic,
 * tables and images. That means a student can take the report out of InternSmart,
 * keep working in Word, and the layout survives the trip.
 *
 * This is the pragmatic half of "update a Word file". OPENING an existing .docx
 * back into the editor is the other half and does need a converter library
 * (mammoth), which is not installed yet.
 */

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Minimal, explicit ProseMirror -> HTML. Only the nodes/marks the workspace can
// actually produce are handled; anything unknown degrades to its text content
// rather than being dropped.
const renderMarks = (text, marks = []) => {
  let html = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold": html = `<strong>${html}</strong>`; break;
      case "italic": html = `<em>${html}</em>`; break;
      case "underline": html = `<u>${html}</u>`; break;
      case "strike": html = `<s>${html}</s>`; break;
      case "code": html = `<code>${html}</code>`; break;
      case "highlight": html = `<span style="background:#ffe58f">${html}</span>`; break;
      case "textStyle": {
        const style = [];
        if (mark.attrs?.color) style.push(`color:${mark.attrs.color}`);
        if (style.length) html = `<span style="${style.join(";")}">${html}</span>`;
        break;
      }
      case "link":
        if (mark.attrs?.href) html = `<a href="${escapeHtml(mark.attrs.href)}">${html}</a>`;
        break;
      default: break;
    }
  }
  return html;
};

const renderNodes = (nodes = []) => nodes.map(renderNode).join("");

function renderNode(node) {
  if (!node) return "";
  const children = () => renderNodes(node.content);

  switch (node.type) {
    case "doc": return children();
    case "text": return renderMarks(node.text, node.marks);
    case "paragraph": {
      const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : "";
      return `<p${align}>${children() || "&nbsp;"}</p>`;
    }
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `<h${level}>${children()}</h${level}>`;
    }
    case "bulletList": return `<ul>${children()}</ul>`;
    case "orderedList": return `<ol>${children()}</ol>`;
    case "listItem": return `<li>${children()}</li>`;
    case "blockquote": return `<blockquote>${children()}</blockquote>`;
    case "codeBlock": return `<pre>${children()}</pre>`;
    case "horizontalRule": return "<hr />";
    case "hardBreak": return "<br />";
    case "image": {
      const src = node.attrs?.src || "";
      const alt = escapeHtml(node.attrs?.alt || "");
      return src ? `<img src="${escapeHtml(src)}" alt="${alt}" style="max-width:100%" />` : "";
    }
    case "table": return `<table border="1" cellspacing="0" cellpadding="4">${children()}</table>`;
    case "tableRow": return `<tr>${children()}</tr>`;
    case "tableHeader": return `<th>${children()}</th>`;
    case "tableCell": return `<td>${children()}</td>`;
    case "pageBreak": return '<br clear="all" style="page-break-before:always" />';
    default: return children();
  }
}

/** Reuse the same access rules as the workspace endpoint. */
const getAccess = async (reportId, user) => {
  const report = await Report.findByPk(reportId, {
    include: [{ model: Student, as: "student", include: [{ model: Internship, as: "internship" }] }],
  });
  if (!report) return null;
  if (user.role === "admin") return report;

  if (user.role === "student") {
    const student = await Student.findOne({ where: { userId: user.id } });
    return student && report.studentId === student.id ? report : null;
  }

  const internship = report.student?.internship;
  if (user.role === "academic_supervisor" && internship?.academicSupervisorId === user.id) return report;
  if (user.role === "professional_supervisor" && internship?.professionalSupervisorId === user.id) return report;
  return null;
};

const toDocument = (value) => {
  if (value && typeof value === "object" && value.type === "doc") return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && parsed.type === "doc") return parsed;
    } catch {
      return {
        type: "doc",
        content: value.split(/\n\s*\n/).filter(Boolean).map((p) => ({
          type: "paragraph",
          content: [{ type: "text", text: p.trim() }],
        })),
      };
    }
  }
  return null;
};

// GET /api/workspace/reports/:id/word
export const exportReportAsWord = async (req, res) => {
  try {
    const report = await getAccess(req.params.id, req.user);
    if (!report) return res.status(404).json({ message: "Report not found or not accessible" });

    const document = toDocument(report.documentContent);
    if (!document) {
      return res.status(400).json({ message: "This report has no editable content to export yet." });
    }

    const body = renderNodes(document.content);
    const title = escapeHtml(report.title || "Internship Report");

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  @page { size: A4; margin: 2.5cm; }
  body { font-family: "Times New Roman", serif; font-size: 12pt; line-height: 1.5; }
  h1 { font-size: 18pt; } h2 { font-size: 16pt; } h3 { font-size: 14pt; }
  table { border-collapse: collapse; } th, td { border: 1px solid #444; padding: 4pt; }
  pre, code { font-family: Consolas, monospace; font-size: 10.5pt; }
  blockquote { margin-left: 1cm; border-left: 2px solid #999; padding-left: 8pt; color: #333; }
</style>
</head>
<body>
${body}
</body>
</html>`;

    const safeName = String(report.title || "internship-report")
      .replace(/[^a-z0-9 _-]/gi, "")
      .trim()
      .replace(/\s+/g, "-") || "internship-report";

    res.setHeader("Content-Type", "application/msword");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.doc"`);
    return res.send(html);
  } catch (error) {
    console.error("WORD EXPORT ERROR:", error);
    return res.status(500).json({ message: "Unable to export this report as a Word file" });
  }
};
