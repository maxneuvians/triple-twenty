import { dartboardOrder, type DartNumber, type Target } from "./types";

export function targetScore(target: Target): number {
  if (target.ring === "bull") return 50;
  if (target.ring === "outerBull") return 25;
  if (target.ring === "single") return target.number;
  if (target.ring === "double") return target.number * 2;
  return target.number * 3;
}

export function isLegalCheckoutTarget(target: Target | undefined): boolean {
  return target?.ring === "double" || target?.ring === "bull";
}

export function singleOf(target: Target): Target {
  if (target.ring === "bull" || target.ring === "outerBull") {
    return { ring: "outerBull" };
  }
  return { ring: "single", number: target.number };
}

export function driftNumber(number: DartNumber, direction: "left" | "right"): DartNumber {
  const index = dartboardOrder.indexOf(number);
  if (index < 0) {
    throw new Error(`Unknown dartboard number: ${number}`);
  }
  const delta = direction === "right" ? 1 : -1;
  return dartboardOrder[(index + delta + dartboardOrder.length) % dartboardOrder.length];
}

export function driftTarget(target: Target, direction: "left" | "right"): Target {
  if (target.ring === "bull" || target.ring === "outerBull") {
    return { ring: "outerBull" };
  }
  return { ring: "single", number: driftNumber(target.number, direction) };
}

export function targetLabel(target: Target | undefined): string {
  if (!target) return "-";
  if (target.ring === "bull") return "Bull";
  if (target.ring === "outerBull") return "Outer Bull";
  const prefix = target.ring === "single" ? "S" : target.ring === "double" ? "D" : "T";
  return `${prefix}${target.number}`;
}

export function targetForScore(score: number): Target | undefined {
  if (score === 50) return { ring: "bull" };
  if (score > 0 && score <= 40 && score % 2 === 0) {
    return { ring: "double", number: (score / 2) as DartNumber };
  }
  return undefined;
}
