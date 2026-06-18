-- Adicionar colunas para o novo RESULTADO e FOLLOW-UP na aba ANÁLISES
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS resultado TEXT DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS follow_up BOOLEAN DEFAULT false;
