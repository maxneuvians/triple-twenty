import { createStarterDeck, isCounterplay, isOutcome, isTechnique } from "./cards";
import { chooseCpuDartPlan, chooseCpuTechniqueDiscards } from "./cpuStrategy";
import { shuffle } from "./random";
import {
  doubleOf,
  driftTarget,
  isLegalCheckoutTarget,
  singleOf,
  targetLabel,
  targetScore
} from "./scoring";
import type { Card, CardName, CpuEvent, GameState, PlayerId, PlayerState, ResolvedDart, Target } from "./types";

export {
  chooseCpuCounterplay,
  chooseCpuDartPlan,
  chooseCpuDriftCancel,
  chooseCpuTechniqueDiscards
} from "./cpuStrategy";

const handSize = 5;
const maxLogEntries = 80;

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    deck: [...player.deck],
    hand: [...player.hand],
    discard: [...player.discard],
    played: [...player.played]
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: {
      player: clonePlayer(state.players.player),
      cpu: clonePlayer(state.players.cpu)
    },
    pendingDart: state.pendingDart
      ? {
          ...state.pendingDart,
          techniques: [...state.pendingDart.techniques]
        }
      : undefined,
    log: [...state.log]
  };
}

function drawToHand(player: PlayerState, seed: number): { player: PlayerState; seed: number } {
  let nextSeed = seed;
  let next = clonePlayer(player);
  while (next.hand.length < handSize) {
    if (next.deck.length === 0) {
      if (next.discard.length === 0) break;
      next = {
        ...next,
        deck: shuffle(next.discard, nextSeed),
        discard: []
      };
      nextSeed += 1;
    }
    const drawn = next.deck.shift();
    if (!drawn) break;
    next.hand.push(drawn);
  }
  return { player: next, seed: nextSeed };
}

function createPlayer(id: PlayerId, label: string, seed: number): { player: PlayerState; seed: number } {
  const base: PlayerState = {
    id,
    label,
    score: 301,
    startOfVisitScore: 301,
    deck: [],
    hand: [],
    discard: createStarterDeck(id),
    played: [],
    dartsThrown: 0
  };
  return drawToHand(base, seed);
}

export function createGame(seed = 1): GameState {
  const player = createPlayer("player", "Player", seed + 11);
  const cpu = createPlayer("cpu", "CPU", seed + 29);
  return {
    players: {
      player: player.player,
      cpu: cpu.player
    },
    activePlayerId: "player",
    phase: "declare-target",
    log: ["New leg: first to 301, double or bull to finish."],
    seed: Math.max(player.seed, cpu.seed),
    lastDart: undefined
  };
}

function opponentOf(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "cpu" : "player";
}

function findCard(player: PlayerState, cardId: string): Card {
  const found = player.hand.find((card) => card.id === cardId);
  if (!found) {
    throw new Error(`Card ${cardId} is not in ${player.label}'s hand.`);
  }
  return found;
}

function moveCardFromHandToPlayed(player: PlayerState, cardId: string): { player: PlayerState; card: Card } {
  const card = findCard(player, cardId);
  return {
    card,
    player: {
      ...player,
      hand: player.hand.filter((item) => item.id !== cardId),
      played: [...player.played, card]
    }
  };
}

function appendLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log.slice(-(maxLogEntries - 1)), message] };
}

function cancelsCounterplay(card: Card): boolean {
  return card.name === "Safe Setup" || card.name === "Focus";
}

export function declareTarget(state: GameState, target: Target): GameState {
  if (state.phase === "game-over") return state;
  if (state.phase !== "declare-target" && state.phase !== "play-outcome") {
    throw new Error("A target can only be declared before playing an Outcome card.");
  }

  const next = cloneState(state);
  next.pendingDart = { target, techniques: [] };
  next.phase = "play-outcome";
  return appendLog(next, `${next.players[next.activePlayerId].label} aims at ${targetLabel(target)}.`);
}

export function playOutcome(state: GameState, cardId: string): GameState {
  if (!state.pendingDart || state.phase !== "play-outcome") {
    throw new Error("An Outcome card can only be played after declaring a target.");
  }
  const active = state.players[state.activePlayerId];
  const card = findCard(active, cardId);
  if (!isOutcome(card)) {
    throw new Error(`${card.name} is not an Outcome card in Counterplay Drift mode.`);
  }

  const moved = moveCardFromHandToPlayed(active, cardId);
  const next = cloneState(state);
  next.players[state.activePlayerId] = moved.player;
  next.pendingDart = { ...next.pendingDart!, outcome: moved.card };
  next.phase = "technique-window";
  return appendLog(next, `${active.label} plays ${card.name}.`);
}

export function playTechnique(state: GameState, cardId: string): GameState {
  if (!state.pendingDart || state.phase === "play-outcome" || state.phase === "declare-target") {
    throw new Error("Technique cards can only be played after an Outcome card.");
  }
  const active = state.players[state.activePlayerId];
  const card = findCard(active, cardId);
  if (!isTechnique(card)) {
    throw new Error(`${card.name} is not a Technique card.`);
  }

  const moved = moveCardFromHandToPlayed(active, cardId);
  const next = cloneState(state);
  next.players[state.activePlayerId] = moved.player;
  next.pendingDart = {
    ...next.pendingDart!,
    techniques: [...next.pendingDart!.techniques, moved.card],
    counterplayCanceledBy:
      cancelsCounterplay(moved.card) && next.pendingDart!.counterplay
        ? moved.card
        : next.pendingDart!.counterplayCanceledBy
  };
  return appendLog(next, `${active.label} plays ${card.name}.`);
}

export function playCounterplay(state: GameState, playerId: PlayerId, cardId: string): GameState {
  if (!state.pendingDart || state.phase === "play-outcome" || state.phase === "declare-target") {
    throw new Error("Counterplay can only be played after an Outcome card.");
  }
  if (playerId === state.activePlayerId) {
    throw new Error("Only the opponent may play Counterplay Drift.");
  }
  if (state.pendingDart.counterplay) {
    throw new Error("Only one Drift card may be played against a dart.");
  }

  const player = state.players[playerId];
  const card = findCard(player, cardId);
  if (!isCounterplay(card)) {
    throw new Error(`${card.name} is not a Counterplay card.`);
  }

  const moved = moveCardFromHandToPlayed(player, cardId);
  const next = cloneState(state);
  next.players[playerId] = moved.player;
  next.pendingDart = {
    ...next.pendingDart!,
    counterplay: moved.card,
    counterplayCanceledBy: next.pendingDart!.techniques.find(cancelsCounterplay)
  };
  return appendLog(next, `${player.label} counters with ${card.name}.`);
}

function hasTechnique(state: GameState, name: CardName): boolean {
  return Boolean(state.pendingDart?.techniques.some((card) => card.name === name));
}

function canCheckout(active: PlayerState, target: Target): boolean {
  return isLegalCheckoutTarget(target) && targetScore(target) === active.score;
}

function targetAfterFocus(target: Target, outcome: CardName, focusCount: number): Target | undefined {
  if (outcome === "Wire") {
    if (focusCount === 0) return undefined;
    if (focusCount === 1) return singleOf(target);
    return doubleOf(target);
  }
  if (outcome === "Fat Segment") {
    return focusCount > 0 ? doubleOf(target) : singleOf(target);
  }
  return target;
}

function computeFinalTarget(state: GameState): Target | undefined {
  const pending = state.pendingDart;
  if (!pending?.outcome) throw new Error("No dart is ready to resolve.");
  const active = state.players[state.activePlayerId];
  const checkoutNerve = hasTechnique(state, "Checkout Nerve");
  const driftIsActive = Boolean(pending.counterplay && !pending.counterplayCanceledBy);
  const checkoutNerveCanSave =
    checkoutNerve &&
    canCheckout(active, pending.target) &&
    (pending.outcome.name === "Wire" || driftIsActive);

  if (checkoutNerveCanSave) {
    return pending.target;
  }

  if (driftIsActive && pending.counterplay) {
    return driftTarget(pending.target, pending.counterplay.name === "Drift Left" ? "left" : "right");
  }

  const focusCount = pending.techniques.filter((card) => card.name === "Focus").length;
  return targetAfterFocus(pending.target, pending.outcome.name, focusCount);
}

function finishVisit(state: GameState, options: { bust?: boolean; discardTechniqueCardIds?: string[] } = {}): GameState {
  const activeId = state.activePlayerId;
  const nextActiveId = opponentOf(activeId);
  let nextSeed = state.seed;

  const players: Record<PlayerId, PlayerState> = {
    player: clonePlayer(state.players.player),
    cpu: clonePlayer(state.players.cpu)
  };

  for (const id of Object.keys(players) as PlayerId[]) {
    players[id] = {
      ...players[id],
      discard: [...players[id].discard, ...players[id].played],
      played: []
    };
  }

  const active = players[activeId];
  const activeAfterScore = options.bust
    ? { ...active, score: active.startOfVisitScore }
    : active;
  const discardIds = new Set(options.discardTechniqueCardIds ?? []);
  const discardedTechniques = activeAfterScore.hand.filter((card) => discardIds.has(card.id) && isTechnique(card));
  const activeAfterDiscards =
    discardedTechniques.length === 0
      ? activeAfterScore
      : {
          ...activeAfterScore,
          hand: activeAfterScore.hand.filter((card) => !discardIds.has(card.id) || !isTechnique(card)),
          discard: [...activeAfterScore.discard, ...discardedTechniques]
        };
  const visitTotal = options.bust ? 0 : Math.max(0, active.startOfVisitScore - active.score);
  const drawn = drawToHand({ ...activeAfterDiscards, dartsThrown: 0 }, nextSeed);
  players[activeId] = drawn.player;
  nextSeed = drawn.seed;

  players[nextActiveId] = {
    ...players[nextActiveId],
    startOfVisitScore: players[nextActiveId].score,
    dartsThrown: 0
  };

  const nextState: GameState = {
    ...state,
    players,
    activePlayerId: nextActiveId,
    phase: "declare-target",
    pendingDart: undefined,
    seed: nextSeed
  };

  const withDiscards =
    discardedTechniques.length > 0
      ? appendLog(
          nextState,
          `${players[activeId].label} discards ${discardedTechniques.length} Technique card${
            discardedTechniques.length === 1 ? "" : "s"
          }.`
        )
      : nextState;
  return appendLog(
    appendLog(withDiscards, `${players[activeId].label} visit total: ${visitTotal}.`),
    `${players[nextActiveId].label} steps to the oche.`
  );
}

export function resolveDart(state: GameState, options: { discardTechniqueCardIds?: string[] } = {}): GameState {
  if (!state.pendingDart?.outcome) {
    throw new Error("No Outcome card has been played.");
  }

  const activeId = state.activePlayerId;
  const active = state.players[activeId];
  const finalTarget = computeFinalTarget(state);
  const score = finalTarget ? targetScore(finalTarget) : 0;
  const afterScore = active.score - score;
  const checkoutLegal = isLegalCheckoutTarget(finalTarget);
  const bust = afterScore < 0 || afterScore === 1 || (afterScore === 0 && !checkoutLegal);
  const win = afterScore === 0 && checkoutLegal;
  const resolved: ResolvedDart = {
    target: state.pendingDart.target,
    finalTarget,
    score,
    checkoutLegal,
    bust,
    win,
    summary: `${active.label} scores ${score} from ${targetLabel(finalTarget)}.`
  };

  let next = cloneState(state);
  next.lastDart = resolved;

  if (win) {
    next.players[activeId] = {
      ...next.players[activeId],
      score: 0,
      played: [...next.players[activeId].played],
      dartsThrown: next.players[activeId].dartsThrown + 1
    };
    next.phase = "game-over";
    next.winner = activeId;
    next.pendingDart = undefined;
    return appendLog(next, `${active.label} checks out on ${targetLabel(finalTarget)}!`);
  }

  if (bust) {
    next = appendLog(next, `${active.label} busts. Score returns to ${active.startOfVisitScore}.`);
    return finishVisit(next, { bust: true, discardTechniqueCardIds: options.discardTechniqueCardIds });
  }

  next.players[activeId] = {
    ...next.players[activeId],
    score: afterScore,
    dartsThrown: next.players[activeId].dartsThrown + 1
  };
  next.pendingDart = undefined;

  next = appendLog(next, resolved.summary);
  if (next.players[activeId].dartsThrown >= 3) {
    return finishVisit(next, options);
  }
  next.phase = "declare-target";
  return next;
}

export function endVisit(state: GameState, options: { discardTechniqueCardIds?: string[] } = {}): GameState {
  if (state.phase === "game-over") return state;
  return finishVisit(cloneState(state), options);
}

export function discardUnplayedTechniques(state: GameState, names: CardName[] = []): GameState {
  const activeId = state.activePlayerId;
  const active = state.players[activeId];
  const remainingNames = [...names];
  const discarded: Card[] = [];
  const kept: Card[] = [];

  for (const card of active.hand) {
    const requestedIndex = remainingNames.indexOf(card.name);
    const shouldDiscard =
      isTechnique(card) && (names.length === 0 || requestedIndex >= 0);
    if (shouldDiscard) {
      discarded.push(card);
      if (requestedIndex >= 0) remainingNames.splice(requestedIndex, 1);
    } else {
      kept.push(card);
    }
  }

  const next = cloneState(state);
  next.players[activeId] = {
    ...next.players[activeId],
    hand: kept,
    discard: [...next.players[activeId].discard, ...discarded]
  };
  return discarded.length
    ? appendLog(next, `${active.label} discards ${discarded.length} Technique card${discarded.length === 1 ? "" : "s"}.`)
    : next;
}

export function chooseCpuDart(state: GameState) {
  return chooseCpuDartPlan(state);
}

export function cpuTakeTurn(state: GameState): { state: GameState; events: CpuEvent[] } {
  let next = cloneState(state);
  const events: CpuEvent[] = [];
  while (next.activePlayerId === "cpu" && next.phase !== "game-over") {
    const choice = chooseCpuDart(next);
    if (!choice) {
      const discards = chooseCpuTechniqueDiscards(next);
      next = endVisit(next, { discardTechniqueCardIds: discards });
      events.push({ type: "visit-end", message: "CPU has no Outcome cards and ends the visit.", state: next });
      break;
    }
    next = declareTarget(next, choice.target);
    events.push({ type: "declare", message: `CPU aims at ${targetLabel(choice.target)}.`, state: next });
    next = playOutcome(next, choice.outcome.id);
    events.push({ type: "play", message: `CPU plays ${choice.outcome.name}.`, state: next });
    for (const technique of choice.techniques) {
      next = playTechnique(next, technique.id);
      events.push({ type: "play", message: `CPU plays ${technique.name}.`, state: next });
    }
    next = resolveDart(next, { discardTechniqueCardIds: chooseCpuTechniqueDiscards(next) });
    events.push({ type: "resolve", message: next.lastDart?.summary ?? "CPU dart resolved.", state: next });
  }
  events.push({ type: "visit-end", message: "CPU visit complete.", state: next });
  return { state: next, events };
}
