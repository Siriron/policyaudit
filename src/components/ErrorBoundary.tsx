import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* surfaced below; no console noise in production */ }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="empty" role="alert">
        <h1>Something went wrong</h1>
        <p>{this.state.error.message}</p>
        <p><button onClick={() => { this.setState({ error: null }); window.location.assign('/') }}>Back to the start</button></p>
      </div>
    )
  }
}
