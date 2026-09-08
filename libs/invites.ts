"use server";

import { backend, type BackendInit } from "@/app/lib/backend";
import type { InviteOverview } from "@/app/lib/invites/types";

const api = <T>(path: string, init: BackendInit = {}) => backend<T>(`/invites${path}`, { ...init, session: true });

export const getInvites = async (page = 1, pageSize = 10) =>
  api<InviteOverview>(`/overview?page=${page}&pageSize=${pageSize}`);
