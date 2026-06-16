import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  FlaskConical, ArrowLeft, Lightbulb, Beaker, RotateCcw, Sparkles,
  Timer, Sprout, Palette, Layers, AudioWaveform, Mountain, CheckCircle,
  Compass, Diamond, Zap, Lock, Atom, Snowflake, Orbit, Rocket, CloudRain,
  Waves, Flame, TreePine, Cpu, Skull, Globe
} from "lucide-react";
import { LAB_EXPERIMENTS, WORLDS, LAB_INFO } from "@/lib/gameData";
import type { LabExperiment } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const ICON_MAP: Record<string, any> = {
  Timer, Sprout, Palette, Layers, AudioWaveform, Mountain, Compass, Diamond, Zap,
  Atom, Snowflake, Sparkles, Orbit, Rocket, CloudRain, Waves, Flame, TreePine, Cpu, Skull,
};

interface LabPageProps {
  onAddXP: (amount: number) => void;
  onEarnBadge: (badgeId: string) => void;
}

export function ExperimentSimulator({ experiment, onComplete }: { experiment: LabExperiment; onComplete: () => void }) {
  const [values, setValues] = useState(
    experiment.variables.map((v) => v.default)
  );
  const [showResult, setShowResult] = useState(false);

  const getVisualization = () => {
    if (experiment.id === "color-mixing") {
      const r = values[0];
      const g = values[1];
      const b = values[2];
      return (
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-40 h-40 rounded-full border-4 border-border"
            style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
          />
          <p className="text-sm font-bold font-mono">
            rgb({r}, {g}, {b})
          </p>
        </div>
      );
    }

    if (experiment.id === "pendulum-lab") {
      const length = values[0];
      const mass = values[1];
      const angle = values[2];
      const periodSeconds = 2 * Math.PI * Math.sqrt((length / 100) / 9.81);
      const period = periodSeconds.toFixed(2);
      const swingLabel = length < 75 ? "Short string = quicker swing" : length > 125 ? "Long string = slower swing" : "Medium string = medium swing";
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-48">
            <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-foreground -translate-x-1/2" />
            <motion.div
              key={`${length}-${angle}`}
              className="absolute top-2 left-1/2 origin-top"
              style={{ height: `${Math.min(length * 0.8, 150)}px` }}
              animate={{ rotate: [-angle * 0.5, angle * 0.5, -angle * 0.5] }}
              transition={{ duration: periodSeconds, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="w-0.5 h-full bg-foreground/60 mx-auto" />
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 -translate-x-[11px]" />
            </motion.div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold">Swing time: {period}s</p>
            <p className="text-xs text-muted-foreground">{swingLabel}</p>
            <p className="text-[10px] text-muted-foreground">Mass: {mass}g, no effect on swing time</p>
          </div>
        </div>
      );
    }

    if (experiment.id === "plant-growth") {
      const sun = values[0];
      const water = values[1];
      const nutrients = values[2];
      const growth = Math.min(100, (sun + water + nutrients) / 3);
      const health = 100 - Math.abs(sun - 50) - Math.abs(water - 50) * 0.5;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-32">
            <motion.div
              animate={{ height: `${Math.max(20, growth * 1.2)}px` }}
              className="w-3 bg-gradient-to-t from-green-700 to-green-500 rounded-t mx-auto"
            />
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`rounded-full mx-auto -mt-4 ${health > 60 ? "bg-green-400" : health > 30 ? "bg-yellow-400" : "bg-red-400"}`}
              style={{ width: `${Math.max(32, growth * 0.8)}px`, height: `${Math.max(32, growth * 0.8)}px` }}
            />
            <div className="w-20 h-6 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t mx-auto mt-1" />
          </div>
          <p className="text-sm font-bold">Health: {Math.max(0, Math.round(health))}%</p>
        </div>
      );
    }

    if (experiment.id === "density-tower") {
      const layers = [
        { name: "Honey", density: values[0], color: "bg-amber-600" },
        { name: "Water", density: values[1], color: "bg-blue-400" },
        { name: "Oil", density: values[2], color: "bg-yellow-300" },
      ].sort((a, b) => a.density - b.density);

      return (
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 border-2 border-border rounded-b-md overflow-visible">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.name}
                layout
                className={`h-14 ${layer.color} flex items-center justify-center text-xs font-bold text-gray-900`}
              >
                {layer.name} ({layer.density.toFixed(1)})
              </motion.div>
            ))}
          </div>
        </div>
      );
    }

    if (experiment.id === "sound-waves") {
      const freq = values[0];
      const amp = values[1];
      return (
        <div className="flex flex-col items-center gap-4">
          <svg width="200" height="100" className="overflow-visible">
            <motion.path
              d={`M 0 50 ${Array.from({ length: 40 }, (_, i) => {
                const x = i * 5;
                const y = 50 + Math.sin(i * freq / 200) * amp * 0.4;
                return `L ${x} ${y}`;
              }).join(" ")}`}
              fill="none"
              stroke="hsl(280, 70%, 55%)"
              strokeWidth="2"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </svg>
          <p className="text-sm font-bold">{freq} Hz - {freq < 300 ? "Low pitch" : freq < 800 ? "Medium pitch" : "High pitch"}</p>
        </div>
      );
    }

    if (experiment.id === "volcano-sim") {
      const pressure = values[0];
      const gas = values[1];
      const viscosity = values[2];
      const explosiveness = (pressure + gas + viscosity) / 3;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-0 h-0 border-l-[50px] border-r-[50px] border-b-[80px] border-l-transparent border-r-transparent border-b-amber-800 mx-auto" />
            {explosiveness > 50 && (
              <motion.div
                animate={{ y: [-5, -20, -5], opacity: [1, 0.5, 1], scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="absolute -top-6 left-1/2 -translate-x-1/2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-t from-red-600 to-orange-400" />
              </motion.div>
            )}
            {explosiveness > 30 && (
              <>
                {[...Array(Math.floor(explosiveness / 20))].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-orange-400"
                    style={{ top: -10, left: `${40 + i * 8}px` }}
                    animate={{ y: [0, -30 - i * 10], x: [(i - 2) * 10, (i - 2) * 20], opacity: [1, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </>
            )}
          </div>
          <p className="text-sm font-bold">
            Eruption type: {explosiveness > 70 ? "Explosive!" : explosiveness > 40 ? "Moderate" : "Gentle flow"}
          </p>
        </div>
      );
    }

    if (experiment.id === "magnetic-fields") {
      const strength = values[0];
      const distance = values[1];
      const filings = values[2];
      const fieldIntensity = strength / Math.max(1, distance * distance);
      const ringCount = Math.min(8, Math.max(3, Math.floor(strength / 15)));
      return (
        <div className="flex flex-col items-center gap-4">
          <svg width="200" height="200" className="overflow-visible">
            {Array.from({ length: ringCount }, (_, i) => {
              const r = 15 + i * (80 / ringCount);
              const opacity = Math.max(0.15, 1 - i * 0.12);
              return (
                <motion.ellipse
                  key={i}
                  cx="100"
                  cy="100"
                  rx={r}
                  ry={r * 0.6}
                  fill="none"
                  stroke="hsl(0, 80%, 55%)"
                  strokeWidth={Math.max(1, 3 - i * 0.3)}
                  opacity={opacity}
                  animate={{ rx: [r, r + 3, r], ry: [r * 0.6, r * 0.65, r * 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
                />
              );
            })}
            <circle cx="100" cy="100" r="8" fill="hsl(0, 80%, 55%)" />
            {Array.from({ length: Math.min(20, Math.floor(filings / 25)) }, (_, i) => {
              const angle = (i / Math.min(20, Math.floor(filings / 25))) * Math.PI * 2;
              const dist = 20 + Math.random() * 60;
              return (
                <circle
                  key={`f-${i}`}
                  cx={100 + Math.cos(angle) * dist}
                  cy={100 + Math.sin(angle) * dist * 0.6}
                  r="1.5"
                  fill="hsl(0, 0%, 50%)"
                />
              );
            })}
          </svg>
          <p className="text-sm font-bold">Relative field strength: {fieldIntensity.toFixed(2)}</p>
        </div>
      );
    }

    if (experiment.id === "crystal-growth") {
      const temp = values[0];
      const concentration = values[1];
      const time = values[2];
      const crystalSize = Math.min(80, (concentration * time) / 30);
      const perfection = Math.max(0, 100 - temp * 0.8);
      return (
        <div className="flex flex-col items-center gap-4">
          <svg width="200" height="200" className="overflow-visible">
            <defs>
              <linearGradient id="crystalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(280, 80%, 70%)" />
                <stop offset="100%" stopColor="hsl(280, 80%, 40%)" />
              </linearGradient>
            </defs>
            <motion.polygon
              points={`100,${100 - crystalSize} ${100 + crystalSize * 0.6},${100 - crystalSize * 0.3} ${100 + crystalSize * 0.4},${100 + crystalSize * 0.5} 100,${100 + crystalSize * 0.7} ${100 - crystalSize * 0.4},${100 + crystalSize * 0.5} ${100 - crystalSize * 0.6},${100 - crystalSize * 0.3}`}
              fill="url(#crystalGrad)"
              stroke="hsl(280, 80%, 65%)"
              strokeWidth="1.5"
              opacity={0.9}
              animate={{ scale: [0.98, 1.02, 0.98] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            {perfection > 50 && (
              <motion.line
                x1="100" y1={100 - crystalSize * 0.5}
                x2="100" y2={100 + crystalSize * 0.5}
                stroke="hsl(280, 80%, 80%)"
                strokeWidth="0.5"
                opacity={0.5}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </svg>
          <p className="text-sm font-bold">Crystal quality: {Math.round(perfection)}% - Size: {crystalSize.toFixed(0)}mm</p>
        </div>
      );
    }

    if (experiment.id === "electric-circuits") {
      const voltage = values[0];
      const resistance = values[1];
      const current = (voltage / resistance) * 1000;
      const brightness = Math.min(100, current * 2);
      return (
        <div className="flex flex-col items-center gap-4">
          <svg width="200" height="160" className="overflow-visible">
            <rect x="10" y="50" width="20" height="60" fill="none" stroke="hsl(45, 90%, 50%)" strokeWidth="2" rx="2" />
            <text x="20" y="45" textAnchor="middle" fontSize="10" fill="currentColor">+</text>
            <text x="20" y="120" textAnchor="middle" fontSize="10" fill="currentColor">-</text>
            <line x1="20" y1="50" x2="20" y2="30" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            <line x1="20" y1="30" x2="180" y2="30" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            <line x1="180" y1="30" x2="180" y2="60" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            <rect x="165" y="60" width="30" height="15" fill="none" stroke="hsl(0, 70%, 50%)" strokeWidth="2" rx="2" />
            <text x="180" y="90" textAnchor="middle" fontSize="8" fill="currentColor">{resistance}Ω</text>
            <line x1="180" y1="75" x2="180" y2="100" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            <motion.circle
              cx="180" cy="115" r="12"
              fill={`hsl(45, 90%, ${Math.min(80, 20 + brightness * 0.6)}%)`}
              stroke="hsl(45, 90%, 50%)" strokeWidth="1.5"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            <line x1="180" y1="127" x2="180" y2="140" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            <line x1="180" y1="140" x2="20" y2="140" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            <line x1="20" y1="140" x2="20" y2="110" stroke="hsl(45, 90%, 50%)" strokeWidth="2" />
            {current > 0 && (
              <motion.circle
                r="3" fill="hsl(200, 90%, 60%)"
                animate={{
                  cx: [20, 20, 180, 180, 180, 180, 20, 20],
                  cy: [50, 30, 30, 60, 127, 140, 140, 110],
                }}
                transition={{ duration: Math.max(0.5, 3 - current * 0.02), repeat: Infinity, ease: "linear" }}
              />
            )}
          </svg>
          <p className="text-sm font-bold">Current: {current.toFixed(1)} mA | {voltage}V</p>
        </div>
      );
    }

    if (experiment.id === "rocket-thrust") {
      const fuelMix = values[0];
      const nozzleAngle = values[1];
      const thrust = values[2];
      const efficiency = fuelMix <= 5 ? fuelMix * 18 : (10 - fuelMix) * 18;
      const dirLoss = Math.cos((nozzleAngle * Math.PI) / 180);
      const altitude = Math.round((thrust * efficiency * dirLoss) / 50);
      const flameSize = Math.max(10, thrust * 0.6);
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-52">
            <motion.div
              className="absolute left-1/2 -translate-x-1/2"
              animate={{ y: [0, -Math.min(altitude * 0.3, 60), 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ bottom: `${40 + flameSize}px` }}
            >
              <div className="w-6 h-16 bg-gradient-to-t from-gray-500 to-gray-300 rounded-t-full mx-auto" />
              <div className="w-3 h-3 bg-red-500 rounded-full mx-auto -mt-1" />
            </motion.div>
            {thrust > 15 && (
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 bottom-6"
                style={{ transform: `translateX(-50%) rotate(${nozzleAngle}deg)` }}
                animate={{ scaleY: [0.8, 1.2, 0.8], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                <div
                  className="bg-gradient-to-b from-yellow-400 via-orange-500 to-red-600 rounded-b-full mx-auto"
                  style={{ width: `${Math.max(8, flameSize * 0.4)}px`, height: `${flameSize}px` }}
                />
              </motion.div>
            )}
            <div className="absolute bottom-0 w-full h-6 bg-gradient-to-t from-amber-800 to-amber-600 rounded-t" />
          </div>
          <p className="text-sm font-bold">Est. Altitude: {altitude}km | Efficiency: {Math.round(efficiency)}%</p>
        </div>
      );
    }

    if (experiment.id === "photosynthesis-sim") {
      const light = values[0];
      const co2 = values[1];
      const temp = values[2];
      const tempFactor = temp > 40 ? Math.max(0, 1 - (temp - 40) / 10) : temp < 10 ? temp / 10 : 1;
      const rate = Math.round((light / 100) * (co2 / 1000) * tempFactor * 100);
      const bubbleCount = Math.min(12, Math.floor(rate / 8));
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-44">
            <div className="absolute bottom-0 w-24 h-32 bg-green-800/30 rounded-t-lg left-1/2 -translate-x-1/2 border-2 border-green-700/50" />
            <motion.div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-4 bg-gradient-to-t from-green-800 to-green-500 rounded-t"
              animate={{ height: [20, 20 + rate * 0.6, 20 + rate * 0.6] }}
              transition={{ duration: 1 }}
            />
            {Array.from({ length: Math.max(3, Math.floor(light / 15)) }, (_, i) => (
              <motion.div
                key={`leaf-${i}`}
                className="absolute bg-green-500 rounded-full"
                style={{
                  width: `${12 + rate * 0.15}px`, height: `${8 + rate * 0.1}px`,
                  left: `${50 + (i % 2 === 0 ? -15 - i * 3 : 15 + i * 3)}%`,
                  bottom: `${30 + i * 14}px`,
                  transform: `rotate(${i % 2 === 0 ? -30 : 30}deg)`
                }}
                animate={{ scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
            {light > 20 && (
              <motion.div
                className="absolute top-0 right-2 text-2xl"
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2, repeat: Infinity }}
              >☀️</motion.div>
            )}
            {Array.from({ length: bubbleCount }, (_, i) => (
              <motion.div
                key={`o2-${i}`}
                className="absolute w-2 h-2 rounded-full bg-blue-300/60"
                style={{ left: `${35 + Math.random() * 30}%`, bottom: "40%" }}
                animate={{ y: [-10, -50 - Math.random() * 30], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
              />
            ))}
          </div>
          <p className="text-sm font-bold">Rate: {rate}% | O₂ output: {bubbleCount > 0 ? "Active" : "Low"}</p>
        </div>
      );
    }

    if (experiment.id === "acid-rain-sim") {
      const so2 = values[0];
      const nox = values[1];
      const rain = values[2];
      const acidity = Math.max(1, 7 - (so2 + nox) / 30);
      const damage = Math.min(100, ((so2 + nox) * rain) / 100);
      const dropCount = Math.min(15, Math.floor(rain / 7));
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-48 h-44">
            <motion.div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-12 rounded-full"
              style={{ backgroundColor: `hsl(${Math.max(0, 200 - (so2 + nox) * 1.5)}, 30%, ${50 - (so2 + nox) * 0.2}%)` }}
              animate={{ x: [-5, 5, -5] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            {Array.from({ length: dropCount }, (_, i) => (
              <motion.div
                key={`drop-${i}`}
                className="absolute w-1.5 rounded-full"
                style={{
                  height: "8px",
                  left: `${15 + (i * 70) / dropCount}%`,
                  top: "14%",
                  backgroundColor: acidity < 4 ? "hsl(0, 70%, 50%)" : acidity < 5.6 ? "hsl(40, 80%, 50%)" : "hsl(200, 70%, 60%)",
                }}
                animate={{ y: [0, 100], opacity: [1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
            <div className="absolute bottom-0 w-full flex items-end justify-center gap-2">
              <div className="relative">
                <div className="w-8 h-16 bg-gradient-to-t from-green-800 to-green-500 rounded-t-full"
                  style={{ opacity: Math.max(0.2, 1 - damage / 100) }} />
                {damage > 50 && <div className="absolute inset-0 bg-yellow-600/40 rounded-t-full" />}
              </div>
              <div className="w-12 h-8 bg-gradient-to-t from-gray-500 to-gray-400 rounded-t"
                style={{ opacity: Math.max(0.3, 1 - damage / 150) }} />
              <div className="relative">
                <div className="w-6 h-12 bg-gradient-to-t from-green-700 to-green-400 rounded-t-full"
                  style={{ opacity: Math.max(0.2, 1 - damage / 100) }} />
              </div>
            </div>
          </div>
          <p className="text-sm font-bold">pH: {acidity.toFixed(1)} | Damage: {Math.round(damage)}%</p>
        </div>
      );
    }

    if (experiment.id === "gravity-well") {
      const mass = values[0];
      const speed = values[1];
      const distance = values[2];
      const escapeV = Math.sqrt(2 * mass);
      const orbiting = speed > escapeV * 0.4 && speed < escapeV * 1.2;
      const orbitRadius = 20 + distance * 0.5;
      return (
        <div className="flex flex-col items-center gap-4">
          <svg width="200" height="200" className="overflow-visible">
            {Array.from({ length: Math.min(6, Math.floor(mass / 15)) }, (_, i) => (
              <motion.circle
                key={i}
                cx="100" cy="100"
                r={30 + i * 15}
                fill="none"
                stroke="hsl(260, 50%, 40%)"
                strokeWidth="0.5"
                strokeDasharray="4,4"
                opacity={0.3}
                animate={{ r: [30 + i * 15, 32 + i * 15, 30 + i * 15] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            ))}
            <motion.circle
              cx="100" cy="100"
              r={Math.max(5, mass * 0.12)}
              fill="hsl(40, 90%, 55%)"
              animate={{ scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.circle
              r="5"
              fill="hsl(200, 80%, 55%)"
              animate={orbiting ? {
                cx: [100 + orbitRadius, 100, 100 - orbitRadius, 100, 100 + orbitRadius],
                cy: [100, 100 - orbitRadius * 0.6, 100, 100 + orbitRadius * 0.6, 100],
              } : {
                cx: [100 + orbitRadius, 100 + orbitRadius + 40],
                cy: [100, 100 + (speed < escapeV * 0.4 ? 30 : -30)],
              }}
              transition={orbiting
                ? { duration: Math.max(1, 5 - speed * 0.03), repeat: Infinity, ease: "linear" }
                : { duration: 2, repeat: Infinity, repeatType: "reverse" as const }
              }
            />
          </svg>
          <p className="text-sm font-bold">{orbiting ? "Stable orbit!" : speed < escapeV * 0.4 ? "Too slow - crashing!" : "Too fast - escaping!"}</p>
        </div>
      );
    }

    if (experiment.id === "nuclear-fusion") {
      const plasmaTemp = values[0];
      const magnetic = values[1];
      const fuelRate = values[2];
      const fusionActive = plasmaTemp >= 100 && magnetic > 50;
      const containment = magnetic / 100;
      const instability = plasmaTemp > 120 && magnetic < 70;
      const energyOut = fusionActive ? Math.round(plasmaTemp * fuelRate * containment / 10) : 0;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-44 h-44">
            <svg width="176" height="176" className="overflow-visible">
              <ellipse cx="88" cy="88" rx="75" ry="75" fill="none" stroke="hsl(210, 60%, 40%)" strokeWidth="3" />
              <ellipse cx="88" cy="88" rx="70" ry="70" fill="none" stroke="hsl(210, 60%, 50%)" strokeWidth="1" strokeDasharray="4,3" />
              {Array.from({ length: Math.min(8, Math.floor(magnetic / 12)) }, (_, i) => (
                <motion.line
                  key={i}
                  x1={88 + Math.cos((i / 8) * Math.PI * 2) * 72}
                  y1={88 + Math.sin((i / 8) * Math.PI * 2) * 72}
                  x2={88 + Math.cos((i / 8) * Math.PI * 2) * 80}
                  y2={88 + Math.sin((i / 8) * Math.PI * 2) * 80}
                  stroke="hsl(200, 80%, 60%)"
                  strokeWidth="2"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
              <motion.circle
                cx="88" cy="88"
                r={Math.max(15, 15 + fuelRate * 0.3)}
                fill={fusionActive
                  ? instability ? "hsl(0, 90%, 60%)" : "hsl(40, 95%, 60%)"
                  : `hsl(${200 + plasmaTemp}, 60%, ${30 + plasmaTemp * 0.2}%)`}
                animate={instability
                  ? { scale: [0.8, 1.3, 0.7, 1.2, 0.8], opacity: [0.6, 1, 0.5, 1, 0.6] }
                  : fusionActive
                    ? { scale: [0.95, 1.1, 0.95], opacity: [0.8, 1, 0.8] }
                    : { scale: [0.98, 1.02, 0.98] }}
                transition={{ duration: instability ? 0.5 : 1.5, repeat: Infinity }}
              />
              {fusionActive && Array.from({ length: 6 }, (_, i) => (
                <motion.circle
                  key={`p-${i}`}
                  r="2"
                  fill="hsl(55, 100%, 70%)"
                  animate={{
                    cx: [88, 88 + (Math.random() - 0.5) * 40, 88],
                    cy: [88, 88 + (Math.random() - 0.5) * 40, 88],
                    opacity: [0, 1, 0]
                  }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </svg>
          </div>
          <p className="text-sm font-bold">
            {instability ? "⚠️ UNSTABLE!" : fusionActive ? `Fusion active! ${energyOut}MW` : "No fusion - need 100M+ °C"}
          </p>
        </div>
      );
    }

    if (experiment.id === "quantum-tunneling") {
      const energy = values[0];
      const barrierW = values[1];
      const barrierH = values[2];
      const tunnelProb = Math.max(0, Math.min(100, Math.round(
        (energy / barrierH) * 100 * Math.exp(-barrierW / 15)
      )));
      const tunneled = energy > 0 && tunnelProb > 20;
      return (
        <div className="flex flex-col items-center gap-4">
          <svg width="220" height="140" className="overflow-visible">
            <line x1="0" y1="120" x2="220" y2="120" stroke="currentColor" strokeWidth="1" opacity="0.3" />
            <rect
              x={90} y={120 - barrierH}
              width={barrierW * 2}
              height={barrierH}
              fill="hsl(190, 50%, 30%)"
              stroke="hsl(190, 70%, 50%)"
              strokeWidth="1.5"
              opacity="0.7"
              rx="2"
            />
            <text x={90 + barrierW} y={125 - barrierH / 2} textAnchor="middle" fontSize="9" fill="hsl(190, 80%, 70%)" fontWeight="bold">
              {barrierH}eV
            </text>
            <motion.circle
              r="6"
              fill={`hsl(${50 + energy * 2}, 90%, 55%)`}
              animate={tunneled ? {
                cx: [30, 85, 95 + barrierW * 2, 200],
                cy: [120 - energy * 0.5, 120 - energy * 0.6, 120 - energy * 0.4, 120 - energy * 0.5],
                opacity: [1, 0.4, 0.4, 1],
              } : {
                cx: [30, 85, 30],
                cy: [120 - energy * 0.5, 120 - energy * 0.6, 120 - energy * 0.5],
              }}
              transition={{ duration: tunneled ? 2.5 : 1.5, repeat: Infinity }}
            />
            {tunneled && (
              <motion.path
                d={`M 85 ${120 - energy * 0.6} Q ${90 + barrierW} ${120 - barrierH * 0.3} ${95 + barrierW * 2} ${120 - energy * 0.4}`}
                fill="none"
                stroke="hsl(190, 80%, 60%)"
                strokeWidth="1.5"
                strokeDasharray="3,3"
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </svg>
          <p className="text-sm font-bold">
            Tunnel probability: {tunnelProb}% | {tunneled ? "Tunneling!" : "Reflected"}
          </p>
        </div>
      );
    }

    if (experiment.id === "superconductor-lab") {
      const temp = values[0];
      const magField = values[1];
      const purity = values[2];
      const criticalTemp = -180 + (purity - 50) * 0.5;
      const isSuperconducting = temp < criticalTemp;
      const resistance = isSuperconducting ? 0 : Math.max(0, (temp - criticalTemp) * 0.5);
      const levHeight = isSuperconducting ? Math.min(30, magField * 0.3) : 0;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-44 h-44">
            <svg width="176" height="176" className="overflow-visible">
              <rect x="38" y="120" width="100" height="30" rx="4"
                fill={isSuperconducting ? "hsl(200, 90%, 55%)" : "hsl(200, 20%, 40%)"}
                stroke={isSuperconducting ? "hsl(200, 90%, 70%)" : "hsl(200, 20%, 50%)"} strokeWidth="2" />
              {isSuperconducting && (
                <motion.rect x="38" y="120" width="100" height="30" rx="4"
                  fill="none" stroke="hsl(200, 90%, 80%)" strokeWidth="1"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              <motion.g animate={{ y: isSuperconducting ? -levHeight : 0 }} transition={{ duration: 0.5, type: "spring" }}>
                <rect x="68" y="100" width="40" height="18" rx="3"
                  fill="hsl(0, 0%, 45%)" stroke="hsl(0, 0%, 60%)" strokeWidth="1.5" />
                <text x="88" y="113" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">N S</text>
              </motion.g>
              {isSuperconducting && Array.from({ length: 5 }, (_, i) => (
                <motion.line
                  key={i}
                  x1={48 + i * 20} y1="118" x2={48 + i * 20} y2={100 - levHeight}
                  stroke="hsl(200, 80%, 70%)" strokeWidth="0.5" strokeDasharray="2,2"
                  animate={{ opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
              <text x="88" y="165" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">
                R = {resistance.toFixed(1)}Ω
              </text>
            </svg>
          </div>
          <p className="text-sm font-bold">
            {isSuperconducting ? "⚡ Superconducting! Zero resistance!" : `Cooling... (need ${Math.round(criticalTemp)}°C)`}
          </p>
        </div>
      );
    }

    if (experiment.id === "deep-pressure-lab") {
      const depth = values[0];
      const temp = values[1];
      const pressure = (depth / 10 + 1).toFixed(0);
      const crushPct = Math.min(100, depth / 110);
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-48 rounded-b-lg overflow-hidden" style={{ background: `linear-gradient(to bottom, hsl(210,80%,${70 - depth / 200}%), hsl(220,90%,${15}%))` }}>
            <motion.div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded border-2 border-white/30 bg-white/10"
              animate={{ width: `${Math.max(20, 60 - crushPct * 0.4)}px`, height: `${Math.max(15, 40 - crushPct * 0.25)}px` }}
            />
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-white/40" animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2 + i * 0.5, repeat: Infinity }} style={{ left: `${20 + i * 20}%`, top: `${50 + i * 8}%` }} />
            ))}
          </div>
          <p className="text-sm font-bold">{pressure} atm pressure | {temp}°C</p>
        </div>
      );
    }

    if (experiment.id === "lava-viscosity-lab") {
      const silica = values[0];
      const temp = values[1];
      const crystalContent = values[2];
      const flowSpeed = Math.max(1, ((temp - 700) / 6) * ((100 - silica) / 100) * ((100 - crystalContent) / 100));
      const isExplosive = silica > 65 || crystalContent > 45;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-44 h-40 rounded-lg overflow-hidden bg-gradient-to-t from-red-950 to-gray-800">
            <motion.div
              className="absolute bottom-0 w-full rounded-t"
              style={{ background: `linear-gradient(to top, hsl(${Math.max(0, 30 - silica / 3)},90%,${40 + temp / 30}%), hsl(0,80%,30%))`, height: `${40 + temp / 20}%` }}
              animate={{ height: [`${35 + temp / 20}%`, `${45 + temp / 20}%`] }}
              transition={{ duration: Math.max(0.5, 5 - flowSpeed / 20), repeat: Infinity, repeatType: "reverse" }}
            />
            {isExplosive && (
              <motion.div className="absolute top-2 left-1/2 -translate-x-1/2 text-2xl" animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.5, repeat: Infinity }}>
                *
              </motion.div>
            )}
          </div>
          <p className="text-sm font-bold">{isExplosive ? "Thick, gas-trapping magma!" : "Gentle flow"} | Flow: {flowSpeed.toFixed(0)}</p>
        </div>
      );
    }

    if (experiment.id === "ice-core-lab") {
      const drillDepth = values[0];
      const co2 = values[1];
      const age = values[2];
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-48 rounded bg-gradient-to-b from-blue-100 to-blue-300 border-2 border-blue-400/50 overflow-hidden">
            {Array.from({ length: Math.min(8, Math.floor(drillDepth / 400)) }).map((_, i) => (
              <div key={i} className="w-full border-b border-blue-500/30" style={{ height: `${100 / Math.max(1, Math.floor(drillDepth / 400))}%`, opacity: 0.3 + i * 0.08 }}>
                <motion.div className="w-1 h-1 rounded-full bg-white/60 mx-auto mt-1" animate={{ scale: [0.8, 1.2, 0.8] }} transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }} />
              </div>
            ))}
            <motion.div className="absolute left-1/2 -translate-x-1/2 w-1 bg-gray-600" animate={{ height: `${drillDepth / 30}%` }} style={{ top: 0 }} />
          </div>
          <p className="text-sm font-bold">{co2} ppm CO2 | {age.toLocaleString()} years old</p>
        </div>
      );
    }

    if (experiment.id === "canopy-ecosystem-lab") {
      const height = values[0];
      const light = values[1];
      const humidity = values[2];
      const layer = height > 45 ? "Emergent" : height > 25 ? "Canopy" : height > 10 ? "Understory" : "Forest Floor";
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-48 h-48 rounded-lg overflow-hidden" style={{ background: `linear-gradient(to bottom, hsl(200,70%,${50 + light / 3}%), hsl(120,${30 + humidity / 3}%,${15 + light / 5}%))` }}>
            {[10, 25, 45, 60].map((h, i) => (
              <div key={i} className="absolute w-full border-t border-dashed border-green-400/30" style={{ bottom: `${h * 100 / 60}%` }}>
                <span className="text-[8px] text-green-300/60 ml-1">{["Floor", "Under", "Canopy", "Emergent"][i]}</span>
              </div>
            ))}
            <motion.div className="absolute w-3 h-3 rounded-full bg-yellow-300/60" animate={{ x: [0, 10, 0] }} transition={{ duration: 3, repeat: Infinity }} style={{ bottom: `${height * 100 / 60}%`, left: "40%" }} />
          </div>
          <p className="text-sm font-bold">{layer} Layer | {light}% light</p>
        </div>
      );
    }

    if (experiment.id === "zero-gravity-lab") {
      const gravity = values[0];
      const mass = values[1];
      const force = values[2];
      const accel = gravity === 0 ? (force / mass) : (force / mass + 9.81 * gravity / 100);
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-44 h-44 rounded-lg bg-gray-900 border border-gray-700 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/30" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }} />
            ))}
            <motion.div
              className="absolute w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500"
              animate={gravity < 10 ? { y: [60, 50, 70, 55, 65], x: [60, 70, 55, 65, 60] } : { y: [20, 120] }}
              transition={gravity < 10 ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : { duration: Math.max(0.5, 3 - accel / 5), repeat: Infinity }}
              style={{ left: "35%" }}
            />
          </div>
          <p className="text-sm font-bold">{gravity < 10 ? "Floating!" : `Falling at ${accel.toFixed(1)} m/s²`}</p>
        </div>
      );
    }

    if (experiment.id === "crystal-growth-lab") {
      const temp = values[0];
      const saturation = values[1];
      const coolingRate = values[2];
      const crystalSize = Math.max(5, (saturation - 100) * (100 - coolingRate) / 100 * 0.5);
      const crystalCount = Math.max(1, Math.floor(coolingRate / 5));
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-44 h-40 rounded-lg bg-gradient-to-b from-purple-950 to-violet-900 overflow-hidden flex items-center justify-center">
            {Array.from({ length: Math.min(12, crystalCount) }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                style={{
                  width: `${Math.max(4, crystalSize / crystalCount * 3)}px`,
                  height: `${Math.max(8, crystalSize / crystalCount * 6)}px`,
                  left: `${15 + (i % 4) * 20}%`,
                  top: `${20 + Math.floor(i / 4) * 30}%`,
                  background: `linear-gradient(135deg, hsl(${270 + i * 15},80%,70%), hsl(${280 + i * 15},60%,40%))`,
                  clipPath: "polygon(50% 0%, 100% 40%, 80% 100%, 20% 100%, 0% 40%)",
                }}
                animate={{ scale: [0.9, 1.1, 0.9], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, delay: i * 0.3, repeat: Infinity }}
              />
            ))}
          </div>
          <p className="text-sm font-bold">{crystalCount > 5 ? "Many tiny crystals" : "Few large crystals"} | {temp}°C</p>
        </div>
      );
    }

    if (experiment.id === "lightning-generator-lab") {
      const voltage = values[0];
      const humidity = values[1];
      const distance = values[2];
      const electricField = voltage / distance;
      const humidAirAdjustment = humidity > 70 ? 0.85 : humidity < 35 ? 1.15 : 1;
      const breakdownThreshold = 3_000_000 * humidAirAdjustment;
      const willStrike = electricField >= breakdownThreshold;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-48 h-44 rounded-lg bg-gradient-to-b from-gray-700 to-gray-900 overflow-hidden">
            <div className="absolute top-0 w-full h-8 bg-gradient-to-b from-gray-600/80 to-transparent rounded-b" />
            <div className="absolute bottom-0 w-full h-4 bg-gradient-to-t from-green-900/50 to-transparent" />
            {willStrike && (
              <motion.svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <motion.path
                  d="M50 10 L45 40 L55 38 L42 90"
                  stroke="hsl(50,100%,70%)"
                  strokeWidth="2"
                  fill="none"
                  animate={{ opacity: [0, 1, 0.3, 1, 0], strokeWidth: [1, 3, 1, 3, 1] }}
                  transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 1.5 }}
                />
              </motion.svg>
            )}
          </div>
          <p className="text-sm font-bold">{willStrike ? "STRIKE!" : "Charging..."} | {(electricField / 1_000_000).toFixed(1)} MV/m</p>
        </div>
      );
    }

    if (experiment.id === "logic-gate-lab") {
      const a = values[0] >= 0.5 ? 1 : 0;
      const b = values[1] >= 0.5 ? 1 : 0;
      const gateIdx = Math.min(3, Math.floor(values[2]));
      const gates = ["AND", "OR", "NOT", "XOR"];
      const gateName = gates[gateIdx];
      const output = gateName === "AND" ? a & b : gateName === "OR" ? a | b : gateName === "NOT" ? (a ? 0 : 1) : a ^ b;
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-52 h-36 rounded-lg bg-gray-900 border border-cyan-500/30 flex items-center justify-center gap-4 p-4">
            <div className="flex flex-col gap-3 text-xs font-mono">
              <div className={`px-2 py-1 rounded ${a ? "bg-green-500/30 text-green-400" : "bg-gray-700 text-gray-400"}`}>A={a}</div>
              {gateName !== "NOT" && <div className={`px-2 py-1 rounded ${b ? "bg-green-500/30 text-green-400" : "bg-gray-700 text-gray-400"}`}>B={b}</div>}
            </div>
            <div className="px-3 py-2 rounded border-2 border-cyan-500/50 text-cyan-400 font-bold text-sm">{gateName}</div>
            <motion.div
              className={`px-3 py-2 rounded font-bold text-sm ${output ? "bg-green-500/30 text-green-400 border-2 border-green-500/50" : "bg-red-500/20 text-red-400 border-2 border-red-500/30"}`}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {output}
            </motion.div>
          </div>
          <p className="text-sm font-bold">{gateName} gate: {a}{gateName !== "NOT" ? ` ${gateName} ${b}` : ""} = {output}</p>
        </div>
      );
    }

    if (experiment.id === "fossil-dating-lab") {
      const age = values[0];
      const c14 = values[1];
      const halfLives = age / 5730;
      const expectedC14 = (100 * Math.pow(0.5, halfLives)).toFixed(1);
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-44 h-40 rounded-lg bg-gradient-to-b from-amber-900/60 to-amber-950 overflow-hidden flex items-center justify-center">
            <motion.svg className="w-24 h-24" viewBox="0 0 50 50">
              <motion.path
                d="M25 5 C20 15, 10 20, 15 30 C18 35, 22 40, 25 45 C28 40, 32 35, 35 30 C40 20, 30 15, 25 5Z"
                fill={`hsl(35, ${60 + c14 / 2}%, ${30 + c14 / 5}%)`}
                stroke="hsl(35,60%,40%)"
                strokeWidth="1"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </motion.svg>
          </div>
          <p className="text-sm font-bold">{halfLives.toFixed(1)} half-lives | Expected C-14: {expectedC14}%</p>
        </div>
      );
    }

    if (experiment.id === "wave-particle-lab") {
      const slitWidth = values[0];
      const energy = values[1];
      const rate = values[2];
      const waveLength = Math.max(1, 100 / energy);
      const fringes = Math.max(2, Math.floor(slitWidth / waveLength));
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-52 h-40 rounded-lg bg-gray-950 overflow-hidden">
            <div className="absolute left-[30%] top-0 h-full w-0.5 bg-gray-500">
              <div className="absolute bg-gray-950" style={{ top: `${50 - slitWidth / 2}%`, height: `${slitWidth}%`, width: "100%" }} />
            </div>
            {Array.from({ length: Math.min(15, fringes * 2 + 1) }).map((_, i) => {
              const pos = 50 + (i - fringes) * (80 / (fringes * 2 + 1));
              const intensity = Math.pow(Math.cos((i - fringes) * Math.PI / (fringes + 1)), 2);
              return (
                <motion.div
                  key={i}
                  className="absolute right-[10%] w-2 rounded-full"
                  style={{
                    top: `${pos}%`,
                    height: "3px",
                    backgroundColor: `rgba(147, 51, 234, ${intensity})`,
                    boxShadow: intensity > 0.5 ? `0 0 ${intensity * 6}px rgba(147, 51, 234, ${intensity})` : "none",
                  }}
                  animate={{ opacity: [0.3, intensity, 0.3] }}
                  transition={{ duration: 0.5, delay: Math.random() * 0.5, repeat: Infinity }}
                />
              );
            })}
            {Array.from({ length: Math.min(8, Math.floor(rate / 100)) }).map((_, i) => (
              <motion.div key={`p${i}`} className="absolute w-1 h-1 rounded-full bg-purple-400" animate={{ x: ["0%", "100%"] }} transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }} style={{ left: "5%", top: `${40 + Math.random() * 20}%` }} />
            ))}
          </div>
          <p className="text-sm font-bold">Interference pattern: {fringes} fringes</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      <Button
        variant="ghost"
        onClick={onComplete}
        className="gap-2 mb-4 font-semibold"
        data-testid="button-back-lab"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Lab
      </Button>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border">
          <h2 className="text-2xl font-black mb-2">{experiment.name}</h2>
          <p className="text-sm text-muted-foreground font-medium mb-6">{experiment.description}</p>

          <div className="space-y-6">
            {experiment.variables.map((variable, i) => (
              <div key={variable.name}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-bold">{variable.name}</label>
                  <Badge variant="secondary" className="font-mono text-xs font-bold">
                    {values[i]} {variable.unit}
                  </Badge>
                </div>
                <Slider
                  value={[values[i]]}
                  min={variable.min}
                  max={variable.max}
                  step={variable.max > 10 ? 1 : 0.1}
                  onValueChange={([val]) => {
                    const newVals = [...values];
                    newVals[i] = val;
                    setValues(newVals);
                  }}
                  data-testid={`slider-${variable.name.toLowerCase().replace(/\s/g, "-")}`}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{variable.min} {variable.unit}</span>
                  <span>{variable.max} {variable.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setValues(experiment.variables.map((v) => v.default))}
              className="gap-2 font-bold"
              data-testid="button-reset-experiment"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
            <Button
              onClick={() => setShowResult(true)}
              className="gap-2 font-bold flex-1"
              data-testid="button-discover"
            >
              <Sparkles className="w-4 h-4" /> What Did I Learn?
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-border flex flex-col items-center justify-center min-h-[300px]">
          <Badge variant="secondary" className="mb-4 text-xs font-bold">
            <Beaker className="w-3.5 h-3.5 mr-1" /> Live Preview
          </Badge>
          {getVisualization()}
        </Card>
      </div>

      {LAB_INFO[experiment.id] && (() => {
        const info = LAB_INFO[experiment.id];
        return (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <Card className="p-6 border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-emerald-500/5 overflow-hidden relative">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-2xl">📓</span>
                <h3 className="text-xl font-black">Science Notebook</h3>
                <Badge variant="secondary" className="text-[10px] font-bold ml-1">{experiment.category}</Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl p-4 bg-purple-500/10 border border-purple-500/20">
                  <p className="font-black text-sm mb-2 flex items-center gap-1.5">📚 What You'll Learn</p>
                  <ul className="space-y-1.5">
                    {info.learningGoals.map((g, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-purple-500 font-black mt-0.5">✓</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl p-4 bg-blue-500/10 border border-blue-500/20">
                  <p className="font-black text-sm mb-2 flex items-center gap-1.5">🔑 Key Science Words</p>
                  <div className="flex flex-wrap gap-1.5">
                    {info.keyConcepts.map((c) => (
                      <span key={c} className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/20">
                  <p className="font-black text-sm mb-2 flex items-center gap-1.5">🌍 In the Real World</p>
                  <p className="text-sm leading-relaxed">{info.realWorld}</p>
                </div>

                <div className="rounded-2xl p-4 bg-amber-500/10 border border-amber-500/20">
                  <p className="font-black text-sm mb-2 flex items-center gap-1.5">✨ Fun Fact</p>
                  <p className="text-sm leading-relaxed">{info.funFact}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        );
      })()}

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="p-6 mt-6 border-border bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold mb-1">What You Learned!</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {experiment.learningOutcome}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LabPage({ onAddXP, onEarnBadge }: LabPageProps) {
  const [selectedExperiment, setSelectedExperiment] = useState<LabExperiment | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const completedExperiments = ((user?.gameScores as Record<string, any>)?._experiments || []) as string[];

  const nonWorldExperiments = LAB_EXPERIMENTS.filter(e => !e.worldId);
  const regularExperiments = nonWorldExperiments.filter(e => !e.isSecret);

  const rebirthLevel = user?.rebirthLevel || 0;

  const userXp = user?.xp || 0;
  const userBadges = user?.badges || [];
  const bossesDefeatedCount = Object.keys(user?.bossesDefeated || {}).filter(k => ((user?.bossesDefeated as any)?.[k] || 0) > 0).length;

  const isSecretLocked = (exp: LabExperiment) => {
    if (!exp.isSecret) return false;
    if (exp.requiredRebirth && rebirthLevel < exp.requiredRebirth) return true;
    if (exp.requiredXp && userXp < exp.requiredXp) return true;
    if (exp.requiredBadges && userBadges.length < exp.requiredBadges) return true;
    if (exp.requiredBosses && bossesDefeatedCount < exp.requiredBosses) return true;
    if (exp.requiredGames && (user?.totalGamesPlayed || 0) < exp.requiredGames) return true;
    if (exp.id === "magnetic-fields") return completedExperiments.length < 6;
    return false;
  };

  const handleExperimentComplete = async (experimentId: string) => {
    try {
      const gemUpgradesDisabled = localStorage.getItem("cosmetic-gem-upgrades") === "false";
      const res = await apiRequest("POST", "/api/experiment/complete", { experimentId, gemUpgradesDisabled });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      let desc = `You earned ${data.rewards.xp} XP and ${data.rewards.coins} Neuros!`;
      const ups = data.rewards.activeUpgrades || [];
      if (ups.includes("upgrade-lab-mastery")) desc += ` (Lab Mastery 3x boost!)`;
      if (data.rewards.badgesEarned && data.rewards.badgesEarned.length > 0) {
        desc += ` New badge earned: ${data.rewards.badgesEarned.join(", ")}!`;
      }
      toast({ title: "Experiment Complete!", description: desc });
      apiRequest("POST", "/api/daily-challenge/complete", { challengeType: "lab-experiment" }).catch(() => {});
    } catch {
      onAddXP(25);
    }
    setSelectedExperiment(null);
  };

  if (selectedExperiment) {
    return (
      <div className="min-h-screen max-w-5xl mx-auto px-4 py-8">
        <ExperimentSimulator
          experiment={selectedExperiment}
          onComplete={() => handleExperimentComplete(selectedExperiment.id)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
          <FlaskConical className="w-8 h-8 text-blue-500" /> Science Lab
        </h1>
        <p className="text-muted-foreground font-medium mt-1">
          Run interactive experiments! Adjust variables and watch science happen in real time.
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs font-bold" data-testid="text-experiments-progress">
            <CheckCircle className="w-3 h-3 mr-1" /> {completedExperiments.filter(id => nonWorldExperiments.some(e => e.id === id)).length}/{nonWorldExperiments.length} completed
          </Badge>
          {completedExperiments.filter(id => regularExperiments.some(e => e.id === id)).length === regularExperiments.length && (
            <Badge variant="default" className="text-xs font-bold gap-1">
              <Sparkles className="w-3 h-3" /> Lab Rat Badge Earned!
            </Badge>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          World-exclusive labs can be found inside their respective worlds.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {[...nonWorldExperiments].sort((a, b) => {
          if (a.isSecret !== b.isSecret) return a.isSecret ? 1 : -1;
          return 0;
        }).map((exp, i) => {
          const IconComp = ICON_MAP[exp.icon] || FlaskConical;
          const locked = isSecretLocked(exp);
          return (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card
                className={`p-5 border-border group relative ${locked ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover-elevate"}`}
                onClick={() => !locked && setSelectedExperiment(exp)}
                data-testid={`card-experiment-${exp.id}`}
              >
                {locked && (
                  <div className="absolute inset-0 rounded-md bg-background/60 dark:bg-background/70 flex flex-col items-center justify-center z-10 gap-2">
                    <Lock className="w-8 h-8 text-muted-foreground" />
                    <span className="text-xs font-bold text-muted-foreground text-center px-4">
                      {exp.unlockRequirement}
                    </span>
                    <div className="flex flex-wrap gap-1 justify-center px-2">
                      {exp.requiredRebirth && rebirthLevel < exp.requiredRebirth && (
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          Rebirth {rebirthLevel}/{exp.requiredRebirth}
                        </Badge>
                      )}
                      {exp.requiredXp && userXp < exp.requiredXp && (
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {userXp.toLocaleString()}/{exp.requiredXp.toLocaleString()} XP
                        </Badge>
                      )}
                      {exp.requiredBadges && userBadges.length < exp.requiredBadges && (
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {userBadges.length}/{exp.requiredBadges} badges
                        </Badge>
                      )}
                      {exp.requiredBosses && bossesDefeatedCount < exp.requiredBosses && (
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {bossesDefeatedCount}/{exp.requiredBosses} bosses
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: `${exp.color}20`, color: exp.color }}
                  >
                    <IconComp className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold">{exp.name}</h3>
                      {exp.isSecret && (
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          <Sparkles className="w-3 h-3 mr-0.5" /> Secret
                        </Badge>
                      )}
                      {exp.worldId && (
                        <Badge className="text-[10px] font-semibold bg-purple-500/20 text-purple-400 border-purple-500/30">
                          <Globe className="w-3 h-3 mr-0.5" /> {WORLDS.find(w => w.id === exp.worldId)?.name || exp.worldId}
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold mt-0.5">
                      {exp.category}
                    </Badge>
                  </div>
                  {completedExperiments.includes(exp.id) && (
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" data-testid={`check-experiment-${exp.id}`} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  {exp.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {exp.variables.map((v) => (
                    <Badge key={v.name} variant="secondary" className="text-[10px] font-semibold">
                      {v.name}
                    </Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
