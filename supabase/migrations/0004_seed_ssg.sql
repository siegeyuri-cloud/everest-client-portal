-- ============================================================
-- EVEREST CLIENT PORTAL — SEED MIGRATION 0004 (Southern Staffing Group)
-- Where to run: Supabase Dashboard → SQL Editor → paste ALL → Run.
-- Expect: "Success. No rows returned", then run the check at the bottom.
-- Run ONCE. Content is editable any time (SQL now, admin UI later).
-- ============================================================

do $$
declare
  v_org uuid;
  v_p2 uuid;
  v_cat1 uuid;
  v_cat2 uuid;
  v_msa uuid;
  v_nda uuid;
  v_s1 uuid;
begin

-- ---------- ORGANIZATION ----------
insert into public.organizations
  (name, slug, engagement_type, status, portal_title, portal_subtitle, description)
values (
  'Southern Staffing Group',
  'southern-staffing-group',
  'Discovery & Assessment Period',
  'In Progress',
  'Partnership Workspace',
  'A living workspace for the Discovery & Assessment period with Everest Collective.',
  $json${
    "eyebrow": "Discovery & Assessment Period · Proposal 06_19_2026",
    "subtitle": "A living workspace for the Discovery & Assessment period with Everest Collective.",
    "paragraphs": [
      "Southern Staffing Group is a recruiting business in a phase of rapid, organic growth — inbound demand is outpacing the team's capacity, and the partners believe they can reach $10M in revenue by expanding services inside existing accounts.",
      "What you asked from Everest Collective is a trusted outside perspective — a sounding board and bumpers on the bowling lane — to make confident decisions on hiring, capital allocation, structure, and goal-setting as you push toward a $5–10M business."
    ],
    "closingLead": "Before committing to an ongoing engagement, we begin with a structured Discovery & Assessment period — so any work we recommend is grounded in evidence.",
    "closingAside": "This is where we both find out if there's something worth building together.",
    "focus": {
      "nextStep": "Complete leadership interviews",
      "owner": "Everest Collective + SSG Leadership",
      "due": "Week of July 21",
      "context": "We're observing the morning red-zone calls, interviewing stakeholders, and building a clear-eyed picture of the current state before recommending the roadmap."
    }
  }$json$
)
returning id into v_org;

-- ---------- JOURNEY PHASES (edit titles/copy any time) ----------
insert into public.journey_phases
  (organization_id, phase_number, title, subtitle, status, is_locked, sort_order, teaser, body)
values
(v_org, 1, 'Partnership Setup', 'Basecamp', 'available', false, 1,
 'Agreements signed, contacts confirmed, kickoff scheduled.',
 'MSA and NDA signed, leadership contacts confirmed, and the Discovery & Assessment kickoff scheduled. The foundation for everything that follows.');

insert into public.journey_phases
  (organization_id, phase_number, title, subtitle, status, is_locked, sort_order, teaser, body)
values
(v_org, 2, 'Discovery & Assessment', 'You Are Here', 'current', false, 2,
 'The structured discovery period — where we both decide if there''s a fit.',
 $json${
   "kicker": "You Are Here",
   "investIntro": "Before committing to an ongoing engagement, we begin with a structured Discovery & Assessment period. This ensures any work we recommend is grounded in evidence.",
   "investment": { "label": "Discovery Period", "amount": "$35,000", "caption": "Aug–Oct 2026 · three installments" },
   "paragraphs": [
     { "text": "We approach discovery differently than most firms. For the right partner, our goal isn't just to advise from the outside — it's to become genuinely invested in the outcome." }
   ],
   "deliverables": [
     { "n": "01", "title": "Business Diagnostic", "body": "A clear-eyed assessment of your current state based on data and stakeholder interviews." },
     { "n": "02", "title": "Quantified Value Case", "body": "A financial model identifying where value can be created or recovered." },
     { "n": "03", "title": "Prioritized Roadmap", "body": "A sequenced action plan ranking initiatives by impact and feasibility." },
     { "n": "04", "title": "Recommended Engagement Plan", "body": "A proposed scope, structure, and timeline for the ongoing work." },
     { "n": "05", "title": "Executive Readout", "body": "A presentation of findings and recommendations to your leadership team." }
   ],
   "closing": "If the fit is right, the discovery becomes the foundation for a long-term partnership — and a fee tied to the value we create, not the hours we spend."
 }$json$)
returning id into v_p2;

insert into public.journey_phases
  (organization_id, phase_number, title, status, is_locked, sort_order, teaser, body)
values
(v_org, 3, 'Founder Bottleneck & Leadership', 'locked', true, 3,
 'Relieving the founder bottleneck and developing the leadership bench.',
 $json${ "paragraphs": [
   { "lead": "Founder bottleneck", "text": "Both partners work until 10–11 PM every night; candidate review is delayed and there's no room to oversee call volume or submission quality." },
   { "lead": "Leadership development", "text": "Setting clear expectations, holding people accountable, and coaching — plus a process to train new hires on the Ideal Customer Profile." }
 ]}$json$),
(v_org, 4, 'Scoreboard & Operating Rhythm', 'locked', true, 4,
 'Simple, actually-used scoreboards linking daily activity to outcomes.',
 $json${ "paragraphs": [
   { "lead": "Practical scoreboards", "text": "Linking daily activity to weekly and monthly outcomes on a clear daily-track / weekly-review cadence." }
 ]}$json$),
(v_org, 5, 'Growth Strategy & Value Case', 'locked', true, 5,
 'Deeply penetrate two or three major accounts rather than chase new logos.',
 $json${ "paragraphs": [
   { "lead": "Structured goal-setting", "text": "Set the $5M goal, work backward into two to three priorities, define daily drivers, track against a scoreboard — then repeat for $10M." }
 ]}$json$),
(v_org, 6, 'Prioritized Roadmap & Readout', 'locked', true, 6,
 'The executive readout — where we decide whether to keep building together.',
 $json${ "paragraphs": [
   { "text": "A presentation of findings and recommendations to leadership, with a documented summary — and the decision on the ongoing partnership." }
 ]}$json$);

update public.organizations set current_phase_id = v_p2 where id = v_org;

-- ---------- SESSIONS ----------
insert into public.sessions
  (organization_id, title, objective, session_date, status, sort_order)
values
(v_org, 'Discovery & Assessment Kickoff',
 'Confirm scope, leadership contacts, starting materials, and expectations for the Discovery & Assessment period.',
 '2026-07-07', 'complete', 1)
returning id into v_s1;

insert into public.sessions
  (organization_id, title, objective, session_date, status, sort_order)
values
(v_org, 'Red Zone Call Observation',
 'Observe the morning red-zone calls to spot efficiency gains across 60+ active candidates.',
 null, 'in_progress', 2),
(v_org, 'Stakeholder Interviews',
 'One-on-one interviews with leadership and key team members.',
 null, 'upcoming', 3),
(v_org, 'Executive Readout',
 'Present findings, the value case, and the prioritized roadmap to leadership.',
 null, 'upcoming', 4);

-- ---------- RESOURCE CATEGORIES + RESOURCES ----------
insert into public.resource_categories
  (organization_id, title, description, sort_order, visibility)
values
(v_org, 'Signed Agreements',
 'Executed legal documents for this engagement.', 1, 'executive')
returning id into v_cat1;

insert into public.resource_categories
  (organization_id, title, description, sort_order, visibility)
values
(v_org, 'Discovery & Assessment Materials',
 'Working documents gathered and produced during the discovery period.', 2, 'all')
returning id into v_cat2;

insert into public.resources
  (organization_id, category_id, title, description, type, url, sort_order, visibility)
values
(v_org, v_cat1, 'Master Services Agreement', '— signed July 2, 2026.', 'pdf', '/assets/msa.pdf', 1, 'executive')
returning id into v_msa;

insert into public.resources
  (organization_id, category_id, title, description, type, url, sort_order, visibility)
values
(v_org, v_cat1, 'Mutual Non-Disclosure Agreement', '— signed July 2, 2026.', 'pdf', '/assets/nda.pdf', 2, 'executive')
returning id into v_nda;

insert into public.resources
  (organization_id, category_id, title, description, type, sort_order, visibility)
values
(v_org, v_cat2, 'Interview prep & questions', '— stakeholder interview guides.', 'doc', 1, 'all'),
(v_org, v_cat2, 'Business context documents', '— shared by SSG leadership.', 'doc', 2, 'all');

-- ---------- KEY ITEMS ----------
insert into public.key_items
  (organization_id, title, category, status, priority, is_client_actionable, linked_resource_id, visibility)
values
(v_org, 'Signed MSA', 'Legal / Onboarding', 'complete', 'required', false, v_msa, 'executive'),
(v_org, 'Signed NDA', 'Legal / Onboarding', 'complete', 'required', false, v_nda, 'executive'),
(v_org, 'Confirm leadership contacts', 'Setup', 'complete', 'normal', true, null, 'all'),
(v_org, 'Confirm Discovery & Assessment kickoff', 'Setup', 'complete', 'normal', true, null, 'all'),
(v_org, 'Share relevant business context and documents', 'Discovery', 'in_progress', 'normal', true, null, 'all'),
(v_org, 'Schedule stakeholder interviews', 'Discovery', 'in_progress', 'normal', true, null, 'all'),
(v_org, 'Upload current scoreboards / reporting', 'Discovery', 'not_started', 'normal', true, null, 'all'),
(v_org, 'Prepare executive readout materials', 'Readout', 'not_started', 'normal', false, null, 'all');

-- ---------- LOGISTICS ----------
insert into public.logistics (organization_id, label, value, sort_order) values
(v_org, 'Engagement', 'Discovery & Assessment Period', 1),
(v_org, 'Duration', 'August – October 2026 (~3 months)', 2),
(v_org, 'Investment', '$35,000 · three installments', 3),
(v_org, 'Everest Team', 'Mike Fromhold, Brittany Tipton', 4),
(v_org, 'Kickoff', 'July 7, 2026 · in person', 5),
(v_org, 'Executive Readout', 'End of October 2026', 6);

-- ---------- INTERNAL NOTES (admins only — RLS enforces it) ----------
insert into public.internal_notes (organization_id, title, body) values
(v_org, 'Interview cautions',
 'Interviews are confidential — never expose to the executive or staff views. Admin-only.'),
(v_org, 'Cash-flow note',
 'Fee split into three installments (Aug $10k / Sep $10k / Oct $15k) to support cash flow.');

end $$;

-- ---------- CHECK (run after — expect: 1 org, 6 phases, 4 sessions, 8 key items) ----------
select
  (select count(*) from public.organizations where slug = 'southern-staffing-group') as orgs,
  (select count(*) from public.journey_phases jp join public.organizations o on o.id = jp.organization_id where o.slug = 'southern-staffing-group') as phases,
  (select count(*) from public.sessions s join public.organizations o on o.id = s.organization_id where o.slug = 'southern-staffing-group') as sessions,
  (select count(*) from public.key_items k join public.organizations o on o.id = k.organization_id where o.slug = 'southern-staffing-group') as key_items;
