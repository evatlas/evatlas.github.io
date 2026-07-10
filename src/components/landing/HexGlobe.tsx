"use client";

import { useRef, useEffect } from "react";
import tileData from "@/data/globe-tiles.json";

interface Tile {
  // Unit vector on the sphere (fixed; rotation happens at projection time)
  x: number;
  y: number;
  z: number;
  phase: number; // per-tile phase for the idle "breathing" motion
}

// Deep navy → bright blue ramp for land tiles, indexed by lighting
const RAMP: [number, number, number][] = [
  [5, 28, 44], // #051c2c
  [0, 101, 164], // #0065a4
  [0, 133, 209], // #0085d1
  [127, 200, 245], // highlight
];

function rampColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const pos = clamped * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

function unpack(flat: number[], scale: number): Tile[] {
  const tiles: Tile[] = [];
  for (let i = 0; i < flat.length; i += 3) {
    tiles.push({
      x: flat[i] / scale,
      y: flat[i + 1] / scale,
      z: flat[i + 2] / scale,
      phase: (i * 0.206) % (Math.PI * 2),
    });
  }
  return tiles;
}

const TILT = -0.35; // resting axial tilt, radians
const AUTO_SPEED = 0.07; // auto-rotation, radians per second
const MOUSE_RADIUS = 100; // px — hover influence radius
const MOUSE_PUSH = 8; // px — max tile displacement away from cursor
const DRAG_YAW = 0.005; // radians per px dragged horizontally
const DRAG_PITCH = 0.004; // radians per px dragged vertically
const MAX_PITCH = 0.7;

export default function HexGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: 0,
    pitch: 0,
    vyaw: 0, // inertia after release
  });
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const landTiles = unpack(tileData.land, tileData.scale);
    const oceanTiles = unpack(tileData.ocean, tileData.scale);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? 480;
      const h = parent?.clientHeight ?? 480;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      const drag = dragRef.current;
      const p = toLocal(e);
      drag.active = true;
      drag.lastX = p.x;
      drag.lastY = p.y;
      drag.vyaw = 0;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      const p = toLocal(e);
      mouseRef.current = p;
      const drag = dragRef.current;
      if (!drag.active) return;
      const dx = p.x - drag.lastX;
      const dy = p.y - drag.lastY;
      drag.yaw += dx * DRAG_YAW;
      drag.pitch = Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, drag.pitch + dy * DRAG_PITCH)
      );
      drag.vyaw = dx * DRAG_YAW;
      drag.lastX = p.x;
      drag.lastY = p.y;
    };
    const onPointerUp = () => {
      dragRef.current.active = false;
      canvas.style.cursor = "grab";
    };
    const onPointerLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    const start = performance.now();
    let prev = start;

    function drawHex(cx: number, cy: number, radius: number) {
      ctx!.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        if (k === 0) ctx!.moveTo(px, py);
        else ctx!.lineTo(px, py);
      }
      ctx!.closePath();
      ctx!.fill();
    }

    function animate(now: number) {
      const { w, h } = sizeRef.current;
      if (w === 0) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      const drag = dragRef.current;
      if (!drag.active) {
        if (!reducedMotion) drag.yaw += AUTO_SPEED * dt;
        // Inertia from the last drag, decaying
        drag.yaw += drag.vyaw;
        drag.vyaw *= 0.94;
      }

      const cosY = Math.cos(drag.yaw);
      const sinY = Math.sin(drag.yaw);
      const phi = TILT + drag.pitch;
      const cosT = Math.cos(phi);
      const sinT = Math.sin(phi);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.46;
      const landBase = R * 0.011;
      const oceanBase = R * 0.009;
      const fadeIn = reducedMotion ? 1 : Math.min(1, t / 1.2);
      const mouse = mouseRef.current;
      const hoverActive = !drag.active;

      ctx!.clearRect(0, 0, w, h);

      // Water-tinted backdrop disc so oceans read as sea, not blank page
      const grad = ctx!.createRadialGradient(
        cx - R * 0.3,
        cy - R * 0.3,
        R * 0.1,
        cx,
        cy,
        R
      );
      grad.addColorStop(0, "rgba(228, 242, 252, 0.98)");
      grad.addColorStop(0.72, "rgba(191, 223, 243, 0.9)");
      grad.addColorStop(1, "rgba(137, 189, 224, 0.75)");
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.strokeStyle = "rgba(0, 101, 164, 0.25)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.stroke();

      // Two passes: faint ocean texture first, land tiles on top
      for (let pass = 0; pass < 2; pass++) {
        const tiles = pass === 0 ? oceanTiles : landTiles;
        const base = pass === 0 ? oceanBase : landBase;
        for (const tile of tiles) {
          const rx = tile.x * cosY + tile.z * sinY;
          const rz0 = -tile.x * sinY + tile.z * cosY;
          const ry = tile.y * cosT - rz0 * sinT;
          const rz = tile.y * sinT + rz0 * cosT;

          if (rz < 0.02) continue; // back hemisphere

          let sx = cx + rx * R;
          let sy = cy - ry * R;

          if (!reducedMotion) {
            sx += Math.sin(t * 1.3 + tile.phase) * 0.6;
            sy += Math.cos(t * 1.1 + tile.phase * 1.7) * 0.6;
          }

          let light = 0.25 + 0.55 * rz + 0.2 * Math.max(0, (-rx + ry) * 0.7);
          let sizeBoost = 1;
          if (hoverActive) {
            const dx = sx - mouse.x;
            const dy = sy - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_RADIUS && dist > 0.001) {
              const f = 1 - dist / MOUSE_RADIUS;
              const push = f * f * MOUSE_PUSH;
              sx += (dx / dist) * push;
              sy += (dy / dist) * push;
              light += f * 0.45;
              sizeBoost = 1 + f * 0.35;
            }
          }

          const edgeFade = Math.min(1, rz * 8);
          if (pass === 0) {
            ctx!.fillStyle = `rgba(0, 101, 164, ${
              (0.1 + 0.1 * rz + (light > 0.75 ? 0.2 : 0)) * edgeFade * fadeIn
            })`;
          } else {
            const [cr, cg, cb] = rampColor(light);
            ctx!.fillStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${
              (0.6 + 0.4 * rz) * edgeFade * fadeIn
            })`;
          }
          drawHex(sx, sy, base * (0.55 + 0.6 * rz) * sizeBoost);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}
