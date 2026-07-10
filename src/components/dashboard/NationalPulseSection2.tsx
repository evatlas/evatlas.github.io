"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import ChartSkeleton from "@/components/ui/ChartSkeleton";

type ViewMode = "adoption" | "share";

interface ProvinceYear {
  date: string;
  values: Record<string, number>;
}

interface YearValue {
  year: string;
  value: number;
}

const PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
};

const TERRITORY_NAMES = new Set([
  "Nunavut",
  "Northwest Territories",
  "Yukon Territory",
]);

// Atlantic provinces get label offsets to avoid overlap
const LABEL_OFFSETS: Record<string, [number, number]> = {
  NB: [0, 20],
  NS: [10, 35],
  PE: [30, 10],
  NL: [0, 0],
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(PROVINCE_NAMES).map(([code, name]) => [name, code])
);

const PROVINCES = Object.keys(PROVINCE_NAMES);

function parseCSV(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .trim()
    .split("\n")
    .map((line) => line.split(","));
}

export default function NationalPulseSection2() {
  const lineContainerRef = useRef<HTMLDivElement>(null);
  const lineSvgRef = useRef<SVGSVGElement>(null);

  const [adoptionData, setAdoptionData] = useState<ProvinceYear[] | null>(null);
  const [shareData, setShareData] = useState<ProvinceYear[] | null>(null);
  const [canadaAdoptionData, setCanadaAdoptionData] = useState<YearValue[] | null>(null);
  const [allSalesShareData, setAllSalesShareData] = useState<ProvinceYear[] | null>(null);
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("adoption");
  const [yearIdx, setYearIdx] = useState(0);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [lineDims, setLineDims] = useState({ width: 0, height: 280 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    primaryLabel: string;
    primaryVal: string;
    secondaryLabel: string;
    secondaryVal: string;
    year: string;
  } | null>(null);

  // Fetch data
  useEffect(() => {
    fetch("/data/section2_prov_ev_sales_annual.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const header = rows[0];
        const provCols = header.slice(1);
        const data = rows.slice(1).map((r) => ({
          date: r[0],
          values: Object.fromEntries(
            provCols.map((col, i) => [col, r[i + 1] === "" ? NaN : +r[i + 1]])
          ),
        }));
        setAdoptionData(data);
        setYearIdx(data.length - 2);
      });

    fetch("/data/section2_prov_ev_provincesales.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const header = rows[0];
        const provCols = header.slice(1);
        const data = rows.slice(1).map((r) => ({
          date: r[0],
          values: Object.fromEntries(
            provCols.map((col, i) => [col, r[i + 1] === "" ? NaN : +r[i + 1]])
          ),
        }));
        setShareData(data);
      });

    fetch("/data/section2_canada_ev_sales_annual.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const data = rows.slice(1).map((r) => ({
          year: r[0],
          value: r[1] === "" ? NaN : +r[1],
        }));
        setCanadaAdoptionData(data);
      });

    fetch("/data/section2_prov_all_sales_share.csv")
      .then((r) => r.text())
      .then((text) => {
        const rows = parseCSV(text);
        const header = rows[0];
        const provCols = header.slice(1);
        const data = rows.slice(1).map((r) => ({
          date: r[0],
          values: Object.fromEntries(
            provCols.map((col, i) => [col, r[i + 1] === "" ? NaN : +r[i + 1]])
          ),
        }));
        setAllSalesShareData(data);
      });

    fetch("/data/canada-provinces.geojson")
      .then((r) => r.json())
      .then((data) => setGeoData(data));
  }, []);

  // Measure the line-chart container.
  // Depends on the data: until it loads we render <ChartSkeleton/> and the
  // container ref is null, so this must re-run once the real layout mounts.
  // Measure synchronously first — ResizeObserver's initial delivery waits for
  // a render frame, which would leave width at 0 (chart hidden) until then.
  useEffect(() => {
    const el = lineContainerRef.current;
    if (!el) return;
    const apply = (w: number, h: number) =>
      setLineDims({
        width: Math.max(0, Math.floor(w)),
        height: Math.min(320, Math.max(240, Math.floor(h))),
      });
    const rect = el.getBoundingClientRect();
    apply(rect.width, rect.height);
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      apply(r.width, r.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [adoptionData, shareData, geoData]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying || !adoptionData) return;
    const timer = setInterval(() => {
      setYearIdx((prev) => {
        if (prev >= (adoptionData?.length ?? 1) - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
    return () => clearInterval(timer);
  }, [isPlaying, adoptionData]);

  const currentData = useMemo(() => {
    const source = viewMode === "adoption" ? adoptionData : shareData;
    if (!source || yearIdx >= source.length) return null;
    return source[yearIdx];
  }, [adoptionData, shareData, viewMode, yearIdx]);

  const years = useMemo(() => {
    return adoptionData?.map((d) => d.date) ?? [];
  }, [adoptionData]);

  // Stable color scale max
  const colorScaleMax = useMemo(() => {
    const source = viewMode === "adoption" ? adoptionData : shareData;
    if (!source) return 100;
    let globalMax = 0;
    for (const row of source) {
      for (const p of PROVINCES) {
        const v = row.values[p];
        if (!isNaN(v) && v > globalMax) globalMax = v;
      }
    }
    return Math.min(100, Math.ceil(globalMax / 10) * 10);
  }, [adoptionData, shareData, viewMode]);

  const colorScale = useMemo(() => {
    return d3.scaleSequential(d3.interpolateBlues).domain([0, colorScaleMax]);
  }, [colorScaleMax]);

  // Primary line
  const primaryLineData = useMemo(() => {
    const source = viewMode === "adoption" ? adoptionData : shareData;
    if (!source || !selectedProvince) return [];
    return source
      .map((d) => ({ year: d.date, value: d.values[selectedProvince] }))
      .filter((d) => !isNaN(d.value));
  }, [adoptionData, shareData, viewMode, selectedProvince]);

  // Secondary (grey) line
  const secondaryLineData = useMemo(() => {
    if (viewMode === "adoption") {
      if (!canadaAdoptionData) return [];
      return canadaAdoptionData.filter((d) => !isNaN(d.value));
    } else {
      if (!allSalesShareData || !selectedProvince) return [];
      return allSalesShareData
        .map((d) => ({ year: d.date, value: d.values[selectedProvince] }))
        .filter((d) => !isNaN(d.value));
    }
  }, [viewMode, canadaAdoptionData, allSalesShareData, selectedProvince]);

  // Combined max for y-axis
  const lineYMax = useMemo(() => {
    const allVals = [...primaryLineData, ...secondaryLineData].map((d) => d.value);
    const max = d3.max(allVals) ?? 10;
    return max * 1.15;
  }, [primaryLineData, secondaryLineData]);

  // All years for x domain
  const lineXDomain = useMemo(() => {
    const yearSet = new Set([
      ...primaryLineData.map((d) => d.year),
      ...secondaryLineData.map((d) => d.year),
    ]);
    return Array.from(yearSet).sort();
  }, [primaryLineData, secondaryLineData]);

  const lineMargin = { top: 20, right: 20, bottom: 32, left: 44 };

  // D3 axes
  useEffect(() => {
    if (!lineSvgRef.current || lineXDomain.length === 0 || !selectedProvince) return;
    const svg = d3.select(lineSvgRef.current);
    svg.selectAll(".axis").remove();

    const w = lineDims.width;
    const h = lineDims.height;

    const xScale = d3
      .scalePoint()
      .domain(lineXDomain)
      .range([lineMargin.left, w - lineMargin.right]);

    const yScale = d3
      .scaleLinear()
      .domain([0, lineYMax])
      .range([h - lineMargin.bottom, lineMargin.top]);

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${h - lineMargin.bottom})`)
      .call(d3.axisBottom(xScale).tickSize(0).tickPadding(8))
      .call((g) => g.select(".domain").attr("stroke", "#e0e0e0"))
      .selectAll("text")
      .attr("fill", "#888")
      .attr("font-size", "11px");

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(${lineMargin.left},0)`)
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-(w - lineMargin.left - lineMargin.right))
          .tickFormat((d) => `${d}%`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll(".tick line").attr("stroke", "#f0f0f0").attr("stroke-dasharray", "2,2")
      )
      .selectAll("text")
      .attr("fill", "#888")
      .attr("font-size", "11px");
  }, [lineXDomain, lineYMax, lineDims, lineMargin.top, lineMargin.right, lineMargin.bottom, lineMargin.left, selectedProvince]);

  // Scales for React SVG
  const lineScales = useMemo(() => {
    if (lineXDomain.length === 0) return null;
    const w = lineDims.width;
    const h = lineDims.height;

    return {
      xScale: d3
        .scalePoint()
        .domain(lineXDomain)
        .range([lineMargin.left, w - lineMargin.right]),
      yScale: d3
        .scaleLinear()
        .domain([0, lineYMax])
        .range([h - lineMargin.bottom, lineMargin.top]),
    };
  }, [lineXDomain, lineYMax, lineDims, lineMargin.top, lineMargin.right, lineMargin.bottom, lineMargin.left]);

  const makeLinePath = useCallback(
    (data: YearValue[]) => {
      if (!lineScales || data.length === 0) return "";
      const line = d3
        .line<YearValue>()
        .x((d) => lineScales.xScale(d.year) ?? 0)
        .y((d) => lineScales.yScale(d.value))
        .curve(d3.curveMonotoneX);
      return line(data) ?? "";
    },
    [lineScales]
  );

  const primaryPath = useMemo(() => makeLinePath(primaryLineData), [makeLinePath, primaryLineData]);
  const secondaryPath = useMemo(() => makeLinePath(secondaryLineData), [makeLinePath, secondaryLineData]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setYearIdx(+e.target.value);
      setIsPlaying(false);
    },
    []
  );

  const handleProvinceClick = useCallback((code: string) => {
    setSelectedProvince(code);
  }, []);

  // Tooltip mouse handler
  const handleChartMouse = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!lineScales || lineXDomain.length === 0) return;
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Find nearest year
      let closestYear = lineXDomain[0];
      let closestDist = Infinity;
      for (const yr of lineXDomain) {
        const x = lineScales.xScale(yr) ?? 0;
        const dist = Math.abs(x - mouseX);
        if (dist < closestDist) {
          closestDist = dist;
          closestYear = yr;
        }
      }

      const primaryPt = primaryLineData.find((d) => d.year === closestYear);
      const secondaryPt = secondaryLineData.find((d) => d.year === closestYear);

      const x = lineScales.xScale(closestYear) ?? 0;
      const y = primaryPt ? lineScales.yScale(primaryPt.value) : lineDims.height / 2;

      setTooltip({
        x,
        y,
        year: closestYear,
        primaryLabel: viewMode === "adoption" ? "Adoption rate" : "National EV share",
        primaryVal: primaryPt ? `${primaryPt.value.toFixed(1)}%` : "N/A",
        secondaryLabel: viewMode === "adoption" ? "Canada total" : "All vehicle share",
        secondaryVal: secondaryPt ? `${secondaryPt.value.toFixed(1)}%` : "N/A",
      });
    },
    [lineScales, lineXDomain, primaryLineData, secondaryLineData, viewMode, lineDims.height]
  );

  if (!adoptionData || !shareData || !geoData) return <ChartSkeleton height={500} />;

  const unitLabel = viewMode === "adoption" ? "% of new sales" : "% of national EV sales";
  const secondaryLabel = viewMode === "adoption" ? "Canada total" : "% of all vehicle sales";

  // Map projection
  const projection = d3.geoConicConformal()
    .rotate([95, 0])
    .center([0, 62])
    .parallels([49, 77])
    .scale(700)
    .translate([300, 260]);
  const pathGen = d3.geoPath().projection(projection);

  const legendHeight = 180;

  return (
    <section>
      <div className="flex flex-col items-center mb-4">
        <h2 className="text-2xl font-bold text-navy">Provincial Breakdown</h2>
        <p className="text-text-secondary text-sm mt-1">
          How provinces compare in EV adoption
        </p>
        <div className="flex gap-1 bg-background-alt rounded-lg p-1 mt-3">
          {(
            [
              { key: "adoption", label: "Adoption Rate" },
              { key: "share", label: "National Share" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
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

      <div className="flex gap-6 items-start">
        {/* Left: vertical color legend + Canada map */}
        <div className="flex-1 min-w-0 flex items-center">
          <div className="flex flex-col items-center mr-3 shrink-0">
            <span className="text-[10px] text-text-muted mb-1">{colorScaleMax}%</span>
            <div
              className="w-4"
              style={{
                height: legendHeight,
                background: `linear-gradient(to bottom, ${colorScale(colorScaleMax)}, ${colorScale(colorScaleMax / 2)}, ${colorScale(0)})`,
              }}
            />
            <span className="text-[10px] text-text-muted mt-1">0%</span>
          </div>

          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 600 500" className="w-full" style={{ maxHeight: 380 }}>
              {/* Territories (background, non-interactive) */}
              {geoData.features
                .filter((f) => TERRITORY_NAMES.has(f.properties?.name ?? ""))
                .map((feature) => {
                  const name = feature.properties?.name ?? "";
                  const d = pathGen(feature) ?? "";
                  return (
                    <path
                      key={name}
                      d={d}
                      fill="#f0f0f0"
                      stroke="#d0d0d0"
                      strokeWidth={0.5}
                    />
                  );
                })}
              {/* Provinces */}
              {geoData.features.map((feature) => {
                const name = feature.properties?.name ?? "";
                if (TERRITORY_NAMES.has(name)) return null;
                const code = NAME_TO_CODE[name];
                if (!code) return null;
                const d = pathGen(feature) ?? "";
                const val = currentData?.values[code];
                const isNA = val === undefined || isNaN(val);
                const fill = isNA ? "#f0f0f0" : colorScale(val);
                const isSelected = code === selectedProvince;
                const isHovered = code === hoveredProvince;

                const centroid = pathGen.centroid(feature);
                const offset = LABEL_OFFSETS[code] ?? [0, 0];
                const lx = centroid[0] + offset[0];
                const ly = centroid[1] + offset[1];
                const hasOffset = offset[0] !== 0 || offset[1] !== 0;

                return (
                  <g
                    key={code}
                    onClick={() => handleProvinceClick(code)}
                    onMouseEnter={() => setHoveredProvince(code)}
                    onMouseLeave={() => setHoveredProvince(null)}
                    className="cursor-pointer"
                  >
                    <path
                      d={d}
                      fill={fill}
                      stroke={isSelected ? "#051c2c" : isHovered ? "#0065a4" : "#b0b8c0"}
                      strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0.5}
                      className="transition-colors duration-200"
                    />
                    {centroid[0] && centroid[1] && (
                      <>
                        {/* Leader line for offset labels */}
                        {hasOffset && (
                          <line
                            x1={centroid[0]}
                            y1={centroid[1]}
                            x2={lx}
                            y2={ly - 4}
                            stroke="#999"
                            strokeWidth={0.5}
                            pointerEvents="none"
                          />
                        )}
                        <text
                          x={lx}
                          y={ly - 6}
                          textAnchor="middle"
                          fontSize={11}
                          fontWeight={isSelected ? 700 : 600}
                          fill="#333"
                          pointerEvents="none"
                        >
                          {code}
                        </text>
                        <text
                          x={lx}
                          y={ly + 8}
                          textAnchor="middle"
                          fontSize={10}
                          fill="#666"
                          pointerEvents="none"
                        >
                          {isNA ? "N/A" : `${val.toFixed(1)}%`}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right: Line chart or placeholder */}
        <div
          ref={lineContainerRef}
          className="w-full max-w-[380px] min-w-0 shrink basis-[380px] flex flex-col"
        >
          {selectedProvince ? (
            <>
              <h3 className="text-sm font-semibold text-navy mb-2">
                {PROVINCE_NAMES[selectedProvince]}
              </h3>
              <div className="flex-1 min-h-0 relative" style={{ minHeight: 240 }}>
                {lineXDomain.length > 0 && lineScales && lineDims.width > 0 ? (
                  <>
                    <svg
                      ref={lineSvgRef}
                      width={lineDims.width}
                      height={lineDims.height}
                      style={{ display: "block", maxWidth: "100%" }}
                      onMouseMove={handleChartMouse}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Secondary line (grey) */}
                      {secondaryLineData.length > 0 && (
                        <path
                          d={secondaryPath}
                          fill="none"
                          stroke="#ccc"
                          strokeWidth={1.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      )}
                      {/* Primary line (blue) */}
                      {primaryLineData.length > 0 && (
                        <path
                          d={primaryPath}
                          fill="none"
                          stroke="#0065a4"
                          strokeWidth={2.5}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      )}
                      {/* Secondary dots */}
                      {secondaryLineData.map((d) => {
                        const cx = lineScales.xScale(d.year) ?? 0;
                        const cy = lineScales.yScale(d.value);
                        return (
                          <circle
                            key={`sec-${d.year}`}
                            cx={cx}
                            cy={cy}
                            r={2}
                            fill="#ccc"
                            pointerEvents="none"
                          />
                        );
                      })}
                      {/* Primary dots */}
                      {primaryLineData.map((d) => {
                        const cx = lineScales.xScale(d.year) ?? 0;
                        const cy = lineScales.yScale(d.value);
                        const isCurrent = d.year === years[yearIdx];
                        return (
                          <circle
                            key={d.year}
                            cx={cx}
                            cy={cy}
                            r={isCurrent ? 5 : 3}
                            fill={isCurrent ? "#051c2c" : "#0065a4"}
                            stroke="#fff"
                            strokeWidth={isCurrent ? 2 : 1}
                            pointerEvents="none"
                          />
                        );
                      })}
                      {/* Tooltip crosshair */}
                      {tooltip && (
                        <>
                          <line
                            x1={tooltip.x}
                            y1={lineMargin.top}
                            x2={tooltip.x}
                            y2={lineDims.height - lineMargin.bottom}
                            stroke="#ccc"
                            strokeWidth={1}
                            strokeDasharray="3,3"
                            pointerEvents="none"
                          />
                          <circle
                            cx={tooltip.x}
                            cy={tooltip.y}
                            r={4}
                            fill="#0065a4"
                            stroke="#fff"
                            strokeWidth={2}
                            pointerEvents="none"
                          />
                        </>
                      )}
                      {/* Transparent overlay for mouse capture */}
                      <rect
                        x={lineMargin.left}
                        y={lineMargin.top}
                        width={lineDims.width - lineMargin.left - lineMargin.right}
                        height={lineDims.height - lineMargin.top - lineMargin.bottom}
                        fill="transparent"
                      />
                    </svg>
                    {/* Tooltip box */}
                    {tooltip && (
                      <div
                        className="absolute pointer-events-none bg-white border border-border-light rounded-lg shadow-md px-3 py-2 text-xs"
                        style={{
                          left: tooltip.x + 15,
                          top: tooltip.y - 30,
                        }}
                      >
                        <p className="font-semibold text-navy mb-1">{tooltip.year}</p>
                        <p>
                          <span className="inline-block w-2 h-2 rounded-full bg-[#0065a4] mr-1.5" />
                          {tooltip.primaryLabel}: <span className="font-semibold">{tooltip.primaryVal}</span>
                        </p>
                        <p className="text-text-muted">
                          <span className="inline-block w-2 h-2 rounded-full bg-[#ccc] mr-1.5" />
                          {tooltip.secondaryLabel}: <span className="font-semibold">{tooltip.secondaryVal}</span>
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-text-muted text-sm">
                    No data available for {PROVINCE_NAMES[selectedProvince]}
                  </div>
                )}
              </div>
              {/* Legend — matches Section 1 style */}
              <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-0.5 rounded" style={{ backgroundColor: "#0065a4" }} />
                  <span>{unitLabel}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-0.5 rounded" style={{ backgroundColor: "#ccc" }} />
                  <span>{secondaryLabel}</span>
                </div>
              </div>
            </>
          ) : (
            /* Empty state — no province selected yet */
            <div className="flex-1 flex flex-col items-center justify-center" style={{ minHeight: 280 }}>
              <p className="text-lg text-text-muted font-medium text-center leading-relaxed">
                Select a province<br />on the map
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline slider */}
      <div className="mt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (yearIdx >= years.length - 1) setYearIdx(0);
              setIsPlaying(!isPlaying);
            }}
            className="w-7 h-7 rounded-sm bg-navy text-white flex items-center justify-center hover:bg-navy-light transition-colors text-xs"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={years.length - 1}
              value={yearIdx}
              onChange={handleSliderChange}
              className="w-full accent-navy h-1"
              style={{ height: 4 }}
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              {years.map((y, i) => (
                <span
                  key={y}
                  className={`cursor-pointer ${i === yearIdx ? "text-navy font-bold" : ""}`}
                  onClick={() => {
                    setYearIdx(i);
                    setIsPlaying(false);
                  }}
                >
                  {y}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
