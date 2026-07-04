-- HARD RESET: Exclui PERMANENTEMENTE todos os registros da tabela clientes
-- SECURITY DEFINER = ignora RLS, roda com permissão de quem criou a função (superuser)
CREATE OR REPLACE FUNCTION hard_reset()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM clientes;
END;
$$;
