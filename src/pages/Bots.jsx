import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

function Button({ children, className = '', style = {}, ...props }) {
  const mergedStyle = { color: '#ffffff', borderRadius: 9999, ...style };
  return (
    <button {...props} style={mergedStyle} className={`rounded px-4 py-2 bg-emerald-600 hover:bg-emerald-500 ${className}`}>
      {children}
    </button>
  );
}

function Card({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

function CardContent({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

function buildDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit, id: `${rank}${suit}` });
    }
  }
  return deck;
}

function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const RANK_VALUE = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };

const HAND_NAMES = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

function cardKey(card) {
  return `${card.rank}${card.suit}`;
}

function compareScores(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function evaluateFive(cards) {
  const values = cards.map((card) => RANK_VALUE[card.rank]).sort((a, b) => b - a);
  const suitCounts = {};
  const valueCounts = {};

  cards.forEach((card) => {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    valueCounts[RANK_VALUE[card.rank]] = (valueCounts[RANK_VALUE[card.rank]] || 0) + 1;
  });

  const isFlush = Object.values(suitCounts).some((count) => count === 5);
  const uniqueValues = Array.from(new Set(values)).sort((a, b) => b - a);

  let straightHigh = null;
  for (let index = 0; index <= uniqueValues.length - 5; index++) {
    const run = uniqueValues.slice(index, index + 5);
    if (run[0] - run[4] === 4) {
      straightHigh = run[0];
      break;
    }
  }

  if (!straightHigh && uniqueValues.includes(14) && uniqueValues.includes(5) && uniqueValues.includes(4) && uniqueValues.includes(3) && uniqueValues.includes(2)) {
    straightHigh = 5;
  }

  const groups = Object.entries(valueCounts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((left, right) => right.count - left.count || right.value - left.value);

  if (isFlush && straightHigh) return [8, straightHigh];
  if (groups[0].count === 4) return [7, groups[0].value, groups[1].value];
  if (groups[0].count === 3 && groups[1] && groups[1].count === 2) return [6, groups[0].value, groups[1].value];
  if (isFlush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].count === 3) return [3, groups[0].value, ...values.filter((value) => value !== groups[0].value)];
  if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    const pairValues = [groups[0].value, groups[1].value].sort((left, right) => right - left);
    return [2, pairValues[0], pairValues[1], ...values.filter((value) => value !== pairValues[0] && value !== pairValues[1])];
  }
  if (groups[0].count === 2) return [1, groups[0].value, ...values.filter((value) => value !== groups[0].value)];
  return [0, ...values];
}

function combinations(cards, count) {
  const results = [];

  function walk(start, chosen) {
    if (chosen.length === count) {
      results.push(chosen.slice());
      return;
    }

    for (let index = start; index < cards.length; index++) {
      chosen.push(cards[index]);
      walk(index + 1, chosen);
      chosen.pop();
    }
  }

  walk(0, []);
  return results;
}

function bestHandScore(cards) {
  if (cards.length < 5) return [0];
  if (cards.length === 5) return evaluateFive(cards);

  let best = null;
  for (const combination of combinations(cards, 5)) {
    const score = evaluateFive(combination);
    if (!best || compareScores(score, best) > 0) {
      best = score;
    }
  }
  return best || [0];
}

function handName(score) {
  return HAND_NAMES[score?.[0] || 0] || 'Unknown Hand';
}

function findShowdownWinners(players, communityCards) {
  const activePlayers = players.filter((player) => !player.folded && player.cards.length === 2);
  let bestScore = null;
  let winners = [];

  activePlayers.forEach((player) => {
    const score = bestHandScore([...player.cards, ...communityCards]);
    const result = { id: player.id, name: player.name, score, hand: handName(score) };

    if (!bestScore || compareScores(score, bestScore) > 0) {
      bestScore = score;
      winners = [result];
    } else if (compareScores(score, bestScore) === 0) {
      winners.push(result);
    }
  });

  return winners;
}

function estimateHeroWinOdds(heroCards, communityCards, activeOpponents, trials = 650) {
  if (!heroCards || heroCards.length < 2) return null;

  const knownCards = new Set([...heroCards, ...communityCards].filter(Boolean).map(cardKey));
  const baseDeck = buildDeck().filter((card) => !knownCards.has(cardKey(card)));
  let equity = 0;

  for (let trial = 0; trial < trials; trial++) {
    const deckCopy = shuffle(baseDeck);
    let cursor = 0;

    const trialCommunity = [...communityCards];
    while (trialCommunity.length < 5) {
      trialCommunity.push(deckCopy[cursor++]);
    }

    const heroScore = bestHandScore([...heroCards, ...trialCommunity]);
    const opponentScores = [];

    for (let index = 0; index < activeOpponents; index++) {
      const opponentCards = [deckCopy[cursor++], deckCopy[cursor++]];
      opponentScores.push(bestHandScore([...opponentCards, ...trialCommunity]));
    }

    let sharedBest = heroScore;
    let winners = ['hero'];

    opponentScores.forEach((score) => {
      const comparison = compareScores(score, sharedBest);
      if (comparison > 0) {
        sharedBest = score;
        winners = ['opponent'];
      } else if (comparison === 0) {
        winners.push('opponent');
      }
    });

    const heroBeatsOpponents = compareScores(heroScore, sharedBest) === 0;
    if (heroBeatsOpponents) {
      equity += 1 / winners.length;
    }
  }

  return Math.round((equity / trials) * 1000) / 10;
}

function PlayingCard({ card, hidden = false, colorMode = 'dark' }) {
  const isRed = card?.suit === '♥' || card?.suit === '♦';
  const isLight = colorMode === 'light';

  const faceBg = isLight ? '#fff7ec' : '#7a4b2b';
  const faceText = isLight ? '#1f2937' : '#fff7ec';
  const hiddenBg = isLight ? '#d6cab8' : '#472b1f';

  const cardShadow = isLight ? '0 6px 18px rgba(15,23,42,0.06)' : '0 6px 18px rgba(0,0,0,0.25)';

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{ display: 'inline-flex', margin: 6, width: 80, height: 112, borderRadius: 16, boxShadow: cardShadow, alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.08)', background: hidden ? hiddenBg : faceBg }}
    >
      {hidden ? (
        <span style={{ fontSize: 18, color: isLight ? '#1f2937' : '#fff7ec' }}>🂠</span>
      ) : (
        <div style={{ color: isRed ? '#ef4444' : faceText, textAlign: 'center', fontWeight: 700 }}>
          <div>{card?.rank}</div>
          <div>{card?.suit}</div>
        </div>
      )}
    </motion.div>
  );
}

function EmptyCard({ colorMode = 'dark' }) {
  const isLight = colorMode === 'light';
  const shadow = isLight ? '0 6px 18px rgba(15,23,42,0.06)' : '0 6px 12px rgba(0,0,0,0.18)';
  return (
    <div style={{ width: 80, height: 112, borderRadius: 16, border: '2px dashed rgba(148, 113, 74, 0.4)', background: isLight ? 'rgba(245, 241, 230, 0.9)' : 'rgba(245,241,230,0.15)', display: 'inline-block', margin: 6, boxShadow: shadow }} />
  );
}

function ToggleSwitch({ checked, onChange }) {
  const trackBg = checked ? '#6b4226' : '#e9dcc7';
  const knobTransform = checked ? 'translateX(28px)' : 'translateX(0px)';
  return (
    <button
      aria-pressed={checked}
      onClick={onChange}
      style={{
        width: 56,
        height: 28,
        borderRadius: 9999,
        padding: 3,
        background: trackBg,
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: checked ? '#fff7ec' : '#705338',
          transform: knobTransform,
          transition: 'transform 200ms ease',
        }}
      />
    </button>
  );
}

export default function Bots({
  onBack,
  playersCount = 6,
  minPlayers = 2,
  enableBots = true,
  heroName = 'You',
  playerNames = null,
  playerLabelPrefix = 'Bot',
  opponentLabel = 'Bots',
  tableTitle = 'Poker AI Web Interface',
  tableSubtitle = "Basic Texas Hold'em table UI. AI learning comes later.",
  extraControls = null,
}) {
  const PLAYERS_COUNT = Math.max(minPlayers, Math.min(6, playersCount));
  const [deck, setDeck] = useState([]);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [players, setPlayers] = useState(() =>
    Array.from({ length: PLAYERS_COUNT }).map((_, i) => ({
      id: i,
      name: playerNames?.[i] || (i === 0 ? heroName : `${playerLabelPrefix} ${i + 1}`),
      chips: 1000,
      cards: [],
      roundBet: 0,
      folded: false,
    }))
  );
  const [communityCards, setCommunityCards] = useState([]);
  const [pot, setPot] = useState(0);
  const [message, setMessage] = useState('Click New Hand to start.');
  const [stage, setStage] = useState('waiting');
  const [colorMode, setColorMode] = useState('dark');

  const [raiseAmount, setRaiseAmount] = useState(20);
  const [canRevealNext, setCanRevealNext] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(null);
  const [winOdds, setWinOdds] = useState(null);
  const [oddsBusy, setOddsBusy] = useState(false);
  const [roundHadAction, setRoundHadAction] = useState(false);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0);
  const [botsActing, setBotsActing] = useState(false);

  React.useEffect(() => {
    setPlayers(
      Array.from({ length: PLAYERS_COUNT }).map((_, i) => ({
        id: i,
        name: i === 0 ? heroName : `${playerLabelPrefix} ${i + 1}`,
        chips: 1000,
        cards: [],
        roundBet: 0,
        folded: false,
      }))
    );
    setDeck([]);
    setCommunityCards([]);
    setPot(0);
    setStage('waiting');
    setMessage('Click New Hand to start.');
    setCanRevealNext(false);
    setWinnerIndex(null);
    setRoundHadAction(false);
    setCurrentTurnIndex(0);
    setBotsActing(false);
  }, [PLAYERS_COUNT, heroName, playerLabelPrefix, playerNames]);

  const canAct = stage !== 'waiting' && stage !== 'showdown' && players[0].cards.length > 0;

  const bettingRoundComplete = useMemo(() => {
    if (!canAct) return false;

    const activePlayers = players.filter((player) => !player.folded);
    if (activePlayers.length <= 1) return true;

    const highestBet = Math.max(...players.map((player) => player.roundBet || 0));
    if (highestBet === 0 && !roundHadAction) return false;
    return players.every((player) => {
      if (player.folded) return true;
      if ((player.chips || 0) <= 0) return true;
      return (player.roundBet || 0) >= highestBet;
    });
  }, [canAct, players, roundHadAction]);

  const canTakeAction = canAct && !bettingRoundComplete;

  const SMALL_BLIND = 5;
  const BIG_BLIND = 10;

  function newHand() {
    const shuffled = shuffle(buildDeck());

    const nextDealer = (dealerIndex + 1) % PLAYERS_COUNT;

    const sbIdx = (nextDealer + 1) % PLAYERS_COUNT;
    const bbIdx = (nextDealer + 2) % PLAYERS_COUNT;

    const dealtPlayers = players.map((p, idx) => ({ ...p, cards: [shuffled[idx * 2], shuffled[idx * 2 + 1]], roundBet: 0, folded: false }));

    const updatedPlayers = dealtPlayers.map((p, i) => {
      let chips = p.chips;
      let roundBet = 0;
      if (i === sbIdx) {
        const post = Math.min(chips, SMALL_BLIND);
        chips -= post;
        roundBet = post;
      }
      if (i === bbIdx) {
        const post = Math.min(chips, BIG_BLIND);
        chips -= post;
        roundBet = post;
      }
      return { ...p, chips, roundBet, folded: false };
    });

    const initialPot = updatedPlayers.reduce((sum, p) => sum + (p.roundBet || 0), 0);

    setDeck(shuffled.slice(PLAYERS_COUNT * 2));
    setPlayers(updatedPlayers.map((p) => ({ ...p })));
    setCommunityCards([]);
    setPot(initialPot);
    setStage('preflop');
    setCanRevealNext(false);
    setWinnerIndex(null);
    setDealerIndex(nextDealer);
    setRoundHadAction(false);
    setCurrentTurnIndex(0);
    setBotsActing(false);
    setMessage(`New hand: Dealer ${nextDealer}, SB posts ${SMALL_BLIND}, BB posts ${BIG_BLIND}.`);
  }

  function dealNextStreet() {
    setCanRevealNext(false);
    if (deck.length <= 0) return;
    if (stage === 'preflop') {
      setCommunityCards(deck.slice(0, 3));
      setDeck(deck.slice(3));
      setStage('flop');
      setPlayers((prev) => prev.map((p) => ({ ...p, roundBet: 0 })));
      setRoundHadAction(false);
      setCurrentTurnIndex(0);
      setBotsActing(false);
      setMessage('Flop dealt. Players act...');
    } else if (stage === 'flop') {
      setCommunityCards((cards) => [...cards, deck[0]]);
      setDeck(deck.slice(1));
      setStage('turn');
      setPlayers((prev) => prev.map((p) => ({ ...p, roundBet: 0 })));
      setRoundHadAction(false);
      setCurrentTurnIndex(0);
      setBotsActing(false);
      setMessage('Turn dealt. Players act...');
    } else if (stage === 'turn') {
      setCommunityCards((cards) => [...cards, deck[0]]);
      setDeck(deck.slice(1));
      setStage('river');
      setPlayers((prev) => prev.map((p) => ({ ...p, roundBet: 0 })));
      setRoundHadAction(false);
      setCurrentTurnIndex(0);
      setBotsActing(false);
      setMessage('River dealt. Players act...');
    } else if (stage === 'river') {
      showdown();
    }
  }
  const botTimerRef = React.useRef(null);
  const stopBotsRef = React.useRef(false);
  const potRef = React.useRef(pot);

  React.useEffect(() => {
    potRef.current = pot;
  }, [pot]);

  function runBotTurn(botIndex) {
    if (!enableBots) return;
    setCurrentTurnIndex(botIndex);
    setRoundHadAction(true);
    setPlayers((prev) => {
      let newPlayers = prev.map((p) => ({ ...p }));
      let newPot = potRef.current;
      const p = newPlayers[botIndex];

      if (p && !p.folded && (p.chips || 0) > 0) {
        const r = Math.random();
        if (r < 0.12) {
          newPlayers[botIndex].folded = true;
        } else if (r < 0.4) {
          const maxRaise = Math.min(p.chips, 100);
          const raiseAmt = Math.max(10, Math.floor((Math.random() * maxRaise) / 10) * 10 || 10);
          newPlayers[botIndex].chips -= raiseAmt;
          newPlayers[botIndex].roundBet = (newPlayers[botIndex].roundBet || 0) + raiseAmt;
          newPot += raiseAmt;
        } else {
          const highest = Math.max(...newPlayers.map((x) => x.roundBet || 0));
          const toCall = Math.max(0, highest - (newPlayers[botIndex].roundBet || 0));
          const callAmt = Math.min(newPlayers[botIndex].chips, toCall);
          newPlayers[botIndex].chips -= callAmt;
          newPlayers[botIndex].roundBet = (newPlayers[botIndex].roundBet || 0) + callAmt;
          newPot += callAmt;
        }
      }

      potRef.current = newPot;
      setPot(newPot);

      const active = newPlayers.filter((player) => !player.folded).length;
      const highest = Math.max(...newPlayers.map((x) => x.roundBet || 0));
      const bettingComplete = newPlayers.every((player) => {
        if (player.folded) return true;
        if ((player.chips || 0) <= 0) return true;
        return (player.roundBet || 0) >= highest;
      });

      if (active <= 1) {
        const winnerIdx = newPlayers.findIndex((player) => !player.folded);
        if (winnerIdx >= 0) {
          newPlayers[winnerIdx] = { ...newPlayers[winnerIdx], chips: newPlayers[winnerIdx].chips + newPot };
        }
        setPot(0);
        setWinnerIndex(winnerIdx >= 0 ? winnerIdx : null);
        setStage('showdown');
        setCanRevealNext(false);
        setBotsActing(false);
        setCurrentTurnIndex(0);
        stopBotsRef.current = true;
        setMessage('All others folded. Showdown.');
      } else if (botIndex >= newPlayers.length - 1) {
        setCanRevealNext(bettingComplete);
        setBotsActing(false);
        setCurrentTurnIndex(0);
        setMessage(
          bettingComplete
            ? `${opponentLabel} acted. Click Next Street to reveal the next card.`
            : 'You must call, raise, or fold to finish the betting round.'
        );
      }
      return newPlayers;
    });

    if (botIndex < players.length - 1) {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      botTimerRef.current = setTimeout(() => {
        if (!stopBotsRef.current) {
          runBotTurn(botIndex + 1);
        }
      }, 3000);
    }
  }

  function startBotsTurnSequence() {
    if (!enableBots) {
      setBotsActing(false);
      setCurrentTurnIndex(0);
      setMessage('Waiting for other players...');
      return;
    }

    stopBotsRef.current = false;
    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    setBotsActing(true);
    setCurrentTurnIndex(1);
    runBotTurn(1);
  }

  function playerCheckCall() {
    if (!canTakeAction) return;
    setRoundHadAction(true);
    const highest = Math.max(...players.map((x) => x.roundBet || 0));
    const toCall = Math.max(0, highest - (players[0].roundBet || 0));
    const callAmt = Math.min(players[0].chips, toCall);
    setPlayers((prev) => prev.map((p, i) => (i === 0 ? { ...p, chips: p.chips - callAmt, roundBet: (p.roundBet || 0) + callAmt } : p)));
    setPot((p) => p + callAmt);
    setMessage(`You check/call. ${opponentLabel} thinking...`);
    startBotsTurnSequence();
  }

  function playerRaise() {
    if (!canTakeAction) return;
    setRoundHadAction(true);
    if (raiseTimerRef.current) {
      clearTimeout(raiseTimerRef.current);
      raiseTimerRef.current = null;
    }
    const currentChips = players[0]?.chips || 0;
    const amountTaken = Math.min(raiseAmount, currentChips);
    if (amountTaken <= 0) return;
    setPlayers((prev) => prev.map((p, i) => (i === 0 ? { ...p, chips: p.chips - amountTaken, roundBet: (p.roundBet || 0) + amountTaken } : p)));
    setPot((p) => p + amountTaken);
    setMessage(`You raise ${amountTaken}. ${opponentLabel} thinking...`);
    startBotsTurnSequence();
  }

  function playerFold() {
    if (!canTakeAction) return;
    setRoundHadAction(true);
    setPlayers((prev) => {
      const next = prev.map((p, i) => (i === 0 ? { ...p, folded: true } : p));
      const winnerIdx = next.findIndex((p, i) => i !== 0 && !p.folded);
      if (winnerIdx >= 0) {
        next[winnerIdx] = { ...next[winnerIdx], chips: next[winnerIdx].chips + pot };
        setWinnerIndex(winnerIdx);
      } else {
        setWinnerIndex(null);
      }
      return next;
    });
    setPot(0);
    setStage('showdown');
    setCanRevealNext(false);
    setBotsActing(false);
    setCurrentTurnIndex(0);
    setMessage(`You folded. ${opponentLabel} win the pot.`);
  }

  function showdown() {
    const winners = findShowdownWinners(players, communityCards);

    if (winners.length === 0) {
      setStage('showdown');
      setWinnerIndex(null);
      setPot(0);
      setMessage('Hand ended with no active players.');
      return;
    }

    const splitAmount = Math.floor(pot / winners.length);
    const remainder = pot - splitAmount * winners.length;
    const winnerIds = new Set(winners.map((winner) => winner.id));

    setStage('showdown');
    setBotsActing(false);
    setCurrentTurnIndex(0);
    setPlayers((prev) =>
      prev.map((player) => {
        if (!winnerIds.has(player.id)) return player;
        const extraChip = player.id === winners[0].id ? remainder : 0;
        return { ...player, chips: player.chips + splitAmount + extraChip };
      })
    );
    setWinnerIndex(winners[0].id);
    setPot(0);

    if (winners.length === 1) {
      setMessage(`Showdown: ${winners[0].name} wins with ${winners[0].hand}.`);
    } else {
      setMessage(`Showdown: split pot between ${winners.map((winner) => winner.name).join(', ')} with ${winners[0].hand}.`);
    }
  }

  const stageLabel = useMemo(() => {
    if (stage === 'waiting') return 'Waiting';
    if (stage === 'showdown') return 'Hand Over';
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  }, [stage]);

  const isDark = colorMode === 'dark';
  const baseTextColor = isDark ? '#f9f2e8' : '#0f172a';
  const sbIndex = (dealerIndex + 1) % PLAYERS_COUNT;
  const bbIndex = (dealerIndex + 2) % PLAYERS_COUNT;

  const playerChips = players[0]?.chips || 0;

  React.useEffect(() => {
    setRaiseAmount((prev) => Math.min(prev, playerChips || prev));
  }, [playerChips]);

  const heroOddsKey = useMemo(() => {
    const heroCards = (players[0]?.cards || []).map(cardKey).join('|');
    const boardCards = communityCards.map(cardKey).join('|');
    const activeOpponents = players.slice(1).filter((player) => !player.folded).length;
    return `${heroCards}__${boardCards}__${activeOpponents}`;
  }, [players, communityCards]);

  React.useEffect(() => {
    const heroCards = players[0]?.cards || [];
    const activeOpponents = players.slice(1).filter((player) => !player.folded).length;

    if (heroCards.length < 2 || players[0]?.folded) {
      setWinOdds(null);
      setOddsBusy(false);
      return;
    }

    let cancelled = false;
    setOddsBusy(true);

    const timer = window.setTimeout(() => {
      const estimated = estimateHeroWinOdds(heroCards, communityCards, activeOpponents, 650);
      if (!cancelled) {
        setWinOdds(estimated);
        setOddsBusy(false);
      }
    }, 25);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [heroOddsKey]);

  const raiseTimerRef = React.useRef(null);

  const seatPositions = [
    { left: '50%', top: '88%', transform: 'translate(-50%, -50%)' },
    { left: '86%', top: '76%', transform: 'translate(-50%, -50%)' },
    { left: '90%', top: '22%', transform: 'translate(-50%, -50%)' },
    { left: '50%', top: '12%', transform: 'translate(-50%, -50%)' },
    { left: '10%', top: '22%', transform: 'translate(-50%, -50%)' },
    { left: '14%', top: '76%', transform: 'translate(-50%, -50%)' },
  ];

  const seatLayouts = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
  };

  const seatOrder = seatLayouts[PLAYERS_COUNT] || seatLayouts[6];

  return (
    <div style={{ minHeight: '100vh', background: isDark ? 'linear-gradient(135deg,#3b1f0f,#1b0e06)' : 'linear-gradient(135deg,#ffffff,#f3f4f6)', color: baseTextColor, padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 28, margin: 0 }}>{tableTitle}</h1>
            <p style={{ margin: 0, opacity: 0.95, color: isDark ? '#f5eadc' : 'rgba(0,0,0,0.6)' }}>{tableSubtitle}</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{
                  border: 'none',
                  borderRadius: 9999,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.08)',
                  color: isDark ? '#fff7ec' : '#0f172a',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13 }}>{isDark ? 'Dark' : 'Light'}</div>
              <ToggleSwitch checked={isDark} onChange={() => setColorMode((m) => (m === 'dark' ? 'light' : 'dark'))} />
            </div>
            {extraControls}
            <Button
              onClick={newHand}
              style={{
                borderRadius: 20,
                background: isDark ? '#fff7ec' : '#0f172a',
                color: isDark ? '#1f2937' : '#ffffff',
              }}
            >
              New Hand
            </Button>
          </div>
        </header>

        <Card style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)', padding: 16, borderRadius: 20, border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.04)', boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.55)' : '0 6px 18px rgba(0,0,0,0.06)' }}>
          <CardContent>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ opacity: 0.95, color: baseTextColor }}>Stage</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{stageLabel}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ opacity: 0.95, color: baseTextColor }}>Pot</div>
                <div style={{ fontSize: 36, fontWeight: 700 }}>{pot}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ opacity: 0.95, color: baseTextColor }}>Status</div>
                <div>{message}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <main style={{ background: isDark ? 'linear-gradient(180deg, rgba(59,31,15,0.18), rgba(27,14,6,0.22))' : 'rgba(2,6,23,0.03)', padding: 18, borderRadius: 24, marginTop: 18, border: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(2,6,23,0.04)', boxShadow: isDark ? 'inset 0 2px 12px rgba(0,0,0,0.6), 0 12px 40px rgba(0,0,0,0.45)' : '0 8px 20px rgba(2,6,23,0.06)' }}>
          <section style={{ position: 'relative', minHeight: 720, borderRadius: 24, padding: 24, background: isDark ? 'radial-gradient(circle at center, rgba(255,255,255,0.05), rgba(0,0,0,0.2))' : 'radial-gradient(circle at center, rgba(15,23,42,0.04), rgba(255,255,255,0.6))' }}>
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 10px' }}>Community Cards</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {[0, 1, 2, 3, 4].map((i) =>
                    communityCards[i] ? (
                      <PlayingCard key={communityCards[i].id} card={communityCards[i]} colorMode={colorMode} />
                    ) : (
                      <EmptyCard key={i} colorMode={colorMode} />
                    )
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Button
                    onClick={() => {
                      dealNextStreet();
                      setCanRevealNext(false);
                    }}
                    disabled={!canRevealNext || stage === 'showdown' || deck.length <= 0}
                    style={{ borderRadius: 20, background: isDark ? '#3b2820' : '#0f172a', color: isDark ? '#fff7ec' : '#ffffff', padding: '10px 14px' }}
                  >
                    Next Street
                  </Button>
                </div>
              </div>
            </div>

            {players.map((p, idx) => {
              const isWinner = winnerIndex === p.id && stage === 'showdown';
              const panelBackground = isWinner
                ? (isDark ? '#064e2f' : '#ecfdf5')
                : p.folded
                ? '#000000'
                : (isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.06))' : 'rgba(255,255,255,0.9)');
              const panelBorder = isDark ? '1px solid rgba(255,255,255,0.045)' : '1px solid rgba(0,0,0,0.06)';
              const panelShadow = isDark ? '0 8px 24px rgba(0,0,0,0.55)' : '0 6px 12px rgba(2,6,23,0.06)';
              const titleColor = isWinner ? (isDark ? '#d1fae5' : '#065f46') : (p.folded ? '#fff7ec' : undefined);
              const metaColor = isWinner ? (isDark ? '#d1fae5' : '#065f46') : (p.folded ? '#fff7ec' : (isDark ? '#f9f2e8' : '#6b7280'));
              const chipsColor = isWinner ? (isDark ? '#d1fae5' : '#065f46') : (p.folded ? '#fff7ec' : undefined);
              const seatStyle = seatPositions[seatOrder[idx]] || seatPositions[0];
              const isTurn = currentTurnIndex === p.id && (botsActing || canTakeAction);

              return (
                <div key={p.id} style={{ position: 'absolute', width: 180, background: panelBackground, padding: 12, borderRadius: 14, border: panelBorder, boxShadow: panelShadow, ...seatStyle }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: titleColor }}>
                      {p.name}
                      {isTurn && (
                        <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', borderRadius: 999, background: isDark ? 'rgba(255,247,236,0.15)' : 'rgba(15,23,42,0.12)', color: isDark ? '#fff7ec' : '#0f172a' }}>
                          {p.id === 0 ? 'Your turn' : 'Thinking...'}
                        </span>
                      )}
                      <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.9, color: metaColor }}>
                        {dealerIndex === p.id ? ' (D)' : ''}
                      </span>
                      <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.9, color: metaColor }}>
                        {sbIndex === p.id ? 'SB' : bbIndex === p.id ? 'BB' : ''}
                      </span>
                    </div>
                    <div style={{ opacity: 0.9, color: chipsColor }}>Chips: {p.chips}</div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                    {p.cards.length > 0 ? (
                      p.folded && idx !== 0 ? (
                        <>
                          <EmptyCard colorMode={colorMode} />
                          <EmptyCard colorMode={colorMode} />
                        </>
                      ) : (
                        p.cards.map((card) => (
                          <PlayingCard key={card.id} card={card} hidden={stage !== 'showdown' && idx !== 0} colorMode={colorMode} />
                        ))
                      )
                    ) : (
                      <>
                        <EmptyCard colorMode={colorMode} />
                        <EmptyCard colorMode={colorMode} />
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: 8, textAlign: 'center', fontSize: 13, color: isWinner ? (isDark ? '#d1fae5' : '#065f46') : (p.folded ? '#fff7ec' : (isDark ? '#f3e7da' : '#111')) }}>{`Bet this round: ${p.roundBet || 0}`}</div>
                  {idx === 0 && (
                    <div style={{ marginTop: 6, textAlign: 'center', fontSize: 13, color: isDark ? '#f3e7da' : '#111' }}>
                      {oddsBusy ? 'Calculating win odds...' : winOdds == null ? '' : `Win odds: ${winOdds}%`}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 26, alignItems: 'center' }}>
            <Button disabled={!canTakeAction} onClick={playerFold} style={{ borderRadius: 20, background: isDark ? '#0f172a' : '#e11d48', color: isDark ? '#fff7ec' : '#fff' }}>Fold</Button>
            <Button
              disabled={!canTakeAction}
              onClick={playerCheckCall}
              style={{
                borderRadius: 20,
                background: isDark ? '#2b160b' : '#0f172a',
                color: isDark ? '#fff7ec' : '#ffffff',
              }}
            >
              Check / Call
            </Button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                type="range"
                min={0}
                max={players[0]?.chips || 0}
                step={10}
                value={Math.min(raiseAmount, players[0]?.chips || 0)}
                onChange={(e) => {
                  setRaiseAmount(Number(e.target.value));
                }}
                disabled={!canTakeAction}
                style={{ width: 300, height: 28, accentColor: isDark ? '#fff7ec' : '#0f172a' }}
              />
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 8 }}>{`Raise: ${Math.min(raiseAmount, players[0]?.chips || 0)}${raiseAmount >= (players[0]?.chips || 0) ? ' (All-in)' : ''}`}</div>
              <Button
                disabled={!canTakeAction || raiseAmount <= 0 || raiseAmount > (players[0]?.chips || 0)}
                onClick={playerRaise}
                style={{ borderRadius: 20, background: isDark ? '#6b2f1a' : '#0f172a', color: isDark ? '#fff7ec' : '#ffffff', marginTop: 6 }}
              >
                Confirm Raise
              </Button>
              
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
