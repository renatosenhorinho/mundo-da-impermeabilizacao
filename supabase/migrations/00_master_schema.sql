-- =======================================================================================
-- MASTER CONSOLIDATED MIGRATION
-- Tables: products, analytics_events
-- =======================================================================================

-- ---------------------------------------------------------------------------------------
-- 1. Table: products
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid(),
    slug VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    image TEXT,
    images TEXT[],
    description TEXT,
    highlight BOOLEAN DEFAULT false NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    available BOOLEAN DEFAULT true NOT NULL,
    aplicacao TEXT[],
    como_usar TEXT[],
    parent_id VARCHAR(255),
    variations JSONB,
    specs JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
-- Index for fast brand lookups
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);

-- ---------------------------------------------------------------------------------------
-- 2. Table: analytics_events
-- ---------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    page_url TEXT NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    device VARCHAR(20) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for session journey lookups
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON public.analytics_events(session_id);
-- Index for event type aggregations
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON public.analytics_events(event_type);

-- =======================================================================================
-- END OF MIGRATION
-- =======================================================================================
