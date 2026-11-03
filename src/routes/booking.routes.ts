
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { getDB } from "../config/db.js";
import type {
  Booking,
  BookingStatus,
} from "../models/booking.model.js";

const router = Router();

async function getAuthenticatedUser(req: Request) {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-fA-F]{24}$/.test(value)
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unexpected error";
}

// Attach the real studio data to each booking.
// This keeps the existing booking fields unchanged.
async function enrichBookings<T extends Booking>(
  bookings: T[]
) {
  if (bookings.length === 0) return [];

  const db = getDB();

  const studioIds = [
    ...new Set(
      bookings
        .map((booking) => String(booking.studioId))
        .filter(validId)
    ),
  ];

  const studios = await db
    .collection("studios")
    .find({
      _id: {
        $in: studioIds.map((id) => new ObjectId(id)),
      },
    })
    .project({
      name: 1,
      category: 1,
      location: 1,
      images: 1,
      image: 1,
      description: 1,
      price: 1,
    })
    .toArray();

  const studioMap = new Map(
    studios.map((studio) => [
      String(studio._id),
      studio,
    ])
  );

  return bookings.map((booking) => {
    const studio = studioMap.get(
      String(booking.studioId)
    );

    const imageList = Array.isArray(studio?.images)
      ? studio.images.filter(
          (image): image is string =>
            typeof image === "string" &&
            image.trim().length > 0
        )
      : [];

    if (
      imageList.length === 0 &&
      typeof studio?.image === "string" &&
      studio.image.trim()
    ) {
      imageList.push(studio.image);
    }

    const studioInfo = studio
      ? {
          _id: studio._id,
          name: String(
            studio.name ?? booking.studioName ?? "Studio"
          ),
          category: String(
            studio.category ?? "Studio"
          ),
          location: String(
            studio.location ?? "Location unavailable"
          ),
          images: imageList,
          description: String(
            studio.description ?? ""
          ),
          price: Number(studio.price ?? 0),
        }
      : undefined;

    const durationHours =
      (new Date(booking.endAt).getTime() -
        new Date(booking.startAt).getTime()) /
      3600000;

    // Older bookings have only "price".
    // For those, use the stored hourly rate.
    const storedTotal = (
      booking as Booking & {
        totalPrice?: number;
      }
    ).totalPrice;

    const totalPrice =
      typeof storedTotal === "number" &&
      Number.isFinite(storedTotal)
        ? storedTotal
        : Number.isFinite(durationHours) &&
            durationHours > 0
          ? Math.round(
              Number(booking.price ?? 0) *
                durationHours *
                100
            ) / 100
          : null;

    return {
      ...booking,
      studio: studioInfo,
      studioName:
        studioInfo?.name ??
        booking.studioName ??
        "Studio",
      category: studioInfo?.category ?? "Studio",
      location:
        studioInfo?.location ??
        "Location unavailable",
      image: studioInfo?.images?.[0] ?? "",
      totalPrice,
    };
  });
}

// 1. CREATE BOOKING
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const { studioId, startAt, endAt } =
      req.body ?? {};

    if (
      !validId(studioId) ||
      typeof startAt !== "string" ||
      typeof endAt !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide a valid studio ID and booking dates.",
      });
    }

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    const durationHours =
      (endDate.getTime() - startDate.getTime()) /
      3600000;

    if (
      !Number.isFinite(durationHours) ||
      startDate <= new Date() ||
      endDate <= startDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide valid future booking dates.",
      });
    }

    const db = getDB();

    const studio = await db
      .collection("studios")
      .findOne({
        _id: new ObjectId(studioId),
      });

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio not found.",
      });
    }

    if (
      String(studio.ownerId) === session.user.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot book your own studio.",
      });
    }

    const hourlyPrice = Number(studio.price);

    if (
      !Number.isFinite(hourlyPrice) ||
      hourlyPrice <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This studio does not have a valid hourly price.",
      });
    }

    // Reject overlapping confirmed bookings.
    const conflict = await db
      .collection<Booking>("bookings")
      .findOne({
        studioId: new ObjectId(studioId),
        status: "confirmed",
        startAt: { $lt: endDate },
        endAt: { $gt: startDate },
      });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message:
          "This studio already has a confirmed booking during the selected time.",
      });
    }

    const totalPrice =
      Math.round(
        hourlyPrice * durationHours * 100
      ) / 100;

    const now = new Date();

    const booking: Booking & {
      totalPrice: number;
    } = {
      studioId: new ObjectId(studioId),
      studioName: String(studio.name),
      userId: session.user.id,
      ownerId: String(studio.ownerId),
      startAt: startDate,
      endAt: endDate,
      price: hourlyPrice,
      totalPrice,
      status: "pending",
      createdAt: now,
      updatedAt: now,
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
    console.error(
      "Create booking error:",
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create booking.",
    });
  }
});

// 2. GET MY BOOKINGS
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
      .find({
        userId: session.user.id,
      })
      .sort({ createdAt: -1 })
      .toArray();

    const enrichedBookings =
      await enrichBookings(bookings);

    return res.status(200).json({
      success: true,
      count: enrichedBookings.length,
      bookings: enrichedBookings,
    });
  } catch (error) {
    console.error(
      "Get my bookings error:",
      getErrorMessage(error)
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings.",
    });
  }
});

// 3. GET OWNER BOOKINGS
router.get(
  "/owner",
  async (req: Request, res: Response) => {
    try {
      const session =
        await getAuthenticatedUser(req);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Please login first.",
        });
      }

      const db = getDB();

      const bookings = await db
        .collection<Booking>("bookings")
        .find({
          ownerId: session.user.id,
        })
        .sort({ createdAt: -1 })
        .toArray();

      const enrichedBookings =
        await enrichBookings(bookings);

      return res.status(200).json({
        success: true,
        count: enrichedBookings.length,
        bookings: enrichedBookings,
      });
    } catch (error) {
      console.error(
        "Get owner bookings error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch owner bookings.",
      });
    }
  }
);

// 4. DASHBOARD STATISTICS
router.get(
  "/dashboard",
  async (req: Request, res: Response) => {
    try {
      const session =
        await getAuthenticatedUser(req);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Please login first.",
        });
      }

      const db = getDB();
      const userId = session.user.id;

      const myBookingFilter = { userId };
      const ownerBookingFilter = {
        ownerId: userId,
      };

      const [
        totalStudios,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        rejectedBookings,
        cancelledBookings,
        completedBookings,
        receivedBookings,
        ownerPendingBookings,
        ownerConfirmedBookings,
        ownerRejectedBookings,
        ownerCancelledBookings,
        ownerCompletedBookings,
      ] = await Promise.all([
        db.collection("studios").countDocuments({
          ownerId: userId,
        }),
        db.collection("bookings").countDocuments(
          myBookingFilter
        ),
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
        db.collection("bookings").countDocuments({
          ...myBookingFilter,
          status: "completed",
        }),
        db.collection("bookings").countDocuments(
          ownerBookingFilter
        ),
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
        db.collection("bookings").countDocuments({
          ...ownerBookingFilter,
          status: "completed",
        }),
      ]);

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
            completed: completedBookings,
          },
          ownerBookings: {
            total: receivedBookings,
            pending: ownerPendingBookings,
            confirmed: ownerConfirmedBookings,
            rejected: ownerRejectedBookings,
            cancelled: ownerCancelledBookings,
            completed: ownerCompletedBookings,
          },
          recentBookings:
            await enrichBookings(recentBookings),
        },
      });
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch dashboard statistics.",
      });
    }
  }
);

// 5. GET SINGLE BOOKING
router.get(
  "/:id",
  async (req: Request, res: Response) => {
    try {
      const session =
        await getAuthenticatedUser(req);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Please login first.",
        });
      }

      const id = req.params.id;

      if (!validId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID.",
        });
      }

      const db = getDB();

      const booking = await db
        .collection<Booking>("bookings")
        .findOne({
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

      const [enrichedBooking] =
        await enrichBookings([booking]);

      return res.status(200).json({
        success: true,
        booking: enrichedBooking,
      });
    } catch (error) {
      console.error(
        "Get booking error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch booking.",
      });
    }
  }
);

// 6. CANCEL BOOKING
router.patch(
  "/:id/cancel",
  async (req: Request, res: Response) => {
    try {
      const session =
        await getAuthenticatedUser(req);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Please login first.",
        });
      }

      const id = req.params.id;

      if (!validId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID.",
        });
      }

      const db = getDB();

      // Only the customer can cancel their
      // own pending future booking.
      const result = await db
        .collection<Booking>("bookings")
        .updateOne(
          {
            _id: new ObjectId(id),
            userId: session.user.id,
            status: "pending",
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
        return res.status(409).json({
          success: false,
          message:
            "Only your own pending future bookings can be cancelled.",
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Booking cancelled successfully.",
      });
    } catch (error) {
      console.error(
        "Cancel booking error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to cancel booking.",
      });
    }
  }
);

// 7. OWNER CONFIRM OR REJECT BOOKING
router.patch(
  "/:id/status",
  async (req: Request, res: Response) => {
    try {
      const session =
        await getAuthenticatedUser(req);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Please login first.",
        });
      }

      const id = req.params.id;
      const { status } = req.body ?? {};

      if (!validId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID.",
        });
      }

      if (
        status !== "confirmed" &&
        status !== "rejected"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be confirmed or rejected.",
        });
      }

      const db = getDB();

      const booking = await db
        .collection<Booking>("bookings")
        .findOne({
          _id: new ObjectId(id),
          ownerId: session.user.id,
          status: "pending",
        });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message:
            "Pending booking not found or you are not the owner.",
        });
      }

      if (status === "confirmed") {
        const overlapping = await db
          .collection<Booking>("bookings")
          .findOne({
            _id: {
              $ne: new ObjectId(id),
            },
            studioId: booking.studioId,
            status: "confirmed",
            startAt: {
              $lt: booking.endAt,
            },
            endAt: {
              $gt: booking.startAt,
            },
          });

        if (overlapping) {
          return res.status(409).json({
            success: false,
            message:
              "Another confirmed booking overlaps this time.",
          });
        }
      }

      const result = await db
        .collection<Booking>("bookings")
        .updateOne(
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
        return res.status(409).json({
          success: false,
          message:
            "Booking status has already changed.",
        });
      }

      const updatedBooking = await db
        .collection<Booking>("bookings")
        .findOne({
          _id: new ObjectId(id),
        });

      return res.status(200).json({
        success: true,
        message:
          `Booking ${status} successfully.`,
        booking: updatedBooking,
      });
    } catch (error) {
      console.error(
        "Update booking status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update booking status.",
      });
    }
  }
);

export default router;
