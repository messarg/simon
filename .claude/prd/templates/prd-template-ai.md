# AI Product PRD Reference Template

> **Purpose**: Extended PRD template for AI/ML features that require extra scrutiny on data pipelines, model behavior, failure modes, ethics, and monitoring.
>
> This template includes all 22 sections from the standard Full PRD **plus** 5 AI-specific Required sections (27 sections total). Use it when the feature involves machine learning models, LLM integrations, recommendation engines, or any AI-driven behavior.

---

## Section Structure

This template **extends** the Full PRD template (`.claude/templates/prd-template.md`). All 22 standard sections apply with the same inclusion levels. The 5 AI-specific sections are inserted after section 13 (Non-Functional Requirements).

### Standard Sections (from Full PRD)

| # | Section | Level |
|---|---------|-------|
| 1 | Metadata & Revision History | Required |
| 2 | Executive Summary | Required |
| 3 | Problem Statement & Evidence | Required |
| 3b | Competitive Landscape | Recommended |
| 4 | Goals, Non-Goals & KPIs | Required |
| 5 | Target Users & Personas | Required |
| 6 | User Stories & Flows | Required |
| 7 | Functional Requirements | Required |
| 8 | Data Model & Validation Rules | Required |
| 9 | API & Integration Contracts | Conditional |
| 10 | State Machines & Lifecycle | Conditional |
| 11 | UI/UX Specifications | Recommended |
| 12 | Error States & Edge Cases | Required |
| 13 | Non-Functional Requirements | Required |

### AI-Specific Sections (new)

| # | Section | Level |
|---|---------|-------|
| 14 | Model Performance Requirements | Required (AI) |
| 15 | Data Dependencies & Pipeline | Required (AI) |
| 16 | Failure Modes & Fallbacks | Required (AI) |
| 17 | Ethical Considerations & Bias | Required (AI) |
| 18 | Monitoring & Drift Detection | Required (AI) |

### Remaining Standard Sections (renumbered)

| # | Section | Level |
|---|---------|-------|
| 19 | Assumptions, Hypotheses & Constraints | Required |
| 20 | Dependencies & Third-Party SLAs | Conditional |
| 21 | Risks & Mitigations | Recommended |
| 22 | Scope & Prioritization | Required |
| 23 | Release Phases & Launch Plan | Recommended |
| 24 | Acceptance Criteria | Required |
| 25 | Observability & Configuration | Conditional |
| 26 | Glossary | Conditional |
| 27 | Open Questions, Decisions Log & FAQ | Recommended |

---

## Metadata Note

The metadata section must include:

```markdown
> **Type:** AI Product PRD
```

All other metadata fields follow the standard Full PRD template.

---

## Standard Sections (1-13, 19-27)

For guidance on standard sections, refer to `.claude/templates/prd-template.md`. All rules, quality signals, examples, and anti-patterns from the Full PRD template apply unchanged.

**Key differences for AI PRDs in standard sections:**

- **Section 4 (Goals & KPIs)**: Include model-specific KPIs alongside product KPIs (e.g., accuracy, F1 score, latency targets)
- **Section 8 (Data Model)**: Include training data schemas and feature store schemas alongside application data
- **Section 12 (Error States)**: Include AI-specific error states (low confidence, hallucinations, model unavailability)
- **Section 13 (NFRs)**: Include model inference latency and throughput alongside standard performance requirements

---

## 14. Model Performance Requirements — `Required (AI)`

**Why it matters**: AI features have unique performance characteristics. Unlike traditional code, model quality is probabilistic — you need explicit targets for accuracy, latency, and acceptable failure rates.

**Must include**:
- Accuracy/quality metrics with targets per use case (precision, recall, F1, BLEU, etc.)
- Latency requirements (P50, P95, P99) for inference
- Throughput targets (requests per second, batch processing volume)
- Model size and memory constraints (if deploying on-device or in constrained environments)
- Acceptable failure rate and what constitutes a "failure"

**Quality signals**:
- Metrics are appropriate for the task type (classification vs. generation vs. ranking)
- Targets distinguish between different use cases or user segments
- Failure definition is explicit (not just "the model is wrong")

**Example**:

```markdown
## Model Performance Requirements

### Quality Metrics

| Metric | Target | Use Case | Measurement |
|--------|--------|----------|-------------|
| Precision | ≥ 0.92 | Content classification | Fraction of flagged items that are truly policy-violating |
| Recall | ≥ 0.85 | Content classification | Fraction of policy-violating items caught |
| P95 latency | < 200ms | Real-time classification | Time from API request to classification result |
| P99 latency | < 500ms | Real-time classification | Tail latency under peak load |
| Throughput | ≥ 1,000 req/s | Batch processing | Sustained classification rate for backfill jobs |

### Model Constraints
- Max model size: 500MB (must fit in standard container memory allocation)
- Inference: GPU not required for serving (CPU-only deployment)
- Cold start: < 5 seconds (model loading time)

### Failure Definition
A "failure" is any classification where the model returns confidence < 0.6. These are routed to human review.
Expected failure rate: < 8% of total classifications.
```

---

## 15. Data Dependencies & Pipeline — `Required (AI)`

**Why it matters**: AI features are only as good as their data. Without explicit data requirements, teams discover data quality issues during training — or worse, in production.

**Must include**:
- Training data sources with volume estimates
- Data quality requirements (completeness, accuracy, freshness, representativeness)
- Labeling strategy (human annotation, semi-supervised, synthetic, existing signals)
- Data pipeline architecture (batch vs. streaming, update frequency)
- Data versioning and lineage tracking approach
- PII and data sensitivity classification

**Quality signals**:
- Data sources are specific (not "we'll use our data")
- Quality requirements have numeric thresholds
- Labeling strategy accounts for cost and timeline
- Pipeline handles both training and inference data

**Example**:

```markdown
## Data Dependencies & Pipeline

### Training Data Sources

| Source | Volume | Freshness | Quality Notes |
|--------|--------|-----------|---------------|
| User reports (flagged content) | 50K labeled samples | Updated weekly | Gold labels from trust & safety team |
| Synthetic samples (LLM-generated) | 20K samples | One-time generation | Validated by 2 human annotators per sample |
| Public benchmark (HatEval 2024) | 13K samples | Static | Used for baseline comparison only |

### Data Quality Requirements
- **Label accuracy**: ≥ 95% inter-annotator agreement (measured on 10% sample)
- **Class balance**: No class < 15% of total samples (oversample if needed)
- **Freshness**: Training data must include samples from the last 30 days
- **Representativeness**: Must cover all 6 content categories and 3 languages

### Labeling Strategy
- Primary: Human annotation by trained trust & safety team (8-person team, 500 labels/day)
- Augmentation: GPT-4 synthetic generation for underrepresented categories, validated by 2 human reviewers
- Budget: ~$15K for initial labeling round (50K samples × $0.30/label)

### Pipeline Architecture
- **Training pipeline**: Weekly batch retrain on new labeled data (Airflow DAG)
- **Inference pipeline**: Real-time API with model served via TorchServe
- **Feature store**: Not applicable (raw text input, no feature engineering)
- **Data versioning**: DVC for training datasets; model registry in MLflow

### Data Sensitivity
- Training data contains user-generated content (PII scrubbed before labeling)
- No raw PII in training data; content anonymized with entity replacement
- Data retention: Training datasets retained for 12 months for reproducibility
```

---

## 16. Failure Modes & Fallbacks — `Required (AI)`

**Why it matters**: AI systems fail differently from traditional software. They don't crash — they return wrong answers with high confidence. Without explicit failure mode planning, users experience silent errors.

**Must include**:
- Model output errors (false positives, false negatives, hallucinations, nonsensical outputs)
- Confidence thresholds and behavior at each level
- Fallback behavior when the model is unavailable or degraded
- Human-in-the-loop escalation criteria
- Graceful degradation strategy
- User-facing error handling (what the user sees when the model fails)

**Quality signals**:
- Confidence thresholds are explicit (not "when the model is unsure")
- Each failure mode has a specific recovery path
- User-facing messages don't expose model internals
- The system works (in degraded mode) even if the model is completely down

**Example**:

```markdown
## Failure Modes & Fallbacks

### Confidence-Based Routing

| Confidence Range | Action | User Experience |
|-----------------|--------|-----------------|
| ≥ 0.90 | Auto-action (no review) | Content removed immediately; appeal option shown |
| 0.60 – 0.89 | Human review queue | Content remains visible; review within 4 hours |
| < 0.60 | No action (model abstains) | Content remains visible; logged for analysis |

### Model Failure Scenarios

| Failure Mode | Detection | Fallback | User Impact |
|-------------|-----------|----------|-------------|
| Model service unavailable | Health check fails | All content passes through unfiltered; alert ops | No visible impact; moderation paused |
| Latency spike (>2s P95) | Prometheus alert | Circuit breaker → skip classification | Content unfiltered for spike duration |
| Model drift (accuracy drop) | Weekly eval on holdout set | Revert to previous model version | Automatic; no user impact |
| Adversarial input (prompt injection) | Input sanitization + output validation | Reject and log for analysis | "Unable to process" message |

### Human-in-the-Loop
- All medium-confidence decisions (0.60-0.89) reviewed by T&S team
- Target review SLA: 4 hours during business hours, 12 hours off-hours
- Escalation: If review queue > 500 items, alert T&S lead for triage
- Human decisions feed back into training data for next model iteration
```

---

## 17. Ethical Considerations & Bias — `Required (AI)`

**Why it matters**: AI systems can encode and amplify biases present in training data. Without proactive bias analysis, you risk discriminating against user segments, violating regulations, or eroding trust.

**Must include**:
- Potential biases in training data and model behavior (demographic, linguistic, cultural)
- Fairness metrics and how they'll be measured
- Bias testing strategy (pre-launch and ongoing)
- Transparency requirements (should users know they're interacting with AI?)
- User consent and data usage disclosure
- Regulatory compliance (GDPR, CCPA, EU AI Act, sector-specific)

**Quality signals**:
- Bias risks are specific to this product (not generic "AI can be biased")
- Fairness metrics are quantified with acceptable thresholds
- Transparency approach is a deliberate choice with rationale
- Compliance requirements reference specific regulations

**Example**:

```markdown
## Ethical Considerations & Bias

### Potential Biases

| Bias Type | Risk | Mitigation |
|-----------|------|------------|
| Linguistic bias | Model trained primarily on English; may underperform on non-English content or code-switching | Ensure ≥15% training data per supported language; measure per-language accuracy |
| Cultural bias | Western cultural norms overrepresented in moderation labels | Regional annotator teams for culturally sensitive categories |
| Demographic bias | Over-moderation of content from specific demographics (dialect, slang) | Disaggregated accuracy metrics by user demographic (where available) |

### Fairness Metrics
- **Equal opportunity**: False positive rate must not differ by >5% across demographic groups
- **Measurement**: Quarterly fairness audit on labeled sample (1K items per group)
- **Action threshold**: If disparity >5%, halt deployment and retrain with balanced data

### Transparency
- Users are informed that automated systems assist content moderation (Terms of Service, section 4.2)
- Appeal process explicitly states "automated review" when AI was the primary decision-maker
- Model explanations are NOT surfaced to users (black-box classification; explain via policy violation category only)

### Compliance
- **GDPR Article 22**: Users have right to not be subject to solely automated decisions. Human review path satisfies this requirement for medium-confidence classifications.
- **EU AI Act**: Content moderation classified as "high-risk" AI system. Requires risk assessment, human oversight, and technical documentation (maintained in model registry).
- **CCPA**: No personal data used for model training (content anonymized). Data deletion requests honored within 30 days.
```

---

## 18. Monitoring & Drift Detection — `Required (AI)`

**Why it matters**: AI models degrade silently. Unlike software bugs that crash, model drift causes gradually worsening predictions. Without monitoring, you won't know until user complaints spike.

**Must include**:
- Input distribution monitoring (detect data drift)
- Output quality monitoring (automated and manual checks)
- Performance degradation alerts with thresholds
- Retraining triggers and cadence
- A/B testing strategy for model updates
- Dashboard/observability requirements

**Quality signals**:
- Monitoring covers both input drift and output quality (not just one)
- Alert thresholds are specific (not "when performance degrades")
- Retraining is triggered by metrics, not just time
- A/B testing methodology is defined before launch

**Example**:

```markdown
## Monitoring & Drift Detection

### Input Monitoring
- **Distribution tracking**: Monitor input text length, language distribution, and category distribution daily
- **Drift detection**: KL divergence between current input distribution and training distribution; alert if > 0.15
- **Volume monitoring**: Alert if daily classification volume changes by >50% (spike or drop)

### Output Monitoring
- **Confidence distribution**: Track daily histogram of confidence scores; alert if mean confidence drops >10%
- **Action rate**: Track auto-action vs. human-review vs. abstain ratio; alert if auto-action rate changes >15%
- **Human override rate**: Track how often human reviewers disagree with model; alert if override rate >20%

### Alerts & Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Mean confidence | < 0.75 (was 0.82) | < 0.70 | Investigate input drift; consider retraining |
| Human override rate | > 15% | > 20% | Pause auto-actions; trigger emergency retrain |
| P95 latency | > 300ms | > 500ms | Scale inference replicas; investigate bottleneck |
| Daily volume anomaly | ±30% from 7-day average | ±50% | Investigate upstream changes |

### Retraining Strategy
- **Scheduled**: Weekly retrain on latest labeled data (Saturday batch job)
- **Triggered**: Emergency retrain if critical alert persists >24 hours
- **Evaluation**: New model must beat current model on holdout set before promotion
- **Rollback**: Previous model version always available; auto-rollback if new model's accuracy < current - 2%

### A/B Testing for Model Updates
- All model updates deployed to 10% traffic for 48 hours
- Compare: accuracy on human-reviewed subset, latency, user appeal rate
- Promote to 100% only if metrics are neutral or improved
- Statistical significance: p < 0.05, minimum 1,000 samples per arm

### Dashboard
- Grafana dashboard with: confidence distributions, action breakdown, latency percentiles, drift metrics
- Updated in real-time (1-minute granularity)
- Access: ML team + T&S leads + engineering on-call
```

---

# Quality Evaluation Rubric

> Used by `prd-analyze` to score AI Product PRD quality. Each criterion is scored 0 (absent), 1 (partial), or 2 (strong).
>
> This rubric extends the Full PRD rubric (27 criteria) with 5 additional AI-specific criteria (32 total).

## Structure & Completeness (max 24 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 1 | All Required sections present (12 standard + 5 AI-specific) | ≥2 missing | 1 missing | All present |
| 2 | All Recommended sections present or consciously excluded | ≥2 missing without reason | 1 missing | All present or excluded with rationale |
| 3 | Conditional sections present where context demands | Obvious omissions | Minor gaps | Appropriate coverage |
| 4 | Metadata complete (version, status, date, author, type, revision history) | No metadata | Partial | Complete with Type: AI Product PRD |
| 5 | Sections are proportional to complexity (no stubs, no bloat) | Multiple stubs | Minor imbalance | Well-proportioned |
| 6 | Internal cross-references between related sections | None | Some | Consistent |
| 7 | No orphaned content (every feature maps to a requirement, every requirement maps to acceptance criteria) | Significant orphans | Minor gaps | Full traceability |
| 8 | Document reads as a coherent narrative | Template smell | Serviceable | Compelling |
| 9 | Non-goals are explicit and substantive | Missing | Generic | Specific with rationale |
| 10 | Open questions are flagged (not hidden as assumptions) | Questions buried | Some flagged | All surfaced clearly |
| 11 | AI-specific sections integrated into document narrative (not bolted on) | Disconnected | Partially integrated | Seamlessly woven in |
| 12 | Data pipeline ↔ model requirements ↔ monitoring are aligned | Contradictions | Minor gaps | Fully aligned |

## Specificity & Precision (max 18 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 13 | Functional requirements have specific verbs, inputs, validation, side effects | Vague | Mostly specific | Fully implementable |
| 14 | Data model has types, constraints, and validation for all fields | No model | Fields listed without constraints | Complete with limits |
| 15 | NFRs have numeric targets with measurement method | Vague ("fast") | Numbers without measurement | Numbers + how to measure |
| 16 | KPIs have baselines and targets | No KPIs | Targets only | Baselines + targets + method |
| 17 | Error messages specified verbatim | "Show error" | Some verbatim | All key messages specified |
| 18 | User flows are numbered step-by-step (not just stories) | Stories only | Partial flows | Complete flows for key journeys |
| 19 | Enumerations are exhaustive (no "e.g.") | Open-ended | Mostly complete | Fully enumerated |
| 20 | Acceptance criteria are binary pass/fail | Missing | Partial | Given/When/Then for key features |
| 21 | Model performance metrics are task-appropriate with numeric targets | Vague ("accurate") | Some metrics | Complete with thresholds per use case |

## Evidence & Reasoning (max 10 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 22 | Problem statement cites real evidence | No evidence | Assertions | Data, quotes, or references |
| 23 | Assumptions are separated from facts | Mixed together | Partially separated | Clear distinction |
| 24 | Trade-offs are acknowledged honestly | Ignored | Mentioned | Analyzed with reasoning |
| 25 | Risks have probability, impact, and mitigation | No risks | Risks listed | Full risk analysis |
| 26 | Bias risks are specific to this product with mitigation strategies | No bias analysis | Generic "AI can be biased" | Specific biases with quantified fairness metrics |

## Consistency & Coherence (max 8 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 27 | Terminology is consistent throughout | Drift in >3 terms | Minor drift | Consistent vocabulary |
| 28 | Data model ↔ flows ↔ requirements are aligned | Contradictions | Minor gaps | Fully aligned |
| 29 | Scope ↔ requirements ↔ phases are aligned | Conflicts | Minor mismatches | Consistent |
| 30 | Training data ↔ model requirements ↔ monitoring metrics are aligned | Disconnected | Some alignment | End-to-end consistency |

## Narrative & Persuasion (max 4 points)

| # | Criterion | 0 | 1 | 2 |
|---|-----------|---|---|---|
| 31 | Compelling problem framing — creates urgency | Dry listing | Some urgency | Reader understands why this matters NOW |
| 32 | Clear "why now" — articulates timing or cost of delay | No timing context | Implicit urgency | Explicit "why now" with reasoning |

---

**Total: 64 points**

| Score Range | Rating | Interpretation |
|-------------|--------|---------------|
| 49-64 | Excellent | Implementation-ready; minor polish only |
| 39-48 | Good | Solid foundation; address gaps before implementation |
| 26-38 | Fair | Significant gaps; needs another revision pass |
| 13-25 | Weak | Major sections missing or hollow; needs substantial rework |
| 0-12 | Incomplete | Not yet a viable AI Product PRD |
