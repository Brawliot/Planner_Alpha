import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

// Solo tipos: el cliente sabe que el registro admite lastName. No importa código del servidor.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});