-- ============================================
-- CORREÇÃO: Aumentar Rate Limit para 200 ops/h
-- Executar no SQL Editor do Supabase
-- Projeto: dztiktcvueorlafiocdf
-- ============================================

-- 1. Remover triggers antigos
DROP TRIGGER IF EXISTS rate_limit_insert ON clientes;
DROP TRIGGER IF EXISTS rate_limit_update ON clientes;

-- 2. Recriar função com limite maior (200/h em vez de 50/h)
CREATE OR REPLACE FUNCTION check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM rate_limits
  WHERE user_id = auth.uid()
    AND action = TG_OP
    AND timestamp > now() - interval '1 hour';

  IF recent_count > 200 THEN
    RAISE EXCEPTION 'Rate limit exceeded: máximo 200 operações por hora';
  END IF;

  INSERT INTO rate_limits (user_id, action) VALUES (auth.uid(), TG_OP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recriar triggers
CREATE TRIGGER rate_limit_insert
  BEFORE INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();

CREATE TRIGGER rate_limit_update
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();

-- 4. Limpar registros antigos para liberar agora
DELETE FROM rate_limits WHERE timestamp < now() - interval '1 hour';
