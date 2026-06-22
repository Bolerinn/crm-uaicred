-- ============================================
-- CRM UaiCred — Schema Supabase
-- ============================================

-- 1. Tabela de clientes (11 campos)
CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  indicacao TEXT DEFAULT '',
  cliente TEXT NOT NULL DEFAULT '',
  cpf TEXT DEFAULT '',
  agencia TEXT DEFAULT '',
  valor_imovel TEXT DEFAULT '',
  valor_financiado TEXT DEFAULT '',
  produto TEXT DEFAULT 'SBPE' CHECK (produto IN ('SBPE', 'FGTS')),
  data_vistoria TEXT DEFAULT '—',
  status TEXT DEFAULT 'aguardando-doc' CHECK (status IN (
    'aguardando-doc', 'aguardando-vis', 'aguardando-laudo',
    'conformidade', 'em-registro'
  )),
  obs TEXT DEFAULT '',
  analista TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Índices
CREATE INDEX idx_clientes_status ON clientes(status);
CREATE INDEX idx_clientes_produto ON clientes(produto);
CREATE INDEX idx_clientes_created_by ON clientes(created_by);

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_updated_at();

-- 4. Row Level Security (cada um vê tudo, mas só altera o que criou)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Todos podem LER todos os clientes (planilha compartilhada)
CREATE POLICY "Todos podem ver todos os clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (true);

-- Cada um pode INSERIR novos clientes
CREATE POLICY "Usuários autenticados podem inserir"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Cada um pode ATUALIZAR qualquer cliente (planilha colaborativa)
CREATE POLICY "Usuários autenticados podem atualizar qualquer cliente"
  ON clientes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Cada um pode DELETAR os próprios registros
CREATE POLICY "Usuários podem deletar seus próprios registros"
  ON clientes FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- 5. Habilitar Realtime (alterações ao vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;

-- 6. Seed data (exemplos)
INSERT INTO clientes (indicacao, cliente, cpf, agencia, valor_imovel, valor_financiado, produto, data_vistoria, status, obs) VALUES
  ('Imobiliária Nova Era', 'Maria Aparecida Santos', '345.678.901-23', 'Caixa - Brotas', 'R$ 185.000', 'R$ 148.000', 'SBPE', '22/06/2026', 'aguardando-doc', 'Falta comprovante de renda'),
  ('Loja Móveis Souza', 'João Batista Oliveira', '456.789.012-34', 'BB - Pituba', 'R$ 320.000', 'R$ 256.000', 'SBPE', '19/06/2026', 'conformidade', 'Crédito pré-aprovado'),
  ('Construtora Andrade', 'Rita de Cássia Lima', '567.890.123-45', 'CEF - Centro', 'R$ 215.000', 'R$ 172.000', 'SBPE', '25/06/2026', 'aguardando-vis', 'Vistoria agendada'),
  ('Indicação própria', 'Pedro Henrique Alves', '678.901.234-56', 'Santander - Itaigara', 'R$ 450.000', 'R$ 360.000', 'SBPE', '—', 'aguardando-laudo', 'Laudo em análise'),
  ('Corretor Marcos', 'Luciana Freitas Souza', '789.012.345-67', 'BRB - Salvador', 'R$ 280.000', 'R$ 210.000', 'FGTS', '18/06/2026', 'em-registro', ''),
  ('Imobiliária Nova Era', 'Roberto Carlos Mota', '890.123.456-78', 'Caixa - Pau da Lima', 'R$ 168.000', 'R$ 134.400', 'SBPE', '10/06/2026', 'conformidade', 'Documentação ok'),
  ('Loja Móveis Souza', 'Camila Andrade Nunes', '901.234.567-89', 'BB - Centro', 'R$ 510.000', 'R$ 408.000', 'SBPE', '—', 'aguardando-doc', 'Aguardando matrícula');
