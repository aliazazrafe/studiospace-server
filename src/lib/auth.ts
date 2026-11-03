
import "dotenv/config";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { client, database } from "../config/db.js";

const isProduction = process.env.NODE_ENV === "production";

const backendURL =
  process.env.BETTER_AUTH_URL || "http://localhost:5000";

const frontendURL =
  process.env.CLIENT_URL || "http://localhost:3000";

export const auth = betterAuth({
  // MongoDB connection
  database: mongodbAdapter(database, {
    client,
  }),

  // Better Auth server URL
  baseURL: backendURL,

  // Authentication secret
  secret: process.env.BETTER_AUTH_SECRET,

  // Allowed frontend origins
  trustedOrigins: [
    frontendURL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://studiospace-client-rho.vercel.app",
  ],

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Session cookie configuration
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
    },
  },
});
