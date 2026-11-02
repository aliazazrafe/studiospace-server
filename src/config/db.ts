
import { MongoClient, type Db } from "mongodb";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (database) {
    return database;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from .env");
  }

  client = new MongoClient(uri);

  await client.connect();

  database = client.db(
    process.env.DB_NAME || "studiospace"
  );

  console.log("MongoDB connected successfully");

  return database;
}

export function getDB(): Db {
  if (!database) {
    throw new Error("Database is not connected");
  }

  return database;
}
