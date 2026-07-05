import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-slate-500">
          NATIONAL INDUSTRIAL GAS PLANT - OMAN
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Employee Login</h1>
        <LoginForm />
      </section>
    </main>
  );
}

