import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { HttpError } from "./http";

const workspace = new AsyncLocalStorage<string>();
export function withWorkspace<T>(userId: string, run: () => T): T {
  return workspace.run(userId, run);
}
export function workspaceId() {
  const id = workspace.getStore();
  if (!id) throw new HttpError(401, "Sign in to continue.");
  return id;
}
