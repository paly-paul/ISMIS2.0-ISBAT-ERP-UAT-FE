'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'

export interface RichTextEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minHeight?: string | number
  className?: string
  disabled?: boolean
}

interface FormatState {
  bold: boolean
  italic: boolean
  underline: boolean
  strikeThrough: boolean
  subscript: boolean
  superscript: boolean
  justifyLeft: boolean
  justifyCenter: boolean
  justifyRight: boolean
  justifyFull: boolean
  insertUnorderedList: boolean
  insertOrderedList: boolean
}

/**
 * Checks if HTML is effectively empty (e.g. `<p><br></p>` or `<br>` or whitespace)
 */
export function isHtmlEmpty(html: string | null | undefined): boolean {
  if (!html) return true
  const stripped = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .trim()
  return stripped.length === 0
}

/**
 * Strips all HTML tags and decodes entities into clean plain text.
 */
export function stripHtmlTags(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Converts legacy plain-text newlines to HTML breaks if no HTML tags are present
 */
function formatInitialHtml(val: string): string {
  if (!val) return ''
  if (/<[a-z][\s\S]*>/i.test(val)) return val
  return val.replace(/\r\n|\n/g, '<br>')
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Type question content here...',
  minHeight = 120,
  className = '',
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isFocusedRef = useRef(false)
  const [isEmpty, setIsEmpty] = useState(() => isHtmlEmpty(value))

  const [activeFormats, setActiveFormats] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    subscript: false,
    superscript: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  })

  // Sync incoming value safely when editor is NOT actively focused by the user
  useEffect(() => {
    if (editorRef.current && !isFocusedRef.current) {
      const incoming = formatInitialHtml(value ?? '')
      const current = editorRef.current.innerHTML
      if (current !== incoming) {
        editorRef.current.innerHTML = incoming
        setIsEmpty(isHtmlEmpty(incoming))
      }
    }
  }, [value])

  // Update active format state based on current caret selection
  const updateActiveFormats = useCallback(() => {
    if (typeof document === 'undefined') return
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        subscript: document.queryCommandState('subscript'),
        superscript: document.queryCommandState('superscript'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      })
    } catch {
      // Ignore if document queryCommandState is unsupported in current environment
    }
  }, [])

  // Execute formatting command without losing focus or resetting caret selection
  const executeCommand = (cmd: string, val: string | undefined = undefined) => {
    if (disabled) return
    if (editorRef.current) {
      editorRef.current.focus()
    }
    try {
      document.execCommand(cmd, false, val)
      updateActiveFormats()
      handleInput()
    } catch (e) {
      console.warn(`[RichTextEditor] Command failed: ${cmd}`, e)
    }
  }

  const handleInput = () => {
    if (!editorRef.current) return
    const rawHtml = editorRef.current.innerHTML
    const empty = isHtmlEmpty(rawHtml)
    setIsEmpty(empty)
    if (empty) {
      onChange('')
    } else {
      onChange(rawHtml)
    }
    updateActiveFormats()
  }

  const minHeightStyle = typeof minHeight === 'number' ? `${minHeight}px` : minHeight

  return (
    <div
      className={`border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100 transition-all ${
        disabled ? 'opacity-60 pointer-events-none bg-slate-50' : ''
      } ${className}`}
    >
      <style>{`
        .rich-editor-content ul {
          list-style-type: disc !important;
          padding-left: 1.5rem !important;
          margin: 0.35rem 0 !important;
        }
        .rich-editor-content ol {
          list-style-type: decimal !important;
          padding-left: 1.5rem !important;
          margin: 0.35rem 0 !important;
        }
        .rich-editor-content p {
          margin-bottom: 0.35rem;
        }
        .rich-editor-content h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin: 0.5rem 0 0.25rem;
        }
        .rich-editor-content h3 {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0.4rem 0 0.2rem;
        }
        .rich-editor-content h4 {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0.3rem 0 0.15rem;
        }
        .rich-editor-content sub {
          vertical-align: sub;
          font-size: 0.75em;
        }
        .rich-editor-content sup {
          vertical-align: super;
          font-size: 0.75em;
        }
        .rich-editor-content blockquote {
          border-left: 3px solid #cbd5e1;
          padding-left: 0.75rem;
          color: #64748b;
          margin: 0.35rem 0;
        }
      `}</style>

      {/* ── Rich Text Toolbar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-slate-100/90 border-b border-slate-200 select-none">
        {/* Undo / Redo */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('undo')
          }}
          className="w-7 h-7 rounded hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <i className="lni lni-reply text-xs"></i>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('redo')
          }}
          className="w-7 h-7 rounded hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <i className="lni lni-forward text-xs"></i>
        </button>

        <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>

        {/* Bold */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('bold')
          }}
          className={`w-7 h-7 rounded text-xs flex items-center justify-center transition-all ${
            activeFormats.bold
              ? 'bg-purple-200 text-purple-950 font-black border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-800 font-bold'
          }`}
          title="Bold (Ctrl+B)"
        >
          <span>B</span>
        </button>

        {/* Italic */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('italic')
          }}
          className={`w-7 h-7 rounded text-[12.5px] font-serif italic flex items-center justify-center transition-all ${
            activeFormats.italic
              ? 'bg-purple-200 text-purple-950 font-bold border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-800'
          }`}
          title="Italic (Ctrl+I)"
        >
          <span>I</span>
        </button>

        {/* Underline */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('underline')
          }}
          className={`w-7 h-7 rounded text-xs underline font-semibold flex items-center justify-center transition-all ${
            activeFormats.underline
              ? 'bg-purple-200 text-purple-950 font-bold border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-800'
          }`}
          title="Underline (Ctrl+U)"
        >
          <span>U</span>
        </button>

        {/* Strikethrough */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('strikeThrough')
          }}
          className={`w-7 h-7 rounded text-xs line-through flex items-center justify-center transition-all ${
            activeFormats.strikeThrough
              ? 'bg-purple-200 text-purple-950 font-bold border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Strikethrough"
        >
          <span>S</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>

        {/* Subscript x₂ */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('subscript')
          }}
          className={`px-1.5 h-7 rounded text-[11px] font-medium flex items-center justify-center transition-all ${
            activeFormats.subscript
              ? 'bg-purple-200 text-purple-950 font-bold border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Subscript (e.g. H₂O)"
        >
          x<sub>2</sub>
        </button>

        {/* Superscript x² */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('superscript')
          }}
          className={`px-1.5 h-7 rounded text-[11px] font-medium flex items-center justify-center transition-all ${
            activeFormats.superscript
              ? 'bg-purple-200 text-purple-950 font-bold border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Superscript (e.g. x²)"
        >
          x<sup>2</sup>
        </button>

        <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>

        {/* Alignment */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('justifyLeft')
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
            activeFormats.justifyLeft
              ? 'bg-purple-200 text-purple-950 border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Align Left"
        >
          <i className="lni lni-align-left text-xs"></i>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('justifyCenter')
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
            activeFormats.justifyCenter
              ? 'bg-purple-200 text-purple-950 border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Align Center"
        >
          <i className="lni lni-align-center text-xs"></i>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('justifyRight')
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
            activeFormats.justifyRight
              ? 'bg-purple-200 text-purple-950 border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Align Right"
        >
          <i className="lni lni-align-right text-xs"></i>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('justifyFull')
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
            activeFormats.justifyFull
              ? 'bg-purple-200 text-purple-950 border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Justify"
        >
          <span className="text-[11px] font-bold leading-none tracking-tight">≡</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>

        {/* Bulleted List */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('insertUnorderedList')
          }}
          className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
            activeFormats.insertUnorderedList
              ? 'bg-purple-200 text-purple-950 border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Bulleted List"
        >
          <i className="lni lni-list text-xs"></i>
        </button>

        {/* Numbered List */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('insertOrderedList')
          }}
          className={`px-1 h-7 rounded text-[11px] font-semibold flex items-center justify-center transition-all ${
            activeFormats.insertOrderedList
              ? 'bg-purple-200 text-purple-950 border border-purple-400 shadow-inner'
              : 'hover:bg-slate-200 text-slate-700'
          }`}
          title="Numbered List"
        >
          1. 2.
        </button>

        {/* Indent / Outdent */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('outdent')
          }}
          className="w-7 h-7 rounded hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors"
          title="Decrease Indent"
        >
          <i className="lni lni-indent-decrease text-xs"></i>
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('indent')
          }}
          className="w-7 h-7 rounded hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors"
          title="Increase Indent"
        >
          <i className="lni lni-indent-increase text-xs"></i>
        </button>

        <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>

        {/* Clear Formatting */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            executeCommand('removeFormat')
          }}
          className="w-7 h-7 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-[11px] transition-colors"
          title="Clear Formatting"
        >
          <i className="lni lni-eraser text-xs"></i>
        </button>

        {/* ── Right side controls matching Image 2: Font & Size ────────── */}
        <div className="ml-auto flex items-center gap-1.5 pl-2">
          {/* Font Family Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Font</span>
            <select
              onChange={(e) => {
                executeCommand('fontName', e.target.value)
                e.target.value = ''
              }}
              defaultValue=""
              className="h-7 text-[11px] font-medium border border-slate-300 rounded bg-white text-slate-700 px-1.5 py-0 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-2xs"
              title="Font Family"
            >
              <option value="" disabled>Arial</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times</option>
              <option value="'Courier New', monospace">Courier</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="Georgia, serif">Georgia</option>
            </select>
          </div>

          {/* Font Size Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Size</span>
            <select
              onChange={(e) => {
                executeCommand('fontSize', e.target.value)
                e.target.value = ''
              }}
              defaultValue=""
              className="h-7 text-[11px] font-medium border border-slate-300 rounded bg-white text-slate-700 px-1 py-0 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-2xs"
              title="Font Size"
            >
              <option value="" disabled>1</option>
              <option value="1">1 (Small)</option>
              <option value="2">2 (Normal)</option>
              <option value="3">3 (Medium)</option>
              <option value="4">4 (Large)</option>
              <option value="5">5 (Extra Large)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── ContentEditable Editor Area ──────────────────────────────────── */}
      <div className="relative">
        {isEmpty && (
          <div
            onClick={() => editorRef.current?.focus()}
            className="absolute top-3 left-3 text-slate-400 text-xs pointer-events-none select-none"
            style={{ lineHeight: '1.6' }}
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onFocus={() => {
            isFocusedRef.current = true
            updateActiveFormats()
          }}
          onBlur={() => {
            isFocusedRef.current = false
            handleInput()
          }}
          onInput={handleInput}
          onKeyUp={updateActiveFormats}
          onMouseUp={updateActiveFormats}
          style={{
            minHeight: minHeightStyle,
            wordBreak: 'break-word',
            outline: 'none',
          }}
          className="p-3 text-xs text-slate-800 leading-relaxed overflow-y-auto focus:outline-none rich-editor-content cursor-text"
        />
      </div>
    </div>
  )
}

/**
 * Clean component for safely rendering rich-text questions or plain text across tables and modals
 */
export function RichTextDisplay({
  content,
  className = '',
}: {
  content?: string | null
  className?: string
}) {
  if (!content) return null
  const hasHtml = /<[a-z][\s\S]*>/i.test(content)
  if (hasHtml) {
    return (
      <span
        className={`rich-editor-content inline-block ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }
  return <span className={`whitespace-pre-wrap ${className}`}>{content}</span>
}
