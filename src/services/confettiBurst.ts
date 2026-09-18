/**
 * Cyberpunk Confetti Burst Engine
 * Native, resilient 60FPS particle effect designed for CS2 knife/glove drop celebrations.
 * Avoids any external worker/canvas iframe issues.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
  decay: number;
  shape: 'rect' | 'spark';
}

const COLORS = [
  '#f59e0b', // Amber/Gold
  '#fbbf24', // Bright Gold
  '#ff6b00', // Cyberpunk Orange
  '#ffffff', // Pure White
  '#10b981', // Emerald Green
  '#06b6d4', // Cyber Cyan
  '#ec4899', // Neon Pink
];

let activeCanvas: HTMLCanvasElement | null = null;
let activeCtx: CanvasRenderingContext2D | null = null;
let animationFrameId: number | null = null;
let particles: Particle[] = [];

function initCanvas(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  try {
    if (!activeCanvas || !document.body.contains(activeCanvas)) {
      activeCanvas = document.createElement('canvas');
      activeCanvas.id = 'cyber-confetti-canvas';
      activeCanvas.style.position = 'fixed';
      activeCanvas.style.top = '0';
      activeCanvas.style.left = '0';
      activeCanvas.style.width = '100vw';
      activeCanvas.style.height = '100vh';
      activeCanvas.style.pointerEvents = 'none';
      activeCanvas.style.zIndex = '99999';
      document.body.appendChild(activeCanvas);
    }

    const dpr = window.devicePixelRatio || 1;
    activeCanvas.width = window.innerWidth * dpr;
    activeCanvas.height = window.innerHeight * dpr;

    activeCtx = activeCanvas.getContext('2d');
    if (activeCtx) {
      activeCtx.scale(dpr, dpr);
    }
    return !!activeCtx;
  } catch {
    return false;
  }
}

function updateAndDraw() {
  if (!activeCtx || !activeCanvas) return;

  try {
    const width = window.innerWidth;
    const height = window.innerHeight;

    activeCtx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38; // gravity
      p.vx *= 0.985; // drag
      p.rotation += p.vRot;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > height + 50) {
        particles.splice(i, 1);
        continue;
      }

      activeCtx.save();
      activeCtx.globalAlpha = Math.max(0, p.alpha);
      activeCtx.translate(p.x, p.y);
      activeCtx.rotate((p.rotation * Math.PI) / 180);
      activeCtx.fillStyle = p.color;

      if (p.shape === 'rect') {
        activeCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.6);
      } else {
        // glowing diamond spark
        activeCtx.beginPath();
        activeCtx.moveTo(0, -p.size);
        activeCtx.lineTo(p.size * 0.6, 0);
        activeCtx.lineTo(0, p.size);
        activeCtx.lineTo(-p.size * 0.6, 0);
        activeCtx.closePath();
        activeCtx.fill();
      }

      activeCtx.restore();
    }

    if (particles.length > 0) {
      animationFrameId = requestAnimationFrame(updateAndDraw);
    } else {
      cleanupCanvas();
    }
  } catch {
    cleanupCanvas();
  }
}

function cleanupCanvas() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  particles = [];
  if (activeCanvas && document.body.contains(activeCanvas)) {
    try {
      document.body.removeChild(activeCanvas);
    } catch {
      // ignore
    }
  }
  activeCanvas = null;
  activeCtx = null;
}

/**
 * Triggers an explosion of celebratory particles from the top/center of the screen
 */
export function fireCyberConfetti(count: number = 90): void {
  try {
    if (!initCanvas()) return;

    const startX = window.innerWidth * 0.5;
    const startY = window.innerHeight * 0.35;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 6 + Math.random() * 12;

      particles.push({
        x: startX + (Math.random() - 0.5) * 80,
        y: startY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // initial upward lift
        size: 5 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 14,
        alpha: 1.0,
        decay: 0.012 + Math.random() * 0.014,
        shape: Math.random() > 0.4 ? 'rect' : 'spark',
      });
    }

    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(updateAndDraw);
    }
  } catch {
    // Graceful silent fallback
  }
}
