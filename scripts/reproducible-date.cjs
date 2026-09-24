// Make SSR/prerender timestamps deterministic for reproducible F-Droid builds.
// The F-Droid recipe and the reference workflow set SOURCE_DATE_EPOCH to the
// source commit timestamp before invoking Node.
const rawEpoch = process.env.SOURCE_DATE_EPOCH

if (rawEpoch) {
  const epochMilliseconds = Number(rawEpoch) * 1000

  if (Number.isSafeInteger(epochMilliseconds) && epochMilliseconds >= 0) {
    Date.now = () => epochMilliseconds
  }
}
