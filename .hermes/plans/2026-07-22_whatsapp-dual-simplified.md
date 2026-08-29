# WhatsApp CRM — Abordagem Simplificada

> **For Hermes:** Implementar tarefa por tarefa, commit + push + deploy a cada task.
> NÃO refatorar index.html em múltiplos arquivos. NÃO tocar no Hermes gateway.

**Goal:** Um único servidor WhatsApp do escritório (71 9205-7760) servindo:
1. Interface de chat completa acessível pela sidebar do CRM (todos os 4 usuários)
2. Botões "Criar Grupo" e "Disparar" na Aba 2 — sem bot individual por analista

**Architecture:**
- 1 PC do escritório roda `whatsapp-bot/server.js` em `localhost:3456`
- `whatsapp.html` = UI de chat completa (servida pelo mesmo Express)
- Sidebar do CRM → abre `whatsapp.html` em nova aba
- Aba 2: "Criar Grupo" chama `POST /api/criar-grupo` no servidor do escritório
- Aba 2: "Disparar" = clipboard + abre WhatsApp Desktop (zero dependência de servidor)

**Tech Stack:** HTML/CSS/JS vanilla + whatsapp-web.js + Express (já em produção)

---

## Estado Atual

| Componente | Status |
|-----------|--------|
| `server.js` (378 linhas) | ✅ Funcional — API completa |
| `whatsapp.html` (21 linhas) | ❌ Só mostra QR, auto-refresh 5s. Não funciona direito |
| Sidebar link WHATSAPP | ⚠️ Abre `whatsapp.html` via Vercel → mixed content bloqueia |
| `confirmarCriarGrupo()` | ❌ Só copia texto e abre `whatsapp://` — não chama API |
| `dispararMensagemUltimoAndamento()` | ⚠️ Funciona mas não prioriza grupo — abre chat individual |
| QR Code | ⚠️ Server.js gera inline (✅ funciona), mas whatsapp.html usa `<img src="/api/qr.png">` (❌ não funciona) |

---

## Plano de Execução (6 Tasks)

### Task 1: Reconstruir whatsapp.html — UI de chat completa com fallback QR

**Objetivo:** Página de chat WhatsApp-style funcional. Se online → chat UI. Se offline → QR Code.

**Arquivo:** Reescrever `C:/Users/Prime04D/crm-uaicred/whatsapp.html`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ WhatsApp — Rede Prime                🟢 ONLINE      │
├──────────────┬──────────────────────────────────────┤
│ 🔍 Buscar... │  ┌────────────────────────────────┐  │
│              │  │ Nome do chat / grupo            │  │
│ 👤 João Silva│  ├────────────────────────────────┤  │
│   Olá!...    │  │                                │  │
│ 👥 Grupo A   │  │  ┌──────────┐                  │  │
│   Mensagem...│  │  │ recebida │ (esquerda)       │  │
│ 👤 Maria     │  │  └──────────┘                  │  │
│   ...        │  │         ┌──────────┐           │  │
│              │  │         │ enviada  │ (direita) │  │
│              │  │         └──────────┘           │  │
│              │  │                                │  │
│              │  ├────────────────────────────────┤  │
│              │  │ 📝 Digite sua mensagem... [➤] │  │
│              │  └────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────┘
```

**Estados:**

1. **Carregando** (sem status ainda):
   ```
   ⏳ Conectando ao servidor WhatsApp...
   ```

2. **Offline com QR** (servidor respondeu, tem `qr` no status):
   ```
   📱 Escaneie o QR Code com o WhatsApp do escritório
   [QR Code image — data URL via fetch('/api/qr')]
   ```

3. **Online** (servidor conectado, sem QR):
   - Sidebar com lista de conversas (esquerda, 320px)
   - Painel de chat (direita)
   - Campo de envio (inferior)

**Design (tema escuro WhatsApp):**
- Fundo geral: `#111b21`
- Sidebar: `#111b21`, borda direita `#313d45`
- Item de chat ativo: `#2a3942`
- Chat background: `#0b141a` (ou imagem de pattern)
- Bolha enviada: `#005c4b` (verde escuro WhatsApp)
- Bolha recebida: `#202c33`
- Texto principal: `#e9edef`
- Texto secundário: `#8696a0`
- Campo de input: `#2a3942`
- Botão enviar: `#f97316` (laranja Prime)
- Fonte: `system-ui, -apple-system, sans-serif`

**API calls (todas fetch para localhost:3456):**
- `GET /api/status` → verificar online + QR
- `GET /api/chats` → lista de conversas
- `GET /api/messages/:chatId` → mensagens do chat selecionado
- `POST /api/send` + `{chatId, message}` → enviar mensagem

**QR Code approach (comprovadamente funcional):**
```javascript
// O servidor retorna QR como data URL no /api/status:
// { online: false, numero: null, qr: "2@J550ds1MW..." }

// O frontend chama /api/qr pra obter a imagem:
const qrResp = await fetch('/api/qr');
const dataUrl = await qrResp.text(); // "data:image/png;base64,..."
document.getElementById('qrImg').src = dataUrl;
```

**Polling:**
- Status: a cada 5s (enquanto offline)
- Mensagens do chat ativo: a cada 3s (enquanto online)
- Lista de chats: a cada 10s

**Verificação:** Abrir `http://localhost:3456/whatsapp.html` → deve mostrar QR ou chat UI.

---

### Task 2: Criar endpoint GET /api/qr no server.js (se não existir)

**Objetivo:** Endpoint dedicado que retorna QR como data URL (text/plain), usado pelo `whatsapp.html`.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/server.js`

**Verificar se já existe:** Procurar por `app.get('/api/qr'...`. Se não existir, adicionar ANTES do `app.listen`:

```javascript
// QR Code como data URL (para o frontend)
app.get('/api/qr', async (req, res) => {
  if (!latestQR) return res.status(404).json({ error: 'QR não disponível' });
  try {
    const QRCode = require('qrcode');
    const dataUrl = await QRCode.toDataURL(latestQR, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'L',
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.set('Content-Type', 'text/plain');
    res.send(dataUrl);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar QR' });
  }
});
```

**Verificação:** `curl http://localhost:3456/api/qr` → retorna `data:image/png;base64,...`

---

### Task 3: Remover rota inline /whatsapp.html do server.js — usar express.static

**Objetivo:** Simplificar: o servidor serve o arquivo `whatsapp.html` do disco via `express.static`, sem injeção server-side de QR.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/server.js:111-126`

**Mudança:** Remover o bloco `app.get('/whatsapp.html', async (req, res) => { ... })` e adicionar `express.static`:

```javascript
// Servir arquivos estáticos do diretório raiz do projeto
app.use(express.static(path.join(__dirname, '..')));
```

Isso serve `whatsapp.html`, `logo-p.png`, etc. direto do disco. O QR é tratado client-side via `/api/qr` (Task 2).

**⚠️ Ordem das rotas:** O `express.static` deve vir DEPOIS das rotas de API (`/api/*`), mas ANTES do `app.listen`. As rotas de API já estão definidas antes, então é seguro.

**Verificação:** `curl http://localhost:3456/whatsapp.html` → retorna o HTML do arquivo.

---

### Task 4: Corrigir link WHATSAPP na sidebar do CRM

**Objetivo:** Clicar em WHATSAPP na sidebar → abre `http://localhost:3456/whatsapp.html` em nova aba (NUNCA via Vercel).

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html`

**Problema atual:** Link `<a href="whatsapp.html" ...>` é relativo → no Vercel vira `https://crm-primerms.vercel.app/whatsapp.html` → mixed content bloqueia fetch pra `localhost:3456`.

**Solução:** Listener JavaScript que intercepta o clique e redireciona. Deve existir em **DOIS lugares**: `entrar()` E `(async () => { ... })()` (session resume).

**Código a adicionar nos DOIS lugares:**

```javascript
// WhatsApp link — abrir via localhost, não Vercel
const waLink = document.querySelector('a[data-tab="whatsapp"]');
if (waLink) {
  waLink.addEventListener('click', function(e) {
    e.preventDefault();
    window.open('http://localhost:3456/whatsapp.html', '_blank');
  });
}
```

**Locais exatos:**
1. Função `entrar()` — após `restaurarTabDoHash()`, ~linha 1470
2. Session resume `(async () => { ... })()` — após `restaurarTabDoHash()`, ~linha 4695

**Verificação:** Logar no CRM, clicar WHATSAPP → abre `http://localhost:3456/whatsapp.html` em nova aba.

---

### Task 5: Conectar "Criar Grupo" à API do servidor

**Objetivo:** Botão "Criar Grupo" na Aba 2 chama `POST /api/criar-grupo` no servidor do escritório.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html:2013-2047` (função `confirmarCriarGrupo`)

**Código novo:**

```javascript
async function confirmarCriarGrupo() {
  const corretorTel = document.getElementById('modalCorretorTel').value.trim();
  const clienteTel = document.getElementById('modalClienteTel').value.trim();
  fecharModalCriarGrupo();
  
  mostrarToast('⏳ Criando grupo no WhatsApp...');
  
  try {
    const resp = await fetch('http://localhost:3456/api/criar-grupo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: clienteTel || undefined,
        corretor: corretorTel || undefined,
        nomeCliente: _grupoClienteNome,
        nomeCorretor: _grupoCorretorNome || 'Corretor',
        clienteId: _grupoClienteId
      })
    });
    
    const data = await resp.json();
    
    if (data.success) {
      mostrarToast('✅ Grupo criado: ' + data.grupo);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data.link).catch(function(){});
      }
      // Abrir grupo no WhatsApp Desktop
      setTimeout(function() {
        window.open(data.link, '_blank');
      }, 600);
    } else {
      mostrarToast('❌ ' + (data.error || 'Erro ao criar grupo'));
    }
  } catch(e) {
    // Fallback: servidor offline → comportamento manual antigo
    console.error('Servidor offline:', e);
    var nome = _grupoClienteNome.toUpperCase();
    var texto = [
      '*REDE PRIME ASSESSORIA RMS*',
      '',
      '👋 Grupo de financiamento do cliente *' + nome + '*.',
      '👤 Corretor: ' + (_grupoCorretorNome || '—'),
      '',
      'Adicione: Douglas (71 9974-5617), Luana (71 9932-9300), Fernanda (71 9246-7911)',
    ].join('\\n');
    var destino = corretorTel || clienteTel;
    if (destino) {
      var d = destino.replace(/\\D/g, '');
      if (navigator.clipboard) navigator.clipboard.writeText(texto).catch(function(){});
      window.open('whatsapp://send?phone=' + d + '&text=' + encodeURIComponent(texto), '_blank');
      mostrarToast('⚠️ Servidor offline — abrindo WhatsApp manualmente');
    } else {
      if (navigator.clipboard) navigator.clipboard.writeText(texto).catch(function(){});
      mostrarToast('⚠️ Servidor offline — texto copiado');
    }
  }
}
```

**Verificação:** Clicar "Criar Grupo" na Aba 2 → grupo criado via servidor → link abre no WhatsApp Desktop.

---

### Task 6: Melhorar "Disparar" — priorizar grupo existente

**Objetivo:** "Disparar" na Aba 2 deve buscar o grupo do cliente no Supabase e abrir direto nele.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html:2422-2492` (função `dispararMensagemUltimoAndamento`)

**Mudança:** A busca ao Supabase já existe (linhas 2453-2467). Só ajustar o fluxo final (linhas 2474-2492):

```javascript
// ... validação + montagem do texto (mantido igual) ...
// ... busca ao Supabase (mantido igual, linhas 2453-2467) ...

// 2. Copiar texto pro clipboard
try { await navigator.clipboard.writeText(texto); } catch(e) {}

// 3. Abrir — prioridade: grupo > chat individual
if (linkGrupo) {
  mostrarToast('💬 Abrindo grupo no WhatsApp...');
  window.open(linkGrupo, '_blank');
  setTimeout(function() {
    mostrarToast('📋 Texto copiado! Cole (Ctrl+V) no grupo.');
  }, 800);
} else {
  // Fallback existente: chat individual via whatsapp://
  var whatsapp = c.whatsapp || '';
  if (whatsapp) {
    var destino = whatsapp.replace(/\D/g, '');
    window.open('whatsapp://send?phone=' + destino + '&text=' + encodeURIComponent(texto), '_blank');
    mostrarToast('💬 Abrindo WhatsApp...');
  } else {
    var tel = prompt('WhatsApp do cliente (' + (c.cliente || '') + ') (DDI+DDD+número):', '55');
    if (!tel) return;
    var d2 = tel.replace(/\D/g, '');
    window.open('whatsapp://send?phone=' + d2 + '&text=' + encodeURIComponent(texto), '_blank');
    mostrarToast('💬 Abrindo WhatsApp...');
  }
}
```

**Verificação:** Cliente com grupo → clica Disparar → abre grupo + texto no clipboard. Cliente sem grupo → abre chat individual.

---

## Resumo de Arquivos

| Task | Arquivo | Tipo |
|------|---------|------|
| 1 | `whatsapp.html` | ⚠️ REESCRITA total (~400 linhas) |
| 2 | `whatsapp-bot/server.js` | ✏️ Adicionar endpoint `/api/qr` |
| 3 | `whatsapp-bot/server.js` | ✏️ Remover rota inline, adicionar `express.static` |
| 4 | `index.html` | ✏️ Listener WHATSAPP em entrar() + session resume |
| 5 | `index.html` | ✏️ Reescrever `confirmarCriarGrupo()` |
| 6 | `index.html` | ✏️ Ajustar `dispararMensagemUltimoAndamento()` |

---

## Riscos

1. **QR Code** — O método data URL via `/api/qr` + `fetch().text()` é o único comprovadamente funcional (skill registra 4 abordagens fracassadas)
2. **Mixed content** — `whatsapp.html` SEMPRE via `localhost:3456`, nunca via Vercel
3. **Servidor offline** — fallback manual em `confirmarCriarGrupo()` protege contra isso
4. **Sessão corrompida** — se crashar, `rm -rf .wwebjs_auth .wwebjs_cache && node server.js` (já documentado na skill)
5. **Dual registration** — listeners precisam existir em `entrar()` E session resume (pitfall #13 da skill)
