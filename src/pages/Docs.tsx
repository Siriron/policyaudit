import { Link } from 'react-router-dom'
import { CONTRACT_ADDRESS, REPO_URL, explorerAddress } from '../config/chains'

export default function Docs() {
  return (
    <article className="prose">
      <h1>How PolicyAudit works</h1>

      <h2>Overview</h2>
      <p>A publisher states a claim about one policy file and locks a bounty. Challengers pay an entry fee and describe a concrete scenario where the claim does not
        hold. GenLayer validators each fetch the pinned document and judge the scenario independently; the network accepts a verdict only when the committee reproduces it.</p>

      <h2>The evidence is pinned, not supplied</h2>
      <p>The document is identified by three things the contract validates: <code>owner/name</code>, a full 40-character commit id and a file path. The contract builds the URL itself:
        <code> https://raw.githubusercontent.com/&lt;owner&gt;/&lt;name&gt;/&lt;commit&gt;/&lt;path&gt;</code>. A commit id pins the bytes, so the publisher cannot change the text after posting,
        and a challenger can read exactly what will be judged before paying. Branch names and short ids are refused.</p>

      <h2>Lifecycle</h2>
      <ol>
        <li><b>Post</b>: publisher sends the bounty with the claim, the pinned file, an entry fee and a 7–90 day lock.</li>
        <li><b>Challenge</b>: another wallet sends exactly the entry fee with a scenario while the window is open. It is queued.</li>
        <li><b>Evaluate</b>: anyone triggers it. Verdicts: <code>DISPUTED</code>, <code>SUPPORTED</code> or <code>INCONCLUSIVE</code>. An unreachable or empty document is
          <code> INCONCLUSIVE</code> decided in code, without a model.</li>
        <li><b>Settle</b>: <code>DISPUTED</code> credits the challenger with the whole bounty plus their fee and closes the policy. <code>SUPPORTED</code> adds the fee to the bounty.
          <code> INCONCLUSIVE</code> refunds the fee.</li>
        <li><b>Reclaim</b>: after the lock the publisher takes the bounty back. Queued challenges are judged first, but only until a 7-day grace period passes; then reclaim proceeds and queued
          fees are refunded through <code>refund_queued</code>, which anyone can call.</li>
        <li><b>Withdraw</b>: balances are credited, never pushed. Withdrawing zeroes the balance, then transfers.</li>
      </ol>

      <h2>Transaction states</h2>
      <p>“Accepted” means the validators agreed; it is still appealable. The app shows it as provisional, reads the execution result before calling anything a success, and only says
        “Finalized” when the network does. Transfers out of the contract land at finalization.</p>

      <h2>Contract methods</h2>
      <table>
        <thead><tr><th>Method</th><th>Kind</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>post</td><td>write, payable</td><td>Create a policy and lock the bounty</td></tr>
          <tr><td>boost</td><td>write, payable</td><td>Publisher adds to an open bounty</td></tr>
          <tr><td>challenge</td><td>write, payable</td><td>Queue a scenario with the exact entry fee</td></tr>
          <tr><td>evaluate</td><td>write</td><td>Validator consensus on one queued challenge</td></tr>
          <tr><td>refund_queued</td><td>write</td><td>Void a queued challenge on a closed policy and refund its challenger</td></tr>
          <tr><td>reclaim</td><td>write</td><td>Publisher recovers the bounty after the lock</td></tr>
          <tr><td>withdraw</td><td>write</td><td>Pull the caller’s credited balance</td></tr>
          <tr><td>get_policy, get_challenge</td><td>view</td><td>One record</td></tr>
          <tr><td>list_policies, list_challenges</td><td>view</td><td>Newest first, paged</td></tr>
          <tr><td>get_pending_balance</td><td>view</td><td>Withdrawable balance of an address</td></tr>
        </tbody>
      </table>

      <h2>Limits you should know</h2>
      <ul>
        <li>The judge is an LLM. A reproduced verdict means the committee agreed, not that it is right.</li>
        <li>Only the first 8,000 characters of the document are judged.</li>
        <li>A publisher can delete the repository to make evidence unreachable. The challenge becomes INCONCLUSIVE and the fee is refunded.</li>
        <li>StudioNet is a temporary test network. Deployed addresses may not survive resets; the repository tests are the proof of behaviour, not an address.</li>
      </ul>

      <h2>FAQ</h2>
      <p><b>Why can’t I challenge my own policy?</b> The contract refuses it so a publisher cannot farm their own bounty’s fees.</p>
      <p><b>Why did my challenge come back INCONCLUSIVE?</b> The file could not be fetched at that commit, was empty, or the validators judged the text insufficient for your scenario.</p>
      <p><b>Where do I test it?</b> The <Link to="/guide">test guide</Link> runs four scenarios with two wallets.</p>

      <h2>Links</h2>
      <p>
        <a href={REPO_URL} target="_blank" rel="noreferrer">Source repository</a>
        {CONTRACT_ADDRESS && <> · <a href={explorerAddress(CONTRACT_ADDRESS)} target="_blank" rel="noreferrer">Contract on StudioNet</a></>}
      </p>
    </article>
  )
}
