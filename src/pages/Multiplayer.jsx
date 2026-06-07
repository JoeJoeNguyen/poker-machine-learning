import React from 'react'
import VanillaTilt from 'vanilla-tilt'
import allInSound from '../../soundEffect/allin.mp3'
import betCallSound from '../../soundEffect/BetCall.mp3'
import checkSound from '../../soundEffect/check.mp3'
import dealCardSound from '../../soundEffect/dealCard.mp3'
import flopTurnRiverSound from '../../soundEffect/FlopTurnRiver.mp3'
import foldSound from '../../soundEffect/Fold.mp3'
import hoverCardSound from '../../soundEffect/HoverOnCard.mp3'
import winHandSound from '../../soundEffect/winHand.mp3'

const PROD_API_BASE = 'https://poker-machine-learning-production.up.railway.app'

// Chooses the correct backend URL for local development or production.
function resolveApiBase() {
  const configured = import.meta.env.VITE_API_BASE
  if (configured) return configured
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) return 'http://127.0.0.1:8000'
  return PROD_API_BASE
}

const API_BASE = resolveApiBase()
const STARTING_CHIPS = 1000
const SMALL_BLIND = 10
const BIG_BLIND = 20
const THINK_TIME = 15
const NEXT_ROUND_DELAY = 10
const suits = ['♠', '♥', '♦', '♣']
const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13, A: 14 }
const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush']
const SOUND_URLS = {
  allIn: allInSound,
  betCall: betCallSound,
  check: checkSound,
  deal: dealCardSound,
  street: flopTurnRiverSound,
  fold: foldSound,
  hover: hoverCardSound,
  win: winHandSound,
}

// Creates a unique sound event that can travel with a shared game update.
function createSoundEvent(name, actor = '') {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    actor,
  }
}

// Adds a sound event to the mutable game object before it is broadcast.
function addSoundEvent(game, name, actor = '') {
  if (!game || !name) return game
  game.soundEvents = [...(Array.isArray(game.soundEvents) ? game.soundEvents : []), createSoundEvent(name, actor)]
  return game
}

// Builds the localStorage key for a room's saved game state.
function roomGameStorageKey(roomCode) {
  return roomCode ? `poker-room-game:${roomCode}` : null
}

// Loads the last saved game state for this room from localStorage.
function loadStoredGame(roomCode) {
  const storageKey = roomGameStorageKey(roomCode)
  if (!storageKey || typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Saves game state locally while dropping one-time sound events.
function saveStoredGame(roomCode, game) {
  const storageKey = roomGameStorageKey(roomCode)
  if (!storageKey || typeof window === 'undefined') return
  if (game) {
    const { soundEvents, ...storedGame } = game
    window.localStorage.setItem(storageKey, JSON.stringify(storedGame))
  } else {
    window.localStorage.removeItem(storageKey)
  }
}

// Creates a standard 52-card deck with stable card ids.
function buildDeck() {
  const deck = []
  for (const suit of suits) {
    for (const rank of ranks) deck.push({ rank, suit, id: `${rank}${suit}` })
  }
  return deck
}

// Returns a shuffled copy of a deck using Fisher-Yates.
function shuffle(deck) {
  const copy = [...deck]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Compares poker score arrays from strongest value to weakest kicker.
function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] || 0
    const right = b[i] || 0
    if (left > right) return 1
    if (left < right) return -1
  }
  return 0
}

// Evaluates exactly five cards and returns a sortable poker score.
function evaluateFive(cards) {
  const values = cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a)
  const valueCounts = {}
  const suitCounts = {}
  cards.forEach((card) => {
    valueCounts[RANK_VALUE[card.rank]] = (valueCounts[RANK_VALUE[card.rank]] || 0) + 1
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1
  })

  const isFlush = Object.values(suitCounts).some((count) => count === 5)
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a)
  let straightHigh = null
  for (let i = 0; i <= uniqueValues.length - 5; i++) {
    const run = uniqueValues.slice(i, i + 5)
    if (run[0] - run[4] === 4) {
      straightHigh = run[0]
      break
    }
  }
  if (!straightHigh && uniqueValues.includes(14) && uniqueValues.includes(5) && uniqueValues.includes(4) && uniqueValues.includes(3) && uniqueValues.includes(2)) {
    straightHigh = 5
  }

  const groups = Object.entries(valueCounts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value)

  if (isFlush && straightHigh) return [8, straightHigh]
  if (groups[0].count === 4) return [7, groups[0].value, groups[1].value]
  if (groups[0].count === 3 && groups[1]?.count === 2) return [6, groups[0].value, groups[1].value]
  if (isFlush) return [5, ...values]
  if (straightHigh) return [4, straightHigh]
  if (groups[0].count === 3) return [3, groups[0].value, ...values.filter((value) => value !== groups[0].value)]
  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const pairs = [groups[0].value, groups[1].value].sort((a, b) => b - a)
    return [2, pairs[0], pairs[1], ...values.filter((value) => value !== pairs[0] && value !== pairs[1])]
  }
  if (groups[0].count === 2) return [1, groups[0].value, ...values.filter((value) => value !== groups[0].value)]
  return [0, ...values]
}

// Generates all card combinations of a requested size.
function combinations(cards, count) {
  const result = []
  // Recursively picks cards until one full combination is complete.
  function walk(start, chosen) {
    if (chosen.length === count) {
      result.push([...chosen])
      return
    }
    for (let i = start; i < cards.length; i++) {
      chosen.push(cards[i])
      walk(i + 1, chosen)
      chosen.pop()
    }
  }
  walk(0, [])
  return result
}

// Finds the strongest five-card hand from all available cards.
function bestHandScore(cards) {
  let best = null
  combinations(cards, 5).forEach((combo) => {
    const score = evaluateFive(combo)
    if (!best || compareScores(score, best) > 0) best = score
  })
  return best || [0]
}

// Finds the next non-folded, non-busted player who can act.
function nextActiveIndex(players, fromIndex) {
  if (!players.length) return -1
  for (let step = 1; step <= players.length; step++) {
    const index = (fromIndex + step) % players.length
    if (!players[index].folded && !players[index].busted && players[index].chips > 0) return index
  }
  return -1
}

// Returns the small blind seat for the current dealer position.
function smallBlindIndex(playerCount, dealerIndex) {
  if (playerCount <= 1) return 0
  if (playerCount === 2) return dealerIndex
  return (dealerIndex + 1) % playerCount
}

// Returns the big blind seat for the current dealer position.
function bigBlindIndex(playerCount, dealerIndex) {
  if (playerCount <= 1) return 0
  if (playerCount === 2) return (dealerIndex + 1) % playerCount
  return (dealerIndex + 2) % playerCount
}

// Moves the dealer button to the next player.
function nextDealerIndex(currentDealerIndex, playerCount) {
  if (playerCount <= 0) return 0
  return (currentDealerIndex + 1) % playerCount
}

// Checks whether the current betting round can advance.
function canAdvanceStreet(players, currentBet) {
  return players
    .filter((p) => !p.folded && !p.busted && p.chips > 0)
    .every((p) => p.currentBet === currentBet && p.hasActed)
}

// Produces a viewer-safe game state with other players' private cards hidden.
function publicGameState(game, viewerName) {
  if (!game) return null
  if (!Array.isArray(game.players)) {
    return { ...game, players: [] }
  }
  const revealAllHands = Boolean(game.revealAllHands)
  return {
    ...game,
    players: game.players.map((player) => ({
      ...player,
      // never reveal folded players' cards; reveal if it's the viewer's own hand or revealAllHands flag
      cards: player.folded ? [] : (player.name === viewerName || revealAllHands ? player.cards : []),
    })),
  }
}

// Estimates the hero's win odds with a simple Monte Carlo simulation.
function estimateHandWinOdds(heroCards, communityCards, activeOpponents, trials = 1000) {
  if (!heroCards || heroCards.length < 2) return null

  const knownCards = new Set([...heroCards, ...communityCards].filter(Boolean).map((card) => card.id))
  const baseDeck = buildDeck().filter((card) => !knownCards.has(card.id))
  let equity = 0

  for (let trial = 0; trial < trials; trial++) {
    const deckCopy = shuffle(baseDeck)
    let cursor = 0

    const trialCommunity = [...communityCards]
    while (trialCommunity.length < 5) {
      trialCommunity.push(deckCopy[cursor++])
    }

    const heroScore = bestHandScore([...heroCards, ...trialCommunity])
    const opponentScores = []

    for (let index = 0; index < activeOpponents; index++) {
      const opponentCards = [deckCopy[cursor++], deckCopy[cursor++]]
      opponentScores.push(bestHandScore([...opponentCards, ...trialCommunity]))
    }

    let sharedBest = heroScore
    let winners = ['hero']

    opponentScores.forEach((score) => {
      const comparison = compareScores(score, sharedBest)
      if (comparison > 0) {
        sharedBest = score
        winners = ['opponent']
      } else if (comparison === 0) {
        winners.push('opponent')
      }
    })

    if (compareScores(heroScore, sharedBest) === 0) {
      equity += 1 / winners.length
    }
  }

  return Math.round((equity / trials) * 1000) / 10
}

// Preloads and plays multiplayer sounds, deduping broadcast sound events.
function useMultiplayerAudio() {
  const audioRef = React.useRef({})
  const seenSoundIdsRef = React.useRef(new Set())

  React.useEffect(() => {
    if (typeof Audio === 'undefined') return
    audioRef.current = Object.fromEntries(
      Object.entries(SOUND_URLS).map(([name, url]) => {
        const audio = new Audio(url)
        audio.preload = 'auto'
        return [name, audio]
      })
    )
  }, [])

  // Plays one named sound effect if browser autoplay rules allow it.
  const playSound = React.useCallback((name) => {
    const source = audioRef.current[name]
    if (!source) return
    const audio = source.cloneNode()
    audio.volume = name === 'hover' ? 0.28 : 0.72
    audio.play().catch(() => {
      // Browsers can block audio until the user has interacted with the page.
    })
  }, [])

  // Plays a broadcast sound event once per browser.
  const playSoundEvent = React.useCallback((event) => {
    if (!event?.id || !event.name || seenSoundIdsRef.current.has(event.id)) return
    seenSoundIdsRef.current.add(event.id)
    playSound(event.name)
  }, [playSound])

  return { playSound, playSoundEvent }
}

// Renders a playing card, hidden card back, or blurred opponent card.
function PlayingCard({ card, hidden = false, blurred = false, tiltEnabled = false, onHoverSound }) {
  const red = card?.suit === '♥' || card?.suit === '♦'
  const [hovered, setHovered] = React.useState(false)
  return (
    <div
      style={{ margin: 5, display: 'inline-flex', transition: 'transform 160ms ease', transform: hovered && !hidden ? 'scale(1.14)' : 'scale(1)' }}
      onMouseEnter={() => {
        setHovered(true)
        if (!hidden) onHoverSound?.()
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        data-tilt={tiltEnabled && !hidden ? 'true' : undefined}
        style={{ width: 72, height: 102, borderRadius: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hidden ? 'rgba(74,45,33,0.62)' : 'rgba(255,247,236,0.78)', color: hidden ? '#fff7ec' : red ? '#dc2626' : '#1f2937', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', fontWeight: 800, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', filter: blurred || hidden ? 'blur(2.4px)' : 'none', opacity: blurred ? 0.55 : 1, transition: 'filter 160ms ease, opacity 160ms ease, transform 160ms ease', willChange: 'transform' }}
      >
        {hidden ? '🂠' : (
          <div style={{ textAlign: 'center' }}>
            <div>{card?.rank}</div>
            <div>{card?.suit}</div>
          </div>
        )}
      </span>
    </div>
  )
}

// Renders a placeholder slot before a community card is revealed.
function EmptyCard() {
  return <div style={{ width: 72, height: 102, borderRadius: 14, margin: 5, display: 'inline-block', border: '2px dashed rgba(255,247,236,0.35)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} />
}

// Renders one player's seat, cards, badges, chips, bet, and odds.
function Seat({ player, isTurn, isHero, isHost, dealer, smallBlind, bigBlind, odds, revealAllHands, onCardHover }) {
  return (
    <div style={{ padding: 12, borderRadius: 18, background: isTurn ? 'rgba(248,239,230,0.18)' : 'rgba(255,255,255,0.07)', border: isTurn ? '2px solid #f8efe6' : '1px solid rgba(255,255,255,0.12)', minWidth: 220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <strong>{player.name}</strong>
          {isHost && <span style={{ fontSize: 10, padding: '3px 7px', borderRadius: 9999, background: '#f8efe6', color: '#2b160b', fontWeight: 900 }}>HOST</span>}
        </div>
        <span style={{ fontSize: 11, opacity: 0.9 }}>{dealer ? 'D ' : ''}{smallBlind ? 'SB ' : ''}{bigBlind ? 'BB' : ''}</span>
      </div>
      {player.folded && <div style={{ color: '#fca5a5', fontSize: 12 }}>Folded</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {player.cards?.length ? player.cards.map((card) => <PlayingCard key={card.id} card={card} blurred={!revealAllHands && !isHero && !player.folded} tiltEnabled onHoverSound={onCardHover} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}
        </div>
        <div style={{ minWidth: 92, textAlign: 'right', fontSize: 12, lineHeight: 1.45, opacity: 0.9 }}>
          <div>Chips: {player.chips}</div>
          <div>Bet: {player.currentBet}</div>
          {isHero && <div>{odds == null ? 'Odds: --' : `Odds: ${odds}%`}</div>}
        </div>
      </div>
    </div>
  )
}

// Runs the active multiplayer table, including poker state, chat, timers, and sockets.
function MultiplayerTable({ onBack, roomCode, activePlayers, maxPlayers, remoteNames, playerName, isHost, hostName, socketRef, monogramCells, monogramSuits, externalGame, onGameState }) {
  const normalizedName = playerName.trim() || 'You'
  const effectiveHostName = hostName || remoteNames[0] || normalizedName
  const [game, setGame] = React.useState(externalGame || null)
  const [timeLeft, setTimeLeft] = React.useState(THINK_TIME)
  const [dealerIndex, setDealerIndex] = React.useState(0)
  const [raiseTo, setRaiseTo] = React.useState(BIG_BLIND * 2)
  const [chatDraft, setChatDraft] = React.useState('')
  const [chatMessages, setChatMessages] = React.useState([
    {
      id: 'chat-system-1',
      author: 'Table',
      text: 'Bluff here!',
      system: true,
    },
  ])
  const tableRootRef = React.useRef(null)
  const chatScrollRef = React.useRef(null)
  const seenChatIdsRef = React.useRef(new Set())
  const { playSound, playSoundEvent } = useMultiplayerAudio()
  const lastHoverSoundAtRef = React.useRef(0)

  const orderedNames = React.useMemo(() => {
    const names = remoteNames.length ? remoteNames : [normalizedName]
    const unique = [...new Set(names.filter(Boolean))]
    if (!unique.some((name) => name.toLowerCase() === normalizedName.toLowerCase())) unique.unshift(normalizedName)
    return unique.slice(0, maxPlayers)
  }, [remoteNames, normalizedName, maxPlayers])

  const heroIndex = game?.players?.findIndex((p) => p.name.toLowerCase() === normalizedName.toLowerCase()) ?? -1
  const isHeroTurn = game && game.stage !== 'waiting' && game.stage !== 'showdown' && game.currentTurn === heroIndex
  const hero = game?.players?.[heroIndex]
  const currentBet = Number(game?.currentBet || 0)
  const lastRaiseSize = Number(game?.lastRaiseSize || BIG_BLIND)
  const heroChips = Number(hero?.chips || 0)
  const heroCurrentBet = Number(hero?.currentBet || 0)
  const callAmount = hero && game ? Math.max(0, currentBet - heroCurrentBet) : 0
  const minRaiseTo = game ? currentBet + lastRaiseSize : BIG_BLIND
  const heroMaxRaiseTo = hero && game ? heroCurrentBet + heroChips : minRaiseTo
  const canRaise = Boolean(isHeroTurn && hero && heroMaxRaiseTo >= minRaiseTo && hero.chips > callAmount)
  const canShowStartButton = isHost && (!game || game.stage === 'waiting')
  const heroOdds = React.useMemo(() => {
    if (!game?.players?.length || game.stage === 'waiting' || !hero || hero.folded || hero.busted || hero.cards?.length < 2) {
      return null
    }

    const activePlayers = game.players.filter((player) => !player.folded && !player.busted)
    const opponents = Math.max(activePlayers.length - 1, 0)
    return estimateHandWinOdds(hero.cards, game.communityCards || [], opponents, 1000)
  }, [game, hero])

  // Plays card-hover audio with a small cooldown to avoid sound stacking.
  const playCardHover = React.useCallback(() => {
    const now = Date.now()
    if (now - lastHoverSoundAtRef.current < 140) return
    lastHoverSoundAtRef.current = now
    playSound('hover')
  }, [playSound])

  React.useEffect(() => {
    const events = Array.isArray(game?.soundEvents) ? game.soundEvents : []
    events.forEach(playSoundEvent)
  }, [game?.soundEvents, playSoundEvent])

  // Broadcasts a full game-state update through the room socket.
  const broadcast = React.useCallback((nextGame) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      // allow caller to pass either a full message ({type:'game_state', game}) or a raw game object
      const message = nextGame && nextGame.type ? nextGame : { type: 'game_state', game: nextGame }
      try {
        console.log('WS send', roomCode, message)
      } catch (e) {}
      socketRef.current.send(JSON.stringify(message))
    }
  }, [socketRef, roomCode])

  React.useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const original = socket.onmessage
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data)
      try { console.log('WS recv', roomCode, message) } catch (e) {}
      if (message.type === 'presence') {
        if (original) original(event)
      }
      if (message.type === 'message') {
        const payload = message.payload || {}
        if (payload.type === 'chat') {
          const chatId = payload.id || `${payload.author || ''}:${payload.text || ''}`
          if (seenChatIdsRef.current.has(chatId)) return
          seenChatIdsRef.current.add(chatId)
          setChatMessages((prev) => [
            ...prev,
            {
              id: chatId,
              author: payload.author || 'Player',
              text: payload.text || '',
              mine: String(payload.author || '').toLowerCase() === normalizedName.toLowerCase(),
            },
          ])
        }
      }
      if (message.type === 'game_state') setGame(message.game)
    }
    return () => { socket.onmessage = original }
  }, [socketRef, normalizedName])

  React.useEffect(() => {
    seenChatIdsRef.current = new Set()
  }, [roomCode])

  React.useEffect(() => {
    if (externalGame) {
      setGame(externalGame)
    }
  }, [externalGame])

  React.useEffect(() => {
    const storedGame = loadStoredGame(roomCode)
    if (storedGame) {
      setGame(storedGame)
    }
  }, [roomCode])

  React.useEffect(() => {
    const handleStorage = (event) => {
      if (event.key !== roomGameStorageKey(roomCode) || !event.newValue) return
      try {
        setGame(JSON.parse(event.newValue))
      } catch {
        // Ignore malformed storage entries.
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [roomCode])

  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  // Applies a local game update, persists it, resets the timer, and broadcasts it.
  function commit(nextGame, shouldBroadcast = true) {
    setGame(nextGame)
    onGameState?.(nextGame)
    saveStoredGame(roomCode, nextGame)
    setTimeLeft(THINK_TIME)
    if (shouldBroadcast) broadcast(nextGame)
  }

  // Sends a chat message packet to every player in the room.
  function sendChatMessage() {
    const text = chatDraft.trim()
    if (!text) return
    const chatPacket = {
      type: 'chat',
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      author: normalizedName,
      text,
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(chatPacket))
    }
    setChatDraft('')
  }

  // Starts a new hand, deals player cards, posts blinds, and chooses first action.
  function startGame() {
    if (!isHost || orderedNames.length < 2) return
    const playerCount = orderedNames.length
    const currentDealer = Number.isFinite(game?.dealerIndex) ? game.dealerIndex : dealerIndex
    const sb = smallBlindIndex(playerCount, currentDealer)
    const bb = bigBlindIndex(playerCount, currentDealer)
    const deck = shuffle(buildDeck())
    let cursor = 0
    const players = orderedNames.map((name, index) => ({
      id: index,
      name,
      chips: game?.players?.[index]?.chips ?? STARTING_CHIPS,
      currentBet: 0,
      totalBet: 0,
      cards: [deck[cursor++], deck[cursor++]],
      folded: false,
      busted: false,
      hasActed: false,
    }))

    // Posts a blind while respecting the player's remaining chip stack.
    function postBlind(index, amount) {
      const blind = Math.min(amount, players[index].chips)
      players[index].chips -= blind
      players[index].currentBet = blind
      players[index].totalBet = blind
    }

    postBlind(sb, SMALL_BLIND)
    postBlind(bb, BIG_BLIND)
    const firstTurn = nextActiveIndex(players, bb)
    const nextGame = {
      deck: deck.slice(cursor),
      players,
      communityCards: [],
      pot: SMALL_BLIND + BIG_BLIND,
      currentBet: BIG_BLIND,
      lastRaiseSize: BIG_BLIND,
      dealerIndex: currentDealer,
      smallBlindIndex: sb,
      bigBlindIndex: bb,
      currentTurn: firstTurn,
      stage: 'preflop',
      message: `${players[sb].name} posts small blind. ${players[bb].name} posts big blind.`,
      handNumber: (game?.handNumber || 0) + 1,
    }
    addSoundEvent(nextGame, 'deal', normalizedName)
    commit(nextGame)
  }

  // When a showdown occurs, reveal all hands and show a countdown (10s).
  // Host will auto-start the next round when the countdown reaches zero.
  const [nextRoundCountdown, setNextRoundCountdown] = React.useState(null)
  React.useEffect(() => {
    if (!game || game.stage !== 'showdown') {
      // clear any running countdown when not in showdown
      setNextRoundCountdown(null)
      return
    }

    // initialize countdown
    setNextRoundCountdown(NEXT_ROUND_DELAY)
    let interval = null
    try { console.log('Showdown detected, starting countdown', roomCode, NEXT_ROUND_DELAY) } catch (e) {}

    interval = setInterval(() => {
      setNextRoundCountdown((value) => {
        if (value == null) return null
        if (value <= 1) {
          // final tick: host triggers next round
          try { console.log('Countdown finished, host auto-starting next round', roomCode) } catch (e) {}
          if (isHost) startGame()
          clearInterval(interval)
          return null
        }
        return value - 1
      })
    }, 1000)

    return () => {
      if (interval) clearInterval(interval)
      setNextRoundCountdown(null)
    }
  }, [game?.stage, isHost, roomCode])

  // Decides whether an action ends the hand, advances the street, or passes the turn.
  function advanceAfterAction(nextGame, fromIndex) {
    const active = nextGame.players.filter((p) => !p.folded && !p.busted)
    if (active.length === 1) {
      const winnerIndex = nextGame.players.findIndex((p) => !p.folded && !p.busted)
      nextGame.players[winnerIndex].chips += nextGame.pot
      nextGame.message = `${nextGame.players[winnerIndex].name} wins the pot.`
      nextGame.stage = 'showdown'
      nextGame.currentTurn = -1
      nextGame.dealerIndex = nextDealerIndex(nextGame.dealerIndex, orderedNames.length)
      nextGame.smallBlindIndex = smallBlindIndex(orderedNames.length, nextGame.dealerIndex)
      nextGame.bigBlindIndex = bigBlindIndex(orderedNames.length, nextGame.dealerIndex)
      setDealerIndex(nextGame.dealerIndex)
      addSoundEvent(nextGame, 'win', nextGame.players[winnerIndex].name)
      return nextGame
    }

    if (canAdvanceStreet(nextGame.players, nextGame.currentBet)) {
      return dealNextStreet(nextGame)
    }

    nextGame.currentTurn = nextActiveIndex(nextGame.players, fromIndex)
    return nextGame
  }

  // Reveals the flop, turn, or river, then resets betting for the new street.
  function dealNextStreet(nextGame) {
    nextGame.players = nextGame.players.map((p) => ({ ...p, currentBet: 0, hasActed: false }))
    nextGame.currentBet = 0
    nextGame.lastRaiseSize = BIG_BLIND

    if (nextGame.stage === 'preflop') {
      nextGame.communityCards = nextGame.deck.slice(0, 3)
      nextGame.deck = nextGame.deck.slice(3)
      nextGame.stage = 'flop'
      nextGame.message = 'Flop dealt.'
    } else if (nextGame.stage === 'flop') {
      nextGame.communityCards = [...nextGame.communityCards, nextGame.deck[0]]
      nextGame.deck = nextGame.deck.slice(1)
      nextGame.stage = 'turn'
      nextGame.message = 'Turn dealt.'
    } else if (nextGame.stage === 'turn') {
      nextGame.communityCards = [...nextGame.communityCards, nextGame.deck[0]]
      nextGame.deck = nextGame.deck.slice(1)
      nextGame.stage = 'river'
      nextGame.message = 'River dealt.'
    } else {
      return showdown(nextGame)
    }

    nextGame.currentTurn = nextActiveIndex(nextGame.players, nextGame.dealerIndex)
    addSoundEvent(nextGame, 'street')
    return nextGame
  }

  // Compares all remaining hands, awards the pot, and reveals the winners.
  function showdown(nextGame) {
    const contenders = nextGame.players.filter((p) => !p.folded && !p.busted)
    let best = null
    let winners = []
    contenders.forEach((player) => {
      const score = bestHandScore([...player.cards, ...nextGame.communityCards])
      const comparison = best ? compareScores(score, best.score) : 1
      if (comparison > 0) {
        best = { score, name: HAND_NAMES[score[0]] }
        winners = [player]
      } else if (comparison === 0) {
        winners.push(player)
      }
    })
    const share = Math.floor(nextGame.pot / winners.length)
    nextGame.players = nextGame.players.map((player) => winners.some((w) => w.id === player.id) ? { ...player, chips: player.chips + share } : player)
    nextGame.stage = 'showdown'
    nextGame.revealAllHands = true
    nextGame.currentTurn = -1
    nextGame.message = `${winners.map((w) => w.name).join(', ')} win with ${best?.name || 'best hand'}.`
    nextGame.dealerIndex = nextDealerIndex(nextGame.dealerIndex, orderedNames.length)
    nextGame.smallBlindIndex = smallBlindIndex(orderedNames.length, nextGame.dealerIndex)
    nextGame.bigBlindIndex = bigBlindIndex(orderedNames.length, nextGame.dealerIndex)
    setDealerIndex(nextGame.dealerIndex)
    addSoundEvent(nextGame, 'win', winners.map((w) => w.name).join(', '))
    return nextGame
  }

  // Applies the current player's fold, call/check, or raise action.
  function applyAction(action, amount = 0) {
    if (!game || !isHeroTurn || heroIndex < 0 || !game.players?.[heroIndex]) return
    const nextGame = structuredClone(game)
    const player = nextGame.players[heroIndex]

    if (action === 'fold') {
      player.folded = true
      player.hasActed = true
      nextGame.message = `${player.name} folds.`
      addSoundEvent(nextGame, 'fold', player.name)
    }

    if (action === 'call') {
      const pay = Math.min(player.chips, nextGame.currentBet - player.currentBet)
      player.chips -= pay
      player.currentBet += pay
      player.totalBet += pay
      player.hasActed = true
      nextGame.pot += pay
      nextGame.message = pay === 0 ? `${player.name} checks.` : `${player.name} calls ${pay}.`
      addSoundEvent(nextGame, pay === 0 ? 'check' : (player.chips === 0 ? 'allIn' : 'betCall'), player.name)
    }

    if (action === 'raise') {
      const previousBet = nextGame.currentBet
      const maxRaiseTo = player.currentBet + player.chips
      const targetBet = Math.min(Math.max(Number(amount) || minRaiseTo, minRaiseTo), maxRaiseTo)
      const raiseSize = targetBet - previousBet
      const pay = Math.min(player.chips, targetBet - player.currentBet)
      player.chips -= pay
      player.currentBet += pay
      player.totalBet += pay
      player.hasActed = true
      nextGame.pot += pay
      nextGame.currentBet = player.currentBet
      nextGame.lastRaiseSize = Math.max(raiseSize, nextGame.lastRaiseSize || BIG_BLIND)
      nextGame.players = nextGame.players.map((p, index) => index === heroIndex || p.folded || p.busted ? p : { ...p, hasActed: false })
      nextGame.message = `${player.name} raises to ${player.currentBet}.`
      addSoundEvent(nextGame, player.chips === 0 ? 'allIn' : 'betCall', player.name)
    }

    commit(advanceAfterAction(nextGame, heroIndex))
  }

  React.useEffect(() => {
    if (!isHeroTurn) return
    setTimeLeft(THINK_TIME)
    const interval = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(interval)
          // running out of time is treated as an automatic fold
          setTimeout(() => applyAction('fold'), 0)
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isHeroTurn, game?.currentTurn, callAmount])



  React.useEffect(() => {
    if (!game || !hero) return
    const nextDefault = Math.min(Math.max(raiseTo, minRaiseTo), heroMaxRaiseTo)
    if (Number.isFinite(nextDefault)) setRaiseTo(nextDefault)
  }, [game?.currentBet, game?.lastRaiseSize, hero?.chips, hero?.currentBet, minRaiseTo, heroMaxRaiseTo])

  const visibleGame = publicGameState(game || externalGame, normalizedName)
  const revealAllHands = Boolean(visibleGame?.revealAllHands)
  const fallbackPlayers = React.useMemo(
    () => orderedNames.map((name, id) => ({ id, name, chips: STARTING_CHIPS, currentBet: 0, cards: [] })),
    [orderedNames]
  )
  const tablePlayers = Array.isArray(visibleGame?.players) && visibleGame.players.length > 0 ? visibleGame.players : fallbackPlayers

  React.useEffect(() => {
    const root = tableRootRef.current
    if (!root) return
    const tiltNodes = Array.from(root.querySelectorAll('[data-tilt="true"]'))
    if (!tiltNodes.length) return
    VanillaTilt.init(tiltNodes, {
      max: 9,
      speed: 320,
      scale: 1,
      gyroscope: false,
    })

    return () => {
      tiltNodes.forEach((node) => {
        if (node.vanillaTilt) node.vanillaTilt.destroy()
      })
    }
  }, [visibleGame?.communityCards, tablePlayers, revealAllHands])

  return (
    <div ref={tableRootRef} style={{ minHeight: '100vh', padding: 24, background: 'linear-gradient(135deg,#140b06 0%, #1f1108 60%, #2b160b 100%)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <MonogramLayer cells={monogramCells} suits={monogramSuits} />
      <div style={{ maxWidth: 1180, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={onBack} style={{ border: '1px solid rgba(255,255,255,0.16)', borderRadius: 9999, padding: '10px 14px', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>← Back</button>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 13, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
            <strong>Room: {roomCode}</strong>
            <span>Players: {activePlayers}</span>
            <span>{isHost ? 'Host' : 'Guest'}</span>
          </div>
          {canShowStartButton ? (
            <button disabled={orderedNames.length < 2} onClick={startGame} style={{ border: 'none', borderRadius: 9999, padding: '12px 18px', background: orderedNames.length >= 2 ? '#f8efe6' : 'rgba(255,255,255,0.25)', color: '#2b160b', fontWeight: 800, cursor: orderedNames.length >= 2 ? 'pointer' : 'not-allowed' }}>
              Start Game
            </button>
          ) : (
            <div style={{ width: 116 }} />
          )}
        </div>

        <div style={{ padding: 18, borderRadius: 24, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', marginBottom: 18, backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
            <div><strong>Stage:</strong> {visibleGame?.stage || 'waiting'}</div>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, opacity: 0.95, fontWeight: 700 }}>Pot</div><div style={{ fontSize: 42, fontWeight: 900 }}>{visibleGame?.pot || 0}</div></div>
            <div style={{ textAlign: 'right' }}>
              <strong>Timer:</strong>{' '}
              <span style={{ fontWeight: 800 }}>{nextRoundCountdown != null ? `Next: ${nextRoundCountdown}s` : (isHeroTurn ? `${timeLeft}s` : 'Waiting')}</span>
            </div>
          </div>
          <div style={{ marginTop: 12, opacity: 0.92 }}>{visibleGame?.message || 'Host can start when at least 2 players joined.'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(310px, 360px)', gap: 18, alignItems: 'start' }}>
          <div style={{ textAlign: 'center', padding: 22, borderRadius: 32, background: 'rgba(34,85,43,0.55)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
            <h2 style={{ marginTop: 0, color: '#fff' }}>Community Cards</h2>
            <div>{[0, 1, 2, 3, 4].map((i) => visibleGame?.communityCards?.[i] ? <PlayingCard key={visibleGame.communityCards[i].id} card={visibleGame.communityCards[i]} tiltEnabled onHoverSound={playCardHover} /> : <EmptyCard key={i} />)}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 338, padding: 16, borderRadius: 28, background: 'rgba(255,248,239,0.08)', border: '1px solid rgba(255,248,239,0.16)', boxShadow: '0 24px 70px rgba(0,0,0,0.3)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.8 }}>Room Chat</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Talk to the table</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.78, textAlign: 'right' }}>Visible to everyone in this room</div>
            </div>

            <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4, display: 'grid', gap: 10, marginBottom: 14, maxHeight: 280 }}>
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    alignSelf: message.mine ? 'end' : 'start',
                    justifySelf: message.mine ? 'end' : 'start',
                    maxWidth: '88%',
                    padding: '10px 12px',
                    borderRadius: 18,
                    background: message.system ? 'rgba(255,255,255,0.08)' : message.mine ? 'linear-gradient(180deg, #f8efe6 0%, #e7d1b7 100%)' : 'rgba(255,255,255,0.10)',
                    color: message.system || !message.mine ? '#fff' : '#2b160b',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, opacity: 0.85, marginBottom: 4 }}>
                    {message.author}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{message.text}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    sendChatMessage()
                  }
                }}
                placeholder="Say something to the room..."
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  padding: '12px 14px',
                  outline: 'none',
                  minHeight: 54,
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={sendChatMessage}
                style={{
                  border: 'none',
                  borderRadius: 14,
                  padding: '12px 16px',
                  background: '#f8efe6',
                  color: '#2b160b',
                  fontWeight: 800,
                  cursor: 'pointer',
                  minHeight: 54,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 18, padding: 16, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
          {tablePlayers.map((player, index) => (
            <Seat
              key={player.id ?? player.name}
              player={player}
              isTurn={visibleGame?.currentTurn === index}
              isHero={index === heroIndex || player.name.toLowerCase() === normalizedName.toLowerCase()}
              isHost={player.name.toLowerCase() === effectiveHostName.toLowerCase()}
              dealer={visibleGame?.dealerIndex === index}
              smallBlind={visibleGame?.smallBlindIndex === index}
              bigBlind={visibleGame?.bigBlindIndex === index}
              odds={index === heroIndex || player.name.toLowerCase() === normalizedName.toLowerCase() ? heroOdds : null}
              revealAllHands={revealAllHands}
              onCardHover={playCardHover}
            />
          ))}
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 12, justifyItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', filter: !isHeroTurn ? 'blur(2px)' : 'none', opacity: !isHeroTurn ? 0.55 : 1 }}>
            <button disabled={!isHeroTurn} onClick={() => applyAction('fold')} style={actionButton(!isHeroTurn)}>Fold</button>
            <button disabled={!isHeroTurn} onClick={() => applyAction('call')} style={actionButton(!isHeroTurn)}>{callAmount === 0 ? 'Check' : `Call ${callAmount}`}</button>
            <button disabled={!canRaise} onClick={() => applyAction('raise', raiseTo)} style={actionButton(!canRaise)}>Raise to {raiseTo}</button>
          </div>

          <div style={{ width: 'min(520px, 100%)', padding: 14, borderRadius: 18, background: 'rgba(255,248,239,0.10)', border: '1px solid rgba(255,248,239,0.16)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', filter: !canRaise ? 'blur(2px)' : 'none', opacity: !canRaise ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, fontSize: 13 }}>
              <strong>Raise Slider</strong>
              <span>Min: {minRaiseTo} | Max: {heroMaxRaiseTo}</span>
            </div>
            <input
              type="range"
              min={minRaiseTo}
              max={Math.max(minRaiseTo, heroMaxRaiseTo || minRaiseTo)}
              step={SMALL_BLIND}
              disabled={!canRaise}
              value={Math.min(Math.max(Number(raiseTo) || minRaiseTo, minRaiseTo), Math.max(minRaiseTo, heroMaxRaiseTo || minRaiseTo))}
              onChange={(event) => setRaiseTo(Number(event.target.value))}
              style={{ width: '100%', cursor: canRaise ? 'pointer' : 'not-allowed' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              A raise must be at least the previous raise size. Current minimum raise-to amount is {minRaiseTo}.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Draws the repeating suit background pattern used on multiplayer screens.
function MonogramLayer({ cells, suits }) {
  return (
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
      {cells.map((_, index) => (
        <span key={index} style={{ fontSize: 24, color: '#ffffff' }}>
          {suits[index % suits.length]}
        </span>
      ))}
    </div>
  )
}

// Returns shared styling for the fold, call/check, and raise buttons.
function actionButton(disabled) {
  return {
    border: 'none',
    borderRadius: 9999,
    padding: '12px 18px',
    background: disabled ? 'rgba(255,255,255,0.22)' : 'rgba(248,239,230,0.88)',
    color: '#2b160b',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    filter: disabled ? 'blur(2px)' : 'none',
    opacity: disabled ? 0.72 : 1,
  }
}

// Controls the multiplayer lobby and renders the table after joining a room.
export default function Multiplayer({ onBack }) {
  const monogramSuits = ['♣', '♠', '♦', '♥']
  // Calculates how many background cells are needed to cover the viewport.
  const computeMonogramCount = () => {
    if (typeof window === 'undefined') return 320
    const cellSize = 70
    const columns = Math.ceil(window.innerWidth / cellSize)
    const rows = Math.ceil(window.innerHeight / cellSize)
    return Math.max(64, columns * rows)
  }

  const [monogramCount, setMonogramCount] = React.useState(() => computeMonogramCount())
  const [mode, setMode] = React.useState('lobby')
  const [roomCode, setRoomCode] = React.useState('')
  const [maxPlayers, setMaxPlayers] = React.useState(6)
  const [token, setToken] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [activePlayers, setActivePlayers] = React.useState(1)
  const [playerName, setPlayerName] = React.useState('')
  const [isHost, setIsHost] = React.useState(false)
  const [hostName, setHostName] = React.useState('')
  const [namePrompt, setNamePrompt] = React.useState({ open: false, action: null, name: '' })
  const [remoteNames, setRemoteNames] = React.useState([])
  const [sharedGame, setSharedGame] = React.useState(null)
  const socketRef = React.useRef(null)

  React.useEffect(() => {
    // Updates the background pattern size when the browser window changes.
    const updateCount = () => setMonogramCount(computeMonogramCount())
    updateCount()
    window.addEventListener('resize', updateCount)
    return () => window.removeEventListener('resize', updateCount)
  }, [])

  const monogramCells = React.useMemo(() => Array.from({ length: monogramCount }), [monogramCount])

  // Connects to the room WebSocket and syncs presence plus shared game state.
  const connectSocket = React.useCallback((code, playerToken, name) => {
    if (socketRef.current) socketRef.current.close()
    const ws = new WebSocket(`${API_BASE.replace('http', 'ws')}/ws/rooms/${code}?token=${playerToken}`)
    ws.onopen = () => {
      if (name) ws.send(JSON.stringify({ type: 'name', name }))
    }
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'presence') {
        const names = Array.isArray(message.names) ? message.names : []
        const count = names.length || Number(message.count || 1)
        setActivePlayers(count)
        setRemoteNames(names)
        setHostName((currentHost) => {
          if (!names.length) return ''
          if (currentHost && names.some((name) => name.toLowerCase() === currentHost.toLowerCase())) return currentHost
          return names[0]
        })
      }
      if (message.type === 'game_state') {
        setSharedGame(message.game)
        setMode('table')
      }
    }
    ws.onclose = () => setStatus('Disconnected from room.')
    socketRef.current = ws
  }, [])

  React.useEffect(() => () => socketRef.current?.close(), [])

  // Creates a room through the backend, then joins it as the host.
  const doCreate = async (cleanedName) => {
    setPlayerName(cleanedName)
    setIsHost(true)
    setStatus('Creating room...')
    try {
      const response = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_players: 6 }),
      })
      if (!response.ok) throw new Error('Failed to create room')
      const data = await response.json()
      setRoomCode(data.code)
      setToken(data.token)
      setMaxPlayers(data.max_players)
      setActivePlayers(1)
      setRemoteNames([cleanedName])
      setHostName(cleanedName)
      connectSocket(data.code, data.token, cleanedName)
      setMode('table')
      setStatus('Waiting for players...')
    } catch {
      setStatus('Could not create room. Check backend.')
    }
  }

  // Joins an existing backend room and opens the room socket.
  const doJoin = async (cleanedName) => {
    setPlayerName(cleanedName)
    setIsHost(false)
    setStatus('Joining room...')
    try {
      const response = await fetch(`${API_BASE}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: roomCode.trim().toUpperCase() }),
      })
      if (!response.ok) throw new Error('Failed to join room')
      const data = await response.json()
      setRoomCode(data.code)
      setToken(data.token)
      setMaxPlayers(data.max_players)
      setActivePlayers(data.active_players)
      setHostName('')
      connectSocket(data.code, data.token, cleanedName)
      setMode('table')
      setStatus('Waiting for players...')
    } catch {
      setStatus('Could not join room. Check the code or backend.')
    }
  }

  // Validates the name modal and runs the pending create or join flow.
  const confirmName = () => {
    const cleanedName = namePrompt.name.trim()
    if (!cleanedName) {
      setStatus('Please enter your name to continue.')
      return
    }
    setNamePrompt({ open: false, action: null, name: '' })
    if (namePrompt.action === 'create') void doCreate(cleanedName)
    if (namePrompt.action === 'join') void doJoin(cleanedName)
  }

  if (mode === 'table') {
    const effectiveHostName = hostName || remoteNames[0] || (isHost ? playerName : '')
    const currentIsHost = Boolean(playerName && effectiveHostName && playerName.toLowerCase() === effectiveHostName.toLowerCase())
    return (
      <MultiplayerTable
        onBack={onBack}
        roomCode={roomCode}
        activePlayers={activePlayers}
        maxPlayers={maxPlayers}
        remoteNames={remoteNames}
        playerName={playerName}
        isHost={currentIsHost}
        hostName={effectiveHostName}
        socketRef={socketRef}
        monogramCells={monogramCells}
        monogramSuits={monogramSuits}
        externalGame={sharedGame}
        onGameState={setSharedGame}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'linear-gradient(135deg,#140b06 0%, #2b160b 45%, #f5efe6 100%)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Ledger", serif' }}>
      <MonogramLayer cells={monogramCells} suits={monogramSuits} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        {namePrompt.open && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,5,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ width: 360, padding: 20, borderRadius: 18, background: '#1f1108', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', boxSizing: 'border-box' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Enter your name</div>
              <input value={namePrompt.name} onChange={(event) => setNamePrompt((prev) => ({ ...prev, name: event.target.value }))} placeholder="Your name" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setNamePrompt({ open: false, action: null, name: '' })} style={{ border: 'none', borderRadius: 9999, padding: '10px 14px', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmName} style={{ border: 'none', borderRadius: 9999, padding: '10px 16px', background: '#f8efe6', color: '#2b160b', fontWeight: 700, cursor: 'pointer' }}>Continue</button>
              </div>
            </div>
          </div>
        )}
        <div style={{ maxWidth: 720, margin: '0 auto', padding: 28, background: 'rgba(255,248,239,0.08)', borderRadius: 24, border: '1px solid rgba(255,248,239,0.14)', boxShadow: '0 24px 70px rgba(0,0,0,0.35)', backdropFilter: 'blur(14px)' }}>
          <button onClick={onBack} style={{ border: 'none', borderRadius: 9999, padding: '10px 14px', background: 'transparent', color: '#fff', cursor: 'pointer' }}>← Back</button>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ letterSpacing: 2, textTransform: 'uppercase', fontSize: 12, opacity: 0.9, color: '#fff' }}>Multiplayer</div>
            <h1 style={{ fontSize: 42, margin: '8px 0 10px', color: '#fff', textShadow: '0 6px 20px rgba(0,0,0,0.6)', fontWeight: 800 }}>Create or join a room</h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.92)' }}>Use room codes to invite friends or join an existing table.</p>
          </div>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#fff' }}>Create room</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 12 }}>The creator becomes the host and controls Start Game.</div>
              <button onClick={() => setNamePrompt({ open: true, action: 'create', name: '' })} style={{ border: 'none', borderRadius: 9999, padding: '12px 16px', background: '#f8efe6', color: '#2b160b', fontWeight: 700, cursor: 'pointer' }}>Create room</button>
            </div>
            <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: '#fff' }}>Join room</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="Enter code" style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', outline: 'none', flex: 1 }} />
                <button onClick={() => roomCode.trim() ? setNamePrompt({ open: true, action: 'join', name: '' }) : setStatus('Enter a room code first.')} style={{ border: 'none', borderRadius: 9999, padding: '12px 16px', background: '#f8efe6', color: '#2b160b', fontWeight: 700, cursor: 'pointer' }}>Join</button>
              </div>
            </div>
            {status && <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>{status}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
