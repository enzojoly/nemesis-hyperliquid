import type { Emotion, DialogueLine } from './types'

export const INTRO_DIALOGUE: DialogueLine[] = [
  { text: "Ah... you're finally here. I've been waiting for someone like you.", emotion: 'pleased', showName: false },
  { text: "They call me Nemesis. Every trader needs one, you know~. Let me show you what we can do together...", emotion: 'talkative', showName: false },
]

export const DIALOGUE = {
  idle: [
    { text: "What's your next move going to be?", emotion: 'inquisitive' as Emotion },
    { text: "The markets are whispering... can you hear them?", emotion: 'kawaii' as Emotion },
    { text: "I believe in you~ Show me what you've got!", emotion: 'happy' as Emotion },
    { text: "Don't keep me waiting too long...", emotion: 'sly' as Emotion },
    { text: "Every trader needs a Nemesis. That's me~", emotion: 'pleased' as Emotion },
    { text: "Feeling lucky today? I can sense it...", emotion: 'talkative' as Emotion },
  ],
  filled: [
    { text: "Ahh~ Order filled! You're in deep now...", emotion: 'excited' as Emotion },
    { text: "Mmm~ Position opened! I like your style~", emotion: 'pleased' as Emotion },
    { text: "Yes! That's the spirit!", emotion: 'happy' as Emotion },
    { text: "Bold move... I'm watching closely~", emotion: 'sly' as Emotion },
  ],
  closed: [
    { text: "Position closed! How did that feel?", emotion: 'inquisitive' as Emotion },
    { text: "Out already? I wanted to see more...", emotion: 'concerned' as Emotion },
    { text: "Clean exit! You're good at this...", emotion: 'pleased' as Emotion },
  ],
  connect: [
    { text: "Welcome back~ I've missed you...", emotion: 'happy' as Emotion },
    { text: "Finally! Let's make some magic together~", emotion: 'excited' as Emotion },
  ],
  lobby: [
    { text: "Trading with friends? How sweet~", emotion: 'kawaii' as Emotion },
    { text: "Strength in numbers! I approve.", emotion: 'pleased' as Emotion },
  ],
  duel: [
    { text: "Ooh~ A challenge! This is exciting...", emotion: 'excited' as Emotion },
    { text: "1v1? I love watching a good fight~", emotion: 'sly' as Emotion },
    { text: "Show your rival who's the real trader!", emotion: 'talkative' as Emotion },
  ],
  connectionDegraded: [
    { text: "Connection's getting spotty...", emotion: 'concerned' as Emotion },
    { text: "Having some trouble reaching the market.", emotion: 'inquisitive' as Emotion },
  ],
  connectionUnstable: [
    { text: "Connection's unstable. Be careful.", emotion: 'concerned' as Emotion },
    { text: "I'm losing the signal...", emotion: 'concerned' as Emotion },
  ],
  connectionLost: [
    { text: "We've lost connection. Data may be stale.", emotion: 'loss' as Emotion },
    { text: "Disconnected. I can't see the markets.", emotion: 'concerned' as Emotion },
  ],
  connectionRestored: [
    { text: "We're back. Prices are live.", emotion: 'happy' as Emotion },
    { text: "Connection restored~", emotion: 'pleased' as Emotion },
  ],
  connectionOscillating: [
    { text: "Connection's jumping around. Might want to check your wifi.", emotion: 'concerned' as Emotion },
  ],
  exchangeDown: [
    { text: "Can't reach the exchange. Might be on their end.", emotion: 'inquisitive' as Emotion },
  ],
}
