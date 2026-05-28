import { startMobileBridge } from "../mobileBridge.js";

const port = Number(process.env.GHI_MOBILE_BRIDGE_SMOKE_PORT ?? "3991");
const token = "smoke-test-token";

await startMobileBridge({
  cwd: process.cwd(),
  host: "127.0.0.1",
  port,
  token,
  write: () => {},
});

const response = await fetch(`http://127.0.0.1:${port}/health`, {
  headers: {
    authorization: `Bearer ${token}`,
  },
});

if (!response.ok) {
  throw new Error(`mobile bridge smoke check failed with ${response.status}`);
}

const body = await response.json() as { ok?: boolean };
if (!body.ok) {
  throw new Error("mobile bridge smoke check returned an invalid health payload");
}

process.exit(0);
