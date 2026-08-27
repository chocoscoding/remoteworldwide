import SettingsNav from "./_components/SettingsNav";

/**
 * Shared shell for /dashboard/settings/**: one header and a section nav.
 * `SettingsProvider` used to wrap this layout; it now mounts app-wide in
 * DashboardShell because the recommend screen computes fit from the same
 * preferences. Re-wrapping here would shadow that with a second copy.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="min-h-screen bg-[#f6f6f6]">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-black/10 bg-white/85 px-8 backdrop-blur-sm">
          <h1 className="text-[17px] font-bold text-primary">Settings</h1>
          <span className="hidden text-sm text-black/45 sm:inline">Your profile, preferences and plan</span>
        </header>

        <main className="mx-auto max-w-[1100px] px-8 py-7 pb-14">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[236px_1fr] items-start">
            <div className="lg:sticky lg:top-24">
              <SettingsNav />
            </div>
            <div className="min-w-0 flex flex-col gap-5">{children}</div>
          </div>
        </main>
      </div>
    </>
  );
}
