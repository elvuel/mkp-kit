import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createFileServerApp, safeJoin, sanitizeFilename } from "../src/file_server.js";

function tempRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), "mkp-node-file-server-"));
}

async function parseJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}

test("file server PUT then GET round-trips bytes", async () => {
  const root = tempRoot();
  const app = createFileServerApp({ settings: { fileRoot: root } });

  const put = await app.handle(
    new Request("http://localhost/nested/demo.txt", {
      method: "PUT",
      body: Buffer.from("hello mkp")
    })
  );
  assert.equal(put.status, 200);
  assert.deepEqual(await parseJson(put), { status: "ok", path: "nested/demo.txt", size: 9 });

  const get = await app.handle(new Request("http://localhost/nested/demo.txt"));
  assert.equal(get.status, 200);
  assert.equal(await get.text(), "hello mkp");
  assert.match(get.headers.get("content-disposition") ?? "", /demo.txt/);

  const stored = await readFile(path.join(root, "nested", "demo.txt"), "utf8");
  assert.equal(stored, "hello mkp");
});

test("file server list returns sorted entries", async () => {
  const root = tempRoot();
  const app = createFileServerApp({ settings: { fileRoot: root } });

  await app.handle(new Request("http://localhost/dir/b.txt", { method: "PUT", body: Buffer.from("b") }));
  await app.handle(new Request("http://localhost/dir/a.txt", { method: "PUT", body: Buffer.from("aa") }));

  const response = await app.handle(new Request("http://localhost/list?path=dir"));
  assert.equal(response.status, 200);
  assert.deepEqual(await parseJson(response), [
    { name: "a.txt", type: "file", size: 2, path: "dir/a.txt" },
    { name: "b.txt", type: "file", size: 1, path: "dir/b.txt" }
  ]);
});

test("file server multipart upload stores sanitized filename", async () => {
  const root = tempRoot();
  const app = createFileServerApp({ settings: { fileRoot: root } });
  const form = new FormData();
  form.set("path", "uploads");
  form.set("file", new File([Buffer.from("payload")], "bad:name?.txt", { type: "application/octet-stream" }));

  const response = await app.handle(
    new Request("http://localhost/upload", {
      method: "POST",
      body: form
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await parseJson(response), {
    status: "ok",
    path: "uploads/bad_name_.txt",
    size: 7
  });
  assert.equal(await readFile(path.join(root, "uploads", "bad_name_.txt"), "utf8"), "payload");
});

test("file server rejects traversal attempts", async () => {
  const root = tempRoot();
  const app = createFileServerApp({ settings: { fileRoot: root } });

  const list = await app.handle(new Request("http://localhost/list?path=../secret"));
  assert.equal(list.status, 400);
  assert.deepEqual(await parseJson(list), { error: "Path traversal rejected" });
});

test("file server helpers match go-like normalization", () => {
  assert.match(safeJoin("C:/root", "nested/file.txt") ?? "", /nested/);
  assert.equal(safeJoin("C:/root", "../escape.txt"), undefined);
  assert.equal(sanitizeFilename("demo:name?.txt"), "demo_name_.txt");
});
