import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import {
  deleteDeviation as deleteDeviationApi,
  getDeviation as getDeviationApi,
  listDeviations as listDeviationsApi,
  saveDeviation as saveDeviationApi,
  saveDraft as saveDraftApi,
} from '../api/deviations'
import { extractDeviation } from './aiSlice'

const emptyDeviation = {
  id: null,
  site_plant: '',
  date_of_occurrence: '',
  title: '',
  source: '',
  related_product: '',
  batch_lot_number: '',
  detailed_description: '',
  initial_impact: '',
  initial_severity: '',
}

function buildPayload(current, extractionLogId) {
  const payload = {
    ...current,
    extraction_log_id: extractionLogId || undefined,
  }
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '') payload[key] = null
  })
  return payload
}

export const saveDeviation = createAsyncThunk(
  'deviation/saveDeviation',
  async (_, { getState, rejectWithValue }) => {
    const { deviation, ai } = getState()
    try {
      return await saveDeviationApi(buildPayload(deviation.current, ai.extractionLogId))
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to save deviation.'
      return rejectWithValue(detail)
    }
  }
)

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

export const deleteDraft = createAsyncThunk('deviation/deleteDraft', async (id) => {
  await deleteDeviationApi(id)
  return id
})

export const fetchDeviations = createAsyncThunk('deviation/fetchDeviations', async () => {
  return listDeviationsApi()
})

export const fetchDeviationDetail = createAsyncThunk('deviation/fetchDeviationDetail', async (id) => {
  return getDeviationApi(id)
})

const deviationSlice = createSlice({
  name: 'deviation',
  initialState: {
    current: { ...emptyDeviation },
    saveStatus: 'idle', // idle | saving | saved | error
    saveError: null,
    list: [],
    selected: null,
  },
  reducers: {
    editField(state, action) {
      const { field, value } = action.payload
      state.current[field] = value
    },
    resetCurrent(state) {
      state.current = { ...emptyDeviation }
      state.saveStatus = 'idle'
      state.saveError = null
    },
    clearSelected(state) {
      state.selected = null
    },
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
  },
  extraReducers: (builder) => {
    builder
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
      .addCase(saveDeviation.pending, (state) => {
        state.saveStatus = 'saving'
        state.saveError = null
      })
      .addCase(saveDeviation.fulfilled, (state) => {
        state.saveStatus = 'saved'
        state.current = { ...emptyDeviation }
      })
      .addCase(saveDeviation.rejected, (state, action) => {
        state.saveStatus = 'error'
        state.saveError = action.payload || 'Failed to save deviation.'
      })
      .addCase(saveDraft.fulfilled, (state, action) => {
        if (!action.payload) return
        state.current.id = action.payload.id
        const idx = state.list.findIndex((d) => d.id === action.payload.id)
        if (idx >= 0) state.list[idx] = action.payload
        else state.list.unshift(action.payload)
      })
      .addCase(deleteDraft.fulfilled, (state, action) => {
        state.list = state.list.filter((d) => d.id !== action.payload)
        if (state.current.id === action.payload) {
          state.current = { ...emptyDeviation }
        }
      })
      .addCase(fetchDeviations.fulfilled, (state, action) => {
        state.list = action.payload
      })
      .addCase(fetchDeviationDetail.fulfilled, (state, action) => {
        state.selected = action.payload
      })
  },
})

export const { editField, resetCurrent, clearSelected, resumeDraft } = deviationSlice.actions
export default deviationSlice.reducer
