"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import ChartSkeleton from "@/components/ui/ChartSkeleton";

type FuelFilter = "ev" | "bev" | "phev";

interface SalesRow {
  date: Date;
  bev: number;
  phev: number;
  ev: number;
  periodType: string;
}

interface StockRow {
  year: number;
  bev: number;
  phev: number;
  ev: number;
}

const COLORS = {
  ev: "#051c2c",
  bev: "#e67e22",
  phev: "#5ba3d9",
  bgLine: "#b0b8c0",
  bgBar: "rgba(180,190,200,0.3)",
  bgBarStroke: "rgba(180,190,200,0.5)",
  barFill: "rgba(200,208,216,0.35)",
  barStroke: "#051c2c",
};

function parseCSV(text: string): string[][] {
  return text.trim().split("\n").map((line) => line.replace(/\r$/, "").split(","));
}

const margin = { top: 20, right: 24, bottom: 40, left: 50 };

export default function NationalPulseSection1() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [salesData, setSalesData] = useState<SalesRow[] | null>(null);
  const [stockData, setStockData] = useState<StockRow[] | null>(null);
  const [fuelFilter, setFuelFilter] = useState<FuelFilter>("ev");
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: string;
  } | null>(null);

  useEffect(() => {
    fetch("/data/section1_ca_ev_sales.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const header = rows[0];
        setSalesData(
          rows.slice(1).map((r) => ({
            date: new Date(r[header.indexOf("date")]),
            bev: +r[header.indexOf("bev")],
            phev: +r[header.indexOf("phev")],
            ev: +r[header.indexOf("ev")],
            periodType: r[header.indexOf("period_type")],
          }))
        );
      });

    fetch("/data/section1_ca_ev_stock.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const header = rows[0];
        setStockData(
          rows.slice(1).map((r) => ({
            year: +r[header.indexOf("date")],
            bev: +r[header.indexOf("bev")],
            phev: +r[header.indexOf("phev")],
            ev: +r[header.indexOf("ev")],
          }))
        );
      });
  }, []);

  // Re-attach once data loads: before that we render <ChartSkeleton/> and
  // containerRef is null, so a mount-only ([]) effect would never observe.
  // Measure synchronously first — ResizeObserver's initial delivery waits
  // for a render frame.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = (w: number) =>
      setDims({
        width: Math.max(400, w),
        height: Math.min(320, Math.max(260, w * 0.38)),
      });
    apply(el.getBoundingClientRect().width);
    const obs = new ResizeObserver((entries) => {
      apply(entries[0].contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [salesData, stockData]);

  // Always scale to ev max so toggling BEV/PHEV doesn't change axis
  const { xScale, yScale } = useMemo(() => {
    if (!salesData) return { xScale: null, yScale: null };
    const extent = d3.extent(salesData, (d) => d.date) as [Date, Date];
    // Extend domain past last data point so 2026 label has room
    const domainEnd = new Date(extent[1].getFullYear(), extent[1].getMonth() + 3, 1);
    const maxVal = d3.max(salesData, (d) => d.ev) ?? 20;
    return {
      xScale: d3.scaleTime().domain([extent[0], domainEnd]).range([margin.left, dims.width - margin.right]),
      yScale: d3.scaleLinear().domain([0, maxVal * 1.1]).range([dims.height - margin.bottom, margin.top]),
    };
  }, [salesData, dims, margin.left, margin.right, margin.top, margin.bottom]);

  // Year boundaries for vertical gridlines + labels
  const yearBoundaries = useMemo(() => {
    if (!salesData) return [];
    const minYear = salesData[0].date.getFullYear();
    const lastDate = salesData[salesData.length - 1].date;
    const maxYear = lastDate.getFullYear() + 1;
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return years;
  }, [salesData]);

  // Line generators for each fuel type
  const makeLineGen = useCallback(
    (key: FuelFilter) => {
      if (!xScale || !yScale) return null;
      return d3
        .line<SalesRow>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d[key]))
        .curve(d3.curveMonotoneX);
    },
    [xScale, yScale]
  );


  // Axes
  useEffect(() => {
    if (!svgRef.current || !xScale || !yScale || !yearBoundaries.length) return;
    const svg = d3.select(svgRef.current);

    // X-axis: just the domain line, no ticks
    svg
      .select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0,${dims.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).tickValues([]).tickSize(0))
      .call((g) => {
        g.select(".domain").attr("stroke", "#e0e0e0");
      });

    // Year labels centered between vertical gridlines
    const xLabels = svg.select<SVGGElement>(".x-labels");
    xLabels.selectAll("*").remove();
    for (let i = 0; i < yearBoundaries.length - 1; i++) {
      const x0 = xScale(new Date(yearBoundaries[i], 0, 1));
      const x1 = xScale(new Date(yearBoundaries[i + 1], 0, 1));
      const midX = (x0 + x1) / 2;
      xLabels
        .append("text")
        .attr("x", midX)
        .attr("y", dims.height - margin.bottom + 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#999")
        .attr("font-size", "11px")
        .text(yearBoundaries[i]);
    }

    // Vertical gridlines at year boundaries
    const xGrid = svg.select<SVGGElement>(".x-grid");
    xGrid.selectAll("*").remove();
    for (const year of yearBoundaries) {
      const x = xScale(new Date(year, 0, 1));
      if (x >= margin.left && x <= dims.width - margin.right) {
        xGrid
          .append("line")
          .attr("x1", x).attr("x2", x)
          .attr("y1", margin.top).attr("y2", dims.height - margin.bottom)
          .attr("stroke", "#f0f0f0");
      }
    }

    // Y-axis
    svg
      .select<SVGGElement>(".y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}%`))
      .call((g) => {
        g.selectAll("text").attr("fill", "#999").attr("font-size", "11px");
        g.selectAll("line").attr("stroke", "#e0e0e0");
        g.select(".domain").attr("stroke", "#e0e0e0");
      });

    // Horizontal gridlines
    svg
      .select<SVGGElement>(".grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(yScale).ticks(6).tickSize(-(dims.width - margin.left - margin.right)).tickFormat(() => "")
      )
      .call((g) => {
        g.selectAll("line").attr("stroke", "#f0f0f0");
        g.select(".domain").remove();
      });
  }, [xScale, yScale, dims, margin, yearBoundaries]);

  // Bar width: map years to x positions via xScale
  const barWidth = useMemo(() => {
    if (!xScale || !stockData || stockData.length < 2) return 30;
    const x0 = xScale(new Date(stockData[0].year, 6, 1));
    const x1 = xScale(new Date(stockData[1].year, 6, 1));
    return Math.max(8, (x1 - x0) * 0.55);
  }, [xScale, stockData]);

  // Tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!xScale || !yScale || !salesData || !stockData) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const bisect = d3.bisector<SalesRow, Date>((d) => d.date).left;
      const date = xScale.invert(mouseX);
      const idx = bisect(salesData, date, 1);
      const d0 = salesData[idx - 1];
      const d1 = salesData[idx];
      if (!d0) return;
      const d = d1 && date.getTime() - d0.date.getTime() > d1.date.getTime() - date.getTime() ? d1 : d0;

      const dateStr =
        d.periodType === "quarterly"
          ? `Q${Math.ceil((d.date.getMonth() + 1) / 3)} ${d.date.getFullYear()}`
          : d3.timeFormat("%b %Y")(d.date);

      let content = `${dateStr}\nSales share: ${d.ev.toFixed(1)}%`;
      if (fuelFilter !== "ev") {
        content += `\nBEV: ${d.bev.toFixed(1)}%\nPHEV: ${d.phev.toFixed(1)}%`;
      }

      // Find matching stock bar (nearest year)
      const hoverYear = date.getFullYear();
      const stockMatch = stockData.find((s) => s.year === hoverYear);
      if (stockMatch) {
        content += `\nFleet share (${stockMatch.year}): ${stockMatch.ev.toFixed(2)}%`;
      }

      setTooltip({
        x: xScale(d.date),
        y: yScale(d.ev),
        content,
      });
    },
    [xScale, yScale, salesData, stockData, fuelFilter]
  );

  // Stats
  const stats = useMemo(() => {
    if (!salesData || !stockData) return null;
    const latest = salesData[salesData.length - 1];
    const latestStock = stockData[stockData.length - 1];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const salesDateStr =
      latest.periodType === "quarterly"
        ? `Q${Math.ceil((latest.date.getMonth() + 1) / 3)} ${latest.date.getFullYear()}`
        : `${months[latest.date.getMonth()]} ${latest.date.getFullYear()}`;
    return {
      salesShare: latest.ev.toFixed(1),
      salesDate: salesDateStr,
      stockShare: latestStock.ev.toFixed(2),
      stockYear: latestStock.year,
    };
  }, [salesData, stockData]);

  if (!salesData || !stockData) return <ChartSkeleton height={600} />;

  const isFiltered = fuelFilter !== "ev";
  const evLineGen = makeLineGen("ev");
  const filterLineGen = isFiltered ? makeLineGen(fuelFilter) : null;

  return (
    <section>
      {/* Trend paragraph */}
      <p className="text-text-secondary text-sm leading-relaxed max-w-2xl mx-auto text-center mb-4">
        Canada&apos;s EV sales share peaked at 18.3% in late 2024, driven by strong
        adoption in Quebec and British Columbia. The share has since moderated following
        changes to provincial subsidies, settling around 8–10% through most of 2025.
      </p>

      {/* Toggle — centered */}
      <div className="flex justify-center mb-4">
        <div className="flex gap-1 bg-background-alt rounded-lg p-1">
          {(["ev", "bev", "phev"] as FuelFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFuelFilter(f)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                fuelFilter === f
                  ? "bg-white text-navy shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {f === "ev" ? "All EV" : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Chart — combined line + bars */}
        <div ref={containerRef} className="flex-1 min-w-0">
          <div className="relative">
            <svg
              ref={svgRef}
              width={dims.width}
              height={dims.height}
              className="overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
            >
              <defs>
                <clipPath id="bar-clip">
                  <rect x={margin.left} y={margin.top} width={dims.width - margin.left - margin.right} height={dims.height - margin.top - margin.bottom - 1} />
                </clipPath>
              </defs>
              <g className="grid" />
              <g className="x-grid" />
              <g className="x-axis" />
              <g className="x-labels" />
              <g className="y-axis" />

              {/* Bars — stock share (annual, centered on July 1 of each year) */}
              <g clipPath="url(#bar-clip)">
              {xScale && yScale && stockData.map((d) => {
                const cx = xScale(new Date(d.year, 6, 1));
                const evH = dims.height - margin.bottom - yScale(d.ev);
                const evY = yScale(d.ev);

                if (isFiltered) {
                  const filtVal = d[fuelFilter];
                  const filtH = dims.height - margin.bottom - yScale(filtVal);
                  const filtY = yScale(filtVal);
                  return (
                    <g key={d.year}>
                      {/* Background bar (All EV) */}
                      <rect
                        x={cx - barWidth / 2}
                        y={evY}
                        width={barWidth}
                        height={evH}
                        fill={COLORS.bgBar}
                        stroke={COLORS.bgBarStroke}
                        strokeWidth={1}
                        rx={2}
                      />
                      {/* Filtered bar */}
                      <rect
                        x={cx - barWidth / 2}
                        y={filtY}
                        width={barWidth}
                        height={filtH}
                        fill={COLORS[fuelFilter]}
                        opacity={0.6}
                        stroke={COLORS[fuelFilter]}
                        strokeWidth={1}
                        rx={2}
                      />
                    </g>
                  );
                }

                return (
                  <rect
                    key={d.year}
                    x={cx - barWidth / 2}
                    y={evY}
                    width={barWidth}
                    height={evH}
                    fill={COLORS.barFill}
                    stroke={COLORS.barStroke}
                    strokeWidth={1.5}
                    strokeDasharray="0"
                    rx={2}
                    style={{ strokeLinecap: "butt" }}
                  />
                );
              })}

              </g>
              {/* Lines */}
              {isFiltered ? (
                <>
                  {evLineGen && (
                    <path d={evLineGen(salesData) ?? ""} fill="none" stroke={COLORS.bgLine} strokeWidth={1.5} opacity={0.5} />
                  )}
                  {filterLineGen && (
                    <path d={filterLineGen(salesData) ?? ""} fill="none" stroke={COLORS[fuelFilter]} strokeWidth={2.5} />
                  )}
                </>
              ) : (
                <>
                  {evLineGen && (
                    <path d={evLineGen(salesData) ?? ""} fill="none" stroke={COLORS.ev} strokeWidth={2.5} />
                  )}
                </>
              )}

              {/* Tooltip crosshair */}
              {tooltip && (
                <>
                  <line
                    x1={tooltip.x} y1={margin.top}
                    x2={tooltip.x} y2={dims.height - margin.bottom}
                    stroke="#ccc" strokeWidth={1} strokeDasharray="4 4"
                  />
                  <circle
                    cx={tooltip.x} cy={tooltip.y} r={4}
                    fill={isFiltered ? COLORS[fuelFilter] : COLORS.ev}
                    stroke="#fff" strokeWidth={2}
                  />
                </>
              )}
            </svg>

            {tooltip && (
              <div
                className="absolute pointer-events-none bg-white border border-border rounded-lg px-3 py-2 text-xs shadow-lg z-10"
                style={{ left: tooltip.x + 15, top: tooltip.y - 20, whiteSpace: "pre-line" }}
              >
                {tooltip.content}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-0.5 rounded" style={{ backgroundColor: isFiltered ? COLORS.bgLine : COLORS.ev }} />
              <span>Sales share (line)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm border" style={{ backgroundColor: COLORS.barFill, borderColor: COLORS.barStroke }} />
              <span>Fleet share (bars)</span>
            </div>
          </div>

        </div>

        {/* Right: stat cards */}
        <div className="w-56 shrink-0 flex flex-col gap-4" style={{ marginTop: margin.top, height: dims.height - margin.top - margin.bottom }}>
          <div className="bg-white rounded-xl border border-border-light p-5 flex-1 flex flex-col justify-center">
            <p className="text-3xl font-bold text-navy">{stats?.salesShare}%</p>
            <p className="text-text-muted text-xs mt-2 leading-relaxed">
              Share of EVs of all new cars sold in {stats?.salesDate}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-border-light p-5 flex-1 flex flex-col justify-center">
            <p className="text-3xl font-bold text-navy">{stats?.stockShare}%</p>
            <p className="text-text-muted text-xs mt-2 leading-relaxed">
              Share of EVs of all cars on the road in {stats?.stockYear}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
