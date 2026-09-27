# Deviation Intake — Implementation Notes

AI-assisted deviation capture, review, and audit tool for manufacturing QA. This document explains
**what was built and how**, with the exact file and line references for each piece of logic, so it
can be used as a walkthrough/explanation reference (e.g. for a viva or code review).

## Stack

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL + Alembic, with a small **LangGraph** pipeline
  calling the Groq API for extraction/classification.
- **Frontend**: React 19 + Redux Toolkit + Tailwind CSS v4 (Vite dev server).

## Architecture at a glance

```
User pastes text / uploads a file
        │
        ▼
POST /api/extract  (backend/app/api/extract.py)
        │
        ▼
LangGraph pipeline: extract → assess → validate  (backend/app/graph/pipeline.py)
        │
        ▼
Redux (aiSlice + deviationSlice) merges the result into the form + chat thread
        │
        ▼
Autosave as a draft  (POST /api/deviations/draft)
        │
        ▼
User clicks "Save Deviation" → same row is finalized (status: draft → saved)
```

---

## 1. The AI extraction pipeline (LangGraph)

Three nodes wired into a linear graph: `extract → assess → validate`.

**`backend/app/graph/pipeline.py:6-20`**
```python
_graph_builder = StateGraph(PipelineState)
_graph_builder.add_node("extract", extract_node)
_graph_builder.add_node("assess", severity_impact_node)
_graph_builder.add_node("validate", validate_node)

_graph_builder.add_edge(START, "extract")
_graph_builder.add_edge("extract", "assess")
_graph_builder.add_edge("assess", "validate")
_graph_builder.add_edge("validate", END)

compiled_graph = _graph_builder.compile()


def run_pipeline(raw_text: str, current_fields: dict | None = None) -> PipelineState:
    return compiled_graph.invoke({"raw_text": raw_text, "current_fields": current_fields or {}})
```

- `extract_node` (`backend/app/graph/nodes.py:27-67`) calls Groq with a JSON-forcing system
  prompt (`backend/app/graph/prompts.py:3-29`) to pull the 7 structured fields
  (`site_plant`, `date_of_occurrence`, `title`, `source`, `related_product`,
  `batch_lot_number`, `detailed_description`) out of free text, each tagged `high`/`low`
  confidence.
- `severity_impact_node` (`backend/app/graph/nodes.py:70-92`) takes those fields and classifies
  `impact` (Patient Safety / Product Quality / Regulatory / Documentation) and `severity`
  (Critical / Major / Minor), with a one-line rationale.
- `validate_node` (`backend/app/graph/nodes.py:95-98`) just diffs the extracted fields against
  `REQUIRED_FIELDS` to report what's still missing.

The shared state shape travelling through the graph is a `TypedDict`:

**`backend/app/graph/state.py:4-20`**
```python
class PipelineState(TypedDict, total=False):
    raw_text: str
    current_fields: dict

    # extract_node output
    fields: dict
    confidence: dict
    model_used: str
    extract_error: str | None

    # severity_impact_node output
    impact: str | None
    severity: str | None
    reasoning: str | None

    # validate_node output
    missing_fields: list[str]
```

---

## 2. Turning it into a real conversation, not one-shot extraction

**Problem it solves**: the first version re-ran extraction from scratch on every message, with no
memory of the form's current values. A follow-up like *"actually it's Critical, not Major"* would
come back with everything else `null`, and the frontend was blindly overwriting the form with those
nulls — wiping out already-captured data on every turn.

**Fix — backend carries prior fields forward.** The client now sends the form's current values as
`current_fields` on every call; the extract node only lets the model *add or correct* fields, and
falls back to whatever was already known for anything the new message doesn't mention:

**`backend/app/graph/nodes.py:19-24`**
```python
def _carry_forward(current_fields: dict) -> tuple[dict, dict]:
    """When the AI found nothing new for a field, fall back to the value already captured in this
    conversation (from an earlier turn or a manual edit) instead of nulling it out."""
    fields = {field: current_fields.get(field) for field in EXTRACTED_FIELDS}
    confidence = {field: ("high" if current_fields.get(field) else "low") for field in EXTRACTED_FIELDS}
    return fields, confidence
```

**`backend/app/graph/nodes.py:47-59`** — the merge itself: a field is only overwritten if the model
actually found something new for it this turn; otherwise the previous value (and a "high"
confidence, since it was already confirmed) is kept:
```python
for field in EXTRACTED_FIELDS:
    value = parsed.get("fields", {}).get(field)
    if value:
        fields[field] = value
        confidence[field] = parsed.get("confidence", {}).get(field, "low")
    else:
        fields[field] = current_fields.get(field)
        confidence[field] = "high" if current_fields.get(field) else "low"
```

**Severity/impact also needs the raw message**, not just the structured fields — otherwise an
explicit correction like "reclassify as Patient Safety" has nowhere to land, since severity isn't
one of the extracted fields:

**`backend/app/graph/nodes.py:70-72`**
```python
def severity_impact_node(state: PipelineState) -> dict:
    fields = state.get("fields", {})
    user_prompt = json.dumps({"fields": fields, "latest_message": state.get("raw_text", "")})
```

The system prompt tells the model to prefer that explicit instruction:
**`backend/app/graph/prompts.py:47-49`**
```
5. If "latest_message" explicitly states or corrects the severity or impact (e.g. "this is \
actually Critical", "reclassify as Patient Safety"), honor that explicit instruction over your \
own inference from "fields", and say so in the reasoning.
```

**API endpoint accepts the extra context** as a JSON string form field (multipart, since a file
upload shares this endpoint):

**`backend/app/api/extract.py:16-26`, `39`**
```python
@router.post("/extract", response_model=ExtractResponse)
def extract(
    file: UploadFile | None = None,
    text: str | None = Form(None),
    current_fields: str | None = Form(None),
    db: Session = Depends(get_db),
):
    try:
        known_fields = json.loads(current_fields) if current_fields else {}
    except (TypeError, ValueError):
        known_fields = {}
    ...
    result = run_pipeline(raw_text, known_fields)
```

**Frontend fix — same merge philosophy in Redux.** This was the actual bug users hit: the reducer
used to spread the whole `fields` object (nulls included) over the current form. Now it only
applies non-empty values:

**`frontend/src/store/deviationSlice.js:118-127`**
```js
.addCase(extractDeviation.fulfilled, (state, action) => {
  const { fields, impact, severity } = action.payload
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      state.current[key] = value
    }
  })
  if (impact) state.current.initial_impact = impact
  if (severity) state.current.initial_severity = severity
})
```

**Sending the current form state with every call** happens in the `extractDeviation` thunk, which
also snapshots the "before" state so it can later report what changed:

**`frontend/src/store/aiSlice.js:20-38`**
```js
export const extractDeviation = createAsyncThunk(
  'ai/extractDeviation',
  async ({ file, text }, { dispatch, getState, rejectWithValue }) => {
    const prevFields = { ...getState().deviation.current }
    dispatch(addUserMessage(file ? `📎 Uploaded ${file.name}` : text))
    dispatch(setProgressMessage(file ? 'Reading file…' : 'Extracting key details…'))
    const progressTimer = setTimeout(() => {
      dispatch(setProgressMessage('Assessing severity…'))
    }, 1500)
    try {
      const result = await extractDeviationApi({ file, text, currentFields: prevFields })
      return { ...result, _prevFields: prevFields }
    } catch (error) {
      return rejectWithValue(classifyError(error))
    } finally {
      clearTimeout(progressTimer)
    }
  }
)
```

---

## 3. Chat UI (message thread + "typing…" indicator)

The AI Assistant panel keeps a running `messages` array (`role: 'user' | 'ai'`) instead of showing
one-off banners. Each AI reply is a generated diff summary, computed by comparing the new fields
against the pre-call snapshot from step 2:

**`frontend/src/store/aiSlice.js:89-103`**
```js
const changed = []
Object.entries(payload.fields || {}).forEach(([key, value]) => {
  if (value !== null && value !== undefined && value !== '' && value !== prev[key]) {
    changed.push(FIELD_LABELS[key] || key)
  }
})
if (payload.severity && payload.severity !== prev.initial_severity) changed.push('Severity')
if (payload.impact && payload.impact !== prev.initial_impact) changed.push('Impact')

const summary = payload.error
  ? payload.error
  : changed.length
    ? `Updated: ${changed.join(', ')}.`
    : "Got that, but I didn't find anything new to update — try adding more detail."
state.messages.push(newMessage('ai', summary, { isError: Boolean(payload.error) }))
```

The typing indicator is three `animate-bounce` dots with staggered negative animation-delays
(Tailwind arbitrary-property syntax), styled as a chat bubble next to an avatar:

**`frontend/src/components/AIAssistantPanel.jsx:55-69`**
```jsx
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
```

The thread auto-scrolls to the bottom whenever a message is added or the busy state changes, via a
sentinel `<div ref={threadEndRef} />` at the end of the list:

**`frontend/src/components/AIAssistantPanel.jsx:77-83`, `128`**
```jsx
const threadEndRef = useRef(null)
...
useEffect(() => {
  threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}, [messages, busy])
...
<div ref={threadEndRef} />
```

---

## 4. Draft persistence (status column that was already there, unused)

The `Deviation` model already had a `status` column defaulting to `"draft"` — the original save
endpoint just always hardcoded `"saved"` and never used it. This was wired up properly:

**`backend/app/models/deviation.py:27`**
```python
status: Mapped[str] = mapped_column(String, default="draft", server_default="draft")
```

**Upsert-by-id helper** shared by both the draft and finalize endpoints — if an `id` is sent, it
updates that row (and only that row's `status` changes on finalize); otherwise it creates a new one:

**`backend/app/api/deviations.py:16-29`**
```python
def _get_or_create(payload: DeviationCreate, db: Session, status: str) -> Deviation:
    data = payload.model_dump(exclude={"extraction_log_id", "id"})
    if payload.id:
        deviation = db.get(Deviation, payload.id)
        if deviation is None:
            raise HTTPException(status_code=404, detail="Deviation not found.")
        for key, value in data.items():
            setattr(deviation, key, value)
        deviation.status = status
    else:
        deviation = Deviation(status=status, **data)
        db.add(deviation)
    db.flush()
    return deviation
```

**Two endpoints share it** — `POST /api/deviations/draft` (status stays `"draft"`) and
`POST /api/deviations` (status becomes `"saved"`, i.e. finalize):

**`backend/app/api/deviations.py:32-53`**
```python
@router.post("/deviations", response_model=DeviationOut)
def create_deviation(payload: DeviationCreate, db: Session = Depends(get_db)):
    deviation = _get_or_create(payload, db, status="saved")
    ...

@router.post("/deviations/draft", response_model=DeviationOut)
def save_draft(payload: DeviationCreate, db: Session = Depends(get_db)):
    deviation = _get_or_create(payload, db, status="draft")
    db.commit()
    db.refresh(deviation)
    return deviation
```

**On the frontend**, a draft autosave fires after every successful AI extraction turn — not on
every keystroke, only after a chat round-trip completes:

**`frontend/src/components/AIAssistantPanel.jsx:85-98`**
```jsx
async function handlePasteSubmit() {
  if (!text.trim()) return
  setText('')
  const result = await dispatch(extractDeviation({ text }))
  if (result.meta.requestStatus === 'fulfilled') dispatch(saveDraft())
}

async function handleFileChange(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const result = await dispatch(extractDeviation({ file }))
  if (result.meta.requestStatus === 'fulfilled') dispatch(saveDraft())
}
```

The `saveDraft` thunk upserts by whatever `id` is already on the form (so repeated turns update the
same row instead of creating duplicates), and on success writes that `id` back into `current` plus
upserts the row into the in-memory `list` (no extra network round-trip needed to refresh it):

**`frontend/src/store/deviationSlice.js:48-61`, `140-146`**
```js
export const saveDraft = createAsyncThunk(
  'deviation/saveDraft',
  async (_, { getState, rejectWithValue }) => {
    const { deviation, ai } = getState()
    if (!deviation.current.title && !deviation.current.detailed_description) {
      return null
    }
    try {
      return await saveDraftApi(buildPayload(deviation.current, ai.extractionLogId))
    } catch {
      return rejectWithValue('Failed to save draft.')
    }
  }
)
...
.addCase(saveDraft.fulfilled, (state, action) => {
  if (!action.payload) return
  state.current.id = action.payload.id
  const idx = state.list.findIndex((d) => d.id === action.payload.id)
  if (idx >= 0) state.list[idx] = action.payload
  else state.list.unshift(action.payload)
})
```

**The list UI splits by status** into a "Drafts — not saved" group (resumable, discardable) and a
"Saved" group (read-only audit view):

**`frontend/src/components/DeviationList.jsx:37-38`**
```js
const drafts = list.filter((d) => d.status === 'draft')
const saved = list.filter((d) => d.status !== 'draft')
```

Clicking a draft loads it back into the editable form and starts a fresh chat context; the ✕ button
discards it without opening it:

**`frontend/src/components/DeviationList.jsx:51-59`**
```js
function handleResume(dev) {
  dispatch(resumeDraft(dev))
  dispatch(resetAiState())
}

function handleDiscard(e, id) {
  e.stopPropagation()
  dispatch(deleteDraft(id))
}
```

`resumeDraft` is a plain synchronous reducer that copies a saved-row shape back into the editable
`current` object:

**`frontend/src/store/deviationSlice.js:98-114`**
```js
resumeDraft(state, action) {
  const dev = action.payload
  state.current = {
    id: dev.id,
    site_plant: dev.site_plant || '',
    date_of_occurrence: dev.date_of_occurrence || '',
    title: dev.title || '',
    source: dev.source || '',
    related_product: dev.related_product || '',
    batch_lot_number: dev.batch_lot_number || '',
    detailed_description: dev.detailed_description || '',
    initial_impact: dev.initial_impact || '',
    initial_severity: dev.initial_severity || '',
  }
  state.saveStatus = 'idle'
  state.saveError = null
},
```

---

## 5. Save / New lifecycle rules

- **"Save Deviation" finalizes the same row** (via the `id` already attached from autosave) rather
  than creating a duplicate, then clears the form and resets the chat:

  **`frontend/src/components/LogDeviationForm.jsx:26-38`**
  ```js
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
  ```

  The actual clearing happens in the reducer, right where the row is finalized:

  **`frontend/src/store/deviationSlice.js:132-135`**
  ```js
  .addCase(saveDeviation.fulfilled, (state) => {
    state.saveStatus = 'saved'
    state.current = { ...emptyDeviation }
  })
  ```

- **Empty-form guard** — Save is disabled (and, as a second line of defense, refuses at click-time)
  if every field is blank, so an empty log can never be saved:

  **`frontend/src/components/LogDeviationForm.jsx:19-20`, `113`**
  ```js
  const hasContent =
    EXTRACTED_FIELDS.some((field) => current[field]) || current.initial_impact || current.initial_severity
  ...
  disabled={saveStatus === 'saving' || !hasContent}
  ```

- **"+ New" only clears the form** — it does *not* delete the draft that was being worked on, so it
  stays in the Drafts list to resume later:

  **`frontend/src/components/LogDeviationForm.jsx:40-43`**
  ```js
  function handleNew() {
    dispatch(resetCurrent())
    dispatch(resetAiState())
  }
  ```

---

## 6. A real bug found & fixed: FK blocked deletes

Adding `DELETE /api/deviations/{id}` initially failed with a 500 whenever the deviation had an
associated `ai_extraction_logs` row, because the foreign key had no `ON DELETE` behavior
(Postgres default is `NO ACTION`, which blocks the delete). Fixed at the schema level — the log is
an audit trail and should survive its deviation being deleted, just with the link nulled out —
via a proper Alembic migration rather than a workaround in the endpoint:

**`backend/app/models/ai_extraction_log.py:17-19`**
```python
deviation_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("deviations.id", ondelete="SET NULL"), nullable=True
)
```

**`backend/alembic/versions/cf28e2c50028_add_on_delete_set_null_to_ai_extraction_.py:21-33`**
```python
def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(
        "ai_extraction_logs_deviation_id_fkey", "ai_extraction_logs", type_="foreignkey"
    )
    op.create_foreign_key(
        "ai_extraction_logs_deviation_id_fkey",
        "ai_extraction_logs",
        "deviations",
        ["deviation_id"],
        ["id"],
        ondelete="SET NULL",
    )
```

The delete endpoint itself is a straightforward guarded delete:

**`backend/app/api/deviations.py:56-62`**
```python
@router.delete("/deviations/{deviation_id}", status_code=204)
def delete_deviation(deviation_id: uuid.UUID, db: Session = Depends(get_db)):
    deviation = db.get(Deviation, deviation_id)
    if deviation is None:
        raise HTTPException(status_code=404, detail="Deviation not found.")
    db.delete(deviation)
    db.commit()
```

---

## 7. Layout: three panels that fit one screen, no page scroll

`App.jsx` is a fixed `h-screen` flex column; the three panels sit in a `flex` row that fills the
remaining height, with the Log Deviation + AI Assistant cards sharing a 2-column grid and the
Saved Deviations panel as a separate flex item so it can have its own fixed/collapsible width:

**`frontend/src/App.jsx:32-40`**
```jsx
<div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:overflow-hidden lg:px-8">
  <main className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
      <LogDeviationForm />
      <AIAssistantPanel />
    </div>
    <DeviationList />
  </main>
</div>
```

Two responsive-layout bugs were found and fixed here:

- **`min-w-0` on the grid wrapper** (line 34) — without it, a flex child refuses to shrink below
  its content's natural width, which could push the Saved Deviations panel off-screen with no
  scrollbar to reach it (the outer container is `overflow-hidden` by design, for the "everything
  fits in one frame" requirement).
- **`overflow-y-auto` below `lg`, `overflow-hidden` above it** (line 32) — below the `lg` breakpoint
  the three panels stack vertically (`flex-col` → `lg:flex-row`); without a scroll fallback there,
  a short viewport could push "Saved Deviations" below the fold with genuinely no way to reach it.

**Minimize-to-sidebar-strip**: collapsing the Saved Deviations panel doesn't just hide its content —
it swaps to a completely different, narrow (`w-10`) vertical strip docked at the right, so the other
two panels can reclaim the freed width:

**`frontend/src/components/DeviationList.jsx:61-77`**
```jsx
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
```

---

## 8. Theming: one CSS custom-property layer drives the whole app

Every color in every component is a Tailwind utility referencing a CSS variable (`bg-surface`,
`text-fg-muted`, `border-border-strong`, …) defined once in `@theme`. Swapping the whole app's look
is a single-file edit — this is how the color palette was changed twice in this session without
touching any component:

**`frontend/src/index.css:8-23`**
```css
/* Base surfaces — light theme built from alabaster-grey / dusty-denim / dusk-blue */
--color-bg: #e0e1dd;
--color-surface: #ffffff;
--color-surface-2: #f4f6f8;
--color-border: #d3d9de;
--color-border-strong: #778da9;

/* Foreground */
--color-fg: #111315;
--color-fg-muted: #4a4f57;
--color-fg-subtle: #8a8f99;

/* Accent (primary interactive) */
--color-accent: #415a77;
--color-accent-fg: #e0e1dd;
--color-accent-hover: #4f6d8e;
```

Severity/status colors (`--color-warning`, `--color-danger`, `--color-success`, `--color-info`,
`--color-notice`, each with a `-bg` and `-fg` pair) are kept as separate hues on purpose — they
encode real meaning (Critical vs. Major vs. Minor, error vs. success) that a 3-color brand palette
can't represent without losing that distinction.

---

## 9. Company selector (Navbar)

A controlled dropdown with click-outside-to-close, built with a `ref` + `mousedown` listener rather
than relying on `<select>` (so it can be styled to match the rest of the pill-shaped UI):

**`frontend/src/components/Navbar.jsx:15-29`**
```jsx
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [company, setCompany] = useState(COMPANIES[0])
  const [companyOpen, setCompanyOpen] = useState(false)
  const companyRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (companyRef.current && !companyRef.current.contains(e.target)) {
        setCompanyOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
```

Selection is local UI state only — it isn't wired to any backend org/tenant concept, so it doesn't
currently scope the deviations list.

---

## Known scope boundaries (things intentionally left out)

- **Draft autosave only fires after an AI chat turn**, not on every manual keystroke in the form.
  A deviation filled in entirely by hand (never using the AI Assistant) won't appear as a draft
  until "Save Deviation" is clicked.
- **Chat history is not persisted server-side.** Resuming a draft loads its field values but starts
  a fresh chat thread — the conversation that produced it is not replayed.
- **The company selector doesn't scope data** — it's cosmetic until a real multi-tenant concept is
  added on the backend.
