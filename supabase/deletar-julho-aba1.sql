-- Deletar processos da aba 1 (Análises) do mês de Julho 2026
-- Executar no SQL Editor do Supabase
-- Projeto: dztiktcvueorlafiocdf

UPDATE clientes 
SET deleted_at = now() 
WHERE mes_referencia = '2026-07' 
  AND follow_up = false 
  AND convertido = false 
  AND deleted_at IS NULL;
