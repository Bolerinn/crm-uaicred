# WhatsApp — Integração Real no CRM

> **Para Hermes:** Use a skill crm-prime. Servidor `whatsapp-bot/server.js` já existe e está funcional.

**Goal:** Conectar o CRM ao WhatsApp real via `whatsapp-web.js` local — WhatsApp do escritório na sidebar + funções da Aba 2 usando o WhatsApp Desktop de cada usuário.

**Arquitetura:**
- **Parte 1 (Escritório):** `whatsapp-bot/server.js` (localhost:3456) conectado ao número 71 9205-7760. `whatsapp.html` se comunica via API local + Supabase Realtime.
- **Parte 2 (Aba 2):** 
  - **Disparar:** busca link do grupo no Supabase → copia texto → abre grupo no WhatsApp Desktop → usuário cola (Ctrl+V) e envia. Se não tiver grupo ainda, fallback `whatsapp://send` com msg pré-preenchida.
  - **Criar Grupo:** chama API local `whatsapp-bot`. Cada máquina roda seu próprio bot autenticado no WhatsApp daquele usuário. Grupo sempre inclui Douglas + Luana + Fernanda.

**💰 Custo:** ZERO. Tudo roda localmente — sem VPS, sem API paga, sem Evolution API. Só precisa do Node.js e do WhatsApp Desktop instalado.

**Tech Stack:** Node.js, whatsapp-web.js, Express, Supabase, HTML/JS vanilla

**Arquivos:**
- `C:\Users\Prime04D\crm-uaicred\whatsapp-bot\server.js` — já existe (258 linhas)
- `C:\Users\Prime04D\crm-uaicred\index.html` — Aba 2 + sidebar
- `C:\Users\Prime04D\crm-uaicred\whatsapp.html` — interface do WhatsApp

**Estado atual do server.js:**
- ✅ Grupo com 3 fixos: Douglas (71 9974-5617), Luana (71 9329-9300), Fernanda (71 9246-7911)
- ✅ Nome: `FINANCIAMENTO [NOME] [SOBRENOME]`
- ✅ Foto do grupo (`logo-p.png`)
- ✅ Tenta adicionar corretor + cliente, fallback com link de convite
- ✅ `/api/enviar-mensagem` — envia mensagem para qualquer número
- ✅ `/api/status` — health check
- ✅ Salva grupo no Supabase (`whatsapp_grupos`)
- ⚠️ Telefones corretor/cliente atualmente **obrigatórios** (linha 94)

---

## Tarefa 1: Tornar corretor/cliente opcionais no server.js

**Objetivo:** Permitir criar grupo só com os 3 fixos quando nenhum telefone for informado.

**Arquivo:** `C:\Users\Prime04D\crm-uaicred\whatsapp-bot\server.js` (linhas 91-96)

**O que mudar:**

```javascript
// ANTES (linha 91-96):
app.post('/api/criar-grupo', async (req, res) => {
  const { cliente, corretor, nomeCliente, nomeCorretor, clienteId } = req.body;

  if (!cliente || !corretor) {
    return res.status(400).json({ error: 'Telefone do cliente e corretor obrigatórios' });
  }
```

```javascript
// DEPOIS:
app.post('/api/criar-grupo', async (req, res) => {
  const { cliente, corretor, nomeCliente, nomeCorretor, clienteId } = req.body;

  // Telefones são opcionais — se não informados, grupo só com os fixos
  const temCorretor = corretor && String(corretor).replace(/\D/g, '').length >= 10;
  const temCliente = cliente && String(cliente).replace(/\D/g, '').length >= 10;
```

E ajustar as validações de telefone nas linhas 102-107 para só validar se foram informados:

```javascript
// ANTES (linha 102-107):
  const telefoneCliente = String(cliente).replace(/\D/g, '');
  const telefoneCorretor = String(corretor).replace(/\D/g, '');

  if (telefoneCliente.length < 10 || telefoneCorretor.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido...' });
  }
```

```javascript
// DEPOIS:
  const telefoneCliente = cliente ? String(cliente).replace(/\D/g, '') : '';
  const telefoneCorretor = corretor ? String(corretor).replace(/\D/g, '') : '';
  // sem validação rígida — tenta adicionar se tiver número válido
```

E envolver os blocos de adicionar corretor/cliente em `if (temCorretor)` e `if (temCliente)`.

**Verificação:** Chamar `POST /api/criar-grupo` sem `cliente` nem `corretor` → deve criar grupo só com Douglas+Luana+Fernanda.

---

## Tarefa 2: Modal de telefones na Aba 2 (substituir prompts)

**Objetivo:** Substituir os `prompt()` nativos por um modal HTML estilizado.

**Arquivo:** `C:\Users\Prime04D\crm-uaicred\index.html`

**Step 1: Adicionar HTML do modal**

Inserir antes do `</body>`:

```html
<!-- MODAL: Criar Grupo WhatsApp -->
<div id="modalCriarGrupo" class="modal-overlay hidden" onclick="if(event.target===this)fecharModalCriarGrupo()">
  <div class="modal-box" style="max-width:420px;" onclick="event.stopPropagation()">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-sm">📱 Criar Grupo WhatsApp</h3>
      <button onclick="fecharModalCriarGrupo()" class="text-lg" style="color:var(--text-muted);">&times;</button>
    </div>
    <p class="text-xs mb-3" style="color:var(--text-muted);">Grupo: <strong id="modalGrupoNome" style="color:var(--text);"></strong></p>
    <div class="mb-3">
      <label class="text-xs mb-1 block" style="color:var(--text-muted);">WhatsApp do Corretor <span class="text-xs" style="color:var(--text-muted);">(opcional)</span></label>
      <input type="text" id="modalCorretorTel" placeholder="55 DDD + número" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:var(--border);background:var(--bg-input);color:var(--text);">
    </div>
    <div class="mb-4">
      <label class="text-xs mb-1 block" style="color:var(--text-muted);">WhatsApp do Cliente <span class="text-xs" style="color:var(--text-muted);">(opcional)</span></label>
      <input type="text" id="modalClienteTel" placeholder="55 DDD + número" class="w-full px-3 py-2 rounded-lg border text-sm" style="border-color:var(--border);background:var(--bg-input);color:var(--text);">
    </div>
    <p class="text-xs mb-3" style="color:var(--text-muted);">👥 Douglas, Luana e Fernanda são adicionados automaticamente.</p>
    <button onclick="confirmarCriarGrupo()" class="w-full py-2.5 rounded-xl text-sm font-bold text-white" style="background:linear-gradient(135deg,#25D366,#128C7E);">Criar Grupo</button>
  </div>
</div>
```

**Step 2: Refatorar `criarGrupoWhatsApp`**

```javascript
let _grupoClienteId = null;
let _grupoClienteNome = '';
let _grupoCorretorNome = '';

function criarGrupoWhatsApp(clienteId, clienteNome, cpf) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;
  
  _grupoClienteId = clienteId;
  _grupoClienteNome = clienteNome;
  _grupoCorretorNome = c.indicacao || 'Corretor';
  
  document.getElementById('modalGrupoNome').textContent = 'FINANCIAMENTO ' + clienteNome.toUpperCase();
  document.getElementById('modalCorretorTel').value = '';
  document.getElementById('modalClienteTel').value = '';
  document.getElementById('modalCriarGrupo').classList.remove('hidden');
}

function fecharModalCriarGrupo() {
  document.getElementById('modalCriarGrupo').classList.add('hidden');
}

async function confirmarCriarGrupo() {
  const corretorTel = document.getElementById('modalCorretorTel').value.trim();
  const clienteTel = document.getElementById('modalClienteTel').value.trim();
  
  fecharModalCriarGrupo();
  mostrarToast('📱 Criando grupo...');
  
  try {
    const resp = await fetch('http://localhost:3456/api/criar-grupo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: clienteTel || undefined,
        corretor: corretorTel || undefined,
        nomeCliente: _grupoClienteNome,
        nomeCorretor: _grupoCorretorNome,
        clienteId: _grupoClienteId
      })
    });
    
    const data = await resp.json();
    if (data.success) {
      mostrarToast('✅ Grupo criado! ' + data.link);
      if (navigator.clipboard) navigator.clipboard.writeText(data.link);
    } else {
      mostrarToast('❌ ' + (data.error || 'Erro ao criar grupo'));
    }
  } catch (err) {
    mostrarToast('❌ Servidor WhatsApp offline. Inicie o whatsapp-bot.');
  }
}
```

**Verificação:** Clicar "Criar Grupo" → modal abre → preencher (ou não) os telefones → grupo criado.

---

## Tarefa 3: Botão "Disparar" — abrir grupo + copiar texto

**Objetivo:** `dispararMensagemUltimoAndamento` deve:
1. Buscar o grupo WhatsApp do cliente no Supabase (`whatsapp_grupos`)
2. Copiar a mensagem para o clipboard
3. Abrir o link de convite do grupo no WhatsApp Desktop
4. Usuário cola (Ctrl+V) e envia manualmente

**Fallback:** Se o cliente não tiver grupo ainda → abre chat direto via `whatsapp://send` com msg pré-preenchida.

**Arquivo:** `C:\Users\Prime04D\crm-uaicred\index.html` — função `dispararMensagemUltimoAndamento` (~linha 2421)

**Código:**

```javascript
async function dispararMensagemUltimoAndamento(id) {
  var c = clientes.find(function(x) { return x.id === id; });
  if (!c) { mostrarToast('Cliente não encontrado'); return; }

  var data = c.ultimo_andamento_data || '';
  var textoAndamento = c.ultimo_andamento_texto || '';

  if (!data && !textoAndamento) {
    mostrarToast('⚠️ Preencha a data e o texto do último andamento primeiro.');
    return;
  }

  var partes = (c.cliente || '').trim().split(/\s+/);
  var nomeCaps = partes.length >= 2 ? (partes[0] + ' ' + partes[1]).toUpperCase() : (partes[0] || 'CLIENTE').toUpperCase();

  var texto = [
    '*REDE PRIME ASSESSORIA RMS*',
    '',
    '📌 *Atualização do processo* — ' + nomeCaps,
    '',
    '📅 Data: ' + (data || '—'),
    '📝 Andamento: ' + (textoAndamento || '—'),
    '',
    'Segue atualização do processo. Qualquer dúvida, estamos à disposição!',
    '',
    '---',
    'Mensagem enviada pelo CRM Rede Prime'
  ].join('\n');

  // 1. Tentar achar o grupo do cliente no Supabase
  var linkGrupo = null;
  try {
    var { data: grupos, error } = await sb
      .from('whatsapp_grupos')
      .select('link_convite')
      .eq('cliente_id', id)
      .not('link_convite', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(1);

    if (!error && grupos && grupos.length > 0) {
      linkGrupo = grupos[0].link_convite;
    }
  } catch(e) {
    console.log('Erro ao buscar grupo:', e);
  }

  // 2. Copiar texto pro clipboard
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast('📋 Texto copiado! ');
  } catch(e) {
    // fallback silencioso
  }

  // 3. Abrir grupo (se existir) ou chat direto
  if (linkGrupo) {
    // Abrir grupo via link de convite
    window.open(linkGrupo, '_blank');
    mostrarToast('📋 Texto copiado! Abrindo grupo... ✨');
  } else {
    // Fallback: chat direto com msg pré-preenchida
    var telefone = prompt('WhatsApp do cliente (' + (c.cliente || '') + ') (DDI+DDD+número, ex: 5571999999999):', '55');
    if (!telefone) return;
    var destino = telefone.replace(/\D/g, '');
    var url = 'whatsapp://send?phone=' + destino + '&text=' + encodeURIComponent(texto);
    mostrarToast('💬 Abrindo WhatsApp...');
    window.open(url, '_blank');
  }
}
```

**Verificação:**
1. Criar grupo para um cliente via "Criar Grupo"
2. Preencher data + texto do andamento
3. Clicar "Disparar" → texto copiado + grupo abre no WhatsApp Desktop
4. Usuário pressiona Ctrl+V → texto aparece → envia manualmente

---

## Tarefa 4: whatsapp.html — integrar com API local

**Objetivo:** A interface `whatsapp.html` deve buscar mensagens reais do bot local, não só do Supabase.

**Arquivo:** `C:\Users\Prime04D\crm-uaicred\whatsapp.html`

**O que mudar:** Adicionar polling ou usar o Supabase Realtime (já configurado nas tabelas). A principal mudança é o envio de mensagens:

No `whatsapp.html`, encontrar a função de enviar mensagem e adicionar chamada à API:

```javascript
async function enviarMensagem(grupoId, texto) {
  // 1. Salvar no Supabase (já existe)
  await sb.from('whatsapp_mensagens').insert({...});
  
  // 2. Enviar via API local (NOVO)
  try {
    const grupo = grupos.find(g => g.id === grupoId);
    if (grupo && grupo.gid) {
      await fetch('http://localhost:3456/api/enviar-mensagem-grupo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gid: grupo.gid, mensagem: texto })
      });
    }
  } catch (e) {
    console.warn('API offline, mensagem só no Supabase');
  }
}
```

E adicionar endpoint `POST /api/enviar-mensagem-grupo` no `server.js`:

```javascript
app.post('/api/enviar-mensagem-grupo', async (req, res) => {
  const { gid, mensagem } = req.body;
  if (!gid || !mensagem) return res.status(400).json({ error: 'gid e mensagem obrigatórios' });
  if (!client.info?.wid?.user) return res.status(503).json({ error: 'WhatsApp não conectado' });
  
  try {
    const chat = await client.getChatById(gid);
    await chat.sendMessage(mensagem);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Tarefa 5: Status do bot na sidebar

**Objetivo:** Mostrar na sidebar do CRM se o whatsapp-bot está online.

**Arquivo:** `C:\Users\Prime04D\crm-uaicred\index.html`

Adicionar um indicador perto do link WHATSAPP na sidebar (só master):

```javascript
// Na função de carregar sidebar, adicionar:
async function verificarStatusBot() {
  try {
    const resp = await fetch('http://localhost:3456/api/status');
    const data = await resp.json();
    const el = document.getElementById('botStatus');
    if (el) {
      el.innerHTML = data.online 
        ? '<span style="color:#25D366;">🟢 Bot Online</span>' 
        : '<span style="color:#ef4444;">🔴 Bot Offline</span>';
    }
  } catch(e) {
    const el = document.getElementById('botStatus');
    if (el) el.innerHTML = '<span style="color:#ef4444;">🔴 Bot Offline</span>';
  }
}
// Chamar a cada 30s
setInterval(verificarStatusBot, 30000);
```

Adicionar `<span id="botStatus" class="text-xs"></span>` abaixo do link WHATSAPP na sidebar.

---

## Tarefa 6: Rodar o bot como serviço Windows

**Objetivo:** O `server.js` precisa iniciar automaticamente com o Windows.

**Opção:** Criar um script `.bat` na pasta Startup:

```batch
@echo off
cd C:\Users\Prime04D\crm-uaicred\whatsapp-bot
start /min node server.js
```

Salvar em: `C:\Users\Prime04D\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\whatsapp-bot.bat`

---

## Resumo das tarefas

| # | O quê | Arquivo | Tipo |
|---|---|---|---|
| 1 | Corretor/cliente opcionais | `server.js:91-107` | Backend |
| 2 | Modal HTML + refatorar criarGrupoWhatsApp | `index.html` | Frontend |
| 3 | Disparar: busca grupo no Supabase → copia texto → abre link | `index.html:2421` | Frontend |
| 4 | Enviar msg do whatsapp.html via bot | `server.js` + `whatsapp.html` | Full-stack |
| 5 | Indicador de status do bot | `index.html` (sidebar) | Frontend |
| 6 | Auto-start com Windows | `whatsapp-bot.bat` | Infra |

---

## Deploy

```bash
cd ~/crm-uaicred
git add -A && git commit -m "feat: integracao WhatsApp real — API local + modal grupo + disparar bot"
git push
npx vercel --prod --yes
```

Após deploy, iniciar o bot:
```bash
cd ~/crm-uaicred/whatsapp-bot
node server.js
```
