"use client";

import NetworkBackground from "./NetworkBackground";
import HexGlobe from "./HexGlobe";

export default function Hero() {
  return (
    <section className="relative h-screen overflow-hidden bg-background">
      <NetworkBackground fadeLeftPercent={40} />

      <div className="pointer-events-none relative z-10 mx-auto grid h-full max-w-6xl grid-cols-1 items-center gap-8 px-6 lg:grid-cols-2">
        {/* Left: headline */}
        <div className="pointer-events-auto animate-fade-slide-in text-center lg:text-left">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.35em] text-blue-bright">
            EV Atlas
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-navy sm:text-5xl xl:text-6xl">
            The electric shift,{" "}
            <span className="text-gradient-blue">mapped.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-text-secondary lg:mx-0">
            Interactive dashboards tracking electric vehicle adoption — across
            Canada and around the world.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a
              href="#pulse"
              className="rounded-full bg-navy px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue"
            >
              Explore the data
            </a>
          </div>
        </div>

        {/* Right: hex globe */}
        <div className="pointer-events-auto relative mx-auto aspect-square w-full max-w-[520px]">
          <HexGlobe />
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#pulse"
        aria-label="Scroll to dashboards"
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-text-muted transition-colors hover:text-blue-bright"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-bounce"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </a>
    </section>
  );
}
