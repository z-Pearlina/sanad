// «سند اليوم»: one chain for each day of the year. Days are counted in UTC, so every visitor
// sees the same chain at the same moment, wherever they are.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function dayOfYear(now = new Date()) {
  const y = now.getUTCFullYear();
  return Math.floor((Date.UTC(y, now.getUTCMonth(), now.getUTCDate()) - Date.UTC(y, 0, 0)) / DAY);
}

/** Of a list of chains, today's. */
export function todayOf<T>(list: T[], now = new Date()): T | undefined {
  return list.length ? list[dayOfYear(now) % list.length] : undefined;
}

/** «يتجدد بعد 5 ساعات»: the hours left until the next day begins. */
export function renewsIn(now = new Date()) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const left = next - now.getTime();
  const hours = Math.ceil(left / HOUR);
  if (left < HOUR) return "يتجدد بعد أقل من ساعة";
  if (hours === 2) return "يتجدد بعد ساعتين";
  return `يتجدد بعد ${hours} ${hours <= 10 ? "ساعات" : "ساعة"}`;
}
