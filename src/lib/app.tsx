import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { sendWrite, waitFinalized } from './gen'
import type { TxReport, WriteName } from './gen'
import { appendLog } from './txlog'

// ---------------------------------------------------------------- wallet
interface WalletCtx {
  account: string | null
  connect: () => Promise<void>
  error: string
}
const Wallet = createContext<WalletCtx>({ account: null, connect: async () => {}, error: '' })
const RESEND_GUARD_MS = 90_000

export const useWallet = () => useContext(Wallet)

// ---------------------------------------------------------------- one write in flight at a time
interface TxCtx {
  report: TxReport
  action: string
  busy: boolean
  /** Sends a write. Resolves with the report once the transaction is provisional or has failed. */
  run: (action: string, fn: WriteName, args: (string | bigint)[], value: bigint, onProvisional?: () => void) => Promise<TxReport>
  dismiss: () => void
}
const Tx = createContext<TxCtx>({
  report: { phase: 'idle' }, action: '', busy: false, run: async () => ({ phase: 'idle' }), dismiss: () => {},
})
export const useTx = () => useContext(Tx)

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [report, setReport] = useState<TxReport>({ phase: 'idle' })
  const [action, setAction] = useState('')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const eth = window.ethereum
    if (eth) {
      eth.request({ method: 'eth_accounts' })
        .then(a => { const list = a as string[]; if (list[0]) setAccount(list[0].toLowerCase()) })
        .catch(() => {})
    }
    const onChange = (a: unknown) => setAccount(((a as string[])[0] ?? '').toLowerCase() || null)
    eth?.on?.('accountsChanged', onChange)
    return () => { alive.current = false; eth?.removeListener?.('accountsChanged', onChange) }
  }, [])

  const connect = useCallback(async () => {
    setError('')
    if (!window.ethereum) { setError('No wallet found. Install MetaMask or another EIP-1193 wallet.'); return }
    try {
      const a = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[]
      setAccount(a[0] ? a[0].toLowerCase() : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet connection failed')
    }
  }, [])

  const recentlyAccepted = useRef(new Map<string, number>())
  const busy = report.phase === 'signing' || report.phase === 'pending'

  const run: TxCtx['run'] = useCallback(async (label, fn, args, value, onProvisional) => {
    if (!account) {
      const r: TxReport = { phase: 'failed', message: 'Connect a wallet first.' }
      setReport(r); setAction(label)
      return r
    }
    const sentAt = recentlyAccepted.current.get(label)
    if (sentAt && Date.now() - sentAt < RESEND_GUARD_MS) {
      // The same write was accepted moments ago. The chain state may not show it yet; a second send would only revert.
      const r: TxReport = { phase: 'failed', message: 'This write was just accepted. Wait a few seconds and refresh before sending it again.' }
      setReport(r); setAction(label)
      return r
    }
    setAction(label)
    const note = (r: TxReport) => {
      if (!alive.current) return
      setReport(r)
    }
    const result = await sendWrite(account, fn, args, value, note)
    appendLog({
      at: new Date().toISOString(), action: label, phase: result.phase, status: result.status ?? '',
      execution: result.execution ?? '', hash: result.hash ?? '', message: result.message ?? '',
    })
    if (result.phase === 'provisional') {
      recentlyAccepted.current.set(label, Date.now())
      onProvisional?.()
      // Reads can lag the accepted state; refresh again shortly so the buttons reflect the chain.
      if (onProvisional) for (const ms of [8000, 20000]) setTimeout(() => { if (alive.current) onProvisional() }, ms)
      // Accepted is not final. Keep watching (slowly) so the panel can say when it is.
      if (result.hash) {
        waitFinalized(result.hash).then(done => {
          if (!alive.current || !done) return
          setReport(prev => (prev.hash === result.hash ? { ...prev, phase: 'finalized', status: 'FINALIZED' } : prev))
          appendLog({
            at: new Date().toISOString(), action: label, phase: 'finalized', status: 'FINALIZED',
            execution: result.execution ?? '', hash: result.hash ?? '', message: '',
          })
        })
      }
    }
    return result
  }, [account])

  const wallet = useMemo(() => ({ account, connect, error }), [account, connect, error])
  const tx = useMemo(() => ({ report, action, busy, run, dismiss: () => setReport({ phase: 'idle' }) }),
    [report, action, busy, run])
  return (
    <Wallet.Provider value={wallet}>
      <Tx.Provider value={tx}>{children}</Tx.Provider>
    </Wallet.Provider>
  )
}
