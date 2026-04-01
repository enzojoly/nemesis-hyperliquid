export type Scene = 'title' | 'main'
export type NavTab = 'trade' | 'feed' | 'leaderboard' | 'portfolio'
export type OrderTab = 'yes' | 'no' | 'lobby' | 'duel'
export type PosTab = 'positions' | 'orders' | 'history'
export type AvatarMode = 'full' | 'small' | 'off'
export type Emotion = 'happy' | 'kawaii' | 'pleased' | 'sly' | 'concerned' | 'inquisitive' | 'talkative' | 'excited' | 'loss'
export type DialogueSignal = 'off' | 'connecting' | 'connected' | 'disconnecting'

export interface Market {
  id: string
  asset: string
  question: string
  yesPrice: number
  noPrice: number
  volume: number
  expiry: number
  category: string
}

export interface Position {
  id: string
  marketId: string
  market: string
  side: 'yes' | 'no'
  size: number
  entry: number
  current: number
  pnl: number
  type: 'standard' | 'lobby' | 'duel'
  status: 'open' | 'closed'
}

export interface Order {
  id: string
  marketId: string
  market: string
  side: 'yes' | 'no'
  size: number
  price: number
  status: 'pending' | 'filled' | 'cancelled'
}

export interface FeedItem {
  user: string
  text: string
  time: string
}

export interface LeaderboardEntry {
  rank: number
  address: string
  name: string
  pnl: number
}

export interface DialogueLine {
  text: string
  emotion: Emotion
  showName?: boolean
}

export interface AppState {
  scene: Scene
  introIndex: number
  introComplete: boolean
  introStarted: boolean
  connected: boolean
  address: string
  balance: number
  nav: NavTab
  orderTab: OrderTab
  posTab: PosTab
  selectedMarket: string
  showMarketModal: boolean
  showDiagnosticPanel: boolean
  avatarMode: AvatarMode
  currentEmotion: Emotion
  currentDialogue: string
  dialogueQueue: string[]
  isTyping: boolean
  typewriterIndex: number
  lastDialogueByCategory: Record<string, string>
  markets: Market[]
  positions: Position[]
  orders: Order[]
  history: Position[]
  feed: FeedItem[]
  leaderboard: LeaderboardEntry[]
  stake: number
  targetAddress: string
  processing: boolean
  panelStates: { market: boolean; order: boolean; positions: boolean }
  marketFilter: string
  particlesHtml: string
  dialogueSignal: DialogueSignal
  dialogueAtEnd: boolean
  connectionState: ConnectionState
  lastConnectionDialogue: number
}

export type ConnectionState = 'CONNECTED' | 'DEGRADED' | 'UNSTABLE' | 'DISCONNECTED'
