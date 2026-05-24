import React from 'react'

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
    @keyframes shimmer-sweep { 0% { transform: translateX(-120%);} 100% { transform: translateX(120%);} }
  `

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
      <div style={{ position: 'relative', zIndex: 1 }}>
      <style>{hoverStyles}</style>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ letterSpacing: 2, textTransform: 'uppercase', fontSize: 12, opacity: 0.85, color: '#fff' }}>The River</div>
          <h1 style={{ fontSize: 56, lineHeight: 1, margin: '10px 0 12px', color: '#fff', textShadow: '0 6px 18px rgba(0,0,0,0.6)' }}>Choose how you want to play</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
            Jump into a practice table with bots or set up a multiplayer room.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <button
            onClick={() => onNavigate('bots')}
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
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8, width: '100%' }}>Play with bots</div>
            <div style={{ fontWeight: 500, lineHeight: 1.5, width: '100%' }}>
              Start a solo table and practice against AI opponents.
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
    </div>
  )
}
