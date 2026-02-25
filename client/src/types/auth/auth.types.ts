export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  image: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  phoneNumber: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
