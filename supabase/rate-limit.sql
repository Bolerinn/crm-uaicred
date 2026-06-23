-- ============================================
-- CRM UaiCred — Rate Limiting (Supabase)
-- ============================================
-- Limita 50 operações (inserts + updates) por usuário por hora

-- 1. Tabela de rate limit
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_ts ON rate_limits(user_id, timestamp);

-- 2. Função de verificação
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

  IF recent_count > 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: máximo 50 operações por hora';
  END IF;

  INSERT INTO rate_limits (user_id, action) VALUES (auth.uid(), TG_OP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Triggers
DROP TRIGGER IF EXISTS rate_limit_insert ON clientes;
CREATE TRIGGER rate_limit_insert
  BEFORE INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();

DROP TRIGGER IF EXISTS rate_limit_update ON clientes;
CREATE TRIGGER rate_limit_update
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();

-- 4. Limpeza automática (registros antigos)
-- Roda a cada hora via pg_cron (se disponível) ou manualmente
-- DELETE FROM rate_limits WHERE timestamp < now() - interval '2 hours';
