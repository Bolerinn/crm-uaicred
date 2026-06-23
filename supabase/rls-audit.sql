-- ============================================
-- CRM UaiCred — RLS Audit + Fix
-- ============================================

-- ==================== RESULTADO DA AUDITORIA ====================
-- Apenas 2 tabelas no schema public: clientes e rate_limits
-- Ambas com RLS ativado. Políticas revisadas abaixo.
-- =================================================================

-- 1. Verificar status RLS de todas as tabelas
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- 2. Verificar TODAS as políticas existentes
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==================== CORREÇÕES ====================

-- 3. Adicionar política SELECT no rate_limits (atualmente não existe nenhuma explicitamente,
--    então o comportamento padrão é deny all - OK, mas melhor ser explícito)
CREATE POLICY IF NOT EXISTS "Usuários veem apenas seus próprios rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Garantir que o trigger function está como SECURITY DEFINER
--    (já está, mas vamos verificar)
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'check_rate_limit';
