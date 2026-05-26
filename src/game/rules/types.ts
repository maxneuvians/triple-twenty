export const dartboardOrder = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
] as const;

export type DartNumber = (typeof dartboardOrder)[number];

export type Target =
  | { ring: "single"; number: DartNumber }
  | { ring: "double"; number: DartNumber }
  | { ring: "treble"; number: DartNumber }
  | { ring: "bull" }
  | { ring: "outerBull" };

export type CardName =
  | "Clean Hit"
  | "Fat Segment"
  | "Drift Left"
  | "Drift Right"
  | "Wire"
  | "Focus"
  | "Safe Setup"
  | "Checkout Nerve";

export type CardKind = "outcome" | "technique" | "counterplay";

export type Card = {
  id: string;
  name: CardName;
  kind: CardKind;
};

export type PlayerId = "player" | "cpu";

export type PlayerState = {
  id: PlayerId;
  label: string;
  score: number;
  startOfVisitScore: number;
  deck: Card[];
  hand: Card[];
  discard: Card[];
  played: Card[];
  dartsThrown: number;
};

export type GamePhase =
  | "declare-target"
  | "play-outcome"
  | "technique-window"
  | "counterplay-window"
  | "game-over";

export type PendingDart = {
  target: Target;
  outcome?: Card;
  techniques: Card[];
  counterplay?: Card;
  counterplayCanceledBy?: Card;
};

export type ResolvedDart = {
  target: Target;
  finalTarget?: Target;
  score: number;
  checkoutLegal: boolean;
  bust: boolean;
  win: boolean;
  summary: string;
};

export type GameState = {
  players: Record<PlayerId, PlayerState>;
  activePlayerId: PlayerId;
  phase: GamePhase;
  pendingDart?: PendingDart;
  lastDart?: ResolvedDart;
  winner?: PlayerId;
  log: string[];
  seed: number;
};

export type CpuEvent = {
  type: "declare" | "play" | "resolve" | "visit-end";
  message: string;
  state: GameState;
};
