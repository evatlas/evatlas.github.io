"use client";

import { useState } from "react";
import NationalPulseSection1 from "./NationalPulseSection1";
import NationalPulseSection2 from "./NationalPulseSection2";
import NationalPulseSection3 from "./NationalPulseSection3";
import GlobalSalesTrend from "./GlobalSalesTrend";
import CountryComparison from "./CountryComparison";

const TABS = [
  { id: "national", label: "National Pulse" },
  { id: "global", label: "Global Atlas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PulseDashboard() {
  const [active, setActive] = useState<TabId>("national");

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Tab bar */}
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-white p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                active === tab.id
                  ? "bg-navy text-white"
                  : "text-text-secondary hover:text-navy"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === "national" && (
        <div>
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-3xl font-bold text-navy md:text-4xl">
              The National Pulse
            </h2>
            <p className="mx-auto max-w-xl text-text-secondary">
              Where Canada stands in the EV transition — and which provinces
              are leading the charge.
            </p>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-light bg-white p-6">
              <NationalPulseSection1 />
            </div>
            <div className="rounded-2xl border border-border-light bg-white p-6">
              <NationalPulseSection2 />
            </div>
            <div className="rounded-2xl border border-border-light bg-white p-6">
              <NationalPulseSection3 />
            </div>
          </div>
        </div>
      )}

      {active === "global" && (
        <div>
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-3xl font-bold text-navy md:text-4xl">
              The Global Atlas
            </h2>
            <p className="mx-auto max-w-xl text-text-secondary">
              How the EV transition is unfolding around the world.
            </p>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-border-light bg-white p-6">
              <GlobalSalesTrend />
            </div>
            <div className="rounded-2xl border border-border-light bg-white p-6">
              <CountryComparison />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
