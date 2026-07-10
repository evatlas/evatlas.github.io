import type { Metadata } from "next";
import PulseDashboard from "@/components/dashboard/PulseDashboard";

export const metadata: Metadata = {
  title: "EV Atlas — Dashboards",
  description:
    "Canadian Pulse and Global Atlas: interactive dashboards on EV adoption.",
};

export default function PulsePage() {
  return (
    <main className="min-h-screen bg-background-alt">
      <PulseDashboard />
      <footer className="border-t border-border-light bg-background py-8 text-center text-sm text-text-muted">
        <p>
          EV Atlas — data from Statistics Canada, NRCan &amp; IEA.{" "}
          <a
            href="https://github.com/evatlas/evatlas.github.io"
            className="text-blue hover:text-blue-bright"
          >
            Source on GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}
