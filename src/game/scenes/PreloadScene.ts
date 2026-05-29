import Phaser from "phaser";
import { pubLocations } from "../content/pubLocations";

type PubBackgroundFilename = (typeof pubLocations)[number]["backgroundFilename"];

const panelsUrl = new URL("../../assets/ui/panels.png", import.meta.url).href;
const cpuOpponentUrl = new URL("../../assets/portraits/cpu-opponent.png", import.meta.url).href;
const cpuOpponentArthurUrl = new URL("../../assets/portraits/cpu-opponent-arthur.png", import.meta.url).href;
const cpuOpponentAshaUrl = new URL("../../assets/portraits/cpu-opponent-asha.png", import.meta.url).href;
const cpuOpponentJoUrl = new URL("../../assets/portraits/cpu-opponent-jo.png", import.meta.url).href;
const cpuOpponentLeonUrl = new URL("../../assets/portraits/cpu-opponent-leon.png", import.meta.url).href;
const cpuOpponentVivUrl = new URL("../../assets/portraits/cpu-opponent-viv.png", import.meta.url).href;
const cardFrontsUrl = new URL("../../assets/cards/card-fronts.png", import.meta.url).href;
const pubBackgroundUrls = {
  "pub-room.png": new URL("../../assets/background/pub-room.png", import.meta.url).href,
  "pub-amsterdam-harbour.png": new URL("../../assets/background/pub-amsterdam-harbour.png", import.meta.url).href,
  "pub-bavarian.png": new URL("../../assets/background/pub-bavarian.png", import.meta.url).href,
  "pub-nairobi.png": new URL("../../assets/background/pub-nairobi.png", import.meta.url).href,
  "pub-ottawa.png": new URL("../../assets/background/pub-ottawa.png", import.meta.url).href,
  "pub-japan.png": new URL("../../assets/background/pub-japan.png", import.meta.url).href
} satisfies Record<PubBackgroundFilename, string>;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    this.cameras.main.setBackgroundColor("#120b09");
    this.add
      .text(640, 360, "LOADING PUB...", {
        fontFamily: "Courier New",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#f2d18a"
      })
      .setOrigin(0.5);

    for (const location of pubLocations) {
      this.load.image(location.assetKey, pubBackgroundUrls[location.backgroundFilename]);
    }
    this.load.image("ui-panels", panelsUrl);
    this.load.image("cpu-opponent", cpuOpponentUrl);
    this.load.image("cpu-opponent-arthur", cpuOpponentArthurUrl);
    this.load.image("cpu-opponent-asha", cpuOpponentAshaUrl);
    this.load.image("cpu-opponent-jo", cpuOpponentJoUrl);
    this.load.image("cpu-opponent-leon", cpuOpponentLeonUrl);
    this.load.image("cpu-opponent-viv", cpuOpponentVivUrl);
    this.load.spritesheet("card-fronts", cardFrontsUrl, {
      frameWidth: 156,
      frameHeight: 198
    });
  }

  create() {
    this.scene.start("PubGameScene");
  }
}
