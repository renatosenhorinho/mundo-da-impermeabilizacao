-- Migration: Normalização de Taxonomia (Tipo e Aplicação)
-- Criação da tabela de controle do CRM e adição da coluna tipo nos produtos

-- 1. Adicionar coluna 'tipo' na tabela products (aplicacao já existe)
ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo jsonb DEFAULT '[]'::jsonb;

-- 2. Criar a tabela de taxonomia para o CRM gerenciar as opções
CREATE TABLE IF NOT EXISTS catalog_taxonomy (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name varchar(50) NOT NULL, -- 'TIPO' ou 'APLICACAO'
  slug varchar(255) NOT NULL,
  label varchar(255) NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(group_name, slug)
);

-- Habilitar RLS (opcional dependendo da configuração do projeto, mas recomendado)
ALTER TABLE catalog_taxonomy ENABLE ROW LEVEL SECURITY;

-- Políticas para acesso anônimo de leitura e admin para edição
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'catalog_taxonomy' AND policyname = 'Permitir leitura pública da taxonomia'
    ) THEN
        CREATE POLICY "Permitir leitura pública da taxonomia" ON catalog_taxonomy
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT FROM pg_policies WHERE tablename = 'catalog_taxonomy' AND policyname = 'Permitir edição total'
    ) THEN
        CREATE POLICY "Permitir edição total" ON catalog_taxonomy
            FOR ALL USING (true); -- Ajuste para sua auth rule se houver
    END IF;
END $$;

-- 3. Inserir valores padrão (se a tabela estiver vazia)
INSERT INTO catalog_taxonomy (group_name, slug, label)
VALUES 
  -- TIPOS PADRÃO
  ('TIPO', 'manta-asfaltica', 'Manta Asfáltica'),
  ('TIPO', 'manta-liquida', 'Manta Líquida'),
  ('TIPO', 'selante', 'Selante'),
  ('TIPO', 'fita-aluminizada', 'Fita Aluminizada'),
  ('TIPO', 'impermeabilizante-cimenticio', 'Impermeabilizante Cimentício'),
  ('TIPO', 'primer', 'Primer'),
  ('TIPO', 'adesivo', 'Adesivo'),
  ('TIPO', 'geotextil', 'Geotêxtil'),
  ('TIPO', 'aditivo', 'Aditivo'),
  ('TIPO', 'silicone', 'Silicone'),
  ('TIPO', 'membrana-acrilica', 'Membrana Acrílica'),

  -- APLICAÇÕES PADRÃO
  ('APLICACAO', 'lajes', 'Lajes'),
  ('APLICACAO', 'telhados', 'Telhados'),
  ('APLICACAO', 'calhas', 'Calhas'),
  ('APLICACAO', 'banheiros', 'Banheiros'),
  ('APLICACAO', 'piscinas', 'Piscinas'),
  ('APLICACAO', 'reservatorios', 'Reservatórios'),
  ('APLICACAO', 'areas-frias', 'Áreas Frias'),
  ('APLICACAO', 'paredes', 'Paredes'),
  ('APLICACAO', 'muros', 'Muros'),
  ('APLICACAO', 'fundacao', 'Fundação'),
  ('APLICACAO', 'rodapes', 'Rodapés'),
  ('APLICACAO', 'juntas', 'Juntas'),
  ('APLICACAO', 'trincas', 'Trincas'),
  ('APLICACAO', 'fachadas', 'Fachadas')
ON CONFLICT (group_name, slug) DO NOTHING;

-- 4. Criar índices para melhorar a performance das buscas do site
CREATE INDEX IF NOT EXISTS idx_products_aplicacao ON products USING gin (aplicacao);
CREATE INDEX IF NOT EXISTS idx_products_tipo ON products USING gin (tipo);
