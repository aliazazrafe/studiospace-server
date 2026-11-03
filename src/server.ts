
import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";

import { connectDB, database } from "./config/db.js";
import { auth } from "./lib/auth.js";

import studioRoutes from "./routes/studio.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import newsletterRoutes from "./routes/newsletter.routes.js";

import type { NewsletterSubscriber } from "./models/newsletter.model.js";

// MongoDB Atlas DNS configuration
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://studiospace-client-rho.vercel.app",
];

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// Better Auth routes must come before express.json()
app.all("/api/auth/{*any}", toNodeHandler(auth));

// Middleware for other API routes
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "StudioSpace API is running",
  });
});

// Studio API
app.use("/api/studios", studioRoutes);

// Booking API
app.use("/api/bookings", bookingRoutes);

// Contact API
app.use("/api/contact", contactRoutes);

// Newsletter API
app.use("/api/newsletter", newsletterRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    await connectDB();

    // Prevent duplicate newsletter subscriptions
    await database
      .collection<NewsletterSubscriber>(
        "newsletterSubscribers"
      )
      .createIndex(
        { email: 1 },
        { unique: true }
      );

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(
        `StudioSpace server running on http://localhost:${PORT}`
      );

      console.log(
        `Better Auth running at http://localhost:${PORT}/api/auth`
      );

      console.log(
        `Studio API running at http://localhost:${PORT}/api/studios`
      );

      console.log(
        `Booking API running at http://localhost:${PORT}/api/bookings`
      );

      console.log(
        `Contact API running at http://localhost:${PORT}/api/contact`
      );

      console.log(
        `Newsletter API running at http://localhost:${PORT}/api/newsletter`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exitCode = 1;
  }
}

void startServer();
