import Phaser from "phaser";
import "./style.css";
import { PreloadScene } from "./game/scenes/PreloadScene";
import { PubGameScene } from "./game/scenes/PubGameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: 1280,
  height: 720,
  backgroundColor: "#1a1010",
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [PreloadScene, PubGameScene]
};

new Phaser.Game(config);
