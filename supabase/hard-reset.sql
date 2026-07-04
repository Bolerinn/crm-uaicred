-- HARD RESET: Exclui PERMANENTEMENTE todos os registros da tabela clientes
-- SECURITY DEFINER = ignora RLS, roda com permissão de quem criou a função (superuser)
-- WHERE id > 0 é necessário pq o Postgres bloqueia DELETE sem WHERE (sql_safe_updates)
CREATE OR REPLACE FUNCTION hard_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM clientes WHERE id > 0;
END;
$$;
