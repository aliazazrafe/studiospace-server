
import "dotenv/config";
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI is missing from .env");
}

export const client = new MongoClient(uri);

export const database: Db = client.db(
  process.env.DB_NAME || "studiospace"
);

let isConnected = false;

export async function connectDB(): Promise<Db> {
  if (isConnected) {
    return database;
  }

  await client.connect();

  isConnected = true;

  console.log("MongoDB connected successfully");

  return database;
}

export function getDB(): Db {
  return database;
}
