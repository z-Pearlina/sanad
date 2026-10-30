export type Dodged<T> = { d: T; along: number; across: number; r: number };

/**
 * Lays circles along a line without overlap: each keeps its place along the line and steps
 * aside only as far as it must, the largest first, so the busiest narrators stay on the line.
 */
export function dodge<T>(items: T[], along: (d: T) => number, radius: (d: T) => number, gap = 0.7): Dodged<T>[] {
  const placed: Dodged<T>[] = [];
  for (const d of [...items].sort((a, b) => radius(b) - radius(a))) {
    const a = along(d);
    const r = radius(d);
    const near = placed.filter((q) => Math.abs(q.along - a) < q.r + r + gap);
    const clear = (o: number) => near.every((q) => (q.along - a) ** 2 + (q.across - o) ** 2 >= (q.r + r + gap) ** 2 - 1e-6);
    const offers = [0];
    for (const q of near) {
      const h = Math.sqrt((q.r + r + gap) ** 2 - (q.along - a) ** 2);
      offers.push(q.across + h, q.across - h);
    }
    offers.sort((x, y) => Math.abs(x) - Math.abs(y));
    placed.push({ d, along: a, across: offers.find(clear) ?? 0, r });
  }
  return placed;
}
