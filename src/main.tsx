import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initFirebase } from './lib/firebase'
import { logger } from './lib/logger'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root is missing from index.html')

initFirebase()
logger.info('ui', `booting — React ${import.meta.env.MODE} build`)

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
