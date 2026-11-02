
import { Router, type Request, type Response } from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { getDB } from "../config/db.js";

const router = Router();

// Check authenticated user
async function getAuthenticatedUser(req: Request) {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}

// Create a new studio
router.post("/", async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const {
      name,
      description,
      category,
      location,
      price,
      images,
    } = req.body;

    if (
      !name ||
      !description ||
      !category ||
      !location ||
      price === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields.",
      });
    }

    if (
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price.",
      });
    }

    const studio = {
      name,
      description,
      category,
      location,
      price,
      images: Array.isArray(images) ? images : [],
      ownerId: session.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = getDB();
    const result = await db.collection("studios").insertOne(studio);

    return res.status(201).json({
      success: true,
      message: "Studio created successfully.",
      studio: {
        ...studio,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Create studio error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create studio.",
    });
  }
});

// Get all studios
router.get("/", async (_req: Request, res: Response) => {
  try {
    const db = getDB();

    const studios = await db
      .collection("studios")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: studios.length,
      studios,
    });
  } catch (error) {
    console.error("Get studios error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch studios.",
    });
  }
});

// Get single studio by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studio ID.",
      });
    }

    const db = getDB();

    const studio = await db.collection("studios").findOne({
      _id: new ObjectId(id),
    });

    if (!studio) {
      return res.status(404).json({
        success: false,
        message: "Studio not found.",
      });
    }

    return res.status(200).json({
      success: true,
      studio,
    });
  } catch (error) {
    console.error("Get single studio error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch studio.",
    });
  }
});

// Update studio
router.patch("/:id", async (req: Request, res: Response) => {
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
        message: "Invalid studio ID.",
      });
    }

    const {
      name,
      description,
      category,
      location,
      price,
      images,
    } = req.body;

    const updates: Record<string, unknown> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (location !== undefined) updates.location = location;
    if (images !== undefined) updates.images = images;

    if (price !== undefined) {
      if (
        typeof price !== "number" ||
        !Number.isFinite(price) ||
        price < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid price.",
        });
      }

      updates.price = price;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    updates.updatedAt = new Date();

    const db = getDB();

    const result = await db.collection("studios").updateOne(
      {
        _id: new ObjectId(id),
        ownerId: session.user.id,
      },
      {
        $set: updates,
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Studio not found or you are not the owner.",
      });
    }

    const updatedStudio = await db.collection("studios").findOne({
      _id: new ObjectId(id),
    });

    return res.status(200).json({
      success: true,
      message: "Studio updated successfully.",
      studio: updatedStudio,
    });
  } catch (error) {
    console.error("Update studio error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update studio.",
    });
  }
});

// Delete studio
router.delete("/:id", async (req: Request, res: Response) => {
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
        message: "Invalid studio ID.",
      });
    }

    const db = getDB();

    const result = await db.collection("studios").deleteOne({
      _id: new ObjectId(id),
      ownerId: session.user.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Studio not found or you are not the owner.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Studio deleted successfully.",
    });
  } catch (error) {
    console.error("Delete studio error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete studio.",
    });
  }
});

export default router;
