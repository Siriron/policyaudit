# Architecture

## Boundary

user action -> evidence source -> nondeterministic call -> equivalence rule -> state update -> user-visible settlement

1. A publisher posts a claim about one file in a public GitHub repository, pinned to a full commit id, and locks a bounty.
2. A challenger pays the entry fee and submits a scenario (a concrete situation where the claim does not hold).
3. `evaluate()` runs one nondeterministic block: every validator fetches the pinned file and judges the scenario against the claim.
4. The validator rule is a hand-written comparison with **zero tolerance on the verdict**. The leader's note is display text and is never compared.
5. The contract records the verdict and **credits** internal balances. It never transfers during `evaluate()`.
6. Value only leaves through `withdraw()`, which zeroes the caller's balance first, then calls `emit_transfer`.

## Who owns what

- **Frontend:** wallet connection, forms that mirror the contract's input rules, read views, the transaction lifecycle display, the in-app test guide. It never decides a verdict or a payout.
- **Contract:** input validation, URL derivation, the nondeterministic judgement, the settlement table, the exit paths, all balances.
- **External sources:** the policy text (GitHub raw content at a pinned commit). Validators re-fetch it themselves.

## Evidence source

| Host | URL pattern | Fetch method | Deciding field |
|---|---|---|---|
| raw.githubusercontent.com | `https://raw.githubusercontent.com/<owner>/<name>/<40-hex commit>/<path>`, built by the contract from three validated identifiers | `gl.nondet.web.get` | the file text (first 8,000 characters) |

No caller supplies a URL. A full commit id pins the bytes, so the publisher cannot edit the document after posting and the challenger can read exactly what will be judged.
Non-200 responses, empty or very short bodies, and unreachable hosts become `INCONCLUSIVE` in code, before any model runs.

## Who benefits from a false verdict

A challenger benefits from a false `DISPUTED` (takes the bounty). The publisher benefits from a false `SUPPORTED` (keeps it). That is the reason the verdict needs independent validators rather than one model call.

## State machine

```
Policy:     OPEN --(DISPUTED verdict)--> DISPUTED      (winner credited, terminal)
            OPEN --(reclaim after lock)--> CLOSED      (publisher credited, terminal)
Challenge:  QUEUED --evaluate--> SUPPORTED | DISPUTED | INCONCLUSIVE
            QUEUED --refund_queued (policy no longer OPEN)--> VOID
```

Every verdict value and the branch that can produce it:

| Value | Produced by |
|---|---|
| SUPPORTED | judge answers SUPPORTED |
| DISPUTED | judge answers DISPUTED |
| INCONCLUSIVE | fetch failure / non-200 / short body (code), or judge answers INCONCLUSIVE |
| VOID (challenge status) | `refund_queued()` only |

## Money

| Event | Effect |
|---|---|
| `post` | bounty held by the contract |
| `challenge` | fee held in escrow |
| `evaluate` -> DISPUTED | challenger credited bounty + accumulated fees + own fee; policy DISPUTED |
| `evaluate` -> SUPPORTED | fee joins the bounty |
| `evaluate` -> INCONCLUSIVE | fee credited back to the challenger |
| `reclaim` (after lock) | publisher credited bounty + accumulated fees. Waits for queued challenges only until `lock + 7 days` |
| `refund_queued` | any caller; credits the *challenger*, voids the challenge |
| `withdraw` | zero balance, persist, then `emit_transfer` |

Every locked amount has a bounded exit. Address-keyed maps use one normalization (lowercase) at every write and read.
