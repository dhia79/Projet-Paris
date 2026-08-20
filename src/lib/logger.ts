/**
 * Structured, grouped console logging.
 *
 * Purpose is twofold: real diagnostics in production-ish builds, and a readable
 * live narration of the data pipeline during a technical code walkthrough.
 * Enable/disable with `VITE_ENABLE_LOGS` ('false' silences everything but errors).
 */

const ENABLED = import.meta.env.VITE_ENABLE_LOGS !== 'false'

type Scope = 'api' | 'adapter' | 'store' | 'ui'

const SCOPE_STYLE: Record<Scope, string> = {
  api: 'background:#0163a2;color:#fff',
  adapter: 'background:#047857;color:#fff',
  store: 'background:#6d28d9;color:#fff',
  ui: 'background:#b45309;color:#fff',
}

const tag = (scope: Scope) => [
  `%c ${scope.toUpperCase()} %c %s`,
  `${SCOPE_STYLE[scope]};border-radius:3px;font-weight:600`,
  'color:inherit',
]

export const logger = {
  info(scope: Scope, message: string, payload?: unknown): void {
    if (!ENABLED) return
    const [fmt, style, reset] = tag(scope)
    if (payload === undefined) console.log(fmt, style, reset, message)
    else console.log(fmt, style, reset, message, payload)
  },

  warn(scope: Scope, message: string, payload?: unknown): void {
    if (!ENABLED) return
    console.warn(`[${scope}] ${message}`, payload ?? '')
  },

  error(scope: Scope, message: string, payload?: unknown): void {
    // Errors are never silenced.
    console.error(`[${scope}] ${message}`, payload ?? '')
  },

  /** Collapsed group + wall-clock timing around an async step. */
  async group<T>(scope: Scope, title: string, run: () => Promise<T>): Promise<T> {
    if (!ENABLED) return run()
    console.groupCollapsed(`%c ${scope.toUpperCase()} %c ${title}`, `${SCOPE_STYLE[scope]};border-radius:3px;font-weight:600`, 'color:inherit')
    const startedAt = performance.now()
    try {
      return await run()
    } finally {
      console.log(`⏱ ${(performance.now() - startedAt).toFixed(0)} ms`)
      console.groupEnd()
    }
  },

  table(rows: readonly Record<string, unknown>[]): void {
    if (!ENABLED || rows.length === 0) return
    console.table(rows as Record<string, unknown>[])
  },
}
