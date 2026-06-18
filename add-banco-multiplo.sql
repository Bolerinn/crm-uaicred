-- Adicionar colunas booleanas para múltipla escolha de bancos
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco_caixa BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco_bradesco BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco_itau BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco_santander BOOLEAN DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS banco_inter BOOLEAN DEFAULT false;

-- Adicionar colunas de resultado por banco
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resultado_caixa TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resultado_bradesco TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resultado_itau TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resultado_santander TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resultado_inter TEXT DEFAULT '';
