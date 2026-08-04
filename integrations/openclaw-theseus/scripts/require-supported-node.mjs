const [major, minor, patch] = process.versions.node.split(".").map(Number);

const atLeast = (expectedMajor, expectedMinor, expectedPatch) =>
  major > expectedMajor ||
  (major === expectedMajor &&
    (minor > expectedMinor ||
      (minor === expectedMinor && patch >= expectedPatch)));

const supported =
  (major === 22 && atLeast(22, 22, 3)) ||
  (major === 24 && atLeast(24, 15, 0)) ||
  major > 25 ||
  (major === 25 && atLeast(25, 9, 0));

if (!supported) {
  console.error(
    `Unsupported Node ${process.versions.node}. Theseus OpenClaw Plugin requires Node 22.22.3+, 24.15+, or 25.9+.`,
  );
  process.exitCode = 1;
}
