// Pure gate used by the master-tester impersonation server action.
// Lives in lib/ so it is testable in isolation (no DB, no Next.js, no
// cookies) and so the action and the tests cannot drift apart: both
// import the SAME function.
//
// Rule: an impersonation is allowed iff
//   1. The actor currently holds the Testers_Impersonate permission
//      (i.e. the master-tester role, since that's the only role that
//      grants it by default).
//   2. The target user is marked isTestUser=true. This is the single
//      hard gate that protects real human users from impersonation
//      regardless of who is asking. The mark is set only by the
//      seed for the 11 canonical test users + the tester itself.
//   3. The target is active (isActive=true). Inactive users are not
//      reachable through normal login either, so impersonating one
//      would be a privilege-escalation footgun.
export type ImpersonationGateInput = {
  actorHasImpersonate: boolean;
  targetIsTestUser: boolean;
  targetIsActive: boolean;
};

export function canImpersonate(input: ImpersonationGateInput): boolean {
  return Boolean(
    input.actorHasImpersonate &&
    input.targetIsTestUser &&
    input.targetIsActive,
  );
}
