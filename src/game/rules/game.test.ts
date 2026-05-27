import { describe, expect, it } from "vitest";
import { cardKind, createStarterDeck } from "./cards";
import {
  cpuTakeTurn,
  createGame,
  declareTarget,
  discardUnplayedTechniques,
  endVisit,
  playCounterplay,
  playOutcome,
  playTechnique,
  resolveDart
} from "./game";
import { shuffle } from "./random";
import { doubleOf, driftNumber, targetScore, targetForScore } from "./scoring";
import type { CardName, GameState, PlayerId, Target } from "./types";

function card(name: CardName, id: string = name): { id: string; name: CardName; kind: ReturnType<typeof cardKind> } {
  return { id, name, kind: cardKind(name) };
}

function withHand(state: GameState, playerId: PlayerId, names: CardName[]): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        hand: names.map((name, index) => card(name, `${playerId}-${index}-${name}`)),
        deck: [],
        discard: []
      }
    }
  };
}

function withScore(state: GameState, playerId: PlayerId, score: number): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        score,
        startOfVisitScore: score
      }
    }
  };
}

function firstCardId(state: GameState, playerId: PlayerId, name: CardName): string {
  const found = state.players[playerId].hand.find((item) => item.name === name);
  if (!found) throw new Error(`Missing ${name}`);
  return found.id;
}

function throwDart(state: GameState, target: Target, outcome: CardName, techniques: CardName[] = []): GameState {
  let next = declareTarget(state, target);
  next = playOutcome(next, firstCardId(next, next.activePlayerId, outcome));
  for (const technique of techniques) {
    next = playTechnique(next, firstCardId(next, next.activePlayerId, technique));
  }
  return resolveDart(next);
}

describe("scoring helpers", () => {
  it("scores dartboard targets", () => {
    expect(targetScore({ ring: "single", number: 20 })).toBe(20);
    expect(targetScore({ ring: "double", number: 20 })).toBe(40);
    expect(targetScore({ ring: "treble", number: 20 })).toBe(60);
    expect(targetScore({ ring: "bull" })).toBe(50);
    expect(targetScore({ ring: "outerBull" })).toBe(25);
  });

  it("finds adjacent numbers for Drift", () => {
    expect(driftNumber(20, "right")).toBe(1);
    expect(driftNumber(20, "left")).toBe(5);
    expect(driftNumber(1, "left")).toBe(20);
  });

  it("finds standard checkout targets", () => {
    expect(targetForScore(40)).toEqual({ ring: "double", number: 20 });
    expect(targetForScore(50)).toEqual({ ring: "bull" });
    expect(targetForScore(41)).toBeUndefined();
    expect(doubleOf({ ring: "treble", number: 20 })).toEqual({ ring: "double", number: 20 });
    expect(doubleOf({ ring: "outerBull" })).toEqual({ ring: "bull" });
  });
});

describe("game setup", () => {
  it("creates deterministic shuffled hands", () => {
    const gameA = createGame(42);
    const gameB = createGame(42);
    const gameC = createGame(99);

    expect(gameA.players.player.hand.map((item) => item.id)).toEqual(
      gameB.players.player.hand.map((item) => item.id)
    );
    expect(gameA.players.player.hand.map((item) => item.id)).not.toEqual(
      gameC.players.player.hand.map((item) => item.id)
    );
    expect(gameA.players.player.hand.map((item) => item.id)).not.toEqual(
      createStarterDeck("player").slice(0, 5).map((item) => item.id)
    );
    expect(gameA.players.player.score).toBe(301);
    expect(gameA.players.player.hand).toHaveLength(5);
  });

  it("shuffles the discard pile into a new draw deck when the deck is exhausted", () => {
    const recycled = ([
      "Clean Hit",
      "Fat Segment",
      "Wire",
      "Focus",
      "Safe Setup",
      "Drift Right"
    ] satisfies CardName[]).map((name, index) => card(name, `recycle-${index}`));
    const base = createGame(7);
    const stateSeed = base.seed;
    let state: GameState = {
      ...base,
      players: {
        ...base.players,
        player: {
          ...base.players.player,
          hand: [],
          deck: [],
          discard: recycled,
          played: [],
          dartsThrown: 0
        }
      }
    };

    state = endVisit(state);

    expect(state.players.player.hand.map((item) => item.id)).toEqual(
      shuffle(recycled, stateSeed).slice(0, 5).map((item) => item.id)
    );
    expect(state.players.player.hand.map((item) => item.id)).not.toEqual(
      recycled.slice(0, 5).map((item) => item.id)
    );
    expect(state.players.player.deck.map((item) => item.id)).toEqual(
      shuffle(recycled, stateSeed).slice(5).map((item) => item.id)
    );
    expect(state.seed).toBe(stateSeed + 1);
  });

  it("keeps a longer bounded action log for UI scrolling", () => {
    let state = createGame(42);
    for (let index = 0; index < 95; index += 1) {
      state = declareTarget(state, { ring: "single", number: 20 });
    }

    expect(state.log).toHaveLength(80);
    expect(state.log.at(-1)).toBe("Player aims at S20.");
  });
});

describe("dart resolution", () => {
  it("allows retargeting before an Outcome card is selected", () => {
    let state = createGame(1);
    state = declareTarget(state, { ring: "treble", number: 20 });
    state = declareTarget(state, { ring: "double", number: 16 });

    expect(state.pendingDart?.target).toEqual({ ring: "double", number: 16 });
    expect(() => playOutcome(state, firstCardId(state, "player", "Drift Left"))).toThrow();
  });

  it("resolves Clean Hit, Fat Segment, and Wire", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit", "Fat Segment", "Wire"]);
    state = throwDart(state, { ring: "treble", number: 20 }, "Clean Hit");
    expect(state.players.player.score).toBe(241);

    state = declareTarget(state, { ring: "double", number: 16 });
    state = playOutcome(state, firstCardId(state, "player", "Fat Segment"));
    state = resolveDart(state);
    expect(state.lastDart?.score).toBe(16);

    state = declareTarget(state, { ring: "treble", number: 19 });
    state = playOutcome(state, firstCardId(state, "player", "Wire"));
    state = resolveDart(state);
    expect(state.lastDart?.score).toBe(0);
  });

  it("uses Focus to improve Wire and upgrade Fat Segment to a double", () => {
    let state = withHand(createGame(1), "player", ["Wire", "Fat Segment", "Focus", "Focus"]);

    state = throwDart(state, { ring: "treble", number: 20 }, "Wire", ["Focus"]);
    expect(state.lastDart?.score).toBe(20);

    state = declareTarget(state, { ring: "treble", number: 20 });
    state = playOutcome(state, firstCardId(state, "player", "Fat Segment"));
    state = playTechnique(state, firstCardId(state, "player", "Focus"));
    state = resolveDart(state);
    expect(state.lastDart?.finalTarget).toEqual({ ring: "double", number: 20 });
    expect(state.lastDart?.score).toBe(40);
  });

  it("lets Checkout Nerve turn a checkout Wire into Clean Hit", () => {
    let state = withScore(createGame(1), "player", 40);
    state = withHand(state, "player", ["Wire", "Checkout Nerve"]);

    state = throwDart(state, { ring: "double", number: 20 }, "Wire", ["Checkout Nerve"]);

    expect(state.players.player.score).toBe(0);
    expect(state.winner).toBe("player");
    expect(state.lastDart?.win).toBe(true);
  });

  it("busts and rolls back to the start-of-visit score", () => {
    let state = withScore(createGame(1), "player", 20);
    state = withHand(state, "player", ["Clean Hit"]);

    state = throwDart(state, { ring: "single", number: 20 }, "Clean Hit");

    expect(state.lastDart?.bust).toBe(true);
    expect(state.players.player.score).toBe(20);
    expect(state.phase).toBe("declare-target");
    expect(state.activePlayerId).toBe("cpu");
  });
});

describe("visit and discard flow", () => {
  it("keeps unplayed Outcome cards while allowing unplayed Technique cards to be discarded", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit", "Wire", "Focus", "Safe Setup"]);
    state = throwDart(state, { ring: "single", number: 20 }, "Clean Hit");
    state = discardUnplayedTechniques(state, ["Focus", "Safe Setup"]);

    expect(state.players.player.hand.map((item) => item.name)).toEqual(["Wire"]);
    expect(state.players.player.played.map((item) => item.name)).toEqual(["Clean Hit"]);
    expect(state.players.player.discard.map((item) => item.name)).toEqual(expect.arrayContaining(["Focus", "Safe Setup"]));
  });

  it("ends a visit after three darts and passes to the CPU", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit", "Clean Hit", "Clean Hit"]);
    state = throwDart(state, { ring: "single", number: 20 }, "Clean Hit");
    state = throwDart(state, { ring: "single", number: 20 }, "Clean Hit");
    state = throwDart(state, { ring: "single", number: 20 }, "Clean Hit");

    expect(state.activePlayerId).toBe("cpu");
    expect(state.players.cpu.startOfVisitScore).toBe(state.players.cpu.score);
  });

  it("logs the visit total before handing the oche to the next player", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit"]);
    state = throwDart(state, { ring: "single", number: 20 }, "Clean Hit");
    state = endVisit(state);

    expect(state.log.at(-2)).toBe("Player visit total: 20.");
    expect(state.log.at(-1)).toBe("CPU steps to the oche.");
  });
});

describe("Counterplay Drift", () => {
  it("does not allow Drift as the active player's Outcome", () => {
    let state = withHand(createGame(1), "player", ["Drift Left"]);
    state = declareTarget(state, { ring: "treble", number: 20 });

    expect(() => playOutcome(state, firstCardId(state, "player", "Drift Left"))).toThrow(/Outcome/);
  });

  it("lets the opponent Drift a dart to an adjacent single", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit"]);
    state = withHand(state, "cpu", ["Drift Right"]);
    state = declareTarget(state, { ring: "treble", number: 20 });
    state = playOutcome(state, firstCardId(state, "player", "Clean Hit"));
    state = playCounterplay(state, "cpu", firstCardId(state, "cpu", "Drift Right"));
    state = resolveDart(state);

    expect(state.lastDart?.finalTarget).toEqual({ ring: "single", number: 1 });
    expect(state.lastDart?.score).toBe(1);
  });

  it("lets Safe Setup cancel one Drift card", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit", "Safe Setup"]);
    state = withHand(state, "cpu", ["Drift Right"]);
    state = declareTarget(state, { ring: "treble", number: 20 });
    state = playOutcome(state, firstCardId(state, "player", "Clean Hit"));
    state = playCounterplay(state, "cpu", firstCardId(state, "cpu", "Drift Right"));
    state = playTechnique(state, firstCardId(state, "player", "Safe Setup"));
    state = resolveDart(state);

    expect(state.lastDart?.finalTarget).toEqual({ ring: "treble", number: 20 });
    expect(state.lastDart?.score).toBe(60);
  });

  it("lets Focus cancel one Drift card", () => {
    let state = withHand(createGame(1), "player", ["Clean Hit", "Focus"]);
    state = withHand(state, "cpu", ["Drift Right"]);
    state = declareTarget(state, { ring: "treble", number: 20 });
    state = playOutcome(state, firstCardId(state, "player", "Clean Hit"));
    state = playCounterplay(state, "cpu", firstCardId(state, "cpu", "Drift Right"));
    state = playTechnique(state, firstCardId(state, "player", "Focus"));
    state = resolveDart(state);

    expect(state.lastDart?.finalTarget).toEqual({ ring: "treble", number: 20 });
    expect(state.lastDart?.score).toBe(60);
  });
});

describe("CPU strategy", () => {
  it("chooses a checkout when it has Clean Hit", () => {
    let state = withScore(createGame(1), "cpu", 40);
    state = withHand(state, "cpu", ["Clean Hit", "Wire", "Fat Segment"]);
    state = {
      ...state,
      activePlayerId: "cpu",
      phase: "declare-target",
      players: {
        ...state.players,
        cpu: { ...state.players.cpu, startOfVisitScore: 40 }
      }
    };

    const result = cpuTakeTurn(state);
    expect(result.state.winner).toBe("cpu");
    expect(result.events.some((event) => event.message.includes("D20"))).toBe(true);
  });

  it("avoids an obvious bust when no legal checkout is available", () => {
    let state = withScore(createGame(1), "cpu", 41);
    state = withHand(state, "cpu", ["Clean Hit", "Fat Segment"]);
    state = {
      ...state,
      activePlayerId: "cpu",
      phase: "declare-target",
      players: {
        ...state.players,
        cpu: { ...state.players.cpu, startOfVisitScore: 41 }
      }
    };

    const result = cpuTakeTurn(state);
    expect(result.state.players.cpu.score).toBeGreaterThanOrEqual(0);
    expect(result.state.players.cpu.score).not.toBe(41);
  });
});
