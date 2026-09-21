import { LocaleToggle } from "@/components/LocaleToggle";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-app-bg">
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
        <LocaleToggle nextPath="/login" />
      </div>

      <main className="flex min-h-screen items-center justify-center p-4 pb-safe">
        <div className="grid w-full max-w-4xl animate-fade-in overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card md:grid-cols-2">
          <aside className="hidden flex-col justify-between bg-brand-gradient p-8 text-white md:flex">
            <div className="flex items-center gap-2 text-lg font-black">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">⬡</span>
              NIGP · Oman
            </div>
            <div>
              <h2 className="font-display text-3xl font-black leading-tight">
                Sales &amp; Cylinder
                <br /> Tracking
              </h2>
              <p className="mt-3 text-sm font-semibold text-white/85">
                Field invoicing, cylinder handoffs, and branch reconciliation — built for routes across Oman.
              </p>
            </div>
            <p className="text-xs font-semibold text-white/65">National Industrial Gas Plant — Oman</p>
          </aside>

          <section className="p-6 sm:p-8 md:p-9">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-700">National Industrial Gas Plant</p>
            <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-slate-950">Employee Login</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Sign in to your branch workspace.</p>
            <LoginForm />
          </section>
        </div>
      </main>
    </div>
  );
}
