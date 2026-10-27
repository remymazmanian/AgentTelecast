// Builds out/demo.html (used for the screenshots) from demo/demo-data.json with the public builder,
// clock frozen to Mon Mar 2, 2026 10:05 AM PT to match the demo data.
// Usage: node demo/build-demo.cjs [demo-data.json] [out/demo.html]
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const dataPath = path.resolve(process.argv[2] || path.join(__dirname, "demo-data.json"));
const outPath = path.resolve(process.argv[3] || path.join(ROOT, "out", "demo.html"));
execFileSync(process.execPath, [path.join(ROOT, "build.cjs"), dataPath, outPath, "--freeze-clock", "2026-03-02T18:05:00Z", "--storage-key", "agenttelecast.demo.v1"], { stdio: "inherit" });
