export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error?.message || payload.message || (typeof payload.error === 'string' ? payload.error : `A API retornou erro ${response.status}.`))
  }
  if (response.status === 204) return undefined as T
  return response.json()
}
export async function download(path: string, filename: string) {
  const response = await fetch(`/api/v1${path}`)
  if (!response.ok) throw new Error(`Não foi possível exportar os dados (${response.status}).`)
  saveBlob(await response.blob(), filename)
}
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
