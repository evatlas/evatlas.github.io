"use client";

import { useRef, useEffect } from "react";
import { geoContains } from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";

interface Tile {
  // Unit vector on the sphere (fixed; rotation happens at projection time)
  x: number;
  y: number;
  z: number;
  phase: number; // per-tile phase for the idle "breathing" motion
  spin: number; // per-tile hexagon orientation
}

// Deep navy → bright blue ramp, indexed by lighting
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

const POINT_COUNT = 5200; // fibonacci samples on the full sphere (~28% land)
const TILT = -0.35; // axial tilt, radians
const ROTATE_SPEED = 0.09; // radians per second
const MOUSE_RADIUS = 110; // px — cursor influence radius
const MOUSE_PUSH = 9; // px — max tile displacement away from cursor

export default function HexGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesRef = useRef<Tile[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    // Build land tiles once: fibonacci-sphere sampling filtered to landmass.
    // Points are fixed on the sphere — rotation is applied at projection time,
    // so the expensive geo test runs only at init.
    let cancelled = false;
    import("world-atlas/land-110m.json").then((topology) => {
      if (cancelled) return;
      const topo = topology as unknown as Topology<{ land: GeometryCollection }>;
      const land = feature(topo, topo.objects.land) as unknown as FeatureCollection<Geometry>;

      const tiles: Tile[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < POINT_COUNT; i++) {
        const y = 1 - (i / (POINT_COUNT - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = golden * i;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        const lat = (Math.asin(y) * 180) / Math.PI;
        const lon = (Math.atan2(z, x) * 180) / Math.PI;
        if (geoContains(land, [lon, lat])) {
          tiles.push({
            x,
            y,
            z,
            phase: (i * 0.618) % (Math.PI * 2),
            spin: (i * 2.4) % (Math.PI * 2),
          });
        }
      }
      tilesRef.current = tiles;
    });

    const start = performance.now();
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    function drawHex(
      cx: number,
      cy: number,
      radius: number,
      rotation: number
    ) {
      ctx!.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = rotation + (k * Math.PI) / 3;
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
      const tiles = tilesRef.current;
      if (w === 0 || tiles.length === 0) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      const t = (now - start) / 1000;
      const yaw = reducedMotion ? 0.6 : t * ROTATE_SPEED;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42;
      const baseTile = R * 0.017;
      const fadeIn = reducedMotion ? 1 : Math.min(1, t / 1.2);
      const mouse = mouseRef.current;

      ctx!.clearRect(0, 0, w, h);

      // Soft backdrop disc — gives the sphere volume behind the land tiles
      const grad = ctx!.createRadialGradient(
        cx - R * 0.3,
        cy - R * 0.3,
        R * 0.1,
        cx,
        cy,
        R * 1.02
      );
      grad.addColorStop(0, "rgba(224, 240, 255, 0.95)");
      grad.addColorStop(0.7, "rgba(224, 240, 255, 0.45)");
      grad.addColorStop(1, "rgba(224, 240, 255, 0)");
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.strokeStyle = "rgba(0, 101, 164, 0.12)";
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(cx, cy, R, 0, Math.PI * 2);
      ctx!.stroke();

      for (const tile of tiles) {
        // Yaw (spin around the poles), then axial tilt toward the viewer
        const rx = tile.x * cosY + tile.z * sinY;
        const rz0 = -tile.x * sinY + tile.z * cosY;
        const ry = tile.y * cosT - rz0 * sinT;
        const rz = tile.y * sinT + rz0 * cosT;

        if (rz < 0.02) continue; // back hemisphere

        let sx = cx + rx * R;
        let sy = cy - ry * R;

        // Idle breathing: each tile drifts slightly in place
        if (!reducedMotion) {
          sx += Math.sin(t * 1.3 + tile.phase) * 0.7;
          sy += Math.cos(t * 1.1 + tile.phase * 1.7) * 0.7;
        }

        // Lighting: front-facing depth plus an upper-left key light
        let light = 0.25 + 0.55 * rz + 0.2 * Math.max(0, (-rx + ry) * 0.7);

        // Cursor interaction: repel + brighten
        let sizeBoost = 1;
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

        const [cr, cg, cb] = rampColor(light);
        const edgeFade = Math.min(1, rz * 8); // fade near the silhouette
        ctx!.fillStyle = `rgba(${cr | 0}, ${cg | 0}, ${cb | 0}, ${
          (0.55 + 0.45 * rz) * edgeFade * fadeIn
        })`;

        const radius = baseTile * (0.55 + 0.6 * rz) * sizeBoost;
        drawHex(sx, sy, radius, tile.spin);
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
}
