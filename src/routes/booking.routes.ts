
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { getDB } from "../config/db.js";
import type { Booking, BookingStatus } from "../models/booking.model.js";

const router = Router();

// Authentication helper
async function getAuthenticatedUser(req: Request) {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}

// 1. Create Booking
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const { studioId, startAt, endAt } = req.body;

    if (
      typeof studioId !== "string" ||
      !ObjectId.isValid(studioId) ||
      !startAt ||
      !endAt
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid studio ID and booking dates.",
      });
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate <= new Date() ||
      endDate <= startDate
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid future booking dates.",
      });
    }

    const db = getDB();

    const studio = await db.collection("studios").findOne({
      _id: new ObjectId(studioId),
    });

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio not found.",
      });
    }

    if (String(studio.ownerId) === session.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot book your own studio.",
      });
    }

    // Check overlapping bookings
    const existingBooking = await db
      .collection<Booking>("bookings")
      .findOne({
        studioId: new ObjectId(studioId),
        status: { $in: ["pending", "confirmed"] },
        startAt: { $lt: endDate },
        endAt: { $gt: startDate },
      });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "Studio is already booked for this time.",
      });
    }

    const booking: Booking = {
      studioId: new ObjectId(studioId),
      studioName: String(studio.name),
      userId: session.user.id,
      ownerId: String(studio.ownerId),
      startAt: startDate,
      endAt: endDate,
      price: Number(studio.price),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .collection<Booking>("bookings")
      .insertOne(booking);

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      booking: {
        ...booking,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create booking.",
    });
  }
});

// 2. Get My Bookings
router.get("/my", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const db = getDB();

    const bookings = await db
      .collection<Booking>("bookings")
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
    });
  }
});

// 3. Get Owner Bookings
router.get("/owner", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const db = getDB();

    const bookings = await db
      .collection<Booking>("bookings")
      .find({ ownerId: session.user.id })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get owner bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch owner bookings.",
    });
  }
});

// 4. Dashboard Statistics
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const db = getDB();
    const userId = session.user.id;

    // Total studios owned by user
    const totalStudios = await db
      .collection("studios")
      .countDocuments({
        ownerId: userId,
      });

    // Customer booking statistics
    const myBookingFilter = {
      userId,
    };

    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      rejectedBookings,
      cancelledBookings,
    ] = await Promise.all([
      db.collection("bookings").countDocuments(myBookingFilter),

      db.collection("bookings").countDocuments({
        ...myBookingFilter,
        status: "pending",
      }),

      db.collection("bookings").countDocuments({
        ...myBookingFilter,
        status: "confirmed",
      }),

      db.collection("bookings").countDocuments({
        ...myBookingFilter,
        status: "rejected",
      }),

      db.collection("bookings").countDocuments({
        ...myBookingFilter,
        status: "cancelled",
      }),
    ]);

    // Owner booking statistics
    const ownerBookingFilter = {
      ownerId: userId,
    };

    const [
      receivedBookings,
      ownerPendingBookings,
      ownerConfirmedBookings,
      ownerRejectedBookings,
      ownerCancelledBookings,
    ] = await Promise.all([
      db.collection("bookings").countDocuments(ownerBookingFilter),

      db.collection("bookings").countDocuments({
        ...ownerBookingFilter,
        status: "pending",
      }),

      db.collection("bookings").countDocuments({
        ...ownerBookingFilter,
        status: "confirmed",
      }),

      db.collection("bookings").countDocuments({
        ...ownerBookingFilter,
        status: "rejected",
      }),

      db.collection("bookings").countDocuments({
        ...ownerBookingFilter,
        status: "cancelled",
      }),
    ]);

    // Recent bookings
    const recentBookings = await db
      .collection<Booking>("bookings")
      .find({
        $or: [
          { userId },
          { ownerId: userId },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return res.status(200).json({
      success: true,
      dashboard: {
        studios: {
          total: totalStudios,
        },

        myBookings: {
          total: totalBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings,
          rejected: rejectedBookings,
          cancelled: cancelledBookings,
        },

        ownerBookings: {
          total: receivedBookings,
          pending: ownerPendingBookings,
          confirmed: ownerConfirmedBookings,
          rejected: ownerRejectedBookings,
          cancelled: ownerCancelledBookings,
        },

        recentBookings,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics.",
    });
  }
});

// 5. Get Single Booking
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    const booking = await db.collection<Booking>("bookings").findOne({
      _id: new ObjectId(id),
      $or: [
        { userId: session.user.id },
        { ownerId: session.user.id },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found.",
      });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Get booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking.",
    });
  }
});

// 6. Cancel Booking
router.patch("/:id/cancel", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    const db = getDB();

    const result = await db.collection<Booking>("bookings").updateOne(
      {
        _id: new ObjectId(id),
        userId: session.user.id,
        status: { $in: ["pending", "confirmed"] },
        startAt: { $gt: new Date() },
      },
      {
        $set: {
          status: "cancelled",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or cannot be cancelled.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking.",
    });
  }
});

// 7. Owner Confirm or Reject Booking
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const id = req.params.id;
    const { status } = req.body;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID.",
      });
    }

    if (status !== "confirmed" && status !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Status must be confirmed or rejected.",
      });
    }

    const db = getDB();

    const result = await db.collection<Booking>("bookings").updateOne(
      {
        _id: new ObjectId(id),
        ownerId: session.user.id,
        status: "pending",
      },
      {
        $set: {
          status: status as BookingStatus,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending booking not found or you are not the owner.",
      });
    }

    const updatedBooking = await db
      .collection<Booking>("bookings")
      .findOne({
        _id: new ObjectId(id),
      });

    return res.status(200).json({
      success: true,
      message: `Booking ${status} successfully.`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Update booking status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update booking status.",
    });
  }
});

export default router;
