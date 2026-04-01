type ProbeStatus = 'healthy' | 'degraded' | 'failing' | 'unknown'
type ConnectionState = 'CONNECTED' | 'DEGRADED' | 'UNSTABLE' | 'DISCONNECTED'
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
type EventType = 'state_change' | 'probe_update' | 'latency_spike' | 'reconnect' | 'error' | 'anomaly'
type AnomalyPattern = 'spike' | 'gradual_degradation' | 'oscillation' | 'cascade' | 'partial_outage'
type TrendDirection = 'improving' | 'stable' | 'degrading'

interface ProbeReport {
  name: string
  status: ProbeStatus
  lastUpdate: number
  latency?: number
  message?: string
  metadata?: Record<string, unknown>
}

interface ConnectionEvent {
  type: EventType
  timestamp: number
  data: Record<string, unknown>
}

interface LatencyStats {
  current: number
  min: number
  max: number
  mean: number
  median: number
  trend: TrendDirection
  trendRate: number
}

interface ConnectionSettings {
  staleFeedThresholdMs: number
  latencyWarningMs: number
  latencyCriticalMs: number
  failureThreshold: number
  recoveryThreshold: number
  healthCheckIntervalMs: number
  healthCheckBackgroundIntervalMs: number
}

interface HealthResponse {
  status: string
  mode: string
  timestamp: number
  uptime: number
  memory: { used: number; total: number; percent: number }
  connections: number
  version: string
}

const DEFAULT_SETTINGS: ConnectionSettings = {
  staleFeedThresholdMs: 2000,
  latencyWarningMs: 200,
  latencyCriticalMs: 1000,
  failureThreshold: 3,
  recoveryThreshold: 5,
  healthCheckIntervalMs: 30000,
  healthCheckBackgroundIntervalMs: 120000,
}

const PROBE_WEIGHTS = {
  priceFeed: 0.40,
  webSocket: 0.25,
  serverHealth: 0.15,
  exchangeHealth: 0.15,
  browser: 0.05,
}

const STATUS_SCORES: Record<ProbeStatus, number> = {
  healthy: 1.0,
  degraded: 0.5,
  failing: 0.0,
  unknown: 0.5,
}

class RingBuffer<T> {
  private buffer: T[] = []
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  push(item: T) {
    this.buffer.push(item)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
  }

  getAll(): T[] {
    return [...this.buffer]
  }

  getRecent(n: number): T[] {
    return this.buffer.slice(-n)
  }

  clear() {
    this.buffer = []
  }

  get length(): number {
    return this.buffer.length
  }
}

class EventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data)
      } catch (e) {
        console.error(`[Connection] Event handler error:`, e)
      }
    })
  }
}

class PriceFeedProbe {
  private lastUpdateTime = 0
  private updateHistory: number[] = []
  private expectedIntervalMs = 500

  recordUpdate(timestamp: number) {
    this.lastUpdateTime = timestamp
    this.updateHistory.push(timestamp)
    if (this.updateHistory.length > 20) {
      this.updateHistory.shift()
    }
  }

  getReport(settings: ConnectionSettings): ProbeReport {
    const now = Date.now()
    const gap = now - this.lastUpdateTime

    if (this.lastUpdateTime === 0) {
      return {
        name: 'priceFeed',
        status: 'unknown',
        lastUpdate: 0,
        message: 'Awaiting first price update',
      }
    }

    let status: ProbeStatus = 'healthy'
    let message = 'Live'

    if (gap > settings.staleFeedThresholdMs * 5) {
      status = 'failing'
      message = `No updates for ${(gap / 1000).toFixed(1)}s`
    } else if (gap > settings.staleFeedThresholdMs) {
      status = 'degraded'
      message = `Stale (${(gap / 1000).toFixed(1)}s)`
    }

    const jitter = this.calculateJitter()

    return {
      name: 'priceFeed',
      status,
      lastUpdate: this.lastUpdateTime,
      message,
      metadata: {
        gap,
        jitter,
        updateCount: this.updateHistory.length,
      },
    }
  }

  private calculateJitter(): number {
    if (this.updateHistory.length < 2) return 0
    const intervals: number[] = []
    for (let i = 1; i < this.updateHistory.length; i++) {
      intervals.push(this.updateHistory[i] - this.updateHistory[i - 1])
    }
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length
    return Math.sqrt(variance)
  }
}

class WebSocketProbe {
  private connectionState: 'open' | 'connecting' | 'closed' | 'errored' = 'closed'
  private lastConnectedTime = 0
  private lastDisconnectedTime = 0
  private reconnectAttempts = 0
  private consecutiveFailures = 0
  private lastError: string | null = null

  recordOpen() {
    this.connectionState = 'open'
    this.lastConnectedTime = Date.now()
    this.reconnectAttempts = 0
    this.consecutiveFailures = 0
    this.lastError = null
  }

  recordClose(code?: number, reason?: string) {
    this.connectionState = 'closed'
    this.lastDisconnectedTime = Date.now()
    if (code && code !== 1000) {
      this.lastError = `Closed: ${code} ${reason || ''}`
    }
  }

  recordError(error: string) {
    this.connectionState = 'errored'
    this.consecutiveFailures++
    this.lastError = error
  }

  recordReconnectAttempt() {
    this.connectionState = 'connecting'
    this.reconnectAttempts++
  }

  getReport(): ProbeReport {
    let status: ProbeStatus = 'unknown'
    let message = 'Not initialized'

    switch (this.connectionState) {
      case 'open':
        status = this.reconnectAttempts > 0 ? 'degraded' : 'healthy'
        message = this.reconnectAttempts > 0 ? `Connected (after ${this.reconnectAttempts} retries)` : 'Connected'
        break
      case 'connecting':
        status = 'degraded'
        message = `Reconnecting (attempt ${this.reconnectAttempts})`
        break
      case 'closed':
        status = 'failing'
        message = this.lastError || 'Disconnected'
        break
      case 'errored':
        status = 'failing'
        message = this.lastError || 'Error'
        break
    }

    return {
      name: 'webSocket',
      status,
      lastUpdate: this.lastConnectedTime || this.lastDisconnectedTime,
      message,
      metadata: {
        state: this.connectionState,
        reconnectAttempts: this.reconnectAttempts,
        consecutiveFailures: this.consecutiveFailures,
      },
    }
  }
}

class HealthProbe {
  private name: string
  private endpoint: string
  private lastCheckTime = 0
  private lastLatency = 0
  private latencyHistory: number[] = []
  private consecutiveFailures = 0
  private lastResponse: HealthResponse | null = null

  constructor(name: string, endpoint: string) {
    this.name = name
    this.endpoint = endpoint
  }

  async check(settings: ConnectionSettings): Promise<ProbeReport> {
    const start = Date.now()

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(this.endpoint, {
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeout)

      const latency = Date.now() - start
      this.lastLatency = latency
      this.lastCheckTime = Date.now()
      this.consecutiveFailures = 0

      this.latencyHistory.push(latency)
      if (this.latencyHistory.length > 20) {
        this.latencyHistory.shift()
      }

      if (response.ok) {
        try {
          this.lastResponse = await response.json()
        } catch {
          this.lastResponse = null
        }
      }

      let status: ProbeStatus = 'healthy'
      let message = `${latency}ms`

      if (latency > settings.latencyCriticalMs) {
        status = 'failing'
        message = `Critical latency: ${latency}ms`
      } else if (latency > settings.latencyWarningMs) {
        status = 'degraded'
        message = `High latency: ${latency}ms`
      }

      return {
        name: this.name,
        status,
        lastUpdate: this.lastCheckTime,
        latency,
        message,
        metadata: {
          response: this.lastResponse,
        },
      }
    } catch (error) {
      this.consecutiveFailures++
      this.lastCheckTime = Date.now()

      return {
        name: this.name,
        status: 'failing',
        lastUpdate: this.lastCheckTime,
        message: error instanceof Error ? error.message : 'Failed',
        metadata: {
          consecutiveFailures: this.consecutiveFailures,
        },
      }
    }
  }

  getLatencyStats(): LatencyStats | null {
    if (this.latencyHistory.length === 0) return null

    const sorted = [...this.latencyHistory].sort((a, b) => a - b)
    const mean = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
    const median = sorted[Math.floor(sorted.length / 2)]

    const trend = this.calculateTrend()

    return {
      current: this.lastLatency,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean),
      median,
      trend: trend.direction,
      trendRate: trend.rate,
    }
  }

  private calculateTrend(): { direction: TrendDirection; rate: number } {
    if (this.latencyHistory.length < 3) {
      return { direction: 'stable', rate: 0 }
    }

    const n = this.latencyHistory.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = this.latencyHistory

    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const ratePerMinute = slope * (60000 / 30000) // Convert to ms per minute

    let direction: TrendDirection = 'stable'
    if (ratePerMinute > 5) direction = 'degrading'
    else if (ratePerMinute < -5) direction = 'improving'

    return { direction, rate: Math.round(ratePerMinute) }
  }

  getLastReport(): ProbeReport {
    return {
      name: this.name,
      status: this.consecutiveFailures > 0 ? 'failing' : this.lastLatency > 0 ? 'healthy' : 'unknown',
      lastUpdate: this.lastCheckTime,
      latency: this.lastLatency,
      message: this.lastLatency > 0 ? `${this.lastLatency}ms` : 'Not checked',
    }
  }
}

class BrowserProbe {
  private isOnline = navigator.onLine
  private isVisible = document.visibilityState === 'visible'
  private lastOnlineTime = navigator.onLine ? Date.now() : 0
  private lastOfflineTime = navigator.onLine ? 0 : Date.now()

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.lastOnlineTime = Date.now()
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.lastOfflineTime = Date.now()
    })
    document.addEventListener('visibilitychange', () => {
      this.isVisible = document.visibilityState === 'visible'
    })
  }

  getReport(): ProbeReport {
    let status: ProbeStatus = 'healthy'
    let message = 'Online'

    if (!this.isOnline) {
      status = 'failing'
      message = 'Browser reports offline'
    } else if (!this.isVisible) {
      status = 'degraded'
      message = 'Tab hidden'
    }

    return {
      name: 'browser',
      status,
      lastUpdate: Date.now(),
      message,
      metadata: {
        online: this.isOnline,
        visible: this.isVisible,
        lastOnline: this.lastOnlineTime,
        lastOffline: this.lastOfflineTime,
      },
    }
  }

  get online(): boolean {
    return this.isOnline
  }

  get visible(): boolean {
    return this.isVisible
  }
}

class AnomalyDetector {
  detectSpike(latencyHistory: number[]): boolean {
    if (latencyHistory.length < 5) return false
    const recent = latencyHistory.slice(-5)
    const baseline = latencyHistory.slice(0, -1)
    const baselineMean = baseline.reduce((a, b) => a + b, 0) / baseline.length
    const current = recent[recent.length - 1]
    return current > baselineMean * 3 && recent.slice(0, -1).every(v => v < baselineMean * 2)
  }

  detectDegradation(latencyHistory: number[]): boolean {
    if (latencyHistory.length < 10) return false
    const firstHalf = latencyHistory.slice(0, 5)
    const secondHalf = latencyHistory.slice(-5)
    const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    return secondMean > firstMean * 1.5
  }

  detectOscillation(stateHistory: ConnectionState[]): boolean {
    if (stateHistory.length < 6) return false
    const recent = stateHistory.slice(-6)
    let changes = 0
    for (let i = 1; i < recent.length; i++) {
      if (recent[i] !== recent[i - 1]) changes++
    }
    return changes >= 4
  }

  detectCascade(reports: ProbeReport[]): boolean {
    const failing = reports.filter(r => r.status === 'failing')
    return failing.length >= 3
  }

  detectPartialOutage(reports: ProbeReport[]): { server: boolean; exchange: boolean } {
    const serverReport = reports.find(r => r.name === 'serverHealth')
    const exchangeReport = reports.find(r => r.name === 'exchangeHealth')
    return {
      server: serverReport?.status === 'failing' && exchangeReport?.status !== 'failing',
      exchange: exchangeReport?.status === 'failing' && serverReport?.status !== 'failing',
    }
  }
}

class ConnectionMonitor extends EventEmitter {
  private settings: ConnectionSettings
  private priceFeedProbe: PriceFeedProbe
  private webSocketProbe: WebSocketProbe
  private serverHealthProbe: HealthProbe
  private exchangeHealthProbe: HealthProbe
  private browserProbe: BrowserProbe
  private anomalyDetector: AnomalyDetector

  private eventHistory: RingBuffer<ConnectionEvent>
  private stateHistory: ConnectionState[] = []

  private currentState: ConnectionState = 'CONNECTED'
  private currentConfidence: Confidence = 'HIGH'
  private consecutiveDowngrades = 0
  private consecutiveUpgrades = 0

  private healthCheckInterval: number | null = null
  private initialized = false

  constructor() {
    super()
    this.settings = { ...DEFAULT_SETTINGS }
    this.priceFeedProbe = new PriceFeedProbe()
    this.webSocketProbe = new WebSocketProbe()
    this.serverHealthProbe = new HealthProbe('serverHealth', '/health')
    this.exchangeHealthProbe = new HealthProbe('exchangeHealth', 'https://api.hyperliquid.xyz/info')
    this.browserProbe = new BrowserProbe()
    this.anomalyDetector = new AnomalyDetector()
    this.eventHistory = new RingBuffer(500)
  }

  init(settings?: Partial<ConnectionSettings>) {
    if (this.initialized) return

    if (settings) {
      this.settings = { ...this.settings, ...settings }
    }

    this.startHealthChecks()
    this.setupVisibilityHandler()
    this.initialized = true

    this.logEvent('state_change', {
      previous: null,
      current: this.currentState,
      reason: 'init'
    })
  }

  destroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    this.initialized = false
  }

  private startHealthChecks() {
    this.runHealthChecks()

    this.healthCheckInterval = window.setInterval(() => {
      const interval = this.browserProbe.visible
        ? this.settings.healthCheckIntervalMs
        : this.settings.healthCheckBackgroundIntervalMs
      this.runHealthChecks()
    }, this.settings.healthCheckIntervalMs)
  }

  private setupVisibilityHandler() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.runHealthChecks()
      }
    })
  }

  private async runHealthChecks() {
    const [serverReport, exchangeReport] = await Promise.all([
      this.serverHealthProbe.check(this.settings),
      this.exchangeHealthProbe.check(this.settings),
    ])

    this.emit('probeUpdate', { probe: 'serverHealth', report: serverReport })
    this.emit('probeUpdate', { probe: 'exchangeHealth', report: exchangeReport })

    this.evaluateState()
  }

  private evaluateState() {
    const reports = this.getAllProbeReports()
    const score = this.calculateScore(reports)
    const newConfidence = this.scoreToConfidence(score)
    const newState = this.confidenceToState(newConfidence)

    this.checkAnomalies(reports)

    if (newState !== this.currentState) {
      this.handleStateTransition(newState, newConfidence, reports)
    } else if (newConfidence !== this.currentConfidence) {
      const prevConfidence = this.currentConfidence
      this.currentConfidence = newConfidence
      this.emit('confidenceChange', { previous: prevConfidence, current: newConfidence })
    }
  }

  private calculateScore(reports: ProbeReport[]): number {
    let score = 0
    for (const report of reports) {
      const weight = PROBE_WEIGHTS[report.name as keyof typeof PROBE_WEIGHTS] || 0
      score += STATUS_SCORES[report.status] * weight
    }
    return score
  }

  private scoreToConfidence(score: number): Confidence {
    if (score > 0.85) return 'HIGH'
    if (score > 0.6) return 'MEDIUM'
    if (score > 0.3) return 'LOW'
    return 'NONE'
  }

  private confidenceToState(confidence: Confidence): ConnectionState {
    switch (confidence) {
      case 'HIGH': return 'CONNECTED'
      case 'MEDIUM': return 'DEGRADED'
      case 'LOW': return 'UNSTABLE'
      case 'NONE': return 'DISCONNECTED'
    }
  }

  private handleStateTransition(newState: ConnectionState, newConfidence: Confidence, reports: ProbeReport[]) {
    const stateOrder: ConnectionState[] = ['CONNECTED', 'DEGRADED', 'UNSTABLE', 'DISCONNECTED']
    const currentIndex = stateOrder.indexOf(this.currentState)
    const newIndex = stateOrder.indexOf(newState)
    const isDowngrade = newIndex > currentIndex

    if (isDowngrade) {
      this.consecutiveDowngrades++
      this.consecutiveUpgrades = 0
      if (this.consecutiveDowngrades < this.settings.failureThreshold) return
    } else {
      this.consecutiveUpgrades++
      this.consecutiveDowngrades = 0
      if (this.consecutiveUpgrades < this.settings.recoveryThreshold) return
    }

    const previousState = this.currentState
    this.currentState = newState
    this.currentConfidence = newConfidence
    this.stateHistory.push(newState)
    if (this.stateHistory.length > 20) this.stateHistory.shift()

    this.consecutiveDowngrades = 0
    this.consecutiveUpgrades = 0

    const trigger = reports
      .filter(r => r.status === 'failing' || r.status === 'degraded')
      .map(r => r.name)
      .join(', ') || 'recovery'

    const event = {
      previous: previousState,
      current: newState,
      timestamp: Date.now(),
      confidence: newConfidence,
      trigger,
    }

    this.logEvent('state_change', event)
    this.emit('stateChange', event)
  }

  private checkAnomalies(reports: ProbeReport[]) {
    const serverStats = this.serverHealthProbe.getLatencyStats()

    if (serverStats) {
      const latencyHistory = [serverStats.current]

      if (this.anomalyDetector.detectSpike(latencyHistory)) {
        this.emitAnomaly('spike', { probe: 'serverHealth', latency: serverStats.current })
      }
    }

    if (this.anomalyDetector.detectOscillation(this.stateHistory)) {
      this.emitAnomaly('oscillation', { recentStates: this.stateHistory.slice(-6) })
    }

    if (this.anomalyDetector.detectCascade(reports)) {
      this.emitAnomaly('cascade', { failingProbes: reports.filter(r => r.status === 'failing').map(r => r.name) })
    }

    const partial = this.anomalyDetector.detectPartialOutage(reports)
    if (partial.server) {
      this.emitAnomaly('partial_outage', { type: 'server_only' })
    } else if (partial.exchange) {
      this.emitAnomaly('partial_outage', { type: 'exchange_only' })
    }
  }

  private emitAnomaly(pattern: AnomalyPattern, details: Record<string, unknown>) {
    this.logEvent('anomaly', { pattern, ...details })
    this.emit('anomalyDetected', { pattern, details })
  }

  private logEvent(type: EventType, data: Record<string, unknown>) {
    this.eventHistory.push({
      type,
      timestamp: Date.now(),
      data,
    })
  }

  recordPriceUpdate(timestamp: number) {
    this.priceFeedProbe.recordUpdate(timestamp)
    this.emit('probeUpdate', { probe: 'priceFeed', report: this.priceFeedProbe.getReport(this.settings) })
    this.evaluateState()
  }

  recordWebSocketOpen() {
    this.webSocketProbe.recordOpen()
    this.logEvent('reconnect', { success: true })
    this.emit('probeUpdate', { probe: 'webSocket', report: this.webSocketProbe.getReport() })
    this.evaluateState()
  }

  recordWebSocketClose(code?: number, reason?: string) {
    this.webSocketProbe.recordClose(code, reason)
    this.logEvent('error', { probe: 'webSocket', code, reason })
    this.emit('probeUpdate', { probe: 'webSocket', report: this.webSocketProbe.getReport() })
    this.evaluateState()
  }

  recordWebSocketError(error: string) {
    this.webSocketProbe.recordError(error)
    this.logEvent('error', { probe: 'webSocket', error })
    this.emit('probeUpdate', { probe: 'webSocket', report: this.webSocketProbe.getReport() })
    this.evaluateState()
  }

  recordWebSocketReconnecting() {
    this.webSocketProbe.recordReconnectAttempt()
    this.emit('probeUpdate', { probe: 'webSocket', report: this.webSocketProbe.getReport() })
  }

  getState(): ConnectionState {
    return this.currentState
  }

  getConfidence(): Confidence {
    return this.currentConfidence
  }

  getAllProbeReports(): ProbeReport[] {
    return [
      this.priceFeedProbe.getReport(this.settings),
      this.webSocketProbe.getReport(),
      this.serverHealthProbe.getLastReport(),
      this.exchangeHealthProbe.getLastReport(),
      this.browserProbe.getReport(),
    ]
  }

  getHistory(n?: number): ConnectionEvent[] {
    return n ? this.eventHistory.getRecent(n) : this.eventHistory.getAll()
  }

  getLatencyStats(probe: 'serverHealth' | 'exchangeHealth'): LatencyStats | null {
    if (probe === 'serverHealth') return this.serverHealthProbe.getLatencyStats()
    if (probe === 'exchangeHealth') return this.exchangeHealthProbe.getLatencyStats()
    return null
  }

  getSettings(): ConnectionSettings {
    return { ...this.settings }
  }

  updateSettings(partial: Partial<ConnectionSettings>) {
    this.settings = { ...this.settings, ...partial }
  }

  getLastUpdateTime(): number {
    const reports = this.getAllProbeReports()
    return Math.max(...reports.map(r => r.lastUpdate).filter(t => t > 0), 0)
  }

  getFormattedLastUpdate(): string {
    const lastUpdate = this.getLastUpdateTime()
    if (lastUpdate === 0) return 'Never'
    const now = Date.now()
    const diff = now - lastUpdate
    if (diff < 1000) return 'Just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    const date = new Date(lastUpdate)
    return date.toLocaleTimeString()
  }
}

export const connectionMonitor = new ConnectionMonitor()

export type {
  ConnectionState,
  Confidence,
  ProbeReport,
  ConnectionEvent,
  LatencyStats,
  ConnectionSettings,
  AnomalyPattern,
}
