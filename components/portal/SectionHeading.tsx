import * as React from "react";

/**
 * SectionHeading — the standard opener: short accent bar, condensed eyebrow,
 * display title, optional lead. Recreated from the Everest DS pattern so this
 * export has zero external component dependencies.
 */
export interface SectionHeadingProps {
  eyebrow: string;   // {eyebrow}
  title: string;     // {sectionTitle}
  lead?: string;     // {sectionLead}
  onDark?: boolean;
  className?: string;
}

export default function SectionHeading({
  eyebrow,
  title,
  lead,
  onDark = false,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={["flex flex-col gap-3.5", className].join(" ")}>
      <div className="h-1 w-11 bg-gold" />
      <div className="font-condensed text-[14px] font-bold uppercase tracking-eyebrow text-gold">
        {eyebrow}
      </div>
      <h2
        className={[
          "font-display text-[clamp(26px,3.5vw,38px)] uppercase leading-[1.1] tracking-display",
          onDark ? "text-snow" : "text-storm",
        ].join(" ")}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={[
            "max-w-[60ch] text-[15px] leading-relaxed",
            onDark ? "text-ondark-muted" : "text-slate-75",
          ].join(" ")}
        >
          {lead}
        </p>
      )}
    </div>
  );
}
