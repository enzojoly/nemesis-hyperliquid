let audioCtx: AudioContext | null = null

export function playSound(notes: number[], dur = 0.06) {
  if (!audioCtx) audioCtx = new AudioContext()
  const now = audioCtx.currentTime
  notes.forEach((f, i) => {
    const osc = audioCtx!.createOscillator()
    const gain = audioCtx!.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f, now + i * dur)
    gain.gain.setValueAtTime(0.1, now + i * dur)
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * dur + dur * 1.5)
    osc.connect(gain)
    gain.connect(audioCtx!.destination)
    osc.start(now + i * dur)
    osc.stop(now + i * dur + dur * 2)
  })
}

export function playTypeSound() {
  if (!audioCtx) audioCtx = new AudioContext()
  const now = audioCtx.currentTime
  const notes = [523, 587, 659, 698, 784]
  const note = notes[Math.floor(Math.random() * notes.length)]
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(note, now)
  osc.frequency.exponentialRampToValueAtTime(note * 1.02, now + 0.05)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.12)
}

export function playCRTOn() {
  if (!audioCtx) audioCtx = new AudioContext()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.15)
  gain.gain.setValueAtTime(0.06, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.25)
}

export function playCRTOff() {
  if (!audioCtx) audioCtx = new AudioContext()
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.25)
  gain.gain.setValueAtTime(0.08, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.3)
}
