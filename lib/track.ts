// Fire-and-forget file-open tracking.
// Reads the org slug from the portal URL (/[orgSlug]) and posts to the tracking
// endpoint. It never blocks the click, never throws, and never surfaces errors.
export function trackFileOpen(kind: string, fileId: string, title: string) {
  try {
    if (typeof window === "undefined") return;
    const slug = window.location.pathname.split("/").filter(Boolean)[0] || "";
    if (!slug) return;
    fetch("/api/track/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, kind, fileId, title }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking must never break a file open */
  }
}
