import Phaser from "phaser";

const pubRoomUrl = new URL("../../assets/background/pub-room.png", import.meta.url).href;
const panelsUrl = new URL("../../assets/ui/panels.png", import.meta.url).href;
const cpuOpponentUrl = new URL("../../assets/portraits/cpu-opponent.png", import.meta.url).href;
const cardFrontsUrl = new URL("../../assets/cards/card-fronts.png", import.meta.url).href;

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

    this.load.image("pub-room", pubRoomUrl);
    this.load.image("ui-panels", panelsUrl);
    this.load.image("cpu-opponent", cpuOpponentUrl);
    this.load.spritesheet("card-fronts", cardFrontsUrl, {
      frameWidth: 156,
      frameHeight: 198
    });
  }

  create() {
    this.scene.start("PubGameScene");
  }
}
