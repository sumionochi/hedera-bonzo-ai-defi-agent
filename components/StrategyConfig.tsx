"use client";

import { useState } from "react";
import { Settings, AlertTriangle, TrendingDown, TrendingUp, Activity, Zap, Bell, RotateCcw } from "lucide-react";

export interface StrategyConfig {
  bearishThreshold: number;
  bullishThreshold: number;
  confidenceMinimum: number;
  healthFactorDanger: number;
  healthFactorTarget: number;
  highVolatilityThreshold: number;
  minYieldDifferential: number;
}

export interface PriceAlert {
  id: string;
  token: string;
  condition: "below" | "above";
  price: number;
  action: string;
  active: boolean;
}

const DEFAULTS: StrategyConfig = {
  bearishThreshold: -30,
  bullishThreshold: 50,
  confidenceMinimum: 0.6,
  healthFactorDanger: 1.3,
  healthFactorTarget: 1.8,
  highVolatilityThreshold: 80,
  minYieldDifferential: 2.0,
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  color,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  onChange: (v: number) => void;
  icon: any;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3 h-3 ${color}`} />
          <span className="text-[11px] text-gray-400">{label}</span>
        </div>
        <span className={`text-xs font-mono font-medium ${color}`}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        style={{
          accentColor: color.includes("red") ? "#ef4444" : color.includes("yellow") ? "#eab308" : color.includes("blue") ? "#3b82f6" : color.includes("purple") ? "#a855f7" : "#10b981",
        }}
      />
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function StrategyConfigPanel({
  config,
  onConfigChange,
  priceAlerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
}: {
  config: StrategyConfig;
  onConfigChange: (config: StrategyConfig) => void;
  priceAlerts: PriceAlert[];
  onAddAlert: (alert: PriceAlert) => void;
  onRemoveAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [alertExpanded, setAlertExpanded] = useState(false);
  const [newAlertPrice, setNewAlertPrice] = useState("0.15");
  const [newAlertCondition, setNewAlertCondition] = useState<"below" | "above">("below");
  const [newAlertAction, setNewAlertAction] = useState("HARVEST");

  function resetDefaults() {
    onConfigChange({ ...DEFAULTS });
  }

  function addAlert() {
    const price = parseFloat(newAlertPrice);
    if (isNaN(price) || price <= 0) return;
    onAddAlert({
      id: Date.now().toString(),
      token: "HBAR",
      condition: newAlertCondition,
      price,
      action: newAlertAction,
      active: true,
    });
    setNewAlertPrice("0.15");
  }

  const isModified = JSON.stringify(config) !== JSON.stringify(DEFAULTS);

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-medium text-gray-300">Strategy Config</h3>
          {isModified && (
            <span className="text-[9px] bg-purple-500/10 text-purple-400 rounded px-1.5 py-0.5">
              Custom
            </span>
          )}
        </div>
        <span className="text-gray-600 text-xs">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Strategy Sliders */}
          <Slider
            label="Bearish Threshold"
            value={config.bearishThreshold}
            min={-80}
            max={0}
            step={5}
            unit=""
            color="text-red-400"
            icon={TrendingDown}
            onChange={(v) => onConfigChange({ ...config, bearishThreshold: v })}
          />
          <Slider
            label="Bullish Threshold"
            value={config.bullishThreshold}
            min={20}
            max={90}
            step={5}
            unit=""
            color="text-emerald-400"
            icon={TrendingUp}
            onChange={(v) => onConfigChange({ ...config, bullishThreshold: v })}
          />
          <Slider
            label="Health Factor Alert"
            value={config.healthFactorDanger}
            min={1.0}
            max={2.5}
            step={0.1}
            unit=""
            color="text-yellow-400"
            icon={AlertTriangle}
            onChange={(v) => onConfigChange({ ...config, healthFactorDanger: v })}
          />
          <Slider
            label="Volatility Ceiling"
            value={config.highVolatilityThreshold}
            min={30}
            max={150}
            step={5}
            unit="%"
            color="text-blue-400"
            icon={Activity}
            onChange={(v) => onConfigChange({ ...config, highVolatilityThreshold: v })}
          />
          <Slider
            label="Min APY Improvement"
            value={config.minYieldDifferential}
            min={0.5}
            max={10}
            step={0.5}
            unit="%"
            color="text-purple-400"
            icon={Zap}
            onChange={(v) => onConfigChange({ ...config, minYieldDifferential: v })}
          />

          {isModified && (
            <button
              onClick={resetDefaults}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to defaults
            </button>
          )}

          {/* Price Alerts Section */}
          <div className="pt-2 mt-2 border-t border-gray-800/40">
            <button
              onClick={() => setAlertExpanded(!alertExpanded)}
              className="flex items-center gap-2 w-full"
            >
              <Bell className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[11px] text-gray-400">
                Price Alerts ({priceAlerts.length})
              </span>
              <span className="text-gray-600 text-[10px] ml-auto">
                {alertExpanded ? "▾" : "▸"}
              </span>
            </button>

            {alertExpanded && (
              <div className="mt-2 space-y-2">
                {/* Existing alerts */}
                {priceAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg ${
                      alert.active ? "bg-orange-500/10" : "bg-gray-800/30 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onToggleAlert(alert.id)}
                        className={`w-3 h-3 rounded-full border ${
                          alert.active
                            ? "bg-orange-400 border-orange-400"
                            : "border-gray-600"
                        }`}
                      />
                      <span className="text-gray-300">
                        {alert.token} {alert.condition} ${alert.price}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="text-orange-400">{alert.action}</span>
                    </div>
                    <button
                      onClick={() => onRemoveAlert(alert.id)}
                      className="text-gray-600 hover:text-red-400 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Add new alert */}
                <div className="flex gap-1.5 items-center">
                  <span className="text-[10px] text-gray-500 w-10">HBAR</span>
                  <select
                    value={newAlertCondition}
                    onChange={(e) => setNewAlertCondition(e.target.value as "below" | "above")}
                    className="bg-gray-800/60 border border-gray-700/40 rounded text-[10px] text-gray-300 px-1.5 py-1"
                  >
                    <option value="below">below</option>
                    <option value="above">above</option>
                  </select>
                  <span className="text-[10px] text-gray-500">$</span>
                  <input
                    type="number"
                    value={newAlertPrice}
                    onChange={(e) => setNewAlertPrice(e.target.value)}
                    step="0.01"
                    className="w-16 bg-gray-800/60 border border-gray-700/40 rounded text-[10px] text-gray-300 px-1.5 py-1"
                  />
                  <span className="text-[10px] text-gray-500">→</span>
                  <select
                    value={newAlertAction}
                    onChange={(e) => setNewAlertAction(e.target.value)}
                    className="bg-gray-800/60 border border-gray-700/40 rounded text-[10px] text-gray-300 px-1.5 py-1"
                  >
                    <option value="HARVEST">Harvest</option>
                    <option value="EXIT_TO_STABLE">Exit</option>
                    <option value="INCREASE_POSITION">Increase</option>
                    <option value="REBALANCE">Rebalance</option>
                  </select>
                  <button
                    onClick={addAlert}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium px-1.5"
                  >
                    +Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}