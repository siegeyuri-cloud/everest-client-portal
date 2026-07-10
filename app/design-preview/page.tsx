"use client";

import * as React from "react";
import LoginScreen from "@/components/portal/LoginScreen";
import ClientPortal from "@/components/portal/ClientPortal";
import * as data from "@/components/portal/preview-data";

/**
 * TEMPORARY design-preview route (Step 11).
 * Renders the ported Everest design with realistic SSG content so we can
 * confirm fonts, colors, layout, and animations match the Claude Design build.
 * No auth, no database — deleted in Step 13 once the real /[orgSlug] is live.
 *
 * Toggle between the login screen and the full portal with the button.
 */
export default function DesignPreview() {
  const [showLogin, setShowLogin] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setShowLogin((s) => !s)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 100,
          padding: "8px 14px",
          borderRadius: 6,
          background: "#FBAD18",
          color: "#2D3132",
          fontWeight: 700,
          fontSize: 12,
          border: "none",
          cursor: "pointer",
        }}
      >
        {showLogin ? "View portal" : "View login"}
      </button>

      {showLogin ? (
        <LoginScreen
          logoUrl={data.identity.logoUrl}
          portalUrl={data.identity.portalUrl}
          onSubmit={() => setShowLogin(false)}
        />
      ) : (
        <ClientPortal
          identity={data.identity}
          navGroups={data.navGroups}
          overviewHero={data.overviewHero}
          currentFocus={data.currentFocus}
          buildItems={data.buildItems}
          journeyPhases={data.journeyPhases}
          lockedTeasers={data.lockedTeasers}
          sessions={data.sessions}
          keyItems={data.keyItems}
          resourceSections={data.resourceSections}
          logistics={data.logistics}
          recordings={data.recordings}
          internalNotes={data.internalNotes}
          docs={data.portalDocs}
          teamPhoto={data.teamPhoto}
          contactEmail="mike.fromhold@everestcollective.com"
          onSignOut={() => setShowLogin(true)}
        />
      )}
    </>
  );
}
