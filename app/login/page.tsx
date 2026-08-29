import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-bg p-4">
      <div className="grid w-full max-w-4xl animate-fade-in overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card md:grid-cols-2">
        {/* Brand panel */}
        <aside className="hidden flex-col justify-between bg-brand-gradient p-8 text-white md:flex">
          <div className="flex items-center gap-2 text-lg font-black">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">⬡</span>
            NIGP · Oman
          </div>
          <div>
            <h2 className="text-3xl font-black leading-tight">
              Sales &amp; Cylinder
              <br /> Tracking
            </h2>
            <p className="mt-3 text-sm font-semibold text-white/80">
              Real-time cylinder movements, invoicing and reconciliation for every branch — from the
              showroom to the route.
            </p>
          </div>
          <p className="text-xs font-semibold text-white/60">National Industrial Gas Plant — Oman</p>
        </aside>

        {/* Form panel */}
        <section className="p-7 md:p-9">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-600">
            National Industrial Gas Plant — Oman
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Employee Login</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Sign in to access your branch dashboard.
          </p>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
