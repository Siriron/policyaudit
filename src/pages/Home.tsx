import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listPolicies, isDeployed } from '../lib/gen'
import { useAsync } from '../lib/useAsync'
import { formatGen, formatDate, shortAddr, timeLeft } from '../lib/format'
import { Badge, Empty, ErrorNote, Spinner } from '../components/ui'
import type { Policy } from '../lib/types'

const TABS = [['OPEN', 'Open'], ['DISPUTED', 'Disputed'], ['CLOSED', 'Closed'], ['', 'All']] as const

export function PolicyCard({ p }: { p: Policy }) {
  return (
    <Link to={`/p/${p.id}`} className="card">
      <div className="cardtop"><strong>#{p.id} {p.name}</strong><Badge kind={p.status}>{p.status}</Badge></div>
      <p className="claim">“{p.claim}”</p>
      <p className="muted mono">{p.repo}@{p.commit_sha.slice(0, 7)}:{p.path}</p>
      <p className="meta">
        <span>Bounty <b>{formatGen(p.bounty)}</b></span>
        <span>Entry {formatGen(p.entry_fee)}</span>
        <span>{p.challenges} challenge{p.challenges === 1 ? '' : 's'}</span>
        <span>{p.status === 'OPEN' ? timeLeft(p.lock_until) : formatDate(p.closed_at)}</span>
        <span>by {shortAddr(p.publisher)}</span>
      </p>
    </Link>
  )
}

export default function Home() {
  const [tab, setTab] = useState<string>('OPEN')
  const q = useAsync(() => (isDeployed() ? listPolicies(tab, '', 0, 30) : Promise.resolve(null)), [tab])
  return (
    <>
      <section className="hero">
        <h1>Find where a policy says something other than what it claims.</h1>
        <p>A publisher locks a bounty against a claim about one policy file, pinned to a git commit. Challengers submit concrete scenarios.
          GenLayer validators each fetch the pinned file and judge it independently. Reproduced contradictions pay the bounty out.</p>
        <p><Link className="primary" to="/new">Post a policy</Link> <Link className="ghost" to="/guide">Walk through a test</Link></p>
      </section>
      <div className="tabs" role="tablist">
        {TABS.map(([v, label]) => (
          <button key={label} role="tab" aria-selected={tab === v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>{label}</button>
        ))}
        <button className="link" onClick={q.reload}>Refresh</button>
      </div>
      {q.loading && <Spinner label="Reading policies" />}
      <ErrorNote message={q.error} onRetry={q.reload} />
      {!q.loading && !q.error && q.data && q.data.items.length === 0 && <Empty>No {tab ? tab.toLowerCase() : ''} policies yet.</Empty>}
      <div className="cards">{q.data?.items.map(p => <PolicyCard key={p.id} p={p} />)}</div>
      {q.data && q.data.total > q.data.items.length && <p className="muted">Showing the newest {q.data.items.length} of {q.data.total}.</p>}
    </>
  )
}
