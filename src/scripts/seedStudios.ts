
import "dotenv/config";
import dns from "node:dns";
import { ObjectId } from "mongodb";

// MongoDB Atlas DNS configuration
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { client, connectDB, getDB } from "../config/db.js";

type Studio = {
  name: string;
  description: string;
  category: string;
  location: string;
  price: number;
  images: string[];
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

const newStudios = [
  {
    name: "Cinematic Production Stage",
    description:
      "A professional sound stage for film production, commercials, and creative video projects.",
    category: "Sound Stage",
    location: "Banani, Dhaka",
    price: 5000,
    images: [
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200",
    ],
  },
  {
    name: "Creative Podcast Studio",
    description:
      "A modern podcast recording studio with professional audio equipment and comfortable seating.",
    category: "Podcast Room",
    location: "Gulshan, Dhaka",
    price: 1800,
    images: [
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1200",
    ],
  },
  {
    name: "Professional Music Suite",
    description:
      "A premium music production studio for recording, mixing, and mastering.",
    category: "Music Suite",
    location: "Uttara, Dhaka",
    price: 3500,
    images: [
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200",
    ],
  },
  {
    name: "Modern Art Workshop",
    description:
      "A bright and inspiring creative workspace for painting, drawing, and art workshops.",
    category: "Art Workshop",
    location: "Dhanmondi, Dhaka",
    price: 1500,
    images: [
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200",
    ],
  },
];

async function seedStudios(): Promise<void> {
  try {
    await connectDB();

    const db = getDB();
    const studiosCollection = db.collection<Studio>("studios");

    // Find an existing studio owner.
    const existingStudio = await studiosCollection.findOne({
      ownerId: { $exists: true, $type: "string" },
    });

    if (!existingStudio?.ownerId) {
      throw new Error(
        "No existing studio owner found. Create a studio with a registered account first."
      );
    }

    const ownerId = existingStudio.ownerId;

    // Validate the owner in Better Auth's user collection.
    const ownerQueries: Record<string, unknown>[] = [
      { id: ownerId },
      { _id: ownerId },
    ];

    if (ObjectId.isValid(ownerId)) {
      ownerQueries.push({ _id: new ObjectId(ownerId) });
    }

    const owner = await db.collection("user").findOne({
      $or: ownerQueries,
    });

    if (!owner) {
      throw new Error(
        "Studio owner not found in the user collection. No studios were inserted."
      );
    }

    console.log("Valid studio owner found.");

    let insertedCount = 0;

    for (const studio of newStudios) {
      const existing = await studiosCollection.findOne({
        name: studio.name,
      });

      if (existing) {
        console.log(`Already exists: ${studio.name}`);
        continue;
      }

      const now = new Date();

      await studiosCollection.insertOne({
        ...studio,
        ownerId,
        createdAt: now,
        updatedAt: now,
      });

      insertedCount++;

      console.log(`Inserted: ${studio.name}`);
    }

    const totalStudios =
      await studiosCollection.countDocuments();

    console.log("------------------------------");
    console.log(`New studios inserted: ${insertedCount}`);
    console.log(`Total studios: ${totalStudios}`);
    console.log("------------------------------");
  } catch (error) {
    console.error("Studio seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

void seedStudios();
