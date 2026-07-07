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
  '557199745617@c.us',  // Douglas — 71 9974-5617
  '557193299300@c.us',  // Luana — 71 9932-9300
  '557199246791@c.us',  // Fernanda — 71 9924-67911
];

// Extrair primeiro nome + sobrenome de um nome completo
function extrairNomeGrupo(nomeCompleto) {
  const partes = (nomeCompleto || '').trim().split(/\s+/);
  if (partes.length >= 2) {
    return (partes[0] + ' ' + partes[1]).toUpperCase();
  }
  return (partes[0] || 'CLIENTE').toUpperCase();
}

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

  // Telefones são opcionais — se não informados, grupo só com os fixos
  const temCorretor = corretor && String(corretor).replace(/\D/g, '').length >= 10;
  const temCliente = cliente && String(cliente).replace(/\D/g, '').length >= 10;

  if (!client.info?.wid?.user) {
    return res.status(503).json({ error: 'WhatsApp não conectado. Escaneie o QR Code primeiro.' });
  }

  const telefoneCliente = cliente ? String(cliente).replace(/\D/g, '') : '';
  const telefoneCorretor = corretor ? String(corretor).replace(/\D/g, '') : '';

  try {
    // Nome do grupo: FINANCIAMENTO + PRIMEIRO NOME + SOBRENOME (caixa alta)
    const nomeGrupo = 'FINANCIAMENTO ' + extrairNomeGrupo(nomeCliente);
    const participantesConvidados = [];

    console.log(`📝 Criando grupo: "${nomeGrupo}"`);

    // 1. Criar grupo APENAS com participantes fixos (Douglas, Luana, Fernanda)
    const grupo = await client.createGroup(nomeGrupo, PARTICIPANTES_FIXOS);
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

    // 4. Tentar adicionar corretor ao grupo (se informado)
    if (temCorretor) {
      try {
        await grupo.addParticipants([`${telefoneCorretor}@c.us`]);
        console.log(`✅ Corretor (${nomeCorretor}) adicionado ao grupo`);
        participantesConvidados.push(`${telefoneCorretor}@c.us`);
      } catch (corretorErr) {
        console.log(`⚠️ Corretor (${nomeCorretor}) não pode ser adicionado. Enviando link por DM...`);
        const msgCorretor = [
          `*REDE PRIME ASSESSORIA RMS*`,
          ``,
          `Olá *${nomeCorretor || 'Corretor'}*! 👋`,
          ``,
          `O grupo de financiamento do cliente *${extrairNomeGrupo(nomeCliente)}* foi criado!`,
          `Como você não está na lista de contatos da PRIME, não foi possível adicioná-lo automaticamente.`,
          ``,
          `👉 *Compartilhe o link abaixo com o cliente* para que ele entre no grupo:`,
          `${linkUrl}`,
          ``,
          `🔗 *Link do grupo:* ${linkUrl}`,
          ``,
          `Atenciosamente,`,
          `Rede Prime Assessoria RMS`,
        ].join('\\n');
        await client.sendMessage(`${telefoneCorretor}@c.us`, msgCorretor);
        console.log(`✅ Mensagem de convite enviada para corretor (${telefoneCorretor})`);
      }
    }

    // 5. Tentar adicionar cliente ao grupo (se informado)
    if (temCliente) {
      try {
        await grupo.addParticipants([`${telefoneCliente}@c.us`]);
        console.log(`✅ Cliente (${nomeCliente}) adicionado ao grupo`);
        participantesConvidados.push(`${telefoneCliente}@c.us`);
      } catch (clienteErr) {
        console.log(`⚠️ Cliente (${nomeCliente}) não pode ser adicionado. Enviando link por DM para o corretor...`);
        const msgConvite = [
          `*REDE PRIME ASSESSORIA RMS*`,
          ``,
          `Olá *${nomeCorretor || 'Corretor'}*! 👋`,
          ``,
          `O cliente *${extrairNomeGrupo(nomeCliente)}* não pôde ser adicionado automaticamente ao grupo de financiamento, pois não tem o contato da PRIME salvo.`,
          ``,
          `👉 *Por favor, compartilhe o link abaixo com ele:*`,
          `${linkUrl}`,
          ``,
          `🔗 *Link do grupo:* ${linkUrl}`,
          ``,
          `Desde já, obrigado!`,
          `Rede Prime Assessoria RMS`,
        ].join('\\n');
        if (temCorretor && telefoneCorretor.length >= 10) {
          await client.sendMessage(`${telefoneCorretor}@c.us`, msgConvite);
          console.log(`✅ Mensagem com link enviada para corretor (${telefoneCorretor}) compartilhar com cliente`);
        }
      }
    }

    // 6. Mensagem de boas-vindas no grupo
    await client.sendMessage(grupo.gid._serialized, [
      `🎉 *BEM-VINDOS AO GRUPO!*`,
      ``,
      `Acompanhamento do processo de *${extrairNomeGrupo(nomeCliente)}*.`,
      ``,
      `🏢 *Rede Prime Assessoria RMS*`,
      `📞 (71) 9974-5617`,
      ``,
      `Qualquer dúvida, estamos à disposição!`,
    ].join('\n'));

    // 7. Salvar no banco Supabase (opcional)
    salvarGrupoNoBanco({
      cliente_id: clienteId || null,
      nome_grupo: nomeGrupo,
      participantes: [...PARTICIPANTES_FIXOS, ...participantesConvidados],
      link_convite: linkUrl,
      gid: grupo.gid._serialized,
    });

    res.json({
      success: true,
      grupo: nomeGrupo,
      link: linkUrl,
      gid: grupo.gid._serialized,
      convidados: participantesConvidados.length,
      nao_adicionados: (telefoneCliente && !participantesConvidados.includes(`${telefoneCliente}@c.us`)) || 
                       (telefoneCorretor && !participantesConvidados.includes(`${telefoneCorretor}@c.us`)) 
                        ? 'Alguns convidados receberam o link via mensagem direta.' : null,
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

// Enviar mensagem para grupo (via gid)
app.post('/api/enviar-mensagem-grupo', async (req, res) => {
  const { gid, mensagem } = req.body;

  if (!gid || !mensagem) {
    return res.status(400).json({ error: 'gid e mensagem obrigatórios' });
  }

  if (!client.info?.wid?.user) {
    return res.status(503).json({ error: 'WhatsApp não conectado' });
  }

  try {
    const chat = await client.getChatById(gid);
    await chat.sendMessage(mensagem);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem para grupo:', err);
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
