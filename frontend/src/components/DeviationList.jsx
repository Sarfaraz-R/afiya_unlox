import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  clearSelected,
  deleteDraft,
  fetchDeviationDetail,
  fetchDeviations,
  resumeDraft,
} from '../store/deviationSlice'
import { resetAiState } from '../store/aiSlice'
import AuditDiffView from './AuditDiffView'

const severityStyles = {
  Critical: 'border-danger/40 bg-danger-bg text-danger-fg',
  Major: 'border-warning/40 bg-warning-bg text-warning-fg',
  Minor: 'border-info/40 bg-info-bg text-info-fg',
}

function SeverityPill({ severity }) {
  const style = severityStyles[severity] || 'border-border text-fg-muted'
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${style}`}>
      <span aria-hidden="true">●</span>
      {severity || '?'}
    </span>
  )
}

export default function DeviationList() {
  const dispatch = useDispatch()
  const list = useSelector((s) => s.deviation.list)
  const selected = useSelector((s) => s.deviation.selected)
  const saveStatus = useSelector((s) => s.deviation.saveStatus)
  const [showSavedBanner, setShowSavedBanner] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const drafts = list.filter((d) => d.status === 'draft')
  const saved = list.filter((d) => d.status !== 'draft')

  useEffect(() => {
    dispatch(fetchDeviations())
  }, [dispatch, saveStatus])

  useEffect(() => {
    if (saveStatus !== 'saved') return
    setShowSavedBanner(true)
    const timer = setTimeout(() => setShowSavedBanner(false), 3000)
    return () => clearTimeout(timer)
  }, [saveStatus])

  function handleResume(dev) {
    dispatch(resumeDraft(dev))
    dispatch(resetAiState())
  }

  function handleDiscard(e, id) {
    e.stopPropagation()
    dispatch(deleteDraft(id))
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Expand Saved Deviations"
        className="flex w-10 shrink-0 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface py-4 text-fg-muted shadow-sm shadow-border/40 transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <span aria-hidden="true">◂</span>
        <span className="[writing-mode:vertical-rl] text-xs font-semibold tracking-wide">Saved Deviations</span>
        {list.length > 0 && (
          <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {list.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-sm shadow-border/40 lg:w-80">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-fg">
          <span aria-hidden="true">☰</span> Saved Deviations
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Minimize"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          ▸
        </button>
      </div>

      {showSavedBanner && (
        <div className="mt-1.5 shrink-0 rounded-md border border-success/30 bg-success-bg px-2.5 py-1.5 text-[11px] text-success-fg">
          ✓ Deviation saved.
        </div>
      )}

      {list.length === 0 && <p className="mt-1 text-xs text-fg-muted">No deviations saved yet.</p>}

      {drafts.length > 0 && (
        <>
          <p className="mt-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
            Drafts — not saved ({drafts.length})
          </p>
          <ul className="mt-1 divide-y divide-dashed divide-border">
            {drafts.map((dev) => (
              <li key={dev.id}>
                <button
                  onClick={() => handleResume(dev)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border/70 px-1.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <span aria-hidden="true">✎</span>
                    <span className="truncate">{dev.title || '(untitled draft)'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {dev.initial_severity && <SeverityPill severity={dev.initial_severity} />}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDiscard(e, dev.id)}
                      aria-label="Discard draft"
                      className="rounded-md px-1 py-0.5 text-fg-subtle transition-colors hover:bg-danger-bg hover:text-danger-fg"
                    >
                      ✕
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {saved.length > 0 && (
        <>
          {drafts.length > 0 && (
            <p className="mt-2.5 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              Saved ({saved.length})
            </p>
          )}
          <ul className="mt-1.5 divide-y divide-border">
            {saved.map((dev) => (
              <li key={dev.id}>
                <button
                  onClick={() => dispatch(fetchDeviationDetail(dev.id))}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-left text-xs text-fg transition-colors hover:bg-surface-2"
                >
                  <span className="flex min-w-0 items-center gap-1 truncate">
                    <span aria-hidden="true">▸</span>
                    <span className="truncate">{dev.title || '(untitled)'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <SeverityPill severity={dev.initial_severity} />
                    <span className="text-[11px] text-fg-subtle">◦ {dev.initial_impact || '?'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && <AuditDiffView deviation={selected} onClose={() => dispatch(clearSelected())} />}
    </div>
  )
}
