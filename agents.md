# Agents Overview

This document synthesizes the roles, automations, and human/AI agents implied across the five project documents:

- konsep-aplikasi-pinjol.md
- requirements-specification.md
- database-schema-detail.md
- technical-architecture.md
- RINGKASAN-KONSEP-PINJOL.md

The goal is to clarify which agents exist in the KreditKu ecosystem, what they do, how they interact, and what data they need.

## 1. Agent Taxonomy

We categorize agents into three groups:

1) Client-facing agents (user-side)
2) Backend service agents (system-side automations)
3) Human operational agents (internal teams)

## 2. Client-Facing Agents

- Mobile Client Agent (Flutter)
  - Role: Acts on behalf of end users (nasabah) to register, complete KYC, apply for loans, make payments, and receive notifications.
  - Interfaces: REST API, WebSocket (real-time), FCM for push notifications.
  - Data handled: user profile, KYC photos, location (optional), device info, session tokens.

- Web Admin Client Agent (React)
  - Role: Operates on behalf of staff to review KYC, approve/reject loans, manage collections, and view reports.
  - Interfaces: REST API, WebSocket, authentication with RBAC.
  - Data handled: user and loan records, payment and audit data, configuration.

## 3. Backend Service Agents (Automations)

These are autonomous or scheduled services within TrailBase that enforce business rules and workflows.

- Auth Agent
  - Triggers: Registration/Login, token refresh, OTP issuance/verification.
  - Responsibilities: Credential validation, 2FA/OTP, JWT issuance, session/device trust, rate limiting.
  - Data: users, user_sessions, audit_logs.

- KYC Agent
  - Triggers: User submits documents or selfie.
  - Responsibilities: Upload to object storage, call OCR and Face services, liveness and face match scoring, risk flags, manual review routing.
  - Data: kyc_verifications, users, blacklist, external service logs.

- Credit Scoring Agent
  - Triggers: KYC completion, loan application, payment events, periodic reviews.
  - Responsibilities: Compute score (300–850), update user credit limits, log factors and changes.
  - Data: credit_scoring_logs, users, loans, payments.

- Loan Underwriting Agent
  - Triggers: New loan application.
  - Responsibilities: Eligibility checks, pricing terms, auto-approval based on thresholds, queueing for manual review when borderline.
  - Data: loans, users, fraud_detection_logs, system_configurations.

- Disbursement Agent
  - Triggers: Approved loans ready for payout.
  - Responsibilities: Initiate bank/e-wallet transfers, track references, handle retries/failures, update statuses and accounting entries.
  - Data: loans, journal_entries, journal_lines.

- Payment Processing Agent
  - Triggers: Payment initiation and webhooks from gateway.
  - Responsibilities: Generate VA, confirm payments, reconcile, update outstanding, send receipts, record fees.
  - Data: payments, loans, notifications, journal_entries, journal_lines.

- Anti-Fraud Agent
  - Triggers: Login, KYC, loan apply, payment, unusual activity.
  - Responsibilities: Device fingerprinting, velocity checks, behavioral/document/network analysis, risk scoring, actions (flag/challenge/block).
  - Data: fraud_detection_logs, blacklist, users, loans, kyc_verifications.

- Notification Agent
  - Triggers: Transactional events (OTP, approval, disbursement, payment), reminders (due/overdue schedule), marketing (opt-in).
  - Responsibilities: Multi-channel delivery (push/SMS/WhatsApp/email/in-app), retry/fallback, quiet hours enforcement, templating.
  - Data: notifications, users, system_configurations.

- Collection Agent
  - Triggers: Overdue loans and DPD thresholds.
  - Responsibilities: Segmentation (soft reminder → legal), schedule reminders, assign cases, track promises to pay, escalate.
  - Data: collection_cases, collection_activities, loans, users.

- Accounting Agent
  - Triggers: Disbursement, payment, fees, write-offs, adjustments.
  - Responsibilities: Double-entry posting, period closing, reconciliation support, reporting views.
  - Data: chart_of_accounts, journal_entries, journal_lines.

- Monitoring/Observability Agent
  - Triggers: Continuous.
  - Responsibilities: Export metrics (Prometheus), health checks, alerting hooks, log correlation.
  - Data: metrics endpoints, logs, alerts.

## 4. Human Operational Agents (Internal Roles)

- Super Admin
  - Capabilities: System configuration, user role management, security policies.

- Admin
  - Capabilities: Full dashboard access; oversees daily operations and reports.

- Credit Analyst
  - Capabilities: KYC review, loan application review, decisioning notes, overrides within policy.

- Collector
  - Capabilities: Manage overdue queues, make contact, log activities, register promises to pay, escalate.

- Accountant
  - Capabilities: Financial reporting, reconciliation, adjustments, period closing.

- Customer Service
  - Capabilities: User support, FAQs, triage issues, trigger resends and limited admin actions per policy.

## 5. Interactions and Flows

- Registration/Login → Auth Agent → Session/JWT → Mobile/Web Clients
- KYC Submission → KYC Agent → External OCR/Face → KYC result → Analyst (if manual)
- Loan Apply → Underwriting Agent → Credit Scoring + Anti-Fraud → Auto/Manual decision → Disbursement Agent (if approved)
- Payment Initiation → Payment Agent → VA generation → Webhook confirmation → Accounting + Notification
- Overdue Detection → Collection Agent → Reminders/Activities → Escalation

Mermaid sequence examples are detailed in technical-architecture.md; these agents align with those flows.

## 6. Data Ownership by Agent

- Auth: users, user_sessions
- KYC: kyc_verifications (+ object storage)
- Scoring: credit_scoring_logs, users.credit_score/limit
- Underwriting: loans (status transitions), risk fields
- Disbursement: loans.disbursement_*, journal_entries/lines
- Payment: payments, loans.outstanding_amount, receipts
- Fraud: fraud_detection_logs, blacklist
- Notification: notifications
- Collection: collection_cases, collection_activities
- Accounting: chart_of_accounts, journal_entries, journal_lines

## 7. Security & Compliance Responsibilities

- All agents: adhere to RBAC, audit logging, rate limiting, and encryption policies.
- External integrations: signed requests, timeouts, idempotency keys, and webhook signature verification.
- PII handling: field-level encryption and least-privilege access.

## 8. SLA and Performance Targets (per agents)

- Auth/KYC/Underwriting APIs: p95 < 500ms
- Webhook handling: < 2s end-to-end, retry on failure
- Notification dispatch: enqueue < 100ms; delivery per channel policy
- Batch/cron agents: complete within configured windows; no impact on online traffic

## 9. Roadmap Alignment

The implementation roadmap (phases in the concept and requirements docs) maps to enabling these agents incrementally:

- Phase 1–2: Auth, KYC, Scoring, Underwriting (MVP backend agents)
- Phase 3–4: Mobile/Web client agents; Notification and Payment agents
- Phase 5: Anti-Fraud ML enhancements; Accounting and Collection maturity
- Phase 6–7: Observability hardening, DR/backup automation

## 10. Appendix: Tables Referenced

Core tables per database-schema-detail.md utilized by agents:
- users, user_sessions, kyc_verifications, loans, payments, credit_scoring_logs,
  fraud_detection_logs, notifications, collection_cases, collection_activities,
  chart_of_accounts, journal_entries, journal_lines, system_configurations, blacklist

This document will guide implementation of services and scheduled jobs as discrete agents within the TrailBase deployment.
