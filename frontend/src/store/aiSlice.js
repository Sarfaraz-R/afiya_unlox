import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { extractDeviation as extractDeviationApi } from '../api/deviations'
import { FIELD_LABELS } from '../constants'

function newMessage(role, text, extra = {}) {
  return { id: `${Date.now()}-${Math.random()}`, role, text, ts: Date.now(), ...extra }
}

function classifyError(error) {
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return { message: 'The AI service timed out. Please retry or fill the form in manually.', kind: 'timeout' }
  }
  if (error.response) {
    const detail = error.response.data?.detail || 'The request was rejected by the server.'
    return { message: detail, kind: error.response.status === 422 ? 'upload_error' : 'server_error' }
  }
  return { message: 'Could not reach the backend. Is it running?', kind: 'server_error' }
}

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

const initialState = {
  status: 'idle', // idle | uploading | extracting | assessing | done | error
  progressMessage: null,
  extractionLogId: null,
  confidenceFlags: {},
  missingFields: [],
  aiReasoning: null,
  modelUsed: null,
  error: null,
  duplicateWarnings: [],
  messages: [],
}

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setProgressMessage(state, action) {
      state.progressMessage = action.payload
      state.status = 'extracting'
    },
    addUserMessage(state, action) {
      state.messages.push(newMessage('user', action.payload))
    },
    resetAiState() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(extractDeviation.pending, (state) => {
        state.status = 'uploading'
        state.error = null
      })
      .addCase(extractDeviation.fulfilled, (state, action) => {
        const payload = action.payload
        const prev = payload._prevFields || {}
        state.status = 'done'
        state.progressMessage = null
        state.extractionLogId = payload.extraction_log_id
        state.confidenceFlags = payload.confidence || {}
        state.missingFields = payload.missing_fields || []
        state.aiReasoning = payload.reasoning || null
        state.modelUsed = payload.model_used || null
        state.duplicateWarnings = payload.duplicate_warnings || []
        state.error = payload.error
          ? { message: payload.error, kind: 'parse_error' }
          : null

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
      })
      .addCase(extractDeviation.rejected, (state, action) => {
        state.status = 'error'
        state.progressMessage = null
        const err = action.payload || { message: 'Extraction failed.', kind: 'server_error' }
        state.error = err
        state.messages.push(newMessage('ai', err.message, { isError: true }))
      })
  },
})

export const { setProgressMessage, addUserMessage, resetAiState } = aiSlice.actions
export default aiSlice.reducer
