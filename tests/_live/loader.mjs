import { pathToFileURL } from "node:url";

const dir = new URL("./", import.meta.url);

const STUBS = {
  "next/headers": pathToFileURL(new URL("./next-headers-stub.mjs", dir).pathname).href,
  "next/cache": "data:text/javascript,export function revalidatePath(){}export function revalidateTag(){}",
};

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) {
    return { url: STUBS[specifier], shortCircuit: true };
  }
  return next(specifier, context);
}
