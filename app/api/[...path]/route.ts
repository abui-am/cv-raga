import { handle } from "@/lib/server/api";

async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handle(request, (await context.params).path);
}
export { route as GET, route as POST, route as PATCH, route as DELETE };
