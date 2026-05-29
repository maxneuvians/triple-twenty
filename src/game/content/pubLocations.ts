export type PubLocationKey =
  | "classic"
  | "amsterdam-harbour"
  | "bavarian"
  | "nairobi"
  | "ottawa"
  | "japan";

export type PubLocation = {
  key: PubLocationKey;
  displayName: string;
  signLabel: string;
  assetKey: string;
  backgroundFilename: string;
};

export const pubLocations = [
  {
    key: "classic",
    displayName: "Blackpool Pub",
    signLabel: "BLACKPOOL",
    assetKey: "pub-room",
    backgroundFilename: "pub-room.png"
  },
  {
    key: "amsterdam-harbour",
    displayName: "Amsterdam Harbour",
    signLabel: "AMSTERDAM",
    assetKey: "pub-amsterdam-harbour",
    backgroundFilename: "pub-amsterdam-harbour.png"
  },
  {
    key: "bavarian",
    displayName: "Traunstein Beer Hall",
    signLabel: "TRAUNSTEIN",
    assetKey: "pub-bavarian",
    backgroundFilename: "pub-bavarian.png"
  },
  {
    key: "nairobi",
    displayName: "Nairobi Pub",
    signLabel: "NAIROBI",
    assetKey: "pub-nairobi",
    backgroundFilename: "pub-nairobi.png"
  },
  {
    key: "ottawa",
    displayName: "Ottawa Tavern",
    signLabel: "OTTAWA",
    assetKey: "pub-ottawa",
    backgroundFilename: "pub-ottawa.png"
  },
  {
    key: "japan",
    displayName: "Kyoto Izakaya",
    signLabel: "KYOTO",
    assetKey: "pub-japan",
    backgroundFilename: "pub-japan.png"
  }
] as const satisfies readonly PubLocation[];
