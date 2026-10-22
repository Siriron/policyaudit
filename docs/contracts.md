# Contract reference: `contracts/policyaudit.py`

StudioNet, stable v0.2 API, runner `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`. Writes and views return JSON strings.

| Method | Kind | Arguments | Guards / effect |
|---|---|---|---|
| `post` | write, payable | name, claim, repo, commit_sha, path, entry_fee (wei), lock_days | valid `owner/name`; full 40-char lowercase commit id; safe path; entry fee > 0; lock 7-90 days; value > 0; no secret-looking text. Returns `policy_id` |
| `boost` | write, payable | policy_id | publisher only; policy OPEN; value > 0 |
| `challenge` | write, payable | policy_id, scenario | policy OPEN; caller is not the publisher; before `lock_until`; value == entry fee; scenario 1-1000 chars. Returns `challenge_id` |
| `evaluate` | write | challenge_id | challenge QUEUED, policy OPEN; runs the nondet block; credits balances |
| `refund_queued` | write | challenge_id | challenge QUEUED, policy not OPEN; credits the challenger |
| `reclaim` | write | policy_id | publisher only; OPEN; `now >= lock_until`; queue empty or `now >= lock_until + 7 days` |
| `withdraw` | write | none | balance > 0; zero, then transfer |
| `get_policy`, `get_challenge` | view | id | record, or `{"found": false}` |
| `list_policies` | view | status, publisher, offset, limit | newest first; status `''` = all; publisher filter is case-insensitive |
| `list_challenges` | view | policy_id, offset, limit | newest first |
| `get_pending_balance` | view | address | withdrawable wei (string) |

Amounts are returned as decimal strings (wei); timestamps as Unix seconds.

## Validator rule

```
leader_fn:     fetch pinned file; if fetch fails -> {"verdict": "INCONCLUSIVE", "note": <marker>}
               else judge -> {"verdict": SUPPORTED|DISPUTED|INCONCLUSIVE, "note": <sentence>}
validator_fn:  leader must be a Return with a dict whose verdict is valid;
               validator re-runs leader_fn itself; agree iff the verdicts are exactly equal
```

The note is explicitly not compared. Fields returned by `leader_fn` are stable across requests (a three-value enum and display text).

## Known limits

- A publisher can delete the repository; affected challenges become INCONCLUSIVE and are refunded.
- Only the first 8,000 characters of a document are judged.
- A reproduced verdict means the committee agreed, not that it is correct.
- `assert` guards are used (live-verified on StudioNet in earlier builds); they surface as AssertionError in tests.
