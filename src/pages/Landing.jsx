import React from 'react'

const PROD_API_BASE = 'https://poker-machine-learning-production.up.railway.app'

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE
  if (configured) return configured
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) return 'http://127.0.0.1:8000'
  return PROD_API_BASE
}

const API_BASE = resolveApiBase()

export default function Landing({ onNavigate }) {
  const monogramSuits = ['♣', '♠', '♦', '♥']
  const computeMonogramCount = () => {
    if (typeof window === 'undefined') {
      return 320
    }
    const cellSize = 70
    const columns = Math.ceil(window.innerWidth / cellSize)
    const rows = Math.ceil(window.innerHeight / cellSize)
    return Math.max(64, columns * rows)
  }

  const [monogramCount, setMonogramCount] = React.useState(() => computeMonogramCount())
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)
  const [feedbackName, setFeedbackName] = React.useState('')
  const [feedbackEmail, setFeedbackEmail] = React.useState('')
  const [feedbackMessage, setFeedbackMessage] = React.useState('')
  const [feedbackStatus, setFeedbackStatus] = React.useState('')
  const [feedbackSending, setFeedbackSending] = React.useState(false)

  React.useEffect(() => {
    const updateCount = () => setMonogramCount(computeMonogramCount())
    updateCount()
    window.addEventListener('resize', updateCount)
    return () => window.removeEventListener('resize', updateCount)
  }, [])

  const monogramCells = React.useMemo(() => Array.from({ length: monogramCount }), [monogramCount])

  const shellStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #140b06 0%, #2b160b 45%, #f5efe6 100%)',
    position: 'relative',
    overflow: 'hidden',
    color: '#f8efe6',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '"Ledger", serif',
  }

  const cardStyle = {
    maxWidth: 980,
    margin: '0 auto',
    background: 'rgba(255, 248, 239, 0.08)',
    border: '1px solid rgba(255, 248, 239, 0.14)',
    borderRadius: 28,
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(14px)',
    padding: 28,
  }

  const buttonStyle = {
    border: 'none',
    borderRadius: 9999,
    padding: '16px 22px',
    fontWeight: 700,
    cursor: 'pointer',
  }

  const hoverStyles = `
    .game-card { position: relative; overflow: hidden; transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease, background 120ms ease; }
    .game-card:hover { transform: translateY(-3px) scale(1.008); filter: brightness(1.05); box-shadow: 0 22px 60px rgba(0,0,0,0.38); }
    .game-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0.05) 65%, transparent 100%); transform: translateX(-120%); opacity: 0; pointer-events: none; }
    .game-card:hover::after { opacity: 1; animation: shimmer-sweep 480ms ease-out; }
    .feedback-fab { position: fixed; left: 16px; bottom: 16px; z-index: 20; border: 1px solid rgba(255,255,255,0.18); border-radius: 9999px; padding: 12px 16px; font-weight: 800; cursor: pointer; background: rgba(255,255,255,0.14); color: #fff; box-shadow: 0 18px 40px rgba(0,0,0,0.28); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .feedback-fab:hover { background: rgba(255,255,255,0.2); }
    .feedback-panel { position: fixed; left: 16px; bottom: 68px; z-index: 20; width: min(360px, calc(100vw - 32px)); background: rgba(20, 11, 6, 0.96); color: #fff; border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 14px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); backdrop-filter: blur(12px); }
    .feedback-panel input, .feedback-panel textarea { width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.06); color: #fff; padding: 10px 12px; font: inherit; box-sizing: border-box; }
    .feedback-panel textarea { min-height: 120px; resize: vertical; }
    .feedback-panel input::placeholder, .feedback-panel textarea::placeholder { color: rgba(255,255,255,0.55); }
    .feedback-panel button { border: none; border-radius: 9999px; padding: 10px 14px; font-weight: 800; cursor: pointer; }
    @keyframes shimmer-sweep { 0% { transform: translateX(-120%);} 100% { transform: translateX(120%);} }
  `

  async function submitFeedback(event) {
    event.preventDefault()
    const name = feedbackName.trim()
    const message = feedbackMessage.trim()
    if (!name || !message) {
      setFeedbackStatus('Please add your name and feedback.')
      return
    }

    setFeedbackSending(true)
    setFeedbackStatus('')
    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: feedbackEmail.trim() || null,
          message,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send feedback')
      }

      setFeedbackName('')
      setFeedbackEmail('')
      setFeedbackMessage('')
      setFeedbackStatus('Thanks. Your feedback was sent.')
      setFeedbackOpen(false)
    } catch {
      setFeedbackStatus('Could not send feedback right now. Please try again.')
    } finally {
      setFeedbackSending(false)
    }
  }

  return (
    <div style={shellStyle}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))',
          gridAutoRows: '70px',
          placeItems: 'center',
          opacity: 0.28,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      >
        {monogramCells.map((_, index) => (
          <span key={index} style={{ fontSize: 24, color: '#ffffff' }}>
            {monogramSuits[index % monogramSuits.length]}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
      <style>{hoverStyles}</style>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ letterSpacing: 3, textTransform: 'uppercase', fontSize: 16, opacity: 0.85, color: '#fff' }}>welcome to the river!</div>
          <h1 style={{ fontSize: 56, lineHeight: 1, margin: '10px 0 12px', color: '#fff', textShadow: '0 6px 18px rgba(0,0,0,0.6)' }}>Choose how you want to play</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
            Jump into a practice table with bots or set up a multiplayer room.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="game-card"
            style={{
              ...buttonStyle,
              minHeight: 220,
              background: 'linear-gradient(180deg, #f8efe6 0%, #e7d1b7 100%)',
              color: '#2b160b',
              textAlign: 'center',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.75,
              cursor: 'not-allowed',
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8, width: '100%' }}>Coming Soon!</div>
            <div style={{ fontWeight: 500, lineHeight: 1.5, width: '100%' }}>
              Bots with an advanced algorithm are coming soon.
            </div>
          </button>

          <button
            onClick={() => onNavigate('multiplayer')}
            className="game-card"
            style={{
              ...buttonStyle,
              minHeight: 220,
              background: 'linear-gradient(180deg, rgba(43,22,11,0.9) 0%, rgba(43,22,11,0.78) 100%)',
              color: '#fff',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.06)',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textShadow: '0 5px 14px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8, width: '100%', fontWeight: 800 }}>Multiplayer</div>
            <div style={{ fontWeight: 600, lineHeight: 1.5, width: '100%', color: 'rgba(255,255,255,0.95)' }}>
              Create a room or enter a room code to join friends.
            </div>
          </button>
        </div>
      </div>
      </div>
      <button type="button" className="feedback-fab" onClick={() => setFeedbackOpen((open) => !open)}>
        Feedback
      </button>
      {feedbackOpen && (
        <form className="feedback-panel" onSubmit={submitFeedback}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Message the developer</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginBottom: 12 }}>Share bugs, ideas, or anything you want improved.</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input value={feedbackName} onChange={(event) => setFeedbackName(event.target.value)} placeholder="Your name" />
            <input value={feedbackEmail} onChange={(event) => setFeedbackEmail(event.target.value)} placeholder="Email (optional)" />
            <textarea value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} placeholder="Write your feedback here..." />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setFeedbackOpen(false)} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                Close
              </button>
              <button type="submit" disabled={feedbackSending} style={{ background: '#f8efe6', color: '#2b160b' }}>
                {feedbackSending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {feedbackStatus && <div style={{ fontSize: 12, opacity: 0.85 }}>{feedbackStatus}</div>}
          </div>
        </form>
      )}
    </div>
  )
}
