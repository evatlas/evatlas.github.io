"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import ChartSkeleton from "@/components/ui/ChartSkeleton";

type ViewMode = "cma" | "all";

interface CityRow {
  cmauid: string;
  name: string;
  province: string;
  geoType: string; // "CMA" | "CA"
  pop: number;
  regTotal2025: number;
  regZev2025: number;
  evShare2025: number;
  cumZev: number;
  stations: number;
  portsL2: number;
  portsDcfc: number;
  portsTotal: number;
  evsPerPort: number; // NaN when no ports
  portsPer100k: number;
}

// Region colour groups — muted, consistent with Section 1 palette
const REGION_COLORS: Record<string, string> = {
  "British Columbia": "#e67e22",
  Quebec: "#0065a4",
  Ontario: "#051c2c",
  Prairies: "#5ba3d9",
  Atlantic: "#94a3b8",
};

function regionOf(province: string): string {
  if (province.includes("British Columbia")) return "British Columbia";
  if (province.includes("Ontario")) return "Ontario"; // incl. Ottawa-Gatineau (Ontario / Quebec)
  if (province.includes("Quebec")) return "Quebec";
  if (province === "Manitoba" || province === "Saskatchewan") return "Prairies";
  return "Atlantic";
}

function parseCSV(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .trim()
    .split("\n")
    .map((line) => line.split(","));
}

export default function NationalPulseSection3() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [rows, setRows] = useState<CityRow[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cma");
  const [dims, setDims] = useState({ width: 0, height: 420 });
  const [hovered, setHovered] = useState<CityRow | null>(null);

  useEffect(() => {
    fetch("/data/section3_cma.csv")
      .then((r) => r.text())
      .then((text) => {
        const table = parseCSV(text);
        const header = table[0];
        const col = (name: string) => header.indexOf(name);
        const popIdx = header.findIndex((h) => h.startsWith("pop_"));
        const data: CityRow[] = table.slice(1).map((r) => ({
          cmauid: r[col("CMAUID")],
          name: r[col("name")],
          province: r[col("province")],
          geoType: r[col("geo_type")],
          pop: +r[popIdx],
          regTotal2025: +r[col("reg_total_2025")],
          regZev2025: +r[col("reg_zev_2025")],
          evShare2025: +r[col("ev_share_2025")],
          cumZev: +r[col("cum_zev_2017p")],
          stations: +r[col("stations")],
          portsL2: +r[col("ports_l2")],
          portsDcfc: +r[col("ports_dcfc")],
          portsTotal: +r[col("ports_total")],
          evsPerPort: r[col("evs_per_port")] === "" ? NaN : +r[col("evs_per_port")],
          portsPer100k: +r[col("ports_per_100k")],
        }));
        setRows(data.filter((d) => !isNaN(d.evShare2025) && !isNaN(d.portsPer100k)));
      });
  }, []);

  // Measure synchronously first, then observe (see Sections 1 & 2)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = (w: number) =>
      setDims({
        width: Math.max(0, Math.floor(w)),
        height: Math.min(460, Math.max(360, Math.floor(w * 0.48))),
      });
    apply(el.getBoundingClientRect().width);
    const obs = new ResizeObserver((entries) => {
      apply(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rows]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const filtered = viewMode === "cma" ? rows.filter((d) => d.geoType === "CMA") : rows;
    // big bubbles first so small ones stay hoverable on top
    return [...filtered].sort((a, b) => b.pop - a.pop);
  }, [rows, viewMode]);

  const margin = useMemo(() => ({ top: 16, right: 24, bottom: 48, left: 52 }), []);

  const scales = useMemo(() => {
    if (visible.length === 0 || dims.width === 0) return null;
    const xMax = d3.max(visible, (d) => d.portsPer100k) ?? 100;
    const yMax = d3.max(visible, (d) => d.evShare2025) ?? 10;
    const popExtent = d3.extent(visible, (d) => d.pop) as [number, number];
    return {
      x: d3
        .scaleLinear()
        .domain([0, xMax * 1.06])
        .range([margin.left, dims.width - margin.right])
        .nice(),
      y: d3
        .scaleLinear()
        .domain([0, yMax * 1.12])
        .range([dims.height - margin.bottom, margin.top]),
      r: d3.scaleSqrt().domain(popExtent).range(viewMode === "cma" ? [5, 26] : [3, 26]),
    };
  }, [visible, dims, margin, viewMode]);

  // D3 axes
  useEffect(() => {
    if (!svgRef.current || !scales) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll(".axis").remove();

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${dims.height - margin.bottom})`)
      .call(d3.axisBottom(scales.x).ticks(6).tickSize(0).tickPadding(8))
      .call((g) => g.select(".domain").attr("stroke", "#e0e0e0"))
      .selectAll("text")
      .attr("fill", "#888")
      .attr("font-size", "11px");

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(scales.y)
          .ticks(5)
          .tickSize(-(dims.width - margin.left - margin.right))
          .tickFormat((d) => `${d}%`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll(".tick line").attr("stroke", "#f0f0f0").attr("stroke-dasharray", "2,2")
      )
      .selectAll("text")
      .attr("fill", "#888")
      .attr("font-size", "11px");
  }, [scales, dims, margin]);

  // Permanent labels: biggest cities in view + adoption leaders
  const labeled = useMemo(() => {
    if (visible.length === 0) return new Set<string>();
    const byPop = [...visible].sort((a, b) => b.pop - a.pop).slice(0, 6);
    const byShare = [...visible].sort((a, b) => b.evShare2025 - a.evShare2025).slice(0, 2);
    return new Set([...byPop, ...byShare].map((d) => d.cmauid));
  }, [visible]);

  const handleLeave = useCallback(() => setHovered(null), []);

  if (!rows) return <ChartSkeleton height={520} />;

  const fmt = d3.format(",");

  return (
    <section>
      <div className="flex flex-col items-center mb-4">
        <h2 className="text-2xl font-bold text-navy">City-Level Analysis</h2>
        <p className="text-text-secondary text-sm mt-1">
          EV adoption vs. public charging coverage across urban Canada, 2025
        </p>
        <div className="flex gap-1 bg-background-alt rounded-lg p-1 mt-3">
          {(
            [
              { key: "cma", label: "Metro areas" },
              { key: "all", label: "All urban areas" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setViewMode(key);
                setHovered(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === key
                  ? "bg-white text-navy shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative w-full">
        {dims.width > 0 && scales && (
          <>
            <svg
              ref={svgRef}
              width={dims.width}
              height={dims.height}
              style={{ display: "block", maxWidth: "100%" }}
            >
              {/* Bubbles */}
              {visible.map((d) => {
                const cx = scales.x(d.portsPer100k);
                const cy = scales.y(d.evShare2025);
                const r = scales.r(d.pop);
                const color = REGION_COLORS[regionOf(d.province)];
                const isHovered = hovered?.cmauid === d.cmauid;
                const dimmed = hovered !== null && !isHovered;
                return (
                  <circle
                    key={d.cmauid}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={color}
                    fillOpacity={dimmed ? 0.15 : 0.55}
                    stroke={isHovered ? "#051c2c" : color}
                    strokeOpacity={dimmed ? 0.25 : 0.9}
                    strokeWidth={isHovered ? 2 : 1}
                    onMouseEnter={() => setHovered(d)}
                    onMouseLeave={handleLeave}
                    className="cursor-pointer transition-opacity duration-150"
                  />
                );
              })}

              {/* Crosshair for hovered bubble */}
              {hovered && (
                <g pointerEvents="none">
                  <line
                    x1={scales.x(hovered.portsPer100k)}
                    y1={scales.y(hovered.evShare2025)}
                    x2={scales.x(hovered.portsPer100k)}
                    y2={dims.height - margin.bottom}
                    stroke="#999"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <line
                    x1={margin.left}
                    y1={scales.y(hovered.evShare2025)}
                    x2={scales.x(hovered.portsPer100k)}
                    y2={scales.y(hovered.evShare2025)}
                    stroke="#999"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                </g>
              )}

              {/* Labels for major cities */}
              {visible
                .filter((d) => labeled.has(d.cmauid))
                .map((d) => (
                  <text
                    key={`lbl-${d.cmauid}`}
                    x={scales.x(d.portsPer100k)}
                    y={scales.y(d.evShare2025) - scales.r(d.pop) - 5}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={600}
                    fill="#555"
                    pointerEvents="none"
                  >
                    {d.name}
                  </text>
                ))}

              {/* Axis titles */}
              <text
                x={(margin.left + dims.width - margin.right) / 2}
                y={dims.height - 8}
                textAnchor="middle"
                fontSize={11}
                fill="#888"
              >
                Public charging ports per 100,000 residents
              </text>
              <text
                transform={`translate(13,${(margin.top + dims.height - margin.bottom) / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize={11}
                fill="#888"
              >
                EV share of new registrations, 2025
              </text>
            </svg>

            {/* Region legend */}
            <div className="absolute top-1 right-2 flex flex-col gap-1 text-[11px] text-text-secondary bg-white/80 rounded px-2 py-1.5">
              {Object.entries(REGION_COLORS).map(([region, color]) => (
                <div key={region} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color, opacity: 0.7 }}
                  />
                  <span>{region}</span>
                </div>
              ))}
            </div>

            {/* Tooltip */}
            {hovered && (
              <div
                className="absolute pointer-events-none bg-white border border-border-light rounded-lg shadow-md px-3 py-2 text-xs z-10"
                style={{
                  left:
                    scales.x(hovered.portsPer100k) > dims.width * 0.55
                      ? scales.x(hovered.portsPer100k) - 215
                      : scales.x(hovered.portsPer100k) + 16,
                  top: Math.max(4, scales.y(hovered.evShare2025) - 60),
                  width: 200,
                }}
              >
                <p className="font-semibold text-navy">
                  {hovered.name}
                  <span className="text-text-muted font-normal"> · {hovered.province}</span>
                </p>
                <div className="mt-1.5 space-y-0.5 text-text-secondary">
                  <p>
                    EV share of 2025 registrations:{" "}
                    <span className="font-semibold text-navy">
                      {hovered.evShare2025.toFixed(1)}%
                    </span>
                  </p>
                  <p>
                    New EVs registered 2025:{" "}
                    <span className="font-semibold text-navy">{fmt(hovered.regZev2025)}</span>
                  </p>
                  <p>
                    Public charging ports:{" "}
                    <span className="font-semibold text-navy">{fmt(hovered.portsTotal)}</span>
                    {hovered.portsDcfc > 0 && (
                      <span className="text-text-muted"> ({fmt(hovered.portsDcfc)} fast)</span>
                    )}
                  </p>
                  <p>
                    EVs per port:{" "}
                    <span className="font-semibold text-navy">
                      {isNaN(hovered.evsPerPort) ? "—" : hovered.evsPerPort.toFixed(0)}
                    </span>
                  </p>
                  <p>
                    Population: <span className="font-semibold text-navy">{fmt(hovered.pop)}</span>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-center text-xs text-text-muted mt-2">
        Bubble size reflects population · Hover for details
      </p>

      <p className="text-[11px] text-text-muted leading-relaxed mt-4 max-w-3xl mx-auto text-center">
        Sources: Statistics Canada 20-10-0025-01 (new registrations, 2025) and 17-10-0135-01
        (population estimates, 2022); NREL Alternative Fuel Stations (public charging ports,
        early 2026). Alberta, New Brunswick, Newfoundland and Labrador, and Prince Edward
        Island are excluded — registrations for these provinces are suppressed in the source
        table. Cross-border areas with partial coverage (Lloydminster, Campbellton) are also
        excluded.
      </p>
    </section>
  );
}
