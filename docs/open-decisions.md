# Open launch decisions

- **Asset source:** `shared image(2).jpg` is missing. Confirm its intended filename or reattach it.
- **Stripe policy:** local preview uses a simulator; select PaymentIntent timing, Connect charge type, capture deadline, SCA recovery and complaint-window policy before live mode.
- **VAT and invoices:** issuer, tax treatment and commission base (gross vs. net VAT) require legal/accounting approval; live invoice issuance remains gated.
- **Connect gate:** development uses payouts-enabled as the public visibility gate. Decide whether Connect must be complete before approval or only before first payout.
- **Recurring accounting:** confirm treatment of refunded/disputed occurrences and reset after a long pause.
- **RLS operations:** production needs the dedicated migration and runtime roles plus audited `SECURITY DEFINER` admin functions; never run the application with the owner/migration role.
- **Identity provider:** data model supports one customer and one cleaner identity for the same email. Select a provider that preserves portal-bound sessions and supports required admin MFA.
- **Demo authentication:** local email/password sessions and expiring administrator invitation links support testing. Add authenticator-backed MFA, rate limiting, verified-email delivery and a production identity provider before launch.
- **Timezone/DST:** persist Berlin local wall time and reject/ask for ambiguous or invalid DST slots when the recurrence generator is connected.

