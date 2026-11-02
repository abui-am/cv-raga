import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const mocks = vi.hoisted(() => ({
  ask: vi.fn(),
  repository: vi.fn(),
  source: vi.fn(),
  evidence: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../lib/server/ai", () => ({ askAi: mocks.ask }));
vi.mock("../lib/server/db", () => ({
  database: () => ({
    repository: { findUnique: mocks.repository },
    $transaction: mocks.transaction,
  }),
}));
import {
  repositoryAction,
  repositorySnippets,
  searchableFile,
} from "../lib/server/repositories";
let root: string;
let outside: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "cvraga-repository-test-"));
  outside = await mkdtemp(join(tmpdir(), "cvraga-outside-test-"));
  await promisify(execFile)("git", ["init", root]);
  await mkdir(join(root, "src"));
  await writeFile(
    join(root, "README.md"),
    "# Dispatch Board\nA workspace for planning deliveries and tracking parcels.\n",
  );
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "dispatch-board",
      dependencies: { next: "16.4.3" },
    }),
  );
  await mkdir(join(root, "src", "delivery"));
  await writeFile(
    join(root, "src", "delivery", "schedule.ts"),
    'import { randomUUID } from "node:crypto";\n'.repeat(45) +
      'export function scheduleDelivery(destination: string) {\n  return { id: randomUUID(), destination, status: "scheduled" };\n}\n',
  );
  await mkdir(join(root, "src", "tracking"));
  await writeFile(
    join(root, "src", "tracking", "status.ts"),
    'export function trackParcel(id: string) {\n  return { id, status: "in transit" };\n}\n',
  );
  await writeFile(
    join(root, "src", "feature.ts"),
    "// React testing evidence\nexport function testReactWorkflow() { return 'React integration tests'; }\n",
  );
  await writeFile(join(root, ".gitignore"), "ignored.ts\n");
  await writeFile(
    join(root, "ignored.ts"),
    "// React testing IGNORED_SENTINEL should never reach AI\n",
  );
  await writeFile(
    join(root, ".env"),
    "PRIVATE_FIXTURE_SECRET=DO_NOT_SCAN\nReact testing\n",
  );
  await writeFile(
    join(root, "src", "configuration.ts"),
    "const apiKey = 'synthetic-fixture-key-value';\n// React testing TOKEN_SENTINEL\n",
  );
  await writeFile(
    join(outside, "outside.ts"),
    "// React testing OUTSIDE_SENTINEL must stay outside repository\n",
  );
  await symlink(join(outside, "outside.ts"), join(root, "linked.ts"));
  await promisify(execFile)("git", ["-C", root, "add", "."]);
  await promisify(execFile)("git", ["-C", root, "add", "-f", ".env"]);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});
it("only searches supported source files and excludes sensitive paths", () => {
  expect(searchableFile("src/page.tsx")).toBe(true);
  expect(searchableFile("Dockerfile")).toBe(true);
  for (const path of [
    ".env",
    "credentials.json",
    "node_modules/x.ts",
    "dist/app.js",
    "private-key.ts",
    ".git/config",
  ])
    expect(searchableFile(path)).toBe(false);
});
it("respects gitignore, excludes literal secrets and rejects symlink escapes", async () => {
  const found = await repositorySnippets(root, "React testing");
  expect(found.snippets.some((s) => s.file === "src/feature.ts")).toBe(true);
  expect(found.snippets.every((s) => s.start >= 1 && s.end >= s.start)).toBe(
    true,
  );
  const text = found.snippets.map((s) => s.text).join("\n");
  expect(text).not.toContain("IGNORED_SENTINEL");
  expect(text).not.toContain("TOKEN_SENTINEL");
  expect(text).not.toContain("OUTSIDE_SENTINEL");
  expect(text).not.toContain("PRIVATE_FIXTURE_SECRET");
});
it("discovers project context and distinct implementations without a search topic", async () => {
  const found = await repositorySnippets(root);
  expect(found.snippets.map((snippet) => snippet.file)).toEqual(
    expect.arrayContaining([
      "README.md",
      "package.json",
      "src/delivery/schedule.ts",
      "src/tracking/status.ts",
    ]),
  );
  expect(
    found.snippets.find(
      (snippet) => snippet.file === "src/delivery/schedule.ts",
    )?.text,
  ).toContain('status: "scheduled"');
  expect(found.snippets.length).toBeLessThanOrEqual(10);
  expect(new Set(found.snippets.map((snippet) => snippet.file)).size).toBe(
    found.snippets.length,
  );
  for (const snippet of found.snippets) {
    const lines = (await readFile(join(root, snippet.file), "utf8")).split(
      /\r?\n/,
    );
    expect(lines.slice(snippet.start - 1, snippet.end).join("\n")).toBe(
      snippet.text,
    );
    expect(snippet.text.length).toBeLessThanOrEqual(1800);
  }
  const text = found.snippets.map((snippet) => snippet.text).join("\n");
  for (const sentinel of [
    "IGNORED_SENTINEL",
    "TOKEN_SENTINEL",
    "OUTSIDE_SENTINEL",
    "PRIVATE_FIXTURE_SECRET",
  ])
    expect(text).not.toContain(sentinel);
});
it("keeps an optional focus limited to matching evidence", async () => {
  const found = await repositorySnippets(root, "scheduleDelivery");
  expect(found.snippets.map((snippet) => snippet.file)).toEqual([
    "src/delivery/schedule.ts",
  ]);
  expect((await repositorySnippets(root, "notfoundanywhere")).snippets).toEqual(
    [],
  );
});
it.each([{}, { query: "" }, { query: "   " }])(
  "creates general evidence drafts when the focus is omitted or blank: %j",
  async (body) => {
    const found = await repositorySnippets(root);
    const snippet = found.snippets.find(
      (snippet) => snippet.file === "src/tracking/status.ts",
    )!;
    mocks.repository.mockResolvedValue({
      id: "repo1",
      name: "Dispatch Board",
      path: root,
    });
    mocks.ask.mockResolvedValue({
      items: [
        {
          title: "Parcel tracking",
          summary: "Implements parcel status tracking.",
          snippetId: snippet.id,
          quote: snippet.text,
          tags: ["tracking"],
        },
      ],
    });
    mocks.source.mockResolvedValue({ id: "source1" });
    mocks.evidence.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (fn) =>
      fn({
        source: { create: mocks.source },
        evidence: { createMany: mocks.evidence },
      }),
    );
    const result = await repositoryAction(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      "repo1",
      "search",
    );
    expect(result).toMatchObject({ created: 1 });
    expect(mocks.ask.mock.calls[0][3]).toMatchObject({ query: "" });
    const item = mocks.evidence.mock.calls[0][0].data[0];
    expect(item.confirmed).toBe(false);
    expect(item.text).toContain(
      `${snippet.file}:${snippet.start}-${snippet.end}`,
    );
    expect(item.text).toContain(snippet.text);
  },
);
it("creates only unconfirmed evidence with verified file/line citations", async () => {
  const found = await repositorySnippets(root, "React testing");
  const snippet = found.snippets[0];
  mocks.repository.mockResolvedValue({
    id: "repo1",
    name: "Example repository",
    path: root,
  });
  mocks.ask.mockResolvedValue({
    items: [
      {
        title: "React integration tests",
        summary: "The repository contains React testing code.",
        snippetId: snippet.id,
        quote: snippet.text,
        tags: ["React"],
      },
    ],
  });
  mocks.source.mockResolvedValue({ id: "source1" });
  mocks.evidence.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) =>
    fn({
      source: { create: mocks.source },
      evidence: { createMany: mocks.evidence },
    }),
  );
  const result = await repositoryAction(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ query: "React testing" }),
    }),
    "repo1",
    "search",
  );
  expect(result).toMatchObject({ created: 1 });
  const item = mocks.evidence.mock.calls[0][0].data[0];
  expect(item.confirmed).toBe(false);
  expect(item.text).toContain(
    `${snippet.file}:${snippet.start}-${snippet.end}`,
  );
  expect(item.text).toContain(snippet.text);
});
it("rejects fabricated repository quotes without saving drafts", async () => {
  mocks.repository.mockResolvedValue({
    id: "repo1",
    name: "Example",
    path: root,
  });
  mocks.ask.mockResolvedValue({
    items: [
      {
        title: "Invented",
        summary: "Unsupported",
        snippetId: "s1",
        quote: "Invented revenue improvement of 90%",
        tags: [],
      },
    ],
  });
  await expect(
    repositoryAction(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ query: "React testing" }),
      }),
      "repo1",
      "search",
    ),
  ).rejects.toMatchObject({ status: 422 });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
