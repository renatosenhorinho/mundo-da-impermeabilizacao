-- Migration to expand products schema without dropping existing data
-- Adds missing columns to support full product catalog features

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS variations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update existing rows to have a slug (fallback to id if id is text, or generated)
-- Assuming id is a text field containing the slug, we can backfill:
UPDATE products SET slug = id WHERE slug IS NULL;
