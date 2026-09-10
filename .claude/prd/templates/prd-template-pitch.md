# PRD Shape Up Pitch Reference Template

> **Purpose**: Betting table proposal template based on Basecamp's Shape Up methodology. Designed for fixed-appetite work with clear boundaries.
>
> Use this when proposing work for a build cycle — the goal is to pitch a problem worth solving within a fixed time budget, with explicit rabbit holes and no-gos.

---

## Section Structure

All 6 sections are **Required**.

| # | Section | Purpose |
|---|---------|---------|
| 1 | Metadata | Ownership, appetite, document type |
| 2 | Problem | Raw idea, motivation, current workarounds |
| 3 | Appetite | Time budget and scope constraints |
| 4 | Solution | Fat-marker sketch and breadboarding |
| 5 | Rabbit Holes | Technical risks and complexity traps |
| 6 | No-Gos | Explicit exclusions with rationale |

---

## 1. Metadata — `Required`

**Must include**:
- Document title
- Type: Shape Up Pitch
- Appetite (Small Batch: 1-2 weeks / Big Batch: 6 weeks)
- Version, status, date, author

**Example**:

```markdown
# Pitch: Notification Preferences

> **Type:** Shape Up Pitch
> **Appetite:** Small Batch (2 weeks)
> **Version:** 1.0
> **Status:** Proposed
> **Date:** 2026-02-13
> **Author:** [Name], Product Manager
```

---

## 2. Problem — `Required`

**Must include**:
- The raw idea or request that sparked this pitch
- Who has the problem and what their current workaround is
- Why this matters now (motivation, not just description)
- A concrete use case showing the pain

**Quality signals**:
- Starts from a real situation, not an abstract feature request
- Shows the current workaround and why it's inadequate
- Creates empathy — the reader feels the user's frustration

**Anti-pattern**: "We need notification preferences" — that's a solution, not a problem. Better: "Users are getting 30+ emails per day from the app and are unsubscribing entirely because there's no way to tune notification volume."

**Example**:

```markdown
## Problem

**Raw idea**: Several users have asked for notification preferences.

**The real problem**: Users receive every notification type (comments, mentions, status changes, weekly digests) with no way to control volume. A power user in our beta reported receiving 47 emails in a single day. Three users have unsubscribed from all notifications entirely — meaning they also miss direct mentions and urgent updates.

**Current workaround**: Users create email filters to auto-archive app notifications, but this is all-or-nothing. They can't keep mentions while silencing status changes.

**Why now**: We're onboarding 50 new team accounts next month. If notification fatigue causes early unsubscribes, we lose the engagement loop that drives retention.
```

---

## 3. Appetite — `Required`

**Must include**:
- Time budget: Small Batch (1-2 weeks) or Big Batch (6 weeks)
- What this appetite means for scope — what level of solution fits the budget
- The key constraint: if it can't be done in this appetite, we don't do it (or reshape)

**Quality signals**:
- Appetite is a deliberate choice, not an estimate
- Explains what a "good enough" solution looks like at this appetite
- Acknowledges what a larger appetite would unlock (but explicitly doesn't commit to it)

**Example**:

```markdown
## Appetite

**Small Batch: 2 weeks**

At this appetite, we can build a simple per-category toggle (on/off for each notification type) with a single delivery channel (email). This is enough to solve the volume problem for 90% of users.

A 6-week appetite would allow per-channel preferences (email vs. in-app vs. push), quiet hours, and digest batching — but the core pain is volume control, not channel routing. We can revisit channel preferences later if usage data supports it.

**Hard constraint**: If the notification system architecture requires more than 2 weeks of refactoring to support per-category toggles, we reshape or drop this pitch.
```

---

## 4. Solution — `Required`

**Must include**:
- **Fat-marker sketch**: High-level description of the solution — broad strokes, not wireframes. Describe the key elements and how they connect, leaving room for the builders to fill in details.
- **Core elements**: 3-5 key components or interactions (bullet list)
- **Breadboard**: A text-based user flow showing places (screens), affordances (buttons/inputs), and connections (navigation)

**Quality signals**:
- Deliberately incomplete — leaves design details to the builders
- Focuses on the important interactions, not visual polish
- Breadboard shows the flow clearly without UI specifics

**Anti-pattern**: Pixel-perfect mockups or detailed wireframes in a pitch — that over-specifies and removes builder autonomy.

**Example**:

```markdown
## Solution

**Fat-marker sketch**: A new "Notification Preferences" page accessible from account settings. Users see a list of notification categories with on/off toggles. Changes save immediately (no submit button). A "mute all" shortcut at the top for users who want silence.

**Core elements**:
- Category list with toggles (Comments, Mentions, Status Changes, Weekly Digest, System Alerts)
- Mute All / Unmute All shortcut
- Immediate save on toggle (no form submission)
- Default: all categories ON for new users
- Mentions category cannot be fully muted (downgraded to in-app only, never silent)

**Breadboard**:

```
Settings Page
  → [Notification Preferences] link

Notification Preferences Page
  → "Mute All" toggle
  → Category: Comments        [ON/OFF]
  → Category: Mentions         [ON] (locked — always at least in-app)
  → Category: Status Changes   [ON/OFF]
  → Category: Weekly Digest    [ON/OFF]
  → Category: System Alerts    [ON] (locked — always on)
  → Changes saved automatically
  → Back to Settings
```
```

---

## 5. Rabbit Holes — `Required`

**Must include**:
- Technical risks or complexity traps that could blow the appetite
- Ambiguities that need to be resolved before building
- Areas where the team might over-engineer or get stuck
- For each rabbit hole: the risk and how to avoid it

**Quality signals**:
- Identifies non-obvious risks (not just "it might be hard")
- Each risk has a concrete avoidance strategy
- Shows the pitcher has thought about implementation complexity

**Example**:

```markdown
## Rabbit Holes

**Notification system coupling**: The current notification service fires events synchronously. Adding per-user preference checks could slow down the hot path. **Avoidance**: Check preferences asynchronously — queue the notification, then filter before delivery. Don't touch the event-firing code.

**Retroactive preference application**: Users might expect toggling "off" to also remove past notifications from their inbox. **Avoidance**: Preferences apply forward-only. Don't build retroactive filtering — it's a different feature entirely.

**Granularity creep**: The team might want to add per-project or per-channel preferences. **Avoidance**: This pitch is category-level only. Per-project filtering is a separate pitch at Big Batch appetite.

**Migration for existing users**: All existing users currently have implicit "all on" preferences. **Avoidance**: No migration needed — treat absence of preference record as "all on" (default). Only create records when users change a setting.
```

---

## 6. No-Gos — `Required`

**Must include**:
- Features or approaches explicitly excluded from this pitch
- Rationale for each exclusion
- Where deferred items might live (future pitch, never, etc.)

**Quality signals**:
- No-gos are things someone might reasonably expect to be included
- Each has a clear reason (not just "out of scope")
- Prevents scope creep during build

**Example**:

```markdown
## No-Gos

| Exclusion | Rationale | Future? |
|-----------|-----------|---------|
| Per-channel preferences (email vs. push vs. in-app) | Adds significant complexity; core pain is volume, not channel | Separate pitch if needed |
| Quiet hours / Do Not Disturb | Requires time-zone-aware scheduling infrastructure | Maybe Phase 2 |
| Notification digest batching | Requires queuing and batch send logic beyond 2-week appetite | Separate Big Batch pitch |
| Admin override of user preferences | Organizational control is a different problem space | Not planned |
| Notification history / audit log | Read path, not write path — separate concern | Separate pitch |
```

---

# Quality Evaluation Rubric

> Used by `prd-analyze` to score Shape Up Pitch quality. Each criterion is scored 0 (absent), 1 (partial), or 2 (strong).

## Structure & Completeness (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 1 | All 6 sections present | ≥2 missing | 1 missing | All present |
| 2 | Metadata complete (type, appetite, version, status, date, author) | No metadata | Partial | Complete with appetite |

## Specificity & Precision (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 3 | Solution has fat-marker sketch + breadboard (not wireframes) | No solution detail | Sketch only | Sketch + breadboard |
| 4 | No-gos are specific with rationale | Missing or generic | Some rationale | Each exclusion explained |

## Scoping & Appetite (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 5 | Appetite is a deliberate choice with scope implications | No appetite | Time estimate only | Appetite + what fits/doesn't |
| 6 | Rabbit holes identified with avoidance strategies | No risks | Risks listed | Risks + concrete avoidance |

## Clarity & Persuasion (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 7 | Problem starts from real situation with evidence | Abstract feature request | Some context | Concrete use case + data |
| 8 | Pitch is concise and readable in under 10 minutes | Bloated or unclear | Some filler | Tight and compelling |

---

**Total: 16 points**

| Score Range | Rating | Interpretation |
|-------------|--------|---------------|
| 13-16 | Excellent | Ready for betting table; clear and well-bounded |
| 10-12 | Good | Minor gaps; tighten before presenting |
| 7-9 | Fair | Needs reshaping; appetite or scope unclear |
| 4-6 | Weak | Major gaps; problem or solution underspecified |
| 0-3 | Incomplete | Not yet a viable pitch |
