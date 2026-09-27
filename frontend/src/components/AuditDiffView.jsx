import { FIELD_LABELS } from '../constants'

export default function AuditDiffView({ deviation, onClose }) {
  if (!deviation) return null
  const diff = deviation.diff || {}
  const fields = Object.keys(diff)

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2">
        <h3 className="text-xs font-semibold text-fg">⇄ Audit Diff — AI Suggested vs. Human Final</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        >
          ✕
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface-2 text-left text-[10px] font-medium uppercase tracking-wide text-fg-muted">
              <th className="px-3 py-1.5">Field</th>
              <th className="px-3 py-1.5">AI Suggested</th>
              <th className="px-3 py-1.5">Human Final</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const { ai, final, changed } = diff[field]
              return (
                <tr
                  key={field}
                  className={`border-t border-border ${changed ? 'bg-warning-bg/60' : 'bg-surface'}`}
                >
                  <td className="px-3 py-1.5 font-medium text-fg-muted">{FIELD_LABELS[field] || field}</td>
                  <td className="px-3 py-1.5 text-fg">{ai ?? <em className="text-fg-subtle">—</em>}</td>
                  <td className="px-3 py-1.5 text-fg">{final ?? <em className="text-fg-subtle">—</em>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
