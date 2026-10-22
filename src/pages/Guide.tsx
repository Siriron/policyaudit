import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getChallenge, getPending, getPolicy, isDeployed, listChallenges, listPolicies } from '../lib/gen'
import { useTx, useWallet } from '../lib/app'
import { clearLog, logAsText, readLog } from '../lib/txlog'
import type { TxLogEntry } from '../lib/txlog'
import { formatGen, sameAddr, shortAddr, timeLeft } from '../lib/format'
import { Badge, ErrorNote } from '../components/ui'
import { ChallengeForm, PostForm } from '../components/Forms'
import type { PostDefaults } from '../components/Forms'
import { SAMPLE_AD_PATH, SAMPLE_MISSING_PATH, SAMPLE_REPO, SAMPLE_RETENTION_PATH, SAMPLE_SHA } from '../config/samples'
import type { Challenge, Policy } from '../lib/types'

type Who = 'A' | 'B' | 'any'

interface Scenario {
  id: string
  title: string
  summary: string
  expected: string          // expected verdict / outcome
  expectedNote: string
  post: PostDefaults
  scenarioText: string
  kind: 'dispute' | 'supported' | 'inconclusive' | 'reclaim'
}

const base = { repo: SAMPLE_REPO, sha: SAMPLE_SHA, fee: '0.001', bounty: '0.01' }

const SCENARIOS: Scenario[] = [
  {
    id: 'dispute', kind: 'dispute', title: 'A claim the document contradicts',
    summary: 'The policy says it shares email addresses with advertisers; the publisher claims it forbids that. The challenger wins the bounty.',
    expected: 'DISPUTED', expectedNote: 'The verdict is a model judgement reproduced by the validators; this document contradicts the claim in plain words.',
    post: { ...base, name: 'Northwind data sharing', path: SAMPLE_AD_PATH, days: '7',
      claim: 'This policy forbids sharing user email addresses with advertising partners.' },
    scenarioText: 'An advertising partner receives a user’s email address and display name.',
  },
  {
    id: 'supported', kind: 'supported', title: 'A claim the document backs',
    summary: 'The retention policy really does promise deletion within 30 days. The challenge fails and its fee joins the bounty.',
    expected: 'SUPPORTED', expectedNote: 'The document states the 30-day rule explicitly.',
    post: { ...base, name: 'Northwind retention', path: SAMPLE_RETENTION_PATH, days: '7',
      claim: 'Account data is permanently deleted within 30 days of a deletion request.' },
    scenarioText: 'A user requests account deletion. Could their notes still be stored 90 days later?',
  },
  {
    id: 'inconclusive', kind: 'inconclusive', title: 'Evidence that cannot be fetched',
    summary: 'The pinned path does not exist at that commit. Validators cannot read a document, so no model runs and the fee is refunded.',
    expected: 'INCONCLUSIVE', expectedNote: 'Decided in contract code from the HTTP 404, not by a model. Deterministic.',
    post: { ...base, name: 'Northwind missing file', path: SAMPLE_MISSING_PATH, days: '7',
      claim: 'This policy forbids selling user data.' },
    scenarioText: 'A user’s data is sold to a broker.',
  },
  {
    id: 'reclaim', kind: 'reclaim', title: 'Nobody wins: reclaim after the lock (takes 7 days)',
    summary: 'A failed challenge, then the publisher takes the whole bounty back once the 7-day window ends. Start it, come back in a week.',
    expected: 'SUPPORTED, then CLOSED', expectedNote: 'The run resumes by its run ID; every step is marked done from on-chain state.',
    post: { ...base, name: 'Northwind retention (reclaim run)', path: SAMPLE_RETENTION_PATH, days: '7',
      claim: 'Invoices are kept for seven years and contain only a name and billing country.' },
    scenarioText: 'An invoice is kept for ten years and includes a home address.',
  },
]

interface Run { id: string; scenario: string; startedAt: number; policyId?: number }
const RUN_KEY = 'policyaudit:run'
const loadRun = (): Run | null => { try { const r = localStorage.getItem(RUN_KEY); return r ? JSON.parse(r) as Run : null } catch { return null } }
const saveRun = (r: Run | null) => { try { if (r) localStorage.setItem(RUN_KEY, JSON.stringify(r)); else localStorage.removeItem(RUN_KEY) } catch { /* optional */ } }
const newRunId = () => Math.random().toString(36).slice(2, 8).toUpperCase()

interface Snap { policy: Policy | null; challenge: Challenge | null; pendingB: bigint; pendingA: bigint }
const EMPTY: Snap = { policy: null, challenge: null, pendingA: 0n, pendingB: 0n }

interface Step { who: Who; title: string; detail: string; done: boolean; body: ReactNode }

export default function Guide() {
  const { account, connect } = useWallet()
  const { run: sendTx, busy } = useTx()
  const [run, setRun] = useState<Run | null>(loadRun)
  const [pick, setPick] = useState(SCENARIOS[0].id)
  const [snap, setSnap] = useState<Snap>(EMPTY)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<TxLogEntry[]>(readLog)
  const [copied, setCopied] = useState(false)

  const sc = useMemo(() => SCENARIOS.find(s => s.id === (run?.scenario ?? pick)) ?? SCENARIOS[0], [run, pick])

  const refresh = useCallback(async () => {
    if (!run || !isDeployed()) return
    setLoading(true); setErr('')
    try {
      let policy: Policy | null = null
      let policyId = run.policyId
      if (!policyId) {
        const page = await listPolicies('', '', 0, 30)
        const hit = page.items.find(p => p.claim === sc.post.claim && p.path === sc.post.path && p.repo === sc.post.repo
          && p.commit_sha === sc.post.sha && p.created_at >= Math.floor(run.startedAt / 1000) - 3600)
        if (hit) { policyId = hit.id; const next = { ...run, policyId }; setRun(next); saveRun(next) }
      }
      if (policyId) policy = await getPolicy(policyId)
      let challenge: Challenge | null = null
      if (policy?.found) {
        const page = await listChallenges(policy.id, 0, 20)
        const hit = page.items.find(c => c.scenario === sc.scenarioText)
        if (hit) challenge = await getChallenge(hit.id)
      }
      const pendingB = challenge ? await getPending(challenge.challenger) : 0n
      const pendingA = policy?.found ? await getPending(policy.publisher) : 0n
      setSnap({ policy: policy?.found ? policy : null, challenge: challenge?.found ? challenge : null, pendingA, pendingB })
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
      setLog(readLog())
    }
  }, [run, sc])

  useEffect(() => { void refresh() }, [refresh])

  const startRun = () => {
    const r: Run = { id: newRunId(), scenario: pick, startedAt: Date.now() }
    setRun(r); saveRun(r); setSnap(EMPTY)
  }
  const endRun = () => { setRun(null); saveRun(null); setSnap(EMPTY) }
  const clearAll = () => { endRun(); clearLog(); setLog([]) }
  const resume = (id: string) => {
    const r = loadRun()
    if (r && r.id === id.trim().toUpperCase()) { setRun(r); setPick(r.scenario) }
    else setErr('That run ID is not stored in this browser.')
  }

  const { policy, challenge } = snap
  const a = policy?.publisher ?? ''
  const b = challenge?.challenger ?? ''
  const afterRefresh = () => { void refresh() }
  const needsSha = SAMPLE_SHA === ''

  const steps: Step[] = run ? buildSteps() : []
  function buildSteps(): Step[] {
    const out: Step[] = []
    out.push({
      who: 'A', title: 'Post the policy and lock the bounty', done: !!policy,
      detail: 'The form is pre-filled. Wallet A is the publisher.',
      body: <PostForm key={`post-${run?.id}`} initial={sc.post} onCreated={afterRefresh} />,
    })
    out.push({
      who: 'B', title: 'Submit a challenge from a different wallet', done: !!challenge,
      detail: 'Switch your wallet to a second account (B). The contract refuses the publisher.',
      body: policy
        ? <ChallengeForm key={`ch-${run?.id}`} policy={policy} initial={sc.scenarioText} onDone={afterRefresh} />
        : <p className="muted">Waiting for step 1 to appear on-chain.</p>,
    })
    out.push({
      who: 'any', title: 'Evaluate the challenge', done: !!challenge && challenge.status !== 'QUEUED',
      detail: 'Any wallet can press this. Every validator fetches the pinned file and judges it; this can take several minutes.',
      body: challenge
        ? (challenge.status === 'QUEUED'
          ? <button className="primary" disabled={busy || !account} onClick={() => sendTx(`Evaluate challenge #${challenge.id}`, 'evaluate', [BigInt(challenge.id)], 0n, afterRefresh)}>Evaluate challenge #{challenge.id}</button>
          : <p>Verdict: <Badge kind={challenge.status}>{challenge.status}</Badge> — expected <b>{sc.expected.split(',')[0]}</b>. {challenge.verdict === sc.expected.split(',')[0] ? 'Matches.' : 'Differs from the expected outcome; the model judged otherwise. That is real behaviour worth noting.'}</p>)
        : <p className="muted">Waiting for step 2 to appear on-chain.</p>,
    })
    if (sc.kind === 'dispute' || sc.kind === 'inconclusive') {
      const who: Who = 'B'
      out.push({
        who, title: sc.kind === 'dispute' ? 'Challenger withdraws the bounty' : 'Challenger withdraws the refunded fee',
        detail: 'Balances are credited first; withdrawing zeroes the balance, then transfers. The transfer lands at finalization.',
        done: !!challenge && (challenge.status === 'DISPUTED' || challenge.status === 'INCONCLUSIVE') && snap.pendingB === 0n,
        body: challenge && snap.pendingB > 0n
          ? <><p>Wallet B can withdraw {formatGen(snap.pendingB)}.</p><button className="primary" disabled={busy || !sameAddr(account, b)} onClick={() => sendTx('Withdraw balance', 'withdraw', [], 0n, afterRefresh)}>Withdraw {formatGen(snap.pendingB)}</button></>
          : <p className="muted">{challenge && challenge.status !== 'QUEUED' ? 'Nothing left to withdraw.' : 'Available after step 3.'}</p>,
      })
    }
    if (sc.kind === 'supported') {
      out.push({
        who: 'any', title: 'Check the fee joined the bounty', detail: 'A failed challenge adds its fee to the bounty the publisher can reclaim.',
        done: !!challenge && challenge.status === 'SUPPORTED' && !!policy && BigInt(policy.fees_in) > 0n,
        body: policy ? <p>Bounty is now {formatGen(policy.bounty)} ({formatGen(policy.fees_in)} from challenge fees).</p> : <p className="muted">After step 3.</p>,
      })
    }
    if (sc.kind === 'reclaim') {
      out.push({
        who: 'A', title: 'Wait for the lock to end, then reclaim', detail: 'Reclaim is refused until the window ends.',
        done: policy?.status === 'CLOSED',
        body: policy && challenge && challenge.status === 'SUPPORTED'
          ? (<><p>{timeLeft(policy.lock_until)}</p>
            <button className="primary" disabled={busy || !sameAddr(account, a) || Date.now() / 1000 < policy.lock_until}
              onClick={() => sendTx(`Reclaim policy #${policy.id}`, 'reclaim', [BigInt(policy.id)], 0n, afterRefresh)}>Reclaim bounty</button></>)
          : <p className="muted">After step 3 returns SUPPORTED.</p>,
      })
      out.push({
        who: 'A', title: 'Publisher withdraws', detail: 'Credited balance goes out to the publisher.',
        done: policy?.status === 'CLOSED' && snap.pendingA === 0n,
        body: policy?.status === 'CLOSED' && snap.pendingA > 0n
          ? <button className="primary" disabled={busy || !sameAddr(account, a)} onClick={() => sendTx('Withdraw balance', 'withdraw', [], 0n, afterRefresh)}>Withdraw {formatGen(snap.pendingA)}</button>
          : <p className="muted">After reclaim.</p>,
      })
    }
    return out
  }

  const firstOpen = steps.findIndex(s => !s.done)
  const text = logAsText(log)

  return (
    <>
      <h1>Test guide</h1>
      <p>Run a whole scenario end to end with two wallets. Each step turns done only when the contract’s on-chain state shows its result.</p>
      {needsSha && <p className="note warn">The sample commit is not configured, so scenario forms open without a pinned commit. Set <code>SAMPLE_SHA</code> in <code>src/config/samples.ts</code>.</p>}
      {!account && <p><button className="primary" onClick={connect}>Connect wallet</button></p>}

      {!run ? (
        <section className="panel">
          <label>Scenario
            <select value={pick} onChange={e => setPick(e.target.value)}>
              {SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <p>{sc.summary}</p>
          <p><b>Expected:</b> {sc.expected}. <span className="muted">{sc.expectedNote}</span></p>
          <div className="row">
            <button className="primary" onClick={startRun}>Start new run</button>
            <ResumeBox onResume={resume} />
          </div>
        </section>
      ) : (
        <section className="panel">
          <p><b>{sc.title}</b> · run <span className="mono">{run.id}</span> <span className="muted">(keep this ID to resume in this browser)</span></p>
          <p>{sc.summary}</p>
          <p><b>Expected:</b> {sc.expected}. <span className="muted">{sc.expectedNote}</span></p>
          <p className="muted">Wallet A = publisher{a ? ` ${shortAddr(a)}` : ''} · Wallet B = challenger{b ? ` ${shortAddr(b)}` : ' (any account except A)'} · connected: {account ? shortAddr(account) : 'none'}</p>
          <div className="row">
            <button onClick={() => void refresh()} disabled={loading}>{loading ? 'Reading…' : 'Refresh'}</button>
            <button onClick={endRun}>New run</button>
            <button onClick={clearAll}>Clear everything</button>
          </div>
        </section>
      )}
      <ErrorNote message={err} onRetry={() => void refresh()} />

      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'done' : i === firstOpen ? 'now' : ''}>
            <div className="stephead">
              <span className="tick">{s.done ? '✓' : i + 1}</span>
              <strong>{s.title}</strong>
              <span className="who">{s.who === 'any' ? 'any wallet' : `wallet ${s.who}`}</span>
            </div>
            <p className="muted">{s.detail}</p>
            {(i === firstOpen || s.done) && <div className="stepbody">{s.body}</div>}
          </li>
        ))}
      </ol>

      <h2>Transaction log</h2>
      <p className="hint">Action, network status, execution result and hash for every write sent from this browser.</p>
      <pre className="doc" tabIndex={0}>{text || 'No transactions yet.'}</pre>
      <p>
        <button disabled={!text} onClick={() => { void navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied' : 'Copy log'}</button>{' '}
        <button onClick={() => setLog(readLog())}>Reload log</button>
      </p>
      <p className="hint">Anything unclear? <Link to="/docs">Read how it works</Link>.</p>
    </>
  )
}

function ResumeBox({ onResume }: { onResume: (id: string) => void }) {
  const [id, setId] = useState('')
  return (
    <form className="form inline" onSubmit={e => { e.preventDefault(); onResume(id) }}>
      <label>Resume a run<input value={id} onChange={e => setId(e.target.value)} placeholder="Run ID" maxLength={12} /></label>
      <button type="submit" disabled={!id.trim()}>Resume</button>
    </form>
  )
}
