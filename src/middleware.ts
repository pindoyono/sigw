import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export function middleware(...args: Parameters<typeof auth>) {
  return auth(...args);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
