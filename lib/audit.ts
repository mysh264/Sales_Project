import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type AuditClient = {
  auditLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

type AuditContext = {
  tx?: AuditClient;
  ipAddress?: string;
  userAgent?: string;
};

type JsonRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeJson(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Prisma.Decimal) {
    return value.toString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (isPlainObject(value)) {
    const record = value as JsonRecord;
    return Object.fromEntries(Object.entries(record).map(([key, entry]) => [key, normalizeJson(entry)]));
  }

  return value;
}

function isEqual(left: unknown, right: unknown) {
  return JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right));
}

function buildJsonDiff(oldValue: unknown, newValue: unknown): unknown {
  const oldSnapshot = normalizeJson(oldValue);
  const newSnapshot = normalizeJson(newValue);

  if (isEqual(oldSnapshot, newSnapshot)) {
    return null;
  }

  if (isPlainObject(oldSnapshot) && isPlainObject(newSnapshot)) {
    const keys = new Set([...Object.keys(oldSnapshot), ...Object.keys(newSnapshot)]);
    const diff: JsonRecord = {};

    for (const key of keys) {
      const childDiff = buildJsonDiff(oldSnapshot[key], newSnapshot[key]);
      if (childDiff !== null) {
        diff[key] = childDiff;
      }
    }

    return Object.keys(diff).length > 0
      ? diff
      : {
          before: oldSnapshot,
          after: newSnapshot,
        };
  }

  return {
    before: oldSnapshot,
    after: newSnapshot,
  };
}

async function resolveContext(context?: AuditContext) {
  if (context?.ipAddress !== undefined || context?.userAgent !== undefined) {
    return {
      ipAddress: context?.ipAddress ?? "",
      userAgent: context?.userAgent ?? "",
    };
  }

  try {
    const headerStore = await headers();
    const forwarded = headerStore.get("x-forwarded-for") || "";
    const ipAddress = forwarded.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "";
    return {
      ipAddress,
      userAgent: headerStore.get("user-agent") || "",
    };
  } catch {
    return {
      ipAddress: "",
      userAgent: "",
    };
  }
}

export async function logAction(
  userId: string,
  action: string,
  targetModel: string,
  targetId: string,
  oldValue: unknown,
  newValue: unknown,
  context?: AuditContext,
) {
  const client = (context?.tx ?? prisma) as AuditClient;
  const resolvedContext = await resolveContext(context);
  const normalizedOldValue = normalizeJson(oldValue);
  const normalizedNewValue = normalizeJson(newValue);
  const diff = buildJsonDiff(oldValue, newValue);
  const payloadNewValue =
    diff && normalizedOldValue !== null
      ? {
          after: normalizedNewValue,
          diff,
        }
      : normalizedNewValue;

  await client.auditLog.create({
    data: {
      userId,
      action,
      targetModel,
      targetId,
      oldValue: normalizedOldValue,
      newValue: payloadNewValue,
      ipAddress: resolvedContext.ipAddress,
      userAgent: resolvedContext.userAgent,
    },
  });
}

export function auditSnapshot(value: unknown) {
  return normalizeJson(value);
}
