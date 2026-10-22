import { createClient } from 'genlayer-js'
import { TransactionStatus } from 'genlayer-js/types'
import type { GenLayerTransaction } from 'genlayer-js/types'
import { CHAIN, CHAIN_ID_HEX, CONTRACT_ADDRESS, EXPLORER_URL, RPC_URL, explorerTx } from '../config/chains'
import type { Challenge, Page, Policy } from './types'

type Addr = `0x${string}`

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, listener: (...args: unknown[]) => void) => void
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
    }
  }
}

export const isDeployed = () => CONTRACT_ADDRESS !== ''

// ---------------------------------------------------------------- errors
export class RateLimitError extends Error {
  constructor() {
    super('StudioNet is rate-limiting requests (60 per minute per IP). Wait a minute and retry.')
  }
}

export class TxTimeoutError extends Error {
  txHash: string
  constructor(hash: string) {
    super(`Consensus is taking longer than expected. Your transaction was submitted; check it directly: ${explorerTx(hash)}`)
    this.txHash = hash
  }
}

export class TxFailedError extends Error {
  txHash: string
  constructor(message: string, hash: string) {
    super(message)
    this.txHash = hash
  }
}

function asGenError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (/429|-32429|rate.?limit|too many requests/i.test(msg)) return new RateLimitError()
  return err instanceof Error ? err : new Error(msg)
}

// ---------------------------------------------------------------- reads
// Every call site names its contract method literally so scripts/check_frontend_vs_schema.py can check it against the real ABI.
type Client = ReturnType<typeof createClient>
type CallArg = string | bigint
const readClient = createClient({ chain: CHAIN })
const addr = () => CONTRACT_ADDRESS as Addr

async function guarded<T>(call: () => Promise<unknown>): Promise<T> {
  if (!isDeployed()) throw new Error('The contract is not deployed yet. Set CONTRACT_ADDRESS in src/config/chains.ts.')
  try {
    return JSON.parse(String(await call())) as T
  } catch (err) {
    throw asGenError(err)
  }
}

export const getPolicy = (id: number) =>
  guarded<Policy>(() => readClient.readContract({ address: addr(), functionName: 'get_policy', args: [BigInt(id)] }))
export const getChallenge = (id: number) =>
  guarded<Challenge>(() => readClient.readContract({ address: addr(), functionName: 'get_challenge', args: [BigInt(id)] }))
export const listPolicies = (status = '', publisher = '', offset = 0, limit = 20) =>
  guarded<Page<Policy>>(() => readClient.readContract({
    address: addr(), functionName: 'list_policies', args: [status, publisher, BigInt(offset), BigInt(limit)],
  }))
export const listChallenges = (policyId: number, offset = 0, limit = 50) =>
  guarded<Page<Challenge>>(() => readClient.readContract({
    address: addr(), functionName: 'list_challenges', args: [BigInt(policyId), BigInt(offset), BigInt(limit)],
  }))
export const getPending = async (address: string) =>
  BigInt((await guarded<{ pending: string }>(() => readClient.readContract({
    address: addr(), functionName: 'get_pending_balance', args: [address],
  }))).pending)

/** One entry per write method, each with a literal functionName. */
export const WRITE_CALLS = {
  post: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'post', args, value }),
  boost: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'boost', args, value }),
  challenge: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'challenge', args, value }),
  evaluate: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'evaluate', args, value }),
  refund_queued: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'refund_queued', args, value }),
  reclaim: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'reclaim', args, value }),
  withdraw: (c: Client, args: CallArg[], value: bigint) => c.writeContract({ address: addr(), functionName: 'withdraw', args, value }),
}
export type WriteName = keyof typeof WRITE_CALLS

// ---------------------------------------------------------------- wallet
export async function ensureChain(): Promise<void> {
  const eth = window.ethereum
  if (!eth) throw new Error('No wallet found. Install MetaMask or another EIP-1193 wallet.')
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
  } catch (err) {
    const code = (err as { code?: number }).code
    if (code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: 'GenLayer StudioNet',
          rpcUrls: [RPC_URL],
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          blockExplorerUrls: [EXPLORER_URL],
        }],
      })
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID_HEX }] })
    } else if (code === -32002) {
      await new Promise(r => setTimeout(r, 3000))
    } else {
      throw err
    }
  }
}

// ---------------------------------------------------------------- writes
export type TxPhase =
  | 'idle'
  | 'signing'      // waiting for the wallet
  | 'pending'      // submitted; validators are reaching consensus (can take several minutes)
  | 'provisional'  // ACCEPTED with a return value: appealable, not final
  | 'finalized'
  | 'failed'       // accepted/decided but the execution result is an error, or CANCELED
  | 'undetermined' // UNDETERMINED / LEADER_TIMEOUT / VALIDATORS_TIMEOUT
  | 'timeout'      // we stopped waiting; the transaction may still succeed
  | 'ratelimited'
  | 'rejected'     // the user closed the wallet prompt

export interface TxReport {
  phase: TxPhase
  hash?: string
  status?: string          // network status name, e.g. ACCEPTED
  execution?: string       // execution result name, e.g. FINISHED_WITH_RETURN
  message?: string
  receipt?: GenLayerTransaction
}

const FAILED_STATES = new Set(['UNDETERMINED', 'LEADER_TIMEOUT', 'VALIDATORS_TIMEOUT'])

/** Read the status/result fields the pinned genlayer-js (1.1.x) actually carries on a receipt. */
export function describeReceipt(r: GenLayerTransaction): { status: string; execution: string; error: string } {
  const status = String(r.statusName ?? r.status ?? '')
  const execution = String(r.txExecutionResultName ?? '')
  const leader = r.consensus_data?.leader_receipt?.[0]
  const error = leader?.error ? String(leader.error) : ''
  return { status, execution, error }
}

export async function sendWrite(
  account: string,
  functionName: WriteName,
  args: CallArg[],
  value: bigint,
  report: (r: TxReport) => void,
): Promise<TxReport> {
  if (!isDeployed()) throw new Error('The contract is not deployed yet. Set CONTRACT_ADDRESS in src/config/chains.ts.')
  report({ phase: 'signing' })
  let hash: string
  try {
    await ensureChain()
    const client = createClient({ chain: CHAIN, account: account as Addr, provider: window.ethereum as never })
    if (typeof (client as { connect?: unknown }).connect === 'function') {
      try { await client.connect('studionet') } catch { /* optional on this SDK build */ }
    }
    hash = String(await WRITE_CALLS[functionName](client, args, value))
  } catch (err) {
    const code = (err as { code?: number }).code
    const msg = err instanceof Error ? err.message : String(err)
    if (code === 4001 || /user (rejected|denied)/i.test(msg)) {
      const out: TxReport = { phase: 'rejected', message: 'You closed the wallet prompt.' }
      report(out)
      return out
    }
    const e = asGenError(err)
    const out: TxReport = { phase: e instanceof RateLimitError ? 'ratelimited' : 'failed', message: e.message }
    report(out)
    return out
  }

  report({ phase: 'pending', hash })
  const poll = createClient({ chain: CHAIN })
  let accepted: GenLayerTransaction
  try {
    accepted = await poll.waitForTransactionReceipt({
      hash: hash as never,
      status: TransactionStatus.ACCEPTED,
      retries: 120,
      interval: 4000,
    })
  } catch (err) {
    const e = asGenError(err)
    const out: TxReport = e instanceof RateLimitError
      ? { phase: 'ratelimited', hash, message: e.message }
      : { phase: 'timeout', hash, message: new TxTimeoutError(hash).message }
    report(out)
    return out
  }

  const d = describeReceipt(accepted)
  if (FAILED_STATES.has(d.status)) {
    const out: TxReport = { phase: 'undetermined', hash, status: d.status, execution: d.execution, receipt: accepted,
      message: `Consensus ended as ${d.status}. Nothing was written; you can retry.` }
    report(out)
    return out
  }
  if (d.status === 'CANCELED' || d.execution === 'FINISHED_WITH_ERROR') {
    const out: TxReport = { phase: 'failed', hash, status: d.status, execution: d.execution, receipt: accepted,
      message: d.error || 'The contract rejected this call (execution finished with an error). Nothing was written.' }
    report(out)
    return out
  }
  // ACCEPTED is not final: show it as provisional and appealable until the network says FINALIZED.
  const provisional: TxReport = { phase: 'provisional', hash, status: d.status, execution: d.execution, receipt: accepted }
  report(provisional)
  return provisional
}

/** Poll (slowly, 15 s) until FINALIZED; resolves null if it is not final within the window. */
export async function waitFinalized(hash: string, windowMs = 10 * 60 * 1000): Promise<GenLayerTransaction | null> {
  const poll = createClient({ chain: CHAIN })
  try {
    return await poll.waitForTransactionReceipt({
      hash: hash as never,
      status: TransactionStatus.FINALIZED,
      retries: Math.ceil(windowMs / 15000),
      interval: 15000,
    })
  } catch {
    return null
  }
}
