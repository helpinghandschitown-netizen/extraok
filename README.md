# ExtraOK

Cross-platform, local-first change-order approvals for small contractors. The hosted app uses URL fragments for remote review packages, so project details are not sent to the static host. Issued reviews and decision receipts are signed with browser-generated P-256 keys and verified before display/import.

## Run locally

```bash
npm test
npm run serve
```

Open `http://127.0.0.1:4177`.

## Production model

- Static PWA; no backend, analytics, cookies, external fonts, ads, or third-party scripts.
- Free: up to three pending approvals.
- Pro Lifetime: $19 one-time Stripe checkout; a signed offline license key unlocks unlimited records.
- License signing private key lives outside the repository under the Hermes secrets directory.
- Customer data stays in browser storage and URL fragments. Users must export backups; clearing browser data deletes local records.

## Safety boundary

ExtraOK creates operational records. It does not provide legal advice, verify identity, guarantee enforceability, or replace jurisdiction-specific contract disclosures. Do not market signatures as “court-proof,” “dispute-proof,” or legally dispositive.

## Deployment

GitHub Pages deploys the static root through `.github/workflows/pages.yml`. The verified checkout is `https://buy.stripe.com/5kQ3cvfgHexp4qR4kPdby00`; license fulfillment uses the offline issuer script after Stripe payment verification.
