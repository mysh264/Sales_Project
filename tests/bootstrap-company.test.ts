import assert from "node:assert/strict";
import test from "node:test";
import { ensureBootstrapCompany } from "../lib/bootstrap-company";

test("ensureBootstrapCompany creates the required company on a fresh database", async () => {
  let created = false;
  const company = await ensureBootstrapCompany({
    company: {
      findFirst: async () => null,
      create: async ({ data }) => {
        created = true;
        return { id: "company-1", ...data };
      },
    },
  });

  assert.equal(created, true);
  assert.equal(company.id, "company-1");
});
