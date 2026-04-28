# Josbin POS — Week 1 Progress Report
**Phase 1: Discovery & Architecture**
Period: Week 1 of 18

---

## Summary

Week 1 focused on laying the complete technical foundation for Josbin POS.
All architecture decisions were finalised, the database schema was designed and
implemented, and both the backend and frontend projects were scaffolded with full
development tooling in place. No user-visible features yet — this week is entirely
about getting the foundation right before a single line of business logic is written.

---

## Completed This Week

### Infrastructure & DevOps
- Docker Compose environment set up (Laravel + PostgreSQL 16 + Redis 7 + Nginx)
- Laravel Sail configured for local development
- GitHub Actions CI/CD pipeline active — tests run on every commit, merge blocked on failure
- Environment configuration for local, staging, and production

### Backend — Laravel 13 (PHP 8.3)
- Fresh Laravel 13 project scaffolded
- Laravel Sanctum installed and configured (API token authentication)
- Laravel Reverb installed (native WebSocket server — no Pusher needed)
- Laravel Horizon installed (queue monitoring)
- Laravel Telescope installed (debug tooling, dev-only)
- spatie/laravel-permission installed (RBAC — 6 roles defined)
- owen-it/laravel-auditing installed (immutable audit log)
- DomPDF + Laravel Excel installed (PDF and CSV report export)

### Database Schema — Complete
All 14 core tables created and migrated:

| Table | Purpose |
|---|---|
| `organisations` | Client companies (retail, govt, wholesale) |
| `stores` | Physical locations under each organisation |
| `users` | All staff with role-based access |
| `categories` | Product categories with Dutch/English names |
| `products` | Full catalogue with BTW rates, stock, pgvector embeddings |
| `customers` | Customer profiles (WBP-S encrypted fields) |
| `sales` | Every transaction with exchange rate snapshot |
| `sale_items` | Line items with full BTW audit trail |
| `held_bills` | Saved mid-sale carts (React Activity API) |
| `z_reports` | End of day register closes |
| `daily_rates` | Locked USD→SRD exchange rate per day |
| `api_integrations` | Third-party POS API keys and webhook config |
| `store_product_overrides` | Per-store price overrides |
| `licenses` | License keys, hardware binding, renewal status |

- PostgreSQL extensions enabled: `pgcrypto` (UUID), `pg_trgm` (fuzzy search), `pgvector` (AI embeddings)
- All monetary columns: `DECIMAL(12,2)` — no floating point anywhere
- All timestamps: `timestamptz` in AST (America/Paramaribo, UTC-3)
- Customer personal data fields (name, phone, email, ID number): AES-256 field-level encryption

### Frontend — React 19.2 + TypeScript
- Vite 6 project scaffolded for both POS (Electron target) and Dashboard (web)
- TanStack Query v5 configured
- Zustand configured for cart state
- i18next configured — Dutch (`nl`) and English (`en`) translation files started
- React Router configured (dashboard)
- Tailwind CSS configured (dashboard)
- CSS variables design system set up (POS — matches Electron native feel)

### Security Architecture
- bcrypt cost factor 12 set in Auth configuration
- Rate limiting configured: 5 failed login attempts → 15 min lockout
- Session timeout: 15 min POS, 60 min dashboard (configurable)
- CORS configured for API
- Content Security Policy headers configured

---

## Decisions Made & Documented

| Decision | Choice | Reason |
|---|---|---|
| Currency | SRD only, DECIMAL(12,2) | Suriname-specific, no float rounding errors |
| Exchange rate provider | ExchangeRate-API | Only free provider supporting SRD |
| WebSocket | Laravel Reverb | Native L13, no Pusher cost |
| Auth | Sanctum tokens (POS) + Passkeys (Admin) | POS = headless terminals; admin = high security |
| AI | OpenAI GPT-4o via Http facade | No extra SDK package, L13 Http is sufficient |
| Multi-tenancy | Row-level isolation (`organisation_id` on every table) | Simpler than stancl/tenancy for current scale |

---

## Next Week Preview

Week 2 begins Phase 2 — POS System Build.
Authentication, user management, and core POS product display will be the focus.
