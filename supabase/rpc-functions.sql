-- ============================================
-- Funções RPC para substituir a Service Role Key
-- ============================================

-- 1. get_clientes: listar clientes não deletados (qualquer autenticado)
CREATE OR REPLACE FUNCTION get_clientes()
RETURNS SETOF clientes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM clientes
  WHERE deleted_at IS NULL
  ORDER BY id;
$$;

-- 2. soft_delete_cliente(id BIGINT, analista TEXT): marcar como deletado
CREATE OR REPLACE FUNCTION soft_delete_cliente(p_id BIGINT, p_analista TEXT DEFAULT '—')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clientes
  SET deleted_at = now(), deleted_by = p_analista
  WHERE id = p_id;
END;
$$;

-- 3. restore_cliente(id BIGINT): restaurar da lixeira
CREATE OR REPLACE FUNCTION restore_cliente(p_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE clientes SET deleted_at = NULL WHERE id = p_id;
END;
$$;

-- 4. get_lixeira(): listar deletados dos últimos 30 dias
CREATE OR REPLACE FUNCTION get_lixeira()
RETURNS SETOF clientes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM clientes
  WHERE deleted_at IS NOT NULL
    AND deleted_at >= now() - interval '30 days'
  ORDER BY deleted_at DESC;
$$;

-- 5. excluir_permanentemente_cliente(id BIGINT): DELETE real
CREATE OR REPLACE FUNCTION excluir_permanentemente_cliente(p_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM clientes WHERE id = p_id;
END;
$$;
