import { apiClient } from './client'

export async function extractDeviation({ file, text, currentFields }) {
  const formData = new FormData()
  if (file) {
    formData.append('file', file)
  } else {
    formData.append('text', text)
  }
  if (currentFields) {
    formData.append('current_fields', JSON.stringify(currentFields))
  }
  const { data } = await apiClient.post('/api/extract', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function saveDeviation(payload) {
  const { data } = await apiClient.post('/api/deviations', payload)
  return data
}

export async function saveDraft(payload) {
  const { data } = await apiClient.post('/api/deviations/draft', payload)
  return data
}

export async function deleteDeviation(id) {
  await apiClient.delete(`/api/deviations/${id}`)
  return id
}

export async function listDeviations() {
  const { data } = await apiClient.get('/api/deviations')
  return data
}

export async function getDeviation(id) {
  const { data } = await apiClient.get(`/api/deviations/${id}`)
  return data
}
