"use client";

import { useState } from "react";
import { LayoutDashboard, Settings } from "lucide-react";
import { SettingsPanel } from "@/components/player/SettingsPanel";

type Tab = "panel" | "settings";

type SettingsData = {
  userEmail: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
};

export function PlayerTabsClient({
  settingsData,
  children,
}: {
  settingsData: SettingsData;
  children: [React.ReactNode, React.ReactNode];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("panel");

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "panel", label: "Panel", icon: LayoutDashboard },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-surface border border-border rounded-xl p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? "bg-gold text-background shadow-lg shadow-gold/20"
                  : "text-muted hover:text-foreground hover:bg-background"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "panel" && children[0]}
      {activeTab === "settings" && (
        <SettingsPanel
          userEmail={settingsData.userEmail}
          emailVerified={settingsData.emailVerified}
          hasPassword={settingsData.hasPassword}
        />
      )}
    </>
  );
}
