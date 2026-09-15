/** Server clock. One seam, so tests can move time without mocking Date globally. */
let offsetMs = 0;

export const clock = {
  now: () => new Date(Date.now() + offsetMs),
  iso: () => new Date(Date.now() + offsetMs).toISOString(),
  advance: (ms: number) => { offsetMs += ms; },
  reset: () => { offsetMs = 0; },
};
