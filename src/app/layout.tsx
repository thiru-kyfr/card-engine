import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Determination Engine",
  description:
    "A deterministic, explainable credit card recommendation engine. Ranks in rupees, not scores.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="border-b hairline">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="flex items-baseline gap-2.5 no-underline">
              <span style={{ color: "var(--ink)" }} className="font-serif text-lg font-semibold">
                Card Engine
              </span>
              <span
                className="font-mono-num text-[10px] uppercase tracking-[0.12em]"
                style={{ color: "var(--teal)" }}
              >
                v1
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-[13px]">
              <NavLink href="/recommend">Recommend</NavLink>
              <NavLink href="/catalog">Catalog</NavLink>
              <NavLink href="/debug">Debug</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-12 pt-6">
          <p className="text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
            Catalog contains dummy data for engine development. Figures are illustrative
            structures, not any issuer&rsquo;s real terms.
          </p>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 no-underline transition-colors hover:opacity-100"
      style={{ color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}
