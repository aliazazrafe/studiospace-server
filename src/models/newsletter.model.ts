import type { ObjectId } from "mongodb";

export interface NewsletterSubscriber {
  _id?: ObjectId;
  email: string;
  subscribedAt: Date;
}