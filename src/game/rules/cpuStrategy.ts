import { isCounterplay, isOutcome, isTechnique } from "./cards";
import {
  doubleOf,
  driftTarget,
  isLegalCheckoutTarget,
  singleOf,
  targetForScore,
  targetScore
} from "./scoring";
import { dartboardOrder, type Card, type CardName, type GameState, type Target } from "./types";

export type CpuDartPlan = {
  target: Target;
  outcome: Card;
  techniques: Card[];
  finalTarget?: Target;
  score: number;
  resultingScore: number;
  reason: "checkout" | "setup";
};

type PlannedDart = Omit<CpuDartPlan, "reason"> & {
  bust: boolean;
  win: boolean;
};

type Route = {
  darts: PlannedDart[];
  terminalScore: number;
  utility: number;
};

const allTargets: Target[] = [
  ...dartboardOrder.map((number) => ({ ring: "treble" as const, number })),
  { ring: "bull" },
  ...dartboardOrder.map((number) => ({ ring: "double" as const, number })),
  { ring: "outerBull" },
  ...dartboardOrder.map((number) => ({ ring: "single" as const, number }))
];

function sameTarget(a: Target | undefined, b: Target | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.ring !== b.ring) return false;
  if (a.ring === "bull" || a.ring === "outerBull") return true;
  return b.ring !== "bull" && b.ring !== "outerBull" && a.number === b.number;
}

function uniqueByName(cards: Card[]): Card[] {
  const seen = new Set<CardName>();
  const unique: Card[] = [];
  for (const card of cards) {
    if (seen.has(card.name)) continue;
    seen.add(card.name);
    unique.push(card);
  }
  return unique;
}

function cardsNamed(hand: Card[], name: CardName): Card[] {
  return hand.filter((card) => card.name === name);
}

function firstCardNamed(hand: Card[], name: CardName): Card | undefined {
  return hand.find((card) => card.name === name);
}

function techniqueOptions(hand: Card[], outcome: Card, target: Target, score: number): Card[][] {
  const focusCards = cardsNamed(hand, "Focus");
  const checkoutNerve = firstCardNamed(hand, "Checkout Nerve");
  const options: Card[][] = [[]];

  if (outcome.name === "Fat Segment" && focusCards[0]) {
    options.push([focusCards[0]]);
  }

  if (outcome.name === "Wire") {
    if (focusCards[0]) options.push([focusCards[0]]);
    if (focusCards[0] && focusCards[1]) options.push([focusCards[0], focusCards[1]]);
    if (checkoutNerve && isLegalCheckoutTarget(target) && targetScore(target) === score) {
      options.push([checkoutNerve]);
    }
  }

  return options;
}

function cancelsCounterplay(card: Card): boolean {
  return card.name === "Safe Setup" || card.name === "Focus";
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

function resolvePotentialDart(
  score: number,
  target: Target,
  outcome: CardName,
  techniques: Card[],
  counterplay?: Card
): { finalTarget?: Target; score: number; resultingScore: number; bust: boolean; win: boolean } {
  const driftIsActive = Boolean(counterplay && !techniques.some(cancelsCounterplay));
  const checkoutNerveCanSave =
    techniques.some((card) => card.name === "Checkout Nerve") &&
    isLegalCheckoutTarget(target) &&
    targetScore(target) === score &&
    (outcome === "Wire" || driftIsActive);
  const finalTarget = checkoutNerveCanSave
    ? target
    : driftIsActive && counterplay
      ? driftTarget(target, counterplay.name === "Drift Left" ? "left" : "right")
      : targetAfterFocus(target, outcome, techniques.filter((card) => card.name === "Focus").length);
  const dartScore = finalTarget ? targetScore(finalTarget) : 0;
  const resultingScore = score - dartScore;
  const checkoutLegal = isLegalCheckoutTarget(finalTarget);
  const bust = resultingScore < 0 || resultingScore === 1 || (resultingScore === 0 && !checkoutLegal);
  const win = resultingScore === 0 && checkoutLegal;
  return { finalTarget, score: dartScore, resultingScore, bust, win };
}

function removeUsedCards(hand: Card[], dart: PlannedDart): Card[] {
  const used = new Set([dart.outcome.id, ...dart.techniques.map((card) => card.id)]);
  return hand.filter((card) => !used.has(card.id));
}

function targetIntentBonus(dart: PlannedDart): number {
  if (sameTarget(dart.target, dart.finalTarget)) return 6;
  if (dart.finalTarget?.ring === "double" && dart.target.ring === "double") return 4;
  if (dart.finalTarget?.ring === "bull" && dart.target.ring === "bull") return 4;
  if (dart.finalTarget?.ring === "single" && dart.target.ring === "single") return 2;
  return 0;
}

function techniqueCost(darts: PlannedDart[]): number {
  return darts.reduce((total, dart) => total + dart.techniques.length, 0);
}

function compareWinningRoutes(a: PlannedDart[], b: PlannedDart[]): number {
  if (a.length !== b.length) return b.length - a.length;
  const cardCostDelta = techniqueCost(b) - techniqueCost(a);
  if (cardCostDelta !== 0) return cardCostDelta;
  const firstScoreDelta = a[0].score - b[0].score;
  if (firstScoreDelta !== 0) return firstScoreDelta;
  return targetIntentBonus(a[0]) - targetIntentBonus(b[0]);
}

function terminalUtility(score: number, opponentScore: number): number {
  if (score === 0) return 1_000_000;
  if (score < 0 || score === 1) return -1_000_000;

  let utility = -score * 10;
  if (targetForScore(score)) utility += 700;
  if (score <= 170) utility += 60;
  if (targetForScore(opponentScore)) utility -= 40;
  return utility;
}

function compareSetupRoutes(a: Route, b: Route): number {
  if (a.utility !== b.utility) return a.utility - b.utility;
  const cardCostDelta = techniqueCost(b.darts) - techniqueCost(a.darts);
  if (cardCostDelta !== 0) return cardCostDelta;
  const firstScoreDelta = a.darts[0].score - b.darts[0].score;
  if (firstScoreDelta !== 0) return firstScoreDelta;
  return targetIntentBonus(a.darts[0]) - targetIntentBonus(b.darts[0]);
}

function plannedDartsFor(score: number, hand: Card[]): PlannedDart[] {
  const outcomes = uniqueByName(hand.filter(isOutcome));
  const plans: PlannedDart[] = [];

  for (const target of allTargets) {
    for (const outcome of outcomes) {
      for (const techniques of techniqueOptions(hand, outcome, target, score)) {
        const resolved = resolvePotentialDart(score, target, outcome.name, techniques);
        if (resolved.bust) continue;
        plans.push({
          target,
          outcome,
          techniques,
          finalTarget: resolved.finalTarget,
          score: resolved.score,
          resultingScore: resolved.resultingScore,
          bust: resolved.bust,
          win: resolved.win
        });
      }
    }
  }

  return plans;
}

function findWinningRoute(score: number, hand: Card[], dartsLeft: number): PlannedDart[] | undefined {
  if (dartsLeft <= 0) return undefined;

  let best: PlannedDart[] | undefined;
  for (const dart of plannedDartsFor(score, hand)) {
    if (dart.win) {
      const route = [dart];
      if (!best || compareWinningRoutes(route, best) > 0) best = route;
      continue;
    }

    const child = findWinningRoute(dart.resultingScore, removeUsedCards(hand, dart), dartsLeft - 1);
    if (!child) continue;
    const route = [dart, ...child];
    if (!best || compareWinningRoutes(route, best) > 0) best = route;
  }

  return best;
}

function findBestSetupRoute(score: number, hand: Card[], dartsLeft: number, opponentScore: number): Route | undefined {
  if (dartsLeft <= 0) {
    return { darts: [], terminalScore: score, utility: terminalUtility(score, opponentScore) };
  }

  let best: Route | undefined;
  for (const dart of plannedDartsFor(score, hand)) {
    const remainingHand = removeUsedCards(hand, dart);
    const child = findBestSetupRoute(dart.resultingScore, remainingHand, dartsLeft - 1, opponentScore) ?? {
      darts: [],
      terminalScore: dart.resultingScore,
      utility: terminalUtility(dart.resultingScore, opponentScore)
    };
    const route: Route = {
      darts: [dart, ...child.darts],
      terminalScore: child.terminalScore,
      utility: child.utility - dart.techniques.length * 14 + targetIntentBonus(dart)
    };
    if (!best || compareSetupRoutes(route, best) > 0) best = route;
  }

  return best;
}

export function chooseCpuDartPlan(state: GameState): CpuDartPlan | undefined {
  const cpu = state.players.cpu;
  const dartsLeft = Math.max(0, 3 - cpu.dartsThrown);
  if (dartsLeft === 0 || !cpu.hand.some(isOutcome)) return undefined;

  const checkoutRoute = findWinningRoute(cpu.score, cpu.hand, dartsLeft);
  const firstCheckoutDart = checkoutRoute?.[0];
  if (firstCheckoutDart) return { ...firstCheckoutDart, reason: "checkout" };

  const setupRoute = findBestSetupRoute(cpu.score, cpu.hand, dartsLeft, state.players.player.score);
  const firstSetupDart = setupRoute?.darts[0];
  return firstSetupDart ? { ...firstSetupDart, reason: "setup" } : undefined;
}

function playerResultUtility(result: ReturnType<typeof resolvePotentialDart>): number {
  if (result.win) return 1_000_000;
  if (result.bust) return -500;
  let utility = result.score * 10 - result.resultingScore;
  if (targetForScore(result.resultingScore)) utility += 100;
  return utility;
}

export function chooseCpuCounterplay(state: GameState): Card | undefined {
  if (state.activePlayerId !== "player" || !state.pendingDart?.outcome) return undefined;

  const driftCards = state.players.cpu.hand.filter(
    (card) => card.name === "Drift Left" || card.name === "Drift Right"
  );
  if (driftCards.length === 0) return undefined;

  const pending = state.pendingDart;
  const outcome = pending.outcome;
  if (!outcome) return undefined;
  if (pending.techniques.some(cancelsCounterplay)) return undefined;

  const player = state.players.player;
  const cleanResult = resolvePotentialDart(player.score, pending.target, outcome.name, pending.techniques);
  const cleanUtility = playerResultUtility(cleanResult);
  let best: { card: Card; result: ReturnType<typeof resolvePotentialDart>; utility: number } | undefined;

  for (const drift of driftCards) {
    const result = resolvePotentialDart(player.score, pending.target, outcome.name, pending.techniques, drift);
    const utility = playerResultUtility(result);
    if (!best || utility < best.utility) {
      best = { card: drift, result, utility };
    }
  }

  if (!best) return undefined;
  const preventsCheckout = cleanResult.win && !best.result.win;
  const scoreSwing = cleanResult.score - best.result.score;
  const spoilsCheckoutLeave = Boolean(targetForScore(cleanResult.resultingScore)) && !targetForScore(best.result.resultingScore);
  return preventsCheckout || scoreSwing >= 35 || spoilsCheckoutLeave || cleanUtility - best.utility >= 250
    ? best.card
    : undefined;
}

export function chooseCpuDriftCancel(state: GameState): Card | undefined {
  if (state.activePlayerId !== "cpu" || !state.pendingDart?.outcome || !state.pendingDart.counterplay) return undefined;
  if (state.pendingDart.counterplayCanceledBy) return undefined;

  const pending = state.pendingDart;
  const outcome = pending.outcome;
  if (!outcome) return undefined;
  const cleanResult = resolvePotentialDart(state.players.cpu.score, pending.target, outcome.name, pending.techniques);
  const driftResult = resolvePotentialDart(
    state.players.cpu.score,
    pending.target,
    outcome.name,
    pending.techniques,
    pending.counterplay
  );
  const driftDamage = cleanResult.score - driftResult.score;
  const spoilsCheckout = cleanResult.win && !driftResult.win;
  const spoilsSetup = Boolean(targetForScore(cleanResult.resultingScore)) && !targetForScore(driftResult.resultingScore);
  const important = spoilsCheckout || spoilsSetup || cleanResult.score >= 57 || driftDamage >= 35;
  if (!important) return undefined;

  return firstCardNamed(state.players.cpu.hand, "Safe Setup") ?? firstCardNamed(state.players.cpu.hand, "Focus");
}

export function chooseCpuTechniqueDiscards(state: GameState): string[] {
  const cpu = state.players.cpu;
  const techniques = cpu.hand.filter(isTechnique);
  if (techniques.length === 0) return [];

  const outcomesInHand = cpu.hand.filter(isOutcome).length;
  if (outcomesInHand === 0) return techniques.map((card) => card.id);

  const kept = new Set<CardName>();
  const discards: string[] = [];
  for (const card of techniques) {
    if (kept.has(card.name)) {
      discards.push(card.id);
    } else {
      kept.add(card.name);
    }
  }
  return discards;
}

export function hasCpuCounterplay(state: GameState): boolean {
  return state.players.cpu.hand.some(isCounterplay);
}
