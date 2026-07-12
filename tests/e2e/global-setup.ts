import { spawn, execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const MOCK_PORT = 9876;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}/feed.xml`;
const DB_PATH = path.resolve(process.cwd(), ".tmp", "civicfeed-live.db");
const BACKEND_PORT = 4000;
const FRONTEND_PORT = 4173;

function killExistingTestProcesses() {
  try {
    // Use bracketed character classes so the pkill command itself is not matched.
    execSync("pkill -f '[m]ock-rss-server.mjs' || true");
    execSync("pkill -f '[t]sx watch src/server.ts' || true");
    execSync("pkill -f '[v]ite preview' || true");
  } catch {
    // Ignore cleanup failures
  }
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

function runCommand(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...options?.env },
      shell: true,
      cwd: options?.cwd,
    });
    proc.on("error", reject);
    proc.on("exit", (code) => resolve(code ?? 0));
  });
}

function startProcess(command: string, args: string[], options?: { cwd?: string; env?: Record<string, string> }) {
  return spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...options?.env },
    shell: true,
    cwd: options?.cwd,
  });
}

export default async function globalSetup() {
  // Clean up any orphaned processes from a previous interrupted run.
  killExistingTestProcesses();

  // Clean up any stale database.
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  try {
    fs.unlinkSync(DB_PATH);
  } catch {
    // May not exist
  }

  // Start the mock RSS server.
  startProcess("node", [path.join(process.cwd(), "tests/e2e/mock-rss-server.mjs")], {
    env: { MOCK_RSS_PORT: String(MOCK_PORT) },
  });
  await waitForServer(`http://127.0.0.1:${MOCK_PORT}/health`);

  // Seed the backend catalog and add the live test feed.
  const exitCode = await runCommand(
    "npx tsx",
    ["tests/e2e/seed-test-feed.ts"],
    { cwd: path.join(process.cwd(), "backend"), env: { CIVICFEED_DB_PATH: DB_PATH, MOCK_RSS_URL: MOCK_URL } }
  );
  if (exitCode !== 0) {
    throw new Error(`Seed script exited with code ${exitCode}`);
  }

  // Start the backend server with the seeded database. Disable the scheduled
  // feed refresher so tests control exactly which feeds are fetched.
  startProcess("npm", ["run", "dev"], {
    cwd: path.join(process.cwd(), "backend"),
    env: {
      CIVICFEED_DB_PATH: DB_PATH,
      PORT: String(BACKEND_PORT),
      CIVICFEED_ALLOW_PRIVATE_URLS: "1",
      CIVICFEED_DISABLE_SCHEDULER: "1",
    },
  });
  await waitForServer(`http://127.0.0.1:${BACKEND_PORT}/api/health`);

  // Build a fresh production bundle so the preview server serves the current
  // source rather than a stale dist/ from an earlier run.
  const buildExitCode = await runCommand("npm", ["run", "build"], { cwd: process.cwd() });
  if (buildExitCode !== 0) {
    throw new Error(`Frontend build exited with code ${buildExitCode}`);
  }

  // Start the frontend preview after the backend is ready so the initial
  // page load can fetch the catalog successfully.
  startProcess("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(FRONTEND_PORT)], {
    cwd: process.cwd(),
  });
  await waitForServer(`http://127.0.0.1:${FRONTEND_PORT}`);

  return async () => {
    // Terminate the entire process trees spawned above. Bracketed character
    // classes prevent the pkill command from matching itself.
    try {
      execSync("pkill -f '[m]ock-rss-server.mjs' || true");
      execSync("pkill -f '[t]sx watch src/server.ts' || true");
      execSync("pkill -f '[v]ite preview' || true");
    } catch {
      // Ignore teardown failures.
    }
  };
}
