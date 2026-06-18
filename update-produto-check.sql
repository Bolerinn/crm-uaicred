ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_produto_check;
ALTER TABLE clientes ADD CONSTRAINT clientes_produto_check CHECK (produto IN (
  'SBPE', 'FGTS', 'FGTS a vista', 'HomeEquity', 'Terreno', 'Comercial', 'Construção'
));
