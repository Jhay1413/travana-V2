import axiosClient from "@/api/client/axios-client";
import { HOMEWORKER_ENDPOINTS } from "@/api/endpoints";
import type {
  HomeworkerListItem,
  HomeworkerMe,
  InviteHomeworkerPayload,
  InviteHomeworkerResult,
  UpdateHomeworkerPayload,
} from "../types";

export const homeworkersApi = {
  list: async (includeArchived: boolean): Promise<HomeworkerListItem[]> => {
    const { data } = await axiosClient.get<HomeworkerListItem[]>(HOMEWORKER_ENDPOINTS.base, {
      params: includeArchived ? { includeArchived: "true" } : undefined,
    });
    return data;
  },
  me: async (): Promise<HomeworkerMe> => {
    const { data } = await axiosClient.get<HomeworkerMe>(HOMEWORKER_ENDPOINTS.me);
    return data;
  },
  invite: async (payload: InviteHomeworkerPayload): Promise<InviteHomeworkerResult> => {
    const { data } = await axiosClient.post<InviteHomeworkerResult>(HOMEWORKER_ENDPOINTS.base, payload);
    return data;
  },
  update: async (branchId: string, payload: UpdateHomeworkerPayload): Promise<void> => {
    await axiosClient.patch(HOMEWORKER_ENDPOINTS.byId(branchId), payload);
  },
  archive: async (branchId: string): Promise<void> => {
    await axiosClient.post(HOMEWORKER_ENDPOINTS.archive(branchId));
  },
};
