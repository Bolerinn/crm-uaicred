const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// ============ CONFIG ============
const PORTA = 3456;
const FOTO_GRUPO = path.join(__dirname, '..', 'logo-p.png');
const PARTICIPANTES_FIXOS = [
  '557199745617@c.us',  // Douglas (pessoal) — 71 9974-5617
  '557192057760@c.us',  // Escritório — 71 9205-7760
];

// ============ WHATSAPP CLIENT ============
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', (qr) => {
  console.log('\n==================== QR CODE ====================');
  qrcode.generate(qr, { small: true });
  console.log('Escaneie com o WhatsApp do escritório (71 9205-7760)');
  console.log('==================================================\n');
});

client.on('ready', () => {
  console.log('\n✅ WhatsApp conectado!');
  console.log(`🤖 Bot rodando em http://localhost:${PORTA}`);
  console.log(`📱 Número: ${client.info?.wid?.user || 'desconhecido'}`);
});

client.on('disconnected', (reason) => {
  console.log('❌ WhatsApp desconectado:', reason);
  console.log('Reiniciando em 5 segundos...');
  setTimeout(() => client.initialize(), 5000);
});

client.initialize();

// ============ SUPABASE HELPER ============
const SUPABASE_URL = 'https://dztiktcvueorlafiocdf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jsQh5PSYqwvGcJeS2CRWRw_jhhO59PK';

async function salvarGrupoNoBanco(dados) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await sb.from('whatsapp_grupos').insert({
      cliente_id: dados.cliente_id || null,
      subject: dados.nome_grupo,
      participantes: dados.participantes,
      link_convite: dados.link_convite,
      gid: dados.gid,
      criado_em: new Date().toISOString(),
    });
    if (error) console.error('Erro ao salvar grupo no banco:', error.message);
  } catch (e) {
    console.error('Erro ao conectar Supabase (opcional):', e.message);
  }
}

// ============ API ENDPOINTS ============

// Health check
app.get('/api/status', (req, res) => {
  res.json({
    online: client.info?.wid?.user ? true : false,
    numero: client.info?.wid?.user || null,
  });
});

// Criar grupo
app.post('/api/criar-grupo', async (req, res) => {
  const { cliente, corretor, nomeCliente, nomeCorretor, clienteId } = req.body;

  if (!cliente || !corretor) {
    return res.status(400).json({ error: 'Telefone do cliente e corretor obrigatórios' });
  }

  if (!client.info?.wid?.user) {
    return res.status(503).json({ error: 'WhatsApp não conectado. Escaneie o QR Code primeiro.' });
  }

  const telefoneCliente = String(cliente).replace(/\D/g, '');
  const telefoneCorretor = String(corretor).replace(/\D/g, '');

  if (telefoneCliente.length < 10 || telefoneCorretor.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido. Use DDI+DDD+número (ex: 5571999999999)' });
  }

  try {
    const nomeGrupo = `${nomeCliente || 'Cliente'} — Rede Prime`;
    const participantes = [
      `${telefoneCliente}@c.us`,
      `${telefoneCorretor}@c.us`,
      ...PARTICIPANTES_FIXOS,
    ];

    console.log(`📝 Criando grupo: "${nomeGrupo}"`);
    console.log(`   Participantes: ${participantes.length}`);

    // 1. Criar grupo
    const grupo = await client.createGroup(nomeGrupo, participantes);
    console.log(`✅ Grupo criado: ${grupo.gid._serialized}`);

    // 2. Definir foto (se existir)
    if (fs.existsSync(FOTO_GRUPO)) {
      try {
        await grupo.setPicture(fs.readFileSync(FOTO_GRUPO));
        console.log('🖼️  Foto do grupo definida');
      } catch (fotoErr) {
        console.warn('⚠️  Não foi possível definir foto:', fotoErr.message);
      }
    }

    // 3. Gerar link de convite
    const inviteCode = await grupo.getInviteCode();
    const linkUrl = `https://chat.whatsapp.com/${inviteCode}`;
    console.log(`🔗 Link: ${linkUrl}`);

    // 4. Mensagem personalizada
    const msgBoasVindas = [
      `*Rede Prime Assessoria RMS* 🤝`,
      ``,
      `Seu grupo de acompanhamento foi criado!`,
      `Abaixo o link para entrar:`,
      `${linkUrl}`,
      ``,
      `Cliente: *${nomeCliente || '—'}*`,
      `Corretor: *${nomeCorretor || '—'}*`,
      ``,
      `A Rede Prime está à disposição!`,
    ].join('\n');

    // Enviar link para corretor
    await client.sendMessage(`${telefoneCorretor}@c.us`, msgBoasVindas);

    // Enviar link para cliente (se tiver whatsapp)
    if (telefoneCliente) {
      await client.sendMessage(`${telefoneCliente}@c.us`, msgBoasVindas);
    }

    // Mensagem de boas-vindas no grupo
    await client.sendMessage(grupo.gid._serialized, [
      `🎉 *Bem-vindos ao grupo!*`,
      ``,
      `Este é o acompanhamento do processo de *${nomeCliente || 'Cliente'}*.`,
      ``,
      `📋 Corretor: ${nomeCorretor || '—'}`,
      `🏢 Rede Prime Assessoria RMS`,
      ``,
      `Qualquer dúvida, estamos à disposição!`,
    ].join('\n'));

    // 5. Salvar no banco Supabase (opcional)
    salvarGrupoNoBanco({
      cliente_id: clienteId || null,
      nome_grupo: nomeGrupo,
      participantes: participantes,
      link_convite: linkUrl,
      gid: grupo.gid._serialized,
    });

    res.json({
      success: true,
      grupo: nomeGrupo,
      link: linkUrl,
      gid: grupo.gid._serialized,
    });
  } catch (err) {
    console.error('❌ Erro ao criar grupo:', err);
    res.status(500).json({ error: err.message });
  }
});

// Enviar mensagem para um contato
app.post('/api/enviar-mensagem', async (req, res) => {
  const { telefone, mensagem } = req.body;

  if (!telefone || !mensagem) {
    return res.status(400).json({ error: 'Telefone e mensagem obrigatórios' });
  }

  if (!client.info?.wid?.user) {
    return res.status(503).json({ error: 'WhatsApp não conectado' });
  }

  try {
    const numero = `${String(telefone).replace(/\D/g, '')}@c.us`;
    await client.sendMessage(numero, mensagem);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============ INICIAR SERVIDOR ============
app.listen(PORTA, () => {
  console.log(`\n🚀 Servidor WhatsApp Bot rodando`);
  console.log(`   URL: http://localhost:${PORTA}`);
  console.log(`   Endpoints:`);
  console.log(`   GET  /api/status        — status da conexão`);
  console.log(`   POST /api/criar-grupo   — criar grupo + convite`);
  console.log(`   POST /api/enviar-mensagem — enviar mensagem`);
  console.log(`\n📱 Escaneie o QR Code acima para conectar.\n`);
});
