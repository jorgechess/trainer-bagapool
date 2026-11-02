"use client";

import { useEffect, useState } from "react";
import { Trainer } from "@/components/Trainer";
import type { Drill } from "@/lib/poker/drill";
import type { Legend } from "@/lib/poker/legend";
import type { Strategy } from "@/lib/poker/strategy";

interface WarmupProps {
  drill: Drill;
  strategies: Strategy[];
  legend: Legend;
  sourceDrillOf: Record<string, string>;
  seconds: number;
  source: string;
  drillNames: string[];
  sourceDrillNames: Record<string, string>;
}

const STEPS = ["3", "2", "1", "Go!"] as const;
const R = 88;
const CIRC = 2 * Math.PI * R;

/** Contagem 3, 2, 1, Go! num círculo que se fecha a cada segundo, e depois o treino por tempo. */
export function Warmup({ drill, strategies, legend, sourceDrillOf, seconds, source, drillNames, sourceDrillNames }: WarmupProps) {
  const [step, setStep] = useState<number | null>(null);
  const [fill, setFill] = useState(false);

  useEffect(() => {
    if (step === null || step >= STEPS.length) return;
    setFill(false);
    const start = requestAnimationFrame(() => requestAnimationFrame(() => setFill(true)));
    const next = setTimeout(() => setStep((s) => (s === null ? s : s + 1)), step === STEPS.length - 1 ? 700 : 1000);
    return () => {
      cancelAnimationFrame(start);
      clearTimeout(next);
    };
  }, [step]);

  if (step !== null && step >= STEPS.length)
    return <Trainer drill={drill} strategies={strategies} legend={legend} timeLimitSec={seconds} sourceDrillOf={sourceDrillOf} sourceDrillNames={sourceDrillNames} />;

  if (step !== null) {
    const go = STEPS[step] === "Go!";
    return (
      <div className="flex min-h-[70vh] items-center justify-center" data-testid="warmup-countdown">
        <div className="relative h-56 w-56">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" stroke="#27272a" strokeWidth="10" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={go ? "#22c55e" : "#e63946"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={fill || go ? 0 : CIRC}
              style={{ transition: go ? "none" : "stroke-dashoffset 0.95s linear" }}
            />
          </svg>
          <span
            key={step}
            className={`absolute inset-0 flex items-center justify-center font-display tracking-wide ${
              go ? "text-7xl text-green-400" : "text-8xl text-baga-cream"
            }`}
            style={{ animation: "warmup-pop 0.5s ease-out" }}
          >
            {STEPS[step]}
          </span>
        </div>
        <style>{`@keyframes warmup-pop { from { transform: scale(1.6); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="page-title">Aquecimento</h1>
        <p className="muted mt-1">
          {Math.round(seconds / 60)} minutos misturando os {source}:
        </p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2" data-testid="warmup-drills">
        {drillNames.map((name) => (
          <li key={name} className="rounded-md bg-zinc-800 px-3 py-1 text-sm text-zinc-200">
            {name}
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary px-10 py-3 text-lg" onClick={() => setStep(0)}>
        Começar
      </button>
    </div>
  );
}
