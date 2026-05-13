-- ==============================================================================
-- MIGRATION: Fix parent_id integrity (TEXT)
-- Objetivo: Corrigir o erro de FK "products_parent_id_fkey", limpando dados 
-- incorretos, garantindo compatibilidade com id TEXT e ON DELETE SET NULL.
-- ==============================================================================

-- 1. Garantir que parent_id é do tipo TEXT (revertendo caso alguém tenha tentado UUID)
ALTER TABLE public.products
ALTER COLUMN parent_id TYPE TEXT USING parent_id::TEXT;

-- 2. Limpar `parent_id` se for string vazia ou nulo "falso"
UPDATE public.products
SET parent_id = NULL
WHERE parent_id = '' OR parent_id = 'null' OR parent_id = 'undefined';

-- 3. Limpar loops/auto-referência (produto não pode ser pai dele mesmo)
UPDATE public.products
SET parent_id = NULL
WHERE parent_id = id;

-- 4. Limpar referências órfãs (onde o parent_id não existe mais na tabela products.id)
UPDATE public.products p1
SET parent_id = NULL
WHERE parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.products p2 WHERE p2.id = p1.parent_id
  );

-- 5. Se o `id` não for UNIQUE, precisamos garantir que seja antes de criar a FK
-- (PostgreSQL exige que o campo referenciado em FK seja UNIQUE ou PRIMARY KEY)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.products'::regclass 
        AND contype = 'u' 
        AND conname = 'products_id_key'
    ) THEN
        -- Adicionamos a constraint UNIQUE caso não exista
        ALTER TABLE public.products ADD CONSTRAINT products_id_key UNIQUE (id);
    END IF;
END $$;

-- 6. Recriar a Foreign Key com ON DELETE SET NULL
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_parent_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_parent_id_fkey
FOREIGN KEY (parent_id)
REFERENCES public.products(id)
ON DELETE SET NULL;
