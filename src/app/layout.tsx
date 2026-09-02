import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='7' width='22' height='15' rx='3.5' fill='%230d8f7f'/%3E%3Crect x='7' y='11' width='22' height='15' rx='3.5' fill='%23161c2e'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Card Engine — Find the card that actually pays you back",
  description:
    "Answer a few questions about how you spend and we'll show you which credit card is worth the most to you, in real rupees — with the full math behind every number.",
  icons: { icon: FAVICON },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="border-b hairline">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
                <rect x="3" y="7" width="22" height="15" rx="3.5" fill="var(--teal)" />
                <rect x="7" y="11" width="22" height="15" rx="3.5" fill="var(--ink)" />
              </svg>
              <span style={{ color: "var(--ink)" }} className="font-serif text-lg font-semibold">
                Card Engine
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-[13px]">
              <NavLink href="/recommend">Find my card</NavLink>
              <NavLink href="/catalog">Compare cards</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-12 pt-6">
          <p className="text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
            Card details may change without notice. Always confirm current rates, fees and
            benefits with the issuer before applying.
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
