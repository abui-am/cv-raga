import { getAuth } from "@/lib/server/auth";
export function GET(request: Request) {
  return getAuth().handler(request);
}
export function POST(request: Request) {
  return getAuth().handler(request);
}
