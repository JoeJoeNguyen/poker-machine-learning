import React from 'react'
import Landing from './pages/Landing'
import Bots from './pages/Bots'
import Multiplayer from './pages/Multiplayer'

export default function App() {
  const [view, setView] = React.useState('landing')

  const navigate = (target) => setView(target)

  return (
    <>
      {view === 'landing' && <Landing onNavigate={navigate} />}
      {view === 'bots' && <Bots onBack={() => navigate('landing')} />}
      {view === 'multiplayer' && <Multiplayer onBack={() => navigate('landing')} />}
    </>
  )
}
