/**
 * Walk a deck (or any nested JSON) and return every relative asset path
 * referenced via `./assets/...`. Used when forking a demo so we can copy
 * the referenced files into the new project's own assets/ directory.
 */
export function collectAssetRefs(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof node === "string") {
    if (node.startsWith("./assets/")) out.add(node.slice("./assets/".length));
    return out;
  }
  if (Array.isArray(node)) {
    for (const x of node) collectAssetRefs(x, out);
    return out;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node)) collectAssetRefs(v, out);
  }
  return out;
}
