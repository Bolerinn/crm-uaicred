-- Corrigir CHECK de status (adicionar emitido, remover contrato-emitido duplicado)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_status_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_status_check CHECK (status IN (
  'aguardando-doc', 'aguardando-vis', 'aguardando-laudo',
  'conformidade', 'checklist-i', 'checklist-ii',
  'analise-juridica', 'emitido', 'em-registro'
));
