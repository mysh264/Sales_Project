import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);

type MagicRule = { mime: string; extension: string; test: (bytes: Buffer) => boolean };

const MAGIC_RULES: MagicRule[] = [
  {
    mime: "application/pdf",
    extension: ".pdf",
    test: (bytes) => bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-",
  },
  {
    mime: "image/jpeg",
    extension: ".jpg",
    test: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    mime: "image/png",
    extension: ".png",
    test: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
];

export function detectUploadKind(bytes: Buffer): { mime: string; extension: string } | null {
  for (const rule of MAGIC_RULES) {
    if (rule.test(bytes)) {
      return { mime: rule.mime, extension: rule.extension };
    }
  }
  return null;
}

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

  const declaredExtension = ALLOWED_UPLOAD_TYPES.get(file.type);
  if (!declaredExtension) {
    throw new Error("Attachment must be a PDF, JPEG, or PNG file.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const detected = detectUploadKind(bytes);
  if (!detected) {
    throw new Error("Attachment content does not match a supported PDF, JPEG, or PNG signature.");
  }
  if (detected.extension !== declaredExtension) {
    throw new Error("Attachment content does not match the declared file type.");
  }

  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
  const fileName = `${randomUUID()}${detected.extension}`;
  const directory = path.join(uploadRoot(), safeFolder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), bytes, { flag: "wx", mode: 0o600 });
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
