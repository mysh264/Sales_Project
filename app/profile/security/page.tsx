import { beginMfaSetup, disableMfa, enableMfa } from "@/app/actions/security";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { RecoveryCodes } from "./RecoveryCodes";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const issuer = encodeURIComponent("National Industrial Gas Plant");
  const label = encodeURIComponent(user.email ?? user.fullName);
  const uri = user.mfaSecret
    ? `otpauth://totp/${issuer}:${label}?secret=${user.mfaSecret}&issuer=${issuer}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5 rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black">Account Security</h1>
        <p className="font-bold text-slate-600">Two-factor authentication status: {user.mfaEnabled ? "Enabled" : "Disabled"}</p>
        {!user.mfaSecret ? (
          <form action={beginMfaSetup}><button className="rounded bg-slate-950 px-4 py-3 font-black text-white">Start Authenticator Setup</button></form>
        ) : !user.mfaEnabled ? (
          <div className="space-y-4">
            <p className="font-bold">Add this secret to your authenticator application:</p>
            <code className="block break-all rounded bg-slate-100 p-3">{user.mfaSecret}</code>
            <code className="block break-all rounded bg-slate-100 p-3 text-xs">{uri}</code>
            <form action={enableMfa} className="flex gap-2"><input name="code" required pattern="[0-9]{6}" placeholder="6-digit code" className="h-12 flex-1 rounded border px-3" /><button className="rounded bg-green-700 px-4 font-black text-white">Verify and Enable</button></form>
          </div>
        ) : (
          <div className="space-y-4">
            <form action={disableMfa} className="space-y-3"><input name="password" type="password" required placeholder="Current password" className="h-12 w-full rounded border px-3" /><button className="rounded bg-red-700 px-4 py-3 font-black text-white">Disable MFA</button></form>
            <RecoveryCodes />
          </div>
        )}
      </div>
    </main>
  );
}
