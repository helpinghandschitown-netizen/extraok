# ExtraOK — production release brief

> Public brand: **ExtraOK**. The source directory retains the original internal codename `deltaok`. An exact-name web search is only a preliminary screen, not trademark clearance.

## Product decision

Ship one focused workflow: a small contractor records a scope, price, or timing change; the client reviews the exact issued version without an account; the client approves, declines, or requests revision; both sides retain a signed, printable receipt. ExtraOK is an operational record, not legal advice or an enforceability guarantee.

## Ideal customer

US owner-operators and 2–10 person remodelers, painters, landscapers, handymen, and service trades that currently approve extras by text, phone, paper, or improvised PDF and do not want a full field-service suite.

## Production workflow

1. Contractor creates a change with original scope, requested change, reason, labor, materials, tax, and schedule impact.
2. ExtraOK calculates totals deterministically and signs the issued review package in the browser.
3. Contractor shares a private URL-fragment review link; the static host does not receive the embedded project data.
4. Client verifies the issued package, reviews it without an account, and signs an approve/decline/revision receipt in the browser.
5. Contractor imports and verifies the receipt, freezes the issued version, prints or exports the summary, and can back up local data.

## Finished v1 scope

- installable responsive PWA for current desktop and mobile browsers
- no backend, account, analytics, cookies, external scripts, fonts, or project-data collection
- browser-generated P-256 signing identities and tamper detection
- private fragment-based review and receipt links
- deterministic money/tax/schedule calculations
- client consent, typed name, and explicit three-way decision
- immutable finalized records through the normal UI
- JSON backup/export and print/PDF-ready summaries
- keyboard labels, responsive layouts, light/dark modes, CSP, privacy notice, terms, and security explanation
- free tier of three pending approvals; signed offline lifetime licenses unlock unlimited records

**Excluded:** payment processing inside project records, SMS/email sending, identity verification, legal clauses, compliance certification, accounting/CRM sync, photo storage, team permissions, and AI-generated scope.

## Differentiation

Verified competitor facts as of 2026-09-02:

- Paid field-service suites such as Jobber and Buildertrend establish willingness to pay but bundle this workflow into larger systems.
- ScopeProof is a focused iOS change-order app with a $9.99 lifetime option, photos, PDFs, remote signing, and QuickBooks integration.
- ExtraOK therefore competes on cross-platform browser/PWA access, Android/desktop/iPhone reach, local-first zero-data architecture, portable signed receipts, accessibility, and no client account—not on being the only focused change-order tool.

## Pricing hypothesis

- Free: three concurrent pending approvals.
- Pro Lifetime: **$19 one-time introductory price**, unlimited local records and future v1 updates.
- No subscription, ads, data sale, or artificial export lock-in.

This price is an estimate, not validated revenue. Paid sales cannot begin until a merchant account, verified checkout URL, merchant identity, refund terms, and required tax/KYC details are supplied and tested.

## Validation and distribution

- Publish useful, original change-order checklists and trade-specific examples linking to the free product.
- Submit only to directories or communities that explicitly allow product sharing; disclose affiliation.
- Seek opt-in demonstrations through contractor educators, bookkeepers, suppliers, and trade associations.
- Run small channel-tagged tests; count independent activations, completed approvals, qualified replies, and payments—not impressions or compliments.
- Never scrape contact lists, mass-DM, impersonate customers, manufacture testimonials, or evade community promotion rules.

## Risks and controls

- **Contract/e-sign/home-improvement law:** state-specific requirements vary; preserve exact version/consent/timestamps, avoid enforceability claims, and obtain specialist review before jurisdiction-specific marketing.
- **Identity:** cryptographic integrity does not prove real-world identity; product copy states this.
- **Privacy:** URL fragments and local storage reduce collection, but recipients still receive sensitive project details; users are warned to share privately and export backups.
- **Data loss:** local-only records can disappear when browser storage is cleared; visible backup guidance is required.
- **Trademark:** preliminary search is not clearance; complete clearance before investing materially in the brand.
- **Platform:** core operation has no mandatory external API or incumbent integration.

## Kill or reposition criteria

After a verified public free release and a compliant checkout are available, park or reposition if within 45 days:

- fewer than 20 independent target users create a real or realistic approval after 500 qualified landing-page visits;
- fewer than 5 users complete the contractor-to-client-to-receipt flow;
- no independent customer buys after 100 qualified pricing visits;
- support/legal burden makes a $19 lifetime product unsustainable;
- users consistently require photos, SMS, identity verification, or accounting integration before the core workflow has value;
- a focused incumbent is clearly preferred and the cross-platform/privacy/accessibility wedge does not change purchase intent.

## Release gates

- [x] Original production code and branding
- [x] Unit and full browser-flow tests pass
- [x] No external network origins during browser QA
- [x] Privacy, terms, security boundaries, backup/export, and signed license system
- [ ] Public deployment verified from a clean client
- [ ] Preliminary trademark review recorded
- [ ] Real checkout and merchant disclosures verified
- [ ] First compliant promotion published and read back
- [ ] First independent activation and first payment recorded
