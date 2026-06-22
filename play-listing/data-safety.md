# Play Console — Data safety form answers (AlbaBiz.ie)

Google Play's **Data safety** section. Answers reflect what the app actually
does. The app is a thin shell around the AlbaBiz.ie website; the only personal
data flow is the **voluntary business-registration form**, which a user fills in
only if they choose to list their business.

> Review these against your final build before submitting — if you add analytics
> or push (v2), update this form.

## Does your app collect or share any of the required user data types?

**Yes** — but only data the user voluntarily enters in the registration form,
plus minimal technical data for security.

### Data types collected

| Category | Data type | Collected | Shared | Optional? | Purpose |
|---|---|---|---|---|---|
| Personal info | Name | Yes | No | Required to register* | App functionality (listing) |
| Personal info | Email address | Yes | No | Required to register* | App functionality, account/support |
| Personal info | Phone number | Yes | No | Optional | App functionality (published only if user opts in) |
| Personal info | Address (physical) | Yes | No | Optional | App functionality (business location) |
| App activity | (none) | No | No | — | — |
| Device/other IDs | (none) | No | No | — | — |

\* "Required to register" = only required **if** the user chooses to submit a
business. Browsing the directory requires **no** data at all.

### Security / anti-abuse technical data

- **IP address + country** are recorded at submission time for **spam/fraud
  prevention** only (stored with the submission, not shared, not used for
  tracking or ads). Declare under **App info / Other** → *Fraud prevention,
  security, and compliance* if your console version asks.

## Key answers

- **Is all collected data encrypted in transit?** → **Yes** (HTTPS/TLS to
  Cloudflare; the app blocks cleartext, `usesCleartextTraffic="false"`).
- **Do you provide a way for users to request that their data is deleted?** →
  **Yes** — in-app **Removal request** (`/hiq`) and the privacy notice email.
- **Data collection is optional / user-initiated?** → **Yes** — registration is
  opt-in; browsing collects nothing.
- **Is data shared with third parties?** → **No.**
- **Is data used for tracking across apps/websites?** → **No.**
- **Ads / advertising ID?** → **No** (v1 has no ads, no FCM, no third-party analytics SDKs).

## Anonymous usage analytics (first-party)

The app/site collects **anonymous, cookieless** usage statistics in our own
Cloudflare D1 (no Google Analytics, no third-party SDK): page views, searches,
filters, business-profile views, contact-button clicks, coarse device class,
browser, and country (from Cloudflare). This is **first-party** and **not**
cross-app/cross-site tracking, so the Data safety answers above stay accurate:

- No persistent identifier, no cookie. Visitor counting uses a **rotating daily
  hash** (salt-of-day + IP + UA) that is not stored as raw IP and cannot be
  linked across days or to a person.
- For the Play **Data safety** form, you may either (a) declare nothing extra
  (the data is anonymous and not linked to a user/device identifier), or (b) to
  be maximally transparent, declare **App activity → Other actions** and **App
  info and performance → Diagnostics** as *collected, not shared, not linked to
  identity, for analytics*. Recommended: (b) for transparency.
- Raw analytics rows are purged after 12 months.

## GDPR alignment (EU)

- Lawful basis: **explicit consent** (GDPR Art. 6(1)(a)), captured with a
  mandatory consent checkbox + stored timestamp on every submission.
- Data minimization: owner/contact name is never published; contact details are
  published only if the user enables "show contact publicly".
- Right to erasure: self-service removal + admin processing.
- Privacy notice: bilingual, at `/privatesia.html`.
