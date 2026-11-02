
import "dotenv/config";
import dns from "node:dns";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";

import { connectDB } from "./config/db.js";
import { auth } from "./lib/auth.js";
import studioRoutes from "./routes/studio.routes.js";
import bookingRoutes from "./routes/booking.routes.js";

// MongoDB Atlas DNS configuration
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:3000",
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
  })
);

// Middleware
app.use(express.json());
app.use(cookieParser());

// BetterAuth routes
app.all("/api/auth/{*any}", toNodeHandler(auth));

// Studio API
app.use("/api/studios", studioRoutes);

// Booking API
app.use("/api/bookings", bookingRoutes);

// Health check
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "StudioSpace API is running",
  });
});

// Start server
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `StudioSpace server running on http://localhost:${PORT}`
      );

      console.log(
        `BetterAuth running at http://localhost:${PORT}/api/auth`
      );

      console.log(
        `Studio API running at http://localhost:${PORT}/api/studios`
      );

      console.log(
        `Booking API running at http://localhost:${PORT}/api/bookings`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();
