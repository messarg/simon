# PRD Reference Template

> **Purpose**: This template defines the structure, quality bar, and evaluation criteria for Product Requirements Documents. It serves as:
> - A **structural guide** for the `prd-writer` agent when generating PRDs
> - A **quality benchmark** for the `prd-analyze` skill when evaluating PRDs
>
> Each section includes its inclusion level, guidance notes, and inline examples drawn from real PRDs.

---

## Section Inclusion Levels

| Level | Meaning | Analyzer Behavior |
|-------|---------|-------------------|
| **Required** | Every PRD must include this section | Missing = CRITICAL finding |
| **Recommended** | Most PRDs benefit from this section | Missing = MEDIUM finding (suggestion) |
| **Conditional** | Include when the product context demands it | Missing = no penalty unless context clearly warrants it |

---

## 1. Metadata & Revision History — `Required`

**Why it matters**: Establishes ownership, tracks document evolution, and prevents stale requirements from being implemented.

**Must include**:
- Document title
- PRD type (Full PRD / 1-Pager / Shape Up Pitch / AI Product PRD)
- Version number
- Status (Draft / In Review / Approved / Active Development)
- Last updated date
- Author / document owner
- Stakeholders and their roles (table format)
- Revision history (version, date, changes)

**Example**:

```markdown
# PRD: FixtureFlow

> **Type:** Full PRD
> **Version:** 2.0
> **Last Updated:** 2026-01-29
> **Status:** Active Development
> **Author:** [Name], Product Manager
> **Stakeholders:**

| Name | Role | Responsibility |
|------|------|----------------|
| ... | Engineering Lead | Technical feasibility review |
| ... | Design Lead | UX review |

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-21 | Initial PRD |
| 2.0 | 2026-01-29 | Added forfeit, result editing, bye handling |
```

---

## 2. Executive Summary — `Required`

**Why it matters**: Gives any reader a complete orientation in under 60 seconds. A stakeholder who reads only this section should understand what is being built, why, and for whom.

**Must include**:
- Product vision (1-2 sentences)
- Problem statement with evidence (not assumptions)
- Solution overview (what the product does, concretely)
- Target users (table with user type, description, primary goals)

**Quality signals**:
- Problem statement cites real evidence: user research, support tickets, data, or competitive gaps
- Solution overview is specific enough to distinguish this product from alternatives
- Avoids hollow phrases like "intuitive experience" or "seamless integration" without concrete meaning

**Anti-pattern**: An executive summary that could describe any product in the category. If you swap the product name and it still reads fine, it's too generic.

**Example** (problem statement with evidence):

```markdown
### Problem Statement
Amateur football organizers currently face:
- Manual fixture scheduling using spreadsheets prone to errors and conflicts
- Disconnected communication between organizers, teams, and players
- Manual standings calculations that are time-consuming and error-prone
- No centralized platform for tracking match events and competition history
```

---

## 3. Problem Statement & Evidence — `Required`

**Why it matters**: This is the "proof of work" section. A PRD without evidence is just an opinion document. This section forces the author to demonstrate they've done discovery, not just brainstormed features.

**Must include**:
- Who has the problem (specific user segments)
- What the problem is (observable pain, not inferred)
- Evidence supporting the problem's existence and severity (at least one of: user research quotes, support ticket data, analytics, competitive analysis, market data)
- Why now — what makes this the right time to solve it
- Current alternatives and why they fall short

**Quality signals**:
- Contains actual data points, quotes, or references — not just assertions
- Distinguishes between validated problems and assumed problems
- Explains the cost of inaction (what happens if we don't build this)

**Anti-pattern**: "Users need a better way to [do X]" with no evidence that users actually struggle or that existing tools are insufficient.

> **Note**: If the executive summary already contains a strong problem statement with evidence, this section can be merged into it. The key requirement is that evidence exists somewhere in the document — not that it lives in a separate heading.

---

## 3b. Competitive Landscape — `Recommended`

**Why it matters**: Without competitive context, the team builds in a vacuum. Understanding alternatives validates that the problem is real and helps differentiate the solution.

**Must include**:
- Current alternatives users rely on (direct competitors, workarounds, manual processes)
- Strengths and weaknesses of each alternative
- Where this product differentiates (the gap being exploited)

**Quality signals**:
- Alternatives include non-obvious competition (spreadsheets, email, manual processes — not just SaaS competitors)
- Differentiation is specific, not just "better UX" or "more modern"
- Analysis is honest about where competitors are strong

**Example**:

```markdown
### Competitive Landscape

| Alternative | What It Does Well | Where It Falls Short |
|------------|-------------------|---------------------|
| Google Sheets | Free, flexible, familiar | No fixture generation, no standings automation, error-prone formulas |
| LeagueLobster | Full league management | Expensive ($15/mo), complex setup, no API |
| WhatsApp groups | Easy communication | No structure, results get lost in chat history |

**Our differentiation**: Free, self-hosted, API-first — designed for organizers who want automation without vendor lock-in.
```

---

## 4. Goals, Non-Goals & KPIs — `Required`

**Why it matters**: Goals define success. Non-goals prevent scope creep by making explicit what the team is deliberately choosing not to do. KPIs make goals measurable.

**Must include**:
- **Goals**: 3-7 specific, measurable objectives tied to user or business outcomes
- **Non-goals**: Things this project explicitly will not do (with brief rationale)
- **KPIs**: Quantified success metrics with target values, baselines (if available), and measurement method

**Quality signals**:
- Goals are outcomes, not outputs ("reduce fixture scheduling errors by 90%" not "build a fixture generator")
- Non-goals clarify boundaries that might otherwise be assumed in-scope
- KPIs have specific numeric targets, not "improve X" or "increase engagement"
- Each KPI specifies how it will be measured

**Example** (non-goals):

```markdown
### Non-Goals
- FixtureFlow is **not** a social network for players
- FixtureFlow does **not** handle referee assignment or match officiating
- FixtureFlow does **not** replace league governance or disciplinary processes
- FixtureFlow is **not** a live scoring/streaming platform (in MVP)
```

**Example** (KPIs):

```markdown
| Metric | Target | Baseline | How Measured |
|--------|--------|----------|--------------|
| Fixture generation time | < 2 seconds | N/A (new) | Time from team selection to complete fixture list |
| Standings update latency | < 500ms | N/A (new) | Time from result submission to updated standings |
| API response time (P95) | < 200ms | N/A (new) | 95th percentile response time for all endpoints |
```

---

## 5. Target Users & Personas — `Required`

**Why it matters**: Different users have different needs, permissions, and workflows. Without clear personas, requirements become muddled and the team builds for an imaginary "average user."

**Must include**:
- User types/roles with descriptions
- Primary goals per user type
- Key pain points per user type
- Access level / permissions (what each role can and cannot do)

**Quality signals**:
- Personas are specific enough to drive design decisions
- Permissions are explicitly stated (not implied)
- If one persona is "read-only" or "admin-only," this is stated clearly

**Example**:

```markdown
| User Type | Description | Primary Goals | Access |
|-----------|-------------|---------------|--------|
| Organizer | League admin, tournament director | Create competitions, manage teams, record results | Full read/write |
| Team Manager | Team captain, coach | Register teams, manage rosters, view schedules | Edit own team |
| Player | Individual participant | View fixtures, check standings | Read-only |
```

---

## 6. User Stories & Flows — `Required`

**Why it matters**: User stories capture intent; user flows capture behavior. Stories alone are insufficient — they don't show how steps connect, where errors occur, or what the sequence looks like. Both are needed.

**Must include**:
- **User stories**: "As a [role], I want [action] so that [benefit]" format, grouped by persona
- **User flows**: Numbered step-by-step sequences for key journeys (happy path + error recovery)

**Quality signals**:
- Flows are numbered and sequential (not just narrative paragraphs)
- Flows cover the happy path AND at least one error/recovery path
- Flows reference specific UI elements or actions (not vague "user does the thing")
- Each story maps to at least one functional requirement

**Example** (user flow):

```markdown
### Owner Flow: First-Time Setup

1. Landing page → "Create Your Card" CTA
2. Authentication → "Sign in with Google" button
3. Redirect back → Authenticated session established
4. Username selection → Choose unique username (required before continuing)
   - Real-time availability check
   - Cannot proceed until valid username chosen
5. Profile editor → Single-page dashboard loads
6. Fill required fields (first name, last name)
7. (Optional) Add photo, job title, company, contact info, address
8. Select theme from 3 presets + photo shape
9. Auto-save on blur → Changes saved as draft
10. Preview card → See visitor view in new tab
11. Publish → Card goes live at /{username}
```

**Example** (error recovery flow):

```markdown
### Error Recovery: Session Expired

1. Owner editing profile
2. Session expires after 7 days
3. Owner makes a change (triggers auto-save)
4. System detects expired token
5. Auto-save to localStorage (preserves changes)
6. Show modal: "Session expired. Please log in."
7. Owner clicks "Log In" → Google OAuth
8. Returns authenticated → Draft restored from localStorage
9. Auto-save resumes → Changes persisted
```

---

## 7. Functional Requirements — `Required`

**Why it matters**: The core "what" of the PRD. This is what engineers will build from.

**Must include**:
- Requirements grouped by feature area
- Each requirement has: ID, description, priority (P0/P1/P2 or Must/Should/Could), and details
- Details include: inputs, validation rules, business logic, side effects
- Cross-references between related requirements

**Quality signals**:
- Requirements are specific enough to implement without guessing
- Each requirement has a clear verb (create, display, validate, calculate — not "handle" or "manage")
- Validation rules are explicit (max lengths, formats, allowed values)
- Side effects are documented (e.g., "Triggers standings recalculation")
- Priority is assigned to every requirement

**Anti-pattern**: "The system should handle user input appropriately" — this says nothing implementable.

**Example**:

```markdown
| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-FIX-03 | Enter Match Result | P0 | Record final score for a fixture. Organizer-only action. Validation: Scores >= 0; Fixture status must be Scheduled or Live. Side Effects: Updates fixture status to Completed; Triggers standings recalculation. |
| FR-FIX-07 | Record Forfeit | P0 | Mark a fixture as forfeited, specifying which team forfeited. Fixed 3-0 score in favor of non-forfeiting team. Status set to Forfeited. Triggers standings recalculation. |
```

---

## 8. Data Model & Validation Rules — `Required`

**Why it matters**: The data model is the contract between frontend, backend, and database. Ambiguity here causes bugs that are expensive to fix.

**Must include**:
- All domain entities with their fields
- Field types, required/optional status, and constraints
- Validation rules (format, length, range, uniqueness)
- Enumerations with all allowed values
- Relationships between entities
- Canonical field length limits (consolidated in one place)

**Quality signals**:
- Every field has an explicit type and constraint — no "string" without max length
- Enums are exhaustive (all values listed, not "e.g.")
- Validation rules are server-side, not just client-side
- A single canonical table of all field limits exists (not scattered across sections)

**Example** (data model):

```markdown
### Identity Fields
- `username` (required, unique, 3-30 chars, lowercase a-z, 0-9, hyphens, no consecutive hyphens, must start/end with alphanumeric)
- `firstName` (required, max 50 chars)
- `lastName` (required, max 50 chars)
- `tagline` (optional, max 120 chars, visual-only — not exported to vCard)
```

**Example** (enumerations):

```markdown
### Enumerations
- **CompetitionStatus:** Draft, Active, Completed, Cancelled
- **FixtureStatus:** Scheduled, Live, Completed, Postponed, Forfeited
- **MatchEventType:** Goal, YellowCard, RedCard
```

**Example** (consolidated field limits):

```markdown
### Field Length Limits
| Field | Min | Max | Format |
|-------|-----|-----|--------|
| username | 3 | 30 | lowercase a-z, 0-9, hyphens |
| firstName | 1 | 50 | free text |
| email | — | 255 | RFC 5322 |
| phone | — | 20 | E.164 or local format |
| profile photo | — | 5 MB | JPEG/PNG |
```

---

## 9. API & Integration Contracts — `Conditional`

> Include when the product exposes APIs, imports/exports data, or integrates with external systems.

**Why it matters**: APIs are contracts. If the PRD doesn't specify them, every developer interprets differently and you get inconsistent behavior.

**Must include**:
- Endpoint list with HTTP methods, paths, and descriptions
- Request/response payload examples (JSON or relevant format)
- Authentication requirements per endpoint
- Error response format and status codes
- Rate limiting rules
- For exports: canonical template with exact field mapping, inclusion/exclusion rules

**Quality signals**:
- At least one request/response example per endpoint category
- Error responses are as specified as success responses
- Auth requirements are per-endpoint (not just "authentication required")

**Example** (export contract):

```markdown
### vCard Export Contract (Locked)

**Version**: vCard 3.0 only, server-generated, schema frozen for v1

**Field Mapping**:
- `N` → last name, first name
- `FN` → full name
- `TEL;TYPE=CELL` → phone
- `EMAIL;TYPE=INTERNET` → email

**Explicit Rules**:
- No `NOTE` field, no `X-` extensions, no custom fields
- Empty fields are not emitted
- `tagline` intentionally excluded (visual-only)
- Filename format: `{username}.vcf`
```

---

## 10. State Machines & Lifecycle — `Conditional`

> Include when entities have status workflows (e.g., Draft → Published → Archived).

**Why it matters**: Without explicit state transitions, developers guess which transitions are valid. This causes bugs, security holes, and inconsistent behavior.

**Must include**:
- All entity states (enum values)
- Valid transitions between states (which state can go to which)
- Triggers for each transition (what action causes it)
- Side effects of each transition
- Invalid transitions explicitly noted

**Quality signals**:
- Presented as a table or diagram (not just prose)
- Invalid transitions are called out (not just omitted)
- Side effects are documented per transition

**Example**:

```markdown
### Card Lifecycle

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| Draft | Published | Owner clicks Publish | Card visible at public URL; vCard enabled |
| Published | Published | Owner saves changes | Live card updated immediately |
| Published | Unpublished | Owner clicks Unpublish | Public URL shows "Unavailable"; vCard disabled |
| Unpublished | Published | Owner clicks Re-publish | Same URL reactivated; cache purged |

**Rules**:
- First publish requires firstName and lastName
- Once published, saves auto-publish (no separate publish step)
- Unpublishing does not delete data
- Draft → Unpublished is NOT a valid transition
```

---

## 11. UI/UX Specifications — `Recommended`

**Why it matters**: Without display rules, designers and developers make inconsistent choices. This section bridges the gap between requirements and visual implementation.

**Must include**:
- Field display order (top to bottom)
- Conditional visibility rules (what appears when)
- Layout principles and constraints
- Typography and theming specs (if applicable)
- Accessibility requirements (WCAG level, contrast ratios, keyboard nav)

**Quality signals**:
- Display rules are deterministic (no ambiguity about what shows where)
- Customization boundaries are explicit (what users can and cannot change)
- Accessibility is a concrete requirement, not a vague aspiration

**Example**:

```markdown
### Card Surface — Field Order (Top → Bottom)
1. Profile photo (optional — show only if uploaded)
2. Full name (required)
3. Job title (optional)
4. Company (optional)
5. Tagline (optional, short)
6. Primary actions: Call, Email, Website (show only if populated)
7. Address (collapsed by default; expand only if ≥2 fields populated)

### Theming
| Theme | Background | Text | Accent |
|-------|-----------|------|--------|
| Light | #FFFFFF | #1E3A5F | #1E3A5F |
| Dark | #2D3748 | #F7FAFC | #F7FAFC |

### Customization Boundaries
- No custom CSS, no layout changes, no font controls, no animations
```

---

## 12. Error States & Edge Cases — `Required`

**Why it matters**: This is the highest-signal differentiator between good and great PRDs. Happy paths are easy; error handling is where products break. Every unspecified error state becomes a developer's guess.

**Must include**:
- Error states organized by actor (visitor errors, owner errors, system errors)
- Each error state has: trigger, behavior, user-facing message, recovery path
- Edge cases for unusual inputs, boundary conditions, concurrent operations
- Empty/blank states (what does the UI show when there's no data?)

**Quality signals**:
- Error messages are specified verbatim (not "show an appropriate error")
- Recovery paths exist for every error (retry, redirect, fallback)
- Concurrent/race condition scenarios are addressed
- Boundary conditions are tested (0 items, 1 item, max items)

**Example**:

```markdown
### Visitor Errors

**Card Not Found**
- **Trigger**: Invalid username, unpublished card, or changed username
- **Behavior**: Show 404 page with message "This card is not available"
- **No hints**: Do not reveal if card ever existed

**Photo Load Failure**
- **Trigger**: CDN unavailable or photo deleted
- **Behavior**: Show placeholder initials (first + last name)
- **No broken image**: Graceful fallback always shown

### Edge Cases

**Concurrent Edits**
- **Trigger**: Owner edits in two browser tabs simultaneously
- **Behavior**: Last write wins (no conflict detection in v1)
- **Risk**: Acknowledged as acceptable for single-user editing

**Username Change**
- **Old URL**: Returns 404 immediately (no redirect)
- **New URL**: Active immediately
- **Warning**: Confirmation modal before change
```

---

## 13. Non-Functional Requirements — `Required`

**Why it matters**: NFRs define the quality attributes that determine whether the product is usable, secure, and reliable — not just functional.

**Must include** (as applicable):
- **Performance**: Response time targets with percentiles (P50, P95, P99), load targets
- **Scalability**: Concurrent user targets, data volume targets
- **Security**: Authentication method, authorization model, data protection, input validation
- **Accessibility**: WCAG compliance level, specific requirements
- **Reliability**: Uptime targets, backup strategy
- **Compatibility**: Browser/device support matrix

**Quality signals**:
- Every metric has a specific number (not "fast" or "scalable")
- Performance targets specify the measurement conditions (load profile, environment)
- Security requirements name specific mechanisms (not just "the system should be secure")

**Example**:

```markdown
### Performance
| Metric | Target |
|--------|--------|
| Page load (3G connection) | < 2 seconds |
| Time to Interactive | < 3 seconds |
| vCard generation (server-side) | < 500ms |
| Concurrent card views | 1,000 simultaneous |

### Security
- **Authentication**: OAuth 2.0 / OIDC via Google only (v1)
- **Session**: Secure HTTP-only cookies, 7-day lifetime
- **Authorization**: Owner-only edit; public cards are read-only
- **Input sanitization**: HTML tags stripped; URL/email/phone format validated; max lengths enforced server-side

### Rate Limiting
| Endpoint Category | Limit |
|-------------------|-------|
| vCard downloads | 500 per IP per hour |
| API writes | 10 per owner per minute |
| Public card views | No limit (cacheable) |
```

---

## 14. Assumptions, Hypotheses & Constraints — `Required`

**Why it matters**: Assumptions are risks in disguise. Making them explicit lets the team challenge them early. Hypotheses add rigor by defining how you'll know if you're wrong.

**Must include**:
- **Assumptions**: Things believed to be true but not verified (operational, user behavior, technical)
- **Hypotheses**: Structured as "We believe [X]. We will know this is true when [Y]." (Focused Chaos framework)
- **Constraints**: Hard limits imposed by technology, regulation, timeline, budget, or team capacity

**Quality signals**:
- Assumptions are falsifiable (you can imagine being wrong)
- Hypotheses have measurable validation criteria
- Constraints distinguish between "won't do" (choice) and "can't do" (hard limit)

**Example**:

```markdown
### Assumptions
- Users have internet access during operation
- Organizers input results after matches conclude (not real-time during play)
- A single deployment serves one organization/league system

### Hypotheses
- We believe organizers will prefer automated fixture generation over manual scheduling. We will know this is true when >80% of competitions use auto-generated fixtures without manual overrides.

### Constraints
- PostgreSQL is the only supported database (EF Core dependency)
- Docker runtime required on target host
- .NET 10 runtime required
```

---

## 15. Dependencies & Third-Party SLAs — `Conditional`

> Include when the product relies on external services, APIs, or teams.

**Why it matters**: External dependencies are single points of failure. If the PRD doesn't document them, the team discovers them during outages.

**Must include**:
- External services with their purpose
- Expected SLA/availability for each dependency
- Fallback behavior when a dependency is unavailable
- Data flow direction (what data goes where)

**Example**:

```markdown
| Dependency | Purpose | Expected SLA | Fallback |
|------------|---------|-------------|----------|
| Google OAuth | Authentication | 99.95% | Show "Unable to connect" with retry |
| CDN (Cloudflare) | Photo hosting | 99.9% | Serve initials placeholder |
| PostgreSQL | Data storage | Self-hosted | 503 error for writes; serve cached public cards |
```

---

## 16. Risks & Mitigations — `Recommended`

**Why it matters**: Every project has risks. Documenting them with probability, impact, and mitigation turns surprises into managed issues.

**Must include**:
- Risk description
- Impact (what goes wrong if the risk materializes)
- Probability (Low / Medium / High)
- Mitigation strategy

**Example**:

```markdown
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Fixture generation edge cases (odd teams, byes) | Incorrect schedules | Medium | Comprehensive unit tests for all team count scenarios |
| API key exposure | Unauthorized write access | Low | HTTPS enforced; key rotation guidance; abuse monitoring |
| Username change breaks shared links | User confusion, lost traffic | Medium | Confirmation modal with explicit warning |
```

---

## 17. Scope & Prioritization — `Required`

**Why it matters**: Scope creep is the #1 project killer. Explicit in/out scope with prioritization keeps the team focused.

**Must include**:
- **In Scope**: Feature areas included in this release, with specific capabilities listed
- **Out of Scope**: Features explicitly deferred, with rationale for deferral
- **Prioritization**: MoSCoW (Must/Should/Could/Won't) or P0/P1/P2 applied to in-scope items

**Quality signals**:
- Out-of-scope items have a reason (not just "not now")
- Prioritization is applied consistently (not everything is "Must Have")
- Future phases are captured but clearly separated

**Example**:

```markdown
### Out of Scope (v1)
| Feature | Rationale |
|---------|-----------|
| Native mobile apps | Web-first approach; API supports future mobile development |
| Live match updates | Requires real-time infrastructure (SignalR); planned for Phase 2 |
| Multi-tenant SaaS | Single-tenant initially; architecture supports future multi-tenancy |
```

---

## 17b. Feature Index — `Conditional`

> Include when the product uses a hub-and-spoke PRD architecture with separate feature documents.

**Why it matters**: As products grow, a single PRD becomes unwieldy. The Feature Index acts as a directory linking to separate feature documents, keeping the parent PRD as a strategic landing page while detailed requirements live in their own documents.

**Must include**:
- Feature name
- Status (Draft / In Review / Approved / Active Development / Shipped)
- Link to feature document (relative path)
- One-line summary

**Example**:

```markdown
## Feature Index

| Feature | Status | Document | Summary |
|---------|--------|----------|---------|
| Player Statistics | Draft | [prd-player-stats.md](prd-player-stats.md) | Individual player performance tracking and leaderboards |
| Live Match Updates | In Review | [prd-live-updates.md](prd-live-updates.md) | Real-time score and event updates via WebSocket |
| Notifications | Planned | — | Email/push notifications for fixtures and results |
```

---

## 18. Release Phases & Launch Plan — `Recommended`

**Why it matters**: Multi-phase delivery reduces risk. A launch plan ensures the team thinks about rollout, not just development.

**Must include**:
- Phase definitions with included features per phase
- Rollout strategy (big bang, percentage rollout, feature flags, beta)
- Rollback plan (what happens if something goes wrong post-launch)
- Go-to-market considerations (documentation, onboarding, communication)

**Example**:

```markdown
### Phase 1 — MVP
- Competition management, fixture generation, result entry
- Automatic standings with configurable tie-breakers
- Blazor Server web interface + RESTful API
- Docker deployment

### Phase 2
- Live match updates (SignalR)
- Email/push notifications
- Player statistics aggregation

### Rollout Strategy
- Internal dogfooding with test competition (1 week)
- Beta with 3 organizer partners (2 weeks)
- General availability
- Rollback: Feature flags on all new endpoints; database migration rollback scripts tested pre-launch
```

---

## 19. Acceptance Criteria — `Required`

**Why it matters**: Without acceptance criteria, "done" is subjective. Acceptance criteria define the exact conditions under which a feature passes. QA, developers, and PMs should all agree on these before implementation starts.

**Must include**:
- Testable pass/fail conditions per feature or requirement
- Written in Given/When/Then format or equivalent concrete conditions
- Covers happy path, error cases, and boundary conditions

**Quality signals**:
- Each criterion is binary (pass or fail, no "partially works")
- Criteria reference specific data values, not vague outcomes
- Both functional and non-functional criteria are included

**Example**:

```markdown
### FR-FIX-07: Record Forfeit

**Given** a scheduled fixture between Team A and Team B
**When** the organizer records a forfeit by Team B
**Then**:
- The fixture score is set to 3-0 (Team A wins)
- The fixture status changes to "Forfeited"
- Team A standings are updated: +1 Played, +1 Won, +3 GF, +0 GA, +3 points
- Team B standings are updated: +1 Played, +1 Lost, +0 GF, +3 GA, +0 points
- The forfeiting team is identified in the fixture record

**Given** a fixture that is already Completed
**When** the organizer attempts to record a forfeit
**Then** the action is rejected with error "Cannot forfeit a completed fixture"
```

---

## 20. Observability & Configuration — `Conditional`

> Include for production systems where operational visibility and tuning matter.

**Why it matters**: If you can't observe it, you can't operate it. This section defines what the team needs to monitor, debug, and tune the system in production.

**Must include**:
- **Logging**: What events are logged, at what level, structured format
- **Metrics**: Key operational metrics to track (latency, error rates, queue depths)
- **Alerts**: Conditions that should trigger alerts (and to whom)
- **Configuration**: What's tunable at runtime vs. deploy-time vs. hardcoded

**Example**:

```markdown
### Logging
- All API requests logged: method, path, status code, duration, user ID
- All result submissions logged: fixture ID, scores, submitting user
- All errors logged with stack trace and request context

### Metrics
| Metric | Type | Alert Threshold |
|--------|------|----------------|
| API P95 latency | Histogram | > 500ms for 5 minutes |
| Fixture generation failures | Counter | > 0 in any 1-hour window |
| Database connection pool usage | Gauge | > 80% for 10 minutes |

### Configuration
| Setting | Default | Tunable At |
|---------|---------|------------|
| API key | (secret) | Environment variable |
| Max players per team | 25 | Competition rules (runtime) |
| Session timeout | 7 days | Environment variable |
| Rate limit (vCard downloads) | 500/hr/IP | Environment variable |
```

---

## 21. Glossary — `Conditional`

> Include when the domain has specialized, ambiguous, or overloaded terms.

**Why it matters**: Terminology drift is a top source of bugs and miscommunication. A glossary establishes a shared vocabulary.

**Must include**:
- Term and its precise definition in this product's context
- Disambiguation where terms could be confused

**Example**:

```markdown
| Term | Definition |
|------|------------|
| Competition | A league, tournament, or group stage event |
| Fixture | A scheduled match between two teams |
| Standing | A team's accumulated record within a competition |
| Bye | A round in which a team does not play (odd team count) |
| Forfeit | A match awarded to one team due to the opponent's failure to play (fixed 3-0 score) |
```

---

## 22. Open Questions, Decisions Log & FAQ — `Recommended`

**Why it matters**: Unresolved questions should be visible, not hidden. Decisions should be traceable. FAQs anticipate stakeholder concerns and reduce review cycles.

**Must include**:
- **Open questions**: Unresolved decisions with checkboxes, owner, and deadline (if known)
- **Decisions log**: Key decisions made during PRD development with rationale and date
- **FAQ**: Anticipated questions from stakeholders with pre-written answers

**Quality signals**:
- Open questions are specific (not "what should we do about X?")
- Each open question has a proposed owner
- FAQ answers reference specific sections of the PRD

**Example**:

```markdown
### Open Questions
- [ ] Who provisions API keys — key-per-organizer or single shared key? (Owner: Backend Lead)
- [ ] What is the data retention policy for completed competitions? (Owner: Product)
- [ ] Maximum concurrent competitions per deployment? (Owner: Infra)

### Decisions Log

| Decision | Rationale | Date | Decided By |
|----------|-----------|------|------------|
| Use automated fixture generation over manual scheduling | Reduces organizer workload by 90%; error-prone manual process | 2026-01-15 | Product + Engineering |
| Single-tenant architecture for v1 | Simplifies deployment; multi-tenant deferred to Phase 3 | 2026-01-20 | Architecture Review |

### FAQ
**Q: Can an organizer add a team after fixtures are generated?**
A: No. The team list is locked after fixture generation. Adding a team requires regenerating all fixtures with a confirmation warning (see FR-COMP-03).
```

---

# Quality Evaluation Rubric

> Used by the `prd-analyze` skill to score PRD quality. Each criterion is scored 0 (absent), 1 (partial), or 2 (strong).

## Structure & Completeness (max 20 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 1 | All Required sections present | ≥2 missing | 1 missing | All present |
| 2 | All Recommended sections present or consciously excluded | ≥2 missing without reason | 1 missing | All present or excluded with rationale |
| 3 | Conditional sections present where context demands | Obvious omissions | Minor gaps | Appropriate coverage |
| 4 | Metadata complete (type, version, status, date, author, revision history) | No metadata | Partial | Complete |
| 5 | Sections are proportional to complexity (no stubs, no bloat) | Multiple stubs | Minor imbalance | Well-proportioned |
| 6 | Internal cross-references between related sections | None | Some | Consistent |
| 7 | No orphaned content (every feature maps to a requirement, every requirement maps to acceptance criteria) | Significant orphans | Minor gaps | Full traceability |
| 8 | Document reads as a coherent narrative, not just filled-in blanks | Template smell | Serviceable | Compelling |
| 9 | Non-goals are explicit and substantive | Missing | Generic | Specific with rationale |
| 10 | Open questions are flagged (not hidden as assumptions) | Questions buried | Some flagged | All surfaced clearly |

## Specificity & Precision (max 16 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 11 | Functional requirements have specific verbs, inputs, validation, side effects | Vague | Mostly specific | Fully implementable |
| 12 | Data model has types, constraints, and validation for all fields | No model | Fields listed without constraints | Complete with limits |
| 13 | NFRs have numeric targets with measurement method | Vague ("fast") | Numbers without measurement | Numbers + how to measure |
| 14 | KPIs have baselines and targets | No KPIs | Targets only | Baselines + targets + method |
| 15 | Error messages specified verbatim | "Show error" | Some verbatim | All key messages specified |
| 16 | User flows are numbered step-by-step (not just stories) | Stories only | Partial flows | Complete flows for key journeys |
| 17 | Enumerations are exhaustive (no "e.g.") | Open-ended | Mostly complete | Fully enumerated |
| 18 | Acceptance criteria are binary pass/fail | Missing | Partial | Given/When/Then for key features |

## Evidence & Reasoning (max 8 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 19 | Problem statement cites real evidence | No evidence | Assertions | Data, quotes, or references |
| 20 | Assumptions are separated from facts | Mixed together | Partially separated | Clear distinction |
| 21 | Trade-offs are acknowledged honestly | Ignored | Mentioned | Analyzed with reasoning |
| 22 | Risks have probability, impact, and mitigation | No risks | Risks listed | Full risk analysis |

## Consistency & Coherence (max 6 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 23 | Terminology is consistent throughout | Drift in >3 terms | Minor drift | Consistent vocabulary |
| 24 | Data model ↔ flows ↔ requirements are aligned | Contradictions | Minor gaps | Fully aligned |
| 25 | Scope ↔ requirements ↔ phases are aligned | Conflicts | Minor mismatches | Consistent |

## Narrative & Persuasion (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 26 | Compelling problem framing — creates urgency and emotional resonance | Dry listing of issues | Some urgency | Reader understands why this matters NOW |
| 27 | Clear "why now" — articulates timing, market moment, or cost of delay | No timing context | Implicit urgency | Explicit "why now" with supporting reasoning |

---

**Total: 54 points**

| Score Range | Rating | Interpretation |
|-------------|--------|---------------|
| 40-50 | Excellent | Implementation-ready; minor polish only |
| 30-39 | Good | Solid foundation; address gaps before implementation |
| 20-29 | Fair | Significant gaps; needs another revision pass |
| 10-19 | Weak | Major sections missing or hollow; needs substantial rework |
| 0-9 | Incomplete | Not yet a PRD; needs discovery and drafting |
