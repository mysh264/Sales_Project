import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

test("the health endpoint bypasses session middleware so it can probe the database", async () => {
  const response = await middleware(new NextRequest("https://sales.example.test/api/health"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
});
