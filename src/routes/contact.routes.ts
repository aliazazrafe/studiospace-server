
import { Router, type Request, type Response } from "express";
import { getDB } from "../config/db.js";

const router = Router();

const allowedSubjects = [
  "Booking Support",
  "Studio Listing",
  "Payment Issue",
  "General Inquiry",
  "Other",
];

router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body ?? {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof subject !== "string" ||
      typeof message !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (
      !cleanName ||
      !cleanEmail ||
      !cleanSubject ||
      !cleanMessage
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    if (cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must be 100 characters or less.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      cleanEmail.length > 254 ||
      !emailRegex.test(cleanEmail)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (!allowedSubjects.includes(cleanSubject)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid subject.",
      });
    }

    if (
      cleanMessage.length < 10 ||
      cleanMessage.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 10 to 5000 characters.",
      });
    }

    const contactMessage = {
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      status: "unread",
      createdAt: new Date(),
    };

    const db = getDB();

    const result = await db
      .collection("contactMessages")
      .insertOne(contactMessage);

    return res.status(201).json({
      success: true,
      message: "Your message has been sent successfully!",
      contactId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error("Contact message error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again.",
    });
  }
});

export default router;
