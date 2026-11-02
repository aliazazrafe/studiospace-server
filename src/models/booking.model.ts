
import type { ObjectId } from "mongodb";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled";

export interface Booking {
  _id?: ObjectId;
  studioId: ObjectId;
  studioName: string;
  userId: string;
  ownerId: string;
  startAt: Date;
  endAt: Date;
  price: number;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

