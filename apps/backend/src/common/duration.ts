const UNITS_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// '15m' -> 900000, '30d' -> 2592000000
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration string: ${value}`);

  const [, amount, unit] = match;
  return Number(amount) * UNITS_MS[unit];
}
