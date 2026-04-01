import { useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

interface RegisterAgentData {
  name: string;
  email: string;
  phone: string;
  location: string;
  motivation?: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  data: { userId: string };
}

export function useRegisterAgent() {
  return useMutation({
    mutationFn: async (data: RegisterAgentData): Promise<RegisterResponse> => {
      const res = await axiosClient.post<RegisterResponse>("/api/auth/register", data);
      return res.data;
    },
  });
}
