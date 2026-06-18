-- ============================================
-- UaiCred — Novas colunas para Análises
-- ============================================
-- Execute no SQL Editor do Supabase:
-- https://dztiktcvueorlafiocdf.supabase.co/project/default/sql/new

-- 1. Adicionar colunas novas
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS fgts BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS valor_fgts TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS iq BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_iq TEXT DEFAULT '';

-- 2. Atualizar o CHECK de status (adicionar Checklist I e Análise Jurídica)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_status_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_status_check CHECK (status IN (
  'aguardando-doc', 'aguardando-vis', 'aguardando-laudo',
  'conformidade', 'em-registro', 'checklist-i', 'analise-juridica'
));
