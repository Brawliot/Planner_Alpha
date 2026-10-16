import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  } catch (error) {
    console.error("proxy: no se pudo comprobar la sesión", error);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/registro"],
};