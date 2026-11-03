import { Router, type Request, type Response } from "express";
import { MongoServerError } from "mongodb";

import { getDB } from "../config/db.js";
import type { NewsletterSubscriber } from "../models/newsletter.model.js";

const router = Router();

router.post(
  "/subscribe",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const input = req.body?.email;

      if (typeof input !== "string") {
        res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
        return;
      }

      const email = input.trim().toLowerCase();

      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        res.status(400).json({
          success: false,
          message: "Please enter a valid email address.",
        });
        return;
      }

      const collection = getDB().collection<NewsletterSubscriber>(
        "newsletterSubscribers"
      );

      await collection.insertOne({
        email,
        subscribedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Successfully subscribed to our newsletter!",
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        res.status(409).json({
          success: false,
          message: "This email is already subscribed.",
        });
        return;
      }

      console.error("Newsletter error:", error);

      res.status(500).json({
        success: false,
        message: "Unable to subscribe. Please try again.",
      });
    }
  }
);

export default router;