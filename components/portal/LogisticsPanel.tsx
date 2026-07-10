import * as React from "react";
import type { LogisticsField } from "./types";
import SectionHeading from "./SectionHeading";

/**
 * LogisticsPanel — a hairline-separated grid of label / value cells.
 * The practical operations side of the engagement.
 */
export interface LogisticsPanelProps {
  fields: LogisticsField[];
}

export default function LogisticsPanel({ fields }: LogisticsPanelProps) {
  return (
    <div className="animate-fade-up px-9 pb-16 pt-12">
      <div className="flex max-w-[1080px] flex-col gap-8">
        <SectionHeading
          eyebrow="Basecamp Operations"
          title="Logistics"
          lead="The practical side of the engagement, kept current as details firm up."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-px overflow-hidden rounded-lg border border-line-subtle bg-line-subtle">
          {fields.map((f, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 bg-paper px-[26px] pb-6 pt-[26px] transition-colors duration-[280ms] ease-climb hover:bg-rowhover"
            >
              <div className="font-condensed text-[12px] font-bold uppercase tracking-wide text-gold-deep">
                {f.label}
              </div>
              <div className="text-[14.5px] leading-[1.6] text-storm">{f.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
