# Deployment and testing status

## Deploy the contract (StudioNet)

1. Open GenLayer Studio, deploy `contracts/policyaudit.py` (no constructor arguments).
2. Copy the deployed address into `src/config/chains.ts` (`CONTRACT_ADDRESS`, one plain constant).
3. Optionally run each write method once in Studio's Run and Debug panel to see real validator behaviour.
4. Deploy the frontend: it is a Vite SPA (`npm install && npm run build`); `vercel.json` rewrites every path to `index.html`.

StudioNet is a **temporary** test network: deployed addresses may not survive Studio resets. The repository tests are the proof of behaviour, not the address.

## Sample policies for the test guide

`docs/samples/` holds two fictional policy files. The in-app guide fetches them at a pinned commit (`SAMPLE_SHA` in `src/config/samples.ts`), exactly like a real policy.

## Running the checks

```bash
pip install "genlayer-test==0.29.2" genvm-linter
genvm-lint download --version v0.2.16
genvm-lint check contracts/policyaudit.py
genvm-lint typecheck contracts/policyaudit.py
python scripts/audit_contract.py contracts/policyaudit.py
pytest tests -q -p no:cacheprovider          # never with -s
npm install && npm run build
python scripts/check_frontend_vs_schema.py contracts/policyaudit.py src
```

The tests pin GenVM v0.2.16 (`sdk_version` in every deploy). Unpinned, `genlayer-test` resolves GitHub's latest GenVM release, which can be a release candidate whose bundle is not published.

## Testing status (what is and is not proven)

- **Run and passing here:** 133 direct-mode tests that execute the real contract under the GenVM SDK (`pytest tests`), lint, typecheck, the static audit, the frontend build, and the frontend-vs-ABI check.
- **What the tests prove:** the contract's own logic: input guards, URL derivation, every verdict value, fetch-failure handling, the validator's agreement rule (including zero tolerance and the ignored note), exact payout amounts and recipients through `withdraw`, zero-before-transfer ordering, the bounded exits, value conservation across a three-cycle flow, address-key normalization, and that no storage object crosses into the nondet closure.
- **Mutation check:** nine planted bugs (including `status_code`, a validator that ignores the verdict, transfer-before-zero, an unnormalized key, a missing grace bound) were each caught by the suite. One planted `self` use inside `leader_fn` is *not* caught by the tests; the static audit script catches it.
- **What the tests do NOT prove:** real LLM behaviour on real documents, real network behaviour (the web and the LLM are mocked), real multi-node consensus timing, or how StudioNet surfaces `AssertionError` reverts to the wallet.
- **Not verified in this build:** the contract has not been deployed; no live transaction has run. The frontend has not been exercised against a live wallet. The exact shape of a write receipt's return value on the pinned `genlayer-js` was not confirmed, so the app finds created ids by matching what the wallet just posted, rather than reading the return value. A Run and Debug pass in Studio would cover the runtime-only layer.
