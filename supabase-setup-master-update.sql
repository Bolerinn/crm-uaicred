-- =====================================================
-- SUPABASE SETUP: POLÍTICA ADICIONAL PARA MASTER
-- Permite que o master ALTERE perfis de outros usuários
-- CRM UaiCred
-- =====================================================
-- Execute este script no SQL Editor do Supabase
-- APÓS executar o supabase-setup-profiles.sql
-- =====================================================

-- 1. Permitir que MASTER atualize QUALQUER perfil
DROP POLICY IF EXISTS "Master can update any profile" ON public.profiles;
CREATE POLICY "Master can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    COALESCE(
      (SELECT tipo FROM public.profiles WHERE id = auth.uid()),
      'user'
    ) = 'master'
  )
  WITH CHECK (
    COALESCE(
      (SELECT tipo FROM public.profiles WHERE id = auth.uid()),
      'user'
    ) = 'master'
  );

-- Nota: Esta política é ADDITIVA à política "Users can update own profile".
-- No Supabase, múltiplas políticas FOR UPDATE são combinadas com OR.
-- Portanto:
--   - Um user normal pode atualizar APENAS o próprio perfil (via "Users can update own profile")
--   - Um master pode atualizar QUALQUER perfil (via esta nova política)
