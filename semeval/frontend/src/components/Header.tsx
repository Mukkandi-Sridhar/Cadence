import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [{ label: "Home", path: "/" }];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink/10 bg-surface-950/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/rgmcet-logo.jpg"
            alt="RGMCET crest"
            className="h-10 w-10 rounded-lg object-contain shadow-sm shadow-ink/10"
          />
          <div>
            <span className="text-lg font-bold tracking-tight text-ink">RGMCET</span>
            <span className="ml-2 hidden rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-semibold text-brand-700 sm:inline-block">
              Presentation Evaluation
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex md:items-center md:gap-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-brand-600/10 text-brand-700 font-semibold border border-brand-500/30"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Status Indicator & Role Badge */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-ink/10 bg-ink/5 px-3 py-1 text-xs text-ink/80 sm:flex">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span>Ready</span>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 bg-ink/5 text-ink md:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-ink/10 bg-surface-900 px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-4 py-2.5 text-base font-medium transition-colors ${
                    isActive ? "bg-brand-600 text-white font-semibold" : "text-ink/80 hover:bg-ink/5"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
