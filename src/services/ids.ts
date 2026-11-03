/** Collision-resistant id with a readable prefix, e.g. `prompt-3f9c…`. */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
