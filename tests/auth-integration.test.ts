import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { authDatabase, database } from "@/lib/server/db";
import { withWorkspace } from "@/lib/server/workspace";
import { getAuth } from "@/lib/server/auth";
import { handle } from "@/lib/server/api";

const enabled = process.env.CVRAGA_AUTH_DB_TESTS === "1";
const userIds: string[] = [];
const prefix = randomUUID();
let lastLink = "";
let cookies = "";
beforeAll(async () => {
  if (!enabled) return;
  config({ path: ".env.local", quiet: true });
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname))
    throw new Error("Local test database required");
  url.pathname = "/cvraga_test";
  vi.stubEnv("DATABASE_URL", url.toString());
  vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:3000");
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "test-secret-only-for-auth-integration-123456789",
  );
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "test@example.com");
  await authDatabase().rateLimit.deleteMany();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      const mail = JSON.parse(options.body);
      lastLink = mail.text
        .split("\n")
        .find((line: string) => line.startsWith("http"));
      return Response.json({ id: "test-email" });
    }),
  );
});
afterAll(async () => {
  if (!enabled) return;
  const db = authDatabase();
  for (const ownerId of userIds) {
    await db.cv.deleteMany({ where: { ownerId } });
    await db.source.deleteMany({ where: { ownerId } });
    await db.profile.deleteMany({ where: { ownerId } });
    await db.user.deleteMany({ where: { id: ownerId } });
  }
  await db.$disconnect();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.skipIf(!enabled)(
  "authenticates with a single-use emailed link and isolates every account",
  async () => {
    const auth = getAuth();
    for (const suffix of ["alice", "bob"]) {
      const email = `${prefix}-${suffix}@example.com`;
      const send = await auth.handler(
        new Request("http://127.0.0.1:3000/api/auth/sign-in/magic-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:3000",
            "x-forwarded-for": suffix === "alice" ? "127.0.0.11" : "127.0.0.12",
          },
          body: JSON.stringify({
            email,
            callbackURL: "/career",
            errorCallbackURL: "/login?error=expired",
          }),
        }),
      );
      expect(send.status).toBe(200);
      expect(lastLink).toContain("/magic-link/verify");
      const verification = await auth.handler(
        new Request(lastLink, {
          headers: {
            "x-forwarded-for": suffix === "alice" ? "127.0.0.11" : "127.0.0.12",
          },
        }),
      );
      expect(verification.status).toBe(302);
      const cookie = verification.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie).toContain("session_token");
      const session = await auth.api.getSession({
        headers: new Headers({ cookie }),
      });
      expect(session?.user.email).toBe(email);
      userIds.push(session!.user.id);
      if (suffix === "alice") cookies = cookie;
      const replay = await auth.handler(
        new Request(lastLink, {
          headers: {
            "x-forwarded-for": suffix === "alice" ? "127.0.0.11" : "127.0.0.12",
          },
        }),
      );
      expect(replay.headers.get("location")).toContain("error=");
      expect(replay.headers.get("set-cookie") ?? "").not.toContain(
        "session_token",
      );
      await withWorkspace(session!.user.id, async () => {
        await database().profile.create({ data: { content: {} } });
        await database().source.create({
          data: { name: suffix, text: "Private source" },
        });
        await database().cv.create({
          data: {
            title: suffix,
            profileRevision: 1,
            revisions: { create: { number: 1, content: {}, reason: "test" } },
          },
        });
      });
    }
    const [alice, bob] = userIds;
    const bobCv = await withWorkspace(bob, () =>
      database().cv.findFirstOrThrow(),
    );
    const bobSource = await withWorkspace(bob, () =>
      database().source.findFirstOrThrow(),
    );
    await withWorkspace(alice, async () => {
      const db = database();
      expect(
        await db.cv.findUnique({
          where: { id: bobCv.id },
          include: { revisions: true },
        }),
      ).toBeNull();
      expect((await db.cv.findMany()).every((cv) => cv.ownerId === alice)).toBe(
        true,
      );
      expect(
        await db.profile.findUnique({ where: { id: "main" } }),
      ).toMatchObject({ id: alice });
      await expect(
        db.cv.update({ where: { id: bobCv.id }, data: { title: "stolen" } }),
      ).rejects.toThrow();
      expect((await db.cv.deleteMany({ where: { id: bobCv.id } })).count).toBe(
        0,
      );
      await expect(
        db.evidence.create({
          data: {
            title: "cross-owner",
            kind: "note",
            text: "no",
            tags: [],
            sourceId: bobSource.id,
          },
        }),
      ).rejects.toThrow();
      await db.$transaction(async (tx) => {
        expect(await tx.cv.findUnique({ where: { id: bobCv.id } })).toBeNull();
        const ownCv = await tx.cv.findFirstOrThrow({
          include: { revisions: true },
        });
        expect(ownCv.revisions[0].ownerId).toBe(alice);
        expect(
          await tx.cvRevision.findUnique({
            where: { cvId_number: { cvId: bobCv.id, number: 1 } },
          }),
        ).toBeNull();
      });
    });
    const anonymous = await handle(
      new Request("http://127.0.0.1:3000/api/sources"),
      ["sources"],
    );
    expect(anonymous.status).toBe(401);
    const sources = await handle(
      new Request("http://127.0.0.1:3000/api/sources", {
        headers: { cookie: cookies },
      }),
      ["sources"],
    );
    expect(sources.status).toBe(200);
    expect(
      (await sources.json()).map((source: { name: string }) => source.name),
    ).toEqual(["alice"]);
    const forbidden = await handle(
      new Request("http://127.0.0.1:3000/api/sources/" + bobSource.id, {
        headers: { cookie: cookies },
      }),
      ["sources", bobSource.id],
    );
    expect(forbidden.status).toBe(404);
    const signedOut = await auth.handler(
      new Request("http://127.0.0.1:3000/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: cookies,
          Origin: "http://127.0.0.1:3000",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    expect(signedOut.status).toBe(200);
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: cookies }) }),
    ).toBeNull();
  },
  30000,
);
