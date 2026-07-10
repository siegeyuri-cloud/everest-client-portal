"use client";

import * as React from "react";
import type { NavGroup, NavKey } from "./types";
import { PeakBullet } from "./icons";

/**
 * Sidebar — the client's left control panel (Stormcloud, sticky, full height).
 * Nav is grouped; the active item shows a gold left-rule + gold peak bullet.
 */
export interface SidebarProps {
  logoUrl: string;         // {logoWhiteUrl}
  workspaceLabel: string;  // {workspaceLabel}
  orgName: string;         // {orgName}
  userName: string;        // {userName}
  userMeta: string;        // {userMeta}
  groups: NavGroup[];
  active: NavKey;
  onNavigate: (key: NavKey) => void;
  onSignOut?: () => void;
  adminHref?: string;      // set only for Everest admins → shows a return link
}

export default function Sidebar({
  logoUrl,
  workspaceLabel,
  orgName,
  userName,
  userMeta,
  groups,
  active,
  onNavigate,
  onSignOut,
  adminHref,
}: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-screen w-[264px] flex-none flex-col overflow-y-auto bg-storm">
      {/* Brand block */}
      <div className="flex flex-col gap-4 border-b border-ondark-line px-6 pb-[22px] pt-7">
        <img src={logoUrl} alt="Everest Collective" className="h-[26px] w-auto self-start" />
        <div className="flex flex-col gap-1">
          <div className="font-condensed text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
            {workspaceLabel}
          </div>
          <div className="font-display text-[17px] leading-tight uppercase tracking-display text-snow">
            {orgName}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-[22px] py-[18px]">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="px-6 pb-2 font-condensed text-[11px] font-bold uppercase tracking-eyebrow text-ondark/40">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = item.key === active;
              return (
                <button
                  key={item.key}
                  onClick={() => onNavigate(item.key)}
                  className={[
                    "flex w-full items-center gap-3 border-l-[3px] px-[21px] py-[11px] text-left font-condensed text-[14.5px] font-bold uppercase tracking-label transition-[background,color] duration-[280ms] ease-climb",
                    isActive
                      ? "border-gold bg-white/10 text-snow"
                      : "border-transparent text-ondark/65 hover:bg-white/[0.07] hover:text-snow",
                  ].join(" ")}
                >
                  <PeakBullet tone={isActive ? "gold" : "muted"} />
                  <span className="flex-1">{item.label}</span>
                  {typeof item.count === "number" && item.count > 0 && (
                    <span className="rounded bg-gold px-1.5 py-0.5 font-body text-[11px] font-bold text-storm">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="flex flex-col gap-3 border-t border-ondark-line px-6 pb-6 pt-5">
        <div className="flex flex-col gap-0.5">
          <div className="text-[12.5px] font-semibold text-snow">{userName}</div>
          <div className="text-[11.5px] text-ondark-muted">{userMeta}</div>
        </div>
        <div className="flex items-center gap-4">
          <a href="/settings" className="font-condensed text-[12px] font-bold uppercase tracking-wide text-ondark-muted transition-colors hover:text-teal">
            Settings
          </a>
          {adminHref && (
            <a
              href={adminHref}
              className="font-condensed text-[12px] font-bold uppercase tracking-wide text-gold"
            >
              ← Admin panel
            </a>
          )}
          <button
            onClick={onSignOut}
            className="font-condensed text-[12px] font-bold uppercase tracking-wide text-teal"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
