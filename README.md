<div align="center">

<img src="./public/favicon.svg" width="88" alt="PolicyAudit logo" />

# PolicyAudit

### Bounties for finding where a published policy does not say what its publisher claims, judged by GenLayer validator consensus.

<br />

![CI](https://github.com/Siriron/policyaudit/actions/workflows/ci.yml/badge.svg)
![Status](https://img.shields.io/badge/status-live-brightgreen?style=flat-square)
![Network](https://img.shields.io/badge/network-StudioNet-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20Vite%20%2B%20GenVM-0e7490?style=flat-square)

<br />

**[Live App](https://policyaudit-xyz.vercel.app/)** &nbsp;·&nbsp; **[Documentation](./docs/architecture.md)** &nbsp;·&nbsp; **[Smart Contract](./contracts/policyaudit.py)**

</div>

<br />

---

## What this is

A publisher states a claim about one policy file, such as "this policy forbids sharing user email addresses with advertisers", and locks a bounty behind it. Anyone can pay a small entry fee and describe a concrete scenario where the claim does not hold. GenLayer validators each fetch the exact, pinned document and judge the scenario independently; when the committee reproduces a contradiction, the challenger takes the bounty.

<br />

<div align="center">

| | |
|---|---|
| **Concept** | Bounty arbitration over a pinned policy document |
| **Consensus need** | A challenger profits from a false `DISPUTED`; the publisher profits from a false `SUPPORTED` |
| **Evidence source** | One file in a public GitHub repo, pinned to a full commit id; the contract builds the URL, nobody supplies one |
| **Network** | StudioNet (temporary test network; see Status) |

</div>

<br />

---

## How it works

**Boundary.** Publisher posts a claim and a pinned file -> challenger submits a scenario -> every validator fetches the pinned file and judges it -> custom validator rule with zero tolerance on the verdict -> verdict recorded and balances credited -> winner or refunded party pulls the money with `withdraw()`.

- **Frontend owns:** wallet connection, forms that mirror the contract's input rules, read views, the transaction lifecycle display, the in-app test guide at `/guide`
- **Contract owns:** input validation, URL derivation, the judgement, the settlement table, every balance, the exit paths
- **External sources own:** the policy text; validators re-fetch it themselves

**Evidence sources** (one row per source; if you cannot fill the last column, the source cannot settle the claim):

| Host | URL pattern | Fetch method | Deciding field |
|---|---|---|---|
| raw.githubusercontent.com | `/<owner>/<name>/<40-hex commit>/<path>`, derived from three validated identifiers, never a submitted URL | `web.get` | the file text (first 8,000 characters) |

1. `post`: publisher locks the bounty with a claim, the pinned file, an entry fee and a 7-90 day window
2. `challenge`: another wallet sends exactly the entry fee with a scenario while the window is open
3. `evaluate`: anyone triggers validator consensus. `DISPUTED` credits the challenger with the whole bounty plus their fee; `SUPPORTED` adds the fee to the bounty; `INCONCLUSIVE` refunds it
4. `reclaim`: after the window the publisher takes the bounty back; queued challenges are judged first, but only for a bounded 7-day grace period
5. `withdraw`: balance is zeroed and persisted, then transferred

<br />

<details>
<summary><b>The three-way verdict</b></summary>
<br />

`INCONCLUSIVE` exists so that missing or unreadable evidence never punishes either side. An unreachable file, a non-200 response, or an empty document resolves `INCONCLUSIVE` in contract code, before any model runs, and the challenger's fee is refunded. Each verdict value and the branch that can produce it is listed in [`docs/architecture.md`](./docs/architecture.md).

</details>

<br />

---

## Deployed contracts

<div align="center">

| Network | Address | Explorer |
|---|---|---|
| StudioNet | `0x8bAAC1F6A9889a723f9e87DB3028eaC60Ed9131a` | [View](https://explorer-studio.genlayer.com/address/0x8bAAC1F6A9889a723f9e87DB3028eaC60Ed9131a) |

The frontend is deployed at https://policyaudit-xyz.vercel.app/. StudioNet is a temporary test network: deployed addresses may not survive resets. The repository tests below are the proof of behavior, not the address.

</div>

<br />

---

## Quick start

```bash
npm install
npm run dev
```

Run the contract tests (they execute the real contract under the GenVM SDK in direct mode):

```bash
pip install "genlayer-test==0.29.2" genvm-linter
genvm-lint download --version v0.2.16
genvm-lint check contracts/policyaudit.py
python scripts/audit_contract.py contracts/policyaudit.py
pytest tests -q -p no:cacheprovider
```

The tests pin GenVM v0.2.16 (`sdk_version` in every deploy). Unpinned, `genlayer-test` resolves GitHub's latest GenVM release, which can be a release candidate whose bundle is not published.

Full deployment instructions: [`docs/deployment.md`](./docs/deployment.md)

<br />

---

## Project structure

```
contracts/policyaudit.py           The GenVM contract
tests/                             Direct-mode tests that execute the real contract
scripts/                           Static contract audit; frontend-vs-ABI checker
pytest.ini                         Makes unused test mocks fail the suite
.github/workflows/ci.yml           Lint + tests + build on every push
src/                               React + Vite app (incl. the /guide test guide and /docs)
docs/                              architecture.md, deployment.md, contracts.md, frontend.md, samples/
LICENSE                            MIT
```

<br />

---

## Status

<div align="center">

![Tested](https://img.shields.io/badge/contract%20logic%20%28mocked%20web%20and%20LLM%29-tested-brightgreen?style=flat-square)
![Untested](https://img.shields.io/badge/SUPPORTED%2C%20INCONCLUSIVE%2C%20reclaim%20live-untested-yellow?style=flat-square)

</div>

`pytest tests -q -p no:cacheprovider` runs 133 direct-mode tests that execute the real contract, and all pass. Nine deliberately planted bugs (for example the `status_code` bug, a validator that ignores the verdict, and a transfer before the balance is zeroed) were each caught by the suite. The tests mock the web and the LLM, so they do **not** prove real LLM behavior on real documents, real network behavior, or real multi-node consensus timing. The contract is deployed on StudioNet (address above). One scenario (DISPUTED: post, challenge, evaluate, withdraw) was run by hand on the live deployment with two wallets and ended as expected; that run is reported, not reproducible from this repository, and SUPPORTED, INCONCLUSIVE and reclaim have not been run live. See [`docs/deployment.md`](./docs/deployment.md) for the same statement in full.

<br />

---

<div align="center">

Built on [GenLayer](https://genlayer.com)

</div>
