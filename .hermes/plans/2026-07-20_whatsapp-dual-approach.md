# WhatsApp — Implementação Dual (Escritório + Individual)

> **For Hermes:** Implementar tarefa por tarefa, commit + push + deploy a cada task.
> NÃO refatorar index.html em múltiplos arquivos. NÃO tocar no Hermes gateway.

**Goal:** Duas frentes de WhatsApp no CRM: (1) WhatsApp do escritório acessível a todos via sidebar, (2) funções individuais de cada analista na Aba 2 usando WhatsApp Desktop.

**Architecture:** 
- **Escritório:** servidor `whatsapp-bot/server.js` roda em 1 PC (número 71 9205-7760), serve `whatsapp.html` com UI de chat completa via API (`/api/chats`, `/api/messages/:id`, `/api/send`). Sidebar link abre em nova aba.
- **Individual:** cada analista roda seu próprio `server.js` em `localhost:3456`. Botões na Aba 2 chamam `/api/criar-grupo` (cria grupo com fixos + corretor + cliente) e abrem WhatsApp Desktop com texto pronto no grupo do cliente.

**Tech Stack:** whatsapp-web.js, Express, HTML/CSS vanilla (mesmo padrão do CRM)

---

## Pré-requisitos

- `whatsapp-bot/server.js` (378 linhas, ✅ funcional) — backend API completo
- `whatsapp-bot/package.json` — dependências instaladas
- `.wwebjs_auth/` — sessão autenticada do escritório
- `index.html` (4734 linhas) — CRM principal
- `whatsapp.html` (21 linhas, será reescrito) — página de chat

---

## Abordagem 1: WhatsApp do Escritório na Sidebar

### Task 1: Reconstruir whatsapp.html como UI de chat completa

**Objetivo:** Página de chat WhatsApp-style com sidebar de conversas + painel de mensagens + campo de envio.

**Arquivo:** Reescrever `C:/Users/Prime04D/crm-uaicred/whatsapp.html`

**Funcionalidades da UI:**
- Barra superior: "WhatsApp — Rede Prime" + indicador online/offline
- Sidebar esquerda (300px): lista de conversas com busca, avatar circular com iniciais, última mensagem truncada, badge de não lidas, indicador de grupo
- Painel direito: cabeçalho do chat, área de mensagens (scroll), input de envio
- Mensagens: bolhas estilo WhatsApp (enviadas alinhadas à direita em verde #d9fdd3, recebidas à esquerda em #202c33), timestamp
- Polling a cada 3s para atualizar mensagens do chat ativo
- Botão "Nova conversa" para iniciar chat com número não listado

**Endpoints usados:**
- `GET /api/status` — verificar conexão
- `GET /api/chats` — lista de conversas
- `GET /api/messages/:chatId` — mensagens de um chat
- `POST /api/send` — enviar mensagem

**Design:** Fundo #111b21, texto #e9edef, sidebar #111b21, chat bg #0b141a, enviadas #005c4b, recebidas #202c33, accent laranja #f97316.

**Observação:** Se o bot estiver offline (QR pendente), mostrar tela de QR Code (data URL via `/api/qr`) como fallback.

### Task 2: Atualizar server.js — rota whatsapp.html com QR inline se offline

**Objetivo:** Garantir que `/whatsapp.html` sirva a página com QR Code embutido quando o bot não estiver autenticado.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/server.js:111-126`

**Mudança:** A rota `GET /whatsapp.html` atualmente gera HTML inline com QR. Após o Task 1 (whatsapp.html reescrito como UI completa), o servidor deve:
1. Servir o arquivo `whatsapp.html` do disco (via `express.static`)
2. OU, se o bot estiver offline e houver QR, injetar o QR como data URL no HTML antes de servir

**Implementação:** A rota `GET /whatsapp.html` lê o arquivo do disco com `fs.readFileSync`, e se `latestQR` existir, faz `replace('QR_PLACEHOLDER', dataUrl)` — ou simplesmente mantém o fallback inline como já está para o caso offline.

Na verdade, a abordagem mais simples: servir `whatsapp.html` via `express.static` e adicionar um endpoint `GET /api/qr` (já existe no status). O frontend faz polling e mostra/esconde QR dinamicamente. Sem injeção server-side — 100% client-side.

### Task 3: Ajustar link da sidebar para abrir em rede local

**Objetivo:** Permitir que todos os 4 usuários acessem o WhatsApp do escritório, mesmo em PCs diferentes.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html:853`

**Situação atual:** `<a href="whatsapp.html" data-tab="whatsapp" target="_blank">`

**Problema:** `whatsapp.html` é relativo → abre `https://crm-primerms.vercel.app/whatsapp.html` (Vercel), que NÃO funciona (mixed content bloqueia fetch para localhost:3456).

**Solução:** Adicionar script que detecta se está no Vercel e redireciona para `http://localhost:3456/whatsapp.html` (ou IP da rede local).

```javascript
// No clique do link WHATSAPP:
document.querySelector('[data-tab="whatsapp"]').addEventListener('click', function(e) {
  e.preventDefault();
  // Tenta localhost primeiro, fallback para IP da rede
  window.open('http://localhost:3456/whatsapp.html', '_blank');
});
```

**Nota:** Se o PC que roda o bot tiver IP fixo na rede (ex: 192.168.0.50), o link pode ser configurado como esse IP. Senão, cada máquina acessa via `localhost` do PC que roda o bot (via Remote Desktop ou similar). O mais prático: instruir os usuários a acessar `http://ENDERECO_DO_PC:3456/whatsapp.html`.

**No CRM, o link será:** `window.open('http://localhost:3456/whatsapp.html', '_blank')` — funciona quando o bot roda na mesma máquina. Para máquinas remotas, o usuário digita o IP manualmente ou configuramos um campo de configuração.

---

## Abordagem 2: Funções Individuais na Aba 2

### Task 4: Conectar "Criar Grupo" ao servidor local

**Objetivo:** O botão "Criar Grupo" na Aba 2 deve chamar `POST /api/criar-grupo` no servidor local do analista em vez de só copiar texto.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html:2013-2047` (função `confirmarCriarGrupo`)

**O que muda:**

```javascript
async function confirmarCriarGrupo() {
  const corretorTel = document.getElementById('modalCorretorTel').value.trim();
  const clienteTel = document.getElementById('modalClienteTel').value.trim();
  fecharModalCriarGrupo();
  
  mostrarToast('⏳ Criando grupo...');
  
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
      mostrarToast('✅ Grupo criado! Link copiado.');
      // Copiar link pro clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(data.link).catch(() => {});
      }
      // Abrir grupo no WhatsApp Desktop
      setTimeout(() => {
        window.open('https://chat.whatsapp.com/' + data.link.split('/').pop(), '_blank');
      }, 500);
    } else {
      mostrarToast('❌ Erro: ' + (data.error || 'servidor offline'));
    }
  } catch(e) {
    // Fallback: servidor offline → comportamento antigo (copia texto + abre whatsapp://)
    mostrarToast('⚠️ Servidor local offline. Use o WhatsApp manualmente.');
    // ... fallback antigo ...
  }
}
```

**Botão Criar Grupo (linha 4510):** Já existe no expand da Aba 2. Sem alteração no HTML — só na função JS.

### Task 5: Refatorar "Disparar" — abrir grupo no WhatsApp Desktop com texto pronto

**Objetivo:** Botão "Disparar" na Aba 2 deve buscar o grupo do cliente e abrir o WhatsApp Desktop nele com o texto de atualização pronto.

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html:2422-2492` (função `dispararMensagemUltimoAndamento`)

**Fluxo:**
1. Buscar grupo no Supabase (`whatsapp_grupos` com `link_convite`)
2. Copiar texto de atualização para clipboard
3. Abrir link do grupo → WhatsApp Desktop abre no grupo
4. Usuário cola (Ctrl+V) e envia

**O que muda na função:**
- Manter busca ao Supabase (linhas 2453-2467, ✅ já existe)
- Após encontrar o grupo, PRIORIZAR abrir via link de convite
- TEXTO MANTIDO no clipboard
- Fallback: se não tem grupo → abrir `whatsapp://send` com o telefone do cliente (já existe)

```javascript
async function dispararMensagemUltimoAndamento(id) {
  // ... validação existente ...
  
  // 1. Copiar texto pro clipboard (já existe)
  try { await navigator.clipboard.writeText(texto); } catch(e) {}
  
  // 2. Buscar grupo no Supabase (já existe, linhas 2453-2467)
  // ...
  
  // 3. Abrir grupo ou chat individual
  if (linkGrupo) {
    mostrarToast('💬 Abrindo grupo no WhatsApp...');
    window.open(linkGrupo, '_blank');
    mostrarToast('📋 Texto copiado! Cole (Ctrl+V) no grupo.');
  } else {
    // Fallback existente — abre chat individual
    // ...
  }
}
```

### Task 6: Verificar consistência da sidebar + event listeners

**Objetivo:** Garantir que o link WHATSAPP funcione tanto após login fresco quanto após session resume (dual registration).

**Arquivo:** `C:/Users/Prime04D/crm-uaicred/index.html`

**Verificar:**
- `entrar()` (~linha 1458): `if (link.getAttribute('data-tab') === 'whatsapp') return;` — ✅ correto, pula tab normal
- `(async () => { ... })()` session resume (~linha 4684): mesmo tratamento — ✅ correto

**Adicionar:** Listener específico no `entrar()` E no session resume para o clique no link WHATSAPP redirecionar para `http://localhost:3456/whatsapp.html`:

```javascript
// Nos DOIS lugares (entrar + session resume):
const waLink = document.querySelector('a[data-tab="whatsapp"]');
if (waLink) {
  waLink.addEventListener('click', function(e) {
    e.preventDefault();
    window.open('http://localhost:3456/whatsapp.html', '_blank');
  });
}
```

---

## Resumo de Arquivos Alterados

| Arquivo | Task | Tipo de Mudança |
|---------|------|----------------|
| `whatsapp.html` | 1 | ⚠️ REESCRITA TOTAL — de 21 linhas para ~400 linhas |
| `whatsapp-bot/server.js` | 2 | Ajuste na rota `/whatsapp.html` para servir arquivo do disco com fallback QR |
| `index.html` — sidebar link | 3 | Listener `click` para abrir `localhost:3456/whatsapp.html` |
| `index.html` — `confirmarCriarGrupo()` | 4 | Substituir fallback manual por chamada `POST /api/criar-grupo` |
| `index.html` — `dispararMensagemUltimoAndamento()` | 5 | Priorizar link de convite do grupo |
| `index.html` — dual registration | 6 | Adicionar listener WHATSAPP em `entrar()` + session resume |

---

## Riscos e Tradeoffs

1. **WhatsApp Web não permite iframe** — resolvido: abre em nova aba (`target="_blank"` ou `window.open`)
2. **Mixed content (HTTPS→HTTP)** — resolvido: `whatsapp.html` é servido pelo `localhost:3456`, não pelo Vercel
3. **1 número = 1 sessão Web** — o WhatsApp do escritório só funciona no PC que escaneou o QR. Outros PCs acessam via rede local (IP:3456)
4. **Servidor local offline** — fallback manual em `confirmarCriarGrupo()` (comportamento antigo)
5. **Sessão do bot corrompida** — instrução no `whatsapp.html`: "Se offline, rode `node server.js` e escaneie o QR"
6. **Múltiplos servidores** — cada analista que quiser usar funções da Aba 2 precisa rodar seu próprio `node server.js` com seu WhatsApp logado
