import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server as NodeServer, type ServerResponse } from "node:http";
import path from "node:path";

export interface FileServerSettings {
  bind: string;
  port: number;
  fileRoot: string;
}

export interface DirEntry {
  name: string;
  type: "file" | "dir";
  size: number;
  path: string;
}

export interface UploadResponse {
  status: "ok";
  path: string;
  size: number;
}

export interface ErrorResponse {
  error: string;
}

export interface FileServerApp {
  settings: FileServerSettings;
  handle(request: Request): Promise<Response>;
  listen(port?: number, host?: string): Promise<NodeServer>;
  close(): Promise<void>;
}

export interface CreateFileServerAppOptions {
  settings?: Partial<FileServerSettings> | undefined;
  cwd?: string | undefined;
}

export interface FileServerRuntime {
  cwd: string;
  out(message: string): void;
  err(message: string): void;
}

const DEFAULT_PORT = 8080;
const DEFAULT_BIND = "0.0.0.0";
const DEFAULT_FILE_ROOT = "./file_root";

function resolveFileRoot(fileRoot: string, cwd: string): string {
  return path.resolve(cwd, fileRoot);
}

function parsePositiveInt(raw: string, flag: string): number {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`invalid value for ${flag}: ${raw}`);
  }
  return value;
}

function requireValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function usageText(): string {
  return [
    "Usage: mkp-file-server [-p PORT] [-r ROOT] [-b BIND]",
    "",
    "Endpoints:",
    "  GET  /<path>        Download file",
    "  PUT  /<path>        Raw upload",
    "  POST /upload        Multipart form upload",
    "  GET  /list?path=    List directory"
  ].join("\n");
}

export function parseFileServerArgs(
  argv: readonly string[],
  cwd = process.cwd()
): { settings: FileServerSettings; showHelp: boolean } {
  let bind = DEFAULT_BIND;
  let port = DEFAULT_PORT;
  let fileRoot = DEFAULT_FILE_ROOT;
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "-h":
      case "--help":
        showHelp = true;
        break;
      case "-p":
      case "--port":
        port = parsePositiveInt(requireValue(argv, index, token), token);
        index += 1;
        break;
      case "-r":
      case "--root":
        fileRoot = requireValue(argv, index, token);
        index += 1;
        break;
      case "-b":
      case "--bind":
        bind = requireValue(argv, index, token);
        index += 1;
        break;
      default:
        throw new Error(`unknown argument: ${token}`);
    }
  }

  return {
    showHelp,
    settings: {
      bind,
      port,
      fileRoot: resolveFileRoot(fileRoot, cwd)
    }
  };
}

function normalizeUserPath(input: string): string | undefined {
  const normalized = input.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized) {
    return "";
  }
  if (/^[A-Za-z]:/.test(normalized)) {
    return undefined;
  }
  return normalized;
}

export function safeJoin(fileRoot: string, ...paths: readonly string[]): string | undefined {
  const parts = [path.resolve(fileRoot)];
  for (const raw of paths) {
    const normalized = normalizeUserPath(raw);
    if (normalized === undefined) {
      return undefined;
    }
    if (!normalized) {
      continue;
    }
    if (path.isAbsolute(normalized)) {
      return undefined;
    }
    parts.push(...normalized.split("/").filter(Boolean));
  }
  const combined = path.resolve(path.join(...parts));
  const relative = path.relative(path.resolve(fileRoot), combined);
  if (!relative || relative === ".") {
    return combined;
  }
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return undefined;
  }
  return combined;
}

export function sanitizeFilename(filename: string): string {
  const base = path.posix.basename(filename.replaceAll("\\", "/"));
  const cleaned = Array.from(base, (char) => (`<>:\"|?*`.includes(char) ? "_" : char)).join("");
  if (!cleaned || cleaned === "." || cleaned === path.sep) {
    return "unnamed_file";
  }
  return cleaned;
}

function relativePosixPath(fileRoot: string, targetPath: string): string {
  return path.relative(fileRoot, targetPath).split(path.sep).join("/");
}

export async function listDirectory(dirPath: string, fileRoot: string): Promise<DirEntry[]> {
  const items = await readdir(dirPath, { withFileTypes: true });
  items.sort((left, right) => left.name.localeCompare(right.name));

  const entries: DirEntry[] = [];
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const info = await stat(fullPath);
    entries.push({
      name: item.name,
      type: item.isDirectory() ? "dir" : "file",
      size: item.isDirectory() ? 0 : info.size,
      path: relativePosixPath(fileRoot, fullPath)
    });
  }
  return entries;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function attachmentDisposition(filename: string): string {
  const escaped = filename.replaceAll('"', "\\\"");
  return `attachment; filename="${escaped}"`;
}

async function handleList(request: Request, settings: FileServerSettings): Promise<Response> {
  const url = new URL(request.url);
  const requestPath = url.searchParams.get("path") ?? "";
  const fsPath = safeJoin(settings.fileRoot, requestPath);
  if (!fsPath) {
    return jsonResponse({ error: "Path traversal rejected" } satisfies ErrorResponse, 400);
  }

  let info;
  try {
    info = await stat(fsPath);
  } catch {
    return jsonResponse({ error: `Directory not found: ${requestPath}` } satisfies ErrorResponse, 404);
  }
  if (!info.isDirectory()) {
    return jsonResponse({ error: `Directory not found: ${requestPath}` } satisfies ErrorResponse, 404);
  }

  return jsonResponse(await listDirectory(fsPath, settings.fileRoot));
}

async function handleUpload(request: Request, settings: FileServerSettings): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "Missing 'file' field in form data" } satisfies ErrorResponse, 400);
  }
  if (!file.name) {
    return jsonResponse({ error: "Empty filename" } satisfies ErrorResponse, 400);
  }

  const pathFieldValue = form.get("path");
  const pathField = typeof pathFieldValue === "string" ? pathFieldValue : "";
  const filename = sanitizeFilename(file.name);
  const targetPath = safeJoin(settings.fileRoot, pathField, filename);
  if (!targetPath) {
    return jsonResponse({ error: "Path traversal rejected" } satisfies ErrorResponse, 400);
  }

  const data = new Uint8Array(await file.arrayBuffer());
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, data);

  const response: UploadResponse = {
    status: "ok",
    path: relativePosixPath(settings.fileRoot, targetPath),
    size: data.byteLength
  };
  return jsonResponse(response);
}

async function handlePut(request: Request, settings: FileServerSettings): Promise<Response> {
  const url = new URL(request.url);
  const urlPath = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const fsPath = safeJoin(settings.fileRoot, urlPath);
  if (!fsPath) {
    return jsonResponse({ error: "Path traversal rejected" } satisfies ErrorResponse, 400);
  }

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength === 0) {
    return jsonResponse({ error: "Empty request body" } satisfies ErrorResponse, 400);
  }

  await mkdir(path.dirname(fsPath), { recursive: true });
  await writeFile(fsPath, data);

  const response: UploadResponse = {
    status: "ok",
    path: urlPath,
    size: data.byteLength
  };
  return jsonResponse(response);
}

async function handleGet(request: Request, settings: FileServerSettings): Promise<Response> {
  const url = new URL(request.url);
  const urlPath = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const fsPath = safeJoin(settings.fileRoot, urlPath);
  if (!fsPath) {
    return jsonResponse({ error: "Path traversal rejected" } satisfies ErrorResponse, 400);
  }

  let info;
  try {
    info = await stat(fsPath);
  } catch {
    return jsonResponse({ error: `File not found: ${urlPath}` } satisfies ErrorResponse, 404);
  }
  if (info.isDirectory()) {
    return jsonResponse({ error: `File not found: ${urlPath}` } satisfies ErrorResponse, 404);
  }

  const data = await readFile(fsPath);
  return new Response(data, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-disposition": attachmentDisposition(path.basename(fsPath))
    }
  });
}

async function routeRequest(request: Request, settings: FileServerSettings): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/list") {
    return handleList(request, settings);
  }
  if (request.method === "POST" && url.pathname === "/upload") {
    return handleUpload(request, settings);
  }
  if (request.method === "PUT") {
    return handlePut(request, settings);
  }
  if (request.method === "GET") {
    return handleGet(request, settings);
  }
  return jsonResponse({ error: "Not found" } satisfies ErrorResponse, 404);
}

async function incomingMessageToRequest(message: IncomingMessage): Promise<Request> {
  const origin = `http://${message.headers.host ?? "127.0.0.1"}`;
  const url = new URL(message.url ?? "/", origin);
  const method = message.method ?? "GET";
  const chunks: Buffer[] = [];
  for await (const chunk of message) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
  const headers = new Headers();
  Object.entries(message.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
      return;
    }
    if (value !== undefined) {
      headers.set(key, value);
    }
  });
  return new Request(url, {
    method,
    headers,
    body: body ?? undefined,
    duplex: body ? "half" : undefined
  } as RequestInit);
}

async function responseToNode(response: Response, nodeResponse: ServerResponse): Promise<void> {
  nodeResponse.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });
  if (response.body === null) {
    nodeResponse.end();
    return;
  }
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

export function createFileServerApp(options: CreateFileServerAppOptions = {}): FileServerApp {
  const cwd = options.cwd ?? process.cwd();
  const settings: FileServerSettings = {
    bind: options.settings?.bind ?? DEFAULT_BIND,
    port: options.settings?.port ?? DEFAULT_PORT,
    fileRoot: resolveFileRoot(options.settings?.fileRoot ?? DEFAULT_FILE_ROOT, cwd)
  };
  let activeServer: NodeServer | undefined;

  return {
    settings,
    async handle(request: Request): Promise<Response> {
      await mkdir(settings.fileRoot, { recursive: true });
      try {
        return await routeRequest(request, settings);
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
      }
    },
    async listen(port = settings.port, host = settings.bind): Promise<NodeServer> {
      await mkdir(settings.fileRoot, { recursive: true });
      const server = createServer(async (request, response) => {
        try {
          const webRequest = await incomingMessageToRequest(request);
          await responseToNode(await this.handle(webRequest), response);
        } catch (error) {
          await responseToNode(
            jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500),
            response
          );
        }
      });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      activeServer = server;
      return server;
    },
    async close(): Promise<void> {
      if (!activeServer) {
        return;
      }
      const server = activeServer;
      activeServer = undefined;
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}

export async function runFileServer(
  argv: readonly string[] = process.argv.slice(2),
  runtime: FileServerRuntime = {
    cwd: process.cwd(),
    out: (message: string): void => console.log(message),
    err: (message: string): void => console.error(message)
  }
): Promise<NodeServer | undefined> {
  let parsed;
  try {
    parsed = parseFileServerArgs(argv, runtime.cwd);
  } catch (error) {
    runtime.err(`mkp-file-server: ${error instanceof Error ? error.message : String(error)}`);
    runtime.err(usageText());
    process.exitCode = 1;
    return undefined;
  }

  if (parsed.showHelp) {
    runtime.out(usageText());
    return undefined;
  }

  const app = createFileServerApp({ settings: parsed.settings, cwd: runtime.cwd });
  runtime.out("http4dev server started");
  runtime.out(`  FileRoot: ${app.settings.fileRoot}`);
  runtime.out(`  Listen: ${app.settings.bind}:${app.settings.port}`);
  runtime.out("  Endpoints:");
  runtime.out("    GET  /<path>        Download file");
  runtime.out("    PUT  /<path>        Raw upload");
  runtime.out("    POST /upload        Multipart form upload");
  runtime.out("    GET  /list?path=    List directory");
  runtime.out("");
  return app.listen(app.settings.port, app.settings.bind);
}
