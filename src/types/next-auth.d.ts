import type { UserRole } from "@/db/schema";

declare module "next-auth" {
  interface User {
    role: UserRole;
    schoolId: string;
    mustChangePassword: boolean;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      schoolId: string;
      mustChangePassword: boolean;
    } & DefaultSessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    schoolId: string;
    mustChangePassword: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    schoolId: string;
    mustChangePassword: boolean;
  }
}

// Re-declare the built-in default session user shape (name/email/image) since we
// override `Session["user"]` above and TypeScript module augmentation replaces it wholesale.
type DefaultSessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};
