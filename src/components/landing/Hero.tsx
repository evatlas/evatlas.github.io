"use client";

import Link from "next/link";
import HexGlobe from "./HexGlobe";

export default function Hero() {
  return (
    <section className="relative flex h-screen items-center overflow-hidden bg-background">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-6 lg:grid-cols-[5fr_7fr]">
        {/* Left: headline */}
        <div className="animate-fade-slide-in text-center lg:text-left">
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
            <Link
              href="/pulse"
              className="rounded-full bg-navy px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue"
            >
              Explore the data
            </Link>
          </div>
        </div>

        {/* Right: hex globe (drag to rotate) */}
        <div className="relative mx-auto aspect-square w-full max-w-[660px]">
          <HexGlobe />
        </div>
      </div>
    </section>
  );
}
