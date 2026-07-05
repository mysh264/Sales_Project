"use client";

import { useState, useTransition } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError("");
        startTransition(async () => {
          try {
            await login(formData);
            window.location.href = "/";
          } catch {
            setError("Invalid email or password.");
          }
        });
      }}
      className="mt-6 flex flex-col gap-4"
    >
      <label className="block">
        <span className="text-sm font-black uppercase tracking-wide text-slate-700">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 h-14 w-full rounded-lg border-4 border-slate-300 px-4 text-lg font-bold outline-none focus:border-slate-950"
        />
      </label>

      <label className="block">
        <span className="text-sm font-black uppercase tracking-wide text-slate-700">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 h-14 w-full rounded-lg border-4 border-slate-300 px-4 text-lg font-bold outline-none focus:border-slate-950"
        />
      </label>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-base font-black text-red-800">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-16 rounded-lg bg-slate-950 px-5 text-2xl font-black text-white shadow-lg disabled:bg-slate-500"
      >
        {isPending ? "Signing In" : "Login"}
      </button>
    </form>
  );
}

