// Event times (`api-spec.md` §11.1): wall-clock nanoseconds since the Unix epoch, as a string.
// The wall clock is read once; later times add the monotonic high-resolution offset, so steps
// never go backwards when the system clock is adjusted.
const WALL_START_NS = BigInt(Date.now()) * 1_000_000n;
const HR_START = process.hrtime.bigint();

export function nowNs(): bigint {
  return WALL_START_NS + (process.hrtime.bigint() - HR_START);
}

export function nowNsText(): string {
  return nowNs().toString();
}
