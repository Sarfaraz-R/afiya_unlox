import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { extractDeviation } from '../store/aiSlice'
import { saveDraft } from '../store/deviationSlice'
import { FIELD_LABELS } from '../constants'

const bannerStyles = {
  danger: 'border-danger/30 bg-danger-bg text-danger-fg',
  warning: 'border-warning/30 bg-warning-bg text-warning-fg',
  notice: 'border-notice/30 bg-notice-bg text-notice-fg',
  info: 'border-info/30 bg-info-bg text-info-fg',
}

function Banner({ variant, children }) {
  return <div className={`rounded-md border px-3 py-2 text-xs ${bannerStyles[variant]}`}>{children}</div>
}

function Avatar() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-accent-fg"
      style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-border-strong))' }}
      aria-hidden="true"
    >
      AI
    </span>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-xs text-accent-fg">
        {text}
      </div>
    </div>
  )
}

function AiBubble({ text, isError }) {
  return (
    <div className="flex items-end gap-2">
      <Avatar />
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm px-3 py-2 text-xs ${
          isError ? 'bg-danger-bg text-danger-fg' : 'bg-surface-2 text-fg'
        }`}
      >
        {text}
      </div>
    </div>
  )
}

function TypingBubble({ caption }) {
  return (
    <div className="flex items-end gap-2">
      <Avatar />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface-2 px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle" />
        </div>
        {caption && <p className="pl-1 text-[10px] text-fg-subtle">{caption}</p>}
      </div>
    </div>
  )
}

export default function AIAssistantPanel() {
  const dispatch = useDispatch()
  const { status, progressMessage, missingFields, aiReasoning, duplicateWarnings, messages } = useSelector(
    (s) => s.ai
  )
  const [text, setText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const threadEndRef = useRef(null)

  const busy = status === 'uploading' || status === 'extracting' || status === 'assessing'

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function handlePasteSubmit() {
    if (!text.trim()) return
    setText('')
    const result = await dispatch(extractDeviation({ text }))
    if (result.meta.requestStatus === 'fulfilled') dispatch(saveDraft())
  }

  async function processFile(file) {
    if (!file || busy) return
    const result = await dispatch(extractDeviation({ file }))
    if (result.meta.requestStatus === 'fulfilled') dispatch(saveDraft())
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    await processFile(file)
  }

  function handleDragEnter(e) {
    e.preventDefault()
    if (!e.dataTransfer.types.includes('Files')) return
    dragCounter.current += 1
    setIsDragging(true)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  async function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    await processFile(file)
  }

  const lastMessage = messages[messages.length - 1]

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex min-h-0 flex-col gap-2 rounded-lg border bg-surface p-3 shadow-sm shadow-border/40 transition-colors ${
        isDragging ? 'border-accent border-dashed bg-accent/5' : 'border-border'
      }`}
    >
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-accent bg-accent/10">
          <p className="rounded-md bg-surface px-3 py-1.5 text-xs font-medium text-accent shadow-sm shadow-border/40">
            ⇩ Drop file to extract
          </p>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <Avatar />
        <div>
          <h2 className="text-sm font-semibold leading-tight text-fg">AI Assistant</h2>
          <p className="text-[11px] leading-tight text-fg-muted">Keep chatting to refine — it saves when you do.</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1">
        {messages.length === 0 && !busy && (
          <p className="py-4 text-center text-xs text-fg-subtle">
            Paste a deviation description below, or upload a file, to get started.
          </p>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <UserBubble key={m.id} text={m.text} />
          ) : (
            <AiBubble key={m.id} text={m.text} isError={m.isError} />
          )
        )}

        {busy && <TypingBubble caption={progressMessage || 'typing…'} />}
        <div ref={threadEndRef} />
      </div>

      {!busy && lastMessage?.role === 'ai' && !lastMessage.isError && duplicateWarnings.length > 0 && (
        <Banner variant="notice">
          <p className="font-medium">
            This looks similar to {duplicateWarnings.length === 1 ? 'an existing deviation' : 'existing deviations'}{' '}
            already on file — please check before saving a duplicate:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {duplicateWarnings.map((match) => (
              <li key={match.id}>
                {match.title || '(untitled)'} — {Math.round(match.similarity * 100)}% similar
              </li>
            ))}
          </ul>
        </Banner>
      )}

      {!busy && lastMessage?.role === 'ai' && !lastMessage.isError && missingFields.length > 0 && (
        <Banner variant="warning">
          <p className="font-medium">Still missing — tell me and I'll fill them in:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {missingFields.map((field) => (
              <li key={field}>{FIELD_LABELS[field] || field}</li>
            ))}
          </ul>
        </Banner>
      )}

      {!busy && lastMessage?.role === 'ai' && !lastMessage.isError && aiReasoning && (
        <Banner variant="info">
          <p className="font-semibold">Severity/impact reasoning</p>
          <p className="mt-1 text-info-fg/90">{aiReasoning}</p>
        </Banner>
      )}

      <div className="flex shrink-0 flex-col gap-2 pt-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste deviation text, or tell me what to change…"
          rows={3}
          disabled={busy}
          className="w-full resize-y rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-accent disabled:opacity-50"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handlePasteSubmit}
            disabled={busy || !text.trim()}
            className="inline-flex items-center justify-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            → Extract
          </button>
          <label className="relative inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2">
            ⇧ Upload
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              disabled={busy}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
