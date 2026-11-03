

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { client, database } from "../config/db.js";

export const auth = betterAuth({
  database: mongodbAdapter(database, {
    client,
  }),

  baseURL:
    process.env.BETTER_AUTH_URL ||
    "http://localhost:5000",

  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://studiospace-client-rho.vercel.app",
  ],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
});
