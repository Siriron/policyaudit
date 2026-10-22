export type PolicyStatus = 'OPEN' | 'DISPUTED' | 'CLOSED'
export type ChallengeStatus = 'QUEUED' | 'SUPPORTED' | 'DISPUTED' | 'INCONCLUSIVE' | 'VOID'

export interface Policy {
  found: boolean
  id: number
  name: string
  publisher: string
  claim: string
  repo: string
  commit_sha: string
  path: string
  evidence_url: string
  entry_fee: string
  created_at: number
  lock_until: number
  grace_until: number
  posted: string
  fees_in: string
  bounty: string
  escrow: string
  status: PolicyStatus
  challenges: number
  queued: number
  supported: number
  inconclusive: number
  winner: string
  winning_challenge: number
  closed_at: number
}

export interface Challenge {
  found: boolean
  id: number
  policy_id: number
  number: number
  challenger: string
  scenario: string
  fee: string
  submitted_at: number
  status: ChallengeStatus
  verdict: string
  note: string
  evaluated_at: number
  evaluated_by: string
}

export interface Page<T> {
  total: number
  offset: number
  items: T[]
}
