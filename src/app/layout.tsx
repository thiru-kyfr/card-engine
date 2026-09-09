import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

/** `viewportFit: "cover"` is what makes env(safe-area-inset-*) resolve to
 * anything but 0 — without it the sticky action bar sits under the home
 * indicator on notched phones. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='7' width='22' height='15' rx='3.5' fill='%238048F0'/%3E%3Crect x='7' y='11' width='22' height='15' rx='3.5' fill='%230A0410'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Card Engine — Find the card that actually pays you back",
  description:
    "Answer a few questions about how you spend and we'll show you which credit card is worth the most to you, in real rupees — with the full math behind every number.",
  icons: { icon: FAVICON },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning: the embed script in <head> stamps data-embed
  // onto <html> before hydration, which React would otherwise report as a
  // mismatch it explicitly refuses to patch up.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Runs before first paint so the embedded layout never flashes the
            standalone header. Kept as a raw attribute rather than React state
            because it must be settled before hydration. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(new URLSearchParams(location.search).get('embed')==='1'){document.documentElement.setAttribute('data-embed','1')}}catch(e){}",
          }}
        />
      </head>
      <body>
        <header className="sticky top-3 z-50 px-3 sm:top-4 sm:px-6">
          <div
            className="glass mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5"
            style={{ background: "var(--glass-nav)", border: "1px solid var(--line)" }}
          >
            <Link href="/" className="flex shrink-0 items-center gap-2 no-underline">
              <span className="icon-chip h-8 w-8 shrink-0">
                <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
                  <rect x="3" y="7" width="22" height="15" rx="3.5" fill="currentColor" />
                  <rect x="7" y="11" width="22" height="15" rx="3.5" fill="var(--paper)" />
                </svg>
              </span>
              <span
                style={{ color: "var(--ink)" }}
                className="whitespace-nowrap font-serif text-[15px] font-normal sm:text-lg"
              >
                Card Engine
              </span>
            </Link>
            <nav className="flex items-center gap-0.5 text-[12px] sm:gap-1 sm:text-[13px]">
              <NavLink href="/recommend">Find my card</NavLink>
              <NavLink href="/catalog">Compare cards</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-12">
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
      className="whitespace-nowrap rounded-full px-2 py-1.5 no-underline transition-colors hover:opacity-100 sm:px-3"
      style={{ color: "var(--ink-muted)" }}
    >
      {children}
    </Link>
  );
}
