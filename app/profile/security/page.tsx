import { beginMfaSetup, disableMfa, enableMfa } from "@/app/actions/security";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { RecoveryCodes } from "./RecoveryCodes";
import { PageHeader } from "@/components/ui/PageHeader";
import { readLocale, t } from "@/components/LocaleToggle";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await readLocale();
  const issuer = encodeURIComponent("National Industrial Gas Plant");
  const label = encodeURIComponent(user.email ?? user.fullName);
  const uri = user.mfaSecret
    ? `otpauth://totp/${issuer}:${label}?secret=${user.mfaSecret}&issuer=${issuer}`
    : null;

  return (
    <main className="min-h-screen bg-app-bg p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          eyebrow={t(locale, "security")}
          title={t(locale, "accountSecurity")}
          description={`${t(locale, "mfaStatus")}: ${user.mfaEnabled ? t(locale, "mfaEnabled") : t(locale, "mfaDisabled")}`}
        />
        <section className="ui-card ui-card-pad space-y-4">
          {!user.mfaSecret ? (
            <form action={beginMfaSetup} className="space-y-3">
              <label className="block">
                <span className="ui-label">{t(locale, "currentPassword")}</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder={t(locale, "currentPassword")}
                  className="ui-input"
                />
              </label>
              <button type="submit" className="ui-btn ui-btn-primary w-full">
                {t(locale, "startMfa")}
              </button>
            </form>
          ) : !user.mfaEnabled ? (
            <div className="space-y-4">
              <p className="font-bold text-slate-700">Add this secret to your authenticator application:</p>
              <code className="block break-all rounded-xl bg-slate-100 p-3 text-sm">{user.mfaSecret}</code>
              <code className="block break-all rounded-xl bg-slate-100 p-3 text-xs">{uri}</code>
              <form action={enableMfa} className="flex flex-col gap-2 sm:flex-row">
                <input
                  name="code"
                  required
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  aria-label="Authenticator code"
                  className="ui-input flex-1"
                />
                <button type="submit" className="ui-btn ui-btn-success">
                  {t(locale, "verifyEnable")}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <form action={disableMfa} className="space-y-3">
                <label className="block">
                  <span className="ui-label">{t(locale, "currentPassword")}</span>
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder={t(locale, "currentPassword")}
                    className="ui-input"
                  />
                </label>
                <button type="submit" className="ui-btn ui-btn-danger w-full">
                  {t(locale, "disableMfa")}
                </button>
              </form>
              <RecoveryCodes />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
