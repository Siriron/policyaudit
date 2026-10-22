import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPolicy, isDeployed, listChallenges } from '../lib/gen'
import { useAsync } from '../lib/useAsync'
import { useTx, useWallet } from '../lib/app'
import { formatDate, formatGen, sameAddr, shortAddr, timeLeft } from '../lib/format'
import { Badge, Empty, ErrorNote, Spinner } from '../components/ui'
import { BoostForm, ChallengeForm } from '../components/Forms'
import type { Challenge, Policy } from '../lib/types'

function DocPreview({ url }: { url: string }) {
  const [text, setText] = useState<string>('')
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading')
  useEffect(() => {
    let live = true
    setState('loading')
    fetch(url).then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(t => { if (live) { setText(t.slice(0, 8000)); setState('ok') } })
      .catch(() => { if (live) setState('fail') })
    return () => { live = false }
  }, [url])
  if (state === 'loading') return <Spinner label="Fetching the pinned document" />
  if (state === 'fail') return <p className="note warn">The pinned document could not be fetched from here. If validators cannot fetch it either, challenges resolve INCONCLUSIVE.</p>
  return <pre className="doc" tabIndex={0}>{text}</pre>
}

function ChallengeRow({ c, p, onChange }: { c: Challenge; p: Policy; onChange: () => void }) {
  const { run, busy } = useTx()
  const canEvaluate = c.status === 'QUEUED' && p.status === 'OPEN'
  const canRefund = c.status === 'QUEUED' && p.status !== 'OPEN'
  return (
    <li className="chal">
      <div className="cardtop"><strong>Challenge #{c.id}</strong><Badge kind={c.status}>{c.status}</Badge></div>
      <p>“{c.scenario}”</p>
      <p className="muted">by {shortAddr(c.challenger)} · fee {formatGen(c.fee)} · {formatDate(c.submitted_at)}</p>
      {c.note && <p className="muted">Leader’s note (display only, not part of consensus): {c.note}</p>}
      {canEvaluate && (
        <button disabled={busy} onClick={() => run(`Evaluate challenge #${c.id}`, 'evaluate', [BigInt(c.id)], 0n, onChange)}>
          Evaluate (anyone can run this)
        </button>
      )}
      {canRefund && (
        <button disabled={busy} onClick={() => run(`Refund challenge #${c.id}`, 'refund_queued', [BigInt(c.id)], 0n, onChange)}>
          Void and refund {shortAddr(c.challenger)}
        </button>
      )}
    </li>
  )
}

export default function PolicyPage() {
  const id = Number(useParams().id)
  const { account } = useWallet()
  const { run, busy } = useTx()
  const pq = useAsync(() => (isDeployed() && id > 0 ? getPolicy(id) : Promise.resolve(null)), [id])
  const cq = useAsync(() => (isDeployed() && id > 0 ? listChallenges(id, 0, 50) : Promise.resolve(null)), [id])
  const reload = () => { pq.reload(); cq.reload() }

  if (!(id > 0)) return <Empty>That is not a policy number.</Empty>
  if (pq.loading && !pq.data) return <Spinner label="Reading policy" />
  if (pq.error) return <ErrorNote message={pq.error} onRetry={reload} />
  const p = pq.data
  if (!p) return null
  if (!p.found) return <Empty>Policy #{id} does not exist.</Empty>

  const now = Math.floor(Date.now() / 1000)
  const isPublisher = sameAddr(account, p.publisher)
  const lockedUntil = timeLeft(p.lock_until, now)
  const canChallenge = p.status === 'OPEN' && !isPublisher && now < p.lock_until
  const lockOver = now >= p.lock_until
  const canReclaim = isPublisher && p.status === 'OPEN' && lockOver && (p.queued === 0 || now >= p.grace_until)

  return (
    <>
      <p><Link to="/">← All policies</Link></p>
      <div className="cardtop"><h1>#{p.id} {p.name}</h1><Badge kind={p.status}>{p.status}</Badge></div>
      <p className="claim big">“{p.claim}”</p>
      <dl className="facts">
        <div><dt>Bounty</dt><dd>{formatGen(p.bounty)}</dd></div>
        <div><dt>Entry fee</dt><dd>{formatGen(p.entry_fee)}</dd></div>
        <div><dt>Challenges</dt><dd>{p.challenges} ({p.queued} queued, {p.supported} supported, {p.inconclusive} inconclusive)</dd></div>
        <div><dt>Window</dt><dd>{p.status === 'OPEN' ? lockedUntil : `closed ${formatDate(p.closed_at)}`}</dd></div>
        <div><dt>Publisher</dt><dd className="mono">{shortAddr(p.publisher)}{isPublisher ? ' (you)' : ''}</dd></div>
        {p.winner && <div><dt>Winner</dt><dd className="mono">{shortAddr(p.winner)} (challenge #{p.winning_challenge})</dd></div>}
      </dl>

      <h2>The pinned document</h2>
      <p className="hint">{p.repo} at commit <span className="mono">{p.commit_sha.slice(0, 12)}…</span>, file <span className="mono">{p.path}</span>.
        This is the exact text validators judge (first 8,000 characters). <a href={p.evidence_url} target="_blank" rel="noreferrer">Open raw</a></p>
      <DocPreview url={p.evidence_url} />

      {canChallenge && (<><h2>Challenge it</h2><ChallengeForm policy={p} onDone={reload} /></>)}
      {p.status === 'OPEN' && isPublisher && (
        <>
          <h2>Publisher actions</h2>
          <BoostForm policy={p} onDone={reload} />
          <p>
            <button disabled={busy || !canReclaim} onClick={() => run(`Reclaim policy #${p.id}`, 'reclaim', [BigInt(p.id)], 0n, reload)}>
              Reclaim bounty
            </button>
            {!lockOver && <span className="hint"> Locked: {lockedUntil}.</span>}
            {lockOver && p.queued > 0 && now < p.grace_until && <span className="hint"> Queued challenges are judged first; the wait is bounded: {timeLeft(p.grace_until, now)}.</span>}
          </p>
        </>
      )}
      {p.status === 'DISPUTED' && <p className="note good">Disputed. The bounty is credited to the winner. They withdraw it from <Link to="/me">My account</Link>.</p>}
      {p.status === 'CLOSED' && <p className="note">Closed by the publisher after the lock. Their balance is credited and withdrawable.</p>}

      <h2>Challenges</h2>
      {cq.loading && !cq.data && <Spinner label="Reading challenges" />}
      <ErrorNote message={cq.error} onRetry={cq.reload} />
      {cq.data && cq.data.items.length === 0 && <Empty>No challenges yet.</Empty>}
      <ul className="chals">{cq.data?.items.map(c => <ChallengeRow key={c.id} c={c} p={p} onChange={reload} />)}</ul>
      <p><button className="link" onClick={reload}>Refresh</button></p>
    </>
  )
}
