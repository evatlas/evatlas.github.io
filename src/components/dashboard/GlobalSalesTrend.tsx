"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import ChartSkeleton from "@/components/ui/ChartSkeleton";

interface SalesPoint { year: number; bev: number; phev: number; total: number; }
interface GlobalData {
  globalSales: SalesPoint[];
  summaryStats: { globalEVStock2024: number; globalShare2024: number; yoyGrowth: number; };
}

export default function GlobalSalesTrend() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GlobalData | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 400 });

  useEffect(() => { fetch("/data/iea-global-ev.json").then((r) => r.json()).then(setData); }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(300, width - 48), height: Math.min(420, Math.max(280, width * 0.5)) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const margin = { top: 20, right: 20, bottom: 40, left: 65 };

  const { xScale, yScale } = useMemo(() => {
    if (!data) return { xScale: null, yScale: null };
    const maxSales = d3.max(data.globalSales, (d) => d.total) ?? 17000000;
    return {
      xScale: d3.scaleLinear().domain([2010, 2024]).range([margin.left, dimensions.width - margin.right]),
      yScale: d3.scaleLinear().domain([0, maxSales * 1.1]).range([dimensions.height - margin.bottom, margin.top]),
    };
  }, [data, dimensions, margin]);

  useEffect(() => {
    if (!svgRef.current || !xScale || !yScale) return;
    const svg = d3.select(svgRef.current);

    svg.select<SVGGElement>(".x-axis")
      .attr("transform", `translate(0,${dimensions.height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat((d) => String(d)))
      .call((g) => { g.selectAll("text").attr("fill", "#999").attr("font-size", "11px"); g.selectAll("line").attr("stroke", "#e0e0e0"); g.select(".domain").attr("stroke", "#e0e0e0"); });

    svg.select<SVGGElement>(".y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${(+d / 1000000).toFixed(0)}M`))
      .call((g) => { g.selectAll("text").attr("fill", "#999").attr("font-size", "11px"); g.selectAll("line").attr("stroke", "#e0e0e0"); g.select(".domain").attr("stroke", "#e0e0e0"); });

    svg.select<SVGGElement>(".grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-(dimensions.width - margin.left - margin.right)).tickFormat(() => ""))
      .call((g) => { g.selectAll("line").attr("stroke", "#f5f5f5"); g.select(".domain").remove(); });
  }, [xScale, yScale, dimensions, margin]);

  if (!data) return <ChartSkeleton />;

  const bevArea = d3.area<SalesPoint>().x((d) => xScale!(d.year)).y0(dimensions.height - margin.bottom).y1((d) => yScale!(d.bev)).curve(d3.curveMonotoneX);
  const totalArea = d3.area<SalesPoint>().x((d) => xScale!(d.year)).y0((d) => yScale!(d.bev)).y1((d) => yScale!(d.total)).curve(d3.curveMonotoneX);
  const totalLine = d3.line<SalesPoint>().x((d) => xScale!(d.year)).y((d) => yScale!(d.total)).curve(d3.curveMonotoneX);

  const formatNum = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(0)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

  return (
    <div ref={containerRef} className="bg-white rounded-xl border border-border-light p-6">
      <h3 className="text-xl font-bold text-navy mb-1">Global EV Sales</h3>
      <p className="text-text-muted text-sm mb-5">Annual worldwide electric vehicle sales (BEV + PHEV), 2010–2024</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { value: formatNum(data.summaryStats.globalEVStock2024), label: "EVs on road" },
          { value: `${data.summaryStats.globalShare2024}%`, label: "Market share" },
          { value: `+${data.summaryStats.yoyGrowth}%`, label: "YoY growth" },
        ].map((stat) => (
          <div key={stat.label} className="bg-background-alt rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-navy">{stat.value}</div>
            <div className="text-text-muted text-xs mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="overflow-visible">
        <g className="grid" /><g className="x-axis" /><g className="y-axis" />
        <path d={bevArea(data.globalSales) ?? ""} fill="#0085d1" opacity={0.2} />
        <path d={totalArea(data.globalSales) ?? ""} fill="#051c2c" opacity={0.1} />
        <path d={totalLine(data.globalSales) ?? ""} fill="none" stroke="#051c2c" strokeWidth={2} />
      </svg>

      <div className="flex items-center gap-6 mt-4 text-xs text-text-muted">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#0085d1]/20" /><span>BEV</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#051c2c]/10" /><span>PHEV</span></div>
      </div>
      <p className="text-text-muted text-[10px] mt-4">Source: IEA Global EV Data Explorer (placeholder data)</p>
    </div>
  );
}
