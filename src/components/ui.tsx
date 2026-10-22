import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useTx, useWallet } from '../lib/app'
import { CONTRACT_ADDRESS, explorerAddress, explorerTx } from '../config/chains'
import { shortAddr } from '../lib/format'

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role="status" aria-live="polite"><i />{label ?? 'Loading'}</span>
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div className="note err" role="alert">
      <span>{message}</span>
      {onRetry && <button className="link" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind.toLowerCase()}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function DeployBanner() {
  if (CONTRACT_ADDRESS) return null
  return (
    <div className="note warn" role="status">
      The contract is not deployed yet, so nothing can be read or written. After deploying, set
      {' '}<code>CONTRACT_ADDRESS</code> in <code>src/config/chains.ts</code>.
    </div>
  )
}

const PHASE_TEXT: Record<string, string> = {
  signing: 'Confirm in your wallet…',
  pending: 'Submitted. Validators are reaching consensus; this can take several minutes.',
  provisional: 'Accepted by the validators: provisional and still appealable, not final.',
  finalized: 'Finalized.',
  failed: 'Failed.',
  undetermined: 'Consensus did not settle.',
  timeout: 'Still waiting. The transaction may yet succeed.',
  ratelimited: 'Rate-limited by StudioNet.',
  rejected: 'Cancelled.',
}

export function TxPanel() {
  const { report, action, dismiss } = useTx()
  if (report.phase === 'idle') return null
  const bad = ['failed', 'undetermined', 'timeout', 'ratelimited', 'rejected'].includes(report.phase)
  return (
    <aside className={`txpanel ${bad ? 'bad' : report.phase === 'finalized' ? 'good' : ''}`} role="status" aria-live="polite">
      <div className="txhead">
        <strong>{action}</strong>
        <button className="link" onClick={dismiss} aria-label="Dismiss">Dismiss</button>
      </div>
      <p>{PHASE_TEXT[report.phase]} {report.message && report.phase !== 'timeout' ? report.message : ''}</p>
      {report.phase === 'timeout' && <p>{report.message}</p>}
      {report.phase === 'provisional' && (
        <p className="muted">Payouts and balances only become final when the network marks this transaction Finalized.</p>
      )}
      {(report.status || report.execution) && (
        <p className="muted">Network status: {report.status || '—'} · Execution: {report.execution || '—'}</p>
      )}
      {report.hash && <p className="muted"><a href={explorerTx(report.hash)} target="_blank" rel="noreferrer">View transaction</a></p>}
    </aside>
  )
}

export function WalletButton() {
  const { account, connect } = useWallet()
  if (account) return <a className="wallet on" href={explorerAddress(account)} target="_blank" rel="noreferrer">{shortAddr(account)}</a>
  return <button className="wallet" onClick={connect}>Connect wallet</button>
}

export function Layout({ children }: { children: ReactNode }) {
  const { error } = useWallet()
  return (
    <>
      <header className="top">
        <Link to="/" className="brand"><img src="/favicon.svg" alt="" width="26" height="26" />PolicyAudit</Link>
        <nav aria-label="Primary">
          <NavLink to="/" end>Policies</NavLink>
          <NavLink to="/new">Post</NavLink>
          <NavLink to="/me">My account</NavLink>
          <NavLink to="/guide">Test guide</NavLink>
          <NavLink to="/docs">Docs</NavLink>
        </nav>
        <WalletButton />
      </header>
      <main>
        <DeployBanner />
        <ErrorNote message={error} />
        {children}
      </main>
      <TxPanel />
      <footer className="foot">
        Built on <a href="https://genlayer.com" target="_blank" rel="noreferrer">GenLayer</a> · StudioNet (temporary test network)
      </footer>
    </>
  )
}
