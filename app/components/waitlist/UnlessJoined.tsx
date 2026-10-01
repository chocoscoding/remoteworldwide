"use client";

import { useSyncExternalStore, type FC, type ReactNode } from "react";
import { readJoined, serverNull, subscribeJoined } from "./joinedStore";

/**
 * Renders its children only while this browser hasn't joined the waitlist; once it has (here or in
 * another tab), they go. For copy that asks people to join, which reads oddly beside "You're on the
 * list". The server always renders them, since it can't know.
 */
const UnlessJoined: FC<{ children: ReactNode }> = ({ children }) => {
  const joined = useSyncExternalStore(subscribeJoined, readJoined, serverNull);
  return joined ? null : children;
};

export default UnlessJoined;
