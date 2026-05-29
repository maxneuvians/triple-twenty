import Phaser from "phaser";
import {
  chooseCpuCounterplay,
  chooseCpuDart,
  chooseCpuDriftCancel,
  chooseCpuTechniqueDiscards,
  createGame,
  declareTarget,
  discardUnplayedTechniques,
  endVisit,
  playCounterplay,
  playOutcome,
  playTechnique,
  resolveDart
} from "../rules/game";
import { playerGuideSections, type PlayerGuideSection } from "../content/playerGuide";
import { pubLocations } from "../content/pubLocations";
import { dartboardOrder, type Card, type CardName, type GameState, type PlayerId, type Target } from "../rules/types";
import { isCounterplay, isOutcome, isTechnique } from "../rules/cards";
import { targetForScore, targetLabel, targetScore } from "../rules/scoring";

type CardView = {
  card: Card;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Rectangle;
  hitZone?: Phaser.GameObjects.Zone;
  playable: boolean;
  selected: boolean;
};

type PixelButton = {
  root: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  setText: (text: string) => void;
  setVisible: (visible: boolean) => void;
  setAlpha: (alpha: number) => void;
  destroy: () => void;
};

type VisitSlot = {
  frame: Phaser.GameObjects.Rectangle;
  dart: Phaser.GameObjects.Graphics;
};

type CardColors = {
  label: string;
  body: string;
};

type GuideModal = {
  root: Phaser.GameObjects.Container;
  tabButtons: PixelButton[];
  prevButton: PixelButton;
  nextButton: PixelButton;
  closeButton: PixelButton;
  titleText: Phaser.GameObjects.Text;
  subtitleText: Phaser.GameObjects.Text;
  bodyText: Phaser.GameObjects.Text;
  pageText: Phaser.GameObjects.Text;
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

const cpuPortraitKeys = [
  "cpu-opponent",
  "cpu-opponent-arthur",
  "cpu-opponent-asha",
  "cpu-opponent-jo",
  "cpu-opponent-leon",
  "cpu-opponent-viv"
] as const;

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
  private pubBackground!: Phaser.GameObjects.Image;
  private board!: Phaser.GameObjects.Graphics;
  private hitFlash!: Phaser.GameObjects.Graphics;
  private boardLabels: Phaser.GameObjects.Text[] = [];
  private handViews: CardView[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private playerMetaText!: Phaser.GameObjects.Text;
  private playerLegText!: Phaser.GameObjects.Text;
  private checkoutText!: Phaser.GameObjects.Text;
  private cpuPortrait?: Phaser.GameObjects.Image;
  private cpuScoreText!: Phaser.GameObjects.Text;
  private cpuMetaText!: Phaser.GameObjects.Text;
  private cpuLegText!: Phaser.GameObjects.Text;
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
  private deckPileBack!: Phaser.GameObjects.Container;
  private discardPileBack!: Phaser.GameObjects.Container;
  private actionButton!: PixelButton;
  private guideButton!: PixelButton;
  private discardButton!: PixelButton;
  private newGameButton!: PixelButton;
  private venueButton!: PixelButton;
  private guideModal?: GuideModal;
  private guideSectionIndex = 0;
  private driftAlert!: Phaser.GameObjects.Container;
  private driftAlertPlate!: Phaser.GameObjects.Rectangle;
  private driftAlertArrow!: Phaser.GameObjects.Text;
  private driftAlertText!: Phaser.GameObjects.Text;
  private hoveredTarget?: Target;
  private hoveredCardId?: string;
  private stagedOutcomeCardId?: string;
  private stagedTechniqueCardIds = new Set<string>();
  private driftNotice?: { text: string; direction?: "left" | "right"; expiresAt: number; fill?: number; border?: number };
  private legsWon: Record<PlayerId, number> = { player: 0, cpu: 0 };
  private countedWinner?: PlayerId;
  private pubLocationIndex = 0;
  private cpuPortraitKey: (typeof cpuPortraitKeys)[number] = "cpu-opponent";
  private waitingForPlayerDrift = false;
  private cpuRunning = false;
  private logScrollOffset = 0;
  private readonly logViewportLines = 5;

  constructor() {
    super("PubGameScene");
  }

  create() {
    this.state = createGame(this.freshLegSeed());
    this.chooseCpuPortrait();
    this.createPubBackdrop();
    this.createDartboard();
    this.createUiShell();
    this.input.keyboard?.on("keydown-ESC", () => this.closeGuide());
    this.refresh();
  }

  private freshLegSeed(): number {
    return Math.floor((Date.now() % 0xffffffff) + Math.random() * 0xffffffff) >>> 0;
  }

  private createPubBackdrop() {
    this.pubBackground = this.add.image(640, 360, this.currentPubLocation().assetKey).setDisplaySize(1280, 720).setDepth(0);
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
      if (!this.canChooseTarget()) return;
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
      !this.cpuRunning &&
      !this.isGuideOpen()
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
    this.playerLegText = this.addText(38, 126, "", 15, "#f2d18a", true, 158, 20);
    this.checkoutText = this.addText(36, 184, "", 18, "#f2d18a", true, 166, 40);
    this.addText(52, 288, "BULL\nFINISH\nSTRONG", 17, "#b8c45c", true, 118, 54);

    this.centerSignText = this.addText(686, 76, "", 19, "#e7bd54", true, 116, 100);
    this.addText(692, 50, "TONIGHT", 14, "#70b765", true, 92, 18);
    this.venueButton = this.makeButton(692, 184, 92, 26, "VENUE", () => this.cyclePubLocation());

    this.cpuPortrait = this.add.image(1029, 86, this.cpuPortraitKey).setDisplaySize(98, 98).setDepth(5);
    this.cpuScoreText = this.addText(1112, 64, "", 54, "#e7bd54", true, 120, 66).setShadow(3, 3, "#000000", 0, false, true);
    this.cpuMetaText = this.addText(1112, 36, "CPU", 18, "#77b9da", true, 120, 24);
    this.cpuLegText = this.addText(1112, 126, "", 14, "#77b9da", true, 126, 20);

    this.visitText = this.addText(1014, 188, "", 20, "#e8c176", true, 92, 50);
    this.visitSlots = [0, 1, 2].map((index) => {
      const frame = this.add.rectangle(1120 + index * 42, 226, 34, 54, 0x111515, 0.9).setStrokeStyle(2, 0x6b6555).setDepth(6);
      const dart = this.add.graphics().setDepth(7);
      this.drawVisitDart(dart, 1120 + index * 42, 226, 0xf2d18a, 1);
      return { frame, dart };
    });

    this.promptText = this.addText(1014, 316, "", 18, "#ffd166", true, 222, 54);
    this.driftAlert = this.add.container(1012, 386).setDepth(10);
    this.driftAlertPlate = this.add
      .rectangle(0, 0, 228, 48, 0x541817, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0xffd166, 0.95);
    this.driftAlertArrow = this.add
      .text(15, 5, ">>", {
        fontFamily: "Courier New",
        fontSize: "30px",
        fontStyle: "bold",
        color: "#ffd166",
        fixedWidth: 48,
        fixedHeight: 38,
        align: "center"
      })
      .setOrigin(0, 0);
    this.driftAlertText = this.add
      .text(68, 7, "", {
        fontFamily: "Courier New",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#f7e2b3",
        fixedWidth: 142,
        fixedHeight: 34,
        align: "left",
        wordWrap: { width: 142 }
      })
      .setOrigin(0, 0);
    this.driftAlert.add([this.driftAlertPlate, this.driftAlertArrow, this.driftAlertText]);
    this.driftAlert.setVisible(false);
    this.logStatusText = this.addText(720, 278, "", 11, "#77b9da", true, 194, 16);
    this.logText = this.addText(720, 300, "", 12, "#f7e2b3", false, 202, 76);
    this.logUpButton = this.makeButton(926, 304, 26, 24, "^", () => this.scrollLog(1));
    this.logDownButton = this.makeButton(926, 358, 26, 24, "v", () => this.scrollLog(-1));
    this.logZone = this.add.zone(835, 334, 228, 104);

    this.deckText = this.addText(1006, 464, "", 15, "#77b9da", true, 98, 28);
    this.discardText = this.addText(1136, 464, "", 15, "#a7a49b", true, 98, 28);
    this.deckPileBack = this.createPileBack(1014, 508, 0x123f31);
    this.discardPileBack = this.createPileBack(1144, 508, 0x4b3020);

    this.targetText = this.addText(84, 674, "", 18, "#ffd166", true, 230, 24);
    this.resultText = this.addText(326, 674, "", 16, "#70b765", true, 300, 24);
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
        if (this.isGuideOpen()) return;
        if (this.isInsideLogZone(pointer.x, pointer.y)) {
          this.scrollLog(deltaY < 0 ? 1 : -1);
        }
      }
    );
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isGuideOpen()) {
        this.clearCardHover();
        return;
      }
      this.syncCardHover(pointer);
    });
    this.input.on("gameout", () => this.clearCardHover());
    this.actionButton = this.makeButton(684, 674, 174, 30, "THROW DART", () => this.primaryAction());
    this.guideButton = this.makeButton(872, 674, 86, 30, "GUIDE", () => this.openGuide());
    this.discardButton = this.makeButton(1004, 674, 102, 30, "DISCARD", () => this.discardTechniques());
    this.newGameButton = this.makeButton(1120, 674, 124, 30, "NEW LEG", () => this.newGame());
  }

  private currentPubLocation() {
    return pubLocations[this.pubLocationIndex];
  }

  private cyclePubLocation() {
    if (this.isGuideOpen()) return;
    this.pubLocationIndex = Phaser.Math.Wrap(this.pubLocationIndex + 1, 0, pubLocations.length);
    this.pubBackground.setTexture(this.currentPubLocation().assetKey).setDisplaySize(1280, 720);
    this.refresh();
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

  private createPileBack(x: number, y: number, fill: number): Phaser.GameObjects.Container {
    const root = this.add.container(x, y).setDepth(6);
    const width = 76;
    const height = 104;
    const shadow = this.add.rectangle(7, 5, width, height, 0x050606, 0.72).setOrigin(0, 0);
    const offset = this.add.rectangle(4, 2, width, height, 0x101515, 1).setOrigin(0, 0).setStrokeStyle(2, 0x6c5a35, 0.85);
    const back = this.add.rectangle(0, 0, width, height, fill, 1).setOrigin(0, 0).setStrokeStyle(3, 0xf2d18a, 1);
    const inner = this.add.rectangle(8, 8, width - 16, height - 16, 0x0b1010, 0.18).setOrigin(0, 0).setStrokeStyle(1, 0xf2d18a, 0.5);
    const band = this.add.rectangle(10, 40, width - 20, 24, 0x0b1010, 0.28).setOrigin(0, 0).setStrokeStyle(1, 0xf2d18a, 0.4);
    const mark = this.add
      .text(width / 2, height / 2, "20", {
        fontFamily: "Courier New",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#f2d18a",
        fixedWidth: width,
        align: "center"
      })
      .setOrigin(0.5);
    root.add([shadow, offset, back, inner, band, mark]);
    root.setVisible(false);
    return root;
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
    const hitZone = this.add.zone(x, y, width, height).setOrigin(0, 0).setDepth(32);
    const enableHitZone = () => {
      hitZone.setInteractive({ cursor: "pointer" });
    };
    enableHitZone();
    hitZone.on("pointerover", () => plate.setFillStyle(0xf1cd70, 1));
    hitZone.on("pointerout", () => plate.setFillStyle(0xd2a94f, 0.95));
    hitZone.on("pointerdown", () => {
      plate.setFillStyle(0x9f6b2d, 1);
      onClick();
    });
    hitZone.on("pointerup", () => plate.setFillStyle(0xf1cd70, 1));
    return {
      root,
      plate,
      title,
      hitZone,
      setText: (value: string) => title.setText(value),
      setVisible: (visible: boolean) => {
        root.setVisible(visible);
        hitZone.setVisible(visible);
        if (visible) {
          enableHitZone();
        } else {
          hitZone.disableInteractive();
        }
      },
      setAlpha: (alpha: number) => {
        root.setAlpha(alpha);
      },
      destroy: () => {
        hitZone.destroy();
        root.destroy(true);
      }
    };
  }

  private isGuideOpen(): boolean {
    return Boolean(this.guideModal);
  }

  private openGuide() {
    if (this.guideModal) return;
    this.guideSectionIndex = 0;
    this.clearCardHover();
    this.hoveredTarget = undefined;
    this.drawBoard(this.state.pendingDart?.target);
    this.createGuideModal();
    this.renderGuideModal();
  }

  private closeGuide() {
    if (!this.guideModal) return;
    const modal = this.guideModal;
    for (const button of modal.tabButtons) button.destroy();
    modal.prevButton.destroy();
    modal.nextButton.destroy();
    modal.closeButton.destroy();
    modal.root.destroy(true);
    this.guideModal = undefined;
    this.refresh();
  }

  private createGuideModal() {
    const panel = { x: 150, y: 80, width: 980, height: 560 };
    const root = this.add.container(0, 0).setDepth(70);
    const backdrop = this.add
      .rectangle(0, 0, 1280, 720, 0x050303, 0.72)
      .setOrigin(0, 0)
      .setInteractive({ cursor: "default" });
    backdrop.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.isPointInsideGuidePanel(pointer.x, pointer.y)) this.closeGuide();
    });

    const shadow = this.add.rectangle(panel.x + 10, panel.y + 10, panel.width, panel.height, 0x050303, 0.7).setOrigin(0, 0);
    const paper = this.add.rectangle(panel.x, panel.y, panel.width, panel.height, 0xcaa463, 1).setOrigin(0, 0).setStrokeStyle(4, 0x2a140b, 1);
    const inner = this.add.rectangle(panel.x + 16, panel.y + 16, panel.width - 32, panel.height - 32, 0xf1d8a4, 1).setOrigin(0, 0).setStrokeStyle(3, 0x6d3f1f, 1);
    const header = this.add.rectangle(panel.x + 30, panel.y + 28, panel.width - 60, 72, 0x24140d, 0.96).setOrigin(0, 0).setStrokeStyle(2, 0xd2a94f, 1);
    const blocker = this.add.zone(panel.x, panel.y, panel.width, panel.height).setOrigin(0, 0).setInteractive({ cursor: "default" });
    const titleText = this.add
      .text(panel.x + 56, panel.y + 36, "", {
        fontFamily: "Courier New",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#f2d18a",
        fixedWidth: 540,
        fixedHeight: 38
      })
      .setOrigin(0, 0);
    const subtitleText = this.add
      .text(panel.x + 58, panel.y + 75, "", {
        fontFamily: "Courier New",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#9be2c1",
        fixedWidth: 620,
        fixedHeight: 20
      })
      .setOrigin(0, 0);
    const menuTitle = this.add
      .text(panel.x + 716, panel.y + 42, "MATCH\nMENU", {
        fontFamily: "Courier New",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#f7e2b3",
        fixedWidth: 150,
        fixedHeight: 52,
        align: "center"
      })
      .setOrigin(0, 0);
    const bodyText = this.add
      .text(panel.x + 62, panel.y + 176, "", {
        fontFamily: "Courier New",
        fontSize: "15px",
        fontStyle: "bold",
        color: "#1a1010",
        fixedWidth: 850,
        fixedHeight: 305,
        wordWrap: { width: 850 }
      })
      .setOrigin(0, 0)
      .setLineSpacing(5);
    const pageText = this.add
      .text(panel.x + 430, panel.y + 505, "", {
        fontFamily: "Courier New",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#3b2210",
        fixedWidth: 120,
        fixedHeight: 24,
        align: "center"
      })
      .setOrigin(0, 0);

    root.add([backdrop, shadow, paper, inner, header, blocker, titleText, subtitleText, menuTitle, bodyText, pageText]);

    const tabButtons = playerGuideSections.map((section, index) => {
      const button = this.makeButton(panel.x + 58 + index * 118, panel.y + 122, 104, 30, section.id, () => this.showGuideSection(index));
      this.raiseButton(button, 82);
      return button;
    });
    const prevButton = this.makeButton(panel.x + 240, panel.y + 502, 126, 30, "PREV", () => this.cycleGuide(-1));
    const nextButton = this.makeButton(panel.x + 612, panel.y + 502, 126, 30, "NEXT", () => this.cycleGuide(1));
    const closeButton = this.makeButton(panel.x + panel.width - 72, panel.y + 32, 42, 30, "X", () => this.closeGuide());
    this.raiseButton(prevButton, 82);
    this.raiseButton(nextButton, 82);
    this.raiseButton(closeButton, 82);

    this.guideModal = {
      root,
      tabButtons,
      prevButton,
      nextButton,
      closeButton,
      titleText,
      subtitleText,
      bodyText,
      pageText
    };
  }

  private raiseButton(button: PixelButton, depth: number) {
    button.root.setDepth(depth);
    button.hitZone.setDepth(depth + 1);
  }

  private isPointInsideGuidePanel(x: number, y: number): boolean {
    return x >= 150 && x <= 1130 && y >= 80 && y <= 640;
  }

  private showGuideSection(index: number) {
    this.guideSectionIndex = Phaser.Math.Wrap(index, 0, playerGuideSections.length);
    this.renderGuideModal();
  }

  private cycleGuide(delta: number) {
    this.showGuideSection(this.guideSectionIndex + delta);
  }

  private renderGuideModal() {
    const modal = this.guideModal;
    if (!modal) return;
    const section = playerGuideSections[this.guideSectionIndex];
    modal.titleText.setText(`TRIPLE-TWENTY ${section.title.toUpperCase()}`);
    modal.subtitleText.setText(section.subtitle);
    modal.bodyText.setText(this.formatGuideSection(section));
    modal.pageText.setText(`${this.guideSectionIndex + 1} / ${playerGuideSections.length}`);

    modal.tabButtons.forEach((button, index) => {
      const selected = index === this.guideSectionIndex;
      button.plate.setFillStyle(selected ? 0xf1cd70 : 0x5e3c24, 1);
      button.plate.setStrokeStyle(2, selected ? 0x1a1010 : 0xd2a94f, 1);
      button.title.setColor(selected ? "#1a1010" : "#f7e2b3");
    });
  }

  private formatGuideSection(section: PlayerGuideSection): string {
    return section.blocks
      .map((block) => `${block.heading.toUpperCase()}\n${block.items.map((item) => `- ${item}`).join("\n")}`)
      .join("\n\n");
  }

  private refresh() {
    this.syncStagedCardsWithState();
    this.recordLegWin();
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
    this.playerLegText.setText(`LEGS ${this.legsWon.player}   SETS 0`);
    this.cpuLegText.setText(`LEGS ${this.legsWon.cpu}  SETS 0`);
    this.centerSignText.setText(`301\nBEST OF\n5 LEGS\n${this.currentPubLocation().signLabel}`);
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
    this.deckPileBack.setVisible(player.deck.length > 0);
    this.discardPileBack.setVisible(player.discard.length > 0);
    this.promptText.setText(this.prompt());
    this.updateDriftAlert();
    this.renderLog();
    this.actionButton.setText(this.primaryActionLabel());
    this.actionButton.setVisible(this.canUsePrimaryAction());
    this.guideButton.setVisible(true);
    this.discardButton.setVisible(this.state.activePlayerId === "player" && this.state.phase === "declare-target");
    this.renderHand();
  }

  private recordLegWin() {
    if (this.state.phase !== "game-over" || !this.state.winner || this.countedWinner === this.state.winner) {
      return;
    }
    this.legsWon = {
      ...this.legsWon,
      [this.state.winner]: this.legsWon[this.state.winner] + 1
    };
    this.countedWinner = this.state.winner;
  }

  private chooseCpuPortrait() {
    const candidates = cpuPortraitKeys.filter((key) => key !== this.cpuPortraitKey);
    this.cpuPortraitKey = Phaser.Utils.Array.GetRandom(candidates.length ? candidates : [...cpuPortraitKeys]);
    this.cpuPortrait?.setTexture(this.cpuPortraitKey).setDisplaySize(98, 98);
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

  private syncStagedCardsWithState() {
    if (this.state.activePlayerId !== "player" || this.state.phase !== "play-outcome") {
      this.clearStagedCards();
      return;
    }

    const handIds = new Set(this.state.players.player.hand.map((card) => card.id));
    if (this.stagedOutcomeCardId && !handIds.has(this.stagedOutcomeCardId)) {
      this.stagedOutcomeCardId = undefined;
    }
    if (!this.stagedOutcomeCardId) {
      this.stagedTechniqueCardIds.clear();
      return;
    }
    for (const cardId of [...this.stagedTechniqueCardIds]) {
      if (!handIds.has(cardId)) this.stagedTechniqueCardIds.delete(cardId);
    }
  }

  private clearStagedCards() {
    this.stagedOutcomeCardId = undefined;
    this.stagedTechniqueCardIds.clear();
  }

  private previewCpuCounterplay(): Card | undefined {
    if (this.state.activePlayerId !== "player" || this.state.phase !== "play-outcome" || !this.stagedOutcomeCardId) {
      return undefined;
    }

    try {
      return chooseCpuCounterplay(playOutcome(this.state, this.stagedOutcomeCardId));
    } catch {
      return undefined;
    }
  }

  private driftDirection(card: Card | undefined): "left" | "right" | undefined {
    if (!card) return undefined;
    if (card.name === "Drift Left") return "left";
    if (card.name === "Drift Right") return "right";
    return undefined;
  }

  private stagedDriftCancelCard(): Card | undefined {
    return this.state.players.player.hand.find(
      (card) => this.stagedTechniqueCardIds.has(card.id) && (card.name === "Focus" || card.name === "Safe Setup")
    );
  }

  private showDriftNotice(card: Card, canceledBy?: Card) {
    this.driftNotice = {
      text: canceledBy ? `DRIFT CANCELED\nBY ${canceledBy.name.toUpperCase()}` : `CPU PLAYED\n${card.name.toUpperCase()}`,
      direction: this.driftDirection(card),
      expiresAt: this.time.now + 1750,
      fill: canceledBy ? 0x143f2f : 0x541817,
      border: canceledBy ? 0x9be2c1 : 0xffd166
    };
    this.updateDriftAlert();
    this.tweens.killTweensOf(this.driftAlert);
    this.driftAlert.setAlpha(1);
    this.tweens.add({
      targets: this.driftAlert,
      alpha: { from: 1, to: 0.68 },
      duration: 140,
      yoyo: true,
      repeat: 4,
      ease: "Linear"
    });
    this.time.delayedCall(1800, () => {
      if (this.driftNotice && this.time.now >= this.driftNotice.expiresAt) {
        this.driftNotice = undefined;
        this.updateDriftAlert();
      }
    });
  }

  private updateDriftAlert() {
    if (this.driftNotice && this.time.now >= this.driftNotice.expiresAt) {
      this.driftNotice = undefined;
    }

    let text = this.driftNotice?.text;
    let direction = this.driftNotice?.direction;
    let fill = this.driftNotice?.fill ?? 0x541817;
    let border = this.driftNotice?.border ?? 0xffd166;

    const activeCpuDrift =
      this.state.activePlayerId === "player" && this.state.pendingDart?.counterplay
        ? this.state.pendingDart.counterplay
        : undefined;

    if (!text && activeCpuDrift) {
      direction = this.driftDirection(activeCpuDrift);
      if (this.state.pendingDart?.counterplayCanceledBy) {
        text = `DRIFT CANCELED\nBY ${this.state.pendingDart.counterplayCanceledBy.name.toUpperCase()}`;
        fill = 0x143f2f;
        border = 0x9be2c1;
      } else {
        text = `CPU PLAYED\n${activeCpuDrift.name.toUpperCase()}`;
      }
    }

    if (!text) {
      const preview = this.previewCpuCounterplay();
      if (preview) {
        direction = this.driftDirection(preview);
        const cancelCard = this.stagedDriftCancelCard();
        if (cancelCard) {
          text = `DRIFT COVERED\nBY ${cancelCard.name.toUpperCase()}`;
          fill = 0x143f2f;
          border = 0x9be2c1;
        } else {
          text = `CPU READY\n${preview.name.toUpperCase()}`;
          fill = 0x3b2210;
          border = 0xffd166;
        }
      }
    }

    if (!text) {
      this.driftAlert.setVisible(false);
      return;
    }

    this.driftAlertPlate.setFillStyle(fill, 0.92);
    this.driftAlertPlate.setStrokeStyle(3, border, 0.95);
    this.driftAlertArrow.setText(direction === "left" ? "<<" : direction === "right" ? ">>" : "X");
    this.driftAlertText.setText(text);
    this.driftAlert.setVisible(true);
  }

  private prompt(): string {
    if (this.state.phase === "game-over") {
      return `${this.state.players[this.state.winner ?? "player"].label.toUpperCase()} WINS THE LEG`;
    }
    if (this.waitingForPlayerDrift) return "CPU has thrown. Play Drift now, or skip.";
    if (this.state.activePlayerId === "cpu") return "CPU at the oche...";
    if (this.state.phase === "declare-target") return "Click the board to declare a target.";
    if (this.state.phase === "play-outcome" && this.stagedOutcomeCardId) {
      if (this.previewCpuCounterplay()) {
        return this.stagedDriftCancelCard() ? "Drift covered. Throw when ready." : "CPU Drift ready. Pick Focus/Safe Setup or throw.";
      }
      return "Select Technique cards, then throw.";
    }
    if (this.state.phase === "play-outcome") return "Play one Outcome card.";
    return "Play Technique cards, then throw.";
  }

  private renderHand() {
    for (const view of this.handViews) {
      view.hitZone?.destroy();
      view.container.destroy(true);
    }
    this.handViews = [];

    const hand = this.displayOrderedHand();
    const startX = 50;
    const y = 450;
    hand.forEach((card, index) => {
      const x = startX + index * 174;
      const playable = this.isCardPlayable(card);
      const selected = this.isCardStaged(card);
      const colors = cardTextColors[card.name];
      const cardY = selected ? y - 18 : y;
      const container = this.add.container(x, cardY).setDepth(selected ? 11 : 9);
      const glowColor = selected ? 0x9be2c1 : 0xffd166;
      const glow = this.add
        .rectangle(-5, -5, cardWidth + 10, cardHeight + 10, glowColor, selected ? 0.2 : playable ? 0.06 : 0)
        .setOrigin(0, 0)
        .setStrokeStyle(playable || selected ? 2 : 0, glowColor, selected ? 0.95 : playable ? 0.65 : 0);
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
      let hitZone: Phaser.GameObjects.Zone | undefined;
      if (playable) {
        hitZone = this.add.zone(x, cardY, cardWidth, cardHeight).setOrigin(0, 0).setDepth(31);
        hitZone.setInteractive({ cursor: "pointer" });
        hitZone.on("pointerover", () => {
          this.hoveredCardId = card.id;
          this.applyCardHover();
        });
        hitZone.on("pointerout", () => {
          if (this.hoveredCardId === card.id) this.clearCardHover();
        });
        hitZone.on("pointerdown", () => this.playCard(card));
      }
      this.handViews.push({ card, container, frame, glow, hitZone, playable, selected });
    });
    this.syncCardHover();
  }

  private syncCardHover(pointer = this.input.activePointer) {
    if (this.isGuideOpen()) {
      this.clearCardHover();
      return;
    }
    const next = this.handViews.find((view) => this.isPointerOverCard(view, pointer))?.card.id;
    if (next === this.hoveredCardId) return;
    this.hoveredCardId = next;
    this.applyCardHover();
  }

  private isPointerOverCard(view: CardView, pointer: Phaser.Input.Pointer): boolean {
    if (!view.playable) return false;
    const hitBounds = view.hitZone?.getBounds();
    if (hitBounds) return hitBounds.contains(pointer.x, pointer.y);
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
      view.glow.setAlpha(hovered ? 0.32 : view.selected ? 0.2 : view.playable ? 0.06 : 0);
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
      Focus: "Wire->fat, fat->double.",
      "Safe Setup": "Cancel Drift.",
      "Checkout Nerve": "Save checkout."
    };
    return hints[name];
  }

  private isCardStaged(card: Card): boolean {
    return this.stagedOutcomeCardId === card.id || this.stagedTechniqueCardIds.has(card.id);
  }

  private isCardPlayable(card: Card): boolean {
    if (this.isGuideOpen()) return false;
    if (this.state.phase === "game-over") return false;
    if (this.waitingForPlayerDrift) return isCounterplay(card);
    if (this.state.activePlayerId !== "player") return false;
    if (this.state.phase === "play-outcome") {
      return isOutcome(card) || (Boolean(this.stagedOutcomeCardId) && isTechnique(card));
    }
    if (this.state.phase === "technique-window") return isTechnique(card);
    return false;
  }

  private playCard(card: Card) {
    if (this.isGuideOpen()) return;
    if (this.waitingForPlayerDrift) {
      this.state = playCounterplay(this.state, "player", card.id);
      this.waitingForPlayerDrift = false;
      this.cpuRespondToDriftThenResolve();
      return;
    }

    if (this.state.activePlayerId === "player" && this.state.phase === "play-outcome") {
      if (isOutcome(card)) {
        if (this.stagedOutcomeCardId === card.id) {
          this.clearStagedCards();
        } else {
          this.stagedOutcomeCardId = card.id;
        }
        this.refresh();
        return;
      }

      if (this.stagedOutcomeCardId && isTechnique(card)) {
        if (this.stagedTechniqueCardIds.has(card.id)) {
          this.stagedTechniqueCardIds.delete(card.id);
        } else {
          this.stagedTechniqueCardIds.add(card.id);
        }
        this.refresh();
        return;
      }
    }

    if (this.state.phase === "play-outcome") {
      this.state = playOutcome(this.state, card.id);
    } else if (this.state.phase === "technique-window") {
      this.state = playTechnique(this.state, card.id);
    }
    this.refresh();
  }

  private canResolvePlayerDart(): boolean {
    return (
      this.state.activePlayerId === "player" &&
      !this.cpuRunning &&
      !this.isGuideOpen() &&
      (this.state.phase === "technique-window" ||
        (this.state.phase === "play-outcome" && Boolean(this.stagedOutcomeCardId)))
    );
  }

  private canUsePrimaryAction(): boolean {
    return (
      this.canResolvePlayerDart() ||
      (this.state.activePlayerId === "player" &&
        this.state.phase === "declare-target" &&
        this.state.players.player.dartsThrown > 0 &&
        !this.cpuRunning &&
        !this.isGuideOpen())
    );
  }

  private primaryActionLabel(): string {
    if (this.canResolvePlayerDart()) return "THROW DART";
    return "END VISIT";
  }

  private primaryAction() {
    if (this.isGuideOpen()) return;
    if (this.canResolvePlayerDart()) {
      this.resolvePlayerDart();
      return;
    }
    if (
      this.state.activePlayerId === "player" &&
      this.state.phase === "declare-target" &&
      this.state.players.player.dartsThrown > 0
    ) {
      this.clearStagedCards();
      this.state = endVisit(this.state);
      this.refresh();
      if (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
        this.time.delayedCall(650, () => void this.runCpuVisit());
      }
    }
  }

  private resolvePlayerDart() {
    if (!this.canResolvePlayerDart()) return;
    const drift = this.commitStagedPlayerCards();
    if (!this.state.pendingDart?.outcome) return;
    this.state = resolveDart(this.state);
    this.refresh();
    if (drift.card) this.showDriftNotice(drift.card, drift.canceledBy);
    this.flashHit(this.state.lastDart?.finalTarget);
    if (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
      this.time.delayedCall(950, () => void this.runCpuVisit());
    }
  }

  private commitStagedPlayerCards(): { card?: Card; canceledBy?: Card } {
    if (this.state.activePlayerId !== "player" || this.state.phase !== "play-outcome") {
      return {};
    }
    if (!this.stagedOutcomeCardId) return {};
    if (!this.state.players.player.hand.some((card) => card.id === this.stagedOutcomeCardId)) {
      this.clearStagedCards();
      return {};
    }

    let next = playOutcome(this.state, this.stagedOutcomeCardId);
    const counter = chooseCpuCounterplay(next);
    let driftCard: Card | undefined;
    if (counter) {
      driftCard = counter;
      next = playCounterplay(next, "cpu", counter.id);
    }

    for (const cardId of [...this.stagedTechniqueCardIds]) {
      if (next.players.player.hand.some((card) => card.id === cardId)) {
        next = playTechnique(next, cardId);
      }
    }

    this.clearStagedCards();
    this.state = next;
    return { card: driftCard, canceledBy: next.pendingDart?.counterplayCanceledBy };
  }

  private discardTechniques() {
    if (this.isGuideOpen()) return;
    if (this.state.activePlayerId !== "player" || this.state.phase !== "declare-target") return;
    this.clearStagedCards();
    this.state = discardUnplayedTechniques(this.state);
    this.refresh();
  }

  private newGame() {
    if (this.isGuideOpen()) return;
    this.clearStagedCards();
    this.waitingForPlayerDrift = false;
    this.cpuRunning = false;
    this.driftNotice = undefined;
    this.countedWinner = undefined;
    this.logScrollOffset = 0;
    this.hitFlash.clear();
    this.state = createGame(this.freshLegSeed());
    this.chooseCpuPortrait();
    this.refresh();
  }

  private async runCpuVisit() {
    if (this.cpuRunning) return;
    this.clearStagedCards();
    this.cpuRunning = true;
    while (this.state.activePlayerId === "cpu" && this.state.phase !== "game-over") {
      const choice = chooseCpuDart(this.state);
      if (!choice) {
        this.state = endVisit(this.state, { discardTechniqueCardIds: chooseCpuTechniqueDiscards(this.state) });
        break;
      }
      this.state = declareTarget(this.state, choice.target);
      this.refresh();
      await this.wait(1000);
      this.state = playOutcome(this.state, choice.outcome.id);
      for (const technique of choice.techniques) {
        this.state = playTechnique(this.state, technique.id);
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
    const driftCancel = chooseCpuDriftCancel(this.state);
    if (driftCancel) {
      this.state = playTechnique(this.state, driftCancel.id);
    }
    this.state = resolveDart(this.state, {
      discardTechniqueCardIds:
        this.state.activePlayerId === "cpu" ? chooseCpuTechniqueDiscards(this.state) : undefined
    });
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
