// Must match backend/app/schemas/enums.py exactly (Impact, Severity) — single source of truth
// on the backend; keep these in lockstep whenever that file changes.
export const IMPACT_OPTIONS = ['Patient Safety', 'Product Quality', 'Regulatory', 'Documentation']
export const SEVERITY_OPTIONS = ['Critical', 'Major', 'Minor']

export const EXTRACTED_FIELDS = [
  'site_plant',
  'date_of_occurrence',
  'title',
  'source',
  'related_product',
  'batch_lot_number',
  'detailed_description',
]

export const FIELD_LABELS = {
  site_plant: 'Site / Plant',
  date_of_occurrence: 'Date of Occurrence',
  title: 'Title',
  source: 'Source',
  related_product: 'Related Product',
  batch_lot_number: 'Batch / Lot Number',
  detailed_description: 'Detailed Description',
  initial_impact: 'Initial Impact',
  initial_severity: 'Initial Severity',
}
