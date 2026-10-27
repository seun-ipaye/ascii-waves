export interface WavesOptions {
  /** Size of each character cell in px on desktop. Smaller = finer texture. Default 4. */
  cellSize?: number;
  /** Cell size on screens at or below `mobileBreakpoint`. Default 6. */
  mobileCellSize?: number;
  /** Frames per second on desktop. Default 30. */
  fps?: number;
  /** Frames per second on mobile. Default 20. */
  mobileFps?: number;
  /** Viewport width (px) at or below which the mobile settings apply. Default 768. */
  mobileBreakpoint?: number;
  /** Character color as a hex string, e.g. "#ffffff" or "#0af". Default "#ffffff". */
  color?: string;
  /** Peak opacity of the brightest characters, 0 to 1. Default 0.5. */
  brightness?: number;
  /** Characters to draw with. Default letters, digits and symbols. */
  chars?: string;
  /** Wave speed multiplier. 1 is normal, 0.5 is half speed. Default 1. */
  speed?: number;
  /** Hover glow plus click, tap and drag ripples. Default true. */
  interactive?: boolean;
  /** Draw a single still frame when the user prefers reduced motion. Default true. */
  respectReducedMotion?: boolean;
}

export interface Waves {
  /** Stop the animation and remove all listeners. */
  destroy: () => void;
}

const DEFAULT_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789#$%&*+=<>?/\\|{}[]~^";
const LEVELS = 10;
const WAVE_STEP = 4;

const RIPPLE_LIFE = 3;
const RIPPLE_SPEED = 240;
const RIPPLE_WIDTH = 34;
const DENT_RADIUS = 70;
const HOVER_RADIUS = 80;
const MAX_RIPPLES = 12;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function parseColor(input: string): [number, number, number] {
  const hex = input.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [255, 255, 255];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

interface Ripple {
  x: number;
  y: number;
  t0: number;
  press: boolean;
  strength: number;
}

export function createWaves(
  canvas: HTMLCanvasElement,
  options: WavesOptions = {},
): Waves {
  const {
    cellSize = 4,
    mobileCellSize = 6,
    fps: desktopFps = 30,
    mobileFps = 20,
    mobileBreakpoint = 768,
    color = "#ffffff",
    brightness = 0.5,
    chars = DEFAULT_CHARS,
    speed = 1,
    interactive = true,
    respectReducedMotion = true,
  } = options;

  const ctx = canvas.getContext("2d");
  if (!ctx || chars.length === 0) return { destroy: () => {} };

  const [cr, cg, cb] = parseColor(color);
  const reducedMotion =
    respectReducedMotion &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const randomIndex = () => Math.floor(Math.random() * chars.length);

  let cell = cellSize;
  let fps = desktopFps;
  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let waveCols = 0;
  let waveRows = 0;
  let dpr = 1;
  let glyphs: number[] = [];
  let shimmer: number[] = [];
  let wave = new Float32Array(0);
  let atlas: HTMLCanvasElement | null = null;
  let raf = 0;
  let last = 0;

  let ripples: Ripple[] = [];
  const hover = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, target: 0 };
  let dragging = false;
  let lastDrag = { x: 0, y: 0, t: 0 };

  const buildAtlas = () => {
    const size = Math.ceil(cell * dpr);
    atlas = document.createElement("canvas");
    atlas.width = size * chars.length;
    atlas.height = size * LEVELS;
    const a = atlas.getContext("2d");
    if (!a) return;
    a.font = `${(cell + 1) * dpr}px ui-monospace, Menlo, monospace`;
    a.textBaseline = "top";
    for (let l = 0; l < LEVELS; l++) {
      const alpha = 0.005 + (l / (LEVELS - 1)) * brightness;
      a.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      for (let c = 0; c < chars.length; c++) {
        a.fillText(chars[c], c * size, l * size);
      }
    }
  };

  const addRipple = (x: number, y: number, press: boolean, strength: number) => {
    ripples.push({ x, y, t0: performance.now() / 1000, press, strength });
    if (ripples.length > MAX_RIPPLES) ripples.shift();
  };

  const rippleAt = (x: number, y: number, t: number) => {
    let sum = 0;
    for (const rp of ripples) {
      const age = t - rp.t0;
      if (age < 0 || age > RIPPLE_LIFE) continue;
      const dx = x - rp.x;
      const dy = y - rp.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (rp.press) {
        const press = Math.min(1, age / 0.15) * Math.exp(-age / 0.7);
        sum -=
          1.6 *
          rp.strength *
          press *
          Math.exp(-(d * d) / (2 * DENT_RADIUS * DENT_RADIUS));
      }

      const radius = Math.max(0, age - (rp.press ? 0.12 : 0)) * RIPPLE_SPEED;
      const off = d - radius;
      sum +=
        1.1 *
        rp.strength *
        Math.exp(-(off * off) / (2 * RIPPLE_WIDTH * RIPPLE_WIDTH)) *
        Math.exp(-age / 1.1);
    }
    return sum;
  };

  const render = (now: number) => {
    if (!atlas || cols === 0 || rows === 0) return;

    const real = now / 1000;
    const t = real * speed;
    const size = Math.ceil(cell * dpr);
    const cx = width * (0.5 + 0.35 * Math.sin(t * 0.11));
    const cy = height * (0.5 + 0.35 * Math.cos(t * 0.09));
    const threshold = 0.08 + 0.14 * Math.sin(t * 0.22);
    const blockPx = cell * WAVE_STEP;

    ripples = ripples.filter((rp) => real - rp.t0 <= RIPPLE_LIFE);
    hover.strength += (hover.target - hover.strength) * 0.15;
    hover.x += (hover.tx - hover.x) * 0.25;
    hover.y += (hover.ty - hover.y) * 0.25;
    const hoverOn = hover.strength > 0.01;
    const hoverDenom = 2 * HOVER_RADIUS * HOVER_RADIUS;

    for (let wr = 0; wr < waveRows; wr++) {
      const y = wr * blockPx;
      for (let wc = 0; wc < waveCols; wc++) {
        const x = wc * blockPx;
        const w1 = Math.sin(x * 0.006 + y * 0.004 - t * 0.5);
        const w2 = Math.sin(x * 0.003 - y * 0.007 + t * 0.35 + 1.7);
        const dx = x - cx;
        const dy = y - cy;
        const w3 = Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.009 - t * 0.45);
        let v = (w1 + w2 + w3) / 3;

        if (ripples.length) v += rippleAt(x, y, real);
        if (hoverOn) {
          const hx = x - hover.x;
          const hy = y - hover.y;
          v += 0.3 * hover.strength * Math.exp(-(hx * hx + hy * hy) / hoverDenom);
        }

        const s = smoothstep(threshold, threshold + 1.3, v);
        wave[wr * waveCols + wc] = s * s;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      const waveRow = Math.floor(r / WAVE_STEP) * waveCols;
      for (let c = 0; c < cols; c++) {
        let intensity = wave[waveRow + Math.floor(c / WAVE_STEP)];
        if (intensity <= 0.01) continue;

        const i = r * cols + c;
        if (Math.random() < intensity * 0.06) {
          glyphs[i] = randomIndex();
          shimmer[i] = 0.4 + Math.random() * 0.6;
        }
        intensity *= shimmer[i];

        const level = Math.min(LEVELS - 1, Math.floor(intensity * LEVELS));
        ctx.drawImage(
          atlas,
          glyphs[i] * size,
          level * size,
          size,
          size,
          c * size,
          r * size,
          size,
          size,
        );
      }
    }
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - last < 1000 / fps) return;
    last = now;
    render(now);
  };

  const local = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
  };

  const onPointerDown = (e: PointerEvent) => {
    const p = local(e);
    if (!p.inside) return;
    dragging = true;
    lastDrag = { x: p.x, y: p.y, t: performance.now() };
    addRipple(p.x, p.y, true, 1);
  };

  const onPointerMove = (e: PointerEvent) => {
    const p = local(e);
    if (e.pointerType === "mouse") {
      if (p.inside) {
        if (hover.target === 0) {
          hover.x = p.x;
          hover.y = p.y;
        }
        hover.tx = p.x;
        hover.ty = p.y;
        hover.target = 1;
      } else {
        hover.target = 0;
      }
    }
    if (!dragging || !p.inside) return;
    const now = performance.now();
    const dx = p.x - lastDrag.x;
    const dy = p.y - lastDrag.y;
    if (now - lastDrag.t > 280 && dx * dx + dy * dy > 120 * 120) {
      addRipple(p.x, p.y, false, 0.18);
      lastDrag = { x: p.x, y: p.y, t: now };
    }
  };

  const onPointerUp = () => {
    dragging = false;
  };

  const onLeave = () => {
    hover.target = 0;
    dragging = false;
  };

  const resize = () => {
    const mobile = window.innerWidth <= mobileBreakpoint;
    cell = Math.max(1, mobile ? mobileCellSize : cellSize);
    fps = Math.max(1, mobile ? mobileFps : desktopFps);
    dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    cols = Math.ceil(width / cell);
    rows = Math.ceil(height / cell);
    waveCols = Math.ceil(cols / WAVE_STEP);
    waveRows = Math.ceil(rows / WAVE_STEP);
    wave = new Float32Array(waveCols * waveRows);
    glyphs = Array.from({ length: cols * rows }, randomIndex);
    shimmer = Array.from({ length: cols * rows }, () => 0.5 + Math.random() * 0.5);
    buildAtlas();
    if (reducedMotion) render(30000);
  };

  resize();

  const observer =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  if (!observer) window.addEventListener("resize", resize);

  if (!reducedMotion) {
    raf = requestAnimationFrame(loop);
    if (interactive) {
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
  }

  return {
    destroy: () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    },
  };
}
