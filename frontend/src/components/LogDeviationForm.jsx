import { useDispatch, useSelector } from 'react-redux'
import toast from 'react-hot-toast'
import { editField, resetCurrent, saveDeviation } from '../store/deviationSlice'
import { resetAiState } from '../store/aiSlice'
import { EXTRACTED_FIELDS, FIELD_LABELS, IMPACT_OPTIONS, SEVERITY_OPTIONS } from '../constants'
import ConfidenceBadge from './ConfidenceBadge'

const fieldBase =
  'w-full rounded-md border bg-surface-2 px-2.5 py-1.5 text-xs text-fg outline-none transition-colors focus:border-accent'
const fieldNormal = 'border-border'
const fieldLowConfidence = 'border-warning/60 ring-1 ring-warning/30'

export default function LogDeviationForm() {
  const dispatch = useDispatch()
  const current = useSelector((s) => s.deviation.current)
  const saveStatus = useSelector((s) => s.deviation.saveStatus)
  const confidenceFlags = useSelector((s) => s.ai.confidenceFlags)

  const hasContent =
    EXTRACTED_FIELDS.some((field) => current[field]) || current.initial_impact || current.initial_severity

  function handleChange(field, value) {
    dispatch(editField({ field, value }))
  }

  async function handleSave() {
    if (!hasContent) {
      toast.error('Nothing to save — fill in some details first.')
      return
    }
    const result = await dispatch(saveDeviation())
    if (result.meta.requestStatus === 'fulfilled') {
      dispatch(resetAiState())
      toast.success('Deviation saved.')
    } else {
      toast.error(result.payload || 'Failed to save deviation.')
    }
  }

  function handleNew() {
    dispatch(resetCurrent())
    dispatch(resetAiState())
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-sm shadow-border/40">
      <h2 className="text-sm font-semibold text-fg">✎ Log Deviation</h2>

      {EXTRACTED_FIELDS.map((field) => {
        const isLow = confidenceFlags[field] === 'low'
        return (
          <div className="flex flex-col gap-1" key={field}>
            <label className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              {FIELD_LABELS[field]}
              <ConfidenceBadge level={confidenceFlags[field]} />
            </label>
            {field === 'detailed_description' ? (
              <textarea
                rows={2}
                value={current[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                className={`${fieldBase} resize-y ${isLow ? fieldLowConfidence : fieldNormal}`}
              />
            ) : (
              <input
                type={field === 'date_of_occurrence' ? 'date' : 'text'}
                value={current[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                className={`${fieldBase} ${isLow ? fieldLowConfidence : fieldNormal}`}
              />
            )}
          </div>
        )
      })}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-fg-muted">{FIELD_LABELS.initial_impact}</label>
          <select
            value={current.initial_impact || ''}
            onChange={(e) => handleChange('initial_impact', e.target.value)}
            className={`${fieldBase} ${fieldNormal}`}
          >
            <option value="">— select —</option>
            {IMPACT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-fg-muted">{FIELD_LABELS.initial_severity}</label>
          <select
            value={current.initial_severity || ''}
            onChange={(e) => handleChange('initial_severity', e.target.value)}
            className={`${fieldBase} ${fieldNormal}`}
          >
            <option value="">— select —</option>
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !hasContent}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saveStatus === 'saving' ? '⟳ Saving…' : '✓ Save Deviation'}
        </button>
        <button
          onClick={handleNew}
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2"
        >
          + New
        </button>
      </div>
    </div>
  )
}
