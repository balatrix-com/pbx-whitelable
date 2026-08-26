-- 1. ENUM types
CREATE TYPE customer_type_enum AS ENUM ('individual', 'company');
CREATE TYPE currency_enum AS ENUM ('usd', 'cad');
CREATE TYPE addon_charge_type AS ENUM ('one_time', 'recurring', 'recurring_with_setup');
CREATE TYPE subscription_status_enum AS ENUM ('active', 'cancelled', 'suspended');
CREATE TYPE wallet_tx_type AS ENUM ('payment', 'subscription', 'addon', 'refund', 'adjustment');
CREATE TYPE free_mins_source_type AS ENUM ('plan', 'addon');
CREATE TYPE free_mins_tx_type AS ENUM ('grant', 'consume', 'expiry_purge', 'adjustment');

-- 2. Customers
CREATE TABLE customers (
    customer_id TEXT PRIMARY KEY,
    fr_cusid TEXT UNIQUE NOT NULL,
    customer_type customer_type_enum NOT NULL,
    company_name TEXT,
    company_tax_id TEXT,
    first_name TEXT,
    last_name TEXT,
    admin_email TEXT NOT NULL,
    phone TEXT,
    address_st TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    currency currency_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 2.5 Customer Wallets
CREATE TABLE customer_wallets (
    customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
    currency CHAR(3) NOT NULL,
    fiat_balance NUMERIC(14,6) NOT NULL DEFAULT 0,
    free_seconds INTEGER NOT NULL DEFAULT 0,
    credit_limit NUMERIC(14,6) NOT NULL DEFAULT 0,
    credit_used NUMERIC(14,6) NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER NOT NULL DEFAULT 1
);
-- 3. Plans
CREATE TABLE plans (
    plan_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency currency_enum NOT NULL,
    validity_months INT NOT NULL,
    tfns INT NOT NULL DEFAULT 0,
    dids INT NOT NULL DEFAULT 0,
    free_mins INT NOT NULL DEFAULT 0,
    extensions INT NOT NULL DEFAULT 0,
    monitoring_per_user INT NOT NULL DEFAULT 0,
    system_plan_id VARCHAR(255),
    setup_fees DECIMAL(10,2) DEFAULT 0,
    rate_card_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Addons
CREATE TABLE addons (
    addon_id TEXT PRIMARY KEY,
    addon_type TEXT NOT NULL, -- tfn, did, ext, mon, other
    name TEXT NOT NULL,
    description TEXT,
    charge_type addon_charge_type NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    currency currency_enum NOT NULL,
    interval_unit TEXT,
    interval_count INT DEFAULT 1,
    validity_months INT,
    setup_fee NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(plan_id),
    status subscription_status_enum NOT NULL DEFAULT 'active',
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_billing TIMESTAMPTZ,
    rate_card_id TEXT,
    base_plan_price NUMERIC(14,6) NOT NULL DEFAULT 0,
    recurring_addons_price NUMERIC(14,6) NOT NULL DEFAULT 0,
    total_recurring_price NUMERIC(14,6) NOT NULL DEFAULT 0,
    target_plan_id TEXT REFERENCES plans(plan_id),
    scheduled_switch_at TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.2 Subscription Addons Catalog
CREATE TABLE subscription_addons_catalog (
    addon_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('extension', 'tfn', 'did', 'supervisor', 'storage')),
    units_count INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(14, 6) NOT NULL CHECK (unit_price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.3 Subscription Addons
CREATE TABLE subscription_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    addon_id TEXT NOT NULL REFERENCES subscription_addons_catalog(addon_id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'active',
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_billing TIMESTAMPTZ,
    cancelled_date TIMESTAMPTZ,
    total_setup_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_recurring_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(14,6) DEFAULT 0,
    prorated_charge_paid NUMERIC(14,6) DEFAULT 0,
    resource_type VARCHAR(32) DEFAULT 'extension',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_addons_subscription ON subscription_addons(subscription_id);
CREATE INDEX idx_subscription_addons_addon ON subscription_addons(addon_id);
CREATE INDEX idx_subscription_addons_status ON subscription_addons(status);

-- 5.3 TFN Assets
CREATE TABLE tfn_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT,
    subscription_addon_id UUID REFERENCES subscription_addons(id) ON DELETE SET NULL,
    tfn_number TEXT NOT NULL UNIQUE,
    tfn_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_date TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tfn_customer ON tfn_assets(customer_id);
CREATE INDEX idx_tfn_subscription ON tfn_assets(subscription_id);
CREATE INDEX idx_tfn_source ON tfn_assets(source_type, source_id);
CREATE INDEX idx_tfn_status ON tfn_assets(status);

-- 5.4 DID Assets
CREATE TABLE did_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT,
    subscription_addon_id UUID REFERENCES subscription_addons(id) ON DELETE SET NULL,
    did_number TEXT NOT NULL UNIQUE,
    did_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_date TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_did_customer ON did_assets(customer_id);
CREATE INDEX idx_did_subscription ON did_assets(subscription_id);
CREATE INDEX idx_did_source ON did_assets(source_type, source_id);
CREATE INDEX idx_did_status ON did_assets(status);

-- 5.5 Extension Assets
CREATE TABLE extension_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT,
    subscription_addon_id UUID REFERENCES subscription_addons(id) ON DELETE SET NULL,
    extension_number TEXT NOT NULL,
    extension_name TEXT,
    extension_type TEXT DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'active',
    assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_date TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(customer_id, subscription_id, extension_number)
);

CREATE INDEX idx_ext_customer ON extension_assets(customer_id);
CREATE INDEX idx_ext_subscription ON extension_assets(subscription_id);
CREATE INDEX idx_ext_source ON extension_assets(source_type, source_id);
CREATE INDEX idx_ext_status ON extension_assets(status);

-- 5.6 Monitoring Assets
CREATE TABLE monitoring_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id TEXT,
    subscription_addon_id UUID REFERENCES subscription_addons(id) ON DELETE SET NULL,
    user_id TEXT NOT NULL UNIQUE,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    user_phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    assigned_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_date TIMESTAMPTZ,
    can_monitor_all BOOLEAN DEFAULT false,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitoring_customer ON monitoring_assets(customer_id);
CREATE INDEX idx_monitoring_subscription ON monitoring_assets(subscription_id);
CREATE INDEX idx_monitoring_source ON monitoring_assets(source_type, source_id);
CREATE INDEX idx_monitoring_status ON monitoring_assets(status);
CREATE INDEX idx_monitoring_email ON monitoring_assets(user_email);

-- 5.7 Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    currency currency_enum NOT NULL,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount <> 0),
    currency currency_enum NOT NULL,
    gateway TEXT NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Wallet Transactions
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount <> 0),
    currency currency_enum NOT NULL,
    before_balance NUMERIC(10,2) NOT NULL,
    after_balance NUMERIC(10,2) NOT NULL,
    transaction_type wallet_tx_type NOT NULL DEFAULT 'payment',
    reference TEXT,
    gateway TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Free Mins Grants
CREATE TABLE free_mins_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    source_type free_mins_source_type NOT NULL,
    source_id TEXT NOT NULL,
    granted_secs INT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);



-- 10. Free Mins Transactions
CREATE TABLE free_mins_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    free_mins_grant_id UUID REFERENCES free_mins_grants(id) ON DELETE CASCADE,
    amount_secs INT NOT NULL,
    transaction_type free_mins_tx_type NOT NULL,
    reference TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Rate Cards
CREATE TABLE rate_cards (
    ratecard_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    country TEXT,
    in_rate_per_min NUMERIC(14,6) NOT NULL DEFAULT 0,
    in_initial_increment_sec INTEGER NOT NULL DEFAULT 60,
    in_increment_sec INTEGER NOT NULL DEFAULT 60,
    ob_rate_per_min NUMERIC(14,6) NOT NULL DEFAULT 0,
    ob_initial_increment_sec INTEGER NOT NULL DEFAULT 60,
    ob_increment_sec INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Customer Rate Card
-- Links a customer to a rate card. On customer creation, ratecard_id = 2 is assigned automatically.
CREATE TABLE customer_ratecard (
    customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
    ratecard_id INTEGER NOT NULL REFERENCES rate_cards(ratecard_id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at in rate_cards
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rate_cards_updated_at
    BEFORE UPDATE ON rate_cards
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 13. Call Detail Records (CDR)
CREATE TABLE cdr (
    cdr_id BIGSERIAL PRIMARY KEY,
    call_uuid UUID NOT NULL,
    customer_id TEXT NOT NULL,
    caller TEXT NOT NULL,
    callee TEXT NOT NULL,
    last_destination TEXT,
    direction TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    answer_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ NOT NULL,
    duration_sec INTEGER NOT NULL,
    billsec INTEGER NOT NULL,
    dest_type VARCHAR(50),
    dest_value VARCHAR(100),
    status_code VARCHAR(50),
    call_status VARCHAR(50),
    ingress_trunk TEXT,
    egress_trunk TEXT,
    route_id TEXT,
    gateway_id TEXT,
    currency CHAR(3) NOT NULL,
    ratecard_id BIGINT,
    billed_amount NUMERIC(12,6) NOT NULL DEFAULT 0,
    transaction_id BIGINT,
    is_rated BOOLEAN NOT NULL DEFAULT false,
    rated_at TIMESTAMPTZ,
    recording BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cdr_customer_id ON cdr(customer_id);
CREATE INDEX idx_cdr_start_time ON cdr(start_time);
CREATE INDEX idx_cdr_call_uuid ON cdr(call_uuid);

-- Subscription performance indexes
CREATE INDEX idx_subs_cust_status ON subscriptions(customer_id, status);
CREATE INDEX idx_sub_addons_status ON subscription_addons(subscription_id, status);
