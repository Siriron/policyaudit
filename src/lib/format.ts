const GEN = 10n ** 18n

/** wei (string|bigint) -> "1.25 GEN" (up to 6 decimals, trailing zeros trimmed). */
export function formatGen(wei: string | bigint): string {
  const n = typeof wei === 'string' ? BigInt(wei) : wei
  const whole = n / GEN
  const frac = n % GEN
  if (frac === 0n) return `${whole} GEN`
  const f = frac.toString().padStart(18, '0').replace(/0+$/, '').slice(0, 6)
  return `${whole}.${f || '0'} GEN`
}

/** "1.25" -> wei. Returns null on anything that is not a plain non-negative decimal with at most 18 places. */
export function parseGen(input: string): bigint | null {
  const t = input.trim()
  if (!/^\d+(\.\d{1,18})?$/.test(t)) return null
  const [whole, frac = ''] = t.split('.')
  return BigInt(whole) * GEN + BigInt(frac.padEnd(18, '0'))
}

export const shortAddr = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

export function formatDate(unix: number): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function timeLeft(unix: number, now = Math.floor(Date.now() / 1000)): string {
  const diff = unix - now
  if (diff <= 0) return 'ended'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h left`
  const m = Math.floor((diff % 3600) / 60)
  return `${h}h ${m}m left`
}

export const sameAddr = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase()
