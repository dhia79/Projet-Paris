/**
 * Optional Firebase bootstrap (hosting + analytics/logging).
 *
 * Initialization is lazy and fully guarded: the dashboard is a read-only
 * consumer of Open Data Paris and must render even with no Firebase config.
 */
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics'
import { logger } from './logger'

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const isConfigured = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | null = null
let analytics: Analytics | null = null

export function initFirebase(): FirebaseApp | null {
  if (!isConfigured) {
    logger.info('ui', 'Firebase not configured — skipping init (dashboard works without it)')
    return null
  }
  if (app) return app

  try {
    app = initializeApp(config)
    void isSupported().then((supported) => {
      if (supported && app) {
        analytics = getAnalytics(app)
        logger.info('ui', 'Firebase Analytics enabled')
      }
    })
    logger.info('ui', `Firebase initialized (project: ${config.projectId})`)
    return app
  } catch (error) {
    logger.error('ui', 'Firebase init failed — continuing without it', (error as Error).message)
    return null
  }
}

/** Fire-and-forget product analytics. No-ops when Firebase is absent. */
export function track(event: string, params?: Record<string, string | number | boolean>): void {
  if (!analytics) return
  try {
    logEvent(analytics, event, params)
  } catch {
    // Analytics must never break a user interaction.
  }
}
