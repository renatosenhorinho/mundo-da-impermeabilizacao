-- Migration para criar o bucket "products" e suas políticas públicas (RLS)
-- Execute este script no SQL Editor do Supabase

-- 1. Cria o bucket de Storage "products" se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permite que todos os usuários leiam as imagens (Visualizar no Catálogo)
CREATE POLICY "Imagens dos produtos são públicas" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'products' );

-- 3. Permite que usuários autenticados (ou anônimos dependendo da sua regra) façam upload
-- Como você está usando a Anon Key com autenticação ou Master Key no fallback,
-- se você usa Supabase Auth (admin), você pode restringir apenas para auth.role() = 'authenticated'
-- Mas para evitar problemas iniciais com o fallback offline, permitiremos upload público com a key
CREATE POLICY "Permite upload de imagens de produtos" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'products' );

-- 4. Permite atualizar/deletar imagens
CREATE POLICY "Permite atualizar imagens de produtos" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'products' );

CREATE POLICY "Permite deletar imagens de produtos" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'products' );
