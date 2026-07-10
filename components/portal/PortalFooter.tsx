import * as React from "react";

/**
 * PortalFooter — black granite + topographic texture. Logo, tagline, contact.
 */
export interface PortalFooterProps {
  logoUrl: string;      // {logoWhiteUrl}
  contact: string;      // {contactEmail}
  lastUpdated: string;  // {lastUpdated}
}

export default function PortalFooter({ logoUrl, contact, lastUpdated }: PortalFooterProps) {
  return (
    <footer className="mt-auto bg-topo-granite p-9">
      <div className="flex max-w-[1080px] flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-3">
          <img src={logoUrl} alt="Everest Collective" className="h-6 w-auto self-start" />
          <div className="text-[13px] italic text-ondark-muted">
            Built as a living workspace for this engagement.
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-right font-condensed text-[12px] uppercase tracking-label text-ondark-muted">
          <span>Questions · {contact}</span>
          <span>Last updated {lastUpdated}</span>
        </div>
      </div>
    </footer>
  );
}
