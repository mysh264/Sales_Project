import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);

export function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"));
}

export async function storePrivateUpload(file: FormDataEntryValue | null, folder: string) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Attachment must not exceed 5 MB.");
  }

  const extension = ALLOWED_UPLOAD_TYPES.get(file.type);
  if (!extension) {
    throw new Error("Attachment must be a PDF, JPEG, or PNG file.");
  }

  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `${randomUUID()}${extension}`;
  const directory = path.join(uploadRoot(), safeFolder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
  return `/api/attachments/${safeFolder}/${fileName}`;
}

export async function readPrivateUpload(segments: string[]) {
  if (
    segments.length !== 2 ||
    segments.some((segment) => !/^[a-zA-Z0-9_.-]+$/.test(segment) || segment === "." || segment === "..")
  ) {
    return null;
  }

  const root = uploadRoot();
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

export async function deletePrivateUpload(url: string) {
  const prefix = "/api/attachments/";
  if (!url.startsWith(prefix)) return;
  const segments = url.slice(prefix.length).split("/");
  if (segments.length !== 2 || segments.some((segment) => !/^[a-zA-Z0-9_.-]+$/.test(segment))) return;
  const root = uploadRoot();
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) return;
  try {
    await unlink(target);
  } catch {
    // Missing temporary files require no cleanup.
  }
}
