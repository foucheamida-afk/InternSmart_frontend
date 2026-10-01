/**
 * MarkdownMessage
 * ─────────────────────────────────────────────────────────────────────
 * Full-featured Markdown renderer powered by:
 *   - react-markdown        – core renderer
 *   - remark-gfm            – GitHub Flavored Markdown:
 *                              tables, strikethrough, task lists,
 *                              autolinks, footnotes
 *   - rehype-highlight      – syntax highlighting for fenced code blocks
 *   - rehype-raw            – allows raw HTML pass-through in MD
 *
 * Renders ALL standard Markdown + GFM features:
 *   # Headings (h1–h6)
 *   **bold**, *italic*, ~~strikethrough~~, `inline code`
 *   ```code blocks``` with language syntax highlighting
 *   | Tables | with alignment |
 *   - Bullet lists / 1. Numbered lists / - [x] Task lists
 *   > Blockquotes
 *   --- Horizontal rules
 *   [Links](url) and ![Images](url)
 *   Footnotes
 * ─────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github-dark.css';

/* ── Custom component overrides – themed to match InternSmart UI ── */
const components = {
  // Headings
  h1: ({ children }) => (
    <h1 style={{ fontSize: '1.2em', fontWeight: 800, color: 'var(--orange-3)', margin: '12px 0 4px', borderBottom: '1px solid var(--line)', paddingBottom: '4px' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: '1.1em', fontWeight: 700, color: 'var(--orange-3)', margin: '10px 0 4px' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: '1em', fontWeight: 700, color: 'var(--text)', margin: '8px 0 3px' }}>{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 style={{ fontSize: '0.95em', fontWeight: 700, color: 'var(--text)', margin: '6px 0 2px' }}>{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 style={{ fontSize: '0.9em', fontWeight: 600, color: 'var(--text-soft)', margin: '4px 0 2px' }}>{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 style={{ fontSize: '0.85em', fontWeight: 600, color: 'var(--text-muted)', margin: '4px 0 2px' }}>{children}</h6>
  ),

  // Paragraph
  p: ({ children }) => (
    <p style={{ margin: '4px 0', lineHeight: 1.75, color: 'inherit' }}>{children}</p>
  ),

  // Bold / strong
  strong: ({ children }) => (
    <strong style={{ fontWeight: 700, color: 'inherit' }}>{children}</strong>
  ),

  // Italic / em
  em: ({ children }) => (
    <em style={{ fontStyle: 'italic' }}>{children}</em>
  ),

  // Strikethrough
  del: ({ children }) => (
    <del style={{ opacity: 0.6 }}>{children}</del>
  ),

  // Inline code
  code({ inline, className, children }) {
    if (inline) {
      return (
        <code style={{
          fontFamily: 'monospace',
          fontSize: '0.86em',
          background: 'rgba(255,255,255,0.08)',
          padding: '1px 6px',
          borderRadius: '4px',
          color: 'var(--orange-3)',
        }}>
          {children}
        </code>
      );
    }
    // Fenced code block – styling wraps rehype-highlight output
    return (
      <code className={className} style={{ fontFamily: 'monospace', fontSize: '0.82em' }}>
        {children}
      </code>
    );
  },

  // Code block wrapper
  pre: ({ children }) => (
    <pre style={{
      background: '#0d1117',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      padding: '12px 16px',
      overflowX: 'auto',
      margin: '8px 0',
      lineHeight: 1.65,
      fontSize: '0.82em',
    }}>
      {children}
    </pre>
  ),

  // Unordered list
  ul: ({ children }) => (
    <ul style={{ paddingLeft: '20px', margin: '4px 0', listStyleType: 'disc' }}>{children}</ul>
  ),

  // Ordered list
  ol: ({ children }) => (
    <ol style={{ paddingLeft: '20px', margin: '4px 0', listStyleType: 'decimal' }}>{children}</ol>
  ),

  // List item – also handles task-list checkboxes via GFM
  li: ({ children, checked }) => (
    <li style={{ marginBottom: '3px', lineHeight: 1.65, color: 'inherit' }}>
      {checked !== null && checked !== undefined ? (
        <span style={{ marginRight: '6px', color: checked ? '#10b981' : 'var(--text-muted)' }}>
          {checked ? '☑' : '☐'}
        </span>
      ) : null}
      {children}
    </li>
  ),

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: '3px solid var(--orange-3)',
      paddingLeft: '12px',
      margin: '8px 0',
      color: 'var(--text-muted)',
      fontStyle: 'italic',
    }}>
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '10px 0' }} />
  ),

  // Hyperlink
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--orange-3)', textDecoration: 'underline' }}
    >
      {children}
    </a>
  ),

  // Image
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt}
      style={{ maxWidth: '100%', borderRadius: '6px', margin: '6px 0', display: 'block' }}
    />
  ),

  // Table (GFM)
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.84em', lineHeight: 1.5 }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'rgba(255,122,0,0.07)' }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th style={{
      padding: '6px 12px',
      textAlign: 'left',
      fontWeight: 700,
      color: 'var(--orange-3)',
      borderBottom: '1px solid var(--line)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '5px 12px',
      color: 'var(--text-soft)',
      verticalAlign: 'top',
    }}>
      {children}
    </td>
  ),
};

/* ── Component ─────────────────────────────────────────────────── */
export default function MarkdownMessage({ text = '', className = '' }) {
  return (
    <div className={className} style={{ fontSize: 'inherit', color: 'inherit', wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
