"use client";

import * as React from "react";
import type { PortalDoc } from "./types";

/**
 * ReviewDocumentModal — full document review overlay (PDF in an iframe).
 * Review-only: "Mark as reviewed" calls `onReview`. No signing / no auth.
 */
export interface ReviewDocumentModalProps {
  doc: PortalDoc | null;   // null → closed
  reviewed: boolean;       // whether this doc's key item is already done
  onClose: () => void;
  onReview: () => void;
}

export default function ReviewDocumentModal({
  doc,
  reviewed,
  onClose,
  onReview,
}: ReviewDocumentModalProps) {
  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex animate-fade-up items-center justify-center bg-black/65 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-lg bg-paper shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-gold" />
        <div className="flex flex-col gap-[18px] px-8 pb-[30px] pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="font-condensed text-[12px] font-bold uppercase tracking-[0.16em] text-gold-deep">
                Legal / Onboarding · Required
              </div>
              <div className="font-display text-[23px] uppercase leading-[1.1] tracking-display text-storm">
                {doc.title}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded border border-line text-[15px] text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]"
            >
              ✕
            </button>
          </div>

          <iframe
            src={doc.pdfUrl}
            title={doc.title}
            className="h-[470px] w-full rounded-md border border-line-subtle bg-mist"
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle pt-[18px]">
            <span className="text-[12.5px] italic text-slate-50">
              Review the full document above. In-portal signing will be enabled here soon.
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="rounded border border-line px-[18px] py-2.5 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]"
              >
                Close
              </button>
              <button
                onClick={onReview}
                className="rounded bg-gold px-5 py-3 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px"
              >
                {reviewed ? "Reviewed" : "Mark as reviewed"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
