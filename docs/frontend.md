# Frontend

React + Vite + TypeScript, `genlayer-js` ^1.1.7 (installed 1.1.8). Routes: `/` policies, `/new` post, `/p/:id` policy, `/me` balance, `/guide` test guide, `/docs` in-app docs, `*` styled 404. A top-level error boundary replaces blank crashes.

## SDK rules followed

- Chain from `genlayer-js/chains` (`studionet`); types from `genlayer-js/types`.
- Write client `account` is the plain wallet address string (never `createAccount(address)`), `provider: window.ethereum`.
- `ensureChain()` runs before every write; `writeContract` always passes `value` (`0n` when unused).
- Reads parse the returned JSON string. Receipts are awaited with `{ retries: 120, interval: 4000 }`, with a distinct timeout state that carries the hash and an explorer link.
- Wallet persistence uses `eth_accounts` plus `accountsChanged`.
- The contract address is one plain constant in `src/config/chains.ts`; there is no `.env`.

## Transaction states

`signing` -> `pending` (consensus, can take minutes) -> `provisional` (ACCEPTED with execution result `FINISHED_WITH_RETURN`; shown as appealable) -> `finalized`. Execution errors, `CANCELED`, `UNDETERMINED`, `LEADER_TIMEOUT`, `VALIDATORS_TIMEOUT`, timeouts, wallet rejection and 429 rate limits each have their own state and message. The receipt fields used (`statusName`, `txExecutionResultName`, `consensus_data.leader_receipt[0].error`) exist on the installed 1.1.8 types.

## Rate limits

StudioNet allows 60 requests/min per IP. Reads happen on load and on explicit Refresh (no timers); one write is in flight at a time; receipts are polled only for the user's own pending transaction, and finalization is polled every 15 s.

## Created ids

After a provisional `post` or `challenge`, the app reads back the newest record matching what the connected wallet just submitted (publisher/challenger plus repo, commit, path and claim or scenario text). It does not infer ids from a global counter.

## Test guide (`/guide`)

Four scenarios (contradicted claim, backed claim, unreachable evidence, reclaim after the lock), each with its expected outcome, steps labelled by acting wallet, pre-filled forms, steps that turn done only from on-chain state, a resumable run id, refresh / new run / clear controls, and a copyable transaction log (action, status, execution result, hash). The sample documents are fetched from this repository at a pinned commit.
