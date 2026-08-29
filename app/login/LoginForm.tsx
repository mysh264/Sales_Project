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
            const role = await login(formData);
            const destination =
              role === "ADMIN"
                ? "/admin"
                : role === "GENERAL_MANAGER"
                  ? "/general-manager"
                  : role === "MANAGER"
                    ? "/manager"
                    : role === "LOADER"
                      ? "/loader"
                      : "/salesman";
            window.location.assign(destination);
          } catch {
            setError("Invalid email or password.");
          }
        });
      }}
      className="mt-6 flex flex-col gap-4"
    >
      <label className="block">
        <span className="ui-label">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="ui-input h-14 text-base"
        />
      </label>
      <label className="block">
        <span className="ui-label">Authenticator Code (if enabled)</span>
        <input name="mfaCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" className="ui-input h-14 text-base" />
      </label>

      <label className="block">
        <span className="ui-label">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="ui-input h-14 text-base"
        />
      </label>

      {error ? <p className="ui-badge ui-badge-danger w-full justify-center py-2.5 text-sm">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="ui-btn ui-btn-primary ui-btn-lg mt-1"
      >
        {isPending ? "Signing In" : "Login"}
      </button>
    </form>
  );
}
