export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  phoneNumber?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
