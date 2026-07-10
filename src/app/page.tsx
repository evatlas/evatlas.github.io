import Hero from "@/components/landing/Hero";
import PulseDashboard from "@/components/dashboard/PulseDashboard";

export default function Home() {
  return (
    <main>
      <Hero />
      <section id="pulse" className="min-h-screen bg-background-alt">
        <PulseDashboard />
      </section>
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
