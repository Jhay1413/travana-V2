import { useQuery } from "@tanstack/react-query";
import { feedbackApi } from "./feedback.api";

export const feedbackKeys = {
  all: ["feedback"] as const,
  mine: ["feedback", "mine"] as const,
};

export function useFeedbackList() {
  return useQuery({
    queryKey: feedbackKeys.all,
    queryFn: feedbackApi.getAll,
  });
}

export function useMyFeedback() {
  return useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: feedbackApi.getMine,
  });
}
