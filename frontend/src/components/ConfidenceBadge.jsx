export default function ConfidenceBadge({ level }) {
  if (!level || level === 'high') return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-fg"
      title="AI wasn't confident about this field — please verify"
    >
      <span aria-hidden="true">⚠</span> low confidence
    </span>
  )
}
