-- Migration: Search RPC with JSONB operators

CREATE OR REPLACE FUNCTION search_catalog(
  p_tipos jsonb DEFAULT '[]'::jsonb,
  p_aplicacoes jsonb DEFAULT '[]'::jsonb,
  p_match_all boolean DEFAULT false
)
RETURNS SETOF products
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products p
  WHERE p.active = true
    AND (
      jsonb_array_length(p_tipos) = 0 
      OR (p_match_all = true AND p.tipo @> p_tipos) -- @> contains all
      OR (p_match_all = false AND p.tipo ?| ARRAY(SELECT jsonb_array_elements_text(p_tipos))) -- ?| contains any
    )
    AND (
      jsonb_array_length(p_aplicacoes) = 0 
      OR (p_match_all = true AND p.aplicacao @> p_aplicacoes)
      OR (p_match_all = false AND p.aplicacao ?| ARRAY(SELECT jsonb_array_elements_text(p_aplicacoes)))
    )
  ORDER BY p.highlight DESC, p.created_at DESC;
END;
$$;
