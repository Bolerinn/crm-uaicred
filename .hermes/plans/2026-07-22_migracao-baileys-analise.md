# Análise Completa & Migração: whatsapp-web.js → Baileys

> **For Hermes:** Leitura e análise. Implementar após aprovação do usuário.

---

## 1. Análise do Estado Atual

### 1.1 Integração WhatsApp Existente

**SIM, já existe.** O projeto utiliza `whatsapp-web.js` (v1.34.7), NÃO Baileys.

| Componente | Arquivo | Linhas | Status |
|-----------|---------|--------|--------|
| Servidor WhatsApp | `whatsapp-bot/server.js` | 403 | ⚠️ Instável — erro CDP Puppeteer |
| Interface de chat | `whatsapp.html` | 631 | ✅ Nova, funcional (depende do server.js) |
| QR Code (standalone) | `whatsapp-bot/qr.html` | ~30 | ❌ Obsoleto, não usado |
| Botões no CRM | `index.html` | 4784 | ✅ Integrados via fetch→localhost:3456 |

### 1.2 Dependências Atuais

```json
{
  "whatsapp-web.js": "^1.34.7",   // ← será substituído
  "express": "^5.2.1",             // ← mantido (servidor HTTP)
  "qrcode": "^1.5.4",              // ← mantido (geração QR Code)
  "qrcode-terminal": "^0.12.0",    // ← mantido (QR no terminal)
  "@supabase/supabase-js": "^2.110.0" // ← mantido
}
```

### 1.3 Arquitetura Atual (whatsapp-web.js)

```
┌─────────────────┐     fetch()      ┌──────────────────────┐     Puppeteer/CDP     ┌─────────────────┐
│  index.html     │ ────────────────→│  server.js (Express)  │ ────────────────────→│  Chrome Headless │
│  (Vercel HTTPS) │←─── JSON ───────│  localhost:3456       │←──── WebSocket ─────│  WhatsApp Web    │
│  whatsapp.html  │                  │  whatsapp-web.js      │                      │                  │
└─────────────────┘                  └──────────────────────┘                      └─────────────────┘
```

**Problemas da arquitetura atual:**
1. **Puppeteer CDP `r: r`** — erro crônico de comunicação Chrome DevTools Protocol
2. **Chrome Headless pesado** — consome RAM, abre processos fantasmas, trava em Windows
3. **Sessão corrompe fácil** — `.wwebjs_auth/` quebra quando Chrome crasha
4. **Multi-sessão impossível** — cada instância = 1 Chrome headless ≈ 300MB RAM
5. **Inicialização lenta** — ~8-15s para conectar

### 1.4 Pontos de Integração no CRM (index.html)

| Onde | O quê | Linha |
|------|-------|-------|
| Sidebar | Link WHATSAPP → `localhost:3456/whatsapp.html` | ~1479 / ~4742 |
| Aba 2 | Botão "Criar Grupo" → `POST /api/criar-grupo` | ~2034 |
| Aba 2 | Botão "Disparar" → clipboard + WhatsApp Desktop | ~2508 |
| Sidebar | Status indicator → `GET /api/status` | ~2100 |

**Essas 21 referências a `localhost:3456` no index.html NÃO precisam ser alteradas** se mantivermos a mesma porta e mesma assinatura de API.

---

## 2. Por Que Migrar para Baileys?

| Comparação | whatsapp-web.js | Baileys |
|-----------|----------------|---------|
| Motor | Puppeteer (Chrome headless) | WebSocket puro |
| RAM por instância | ~200-300MB | ~50-80MB |
| Dependência externa | Chrome instalado | Nenhuma |
| Inicialização | 8-15s | 2-4s |
| Multi-sessão | Impraticável | Nativo (`makeWASocket`) |
| CDP errors | Comum (`r: r`) | Inexistente |
| Persistência de sessão | Arquivos Chrome (quebra fácil) | JSON/arquivo de credenciais |
| Manutenção | whatsapp-web.js v1.x (ativo) | @whiskeysockets/baileys v6.x (ativo) |
| Mensagens em tempo real | Não (polling) | Sim (event listeners nativos) |

**Conclusão:** Baileys resolve todos os problemas atuais e é a escolha correta para o futuro (multi-sessão por analista).

---

## 3. Arquitetura Proposta (Baileys)

```
┌─────────────────┐     fetch()      ┌──────────────────────┐    WebSocket     ┌─────────────────┐
│  index.html     │ ────────────────→│  server.js (Express)  │ ───────────────→│  WhatsApp Web    │
│  (Vercel HTTPS) │←─── JSON ───────│  localhost:3456       │←─── events ────│  (protocolo)     │
│  whatsapp.html  │                  │  @whiskeysockets/     │                 │                  │
│                 │                  │  baileys              │                 │                  │
└─────────────────┘                  └──────────────────────┘                 └─────────────────┘
```

**API endpoints — MESMA assinatura (compatível):**

| Método | Rota | Mantido? |
|--------|------|----------|
| GET | `/api/status` | ✅ Igual — `{ online, numero, qr }` |
| GET | `/api/qr` | ✅ Igual — retorna QR como data URL |
| GET | `/api/chats` | ✅ Igual — lista de conversas |
| GET | `/api/messages/:chatId` | ✅ Igual — mensagens do chat |
| POST | `/api/send` | ✅ Igual — `{ chatId, message }` |
| POST | `/api/criar-grupo` | ✅ Igual — cria grupo |

**Novos endpoints (multi-sessão futura):**

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/connect` | Iniciar conexão de uma nova sessão |
| POST | `/api/disconnect` | Desconectar uma sessão |
| GET | `/api/sessions` | Listar sessões ativas |

---

## 4. Plano de Implementação

### Task 1: Instalar Baileys e remover whatsapp-web.js

```bash
cd C:/Users/Prime04D/crm-uaicred/whatsapp-bot
npm uninstall whatsapp-web.js
npm install @whiskeysockets/baileys@latest
npm install pino  # logger recomendado pelo Baileys
```

**Arquivos:** `package.json`, `package-lock.json`

---

### Task 2: Criar camada de serviço WhatsApp (`whatsapp-bot/whatsapp-service.js`)

**Novo arquivo.** Serviço modular encapsulando toda a lógica do Baileys:

```javascript
// whatsapp-service.js — Camada de serviço Baileys
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

class WhatsAppService {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.sock = null;
    this.qr = null;
    this.connected = false;
    this.numero = null;
    this.onMessage = null; // callback para mensagens recebidas
  }

  async connect() {
    const { state, saveCreds } = await useMultiFileAuthState(`./auth/${this.sessionId}`);
    
    this.sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.qr = qr;
        this.connected = false;
      }
      if (connection === 'open') {
        this.qr = null;
        this.connected = true;
        this.numero = this.sock.user?.id?.split(':')[0] || null;
      }
      if (connection === 'close') {
        this.connected = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) this.connect();
      }
    });

    this.sock.ev.on('messages.upsert', ({ messages }) => {
      if (this.onMessage) {
        messages.forEach(msg => this.onMessage(msg));
      }
    });
  }

  async getChats() { /* ... */ }
  async getMessages(chatId, limit = 100) { /* ... */ }
  async sendMessage(chatId, text) { /* ... */ }
  async createGroup(name, participants) { /* ... */ }
  async disconnect() { /* ... */ }
  getStatus() { return { online: this.connected, numero: this.numero, qr: this.qr }; }
}

module.exports = WhatsAppService;
```

**Por que arquivo separado:** Modularidade, multi-sessão futura, testável.

---

### Task 3: Reescrever `server.js` para usar WhatsAppService

**Modificar** `whatsapp-bot/server.js`. Substituir toda a lógica `whatsapp-web.js` por chamadas ao `WhatsAppService`.

**Principais mudanças:**
- `const wpp = new WhatsAppService('escritorio');`
- `wpp.connect();`
- Todas as rotas `/api/*` chamam `wpp.getChats()`, `wpp.sendMessage()`, etc.
- Reconexão automática via `DisconnectReason.loggedOut`
- QR Code ainda gerado via módulo `qrcode` (mantido)

**API mantém compatibilidade total** — zero mudanças no `index.html`.

---

### Task 4: Atualizar `whatsapp.html` para polling mais rápido e eventos

**Modificar** `whatsapp.html`. Baileys permite notificações mais rápidas:

- Reduzir polling de 3s para 1.5s (opcional, Baileys é mais leve)
- Adicionar indicador de reconexão automática
- Tratar novo formato de erro (sem `r: r`)

---

### Task 5: Adicionar suporte a `whatsapp.html` para múltiplas sessões (futuro)

**Modificar** `whatsapp.html`. Adicionar seletor de sessão no topo, preparando para quando houver WhatsApp por analista.

---

### Task 6: Limpar `.wwebjs_auth/` e migrar sessão

```bash
rm -rf whatsapp-bot/.wwebjs_auth whatsapp-bot/.wwebjs_cache
mkdir -p whatsapp-bot/auth
```

A nova sessão do Baileys fica em `whatsapp-bot/auth/default/` (arquivos JSON).

---

### Task 7: Testar e validar

| Teste | Como verificar |
|-------|---------------|
| QR Code | Abrir `localhost:3456/whatsapp.html` → QR aparece |
| Escanear QR | WhatsApp do escritório → conectar |
| Persistência | Matar e reiniciar server.js → conecta sem QR |
| Listar chats | `/api/chats` retorna conversas |
| Enviar msg | Digitar no whatsapp.html → chega no WhatsApp |
| Receber msg | Enviar do celular → aparece no whatsapp.html |
| Reconexão | Fechar WhatsApp no celular → reconecta sozinho |
| Criar grupo | Botão no CRM → grupo criado |

---

## 5. Resumo de Arquivos

| Arquivo | Ação | Motivo |
|---------|------|--------|
| `whatsapp-bot/whatsapp-service.js` | ✨ **CRIAR** | Camada de serviço modular Baileys |
| `whatsapp-bot/server.js` | ✏️ **REESCREVER** | Substituir whatsapp-web.js por Baileys |
| `whatsapp-bot/package.json` | ✏️ **MODIFICAR** | Trocar dependências |
| `whatsapp.html` | ✏️ **MODIFICAR** | Ajustes leves de integração |
| `index.html` | 🔒 **NÃO MEXER** | Compatibilidade mantida (mesma API) |
| `vercel.json` | 🔒 **NÃO MEXER** | Rotas mantidas |
| `whatsapp-bot/.wwebjs_auth/` | 🗑️ **DELETAR** | Sessão antiga (Chrome) não serve |

---

## 6. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Baileys não suporta `createGroup()` igual | Implementar equivalente via `groupCreate()` do Baileys |
| Formato de mensagens diferente | Adaptar no `whatsapp-service.js`, manter API externa igual |
| Sessão existente perdida | Escanear QR uma vez — sessão persiste em `auth/` |
| WhatsApp banir número | Baileys tem fingerpring idêntico ao WhatsApp Web — risco igual ao whatsapp-web.js |

---

## 7. Vantagens Pós-Migração

1. **Sem Chrome** — zero processos fantasmas, zero `taskkill //F //IM chrome.exe`
2. **Sessão confiável** — arquivos JSON, não database Chrome
3. **Reconexão automática** — built-in no Baileys
4. **Mensagens em tempo real** — event-driven, não polling
5. **Multi-sessão pronto** — `new WhatsAppService('analista-1')`, `new WhatsAppService('analista-2')`
6. **Mais leve** — ~50MB RAM vs 300MB
