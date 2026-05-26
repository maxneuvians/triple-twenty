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
import { targetLabel, targetScore } from "../rules/scoring";

type CardView = {
  card: Card;
  rect: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  type: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
};

const boardCenter = { x: 320, y: 320 };
const boardRadius = 205;
const segmentSpan = 18;
const halfSegment = segmentSpan / 2;
const boardRings = {
  bull: 20,
  outerBull: 42,
  innerSingle: 96,
  trebleOuter: 120,
  outerSingle: 184,
  doubleOuter: 205
};

export class PubGameScene extends Phaser.Scene {
  private state!: GameState;
  private board!: Phaser.GameObjects.Graphics;
  private hitFlash!: Phaser.GameObjects.Graphics;
  private boardLabels: Phaser.GameObjects.Text[] = [];
  private ui!: Phaser.GameObjects.Container;
  private handViews: CardView[] = [];
  private promptText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private visitText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logStatusText!: Phaser.GameObjects.Text;
  private logUpButton!: Phaser.GameObjects.Text;
  private logDownButton!: Phaser.GameObjects.Text;
  private logZone!: Phaser.GameObjects.Zone;
  private targetText!: Phaser.GameObjects.Text;
  private actionButton!: Phaser.GameObjects.Text;
  private discardButton!: Phaser.GameObjects.Text;
  private newGameButton!: Phaser.GameObjects.Text;
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
    const g = this.add.graphics();
    g.fillGradientStyle(0x2b1511, 0x2b1511, 0x130b0b, 0x130b0b, 1);
    g.fillRect(0, 0, 1280, 720);

    g.fillStyle(0x3a1f17, 1);
    for (let x = 0; x < 1280; x += 72) {
      g.fillRect(x, 0, 36, 520);
      g.fillStyle(0x26130f, 0.55);
      g.fillRect(x + 34, 0, 3, 520);
      g.fillStyle(0x3a1f17, 1);
    }

    g.fillStyle(0x18100d, 1);
    g.fillRect(0, 520, 1280, 200);
    g.fillStyle(0x0d4a37, 1);
    g.fillRect(0, 560, 1280, 160);
    g.fillStyle(0x0f2c25, 0.5);
    for (let x = 0; x < 1280; x += 24) {
      g.fillRect(x, 560, 8, 160);
    }

    g.lineStyle(4, 0xb88746, 1);
    g.strokeRect(810, 64, 155, 84);
    g.strokeRect(988, 72, 118, 74);
    g.fillStyle(0xe8c176, 1);
    g.fillRect(842, 98, 92, 6);
    g.fillRect(1014, 102, 68, 6);

    g.fillStyle(0x25130e, 0.72);
    g.fillRoundedRect(680, 190, 535, 320, 8);
    g.lineStyle(2, 0xb88746, 0.55);
    g.strokeRoundedRect(680, 190, 535, 320, 8);

    this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.12);
    const scanlines = this.add.graphics();
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

    const zone = this.add.zone(boardCenter.x, boardCenter.y, boardRadius * 2, boardRadius * 2);
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
  }

  private drawBoard(highlight: Target | undefined) {
    const g = this.board;
    g.clear();
    g.fillStyle(0x151515, 1);
    g.fillCircle(boardCenter.x, boardCenter.y, boardRadius + 16);
    g.lineStyle(5, 0xcab27a, 1);
    g.strokeCircle(boardCenter.x, boardCenter.y, boardRadius + 16);

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
    this.drawTargetHighlight(g, highlight);
  }

  private drawAnnularSegment(
    g: Phaser.GameObjects.Graphics,
    innerRadius: number,
    outerRadius: number,
    centerAngleDegrees: number,
    color: number,
    alpha = 1
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
    g.fillStyle(color, alpha);
    g.fillPoints(points, true, true);
  }

  private drawTargetHighlight(g: Phaser.GameObjects.Graphics, highlight: Target | undefined) {
    if (highlight) {
      g.lineStyle(4, 0xffd166, 1);
      if (highlight.ring === "bull") {
        g.fillStyle(0xffd166, 0.18);
        g.fillCircle(boardCenter.x, boardCenter.y, boardRings.bull);
        g.strokeCircle(boardCenter.x, boardCenter.y, boardRings.bull);
      } else if (highlight.ring === "outerBull") {
        g.strokeCircle(boardCenter.x, boardCenter.y, boardRings.outerBull);
      } else {
        const index = dartboardOrder.indexOf(highlight.number);
        const centerAngle = index * segmentSpan - 90;
        if (highlight.ring === "double") {
          this.drawAnnularSegment(g, boardRings.outerSingle, boardRings.doubleOuter, centerAngle, 0xffd166, 0.22);
        } else if (highlight.ring === "treble") {
          this.drawAnnularSegment(g, boardRings.innerSingle, boardRings.trebleOuter, centerAngle, 0xffd166, 0.22);
        } else {
          this.drawAnnularSegment(g, boardRings.outerBull, boardRings.innerSingle, centerAngle, 0xffd166, 0.16);
          this.drawAnnularSegment(g, boardRings.trebleOuter, boardRings.outerSingle, centerAngle, 0xffd166, 0.16);
        }
        const boundaryA = Phaser.Math.DegToRad(centerAngle - halfSegment);
        const boundaryB = Phaser.Math.DegToRad(centerAngle + halfSegment);
        for (const angle of [boundaryA, boundaryB]) {
          g.lineBetween(
            boardCenter.x + Math.cos(angle) * boardRings.outerBull,
            boardCenter.y + Math.sin(angle) * boardRings.outerBull,
            boardCenter.x + Math.cos(angle) * boardRings.doubleOuter,
            boardCenter.y + Math.sin(angle) * boardRings.doubleOuter
          );
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
      const x = boardCenter.x + Math.cos(angle) * 238;
      const y = boardCenter.y + Math.sin(angle) * 238;
      return this.add
        .text(x, y, String(number), {
          fontFamily: "Courier New",
          fontSize: "18px",
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
    if (distance > boardRadius + 16) return undefined;
    if (distance <= 20) return { ring: "bull" };
    if (distance <= 42) return { ring: "outerBull" };

    const degrees = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
    const clockwiseFromTop = (degrees + 90 + 360) % 360;
    const index = Math.floor((clockwiseFromTop + halfSegment) / segmentSpan) % 20;
    const number = dartboardOrder[index];
    if (distance >= boardRings.outerSingle) return { ring: "double", number };
    if (distance >= boardRings.innerSingle && distance <= boardRings.trebleOuter) return { ring: "treble", number };
    return { ring: "single", number };
  }

  private createUiShell() {
    this.ui = this.add.container(0, 0);
    this.scoreText = this.addText(706, 216, "", 28, "#f7e2b3", true, 470, 36);
    this.visitText = this.addText(706, 276, "", 20, "#e8c176", false, 470, 26);
    this.targetText = this.addText(706, 316, "", 20, "#9be2c1", false, 470, 26);
    this.promptText = this.addText(706, 360, "", 20, "#ffd166", true, 470, 52);
    this.logStatusText = this.addText(706, 410, "", 12, "#e8c176", false, 360, 16);
    this.logText = this.addText(706, 432, "", 14, "#f7e2b3", false, 430, 76);
    this.logUpButton = this.makeButton(1150, 424, "^", () => this.scrollLog(1));
    this.logDownButton = this.makeButton(1150, 468, "v", () => this.scrollLog(-1));
    this.logZone = this.add.zone(936, 470, 470, 88);
    this.input.on(
      "wheel",
      (pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
        if (this.isInsideLogZone(pointer.x, pointer.y)) {
          this.scrollLog(deltaY < 0 ? 1 : -1);
        }
      }
    );
    this.actionButton = this.makeButton(706, 518, "THROW DART", () => this.primaryAction());
    this.discardButton = this.makeButton(906, 518, "DISCARD TECH", () => this.discardTechniques());
    this.newGameButton = this.makeButton(1084, 518, "NEW LEG", () => this.newGame());
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

  private makeButton(x: number, y: number, label: string, onClick: () => void) {
    const button = this.add
      .text(x, y, label, {
        fontFamily: "Courier New",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#1a1010",
        backgroundColor: "#e8c176",
        padding: { x: 12, y: 8 }
      })
      .setInteractive({ cursor: "pointer" });
    button.on("pointerdown", onClick);
    return button;
  }

  private refresh() {
    this.drawBoard(this.state.pendingDart?.target);
    const player = this.state.players.player;
    const cpu = this.state.players.cpu;
    this.scoreText.setText(`PLAYER ${player.score}   CPU ${cpu.score}`);
    this.visitText.setText(
      `${this.state.players[this.state.activePlayerId].label.toUpperCase()} VISIT   DART ${this.state.players[this.state.activePlayerId].dartsThrown + 1}/3`
    );
    this.targetText.setText(
      `TARGET ${targetLabel(this.state.pendingDart?.target)}   RESULT ${targetLabel(this.state.lastDart?.finalTarget)}`
    );
    this.promptText.setText(this.prompt());
    this.renderLog();
    this.actionButton.setText(this.primaryActionLabel());
    this.actionButton.setVisible(this.canUsePrimaryAction());
    this.discardButton.setVisible(this.state.activePlayerId === "player" && this.state.phase === "declare-target");
    this.renderHand();
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
      view.rect.destroy();
      view.title.destroy();
      view.type.destroy();
      view.body.destroy();
    }
    this.handViews = [];

    const hand = this.state.players.player.hand;
    const startX = 44;
    const y = 590;
    hand.forEach((card, index) => {
      const x = startX + index * 142;
      const playable = this.isCardPlayable(card);
      const fill = card.kind === "outcome" ? 0xe8eef5 : card.kind === "technique" ? 0xf4f6f9 : 0xf0d0d0;
      const rect = this.add
        .rectangle(x, y, 128, 112, fill, playable ? 1 : 0.45)
        .setOrigin(0, 0)
        .setStrokeStyle(playable ? 3 : 1, playable ? 0xffd166 : 0x5f6b76)
        .setInteractive({ cursor: playable ? "pointer" : "default" });
      const type = this.addText(x + 8, y + 8, card.kind.toUpperCase(), 10, "#334155", true, 112, 14);
      const title = this.addText(x + 8, y + 27, card.name, 14, "#101820", true, 112, 28);
      const body = this.addText(x + 8, y + 64, this.cardHint(card.name), 10, "#101820", false, 112, 36);
      if (playable) rect.on("pointerdown", () => this.playCard(card));
      this.handViews.push({ card, rect, title, type, body });
    });
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
