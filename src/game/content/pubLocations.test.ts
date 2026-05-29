import { describe, expect, it } from "vitest";
import { pubLocations } from "./pubLocations";

const expectedKeys = ["classic", "amsterdam-harbour", "bavarian", "nairobi", "ottawa", "japan"];

describe("pub location metadata", () => {
  it("contains the classic venue plus five new venues", () => {
    expect(pubLocations.map((location) => location.key)).toEqual(expectedKeys);
  });

  it("uses unique venue keys", () => {
    const keys = pubLocations.map((location) => location.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses unique asset keys", () => {
    const assetKeys = pubLocations.map((location) => location.assetKey);

    expect(new Set(assetKeys).size).toBe(assetKeys.length);
  });

  it("has display names, sign labels, asset keys, and background filenames", () => {
    for (const location of pubLocations) {
      expect(location.displayName.trim()).toBe(location.displayName);
      expect(location.displayName).not.toBe("");
      expect(location.signLabel.trim()).toBe(location.signLabel);
      expect(location.signLabel).not.toBe("");
      expect(location.assetKey.trim()).toBe(location.assetKey);
      expect(location.assetKey).not.toBe("");
      expect(location.backgroundFilename.trim()).toBe(location.backgroundFilename);
      expect(location.backgroundFilename).not.toBe("");
    }
  });
});
