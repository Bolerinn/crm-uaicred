-- WhatsApp Schema — Rede Prime CRM
-- Executar no SQL Editor do Supabase Dashboard
-- Projeto: dztiktcvueorlafiocdf

-- ============================================================================
-- TABELA: whatsapp_grupos
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_grupos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  analista_id TEXT NOT NULL,
  whatsapp_gid TEXT,
  subject TEXT NOT NULL,
  participantes TEXT[] NOT NULL DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  ativo BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- TABELA: whatsapp_mensagens
-- ============================================================================
CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grupo_id BIGINT NOT NULL REFERENCES whatsapp_grupos(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL,
  texto TEXT NOT NULL,
  tipo TEXT DEFAULT 'texto',
  enviada_em TIMESTAMPTZ DEFAULT NOW(),
  lida BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_cliente_id ON whatsapp_grupos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_analista_id ON whatsapp_grupos(analista_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_grupo_id ON whatsapp_mensagens(grupo_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_grupo_enviada ON whatsapp_mensagens(grupo_id, enviada_em);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Ativar RLS nas tabelas
ALTER TABLE whatsapp_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem fazer SELECT
CREATE POLICY "Usuarios autenticados podem ler grupos"
  ON whatsapp_grupos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem inserir grupos"
  ON whatsapp_grupos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar grupos"
  ON whatsapp_grupos
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem deletar grupos"
  ON whatsapp_grupos
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem ler mensagens"
  ON whatsapp_mensagens
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem inserir mensagens"
  ON whatsapp_mensagens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados podem atualizar mensagens"
  ON whatsapp_mensagens
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados podem deletar mensagens"
  ON whatsapp_mensagens
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- SUPABASE REALTIME
-- ============================================================================

-- Habilitar Realtime para a tabela de mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_mensagens;
