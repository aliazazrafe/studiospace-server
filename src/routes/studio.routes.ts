
import { Router, type Request, type Response } from "express";
import { ObjectId, type Document } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { getDB } from "../config/db.js";

const router = Router();

// Authentication helper
async function getAuthenticatedUser(req: Request) {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}

// 1. Create Studio
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

// 2. Get My Studio Listings
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

    const studios = await db
      .collection("studios")
      .find({
        ownerId: session.user.id,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: studios.length,
      studios,
    });
  } catch (error) {
    console.error("Get my studios error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your studio listings.",
    });
  }
});

// 3. Get All Studios with Search, Filter, Sorting and Pagination
router.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDB();

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";

    const location =
      typeof req.query.location === "string"
        ? req.query.location.trim()
        : "";

    const minPrice =
      typeof req.query.minPrice === "string" &&
      req.query.minPrice.trim() !== ""
        ? Number(req.query.minPrice)
        : undefined;

    const maxPrice =
      typeof req.query.maxPrice === "string" &&
      req.query.maxPrice.trim() !== ""
        ? Number(req.query.maxPrice)
        : undefined;

    const page =
      typeof req.query.page === "string"
        ? Number(req.query.page)
        : 1;

    const limit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : 6;

    const sortBy =
      typeof req.query.sortBy === "string"
        ? req.query.sortBy
        : "newest";

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit.",
      });
    }

    if (
      (minPrice !== undefined &&
        (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined &&
        (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (minPrice !== undefined &&
        maxPrice !== undefined &&
        minPrice > maxPrice)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price range.",
      });
    }

    if (!["newest", "price-low", "price-high"].includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sorting option.",
      });
    }

    const escapeRegex = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const filter: Document = {};

    if (search) {
      filter.name = {
        $regex: escapeRegex(search),
        $options: "i",
      };
    }

    if (category) {
      filter.category = {
        $regex: `^${escapeRegex(category)}$`,
        $options: "i",
      };
    }

    if (location) {
      filter.location = {
        $regex: escapeRegex(location),
        $options: "i",
      };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};

      if (minPrice !== undefined) {
        priceFilter.$gte = minPrice;
      }

      if (maxPrice !== undefined) {
        priceFilter.$lte = maxPrice;
      }

      filter.price = priceFilter;
    }

    const sortOptions: Record<string, 1 | -1> =
      sortBy === "price-low"
        ? { price: 1 }
        : sortBy === "price-high"
          ? { price: -1 }
          : { createdAt: -1 };

    const safeLimit = Math.min(limit, 50);
    const skip = (page - 1) * safeLimit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        success: false,
        message: "Page number is too large.",
      });
    }

    const [studios, total] = await Promise.all([
      db
        .collection("studios")
        .find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(safeLimit)
        .toArray(),

      db.collection("studios").countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / safeLimit);

    return res.status(200).json({
      success: true,
      count: studios.length,
      pagination: {
        total,
        page,
        limit: safeLimit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
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

// 4. Get Single Studio
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

// 5. Update Studio
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

    if (images !== undefined) {
      if (!Array.isArray(images)) {
        return res.status(400).json({
          success: false,
          message: "Images must be an array.",
        });
      }

      updates.images = images;
    }

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

// 6. Delete Studio
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
