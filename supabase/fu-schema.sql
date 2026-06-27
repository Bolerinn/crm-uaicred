-- Task 0: Adicionar colunas da aba FU
-- Executar no SQL Editor do Supabase Dashboard
-- Projeto: dztiktcvueorlafiocdf

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS analista TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_fu TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ultima_acao TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proximo_fu TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proxima_acao TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS convertido_fu BOOLEAN DEFAULT FALSE;
