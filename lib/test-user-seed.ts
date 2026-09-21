type ExistingTestIdentity = {
  isTestUser: boolean;
} | null;

export function assertSafeTestIdentity(existing: ExistingTestIdentity, email: string): void {
  if (existing && !existing.isTestUser) {
    throw new Error(`Refusing to overwrite a non-test account with canonical test identity: ${email}`);
  }
}

export function requireTestPassword(enabled: boolean, value: string | undefined, name: string): string {
  if (!enabled) return value ?? "";
  if (!value || value.length < 12) {
    throw new Error(`${name} must be set to at least 12 characters when MASTERTESTER_ENABLED=true.`);
  }
  return value;
}
