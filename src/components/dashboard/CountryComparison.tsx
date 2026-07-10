"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import ChartSkeleton from "@/components/ui/ChartSkeleton";

interface SharePoint { year: number; share: number; }
interface GlobalData { countryShare: Record<string, SharePoint[]>; }

const COUNTRY_COLORS: Record<string, string> = {
  Norway: "#051c2c", Sweden: "#0065a4", China: "#c0392b", Germany: "#e67e22",
  France: "#8e44ad", "United Kingdom": "#27ae60", "United States": "#2980b9",
  Canada: "#0085d1", "South Korea": "#16a085", Brazil: "#d35400",
};

export default function CountryComparison() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GlobalData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 420 });
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  useEffect(() => { fetch("/data/iea-global-ev.json").then((r) => r.json()).then(setData); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width - 48), height: Math.min(450, Math.max(300, width * 0.55)) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 20, right: 100, bottom: 40, left: 50 };
  const countries = useMemo(() => data ? Object.keys(data.countryShare) : [], [data]);

  const { xScale, yScale } = useMemo(() => {
    if (!data) return { xScale: null, yScale: null };
    const allShares = Object.values(data.countryShare).flat();
    const maxShare = d3.max(allShares, (d) => d.share) ?? 90;
    return {
      xScale: d3.scaleLinear().domain([2015, 2024]).range([margin.left, dimensions.width - margin.right]),
      yScale: d3.scaleLinear().domain([0, Math.min(100, maxShare * 1.1)]).range([dimensions.height - margin.bottom, margin.top]),
    };
  }, [data, dimensions, margin]);

  useEffect(() => {
    if (!svgRef.current || !xScale || !yScale) return;
    const svg = d3.select(svgRef.current);

    svg.select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0,${dimensions.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(10).tickFormat((d) => String(d)))
      .call((g) => { g.selectAll("text").attr("fill", "#999").attr("font-size", "11px"); g.selectAll("line").attr("stroke", "#e0e0e0"); g.select(".domain").attr("stroke", "#e0e0e0"); });

    svg.select<SVGGElement>(".y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${d}%`))
      .call((g) => { g.selectAll("text").attr("fill", "#999").attr("font-size", "11px"); g.selectAll("line").attr("stroke", "#e0e0e0"); g.select(".domain").attr("stroke", "#e0e0e0"); });

    svg.select<SVGGElement>(".grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-(dimensions.width - margin.left - margin.right)).tickFormat(() => ""))
      .call((g) => { g.selectAll("line").attr("stroke", "#f5f5f5"); g.select(".domain").remove(); });
  }, [xScale, yScale, dimensions, margin]);

  const lineGenerator = useCallback((points: SharePoint[]) => {
    if (!xScale || !yScale) return "";
    return d3.line<SharePoint>().x((d) => xScale(d.year)).y((d) => yScale(d.share)).curve(d3.curveMonotoneX)(points) ?? "";
  }, [xScale, yScale]);

  if (!data) return <ChartSkeleton height={480} />;

  return (
    <div ref={containerRef} className="bg-white rounded-xl border border-border-light p-6">
      <h3 className="text-xl font-bold text-navy mb-1">EV Market Share by Country</h3>
      <p className="text-text-muted text-sm mb-5">Electric vehicle share of new car sales, 2015–2024</p>

      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="overflow-visible">
        <g className="grid" /><g className="x-axis" /><g className="y-axis" />
        {countries.map((country) => {
          const points = data.countryShare[country];
          const isHovered = hoveredCountry === country;
          const isDimmed = hoveredCountry !== null && !isHovered;
          const lastPoint = points[points.length - 1];
          return (
            <g key={country} onMouseEnter={() => setHoveredCountry(country)} onMouseLeave={() => setHoveredCountry(null)} style={{ cursor: "pointer" }}>
              <path d={lineGenerator(points)} fill="none" stroke={COUNTRY_COLORS[country] ?? "#999"} strokeWidth={isHovered ? 3 : 1.8} opacity={isDimmed ? 0.15 : 1} style={{ transition: "opacity 0.2s, stroke-width 0.2s" }} />
              {xScale && yScale && lastPoint && (
                <text x={xScale(lastPoint.year) + 8} y={yScale(lastPoint.share)} fill={COUNTRY_COLORS[country] ?? "#999"} fontSize="10" dominantBaseline="central" opacity={isDimmed ? 0.15 : 1} style={{ transition: "opacity 0.2s" }}>
                  {country}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-text-muted text-[10px] mt-4">Source: IEA Global EV Data Explorer (placeholder data)</p>
    </div>
  );
}
