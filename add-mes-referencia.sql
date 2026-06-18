-- Adicionar coluna mes_referencia para controle mensal do EM ANDAMENTO
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS mes_referencia TEXT DEFAULT '';

-- Preencher clientes existentes com o mês atual (para não ficar vazio)
UPDATE clientes SET mes_referencia = TO_CHAR(CURRENT_DATE, 'YYYY-MM') WHERE mes_referencia IS NULL OR mes_referencia = '';
