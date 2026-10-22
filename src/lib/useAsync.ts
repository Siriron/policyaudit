import { useCallback, useEffect, useRef, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  error: string
  loading: boolean
  reload: () => void
}

/** Loads once on mount / when deps change, plus on demand. No timers: StudioNet is rate-limited. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)
  const load = useCallback(() => {
    const mine = ++seq.current
    setLoading(true)
    setError('')
    fn().then(
      d => { if (mine === seq.current) { setData(d); setLoading(false) } },
      e => { if (mine === seq.current) { setError(e instanceof Error ? e.message : String(e)); setLoading(false) } },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load }
}
