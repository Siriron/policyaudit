import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="empty">
      <h1>404</h1>
      <p>There is nothing at this address.</p>
      <p><Link to="/">Back to policies</Link></p>
    </div>
  )
}
