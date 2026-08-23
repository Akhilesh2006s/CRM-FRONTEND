import { apiFetchUrl } from '@/lib/api'

/** Download an Excel (or other binary) report from a backend path like `/reports/dc/export`. */
export async function downloadReportFile(apiPath: string, fallbackName: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  const response = await fetch(apiFetchUrl(apiPath), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Export failed' }))
    throw new Error(error.message || 'Export failed')
  }
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = /filename="?([^"]+)"?/i.exec(disposition)
  a.download = match?.[1] || fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
