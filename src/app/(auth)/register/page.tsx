"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 flex items-center justify-center" style={{ borderLeft: "3px solid #C9A030" }}>
            <span className="text-foreground font-heading font-bold text-lg pl-2">AI</span>
          </div>
          <span className="font-heading text-sm font-semibold text-foreground tracking-[0.15em] uppercase">
            Akademia AI
          </span>
        </div>

        <div className="bg-card border border-border p-8" style={{ borderRadius: "0" }}>
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(201, 160, 48, 0.1)" }}>
              <svg className="w-6 h-6 text-gold" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h2 className="font-heading text-xl font-bold text-foreground tracking-wide">
              Rejestracja zamknięta
            </h2>
            <p className="text-sm text-foreground/40 mt-3 leading-relaxed font-light">
              Rejestracja wymaga linku zaproszeniowego.
              Skontaktuj się z organizatorem aby otrzymać dostęp.
            </p>
          </div>

          <div className="w-full h-px bg-border my-6" />

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-gold hover:text-gold/80 transition-colors font-medium"
            >
              Masz już konto? Zaloguj się
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
