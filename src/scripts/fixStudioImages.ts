import "dotenv/config";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import { client, connectDB, getDB } from "../config/db.js";

const imageUpdates = [
  {
    name: "Modern Photography Workspace",
    image:
      "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=900&auto=format&fit=crop",
  },
  {
    name: "Booking Test Studio",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&auto=format&fit=crop",
  },
  {
    name: "Premium Photography Studio",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&auto=format&fit=crop",
  },
];

async function fixStudioImages(): Promise<void> {
  try {
    await connectDB();

    const studios = getDB().collection("studios");

    for (const item of imageUpdates) {
      const studio = await studios.findOne({ name: item.name });

      if (!studio) {
        console.log(`Studio not found: ${item.name}`);
        continue;
      }

      await studios.updateOne(
        { _id: studio._id },
        {
          $set: {
            images: [item.image],
            updatedAt: new Date(),
          },
        }
      );

      console.log(`Image updated: ${item.name}`);
    }

    console.log("Finished updating studio images.");
  } catch (error) {
    console.error("Could not update studio images:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

void fixStudioImages();
