import type { Card, CardKind, CardName, PlayerId } from "./types";

const cardKinds: Record<CardName, CardKind> = {
  "Clean Hit": "outcome",
  "Fat Segment": "outcome",
  "Drift Left": "counterplay",
  "Drift Right": "counterplay",
  Wire: "outcome",
  Focus: "technique",
  "Safe Setup": "technique",
  "Checkout Nerve": "technique"
};

export const starterDeckSpec: Array<{ name: CardName; count: number }> = [
  { name: "Clean Hit", count: 4 },
  { name: "Fat Segment", count: 5 },
  { name: "Drift Left", count: 2 },
  { name: "Drift Right", count: 2 },
  { name: "Wire", count: 2 },
  { name: "Focus", count: 3 },
  { name: "Safe Setup", count: 2 },
  { name: "Checkout Nerve", count: 1 }
];

export function cardKind(name: CardName): CardKind {
  return cardKinds[name];
}

export function createStarterDeck(owner: PlayerId): Card[] {
  let next = 1;
  return starterDeckSpec.flatMap(({ name, count }) =>
    Array.from({ length: count }, () => ({
      id: `${owner}-${String(next++).padStart(2, "0")}`,
      name,
      kind: cardKind(name)
    }))
  );
}

export function isOutcome(card: Card): boolean {
  return card.kind === "outcome";
}

export function isTechnique(card: Card): boolean {
  return card.kind === "technique";
}

export function isCounterplay(card: Card): boolean {
  return card.kind === "counterplay";
}
