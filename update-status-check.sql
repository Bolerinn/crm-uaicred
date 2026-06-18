-- Atualizar CHECK de status (adicionar Checklist II e Contrato Emitido)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_status_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_status_check CHECK (status IN (
  'aguardando-doc', 'aguardando-vis', 'aguardando-laudo',
  'conformidade', 'checklist-i', 'checklist-ii',
  'analise-juridica', 'contrato-emitido', 'em-registro'
));
