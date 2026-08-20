import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../lib/logger'

interface Props {
  children: ReactNode
  fallback?: (reset: () => void, error: Error) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Class component by necessity: React 19 still has no hook-based equivalent for
 * `componentDidCatch`. Keeps a render-time crash from blanking the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('ui', 'ErrorBoundary caught a render error', {
      message: error.message,
      componentStack: info.componentStack,
    })
  }

  private readonly reset = (): void => this.setState({ error: null })

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(this.reset, error)

    return (
      <div role="alert" className="card m-4 p-6">
        <h2 className="text-lg font-semibold text-slate-900">Une erreur est survenue</h2>
        <p className="mt-1 text-sm text-slate-600">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-4 rounded-lg bg-cool-600 px-4 py-2 text-sm font-medium text-white hover:bg-cool-700"
        >
          Réessayer
        </button>
      </div>
    )
  }
}
