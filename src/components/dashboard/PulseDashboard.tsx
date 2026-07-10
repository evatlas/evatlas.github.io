"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NationalPulseSection1 from "./NationalPulseSection1";
import NationalPulseSection2 from "./NationalPulseSection2";
import NationalPulseSection3 from "./NationalPulseSection3";
import GlobalSalesTrend from "./GlobalSalesTrend";
import CountryComparison from "./CountryComparison";

const TABS = [
  { id: "canadian", label: "Canada EV Pulse" },
  { id: "global", label: "Global Atlas" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PulseDashboard() {
  const [active, setActive] = useState<TabId>("canadian");

  // Deep link: /pulse#global opens the Global Atlas tab
  useEffect(() => {
    if (window.location.hash === "#global") setActive("global");
  }, []);

  const selectTab = (id: TabId) => {
    setActive(id);
    window.history.replaceState(null, "", id === "global" ? "#global" : "#");
  };

  return (
    <div>
      {/* Sticky tab bar */}
      <div className="sticky top-0 z-20 border-b border-border-light bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.3em] text-navy transition-colors hover:text-blue-bright"
          >
            EV Atlas
          </Link>
          <div className="inline-flex rounded-full border border-border bg-white p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                  active === tab.id
                    ? "bg-navy text-white"
                    : "text-text-secondary hover:text-navy"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Spacer balances the brand link so tabs sit centered */}
          <div className="hidden w-24 sm:block" aria-hidden="true" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12">
        {active === "canadian" && (
          <div>
            <div className="mb-6 text-center">
              <h2 className="mb-2 text-3xl font-bold text-navy md:text-4xl">
                The Canadian Pulse
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
    </div>
  );
}
