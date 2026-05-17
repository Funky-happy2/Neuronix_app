import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

type DecoType =
  | "emoji-drift"
  | "emoji-rain"
  | "emoji-glow"
  | "emoji-orbit"
  | "border-glow"
  | "scanlines"
  | "vignette"
  | "particle-field"
  | "grid-pulse"
  | "light-rays"
  | "shimmer-edge"
  | "plasma-border"
  | "snow"
  | "fireflies"
  | "matrix-rain"
  | "aurora-css"
  | "hologram-lines";

interface DecoConfig {
  type: DecoType;
  emojis?: string[];
  count?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  maxOpacity?: number;
  colors?: string[];
  intensity?: number;
}

const DECORATION_CONFIGS: Record<string, DecoConfig> = {
  "deco-stars":      { type: "fireflies", colors: ["#facc15", "#fbbf24", "#fde68a", "#fffbeb"], count: 18, speed: 0.2, maxOpacity: 0.7 },
  "deco-bubbles":    { type: "snow", colors: ["#a78bfa", "#60a5fa", "#34d399"], count: 25, minSize: 5, maxSize: 14, speed: 0.35, maxOpacity: 0.45 },
  "deco-lightning":  { type: "border-glow", colors: ["#facc15", "#f59e0b", "#fbbf24"], intensity: 1.0 },
  "deco-fireworks":  { type: "fireflies", colors: ["#f97316", "#ef4444", "#eab308", "#ec4899"], count: 15, speed: 0.4, maxOpacity: 0.6 },
  "deco-aurora":     { type: "aurora-css", colors: ["#a78bfa", "#34d399", "#60a5fa", "#f472b6"], intensity: 0.6 },
  "deco-galaxy":     { type: "particle-field", colors: ["#c084fc", "#818cf8", "#f9a8d4", "#67e8f9"], count: 50, minSize: 1, maxSize: 4, speed: 0.15, maxOpacity: 0.7 },
  "deco-molecules":  { type: "grid-pulse", colors: ["#22d3ee", "#a78bfa", "#34d399"], intensity: 0.5 },
  "deco-dna-rain":   { type: "matrix-rain", colors: ["#22c55e", "#4ade80", "#86efac"], count: 30, speed: 1.5, maxOpacity: 0.3 },
  "deco-nebula":     { type: "vignette", colors: ["#7c3aed", "#db2777", "#2563eb"], intensity: 0.7 },
  "reward-storm-crown":  { type: "plasma-border", colors: ["#facc15", "#f59e0b", "#fbbf24", "#eab308"], intensity: 0.9 },
  "reward-circuit-aura": { type: "scanlines", colors: ["#22d3ee", "#06b6d4"], intensity: 0.2 },
  "reward-gene-cloak":   { type: "shimmer-edge", colors: ["#22c55e", "#4ade80", "#10b981"], intensity: 0.7 },
  "reward-gravity-wings": { type: "light-rays", colors: ["#c084fc", "#818cf8", "#a78bfa"], intensity: 0.5 },
  "reward-paradox-clock": { type: "hologram-lines", colors: ["#67e8f9", "#22d3ee", "#a78bfa"], intensity: 0.35 },
  "reward-tecton-tremor": { type: "grid-pulse", colors: ["#d97706", "#b45309", "#92400e"], intensity: 0.6 },
  "reward-dark-matter-veil": { type: "vignette", colors: ["#1e1b4b", "#312e81", "#0f0a2e"], intensity: 0.8 },
  "reward-quantum-glitch": { type: "scanlines", colors: ["#a855f7", "#7c3aed", "#6d28d9"], intensity: 0.3 },
  "reward-tournament-champion": { type: "shimmer-edge", colors: ["#facc15", "#f59e0b", "#eab308"], intensity: 0.8 },
  "deco-clan-champion":   { type: "border-glow", colors: ["#4682b4", "#5b9bd5", "#6baed6"], intensity: 0.7 },
  "deco-team-champion":   { type: "shimmer-edge", colors: ["#a855f7", "#7c3aed", "#9333ea"], intensity: 0.7 },
  "deco-supreme-champion": { type: "plasma-border", colors: ["#facc15", "#f59e0b", "#ef4444", "#eab308"], intensity: 0.95 },
  "reward-kraken-ink": { type: "vignette", colors: ["#1e293b", "#0f172a", "#334155"], intensity: 0.75 },
  "reward-frost-breath": { type: "snow", colors: ["#bae6fd", "#e0f2fe", "#7dd3fc", "#dbeafe"], count: 28, minSize: 2, maxSize: 8, speed: 0.3, maxOpacity: 0.5 },
  "reward-cosmic-rift": { type: "aurora-css", colors: ["#6366f1", "#8b5cf6", "#a78bfa", "#c084fc"], intensity: 0.55 },
  "reward-thunder-bolt": { type: "border-glow", colors: ["#facc15", "#eab308", "#fbbf24"], intensity: 0.9 },
  "reward-virus-code": { type: "matrix-rain", colors: ["#22c55e", "#16a34a", "#4ade80"], count: 28, speed: 1.3, maxOpacity: 0.3 },
  "reward-quantum-wave": { type: "shimmer-edge", colors: ["#a78bfa", "#818cf8", "#6366f1"], intensity: 0.7 },
  "reward-all-world-bosses": { type: "plasma-border", colors: ["#facc15", "#ef4444", "#3b82f6", "#22c55e", "#a855f7"], intensity: 1.0 },
  "deco-bubbles-deep": { type: "snow", colors: ["#0ea5e9", "#38bdf8", "#0284c7", "#7dd3fc"], count: 22, minSize: 4, maxSize: 12, speed: 0.25, maxOpacity: 0.5 },
  "deco-lava-flow": { type: "fireflies", colors: ["#ef4444", "#f97316", "#dc2626", "#fbbf24"], count: 20, speed: 0.3, maxOpacity: 0.65 },
  "deco-snowfall": { type: "snow", colors: ["#e0f2fe", "#bae6fd", "#f0f9ff", "#dbeafe"], count: 30, minSize: 3, maxSize: 10, speed: 0.4, maxOpacity: 0.6 },
  "deco-vines": { type: "fireflies", colors: ["#22c55e", "#16a34a", "#4ade80", "#86efac"], count: 16, speed: 0.15, maxOpacity: 0.5 },
  "deco-stardust": { type: "particle-field", colors: ["#a78bfa", "#818cf8", "#c084fc", "#e0e7ff"], count: 45, minSize: 1, maxSize: 3, speed: 0.1, maxOpacity: 0.65 },
  "deco-crystal-shimmer": { type: "shimmer-edge", colors: ["#ec4899", "#d946ef", "#a855f7", "#f472b6"], intensity: 0.6 },
  "deco-lightning-storm": { type: "border-glow", colors: ["#eab308", "#facc15", "#a3a3a3", "#fbbf24"], intensity: 0.85 },
  "deco-digital-rain": { type: "matrix-rain", colors: ["#34d399", "#10b981", "#6ee7b7"], count: 25, speed: 1.2, maxOpacity: 0.35 },
  "deco-fossil-dust": { type: "fireflies", colors: ["#d97706", "#b45309", "#f59e0b", "#92400e"], count: 18, speed: 0.2, maxOpacity: 0.45 },
  "deco-particle-field": { type: "particle-field", colors: ["#8b5cf6", "#7c3aed", "#a78bfa", "#6d28d9"], count: 55, minSize: 1, maxSize: 4, speed: 0.2, maxOpacity: 0.7 },
};

interface FloatingParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  content: string;
  phase: number;
  color?: string;
}

function createParticle(id: number, config: DecoConfig, w: number, h: number): FloatingParticle {
  const content = config.emojis ? config.emojis[Math.floor(Math.random() * config.emojis.length)] : "";
  const size = (config.minSize || 8) + Math.random() * ((config.maxSize || 16) - (config.minSize || 8));
  const phase = Math.random() * Math.PI * 2;
  const speed = config.speed || 0.1;
  const color = config.colors ? config.colors[Math.floor(Math.random() * config.colors.length)] : undefined;

  if (config.type === "emoji-rain") {
    return { id, content, size, phase, color, x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: (Math.random() - 0.5) * 0.1, vy: speed + Math.random() * 0.1, opacity: 0, rotation: Math.random() * 30 - 15, rotationSpeed: (Math.random() - 0.5) * 0.5 };
  }
  if (config.type === "snow") {
    return { id, content: "", size, phase, color, x: Math.random() * w, y: -10 - Math.random() * h * 0.3, vx: (Math.random() - 0.5) * 0.3, vy: speed + Math.random() * 0.2, opacity: 0, rotation: 0, rotationSpeed: 0 };
  }
  if (config.type === "fireflies") {
    return { id, content: "", size: 2 + Math.random() * 4, phase, color, x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.5) * speed, opacity: 0, rotation: 0, rotationSpeed: 0 };
  }
  if (config.type === "particle-field") {
    return { id, content: "", size, phase, color, x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * speed * 0.5, vy: (Math.random() - 0.5) * speed * 0.5, opacity: 0, rotation: 0, rotationSpeed: 0 };
  }
  if (config.type === "matrix-rain") {
    const chars = "ATCGATCGDNAHELIXGENE";
    return { id, content: chars[Math.floor(Math.random() * chars.length)], size: 10 + Math.random() * 6, phase, color, x: Math.random() * w, y: -20 - Math.random() * h * 0.5, vx: 0, vy: speed + Math.random() * 0.5, opacity: 0, rotation: 0, rotationSpeed: 0 };
  }
  if (config.type === "emoji-glow") {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    if (side === 0) { x = 20 + Math.random() * 30; y = Math.random() * h; }
    else if (side === 1) { x = w - 20 - Math.random() * 30; y = Math.random() * h; }
    else if (side === 2) { x = Math.random() * w; y = 20 + Math.random() * 30; }
    else { x = Math.random() * w; y = h - 20 - Math.random() * 30; }
    return { id, content, size, x, y, phase, color, vx: 0, vy: 0, opacity: 0, rotation: 0, rotationSpeed: 0 };
  }
  if (config.type === "emoji-orbit") {
    return { id, content, size, phase, color, x: Math.random() * w, y: Math.random() * h, vx: Math.cos(phase) * speed, vy: Math.sin(phase) * speed, opacity: 0, rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.3 };
  }
  return { id, content, size, phase, color, x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * speed, vy: (Math.random() - 0.5) * speed, opacity: 0, rotation: 0, rotationSpeed: (Math.random() - 0.5) * 0.3 };
}

function CSSDecoration({ config, decoId }: { config: DecoConfig; decoId: string }) {
  const colors = config.colors || ["#a78bfa", "#60a5fa"];
  const intensity = config.intensity || 0.3;
  const [tick, setTick] = useState(0);
  const animRef = useRef<number>(0);

  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 0.01;
      setTick(t);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  if (config.type === "border-glow") {
    const shift = Math.sin(tick * 0.5) * 30;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          boxShadow: `inset 0 0 ${40 + shift}px ${8 + shift * 0.2}px ${colors[0]}${Math.round(intensity * 80).toString(16).padStart(2, "0")}, inset 0 0 ${80 + shift}px ${20 + shift * 0.3}px ${colors[1] || colors[0]}${Math.round(intensity * 40).toString(16).padStart(2, "0")}`,
          transition: "box-shadow 0.3s ease",
        }} />
      </div>
    );
  }

  if (config.type === "scanlines") {
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${colors[0]}${Math.round(intensity * 255).toString(16).padStart(2, "0")} 2px, ${colors[0]}${Math.round(intensity * 255).toString(16).padStart(2, "0")} 3px)`,
          animation: "scanline-scroll 4s linear infinite",
        }} />
        <style>{`@keyframes scanline-scroll { 0% { transform: translateY(0); } 100% { transform: translateY(6px); } }`}</style>
      </div>
    );
  }

  if (config.type === "vignette") {
    const c1 = colors[0], c2 = colors[1] || colors[0], c3 = colors[2] || colors[0];
    const s1 = Math.sin(tick * 0.3) * 0.5 + 0.5;
    const s2 = Math.sin(tick * 0.3 + 2) * 0.5 + 0.5;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 0% 0%, ${c1}${Math.round(s1 * intensity * 180).toString(16).padStart(2, "0")} 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, ${c2}${Math.round(s2 * intensity * 180).toString(16).padStart(2, "0")} 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, ${c3}${Math.round(intensity * 60).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        }} />
      </div>
    );
  }

  if (config.type === "corner-glow") {
    const pulse = Math.sin(tick * 0.4) * 0.4 + 0.6;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        {[0, 1, 2, 3].map(i => {
          const c = colors[i % colors.length];
          const positions = [
            { top: 0, left: 0 }, { top: 0, right: 0 },
            { bottom: 0, left: 0 }, { bottom: 0, right: 0 },
          ];
          return (
            <div key={i} style={{
              position: "absolute", ...positions[i],
              width: 150, height: 150,
              background: `radial-gradient(circle at ${i % 2 === 0 ? "0% " : "100% "}${i < 2 ? "0%" : "100%"}, ${c}${Math.round(pulse * intensity * 200).toString(16).padStart(2, "0")}, transparent 70%)`,
            }} />
          );
        })}
      </div>
    );
  }

  if (config.type === "grid-pulse") {
    const pulse = Math.sin(tick * 0.5) * 0.5 + 0.5;
    const gridColor = colors[0] + Math.round(pulse * intensity * 120).toString(16).padStart(2, "0");
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, transparent 30%, black 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, transparent 30%, black 100%)",
        }} />
      </div>
    );
  }

  if (config.type === "light-rays") {
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden" aria-hidden="true">
        {[0, 1, 2].map(i => {
          const angle = -20 + i * 30 + Math.sin(tick * 0.2 + i) * 10;
          const c = colors[i % colors.length];
          return (
            <div key={i} style={{
              position: "absolute", top: -100, left: `${20 + i * 30}%`,
              width: 120, height: "140%",
              background: `linear-gradient(180deg, ${c}${Math.round(intensity * 100).toString(16).padStart(2, "0")}, transparent 80%)`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: "top center",
              filter: "blur(30px)",
            }} />
          );
        })}
      </div>
    );
  }

  if (config.type === "shimmer-edge") {
    const pos = ((tick * 20) % 400) - 50;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          boxShadow: `inset 0 0 30px 5px ${colors[0]}${Math.round(intensity * 60).toString(16).padStart(2, "0")}`,
        }} />
        <div style={{
          position: "absolute", top: 0, left: `${pos}%`, width: "15%", height: 3,
          background: `linear-gradient(90deg, transparent, ${colors[0]}${Math.round(intensity * 255).toString(16).padStart(2, "0")}, transparent)`,
          filter: "blur(2px)",
        }} />
        <div style={{
          position: "absolute", bottom: 0, right: `${pos}%`, width: "15%", height: 3,
          background: `linear-gradient(90deg, transparent, ${colors[1] || colors[0]}${Math.round(intensity * 255).toString(16).padStart(2, "0")}, transparent)`,
          filter: "blur(2px)",
        }} />
      </div>
    );
  }

  if (config.type === "plasma-border") {
    const s1 = Math.sin(tick * 0.6);
    const s2 = Math.cos(tick * 0.4);
    const borderW = 6;
    const gradient = `conic-gradient(from ${tick * 30}deg at 50% 50%, ${colors.map((c, i) => `${c} ${(i / colors.length) * 360}deg`).join(", ")}, ${colors[0]} 360deg)`;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: borderW, background: gradient, filter: `blur(${3 + s1}px)`, opacity: 0.8 + s2 * 0.15 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: borderW, background: gradient, filter: `blur(${3 + s1}px)`, opacity: 0.8 + s2 * 0.15 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: borderW, background: gradient, filter: `blur(${3 + s1}px)`, opacity: 0.8 + s2 * 0.15 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: borderW, background: gradient, filter: `blur(${3 + s1}px)`, opacity: 0.8 + s2 * 0.15 }} />
      </div>
    );
  }

  if (config.type === "wave-bottom") {
    const waveY = Math.sin(tick * 0.4) * 5;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <svg style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 80 }} viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d={`M0,${40 + waveY} C360,${20 + waveY * 1.5} 720,${60 - waveY} 1080,${35 + waveY * 0.5} S1440,${45 - waveY} 1440,${40 + waveY} L1440,80 L0,80 Z`}
            fill={colors[0]} opacity={intensity * 0.4} />
          <path d={`M0,${50 - waveY} C480,${30 + waveY} 960,${65 - waveY * 0.8} 1440,${50 + waveY} L1440,80 L0,80 Z`}
            fill={colors[1] || colors[0]} opacity={intensity * 0.3} />
        </svg>
      </div>
    );
  }

  if (config.type === "aurora-css") {
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden" aria-hidden="true">
        {colors.map((c, i) => {
          const xOff = Math.sin(tick * 0.15 + i * 1.5) * 20;
          const yOff = Math.cos(tick * 0.1 + i) * 10;
          return (
            <div key={i} style={{
              position: "absolute",
              top: `${-10 + yOff}%`,
              left: `${10 + i * 20 + xOff}%`,
              width: "40%",
              height: "50%",
              background: `radial-gradient(ellipse, ${c}${Math.round(intensity * 150).toString(16).padStart(2, "0")}, transparent 70%)`,
              filter: "blur(60px)",
              transform: `rotate(${i * 15 + Math.sin(tick * 0.2) * 5}deg)`,
            }} />
          );
        })}
      </div>
    );
  }

  if (config.type === "lens-flare") {
    const x = 50 + Math.sin(tick * 0.15) * 30;
    const y = 15 + Math.cos(tick * 0.1) * 10;
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute",
          left: `${x}%`, top: `${y}%`,
          width: 200, height: 200,
          background: `radial-gradient(circle, ${colors[0]}${Math.round(intensity * 180).toString(16).padStart(2, "0")}, transparent 60%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(20px)",
        }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            position: "absolute",
            left: `${x + (50 - x) * i * 0.25}%`,
            top: `${y + (50 - y) * i * 0.25}%`,
            width: 20 + i * 10, height: 20 + i * 10,
            borderRadius: "50%",
            background: colors[i % colors.length],
            opacity: intensity * 0.15,
            transform: "translate(-50%, -50%)",
            filter: "blur(5px)",
          }} />
        ))}
      </div>
    );
  }

  if (config.type === "hologram-lines") {
    return (
      <div className="fixed inset-0 pointer-events-none z-[9998]" aria-hidden="true">
        <div style={{
          position: "absolute", inset: 0,
          background: `repeating-linear-gradient(0deg, transparent, transparent 4px, ${colors[0]}${Math.round(intensity * 80).toString(16).padStart(2, "0")} 4px, transparent 5px)`,
          animation: "holo-shift 3s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(180deg, transparent 30%, ${colors[1] || colors[0]}${Math.round(intensity * 50).toString(16).padStart(2, "0")} 50%, transparent 70%)`,
          animation: "holo-sweep 5s ease-in-out infinite",
        }} />
        <style>{`
          @keyframes holo-shift { 0% { opacity: 0.7; } 100% { opacity: 1; } }
          @keyframes holo-sweep { 0%, 100% { transform: translateY(-30%); } 50% { transform: translateY(30%); } }
        `}</style>
      </div>
    );
  }

  return null;
}

function ParticleDecoration({ config }: { config: DecoConfig }) {
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const animFrame = useRef<number>(0);
  const nextId = useRef(0);

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const initial: FloatingParticle[] = [];
    const count = config.count || 6;
    for (let i = 0; i < count; i++) {
      initial.push(createParticle(nextId.current++, config, w, h));
    }
    setParticles(initial);
  }, []);

  useEffect(() => {
    if (particles.length === 0) return;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = now * 0.001;
      const maxOp = config.maxOpacity || 0.3;
      const speed = config.speed || 0.1;

      setParticles(prev => prev.map(p => {
        let { x, y, vx, vy, rotation, rotationSpeed, phase } = p;
        x += vx * dt;
        y += vy * dt;
        rotation += rotationSpeed * dt;
        const breathe = Math.sin(t * 0.5 + phase) * 0.5 + 0.5;
        let opacity = breathe * maxOp;

        if (config.type === "emoji-rain" || config.type === "snow" || config.type === "matrix-rain") {
          if (y > h + 30) return createParticle(p.id, config, w, h);
          opacity = Math.min(y / 50, 1) * maxOp;
        } else if (config.type === "emoji-glow") {
          opacity = (Math.sin(t * 0.8 + phase) * 0.5 + 0.5) * maxOp;
        } else if (config.type === "emoji-orbit") {
          const angle = t * 0.3 + phase;
          vx = Math.cos(angle) * speed;
          vy = Math.sin(angle) * speed;
        } else if (config.type === "fireflies") {
          vx += (Math.random() - 0.5) * 0.05 * dt;
          vy += (Math.random() - 0.5) * 0.05 * dt;
          vx = Math.max(-speed, Math.min(speed, vx));
          vy = Math.max(-speed, Math.min(speed, vy));
          opacity = (Math.sin(t * 2 + phase) * 0.5 + 0.5) * maxOp;
        } else if (config.type === "particle-field") {
          opacity = (Math.sin(t * 0.3 + phase) * 0.5 + 0.5) * maxOp;
        }

        if (config.type !== "emoji-glow") {
          if (x < -20) x = w + 10;
          if (x > w + 20) x = -10;
          if (y < -20 && config.type !== "snow" && config.type !== "matrix-rain" && config.type !== "emoji-rain") y = h + 10;
          if (y > h + 20 && config.type !== "snow" && config.type !== "matrix-rain" && config.type !== "emoji-rain") y = -10;
        }

        return { ...p, x, y, vx, vy, rotation, opacity };
      }));

      animFrame.current = requestAnimationFrame(animate);
    };

    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [particles.length > 0]);

  if (particles.length === 0) return null;

  const isEmoji = config.type === "emoji-drift" || config.type === "emoji-rain" || config.type === "emoji-glow" || config.type === "emoji-orbit";

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden" aria-hidden="true">
      {particles.map(p => {
        if (isEmoji || config.type === "matrix-rain") {
          return (
            <span key={p.id} style={{
              position: "fixed", left: p.x, top: p.y,
              fontSize: p.size,
              opacity: Math.max(0, p.opacity),
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
              pointerEvents: "none", willChange: "transform, opacity",
              color: config.type === "matrix-rain" ? (p.color || "#22c55e") : undefined,
              fontFamily: config.type === "matrix-rain" ? "monospace" : undefined,
              fontWeight: config.type === "matrix-rain" ? "bold" : undefined,
              textShadow: config.type === "matrix-rain" ? `0 0 8px ${p.color || "#22c55e"}` : undefined,
            }}>
              {p.content}
            </span>
          );
        }

        return (
          <div key={p.id} style={{
            position: "fixed", left: p.x, top: p.y,
            width: p.size, height: p.size,
            borderRadius: "50%",
            backgroundColor: p.color || "#fff",
            opacity: Math.max(0, p.opacity),
            transform: "translate(-50%, -50%)",
            pointerEvents: "none", willChange: "transform, opacity",
            boxShadow: config.type === "fireflies" ? `0 0 ${p.size * 2}px ${p.size}px ${p.color || "#fff"}` :
                        config.type === "particle-field" ? `0 0 ${p.size}px ${p.color || "#fff"}` : "none",
          }} />
        );
      })}
    </div>
  );
}

const PARTICLE_TYPES: DecoType[] = ["emoji-drift", "emoji-rain", "emoji-glow", "emoji-orbit", "snow", "fireflies", "particle-field", "matrix-rain"];

export default function ScreenDecorations() {
  const { user } = useAuth();
  const [disabled, setDisabled] = useState(() => localStorage.getItem("cosmetic-decorations") === "false");

  useEffect(() => {
    const handler = () => setDisabled(localStorage.getItem("cosmetic-decorations") === "false");
    window.addEventListener("cosmetic-settings-changed", handler);
    return () => window.removeEventListener("cosmetic-settings-changed", handler);
  }, []);

  const equippedCosmetics: Record<string, string> = (user as any)?.equippedCosmetics || {};
  const equippedDeco = equippedCosmetics["decoration"];
  const config = equippedDeco && !disabled ? DECORATION_CONFIGS[equippedDeco] : null;

  if (!config) return null;

  if (PARTICLE_TYPES.includes(config.type)) {
    return <ParticleDecoration config={config} />;
  }

  return <CSSDecoration config={config} decoId={equippedDeco!} />;
}
