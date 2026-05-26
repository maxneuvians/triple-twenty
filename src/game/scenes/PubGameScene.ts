import Phaser from "phaser";
import {
  chooseCpuCounterplay,
  chooseCpuDart,
  createGame,
  declareTarget,
  discardUnplayedTechniques,
  endVisit,
  playCounterplay,
  playOutcome,
  playTechnique,
  resolveDart
} from "../rules/game";
import { dartboardOrder, type Card, type CardName, type GameState, type PlayerId, type Target } from "../rules/types";
import { isCounterplay, isOutcome, isTechnique } from "../rules/cards";
import { targetForScore, targetLabel, targetScore } from "../rules/scoring";

type CardView = {
  card: Card;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Rectangle;
  playable: boolean;
};

type PixelButton = {
  root: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  setText: (text: string) => void;
  setVisible: (visible: boolean) => void;
  setAlpha: (alpha: number) => void;
};

type VisitSlot = {
  frame: Phaser.GameObjects.Rectangle;
  dart: Phaser.GameObjects.Graphics;
};

type CardColors = {
  label: string;
  body: string;
};

const cardWidth = 156;
const cardHeight = 198;
const cardFrontFrameByCard: Record<CardName, number> = {
  "Clean Hit": 0,
  "Fat Segment": 1,
  "Drift Left": 2,
  "Drift Right": 3,
  Wire: 4,
  Focus: 5,
  "Safe Setup": 6,
  "Checkout Nerve": 7
};

const cardTextColors: Record<CardName, CardColors> = {
  "Clean Hit": { label: "#f7e2b3", body: "#111510" },
  "Fat Segment": { label: "#f7e2b3", body: "#111510" },
  "Drift Left": { label: "#f7e2b3", body: "#f4e6be" },
  "Drift Right": { label: "#f7e2b3", body: "#f4e6be" },
  Wire: { label: "#f7e2b3", body: "#111510" },
  Focus: { label: "#f7e2b3", body: "#f4e6be" },
  "Safe Setup": { label: "#f7e2b3", body: "#f4e6be" },
  "Checkout Nerve": { label: "#1a1010", body: "#111510" }
};

const boardCenter = { x: 470, y: 200 };
const boardRadius = 138;
const boardBackboardRadius = 162;
const boardLabelRadius = 152;
const segmentSpan = 18;
const halfSegment = segmentSpan / 2;
const boardRings = {
  bull: 13,
  outerBull: 28,
  innerSingle: 65,
  trebleOuter: 81,
  outerSingle: 123,
  doubleOuter: 138
};

export class PubGameScene extends Phaser.Scene {
  private state!: GameState;
  private board!: Phaser.GameObjects.Graphics;
  private hitFlash!: Phaser.GameObjects.Graphics;
  private boardLabels: Phaser.GameObjects.Text[] = [];
  private handViews: CardView[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private playerMetaText!: Phaser.GameObjects.Text;
  private checkoutText!: Phaser.GameObjects.Text;
  private cpuScoreText!: Phaser.GameObjects.Text;
  private cpuMetaText!: Phaser.GameObjects.Text;
  private visitText!: Phaser.GameObjects.Text;
  private visitSlots: VisitSlot[] = [];
  private centerSignText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logStatusText!: Phaser.GameObjects.Text;
  private logUpButton!: PixelButton;
  private logDownButton!: PixelButton;
  private logZone!: Phaser.GameObjects.Zone;
  private targetText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;
  private discardText!: Phaser.GameObjects.Text;
  private actionButton!: PixelButton;
  private discardButton!: PixelButton;
  private newGameButton!: PixelButton;
  private hoveredTarget?: Target;
  private hoveredCardId?: string;
  private waitingForPlayerDrift = false;
  private cpuRunning = false;
  private logScrollOffset = 0;
  private readonly logViewportLines = 5;

  constructor() {
    super("PubGameScene");
  }

  create() {
    this.state = createGame(86);
    this.createPubBackdrop();
    this.createDartboard();
    this.createUiShell();
    this.refresh();
  }

  private createPubBackdrop() {
    this.add.image(640, 360, "pub-room").setDisplaySize(1280, 720).setDepth(0);
    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.1).setDepth(1);
    this.add.image(640, 360, "ui-panels").setDepth(4);

    const vignette = this.add.graphics().setDepth(19);
    vignette.fillStyle(0x000000, 0.24);
    vignette.fillRect(0, 0, 1280, 24);
    vignette.fillRect(0, 696, 1280, 24);
    vignette.fillRect(0, 0, 18, 720);
    vignette.fillRect(1262, 0, 18, 720);

    const scanlines = this.add.graphics();
    scanlines.setDepth(20);
    scanlines.lineStyle(1, 0x000000, 0.14);
    for (let y = 0; y < 720; y += 4) {
      scanlines.lineBetween(0, y, 1280, y);
    }
  }

  private createDartboard() {
    this.board = this.add.graphics();
    this.board.setDepth(1);
    this.drawBoard(undefined);
    this.hitFlash = this.add.graphics();
    this.hitFlash.setDepth(2);
    this.hitFlash.setBlendMode(Phaser.BlendModes.ADD);
    this.createBoardLabels();

    const zone = this.add.zone(boardCenter.x, boardCenter.y, boardBackboardRadius * 2, boardBackboardRadius * 2);
    zone.setInteractive({ cursor: "crosshair" });
    zone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        this.state.activePlayerId !== "player" ||
        (this.state.phase !== "declare-target" && this.state.phase !== "play-outcome") ||
        this.cpuRunning
      ) {
        return;
      }
      const target = this.targetFromPoint(pointer.x, pointer.y);
      if (!target) return;
      this.state = declareTarget(this.state, target);
      this.refresh();
    });
    zone.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.canChooseTarget()) {
        this.setHoveredTarget(undefined);
        return;
      }
      this.setHoveredTarget(this.targetFromPoint(pointer.x, pointer.y));
    });
    zone.on("pointerout", () => this.setHoveredTarget(undefined));
  }

  private drawBoard(highlight: Target | undefined) {
    const g = this.board;
    g.clear();
    g.fillStyle(0x151515, 1);
    g.fillCircle(boardCenter.x, boardCenter.y, boardBackboardRadius);
    g.lineStyle(5, 0xcab27a, 1);
    g.strokeCircle(boardCenter.x, boardCenter.y, boardBackboardRadius);
    g.lineStyle(1, 0x4c3822, 0.75);
    g.strokeCircle(boardCenter.x, boardCenter.y, boardLabelRadius - 13);

    for (let index = 0; index < dartboardOrder.length; index += 1) {
      const centerAngle = index * segmentSpan - 90;
      const bedColor = index % 2 === 0 ? 0x111416 : 0xead9ad;
      const ringColor = index % 2 === 0 ? 0xb72e2e : 0x0f7c55;
      this.drawAnnularSegment(g, boardRings.outerBull, boardRings.innerSingle, centerAngle, bedColor);
      this.drawAnnularSegment(g, boardRings.trebleOuter, boardRings.outerSingle, centerAngle, bedColor);
      this.drawAnnularSegment(g, boardRings.innerSingle, boardRings.trebleOuter, centerAngle, ringColor);
      this.drawAnnularSegment(g, boardRings.outerSingle, boardRings.doubleOuter, centerAngle, ringColor);
    }

    g.fillStyle(0x0f7c55, 1);
    g.fillCircle(boardCenter.x, boardCenter.y, boardRings.outerBull);
    g.fillStyle(0xb72e2e, 1);
    g.fillCircle(boardCenter.x, boardCenter.y, boardRings.bull);
    g.lineStyle(2, 0x101010, 1);
    for (const radius of [
      boardRings.bull,
      boardRings.outerBull,
      boardRings.innerSingle,
      boardRings.trebleOuter,
      boardRings.outerSingle,
      boardRings.doubleOuter
    ]) {
      g.strokeCircle(boardCenter.x, boardCenter.y, radius);
    }
    for (let index = 0; index < 20; index += 1) {
      const boundaryAngle = Phaser.Math.DegToRad(index * segmentSpan - 90 - halfSegment);
      const innerX = boardCenter.x + Math.cos(boundaryAngle) * boardRings.outerBull;
      const innerY = boardCenter.y + Math.sin(boundaryAngle) * boardRings.outerBull;
      const outerX = boardCenter.x + Math.cos(boundaryAngle) * boardRings.doubleOuter;
      const outerY = boardCenter.y + Math.sin(boundaryAngle) * boardRings.doubleOuter;
      g.lineStyle(1, 0x101010, 0.9);
      g.lineBetween(innerX, innerY, outerX, outerY);
    }
    this.drawTargetHighlight(g, highlight, 0xffd166, 0.22, 4);
    if (this.hoveredTarget && !this.targetsMatch(this.hoveredTarget, highlight)) {
      this.drawTargetHighlight(g, this.hoveredTarget, 0x9be2c1, 0.18, 3);
    }
  }

  private annularSegmentPoints(
    innerRadius: number,
    outerRadius: number,
    centerAngleDegrees: number
  ) {
    const start = Phaser.Math.DegToRad(centerAngleDegrees - halfSegment);
    const end = Phaser.Math.DegToRad(centerAngleDegrees + halfSegment);
    const points: Array<{ x: number; y: number }> = [];
    const steps = 8;
    for (let step = 0; step <= steps; step += 1) {
      const angle = Phaser.Math.Linear(start, end, step / steps);
      points.push({
        x: boardCenter.x + Math.cos(angle) * outerRadius,
        y: boardCenter.y + Math.sin(angle) * outerRadius
      });
    }
    for (let step = steps; step >= 0; step -= 1) {
      const angle = Phaser.Math.Linear(start, end, step / steps);
      points.push({
        x: boardCenter.x + Math.cos(angle) * innerRadius,
        y: boardCenter.y + Math.sin(angle) * innerRadius
      });
    }
    return points;
  }

  private drawAnnularSegment(
    g: Phaser.GameObjects.Graphics,
    innerRadius: number,
    outerRadius: number,
    centerAngleDegrees: number,
    color: number,
    alpha = 1
  ) {
    const points = this.annularSegmentPoints(innerRadius, outerRadius, centerAngleDegrees);
    g.fillStyle(color, alpha);
    g.fillPoints(points, true, true);
  }

  private strokeAnnularSegment(
    g: Phaser.GameObjects.Graphics,
    innerRadius: number,
    outerRadius: number,
    centerAngleDegrees: number,
    color: number,
    alpha: number,
    width: number
  ) {
    g.lineStyle(width, color, alpha);
    g.strokePoints(this.annularSegmentPoints(innerRadius, outerRadius, centerAngleDegrees), true, true);
  }

  private drawTargetHighlight(
    g: Phaser.GameObjects.Graphics,
    highlight: Target | undefined,
    color: number,
    fillAlpha: number,
    lineWidth: number
  ) {
    if (highlight) {
      g.lineStyle(lineWidth, color, 1);
      if (highlight.ring === "bull") {
        g.fillStyle(color, fillAlpha);
        g.fillCircle(boardCenter.x, boardCenter.y, boardRings.bull);
        g.strokeCircle(boardCenter.x, boardCenter.y, boardRings.bull);
      } else if (highlight.ring === "outerBull") {
        this.drawCircularRing(g, boardRings.bull, boardRings.outerBull, color, fillAlpha);
        g.strokeCircle(boardCenter.x, boardCenter.y, boardRings.bull);
        g.strokeCircle(boardCenter.x, boardCenter.y, boardRings.outerBull);
      } else {
        const index = dartboardOrder.indexOf(highlight.number);
        const centerAngle = index * segmentSpan - 90;
        if (highlight.ring === "double") {
          this.drawAnnularSegment(g, boardRings.outerSingle, boardRings.doubleOuter, centerAngle, color, fillAlpha);
          this.strokeAnnularSegment(g, boardRings.outerSingle, boardRings.doubleOuter, centerAngle, color, 1, lineWidth);
        } else if (highlight.ring === "treble") {
          this.drawAnnularSegment(g, boardRings.innerSingle, boardRings.trebleOuter, centerAngle, color, fillAlpha);
          this.strokeAnnularSegment(g, boardRings.innerSingle, boardRings.trebleOuter, centerAngle, color, 1, lineWidth);
        } else {
          this.drawAnnularSegment(g, boardRings.outerBull, boardRings.innerSingle, centerAngle, color, fillAlpha * 0.8);
          this.drawAnnularSegment(g, boardRings.trebleOuter, boardRings.outerSingle, centerAngle, color, fillAlpha * 0.8);
          this.strokeAnnularSegment(g, boardRings.outerBull, boardRings.innerSingle, centerAngle, color, 0.95, lineWidth);
          this.strokeAnnularSegment(g, boardRings.trebleOuter, boardRings.outerSingle, centerAngle, color, 0.95, lineWidth);
        }
      }
    }
  }

  private drawTargetFill(g: Phaser.GameObjects.Graphics, target: Target, color: number, alpha: number) {
    if (target.ring === "bull") {
      g.fillStyle(color, alpha);
      g.fillCircle(boardCenter.x, boardCenter.y, boardRings.bull);
      return;
    }
    if (target.ring === "outerBull") {
      this.drawCircularRing(g, boardRings.bull, boardRings.outerBull, color, alpha);
      return;
    }

    const index = dartboardOrder.indexOf(target.number);
    const centerAngle = index * segmentSpan - 90;
    if (target.ring === "double") {
      this.drawAnnularSegment(g, boardRings.outerSingle, boardRings.doubleOuter, centerAngle, color, alpha);
    } else if (target.ring === "treble") {
      this.drawAnnularSegment(g, boardRings.innerSingle, boardRings.trebleOuter, centerAngle, color, alpha);
    } else {
      this.drawAnnularSegment(g, boardRings.outerBull, boardRings.innerSingle, centerAngle, color, alpha);
      this.drawAnnularSegment(g, boardRings.trebleOuter, boardRings.outerSingle, centerAngle, color, alpha);
    }
  }

  private drawCircularRing(g: Phaser.GameObjects.Graphics, innerRadius: number, outerRadius: number, color: number, alpha: number) {
    const points: Array<{ x: number; y: number }> = [];
    const steps = 48;
    for (let step = 0; step <= steps; step += 1) {
      const angle = Phaser.Math.DegToRad((step / steps) * 360);
      points.push({
        x: boardCenter.x + Math.cos(angle) * outerRadius,
        y: boardCenter.y + Math.sin(angle) * outerRadius
      });
    }
    for (let step = steps; step >= 0; step -= 1) {
      const angle = Phaser.Math.DegToRad((step / steps) * 360);
      points.push({
        x: boardCenter.x + Math.cos(angle) * innerRadius,
        y: boardCenter.y + Math.sin(angle) * innerRadius
      });
    }
    g.fillStyle(color, alpha);
    g.fillPoints(points, true, true);
  }

  private flashHit(target: Target | undefined) {
    this.tweens.killTweensOf(this.hitFlash);
    this.hitFlash.clear();
    this.hitFlash.setAlpha(1);
    if (!target) return;

    this.drawTargetFill(this.hitFlash, target, 0xfff06a, 0.95);
    this.hitFlash.lineStyle(6, 0xfff6b0, 1);
    if (target.ring === "bull") {
      this.hitFlash.strokeCircle(boardCenter.x, boardCenter.y, boardRings.bull);
    } else if (target.ring === "outerBull") {
      this.hitFlash.strokeCircle(boardCenter.x, boardCenter.y, boardRings.outerBull);
    } else {
      const index = dartboardOrder.indexOf(target.number);
      const centerAngle = Phaser.Math.DegToRad(index * segmentSpan - 90);
      const labelRadius =
        target.ring === "double" ? boardRings.doubleOuter : target.ring === "treble" ? boardRings.trebleOuter : boardRings.outerSingle;
      this.hitFlash.lineBetween(
        boardCenter.x,
        boardCenter.y,
        boardCenter.x + Math.cos(centerAngle) * labelRadius,
        boardCenter.y + Math.sin(centerAngle) * labelRadius
      );
    }

    this.tweens.add({
      targets: this.hitFlash,
      alpha: 0,
      duration: 760,
      delay: 320,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.hitFlash.clear();
        this.hitFlash.setAlpha(1);
      }
    });
  }

  private createBoardLabels() {
    for (const label of this.boardLabels) label.destroy();
    this.boardLabels = dartboardOrder.map((number, index) => {
      const angle = Phaser.Math.DegToRad(index * 18 - 90);
      const x = boardCenter.x + Math.cos(angle) * boardLabelRadius;
      const y = boardCenter.y + Math.sin(angle) * boardLabelRadius;
      return this.add
        .text(x, y, String(number), {
          fontFamily: "Courier New",
          fontSize: "16px",
          color: "#f7e2b3",
          fontStyle: "bold"
        })
        .setOrigin(0.5)
        .setDepth(3);
    });
  }

  private targetFromPoint(x: number, y: number): Target | undefined {
    const dx = x - boardCenter.x;
    const dy = y - boardCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > boardRings.doubleOuter) return undefined;
    if (distance <= boardRings.bull) return { ring: "bull" };
    if (distance <= boardRings.outerBull) return { ring: "outerBull" };

    const degrees = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    const clockwiseFromTop = (degrees + 90 + 360) % 360;
    const index = Math.floor((clockwiseFromTop + halfSegment) / segmentSpan) % 20;
    const number = dartboardOrder[index];
    if (distance >= boardRings.outerSingle) return { ring: "double", number };
    if (distance >= boardRings.innerSingle && distance <= boardRings.trebleOuter) return { ring: "treble", number };
    return { ring: "single", number };
  }

  private canChooseTarget(): boolean {
    return (
      this.state.activePlayerId === "player" &&
      (this.state.phase === "declare-target" || this.state.phase === "play-outcome") &&
      !this.cpuRunning
    );
  }

  private setHoveredTarget(target: Target | undefined) {
    if (this.targetsMatch(this.hoveredTarget, target)) return;
    this.hoveredTarget = target;
    this.drawBoard(this.state.pendingDart?.target);
  }

  private targetsMatch(a: Target | undefined, b: Target | undefined): boolean {
    if (!a || !b) return a === b;
    if (a.ring !== b.ring) return false;
    if (a.ring === "bull" || a.ring === "outerBull") return true;
    return b.ring !== "bull" && b.ring !== "outerBull" && a.number === b.number;
  }

  private createUiShell() {
    this.playerScoreText = this.addText(36, 64, "", 60, "#e7bd54", true, 166, 72).setShadow(3, 3, "#000000", 0, false, true);
    this.playerMetaText = this.addText(36, 34, "PLAYER", 20, "#ff604a", true, 166, 22);
    this.addText(38, 126, "LEG 1    SETS 0", 15, "#f2d18a", true, 158, 20);
    this.checkoutText = this.addText(36, 184, "", 18, "#f2d18a", true, 166, 40);
    this.addText(52, 288, "BULL\nFINISH\nSTRONG", 17, "#b8c45c", true, 118, 54);

    this.centerSignText = this.addText(692, 76, "301\nBEST OF\n5 LEGS", 24, "#e7bd54", true, 92, 112);
    this.addText(692, 50, "TONIGHT", 14, "#70b765", true, 92, 18);

    this.add.image(1029, 86, "cpu-opponent").setDisplaySize(98, 98).setDepth(5);
    this.cpuScoreText = this.addText(1112, 64, "", 54, "#e7bd54", true, 120, 66).setShadow(3, 3, "#000000", 0, false, true);
    this.cpuMetaText = this.addText(1112, 36, "CPU", 18, "#77b9da", true, 120, 24);
    this.addText(1112, 126, "LEG 1  SETS 0", 14, "#77b9da", true, 126, 20);

    this.visitText = this.addText(1014, 188, "", 20, "#e8c176", true, 92, 50);
    this.visitSlots = [0, 1, 2].map((index) => {
      const frame = this.add.rectangle(1120 + index * 42, 226, 34, 54, 0x111515, 0.9).setStrokeStyle(2, 0x6b6555).setDepth(6);
      const dart = this.add.graphics().setDepth(7);
      this.drawVisitDart(dart, 1120 + index * 42, 226, 0xf2d18a, 1);
      return { frame, dart };
    });

    this.promptText = this.addText(1014, 316, "", 18, "#ffd166", true, 222, 54);
    this.logStatusText = this.addText(720, 278, "", 11, "#77b9da", true, 194, 16);
    this.logText = this.addText(720, 300, "", 12, "#f7e2b3", false, 202, 76);
    this.logUpButton = this.makeButton(926, 304, 26, 24, "^", () => this.scrollLog(1));
    this.logDownButton = this.makeButton(926, 358, 26, 24, "v", () => this.scrollLog(-1));
    this.logZone = this.add.zone(835, 334, 228, 104);

    this.deckText = this.addText(1006, 464, "", 15, "#77b9da", true, 98, 28);
    this.discardText = this.addText(1136, 464, "", 15, "#a7a49b", true, 98, 28);

    this.targetText = this.addText(84, 674, "", 18, "#ffd166", true, 230, 24);
    this.resultText = this.addText(326, 674, "", 16, "#70b765", true, 300, 24);
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
        if (this.isInsideLogZone(pointer.x, pointer.y)) {
          this.scrollLog(deltaY < 0 ? 1 : -1);
        }
      }
    );
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.syncCardHover(pointer));
    this.input.on("gameout", () => this.clearCardHover());
    this.actionButton = this.makeButton(684, 674, 174, 30, "THROW DART", () => this.primaryAction());
    this.discardButton = this.makeButton(1004, 674, 102, 30, "DISCARD", () => this.discardTechniques());
    this.newGameButton = this.makeButton(1120, 674, 124, 30, "NEW LEG", () => this.newGame());
  }

  private drawVisitDart(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number) {
    g.clear();
    g.lineStyle(3, color, alpha);
    g.lineBetween(x, y - 12, x, y + 16);
    g.lineStyle(2, 0x0b0c0c, alpha * 0.8);
    g.lineBetween(x + 3, y - 10, x + 3, y + 14);
    g.fillStyle(color, alpha);
    g.fillTriangle(x - 5, y + 15, x + 5, y + 15, x, y + 24);
    g.fillTriangle(x - 12, y - 18, x - 2, y - 13, x - 2, y - 4);
    g.fillTriangle(x + 12, y - 18, x + 2, y - 13, x + 2, y - 4);
    g.fillStyle(0x0b0c0c, alpha * 0.7);
    g.fillTriangle(x - 8, y - 15, x - 2, y - 12, x - 2, y - 7);
    g.fillTriangle(x + 8, y - 15, x + 2, y - 12, x + 2, y - 7);
  }

  private addText(x: number, y: number, text: string, size: number, color: string, bold = false, width?: number, height?: number) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "Courier New",
      fontSize: `${size}px`,
      fontStyle: bold ? "bold" : "normal",
      color,
      wordWrap: width ? { width } : undefined
    };
    if (width) style.fixedWidth = width;
    if (height) style.fixedHeight = height;
    return this.add.text(x, y, text, style).setDepth(6);
  }

  private makeButton(x: number, y: number, width: number, height: number, label: string, onClick: () => void): PixelButton {
    const root = this.add.container(x, y).setDepth(8);
    const plate = this.add.rectangle(0, 0, width, height, 0xd2a94f, 0.95).setOrigin(0, 0).setStrokeStyle(2, 0x2a140b);
    const title = this.add
      .text(width / 2, height / 2, label, {
        fontFamily: "Courier New",
        fontSize: height <= 30 ? "14px" : "15px",
        fontStyle: "bold",
        color: "#1a1010",
        align: "center",
        fixedWidth: width,
        fixedHeight: height
      })
      .setOrigin(0.5);
    root.add([plate, title]);
    root.setSize(width, height);
    root.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    if (root.input) root.input.cursor = "pointer";
    root.on("pointerover", () => plate.setFillStyle(0xf1cd70, 1));
    root.on("pointerout", () => plate.setFillStyle(0xd2a94f, 0.95));
    root.on("pointerdown", () => {
      plate.setFillStyle(0x9f6b2d, 1);
      onClick();
    });
    root.on("pointerup", () => plate.setFillStyle(0xf1cd70, 1));
    return {
      root,
      plate,
      title,
      setText: (value: string) => title.setText(value),
      setVisible: (visible: boolean) => {
        root.setVisible(visible);
      },
      setAlpha: (alpha: number) => {
        root.setAlpha(alpha);
      }
    };
  }

  private refresh() {
    if (!this.canChooseTarget()) {
      this.hoveredTarget = undefined;
    }
    this.drawBoard(this.state.pendingDart?.target);
    const player = this.state.players.player;
    const cpu = this.state.players.cpu;
    this.playerScoreText.setText(String(player.score));
    this.cpuScoreText.setText(String(cpu.score));
    this.playerMetaText.setText("PLAYER");
    this.cpuMetaText.setText("CPU");
    this.checkoutText.setText(`CHECKOUT\n${this.checkoutSuggestion(player.score)}`);
    this.visitText.setText(
      `VISIT\n${this.state.players[this.state.activePlayerId].dartsThrown + 1}/3`
    );
    this.updateVisitSlots();
    this.targetText.setText(
      `TARGET: ${targetLabel(this.state.pendingDart?.target)}`
    );
    this.resultText.setText(`DART ${this.state.players[this.state.activePlayerId].dartsThrown + 1} OF 3  |  HIT: ${targetLabel(this.state.lastDart?.finalTarget)}`);
    this.deckText.setText(`DRAW DECK\n${player.deck.length}`);
    this.discardText.setText(`DISCARD\n${player.discard.length}`);
    this.promptText.setText(this.prompt());
    this.renderLog();
    this.actionButton.setText(this.primaryActionLabel());
    this.actionButton.setVisible(this.canUsePrimaryAction());
    this.discardButton.setVisible(this.state.activePlayerId === "player" && this.state.phase === "declare-target");
    this.renderHand();
  }

  private checkoutSuggestion(score: number): string {
    const checkout = targetForScore(score);
    return checkout ? targetLabel(checkout) : "---";
  }

  private updateVisitSlots() {
    const active = this.state.players[this.state.activePlayerId];
    this.visitSlots.forEach((slot, index) => {
      const used = index < active.dartsThrown;
      const current = index === active.dartsThrown && this.state.phase !== "game-over";
      const color = used ? 0x7b8174 : current ? 0xf2d18a : 0x6b6555;
      const alpha = used || current ? 1 : 0.24;
      slot.frame.setStrokeStyle(2, current ? 0xe7bd54 : used ? 0x52645b : 0x6b6555);
      slot.frame.setFillStyle(current ? 0x21170d : 0x111515, current ? 1 : 0.9);
      slot.dart.setAlpha(1);
      this.drawVisitDart(slot.dart, 1120 + index * 42, 226, color, alpha);
    });
  }

  private isInsideLogZone(x: number, y: number): boolean {
    const bounds = this.logZone.getBounds();
    return bounds.contains(x, y);
  }

  private maxLogScrollOffset(): number {
    return Math.max(0, this.state.log.length - this.logViewportLines);
  }

  private scrollLog(delta: number) {
    this.logScrollOffset = Phaser.Math.Clamp(this.logScrollOffset + delta, 0, this.maxLogScrollOffset());
    this.renderLog();
  }

  private renderLog() {
    this.logScrollOffset = Phaser.Math.Clamp(this.logScrollOffset, 0, this.maxLogScrollOffset());
    const total = this.state.log.length;
    const start = Math.max(0, total - this.logViewportLines - this.logScrollOffset);
    const end = Math.min(total, start + this.logViewportLines);
    const visibleLines = this.state.log.slice(start, end);
    this.logText.setText(visibleLines.join("\n"));
    this.logStatusText.setText(`ACTION LOG ${start + 1}-${end}/${total}${this.logScrollOffset === 0 ? "  LIVE" : ""}`);
    this.logUpButton.setAlpha(this.logScrollOffset < this.maxLogScrollOffset() ? 1 : 0.35);
    this.logDownButton.setAlpha(this.logScrollOffset > 0 ? 1 : 0.35);
  }

  private prompt(): string {
    if (this.state.phase === "game-over") {
      return `${this.state.players[this.state.winner ?? "player"].label.toUpperCase()} WINS THE LEG`;
    }
    if (this.waitingForPlayerDrift) return "CPU has thrown. Play Drift now, or skip.";
    if (this.state.activePlayerId === "cpu") return "CPU at the oche...";
    if (this.state.phase === "declare-target") return "Click the board to declare a target.";
    if (this.state.phase === "play-outcome") return "Play one Outcome card.";
    return "Play Technique cards, then throw.";
  }

  private renderHand() {
    for (const view of this.handViews) {
      view.container.destroy(true);
    }
    this.handViews = [];

    const hand = this.displayOrderedHand();
    const startX = 50;
    const y = 450;
    hand.forEach((card, index) => {
      const x = startX + index * 174;
      const playable = this.isCardPlayable(card);
      const colors = cardTextColors[card.name];
      const container = this.add.container(x, y).setDepth(9);
      const glow = this.add
        .rectangle(-5, -5, cardWidth + 10, cardHeight + 10, 0xffd166, playable ? 0.06 : 0)
        .setOrigin(0, 0)
        .setStrokeStyle(playable ? 2 : 0, 0xffd166, playable ? 0.65 : 0);
      const frame = this.add.sprite(0, 0, "card-fronts", cardFrontFrameByCard[card.name]).setOrigin(0, 0);
      const title = this.add
        .text(18, 20, card.name.toUpperCase(), {
          fontFamily: "Courier New",
          fontSize: card.name.length > 12 ? "11px" : "14px",
          fontStyle: "bold",
          color: colors.label,
          fixedWidth: 120,
          align: "center",
          wordWrap: { width: 120 }
        })
        .setOrigin(0, 0);
      const body = this.add
        .text(24, 144, this.cardHint(card.name), {
          fontFamily: "Courier New",
          fontSize: "11px",
          fontStyle: "bold",
          color: colors.body,
          fixedWidth: 108,
          fixedHeight: 44,
          align: "center",
          wordWrap: { width: 108 }
        })
        .setOrigin(0, 0);
      container.add([glow, frame, title, body]);
      if (playable) {
        container.setSize(cardWidth, cardHeight);
        container.setInteractive(new Phaser.Geom.Rectangle(0, 0, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);
        if (container.input) container.input.cursor = "pointer";
        container.on("pointerdown", () => this.playCard(card));
      }
      this.handViews.push({ card, container, frame, glow, playable });
    });
    this.syncCardHover();
  }

  private syncCardHover(pointer = this.input.activePointer) {
    const next = this.handViews.find((view) => this.isPointerOverCard(view, pointer))?.card.id;
    if (next === this.hoveredCardId) return;
    this.hoveredCardId = next;
    this.applyCardHover();
  }

  private isPointerOverCard(view: CardView, pointer: Phaser.Input.Pointer): boolean {
    if (!view.playable) return false;
    const localX = pointer.x - view.container.x;
    const localY = pointer.y - view.container.y;
    return localX >= 0 && localX <= cardWidth && localY >= 0 && localY <= cardHeight;
  }

  private clearCardHover() {
    if (!this.hoveredCardId) return;
    this.hoveredCardId = undefined;
    this.applyCardHover();
  }

  private applyCardHover() {
    for (const view of this.handViews) {
      const hovered = view.card.id === this.hoveredCardId;
      view.glow.setAlpha(hovered ? 0.28 : view.playable ? 0.06 : 0);
      if (hovered) {
        view.frame.setTint(0xfff1a3);
      } else {
        view.frame.clearTint();
      }
    }
  }

  private displayOrderedHand(): Card[] {
    return this.state.players.player.hand
      .map((card, index) => ({ card, index }))
      .sort((a, b) => this.handGroupWeight(a.card) - this.handGroupWeight(b.card) || a.index - b.index)
      .map(({ card }) => card);
  }

  private handGroupWeight(card: Card): number {
    if (isOutcome(card)) return 0;
    if (isCounterplay(card)) return 1;
    return 2;
  }

  private cardHint(name: CardName): string {
    const hints: Record<CardName, string> = {
      "Clean Hit": "Hit target.",
      "Fat Segment": "D/T become single.",
      "Drift Left": "Counter left.",
      "Drift Right": "Counter right.",
      Wire: "Score 0.",
      Focus: "Improve/cancel Drift.",
      "Safe Setup": "Cancel Drift.",
      "Checkout Nerve": "Save checkout."
    };
    return hints[name];
  }

  private isCardPlayable(card: Card): boolean {
    if (this.state.phase === "game-over") return false;
    if (this.waitingForPlayerDrift) return isCounterplay(card);
    if (this.state.activePlayerId !== "player") return false;
    if (this.state.phase === "play-outcome") return isOutcome(card);
    if (this.state.phase === "technique-window") return isTechnique(card);
    return false;
  }

  private playCard(card: Card) {
    if (this.waitingForPlayerDrift) {
      this.state = playCounterplay(this.state, "player", card.id);
      this.waitingForPlayerDrift = false;
      this.cpuRespondToDriftThenResolve();
      return;
    }

    if (this.state.phase === "play-outcome") {
      this.state = playOutcome(this.state, card.id);
      const counter = chooseCpuCounterplay(this.state);
      if (counter) {
        this.state = playCounterplay(this.state, "cpu", counter.id);
      }
    } else if (this.state.phase === "technique-window") {
      this.state = playTechnique(this.state, card.id);
    }
    this.refresh();
  }

  private canResolvePlayerDart(): boolean {
    return this.state.activePlayerId === "player" && this.state.phase === "technique-window" && !this.cpuRunning;
  }

  private canUsePrimaryAction(): boolean {
    return (
      this.canResolvePlayerDart() ||
      (this.state.activePlayerId === "player" &&
        this.state.phase === "declare-target" &&
        this.state.players.player.dartsThrown > 0 &&
        !this.cpuRunning)
    );
  }

  private primaryActionLabel(): string {
    if (this.canResolvePlayerDart()) return "THROW DART";
    return "END VISIT";
  }

  private primaryAction() {
    if (this.canResolvePlayerDart()) {
      this.resolvePlayerDart();
      return;
    }
    if (
      this.state.activePlayerId === "player" &&
      this.state.phase === "declare-target" &&
      this.state.players.player.dartsThrown > 0
    ) {
      this.state = endVisit(this.state);
      this.refresh();
      if (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
        this.time.delayedCall(650, () => void this.runCpuVisit());
      }
    }
  }

  private resolvePlayerDart() {
    if (!this.canResolvePlayerDart()) return;
    this.state = resolveDart(this.state);
    this.refresh();
    this.flashHit(this.state.lastDart?.finalTarget);
    if (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
      this.time.delayedCall(950, () => void this.runCpuVisit());
    }
  }

  private discardTechniques() {
    if (this.state.activePlayerId !== "player" || this.state.phase !== "declare-target") return;
    this.state = discardUnplayedTechniques(this.state);
    this.refresh();
  }

  private newGame() {
    this.waitingForPlayerDrift = false;
    this.cpuRunning = false;
    this.logScrollOffset = 0;
    this.hitFlash.clear();
    this.state = createGame(Math.floor(Date.now() % 100000));
    this.refresh();
  }

  private async runCpuVisit() {
    if (this.cpuRunning) return;
    this.cpuRunning = true;
    while (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
      const choice = chooseCpuDart(this.state);
      if (!choice) {
        this.state = endVisit(this.state);
        break;
      }
      this.state = declareTarget(this.state, choice.target);
      this.refresh();
      await this.wait(1000);
      this.state = playOutcome(this.state, choice.outcome.id);
      if (choice.focus) {
        this.state = playTechnique(this.state, choice.focus.id);
      }
      this.refresh();
      await this.wait(550);
      if (this.playerCanCounterCpu(choice.target)) {
        this.waitingForPlayerDrift = true;
        this.cpuRunning = false;
        this.refresh();
        return;
      }
      this.cpuRespondToDriftThenResolve();
      await this.wait(1050);
    }
    this.cpuRunning = false;
    this.refresh();
  }

  private playerCanCounterCpu(target: Target): boolean {
    const hasDrift = this.state.players.player.hand.some((card) => isCounterplay(card));
    const score = targetScore(target);
    const checkoutThreat = score === this.state.players.cpu.score && (target.ring === "double" || target.ring === "bull");
    return hasDrift && (checkoutThreat || score >= 57);
  }

  private cpuRespondToDriftThenResolve() {
    if (this.state.pendingDart?.counterplay && this.state.activePlayerId === "cpu") {
      const safeSetup = this.state.players.cpu.hand.find((card) => card.name === "Safe Setup");
      const target = this.state.pendingDart.target;
      const score = targetScore(target);
      const important = score >= 57 || score === this.state.players.cpu.score;
      if (safeSetup && important) {
        this.state = playTechnique(this.state, safeSetup.id);
      }
    }
    this.state = resolveDart(this.state);
    this.refresh();
    this.flashHit(this.state.lastDart?.finalTarget);
    if (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
      this.time.delayedCall(950, () => void this.runCpuVisit());
    }
  }

  private wait(ms: number) {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }
}
