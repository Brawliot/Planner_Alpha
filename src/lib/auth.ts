import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { haveIBeenPwned } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "../db";
import * as schema from "../db/schema";
import { APIError, createAuthMiddleware } from "better-auth/api";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
    hooks: {
    before: createAuthMiddleware(async (ctx) => {
    if (ctx.path !== "/sign-up/email" && ctx.path !== "/update-user") {
        return;
    }
    const { name, email, image } = ctx.body ?? {};

    if (ctx.path === "/sign-up/email" || name !== undefined) {
        if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
        throw new APIError("BAD_REQUEST", {
            message: "El nombre debe tener entre 1 y 100 caracteres",
        });
        }
    }
    if (typeof email === "string" && email.length > 254) {
        throw new APIError("BAD_REQUEST", { message: "El email es demasiado largo" });
    }
    if (image !== undefined && image !== null && (typeof image !== "string" || image.length > 2048)) {
        throw new APIError("BAD_REQUEST", { message: "La imagen no es válida" });
    }
    }),
    },
  plugins: [
    haveIBeenPwned({
      customPasswordCompromisedMessage:
        "Esta contraseña ha aparecido en filtraciones de datos. Elige otra.",
    }),
    // Para que las Server Actions puedan escribir las cookies de sesión. Debe ir el último.
    nextCookies(),
  ],
});