import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import type { QrcodeTerminal } from "qrcode-terminal";
import { getGitContext } from "./git.js";
import { enqueueBackgroundJob, getJobsDir } from "./jobs.js";

const require = createRequire(import.meta.url);
const qrcodeTerminal = require("qrcode-terminal") as QrcodeTerminal;

export type MobileBridgeOptions = {
  cwd: string;
  host?: string;
  port?: number;
  token?: string;
  write?: (message: string) => void;
};

type MobileIssueRequest = {
  repo?: string;
  kind?: string;
  report?: string;
  context?: string;
  attachments?: MobileBridgeAttachment[];
  dryRun?: boolean;
  explore?: boolean;
};

type MobileBridgeAttachment = {
  kind?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  dataBase64?: string;
};

export async function startMobileBridge(options: MobileBridgeOptions): Promise<void> {
  const write = options.write ?? ((message) => process.stdout.write(message));
  const git = await getGitContext(options.cwd);
  const repo = git.remoteOwner && git.remoteName ? `${git.remoteOwner}/${git.remoteName}` : null;
  const token = options.token?.trim() || randomBytes(24).toString("base64url");
  const host = options.host || getPreferredHost();
  const port = options.port ?? 3874;
  const publicUrl = `http://${host}:${port}`;

  const server = createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        writeResponse(response, 204, null);
        return;
      }

      if (request.url === "/health" && request.method === "GET") {
        if (!isAuthorized(request, token)) {
          writeResponse(response, 401, { error: "unauthorized" });
          return;
        }
        writeResponse(response, 200, {
          ok: true,
          repo,
          root: git.root,
          branch: git.branch,
          commit: git.commit,
          dirty: git.isDirty,
        });
        return;
      }

      if (request.url === "/issues" && request.method === "POST") {
        if (!isAuthorized(request, token)) {
          writeResponse(response, 401, { error: "unauthorized" });
          return;
        }

        const body = await readJson<MobileIssueRequest>(request);
        const report = body.report?.trim();
        if (!report) {
          writeResponse(response, 400, { error: "missing report" });
          return;
        }

        if (repo && body.repo && normalizeRepo(body.repo) !== normalizeRepo(repo)) {
          writeResponse(response, 409, {
            error: `desktop bridge is serving ${repo}, but mobile selected ${body.repo}`,
            repo,
          });
          return;
        }

        const savedAttachments = await saveMobileAttachments(body.attachments ?? []);
        const roughInput = [
          body.kind ? `[${body.kind}] ${report}` : report,
          body.context?.trim() ? `Mobile context:\n${body.context.trim()}` : "",
          savedAttachments.summary ? `Mobile evidence:\n${savedAttachments.summary}` : "",
        ].filter(Boolean).join("\n\n");

        const job = await enqueueBackgroundJob({
          cwd: git.root,
          report: roughInput,
          args: body.dryRun ? ["--dry-run"] : ["--now"],
          explore: Boolean(body.explore),
          screenshots: savedAttachments.screenshots,
          nodePath: process.argv[0],
          cliPath: process.argv[1],
        });

        writeResponse(response, 202, {
          ok: true,
          accepted: true,
          repo,
          job: {
            id: job.id,
            status: job.status,
            createdAt: job.createdAt,
          },
        });
        return;
      }

      writeResponse(response, 404, { error: "not found" });
    } catch (error) {
      writeResponse(response, 500, { error: formatBridgeError(error) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const pairingUrl = `ghi://pair?url=${encodeURIComponent(publicUrl)}&token=${encodeURIComponent(token)}${repo ? `&repo=${encodeURIComponent(repo)}` : ""}`;
  write([
    `ghi mobile bridge listening on ${publicUrl}`,
    repo ? `Repo: ${repo}` : "Repo: unknown GitHub remote",
    `Pairing token: ${token}`,
    `Pairing URL: ${pairingUrl}`,
    "",
    "Scan this QR from mobile Settings:",
    renderQr(pairingUrl),
    "",
    "Keep this process running while mobile sends captures to desktop.",
    "",
  ].join("\n"));
}

function renderQr(value: string): string {
  let rendered = "";
  qrcodeTerminal.generate(value, { small: true }, (qr) => {
    rendered = qr;
  });
  return rendered.trimEnd();
}

function isAuthorized(request: IncomingMessage, token: string): boolean {
  const authorization = request.headers.authorization;
  if (authorization === `Bearer ${token}`) {
    return true;
  }
  return request.headers["x-ghi-token"] === token;
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function writeResponse(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-ghi-token");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (body === null) {
    response.end();
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.end(`${JSON.stringify(body)}\n`);
}

function normalizeRepo(value: string): string {
  return value.trim().toLowerCase().replace(/\.git$/, "");
}

async function saveMobileAttachments(attachments: MobileBridgeAttachment[]): Promise<{
  summary: string;
  screenshots: string[];
}> {
  const uploadRoot = join(getJobsDir(), "mobile-uploads");
  await mkdir(uploadRoot, { recursive: true });
  const screenshots: string[] = [];
  const summary: string[] = [];

  for (const [index, attachment] of attachments.entries()) {
    if (!attachment.dataBase64 || !attachment.name) {
      continue;
    }

    const safeName = sanitizeFileName(attachment.name);
    const fallbackExtension = extensionForMime(attachment.mimeType);
    const filename = safeName.includes(".") ? safeName : `${safeName || `attachment-${index + 1}`}${fallbackExtension}`;
    const filePath = join(uploadRoot, `${Date.now()}-${index + 1}-${filename}`);
    await writeFile(filePath, Buffer.from(stripDataUrlPrefix(attachment.dataBase64), "base64"));

    const kind = attachment.mimeType?.startsWith("image/") || attachment.kind === "image" ? "image" : "file";
    if (kind === "image") {
      screenshots.push(filePath);
    }
    summary.push(`- ${filename} (${kind}${attachment.mimeType ? `, ${attachment.mimeType}` : ""}) saved to ${filePath}`);
  }

  return {
    summary: summary.join("\n"),
    screenshots,
  };
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim().slice(0, 96);
}

function stripDataUrlPrefix(value: string): string {
  const comma = value.indexOf(",");
  return value.startsWith("data:") && comma >= 0 ? value.slice(comma + 1) : value;
}

function extensionForMime(mimeType?: string): string {
  if (!mimeType) {
    return ".bin";
  }
  if (mimeType === "image/png") {
    return ".png";
  }
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }
  if (mimeType === "application/json") {
    return ".json";
  }
  if (mimeType.startsWith("text/")) {
    return ".txt";
  }
  const subtype = mimeType.split("/")[1];
  const extension = subtype ? `.${subtype.split("+")[0]}` : ".bin";
  return extname(extension) ? extension : ".bin";
}

function formatBridgeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("gh issue create") || message.includes("Command failed with exit code")) {
    return "Desktop issue creation failed. Check `ghi jobs` on the desktop for the full error.";
  }
  return message.split("\n")[0]?.slice(0, 240) || "Desktop bridge failed.";
}

function getPreferredHost(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "127.0.0.1";
}
