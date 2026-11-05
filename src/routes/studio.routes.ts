import { Router, type Request, type Response } from "express";
import { ObjectId, type Document } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { getDB } from "../config/db.js";

const router = Router();

async function getAuthenticatedUser(req: Request) {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
}

function isValidId(id: unknown): id is string {
  return typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidImageArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((image) => {
      if (typeof image !== "string" || !image.trim()) {
        return false;
      }

      try {
        const url = new URL(image.trim());
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    })
  );
}

function normalizeImages(images: string[]): string[] {
  return Array.from(new Set(images.map((image) => image.trim())));
}

function isValidNumber(
  value: unknown,
  minimum: number
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum
  );
}

function isValidCapacity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function isValidAmenities(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (amenity) =>
        typeof amenity === "string" && amenity.trim().length > 0
    )
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// CREATE STUDIO
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
      securityDeposit,
      capacity,
      amenities,
    } = req.body ?? {};

    if (
      !isNonEmptyString(name) ||
      !isNonEmptyString(description) ||
      !isNonEmptyString(category) ||
      !isNonEmptyString(location) ||
      !isValidNumber(price, 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid required studio fields.",
      });
    }

    if (images !== undefined && !isValidImageArray(images)) {
      return res.status(400).json({
        success: false,
        message: "Images must be an array of valid HTTP or HTTPS URLs.",
      });
    }

    if (
      securityDeposit !== undefined &&
      !isValidNumber(securityDeposit, 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid security deposit.",
      });
    }

    if (capacity !== undefined && !isValidCapacity(capacity)) {
      return res.status(400).json({
        success: false,
        message: "Capacity must be a positive whole number.",
      });
    }

    if (amenities !== undefined && !isValidAmenities(amenities)) {
      return res.status(400).json({
        success: false,
        message: "Amenities must be an array of non-empty strings.",
      });
    }

    const now = new Date();

    const studio = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location.trim(),
      price,
      images: images === undefined ? [] : normalizeImages(images),
      securityDeposit: securityDeposit ?? 0,
      capacity: capacity ?? null,
      amenities:
        amenities === undefined
          ? []
          : amenities.map((amenity: string) => amenity.trim()),
      ownerId: session.user.id,
      ownerName: session.user.name ?? "",
      ownerEmail: session.user.email ?? "",
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const result = await getDB()
      .collection("studios")
      .insertOne(studio);

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

// GET MY STUDIO LISTINGS
const getMyStudios = async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const studios = await getDB()
      .collection("studios")
      .find({ ownerId: session.user.id })
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
};

router.get("/my-listings", getMyStudios);
router.get("/my", getMyStudios);

// GET ALL STUDIOS
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
      (minPrice !== undefined && !isValidNumber(minPrice, 0)) ||
      (maxPrice !== undefined && !isValidNumber(maxPrice, 0)) ||
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

// GET SINGLE STUDIO
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studio ID.",
      });
    }

    const studio = await getDB()
      .collection("studios")
      .findOne({ _id: new ObjectId(id) });

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

// UPDATE STUDIO
const updateStudio = async (req: Request, res: Response) => {
  try {
    const session = await getAuthenticatedUser(req);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    const id = req.params.id;

    if (!isValidId(id)) {
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
      securityDeposit,
      capacity,
      amenities,
    } = req.body ?? {};

    const updates: Record<string, unknown> = {};

    const stringFields = {
      name,
      description,
      category,
      location,
    };

    for (const [key, value] of Object.entries(stringFields)) {
      if (value !== undefined) {
        if (!isNonEmptyString(value)) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${key}.`,
          });
        }

        updates[key] = value.trim();
      }
    }

    if (price !== undefined) {
      if (!isValidNumber(price, 0)) {
        return res.status(400).json({
          success: false,
          message: "Invalid price.",
        });
      }

      updates.price = price;
    }

    if (securityDeposit !== undefined) {
      if (!isValidNumber(securityDeposit, 0)) {
        return res.status(400).json({
          success: false,
          message: "Invalid security deposit.",
        });
      }

      updates.securityDeposit = securityDeposit;
    }

    if (capacity !== undefined) {
      if (!isValidCapacity(capacity)) {
        return res.status(400).json({
          success: false,
          message: "Invalid capacity.",
        });
      }

      updates.capacity = capacity;
    }

    if (amenities !== undefined) {
      if (!isValidAmenities(amenities)) {
        return res.status(400).json({
          success: false,
          message: "Invalid amenities.",
        });
      }

      updates.amenities = amenities.map((amenity) => amenity.trim());
    }

    if (images !== undefined) {
      if (!isValidImageArray(images)) {
        return res.status(400).json({
          success: false,
          message: "Images must be an array of valid HTTP or HTTPS URLs.",
        });
      }

      // Replace the saved images with the submitted array.
      // Remove whitespace and exact duplicate URLs.
      updates.images = normalizeImages(images);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    updates.updatedAt = new Date();

    const collection = getDB().collection("studios");
    const filter = {
      _id: new ObjectId(id),
      ownerId: session.user.id,
    };

    const result = await collection.updateOne(filter, {
      $set: updates,
    });

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Studio not found or you are not the owner.",
      });
    }

    const updatedStudio = await collection.findOne(filter);

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
};

router.patch("/:id", updateStudio);
router.put("/:id", updateStudio);

// DELETE STUDIO
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

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid studio ID.",
      });
    }

    const result = await getDB()
      .collection("studios")
      .deleteOne({
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