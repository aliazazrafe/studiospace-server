
import "dotenv/config";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { client, database } from "../config/db.js";

const isProduction = process.env.NODE_ENV === "production";

const backendURL =
  process.env.BETTER_AUTH_URL || "http://localhost:5000";

const frontendURL =
  process.env.CLIENT_URL || "http://localhost:3000";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: mongodbAdapter(database, {
    client,
  }),

  baseURL: backendURL,

  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [
    frontendURL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://studiospace-client-rho.vercel.app",
  ],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
  },

  // Link Google to an existing account with the same verified email
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
    },
  },
});
