"use client";

import { useState, useEffect } from "react";
import { Brain, Activity, BarChart3, Zap, MessageSquare } from "lucide-react";

const THINKING_STEPS = [
  { icon: Brain, label: "Analyzing intent", color: "text-blue-400", delay: 0 },
  { icon: Activity, label: "Checking market conditions", color: "text-yellow-400", delay: 800 },
  { icon: BarChart3, label: "Consulting strategy engine", color: "text-purple-400", delay: 1600 },
  { icon: Zap, label: "Querying DeFi protocols", color: "text-orange-400", delay: 2400 },
  { icon: MessageSquare, label: "Generating response", color: "text-emerald-400", delay: 3200 },
];

export default function AgentThinking() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = THINKING_STEPS.map((step, i) =>
      setTimeout(() => setActiveStep(i), step.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Brain className="w-4 h-4 text-emerald-400 animate-pulse" />
      </div>
      <div className="max-w-[85%] rounded-xl px-4 py-3 bg-gray-800/50 border border-gray-700/30">
        <div className="space-y-1.5">
          {THINKING_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === activeStep;
            const isDone = i < activeStep;
            const isPending = i > activeStep;

            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                  isPending ? "opacity-30" : isDone ? "opacity-60" : "opacity-100"
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isActive ? `${step.color} animate-pulse` : isDone ? "text-gray-500" : "text-gray-700"
                  }`}
                />
                <span
                  className={`${
                    isActive ? step.color : isDone ? "text-gray-500" : "text-gray-700"
                  }`}
                >
                  {step.label}
                  {isActive && (
                    <span className="inline-flex ml-1">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                    </span>
                  )}
                  {isDone && " ✓"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}