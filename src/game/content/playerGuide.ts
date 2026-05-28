import type { CardName } from "../rules/types";

export type PlayerGuideSectionId = "VISIT" | "CARDS" | "SCORING" | "DRIFT";

export type PlayerGuideBlock = {
  heading: string;
  items: string[];
};

export type PlayerGuideSection = {
  id: PlayerGuideSectionId;
  title: string;
  subtitle: string;
  blocks: PlayerGuideBlock[];
};

export const playerGuideSections: PlayerGuideSection[] = [
  {
    id: "VISIT",
    title: "Visit",
    subtitle: "How a turn works at the oche.",
    blocks: [
      {
        heading: "Goal",
        items: [
          "Start at 301 and race the CPU down to exactly 0.",
          "The winning dart must land on a double or the bull."
        ]
      },
      {
        heading: "Throwing",
        items: [
          "A visit is up to three darts.",
          "For each dart, click a board target before choosing an Outcome card.",
          "After an Outcome, add any Technique cards you want, then throw."
        ]
      },
      {
        heading: "End of Visit",
        items: [
          "Played cards go to discard after the visit.",
          "Only unplayed Technique cards may be discarded voluntarily.",
          "Draw back up to five cards; shuffle discard when the draw deck runs out."
        ]
      }
    ]
  },
  {
    id: "CARDS",
    title: "Cards",
    subtitle: "What each card means.",
    blocks: [
      {
        heading: "Outcome Cards",
        items: [
          "Clean Hit: score the exact target you aimed at.",
          "Fat Segment: doubles and trebles become the single of that number.",
          "Wire: score 0 unless a Technique rescues the dart."
        ]
      },
      {
        heading: "Technique Cards",
        items: [
          "Focus: Wire becomes fat segment; Fat Segment becomes double.",
          "Safe Setup: cancel one Drift card played against your dart.",
          "Checkout Nerve: on a legal finish, turn Wire or Drift into Clean Hit."
        ]
      },
      {
        heading: "Counterplay Cards",
        items: [
          "Drift Left and Drift Right are played against the opponent's dart.",
          "A Drift changes the hit to the adjacent single number."
        ]
      }
    ]
  },
  {
    id: "SCORING",
    title: "Scoring",
    subtitle: "Count down cleanly.",
    blocks: [
      {
        heading: "Segments",
        items: [
          "Singles score the number shown.",
          "Doubles score twice the number; trebles score three times the number.",
          "Outer Bull scores 25. Bull scores 50 and can finish the leg."
        ]
      },
      {
        heading: "Checkout",
        items: [
          "You must reach exactly 0.",
          "The final scoring dart must be a double or bull.",
          "Example: from 40, D20 wins; from 20, S20 busts."
        ]
      },
      {
        heading: "Busts",
        items: [
          "You bust if you go below 0, leave 1, or hit 0 without a double or bull.",
          "A bust ends the visit and returns your score to the start of that visit."
        ]
      }
    ]
  },
  {
    id: "DRIFT",
    title: "Drift",
    subtitle: "Counterplay and nerve.",
    blocks: [
      {
        heading: "Direction",
        items: [
          "Drift Right moves clockwise on the dartboard order.",
          "Drift Left moves counter-clockwise on the dartboard order.",
          "Example from T20: Drift Right hits S1, Drift Left hits S5."
        ]
      },
      {
        heading: "Cancels",
        items: [
          "Focus or Safe Setup cancels one Drift against your dart.",
          "Checkout Nerve cancels Drift if the original target is a legal winning dart."
        ]
      },
      {
        heading: "Tips",
        items: [
          "Use Drift to stop checkouts or cut down big treble shots.",
          "Save Focus for finishes, Fat Segment upgrades, or Drift protection.",
          "Keep an Outcome card in hand; Techniques alone cannot throw a dart."
        ]
      }
    ]
  }
];

export const documentedGuideCards: CardName[] = [
  "Clean Hit",
  "Fat Segment",
  "Wire",
  "Focus",
  "Safe Setup",
  "Checkout Nerve",
  "Drift Left",
  "Drift Right"
];
