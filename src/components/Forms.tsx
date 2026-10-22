import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTx, useWallet } from '../lib/app'
import { listChallenges, listPolicies } from '../lib/gen'
import { formatGen, parseGen } from '../lib/format'
import { LIMITS, looksLikeSecret, rawUrl, validPath, validRepo, validSha } from '../lib/validate'
import { ErrorNote } from './ui'
import type { Policy } from '../lib/types'

export interface PostDefaults {
  name: string; claim: string; repo: string; sha: string; path: string; fee: string; days: string; bounty: string
}
export const EMPTY_POST: PostDefaults = {
  name: '', claim: '', repo: '', sha: '', path: '', fee: '0.001', days: '7', bounty: '0.01',
}

export function PostForm({ initial = EMPTY_POST, onCreated }: { initial?: PostDefaults; onCreated?: (p: Policy | null) => void }) {
  const { account, connect } = useWallet()
  const { run, busy } = useTx()
  const [f, setF] = useState(initial)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<Policy | null | undefined>(undefined)
  const set = (k: keyof PostDefaults) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    setErr('')
    const bounty = parseGen(f.bounty), fee = parseGen(f.fee)
    const days = Number(f.days)
    if (!f.name.trim() || f.name.length > LIMITS.name) return setErr(`Name is required (max ${LIMITS.name} characters).`)
    if (!f.claim.trim() || f.claim.length > LIMITS.claim) return setErr(`Claim is required (max ${LIMITS.claim} characters).`)
    if (!validRepo(f.repo)) return setErr('Repository must look like owner/name.')
    if (!validSha(f.sha)) return setErr('Commit must be the full 40-character lowercase hex id. Branch names and short ids are refused: only a full commit pins the bytes.')
    if (!validPath(f.path)) return setErr('Path is not a valid repository file path.')
    if (looksLikeSecret(`${f.name} ${f.claim} ${f.path}`)) return setErr('That looks like a real secret. Everything here is public.')
    if (!fee || fee <= 0n) return setErr('Entry fee must be above zero.')
    if (!bounty || bounty <= 0n) return setErr('Bounty must be above zero.')
    if (!Number.isInteger(days) || days < LIMITS.minLock || days > LIMITS.maxLock) return setErr(`Lock must be ${LIMITS.minLock} to ${LIMITS.maxLock} days.`)
    const r = await run('Post policy', 'post',
      [f.name.trim(), f.claim.trim(), f.repo, f.sha, f.path, fee, BigInt(days)], bounty, async () => {
        // The new id is read back by matching what this wallet just posted, never from a global counter.
        try {
          const page = await listPolicies('', account ?? '', 0, 10)
          const hit = page.items.find(p => p.repo === f.repo && p.commit_sha === f.sha && p.path === f.path && p.claim === f.claim.trim()) ?? null
          setCreated(hit)
          onCreated?.(hit)
        } catch { setCreated(null) }
      })
    if (r.phase !== 'provisional') setErr(r.message ?? '')
  }

  const url = validRepo(f.repo) && validSha(f.sha) && validPath(f.path) ? rawUrl(f.repo, f.sha, f.path) : ''
  return (
    <form className="form" onSubmit={e => { e.preventDefault(); void submit() }}>
      <label>Policy name<input value={f.name} onChange={set('name')} maxLength={LIMITS.name} placeholder="Acme data-sharing policy" /></label>
      <label>Claim about this policy<textarea value={f.claim} onChange={set('claim')} maxLength={LIMITS.claim} rows={3}
        placeholder="This policy forbids sharing user email addresses with advertisers." /></label>
      <div className="row">
        <label>Repository<input value={f.repo} onChange={set('repo')} placeholder="owner/name" autoCapitalize="none" /></label>
        <label>File path<input value={f.path} onChange={set('path')} placeholder="docs/POLICY.md" autoCapitalize="none" /></label>
      </div>
      <label>Commit (full 40-character id)<input value={f.sha} onChange={set('sha')} placeholder="0123456789abcdef0123456789abcdef01234567" autoCapitalize="none" spellCheck={false} /></label>
      {url && <p className="hint">Validators will read exactly this file: <a href={url} target="_blank" rel="noreferrer">{url}</a>. A commit id pins the bytes, so you cannot edit it after posting.</p>}
      <div className="row three">
        <label>Bounty (GEN)<input inputMode="decimal" value={f.bounty} onChange={set('bounty')} /></label>
        <label>Entry fee per challenge (GEN)<input inputMode="decimal" value={f.fee} onChange={set('fee')} /></label>
        <label>Lock (days, 7–90)<input inputMode="numeric" value={f.days} onChange={set('days')} /></label>
      </div>
      <ErrorNote message={err} />
      {account
        ? <button className="primary" disabled={busy} type="submit">{busy ? 'Working…' : `Post and lock ${f.bounty || '0'} GEN`}</button>
        : <button className="primary" type="button" onClick={connect}>Connect wallet to post</button>}
      {created && <p className="ok">Posted as policy #{created.id}. <Link to={`/p/${created.id}`}>Open it</Link></p>}
      {created === null && <p className="hint">Posted. Open <Link to="/me">My account</Link> to find it.</p>}
    </form>
  )
}

export function ChallengeForm({ policy, initial = '', onDone }: { policy: Policy; initial?: string; onDone?: () => void }) {
  const { account, connect } = useWallet()
  const { run, busy } = useTx()
  const [scenario, setScenario] = useState(initial)
  const [err, setErr] = useState('')
  const [made, setMade] = useState<number | null | undefined>(undefined)

  async function submit() {
    setErr('')
    const s = scenario.trim()
    if (!s || s.length > LIMITS.scenario) return setErr(`Scenario is required (max ${LIMITS.scenario} characters).`)
    if (looksLikeSecret(s)) return setErr('That looks like a real secret. Everything here is public.')
    const r = await run(`Challenge policy #${policy.id}`, 'challenge', [BigInt(policy.id), s], BigInt(policy.entry_fee), async () => {
      try {
        const page = await listChallenges(policy.id, 0, 20)
        const hit = page.items.find(c => c.challenger === account && c.scenario === s)
        setMade(hit ? hit.id : null)
      } catch { setMade(null) }
      onDone?.()
    })
    if (r.phase !== 'provisional') setErr(r.message ?? '')
  }
  return (
    <form className="form" onSubmit={e => { e.preventDefault(); void submit() }}>
      <label>Scenario: a concrete situation where the claim does not hold
        <textarea value={scenario} onChange={e => setScenario(e.target.value)} maxLength={LIMITS.scenario} rows={4}
          placeholder="A user's email address is sent to an advertising partner." /></label>
      <p className="hint">Entry fee {formatGen(policy.entry_fee)}. A reproduced DISPUTED verdict pays you the whole bounty and returns your fee; SUPPORTED adds your fee to the bounty; INCONCLUSIVE refunds it.</p>
      <ErrorNote message={err} />
      {account
        ? <button className="primary" disabled={busy} type="submit">{busy ? 'Working…' : `Submit challenge (${formatGen(policy.entry_fee)})`}</button>
        : <button className="primary" type="button" onClick={connect}>Connect wallet to challenge</button>}
      {made != null && <p className="ok">Challenge #{made} is queued. Anyone can now press Evaluate on it.</p>}
    </form>
  )
}

export function BoostForm({ policy, onDone }: { policy: Policy; onDone?: () => void }) {
  const { run, busy } = useTx()
  const [amount, setAmount] = useState('0.01')
  const [err, setErr] = useState('')
  async function submit() {
    const wei = parseGen(amount)
    if (!wei || wei <= 0n) return setErr('Enter an amount above zero.')
    setErr('')
    const r = await run(`Boost policy #${policy.id}`, 'boost', [BigInt(policy.id)], wei, () => onDone?.())
    if (r.phase !== 'provisional') setErr(r.message ?? '')
  }
  return (
    <form className="form inline" onSubmit={e => { e.preventDefault(); void submit() }}>
      <label>Add to bounty (GEN)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <button disabled={busy} type="submit">Boost</button>
      <ErrorNote message={err} />
    </form>
  )
}
