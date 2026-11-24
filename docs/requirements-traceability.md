# NOVA requirements traceability

| Source | Implemented surface | Data / rule | Verification |
| --- | --- | --- | --- |
| Plate A | distinct customer, cleaner and admin portal entry points | `Account` unique `(email,type)`, scoped `Session` | lifecycle/unit checks; portal UI smoke |
| Plate B | landing, postcode and booking wizard | no client price trust; draft requires server completion | booking interaction smoke |
| Plate C | cleaner dashboard and approval gate | `onboarding=APPROVED` + payouts enabled is search gate | seeded approved cleaner |
| Plate D | customer account and visits | `Customer`, Booking, Occurrence | portal smoke |
| Plate E | admin dashboard / invitation boundary | admin session scope, expiring invitations, AuditLog; MFA deferred | portal smoke and audit review |
| Plate F | search, scheduling and recurring choices | Europe/Berlin persisted on occurrence; consent version/proof | booking UI and schema validation |
| Plate G | request / job action lifecycle | guarded requested → settled state graph | lifecycle tests |
| Plate H | availability and work calendar | `Availability`, transactional overlap checks and editable cleaner schedules | scheduling tests and portal smoke |
| Plate I | demo authorization, capture and refunds | idempotency key, `Payment`, `Refund`, immutable snapshot; live Stripe deferred | local adapter and dispute flow review |
| Plate J | commission and payout/reconciliation | integer cents, basis points; relationship counter | commission tests |
| Plate K | domain model | Prisma schema and initial SQL migration | `prisma validate` |
| Plate L | isolation, worker, storage | RLS migration, queued expiry/reminder/settlement worker, private local document storage and in-app notifications | migration, worker and portal smoke |
| User journey diagram | discover → booking → request → visit → completion | occurrence owns its lifecycle | customer/cleaner/admin UI flow |
| Supplied NOVA mark | shared brand | `public/brand/nova-logo.png` imported | visual inspection |

The supplied PDF was located; its plates are traced against the explicit Plate A–L requirements in the implementation prompt. The named `shared image(2).jpg` was not available; no substitute was silently treated as a specification source.

