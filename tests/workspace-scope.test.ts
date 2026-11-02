import { describe, expect, it } from "vitest";
import { scopeOperation } from "@/lib/server/workspace-scope";
import { workspaceId, withWorkspace } from "@/lib/server/workspace";

describe("private workspace boundaries", () => {
  it("fails closed without an authenticated context", () => {
    expect(() => workspaceId()).toThrow("Sign in");
  });
  it("keeps concurrent asynchronous contexts separate", async () => {
    const ids = await Promise.all(
      ["alice", "bob"].map((id) =>
        withWorkspace(id, async () => {
          await Promise.resolve();
          return workspaceId();
        }),
      ),
    );
    expect(ids).toEqual(["alice", "bob"]);
  });
  it.each([
    "findUnique",
    "findMany",
    "update",
    "updateMany",
    "delete",
    "deleteMany",
    "count",
    "aggregate",
  ])("scopes %s even when another owner is requested", (operation) => {
    const args = {
      where: { id: "other-record", ownerId: "bob" },
      data: { title: "changed" },
    };
    scopeOperation("Cv", operation, args, "alice");
    expect(args.where).toEqual({ id: "other-record", ownerId: "alice" });
  });
  it("stamps nested records and bulk creates", () => {
    const args = {
      data: { ownerId: "bob", revisions: { create: [{ number: 1 }] } },
    };
    scopeOperation("Cv", "create", args, "alice");
    expect(args.data).toEqual({
      ownerId: "alice",
      revisions: { create: [{ number: 1, ownerId: "alice" }] },
    });
    const bulk = { data: [{ text: "one" }, { text: "two" }] };
    scopeOperation("Evidence", "createMany", bulk, "alice");
    expect(
      bulk.data.every((row) => "ownerId" in row && row.ownerId === "alice"),
    ).toBe(true);
  });
  it("rejects ownership transfers and unscoped nested changes", () => {
    expect(() =>
      scopeOperation("Cv", "update", { data: { ownerId: "bob" } }, "alice"),
    ).toThrow();
    expect(() =>
      scopeOperation(
        "Cv",
        "update",
        { data: { revisions: { updateMany: {} } } },
        "alice",
      ),
    ).toThrow();
    expect(() =>
      scopeOperation(
        "Cv",
        "create",
        { data: { application: { connect: { id: "bob" } } } },
        "alice",
      ),
    ).toThrow();
    expect(() => scopeOperation("User", "findMany", {}, "alice")).toThrow();
  });
  it("assigns a different profile identity to each user", () => {
    const args = { where: { id: "main" } };
    scopeOperation("Profile", "findUnique", args, "alice");
    expect(args.where).toEqual({ id: "alice", ownerId: "alice" });
  });
});
