"use client";

import Link from "next/link";
import HexGlobe from "./HexGlobe";

export default function Hero() {
  return (
    <section
      className="relative h-screen overflow-hidden"
      style={{ background: "linear-gradient(#041220, #07253c)" }}
    >
      {/* Globe fills the section behind the text */}
      <div className="absolute inset-0">
        <HexGlobe />
      </div>

      {/* Wordmark — top left */}
      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-7">
        <span className="font-mono text-lg font-bold uppercase tracking-[0.22em]">
          <span className="text-[#4db8ff]">EV</span>
          <span className="text-[#f2f8ff]"> Atlas</span>
        </span>
      </div>

      {/* Centered headline over the globe */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#f2f8ff] sm:text-5xl xl:text-6xl">
          The electric shift,{" "}
          <span className="text-[#4db8ff]">mapped.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg text-[#93b1c7]">
          Interactive dashboards tracking electric vehicle adoption — across
          Canada and around the world.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/pulse"
            className="pointer-events-auto inline-block rounded-full border border-[#4db8ff] px-7 py-3 text-sm font-medium text-[#dceeff] transition-colors hover:bg-[#4db8ff]/10"
          >
            Canada EV Pulse
          </Link>
          <Link
            href="/pulse#global"
            className="pointer-events-auto inline-block rounded-full border border-[#4db8ff] px-7 py-3 text-sm font-medium text-[#dceeff] transition-colors hover:bg-[#4db8ff]/10"
          >
            Global Atlas
          </Link>
        </div>
      </div>
    </section>
  );
}
