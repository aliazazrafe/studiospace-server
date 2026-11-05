export interface Studio {
  _id?: string;
  name: string;
  description: string;
  category: string;
  location: string;
  price: number;
  images: string[];
  securityDeposit?: number;
  capacity?: number | null;
  amenities?: string[];
  ownerId: string;
  ownerName?: string;
  ownerEmail?: string;
  status?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudioInput {
  name: string;
  description: string;
  category: string;
  location: string;
  price: number;
  images: string[];
  securityDeposit?: number;
  capacity?: number;
  amenities?: string[];
}