import "dotenv/config";
import dns from "node:dns";
import { ObjectId } from "mongodb";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { client, connectDB, getDB } from "../config/db.js";

type StudioSeed = {
  name: string;
  description: string;
  category: string;
  location: string;
  price: number;
  image: string;
};

type StudioDocument = {
  _id?: ObjectId;
  name: string;
  ownerId: string;
  images?: string[];
};

const studios: StudioSeed[] = [
  {
    name: "Cinematic Production Stage",
    description:
      "A professional sound stage for film production, commercials, and creative video projects.",
    category: "Sound Stage",
    location: "Banani, Dhaka",
    price: 5000,
    image:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200",
  },
  {
    name: "Creative Podcast Studio",
    description:
      "A modern podcast recording studio with professional audio equipment and comfortable seating.",
    category: "Podcast Room",
    location: "Gulshan, Dhaka",
    price: 1800,
    image:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=1200",
  },
  {
    name: "Professional Music Suite",
    description:
      "A premium music production studio for recording, mixing, and mastering.",
    category: "Music Suite",
    location: "Uttara, Dhaka",
    price: 3500,
    image:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200",
  },
  {
    name: "Modern Art Workshop",
    description:
      "A bright and inspiring creative workspace for painting, drawing, and art workshops.",
    category: "Art Workshop",
    location: "Dhanmondi, Dhaka",
    price: 1500,
    image:
      "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200",
  },
  {
    name: "Live Sound Production Stage",
    description:
      "A versatile stage for live music, video production, and creative events.",
    category: "Sound Stage",
    location: "Mohakhali, Dhaka",
    price: 4200,
    image:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200",
  },
  {
    name: "Creative Office Studio",
    description:
      "A bright, flexible workspace for meetings and creative projects.",
    category: "Other",
    location: "Dhanmondi, Dhaka",
    price: 2200,
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200",
  },
  {
    name: "Modern Photography Workspace",
    description:
      "A photography and production workspace with a clean modern interior.",
    category: "Photo Studio",
    location: "Gulshan, Dhaka",
    price: 2500,
    image:
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=1200",
  },
  {
    name: "Creative Team Studio",
    description:
      "A collaborative workspace for content creation and small team projects.",
    category: "Creative Workspace",
    location: "Banani, Dhaka",
    price: 2000,
    image:
      "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1200",
  },
  {
    name: "Premium Workspace Studio",
    description:
      "A comfortable creative workspace for independent productions.",
    category: "Creative Workspace",
    location: "Uttara, Dhaka",
    price: 2300,
    image:
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200",
  },
  {
    name: "Bright Creative Studio",
    description:
      "A modern, light-filled studio for photography and creative projects.",
    category: "Photo Studio",
    location: "Mirpur, Dhaka",
    price: 1900,
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200",
  },
  {
    name: "Portrait Photography Studio",
    description:
      "A welcoming space for portraits, fashion photography, and content creation.",
    category: "Photo Studio",
    location: "Bashundhara, Dhaka",
    price: 2600,
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200",
  },
  {
    name: "Production Team Workspace",
    description:
      "A collaborative workspace for planning and producing creative media projects.",
    category: "Creative Workspace",
    location: "Tejgaon, Dhaka",
    price: 2100,
    image:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200",
  },
];

async function seedStudios(): Promise<void> {
  try {
    await connectDB();

    const db = getDB();
    const collection = db.collection<StudioDocument>("studios");

    const existingStudio = await collection.findOne({
      ownerId: { $exists: true, $type: "string" },
    });

    if (!existingStudio?.ownerId) {
      throw new Error(
        "No existing studio owner found. Create a studio with a registered account first."
      );
    }

    const ownerId = existingStudio.ownerId;
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
        "Studio owner not found in the user collection. No studios were seeded."
      );
    }

    console.log("Valid studio owner found.");

    let insertedCount = 0;
    let updatedCount = 0;

    for (const studio of studios) {
      const existing = await collection.findOne({ name: studio.name });

      if (existing) {
        await collection.updateOne(
          { _id: existing._id },
          {
            $set: {
              category: studio.category,
              images: [studio.image],
              updatedAt: new Date(),
            },
          }
        );

        updatedCount++;
        console.log(`Updated category and image: ${studio.name}`);
        continue;
      }

      const now = new Date();

      await collection.insertOne({
        ...studio,
        images: [studio.image],
        ownerId,
        createdAt: now,
        updatedAt: now,
      } as never);

      insertedCount++;
      console.log(`Inserted: ${studio.name}`);
    }

    await collection.updateOne(
      { name: "Booking Test Studio" },
      {
        $set: {
          category: "Other",
          updatedAt: new Date(),
        },
      }
    );

    await collection.updateOne(
      { name: "Premium Photography Studio" },
      {
        $set: {
          category: "Photo Studio",
          images: [
            "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=900&auto=format&fit=crop",
          ],
          updatedAt: new Date(),
        },
      }
    );

    const totalStudios = await collection.countDocuments();
    const photoStudioCount = await collection.countDocuments({
      category: "Photo Studio",
    });
    const creativeWorkspaceCount = await collection.countDocuments({
      category: "Creative Workspace",
    });

    console.log("------------------------------");
    console.log(`New studios inserted: ${insertedCount}`);
    console.log(`Existing seed studios updated: ${updatedCount}`);
    console.log(`Photo Studio listings: ${photoStudioCount}`);
    console.log(`Creative Workspace listings: ${creativeWorkspaceCount}`);
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