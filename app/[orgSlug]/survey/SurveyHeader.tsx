const LOGO = "M841.08,674.63c-2.74-4.75-9.48-8.64-14.97-8.64l-487.88.18c-5.49,0-7.73-3.89-4.99-8.64l35.98-62.32c2.74-4.75,9.48-8.64,14.97-8.64l396.04-.05c5.49,0,7.73-3.89,4.99-8.64L518.08,115.17c-2.74-4.75-7.23-4.75-9.98,0L125.83,777.28c-2.74,4.75-.5,8.64,4.99,8.64h764.53c5.49,0,7.73-3.89,4.99-8.64l-59.26-102.65ZM508.1,354.66c2.74-4.75,7.23-4.75,9.98,0l59.77,103.52c2.74,4.75.5,8.64-4.99,8.64h-119.53c-5.49,0-7.73-3.89-4.99-8.64l59.77-103.52Z";

export default function SurveyHeader({ orgName }: { orgName: string | null }) {
  return (
    <header className="ecs-top">
      <div className="ecs-top-in">
        <span className="ecs-brand">
          <svg viewBox="0 0 1024 1024" width="28" height="28" aria-hidden="true">
            <path d={LOGO} fill="var(--brand-primary)" />
          </svg>
          <span>Everest Collective</span>
        </span>
        {orgName && <span className="ecs-client">{orgName}</span>}
      </div>
    </header>
  );
}
