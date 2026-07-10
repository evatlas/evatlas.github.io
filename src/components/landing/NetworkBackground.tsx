"use client";

import { useRef, useEffect, useCallback } from "react";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface NetworkBackgroundProps {
  fadeLeftPercent?: number; // leftmost X% of canvas fades to transparent
}

export default function NetworkBackground({ fadeLeftPercent = 0 }: NetworkBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: -1,
    y: -1,
    active: false,
  });
  const wanderRef = useRef({ x: 0, y: 0, vx: 0.5, vy: 0.3 });
  const animRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const CONNECTION_DIST = 150;
  const GLOW_HOPS = 4;

  const initNodes = useCallback((w: number, h: number) => {
    const isMobile = w < 768;
    const count = isMobile ? 50 : 90;
    const nodes: Node[] = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      });
    }
    nodesRef.current = nodes;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Size setup
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
      if (nodesRef.current.length === 0) {
        initNodes(w, h);
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    // Mouse handlers
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };
    const onMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    // Build adjacency for BFS
    function getNeighbors(nodes: Node[]): Map<number, number[]> {
      const adj = new Map<number, number[]>();
      const dist2 = CONNECTION_DIST * CONNECTION_DIST;
      for (let i = 0; i < nodes.length; i++) {
        adj.set(i, []);
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy < dist2) {
            adj.get(i)!.push(j);
            adj.get(j)!.push(i);
          }
        }
      }
      return adj;
    }

    // BFS from nearest node to mouse
    function bfs(start: number, adj: Map<number, number[]>, maxHops: number): Map<number, number> {
      const visited = new Map<number, number>();
      visited.set(start, 0);
      const queue = [start];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const hop = visited.get(curr)!;
        if (hop >= maxHops) continue;
        for (const neighbor of adj.get(curr) || []) {
          if (!visited.has(neighbor)) {
            visited.set(neighbor, hop + 1);
            queue.push(neighbor);
          }
        }
      }
      return visited;
    }

    // Compute fade multiplier for a given x position
    const fadeThreshold = fadeLeftPercent / 100;
    function fadeMult(x: number, w: number): number {
      if (fadeLeftPercent <= 0) return 1;
      const pct = x / w; // 0 = left edge, 1 = right edge
      if (pct >= fadeThreshold) return 1;
      return pct / fadeThreshold; // 0 at left edge → 1 at threshold
    }

    function animate() {
      const { w, h } = sizeRef.current;
      const nodes = nodesRef.current;
      if (!ctx || w === 0) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      // Update node positions
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
        node.x = Math.max(0, Math.min(w, node.x));
        node.y = Math.max(0, Math.min(h, node.y));
      }

      // Auto-wander when mouse off canvas
      const wander = wanderRef.current;
      if (!mouseRef.current.active) {
        wander.x += wander.vx;
        wander.y += wander.vy;
        if (wander.x < 0 || wander.x > w) wander.vx *= -1;
        if (wander.y < 0 || wander.y > h) wander.vy *= -1;
        wander.x = Math.max(0, Math.min(w, wander.x));
        wander.y = Math.max(0, Math.min(h, wander.y));
      }

      const mx = mouseRef.current.active ? mouseRef.current.x : wander.x;
      const my = mouseRef.current.active ? mouseRef.current.y : wander.y;

      // Find nearest node to mouse/wander
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - mx;
        const dy = nodes[i].y - my;
        const d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }

      const adj = getNeighbors(nodes);
      const glowMap = bfs(nearestIdx, adj, GLOW_HOPS);

      // Draw base edges
      const dist2 = CONNECTION_DIST * CONNECTION_DIST;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (dx * dx + dy * dy < dist2) {
            const hopI = glowMap.get(i);
            const hopJ = glowMap.get(j);
            const isGlow = hopI !== undefined && hopJ !== undefined;

            // Fade based on leftmost node of the pair
            const edgeFade = Math.min(fadeMult(nodes[i].x, w), fadeMult(nodes[j].x, w));

            if (isGlow) {
              const maxHop = Math.max(hopI, hopJ);
              const brightness = 1 - maxHop / (GLOW_HOPS + 1);
              const alpha = (0.1 + brightness * 0.4) * edgeFade;
              ctx.save();
              ctx.strokeStyle = `rgba(0, 101, 164, ${alpha})`;
              ctx.lineWidth = 1 + brightness * 1.5;
              ctx.shadowColor = `rgba(0, 101, 164, ${0.3 * edgeFade})`;
              ctx.shadowBlur = brightness * 8;
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
              ctx.restore();
            } else {
              ctx.strokeStyle = `rgba(5, 28, 44, ${0.08 * edgeFade})`;
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const nFade = fadeMult(nodes[i].x, w);
        const hop = glowMap.get(i);
        if (hop !== undefined) {
          const brightness = 1 - hop / (GLOW_HOPS + 1);
          const alpha = (0.2 + brightness * 0.5) * nFade;
          const r = 1.5 + brightness * 2;
          ctx.fillStyle = `rgba(0, 101, 164, ${alpha})`;
          ctx.beginPath();
          ctx.arc(nodes[i].x, nodes[i].y, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(5, 28, 44, ${0.12 * nFade})`;
          ctx.beginPath();
          ctx.arc(nodes[i].x, nodes[i].y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      ro.disconnect();
    };
  }, [initNodes, fadeLeftPercent]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0"
      style={{ pointerEvents: "auto" }}
    />
  );
}
