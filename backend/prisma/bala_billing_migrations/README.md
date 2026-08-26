# bala_billing Database Migrations

These are the consolidated SQL migration files for the `bala_billing` database, 
shared between `sub-billing-whitelable` and `billing-whitelable` systems.

**Database**: `bala_billing` (PostgreSQL)

## Migration Files

| File | Description |
|------|-------------|
| `01_create_tables.sql` | Core tables: customers, wallets, plans, subscriptions, addons, assets (TFN/DID/Extension/Monitoring), invoices, payments, CDR, rate cards |
| `02_create_payment_tables.sql` | Stripe payment integration: payments, transactions, webhooks, refunds, payment methods |
| `03_create_rate_and_recording_card_tables.sql` | Recording rate cards + customer mapping + seed data |
| `04_add_per_sec_rates.sql` | Per-second rate columns for rate_cards (billing-whitelable specific) |

## How to Run

These migrations are run by the sub-billing-whitelable system using `node migrations/run.js`.
The billing-whitelable scripts can be run manually against the database.

## Source of Truth

- Files 01-03 originate from `sub-billing-whitelable/migrations/`
- File 04 originates from `billing-whitelable/scripts/`
