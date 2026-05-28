import { describe, expect, it } from "vitest";
import { playerGuideSections } from "./playerGuide";
import type { CardName } from "../rules/types";

const expectedSectionIds = ["VISIT", "CARDS", "SCORING", "DRIFT"];
const cardNames: CardName[] = [
  "Clean Hit",
  "Fat Segment",
  "Drift Left",
  "Drift Right",
  "Wire",
  "Focus",
  "Safe Setup",
  "Checkout Nerve"
];

function guideText(): string {
  return playerGuideSections
    .flatMap((section) => [
      section.title,
      section.subtitle,
      ...section.blocks.flatMap((block) => [block.heading, ...block.items])
    ])
    .join("\n");
}

describe("player guide content", () => {
  it("contains the expected guide sections", () => {
    expect(playerGuideSections.map((section) => section.id)).toEqual(expectedSectionIds);
  });

  it("documents every card name", () => {
    const text = guideText();
    for (const name of cardNames) {
      expect(text).toContain(name);
    }
  });

  it("does not contain empty headings or items", () => {
    for (const section of playerGuideSections) {
      expect(section.title.trim()).toBe(section.title);
      expect(section.title).not.toBe("");
      expect(section.subtitle.trim()).toBe(section.subtitle);
      expect(section.subtitle).not.toBe("");
      expect(section.blocks.length).toBeGreaterThan(0);

      for (const block of section.blocks) {
        expect(block.heading.trim()).toBe(block.heading);
        expect(block.heading).not.toBe("");
        expect(block.items.length).toBeGreaterThan(0);
        for (const item of block.items) {
          expect(item.trim()).toBe(item);
          expect(item).not.toBe("");
        }
      }
    }
  });
});
