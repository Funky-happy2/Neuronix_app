import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";

interface FollowerStyle {
  shape: "circle" | "diamond" | "ring" | "bolt" | "star" | "emoji";
  emoji?: string;
  color: string;
  trailColor: string;
  count: number;
  fadeTime: number;
  size: number;
  spread: number;
  behavior: "trail" | "orbit" | "connect" | "chase" | "spin" | "swarm";
  glowColor?: string;
  secondaryColor?: string;
}

const FOLLOWER_CONFIGS: Record<string, FollowerStyle> = {
  "follower-atom": {
    shape: "ring", color: "#60a5fa", trailColor: "#3b82f6",
    count: 5, fadeTime: 700, size: 6, spread: 8,
    behavior: "orbit", glowColor: "rgba(96,165,250,0.4)",
  },
  "follower-rocket": {
    shape: "emoji", emoji: "\u{1F680}", color: "#f97316", trailColor: "#ef4444",
    count: 6, fadeTime: 600, size: 18, spread: 6,
    behavior: "trail", glowColor: "rgba(249,115,22,0.3)",
  },
  "follower-sparkle": {
    shape: "emoji", emoji: "\u2728", color: "#fbbf24", trailColor: "#f59e0b",
    count: 8, fadeTime: 500, size: 14, spread: 16,
    behavior: "trail", glowColor: "rgba(251,191,36,0.25)",
  },
  "follower-comet": {
    shape: "emoji", emoji: "\u2604\uFE0F", color: "#fbbf24", trailColor: "#f97316",
    count: 10, fadeTime: 800, size: 18, spread: 4,
    behavior: "chase", glowColor: "rgba(251,191,36,0.4)",
  },
  "follower-dna": {
    shape: "emoji", emoji: "\u{1F9EC}", color: "#a78bfa", trailColor: "#34d399",
    count: 6, fadeTime: 650, size: 16, spread: 12,
    behavior: "spin", glowColor: "rgba(167,139,250,0.3)",
  },
  "follower-lightning": {
    shape: "bolt", color: "#facc15", trailColor: "#fef08a",
    count: 4, fadeTime: 350, size: 8, spread: 20,
    behavior: "connect", glowColor: "rgba(250,204,21,0.5)",
  },
  "follower-planet": {
    shape: "emoji", emoji: "\u{1FA90}", color: "#c084fc", trailColor: "#a78bfa",
    count: 4, fadeTime: 800, size: 20, spread: 18,
    behavior: "orbit", glowColor: "rgba(192,132,252,0.3)",
  },
  "follower-electron": {
    shape: "circle", color: "#22d3ee", trailColor: "#06b6d4",
    count: 6, fadeTime: 500, size: 4, spread: 16,
    behavior: "swarm", glowColor: "rgba(34,211,238,0.4)",
  },
  "reward-meltdown-flask": {
    shape: "emoji", emoji: "\u{1F9EA}", color: "#4ade80", trailColor: "#a3e635",
    count: 5, fadeTime: 650, size: 16, spread: 10,
    behavior: "trail", glowColor: "rgba(74,222,128,0.3)",
  },
  "reward-void-shadow": {
    shape: "emoji", emoji: "\u{1F47B}", color: "#7c3aed", trailColor: "#4c1d95",
    count: 5, fadeTime: 900, size: 18, spread: 15,
    behavior: "swarm", glowColor: "rgba(124,58,237,0.4)",
  },
  "reward-gravity-follower": {
    shape: "ring", color: "#818cf8", trailColor: "#6366f1",
    count: 5, fadeTime: 600, size: 6, spread: 12,
    behavior: "orbit", glowColor: "rgba(129,140,248,0.4)",
  },
  "reward-architect-blueprint": {
    shape: "emoji", emoji: "\u{1F4D0}", color: "#38bdf8", trailColor: "#0ea5e9",
    count: 5, fadeTime: 700, size: 16, spread: 10,
    behavior: "trail", glowColor: "rgba(56,189,248,0.3)",
  },
  "reward-nano-companion": {
    shape: "emoji", emoji: "\u{1F52C}", color: "#2dd4bf", trailColor: "#14b8a6",
    count: 7, fadeTime: 400, size: 14, spread: 18,
    behavior: "swarm", glowColor: "rgba(45,212,191,0.3)",
  },
  "reward-clan-warrior": {
    shape: "emoji", emoji: "\u{1F6E1}\uFE0F", color: "#94a3b8", trailColor: "#64748b",
    count: 5, fadeTime: 650, size: 16, spread: 8,
    behavior: "chase", glowColor: "rgba(148,163,184,0.3)",
  },
  "reward-magma-core": {
    shape: "emoji", emoji: "\u{1F525}", color: "#f97316", trailColor: "#dc2626",
    count: 7, fadeTime: 600, size: 16, spread: 8,
    behavior: "trail", glowColor: "rgba(249,115,22,0.4)",
  },
  "reward-vine-whip": {
    shape: "emoji", emoji: "\u{1F33F}", color: "#4ade80", trailColor: "#16a34a",
    count: 6, fadeTime: 700, size: 14, spread: 10,
    behavior: "trail", glowColor: "rgba(74,222,128,0.3)",
  },
  "reward-crystal-shard": {
    shape: "diamond", color: "#e879f9", trailColor: "#c084fc",
    count: 5, fadeTime: 750, size: 6, spread: 14,
    behavior: "orbit", glowColor: "rgba(232,121,249,0.4)",
  },
  "reward-dino-fossil": {
    shape: "emoji", emoji: "\u{1F9B4}", color: "#d97706", trailColor: "#92400e",
    count: 5, fadeTime: 700, size: 16, spread: 10,
    behavior: "chase", glowColor: "rgba(217,119,6,0.3)",
  },
  "reward-frost-shard": {
    shape: "emoji", emoji: "\u2744\uFE0F", color: "#67e8f9", trailColor: "#22d3ee",
    count: 5, fadeTime: 700, size: 14, spread: 12,
    behavior: "orbit", glowColor: "rgba(103,232,249,0.3)",
  },
  "reward-cosmic-trail": {
    shape: "emoji", emoji: "\u{1F31F}", color: "#c084fc", trailColor: "#818cf8",
    count: 7, fadeTime: 600, size: 14, spread: 14,
    behavior: "trail", glowColor: "rgba(192,132,252,0.3)",
  },
  "reward-thunder-spark": {
    shape: "bolt", color: "#facc15", trailColor: "#fbbf24",
    count: 4, fadeTime: 400, size: 7, spread: 16,
    behavior: "connect", glowColor: "rgba(250,204,21,0.4)",
  },
  "reward-virus-glitch": {
    shape: "emoji", emoji: "\u{1F9A0}", color: "#22c55e", trailColor: "#15803d",
    count: 6, fadeTime: 450, size: 14, spread: 16,
    behavior: "swarm", glowColor: "rgba(34,197,94,0.3)",
  },
  "reward-quantum-wave": {
    shape: "ring", color: "#a78bfa", trailColor: "#7c3aed",
    count: 6, fadeTime: 700, size: 5, spread: 14,
    behavior: "spin", glowColor: "rgba(167,139,250,0.3)", secondaryColor: "#818cf8",
  },
  "follower-supreme-champion": {
    shape: "diamond", color: "#facc15", trailColor: "#eab308",
    count: 8, fadeTime: 900, size: 6, spread: 16,
    behavior: "orbit", glowColor: "rgba(250,204,21,0.4)", secondaryColor: "#fbbf24",
  },
  "follower-clan-champion": {
    shape: "circle", color: "#38bdf8", trailColor: "#0ea5e9",
    count: 6, fadeTime: 800, size: 5, spread: 12,
    behavior: "chase", glowColor: "rgba(56,189,248,0.3)", secondaryColor: "#7dd3fc",
  },
  "follower-team-champion": {
    shape: "ring", color: "#d946ef", trailColor: "#c026d3",
    count: 7, fadeTime: 850, size: 5, spread: 14,
    behavior: "spin", glowColor: "rgba(217,70,239,0.3)", secondaryColor: "#e879f9",
  },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  createdAt: number;
  config: FollowerStyle;
  offsetAngle: number;
  velocity: { vx: number; vy: number };
}

export default function MouseFollower() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const emojiContainerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nextId = useRef(0);
  const lastPos = useRef({ x: -100, y: -100 });
  const mousePos = useRef({ x: -100, y: -100 });
  const animRef = useRef<number>(0);
  const [emojiParticles, setEmojiParticles] = useState<Particle[]>([]);
  const [disabled, setDisabled] = useState(() => localStorage.getItem("cosmetic-followers") === "false");

  useEffect(() => {
    const handler = () => setDisabled(localStorage.getItem("cosmetic-followers") === "false");
    window.addEventListener("cosmetic-settings-changed", handler);
    return () => window.removeEventListener("cosmetic-settings-changed", handler);
  }, []);

  const equippedCosmetics: Record<string, string> = (user as any)?.equippedCosmetics || {};
  const equippedFollower = equippedCosmetics["follower"];
  const config = equippedFollower && !disabled ? FOLLOWER_CONFIGS[equippedFollower] || null : null;
  const isEmoji = config?.shape === "emoji";

  const getDrawPos = useCallback((p: Particle, now: number) => {
    const age = now - p.createdAt;
    const progress = age / p.config.fadeTime;
    if (progress >= 1) return null;
    let drawX = p.x;
    let drawY = p.y;

    if (p.config.behavior === "orbit") {
      const orbitRadius = p.config.spread * (1 - progress * 0.3);
      const angle = p.offsetAngle + (now / 400);
      drawX = mousePos.current.x + Math.cos(angle) * orbitRadius;
      drawY = mousePos.current.y + Math.sin(angle) * orbitRadius;
    } else if (p.config.behavior === "chase") {
      const chaseProgress = Math.min(progress * 2, 1);
      drawX = p.x + (mousePos.current.x - p.x) * chaseProgress * 0.3;
      drawY = p.y + (mousePos.current.y - p.y) * chaseProgress * 0.3;
    } else if (p.config.behavior === "spin") {
      const spinAngle = p.offsetAngle + (now / 300) * (p.id % 2 === 0 ? 1 : -1);
      const spinRadius = p.config.spread * 0.5 * (1 - progress * 0.5);
      drawX = p.x + Math.cos(spinAngle) * spinRadius;
      drawY = p.y + Math.sin(spinAngle) * spinRadius;
    } else if (p.config.behavior === "swarm") {
      drawX = p.x + Math.sin(now / 200 + p.offsetAngle) * 4;
      drawY = p.y + Math.cos(now / 250 + p.offsetAngle * 1.3) * 4;
      drawX += p.velocity.vx * progress * 15;
      drawY += p.velocity.vy * progress * 15;
    } else if (p.config.behavior === "connect") {
      drawX = p.x + p.velocity.vx * progress * 25;
      drawY = p.y + p.velocity.vy * progress * 25;
    } else {
      drawX = p.x + p.velocity.vx * progress * 10;
      drawY = p.y + p.velocity.vy * progress * 10;
    }
    return { drawX, drawY, progress, alpha: 1 - progress };
  }, []);

  const drawCanvasParticle = useCallback((ctx: CanvasRenderingContext2D, p: Particle, now: number) => {
    const pos = getDrawPos(p, now);
    if (!pos) return;
    const { drawX, drawY, progress, alpha } = pos;
    const scale = 1 - progress * 0.4;
    const sz = p.config.size * scale;

    ctx.globalAlpha = alpha * 0.85;

    if (p.config.glowColor) {
      ctx.shadowColor = p.config.glowColor;
      ctx.shadowBlur = sz * 2.5;
    }

    const useSecondary = p.config.secondaryColor && p.id % 3 === 0;
    const color = useSecondary ? p.config.secondaryColor! : (progress > 0.4 ? p.config.trailColor : p.config.color);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (p.config.shape === "circle") {
      ctx.beginPath();
      ctx.arc(drawX, drawY, sz, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.config.shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(drawX, drawY - sz);
      ctx.lineTo(drawX + sz * 0.7, drawY);
      ctx.lineTo(drawX, drawY + sz);
      ctx.lineTo(drawX - sz * 0.7, drawY);
      ctx.closePath();
      ctx.fill();
    } else if (p.config.shape === "ring") {
      ctx.beginPath();
      ctx.arc(drawX, drawY, sz, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(drawX, drawY, sz * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.config.shape === "bolt") {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(drawX - sz * 0.3, drawY - sz);
      ctx.lineTo(drawX + sz * 0.1, drawY - sz * 0.15);
      ctx.lineTo(drawX - sz * 0.1, drawY + sz * 0.15);
      ctx.lineTo(drawX + sz * 0.3, drawY + sz);
      ctx.stroke();
    } else if (p.config.shape === "star") {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const outerX = drawX + Math.cos(a) * sz;
        const outerY = drawY + Math.sin(a) * sz;
        const innerA = a + Math.PI / 4;
        const innerX = drawX + Math.cos(innerA) * sz * 0.35;
        const innerY = drawY + Math.sin(innerA) * sz * 0.35;
        if (i === 0) ctx.moveTo(outerX, outerY);
        else ctx.lineTo(outerX, outerY);
        ctx.lineTo(innerX, innerY);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (p.config.behavior === "connect" && alpha > 0.5) {
      ctx.globalAlpha = alpha * 0.15;
      ctx.strokeStyle = p.config.glowColor || p.config.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mousePos.current.x, mousePos.current.y);
      ctx.lineTo(drawX, drawY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, [getDrawPos]);

  useEffect(() => {
    if (!config) return;

    const canvas = canvasRef.current;
    if (!isEmoji && canvas) {
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
  }, [config, isEmoji]);

  useEffect(() => {
    if (!config) return;

    const handleMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 12) return;

      lastPos.current = { x: e.clientX, y: e.clientY };
      const now = Date.now();

      const newParticle: Particle = {
        id: nextId.current++,
        x: e.clientX + (Math.random() - 0.5) * config.spread,
        y: e.clientY + (Math.random() - 0.5) * config.spread,
        createdAt: now,
        config,
        offsetAngle: Math.random() * Math.PI * 2,
        velocity: {
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
        },
      };

      const filtered = particlesRef.current.filter(p => now - p.createdAt < p.config.fadeTime);
      while (filtered.length >= config.count) filtered.shift();
      particlesRef.current = [...filtered, newParticle];

      if (isEmoji) {
        setEmojiParticles([...particlesRef.current]);
      }
    };

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [config, isEmoji]);

  useEffect(() => {
    if (!config || isEmoji) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();
      particlesRef.current = particlesRef.current.filter(p => now - p.createdAt < p.config.fadeTime);
      for (const p of particlesRef.current) {
        drawCanvasParticle(ctx, p, now);
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [config, isEmoji, drawCanvasParticle]);

  useEffect(() => {
    if (!config || !isEmoji) return;
    if (emojiParticles.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      particlesRef.current = particlesRef.current.filter(p => now - p.createdAt < p.config.fadeTime);
      setEmojiParticles([...particlesRef.current]);
    }, 50);
    return () => clearInterval(timer);
  }, [config, isEmoji, emojiParticles.length]);

  if (!config) return null;

  if (isEmoji) {
    const now = Date.now();
    return (
      <div ref={emojiContainerRef} className="fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true">
        {emojiParticles.map(p => {
          const pos = getDrawPos(p, now);
          if (!pos) return null;
          const { drawX, drawY, progress, alpha } = pos;
          const scale = 1 - progress * 0.5;
          const rotation = p.config.behavior === "spin" ? (now / 300 + p.offsetAngle) * 60 : progress * 30 * (p.id % 2 === 0 ? 1 : -1);
          return (
            <span
              key={p.id}
              style={{
                position: "fixed",
                left: drawX,
                top: drawY,
                fontSize: p.config.size,
                opacity: Math.max(0, alpha),
                transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
                pointerEvents: "none",
                filter: p.config.glowColor ? `drop-shadow(0 0 4px ${p.config.glowColor})` : undefined,
              }}
            >
              {p.config.emoji}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      aria-hidden="true"
    />
  );
}
