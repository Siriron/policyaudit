import { isDeployed, getPending, listPolicies } from '../lib/gen'
import { useAsync } from '../lib/useAsync'
import { useTx, useWallet } from '../lib/app'
import { formatGen } from '../lib/format'
import { Empty, ErrorNote, Spinner } from '../components/ui'
import { PolicyCard } from './Home'

export default function Me() {
  const { account, connect } = useWallet()
  const { run, busy } = useTx()
  const bal = useAsync(() => (isDeployed() && account ? getPending(account) : Promise.resolve(null)), [account])
  const mine = useAsync(() => (isDeployed() && account ? listPolicies('', account, 0, 30) : Promise.resolve(null)), [account])
  const reload = () => { bal.reload(); mine.reload() }

  if (!account) return (<><h1>My account</h1><p>Connect a wallet to see your balance and policies.</p><button className="primary" onClick={connect}>Connect wallet</button></>)
  return (
    <>
      <h1>My account</h1>
      <h2>Withdrawable balance</h2>
      {bal.loading && bal.data === null && <Spinner label="Reading balance" />}
      <ErrorNote message={bal.error} onRetry={bal.reload} />
      {bal.data !== null && (
        <>
          <p className="balance">{formatGen(bal.data)}</p>
          <button className="primary" disabled={busy || bal.data === 0n}
            onClick={() => run('Withdraw balance', 'withdraw', [], 0n, reload)}>Withdraw</button>
          <p className="hint">Winnings, refunds and reclaimed bounties are credited here first; withdrawing zeroes the balance, then sends it.
            Transfers out of a contract only land once the transaction is Finalized, so a provisional (accepted) withdrawal is not paid yet.</p>
        </>
      )}
      <h2>Policies I posted</h2>
      {mine.loading && !mine.data && <Spinner label="Reading policies" />}
      <ErrorNote message={mine.error} onRetry={mine.reload} />
      {mine.data && mine.data.items.length === 0 && <Empty>You have not posted a policy.</Empty>}
      <div className="cards">{mine.data?.items.map(p => <PolicyCard key={p.id} p={p} />)}</div>
      <p><button className="link" onClick={reload}>Refresh</button></p>
    </>
  )
}
