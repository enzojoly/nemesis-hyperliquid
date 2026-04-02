type ConnectionState = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED'
type EventType = 'state_change' | 'health_check' | 'error'

interface ConnectionEvent {
  type: EventType
  timestamp: number
  data: Record<string, unknown>
}

interface HealthStatus {
  state: ConnectionState
  lastLatency: number
  avgLatency: number
  online: boolean
  lastCheck: number
}

// ---------------------------------------------------------------------------
// Event emitter
// ---------------------------------------------------------------------------

class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(handler => {
      try { handler(data) } catch (e) { console.error('[Connection]', e) }
    })
  }
}

// ---------------------------------------------------------------------------
// Connection monitor
//
// Primary: SW polls /health every 50ms and relays via postMessage → instant
// Fallback: monitor polls /health every 1s in case SW isn't available
//
// Green  = CONNECTED    (0 failures)
// Orange = DEGRADED     (1 failure — something flickered)
// Red    = DISCONNECTED (2+ failures — server is down)
// ---------------------------------------------------------------------------

class ConnectionMonitor extends EventEmitter {
  private currentState: ConnectionState = 'CONNECTED'
  private latencyHistory: number[] = []
  private eventHistory: ConnectionEvent[] = []
  private lastCheckTime = 0
  private lastLatency = 0
  private consecutiveFailures = 0
  private pollTimer: number | null = null
  private initialized = false

  init() {
    if (this.initialized) return
    this.initialized = true

    this.log('state_change', { previous: null, current: 'CONNECTED', reason: 'init' })
    this.listenToServiceWorker()
    this.schedulePoll()

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.poll()
    })
  }

  private listenToServiceWorker() {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.addEventListener('message', (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.type === 'connection') {
          if (data.healthy) {
            this.consecutiveFailures = 0
            this.lastCheckTime = Date.now()
            this.transition('CONNECTED')
          } else {
            this.transition('DISCONNECTED')
          }
        }
      } catch {}
    })
  }

  private schedulePoll() {
    this.pollTimer = window.setTimeout(async () => {
      await this.poll()
      this.schedulePoll()
    }, 1000)
  }

  private async poll() {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const res = await fetch('/health', { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timeout)

      const latency = Date.now() - start
      this.lastLatency = latency
      this.lastCheckTime = Date.now()
      this.consecutiveFailures = 0
      this.latencyHistory.push(latency)
      if (this.latencyHistory.length > 20) this.latencyHistory.shift()

      this.log('health_check', { latency, status: res.ok ? 'ok' : 'error' })
      if (res.ok) this.transition('CONNECTED')

      this.emit('healthCheck', { latency, ok: res.ok })
    } catch {
      this.consecutiveFailures++
      this.lastCheckTime = Date.now()
      this.log('error', { consecutiveFailures: this.consecutiveFailures })

      if (this.consecutiveFailures >= 2) {
        this.transition('DISCONNECTED')
      } else if (this.consecutiveFailures === 1) {
        this.transition('DEGRADED')
      }
    }
  }

  private transition(newState: ConnectionState) {
    if (newState === this.currentState) return
    const previous = this.currentState
    this.currentState = newState
    this.log('state_change', { previous, current: newState })
    this.emit('stateChange', { previous, current: newState, timestamp: Date.now() })
  }

  private log(type: EventType, data: Record<string, unknown>) {
    this.eventHistory.push({ type, timestamp: Date.now(), data })
    if (this.eventHistory.length > 100) this.eventHistory.shift()
  }

  // SW health relay (called from app.ts SW listener if wired separately)
  recordServiceWorkerHealth(healthy: boolean) {
    if (healthy) {
      this.consecutiveFailures = 0
      this.lastCheckTime = Date.now()
      this.transition('CONNECTED')
    } else {
      this.transition('DISCONNECTED')
    }
  }

  getState(): ConnectionState { return this.currentState }

  getStatus(): HealthStatus {
    const avg = this.latencyHistory.length > 0
      ? Math.round(this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length)
      : 0
    return {
      state: this.currentState,
      lastLatency: this.lastLatency,
      avgLatency: avg,
      online: navigator.onLine,
      lastCheck: this.lastCheckTime,
    }
  }

  getHistory(n?: number): ConnectionEvent[] {
    const events = [...this.eventHistory]
    return n ? events.slice(-n) : events
  }

  getFormattedLastUpdate(): string {
    if (this.lastCheckTime === 0) return 'Never'
    const diff = Date.now() - this.lastCheckTime
    if (diff < 1000) return 'Just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return new Date(this.lastCheckTime).toLocaleTimeString()
  }
}

export const connectionMonitor = new ConnectionMonitor()

export type {
  ConnectionState,
  ConnectionEvent,
  HealthStatus,
}
