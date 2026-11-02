
export interface Studio {
  _id?: string;
  name: string;
  description: string;
  category: string;
  location: string;
  price: number;
  images: string[];
  ownerId: string;
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
}
