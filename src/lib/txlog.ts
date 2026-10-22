export interface TxLogEntry {
  at: string
  action: string
  phase: string
  status: string
  execution: string
  hash: string
  message: string
}

const KEY = 'policyaudit:txlog'

export function readLog(): TxLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TxLogEntry[]) : []
  } catch {
    return []
  }
}

export function appendLog(entry: TxLogEntry): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...readLog(), entry].slice(-200)))
  } catch { /* storage can be unavailable; the log is a convenience */ }
}

export function clearLog(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function logAsText(entries: TxLogEntry[]): string {
  return entries
    .map(e => [e.at, e.action, e.phase, e.status || '-', e.execution || '-', e.hash || '-', e.message || ''].join(' | '))
    .join('\n')
}
