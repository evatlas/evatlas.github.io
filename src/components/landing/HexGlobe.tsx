"use client";

import { useRef, useEffect } from "react";
import tileData from "@/data/globe-tiles.json";

interface Tile {
  // Unit vector on the sphere (fixed; rotation happens at projection time)
  x: number;
  y: number;
  z: number;
  phase: number; // per-tile phase for idle drift / shimmer
}

// Steel-blue → bright cyan ramp for land tiles on the dark hero
const RAMP: [number, number, number][] = [
  [35, 85, 125],
  [70, 140, 195],
  [120, 190, 240],
  [195, 232, 255],
];

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

const TILT = -0.3; // resting axial tilt, radians
const AUTO_SPEED = 0.045; // auto-rotation, radians per second
const MOUSE_RADIUS = 100; // px — hover influence radius
const MOUSE_PUSH = 8; // px — max tile displacement away from cursor
const DRAG_RATE = 0.004; // radians per px dragged (both axes, unclamped)

export default function HexGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: 0.5,
    pitch: 0,
    vyaw: 0,
    vpitch: 0,
  });
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const landTiles = unpack(tileData.land, tileData.scale);
    const meshNodes = unpack(tileData.ocean, tileData.scale);

    // Mesh edges: connect each ocean node to its 2 nearest neighbours.
    // Computed once — nodes never move on the sphere.
    const edges: [number, number, number][] = [];
    const seen = new Set<string>();
    for (let a = 0; a < meshNodes.length; a++) {
      const near: [number, number][] = [];
      for (let b = 0; b < meshNodes.length; b++) {
        if (a === b) continue;
        const dx = meshNodes[a].x - meshNodes[b].x;
        const dy = meshNodes[a].y - meshNodes[b].y;
        const dz = meshNodes[a].z - meshNodes[b].z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.14) near.push([d2, b]);
      }
      near.sort((u, v) => u[0] - v[0]);
      for (let k = 0; k < Math.min(3, near.length); k++) {
        const b = near[k][1];
        const key = Math.min(a, b) + "_" + Math.max(a, b);
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([a, b, (a * 2.7 + b) % 6.283]);
        }
      }
    }

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
      drag.vpitch = 0;
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
      // Free rotation — no clamps on either axis
      drag.yaw -= dx * DRAG_RATE;
      drag.pitch += dy * DRAG_RATE;
      drag.vyaw = -dx * DRAG_RATE;
      drag.vpitch = dy * DRAG_RATE;
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
        if (!reducedMotion) drag.yaw -= AUTO_SPEED * dt;
        drag.yaw += drag.vyaw;
        drag.pitch += drag.vpitch;
        drag.vyaw *= 0.94;
        drag.vpitch *= 0.94;
      }

      const cosY = Math.cos(drag.yaw);
      const sinY = Math.sin(drag.yaw);
      const phi = TILT + drag.pitch;
      const cosT = Math.cos(phi);
      const sinT = Math.sin(phi);

      const cx = w / 2;
      const cy = h * 0.52;
      const R = Math.min(w * 0.47, h * 0.75);
      const base = R * 0.0066; // sized for the ~34k-sample tile density
      const fadeIn = reducedMotion ? 1 : Math.min(1, t / 1.2);
      const mouse = mouseRef.current;
      const hoverActive = !drag.active;

      ctx!.clearRect(0, 0, w, h);

      // Soft dark disc behind the tiles — sphere volume, no outline
      const disc = ctx!.createRadialGradient(
        cx - R * 0.3,
        cy - R * 0.3,
        R * 0.1,
        cx,
        cy,
        R * 1.02
      );
      disc.addColorStop(0, `rgba(14, 48, 76, ${0.85 * fadeIn})`);
      disc.addColorStop(0.7, `rgba(10, 38, 62, ${0.5 * fadeIn})`);
      disc.addColorStop(1, "rgba(10, 38, 62, 0)");
      ctx!.fillStyle = disc;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
      ctx!.fill();

      // Ocean mesh — project nodes once, then draw edges + nodes
      const px: number[] = [];
      const py: number[] = [];
      const pz: number[] = [];
      for (let i = 0; i < meshNodes.length; i++) {
        const nd = meshNodes[i];
        const rx = nd.x * cosY + nd.z * sinY;
        const rz0 = -nd.x * sinY + nd.z * cosY;
        const ry = nd.y * cosT - rz0 * sinT;
        const rz = nd.y * sinT + rz0 * cosT;
        px.push(cx - rx * R);
        py.push(cy - ry * R);
        pz.push(rz);
      }
      ctx!.lineWidth = 0.7;
      for (let i = 0; i < edges.length; i++) {
        const [a, b, ph] = edges[i];
        if (pz[a] < 0.04 || pz[b] < 0.04) continue;
        const shimmer = reducedMotion
          ? 0.5
          : 0.5 + 0.5 * Math.sin(t * 1.3 + ph);
        const alpha =
          (0.03 + 0.07 * Math.min(pz[a], pz[b]) + 0.05 * shimmer) * fadeIn;
        ctx!.strokeStyle = `rgba(96, 196, 255, ${alpha})`;
        ctx!.beginPath();
        ctx!.moveTo(px[a], py[a]);
        ctx!.lineTo(px[b], py[b]);
        ctx!.stroke();
      }
      for (let i = 0; i < meshNodes.length; i++) {
        if (pz[i] < 0.04) continue;
        const pulse = reducedMotion
          ? 0.5
          : 0.5 + 0.5 * Math.sin(t * 1.6 + meshNodes[i].phase);
        ctx!.fillStyle = `rgba(140, 210, 255, ${
          (0.12 + 0.22 * pz[i] + 0.12 * pulse) * fadeIn
        })`;
        ctx!.beginPath();
        ctx!.arc(px[i], py[i], 0.6 + 0.7 * pz[i], 0, Math.PI * 2);
        ctx!.fill();
      }

      // Land tiles
      for (const tile of landTiles) {
        const rx = tile.x * cosY + tile.z * sinY;
        const rz0 = -tile.x * sinY + tile.z * cosY;
        const ry = tile.y * cosT - rz0 * sinT;
        const rz = tile.y * sinT + rz0 * cosT;

        if (rz < 0.02) continue; // back hemisphere

        let sx = cx - rx * R;
        let sy = cy - ry * R;
        if (sy < -12 || sy > h + 12) continue;

        if (!reducedMotion) {
          sx += Math.sin(t * 1.2 + tile.phase) * 0.5;
          sy += Math.cos(t * 1.05 + tile.phase * 1.7) * 0.5;
        }

        let light = 0.25 + 0.55 * rz + 0.12 * Math.max(0, (rx + ry) * 0.7);
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
            // Quadratic falloff — subtle glow that dies off toward the rim
            light += f * f * 0.3;
            sizeBoost = 1 + f * f * 0.35;
          }
        }

        const pos = Math.max(0, Math.min(1, light)) * (RAMP.length - 1);
        const ci = Math.min(RAMP.length - 2, Math.floor(pos));
        const cf = pos - ci;
        const A = RAMP[ci];
        const B = RAMP[ci + 1];
        const cr = A[0] + (B[0] - A[0]) * cf;
        const cg = A[1] + (B[1] - A[1]) * cf;
        const cb = A[2] + (B[2] - A[2]) * cf;

        const edgeFade = Math.min(1, rz * 8);
        // Continuous highlight ramp (a hard >0.8 step used to cut a visible band)
        const highlight = 0.25 * Math.min(1, Math.max(0, (light - 0.7) / 0.3));
        ctx!.fillStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${
          (0.32 + 0.3 * rz + highlight) * edgeFade * fadeIn
        })`;

        const rad = base * (0.55 + 0.6 * rz) * sizeBoost;
        ctx!.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const hx = sx + Math.cos(a) * rad;
          const hy = sy + Math.sin(a) * rad;
          if (k === 0) ctx!.moveTo(hx, hy);
          else ctx!.lineTo(hx, hy);
        }
        ctx!.closePath();
        ctx!.fill();
      }

      // Readability vignette behind the centered headline
      const vig = ctx!.createRadialGradient(
        cx,
        h * 0.46,
        30,
        cx,
        h * 0.46,
        Math.min(w, h) * 0.55
      );
      vig.addColorStop(0, "rgba(4, 18, 32, 0.66)");
      vig.addColorStop(1, "rgba(4, 18, 32, 0)");
      ctx!.fillStyle = vig;
      ctx!.fillRect(0, 0, w, h);

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
