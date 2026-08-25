"use client";

// Shared collapse state for the main dashboard sidebar. Lives above both
// `DashboardSidebar` (which reads/toggles it) and every screen under
// `/dashboard/*` (which may want to widen its own layout when the sidebar is
// collapsed — the resume screen's Content tab is the first consumer). Plain
// `useState`, no persistence: `DashboardLayout`'s Server Component wraps
// `{children}` in a client `DashboardShell` that mounts this provider once,
// so state naturally survives client-side navigation between dashboard
// screens within a session without needing localStorage.

import { createContext, useContext, useState, type Dispatch, type FC, type ReactNode, type SetStateAction } from "react";

interface SidebarCollapseContextValue {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

export const SidebarCollapseProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  return <SidebarCollapseContext.Provider value={{ collapsed, setCollapsed }}>{children}</SidebarCollapseContext.Provider>;
};

export function useSidebarCollapse(): SidebarCollapseContextValue {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) throw new Error("useSidebarCollapse must be used within a SidebarCollapseProvider");
  return ctx;
}
