# WhatsApp CRM — Estabilização e Implementação Controlada

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Não implementar nada antes da aprovação explícita do Douglas. Usar subagentes por etapa, mas validar cada etapa antes de avançar.

**Goal:** Entregar uma área WhatsApp no CRM que funcione como interface própria do WhatsApp do escritório, sem bot automático, e dois botões na Aba 2: criar grupo padronizado e preparar/enviar mensagem padronizada para o grupo.

**Architecture:** Um único servidor local do escritório roda `whatsapp-bot/server.js` em `localhost:3456`, usando Baileys para conectar ao WhatsApp Web sem Chrome/Puppeteer. A interface `whatsapp.html` é servida pelo próprio servidor local e acessada pelos usuários pela sidebar do CRM em nova aba. A Aba 2 chama endpoints locais para criar grupos e preparar/envios manuais sob clique do usuário.

**Tech Stack:** CRM SPA monolítico `index.html`, página local `whatsapp.html`, Node.js/Express, `@whiskeysockets/baileys`, `qrcode`, Supabase para registrar grupos, Vercel para o CRM estático.

---

## 0. Regras de Execução

1. **Não avançar automaticamente.** Cada etapa precisa ser validada antes da próxima.
2. **Sem bot automático.** Nenhuma resposta automática, nenhum envio sem clique do usuário, nenhum listener que tome decisão sozinho.
3. **Um servidor WhatsApp apenas.** O servidor do escritório representa o número `71 9205-7760`.
4. **Não usar API oficial/Cloud/Business API.** Somente protocolo WhatsApp Web via Baileys.
5. **Não refatorar o CRM.** `index.html` continua monolítico.
6. **Multiagentes obrigatórios.** Usar subagentes para análise/implementação isolada, mas com validação central antes de merge.
7. **Protocolo anti-loop:** se a mesma etapa falhar 3 vezes, parar, não tentar uma 4ª vez, e entregar relatório com:
   - tentativas realizadas;
   - erro exato;
   - arquivos alterados;
   - hipótese raiz;
   - recomendação próxima.

---

## 1. Diagnóstico Atual

### 1.1 O que já existe

Já existe implementação WhatsApp no projeto.

| Arquivo | Estado atual | Função |
|---|---|---|
| `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/package.json` | usa `@whiskeysockets/baileys@^7.0.0-rc13`, `express`, `qrcode`, `pino` | dependências do servidor local |
| `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/server.js` | Express + endpoints `/api/*` | API local do WhatsApp |
| `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/whatsapp-service.js` | serviço Baileys com store manual | conexão, QR, mensagens, grupos |
| `C:/Users/Prime04D/crm-uaicred/whatsapp.html` | interface própria de chat | UI WhatsApp-like |
| `C:/Users/Prime04D/crm-uaicred/index.html` | possui integração sidebar/Aba 2 | entrada do CRM |

### 1.2 Problemas atuais relatados

- QR escaneia e conecta.
- Envio de mensagem funciona.
- Recebimento não aparece corretamente.
- Contatos aparecem desconfigurados.
- Imagens, vídeos e áudios não aparecem.
- Interface parece uma janela de chat, mas não é um WhatsApp funcional completo.

### 1.3 Causa provável

A implementação atual do Baileys v7 usa **store manual em memória**:

- `messages.upsert` popula apenas mensagens novas, não histórico completo.
- `contacts.upsert` pode não popular contatos antigos imediatamente.
- `groups.upsert` pode não popular todos os grupos existentes.
- `_extractText()` só trata texto/caption simples.
- `_hasMedia()` detecta mídia, mas não baixa nem entrega `dataUrl`/arquivo para o frontend.
- `whatsapp.html` renderiza bolhas textuais, mas não possui renderização real para imagem/vídeo/áudio/documento.

Ou seja: a conexão está funcionando, mas a camada de dados e UI ainda não é equivalente a um WhatsApp utilizável.

---

## 2. Objetivo Funcional Final

### 2.1 Sidebar WhatsApp

Usuário clica na sidebar do CRM em **WHATSAPP** e abre uma nova aba:

```text
http://localhost:3456/whatsapp.html
```

Essa página deve permitir acesso livre ao WhatsApp do escritório:

- ver lista de conversas;
- buscar conversas;
- abrir conversa;
- ver mensagens recebidas e enviadas;
- enviar mensagem manualmente;
- ver imagens, vídeos, áudios e documentos;
- sem bot respondendo automaticamente;
- sem automação fora de cliques explícitos.

### 2.2 Aba 2 — Criar Grupo

Usuário clica em botão na Aba 2. O sistema deve:

1. abrir o WhatsApp/ação via servidor local;
2. criar grupo com nome padronizado;
3. definir foto padronizada (`logo-p.png`);
4. inserir sempre os 3 fixos;
5. tentar inserir mais 2 números informados na hora;
6. se não conseguir inserir os 2 números, enviar o link do convite para eles via WhatsApp;
7. salvar `gid` e link do grupo para uso posterior.

### 2.3 Aba 2 — Mensagem Padronizada

Segundo botão na Aba 2:

- se grupo localizado: preparar/enviar mensagem padronizada no grupo criado;
- se grupo não localizado: copiar mensagem padronizada para a área de transferência e permitir que o usuário envie onde quiser;
- envio automático apenas se o usuário clicar no botão dedicado e confirmar.

---

## 3. Estratégia com Multiagentes

Na execução, usar 3 subagentes por etapa crítica:

### Agente A — Backend/Baileys

Responsável por:
- `whatsapp-bot/whatsapp-service.js`;
- `whatsapp-bot/server.js`;
- conexão, QR, sessão, recebimento, envio, mídia, grupos.

### Agente B — Frontend/Interface WhatsApp

Responsável por:
- `whatsapp.html`;
- renderização da lista de chats;
- renderização de mensagens;
- imagem/vídeo/áudio/documento;
- estado online/offline/QR/erro.

### Agente C — Integração CRM/Aba 2

Responsável por:
- `index.html`;
- sidebar;
- botões da Aba 2;
- integração com Supabase `whatsapp_grupos`;
- fallback para clipboard/WhatsApp Desktop.

**Regra:** os subagentes podem propor alterações, mas o agente principal valida cada etapa antes de aplicar/seguir.

---

## 4. Plano por Etapas com Gates de Validação

## Etapa 1 — Congelar Escopo e Estado Atual

**Objetivo:** registrar o estado atual antes de mexer em código.

**Arquivos:** nenhum alterado além de logs/plano.

**Passos:**
1. Rodar somente comandos read-only:
   ```bash
   cd /c/Users/Prime04D/crm-uaicred
   git status --short
   git diff -- index.html whatsapp.html whatsapp-bot/server.js whatsapp-bot/whatsapp-service.js whatsapp-bot/package.json
   ```
2. Capturar estado dos endpoints:
   ```bash
   curl -s http://localhost:3456/api/status
   curl -s http://localhost:3456/api/chats
   ```
3. Salvar evidência do problema atual: chats vazios/desconfigurados, mensagens sem mídia, contatos sem nome.

**Validação para avançar:**
- Confirmar quais arquivos estão modificados.
- Confirmar se o servidor atual conecta.
- Confirmar exatamente quais endpoints falham ou retornam dados incompletos.

**Rollback:** nenhum.

---

## Etapa 2 — Contrato de API Estável

**Objetivo:** definir um formato de dados único entre backend e frontend.

**Arquivos a modificar:**
- `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/whatsapp-service.js`
- `C:/Users/Prime04D/crm-uaicred/whatsapp-bot/server.js`
- `C:/Users/Prime04D/crm-uaicred/whatsapp.html`

**Contrato esperado:**

### `GET /api/status`
```json
{
  "online": true,
  "numero": "557192057760",
  "qr": null,
  "status": "connected"
}
```

### `GET /api/chats`
```json
[
  {
    "id": "5571999999999@s.whatsapp.net",
    "name": "Nome do Contato",
    "phone": "5571999999999",
    "isGroup": false,
    "timestamp": 1780000000000,
    "unreadCount": 1,
    "lastMessage": "Texto da última mensagem",
    "avatarUrl": null
  }
]
```

### `GET /api/messages/:chatId`
```json
[
  {
    "id": "MSG_ID",
    "chatId": "5571999999999@s.whatsapp.net",
    "fromMe": false,
    "author": null,
    "authorName": "Nome",
    "timestamp": 1780000000000,
    "type": "text",
    "body": "Olá",
    "hasMedia": false,
    "media": null
  }
]
```

### Mensagem com mídia
```json
{
  "id": "MSG_ID",
  "chatId": "5571999999999@s.whatsapp.net",
  "fromMe": false,
  "timestamp": 1780000000000,
  "type": "image",
  "body": "Legenda opcional",
  "hasMedia": true,
  "media": {
    "mimetype": "image/jpeg",
    "filename": "imagem.jpg",
    "dataUrl": "data:image/jpeg;base64,..."
  }
}
```

**Validação para avançar:**
- Frontend e backend concordam com os campos.
- Nenhum campo obrigatório ausente.
- Mídia tem representação clara.

---

## Etapa 3 — Corrigir Store de Chats e Contatos

**Objetivo:** chats e contatos aparecerem com nomes corretos e lista utilizável.

**Arquivos:**
- `whatsapp-bot/whatsapp-service.js`

**Implementação provável:**
1. Criar cache manual robusto:
   - `this._chats`
   - `this._messages`
   - `this._contacts`
   - `this._groups`
2. Popular nomes por prioridade:
   ```js
   name = group.subject || contact.name || contact.notify || contact.verifiedName || phone || jid
   ```
3. Normalizar JID:
   - `@s.whatsapp.net` para contatos;
   - `@g.us` para grupos.
4. No `messages.upsert`, criar/atualizar chat mesmo se contato não veio ainda.
5. No `contacts.upsert`, atualizar chat existente.
6. No `groups.upsert`, atualizar chat existente.
7. Ordenar chats por última mensagem.

**Teste:**
```bash
curl -s http://localhost:3456/api/chats
```

**Validação para avançar:**
- Ao receber uma mensagem nova, chat aparece na lista.
- Nome não aparece apenas como JID se houver contato disponível.
- Grupos aparecem como grupo.
- Última mensagem aparece correta.

**Loop policy:** se após 3 tentativas contatos históricos ainda não carregarem, aceitar como limitação do Baileys v7 e registrar fallback: carregar conversas conforme novas mensagens chegam + botão manual “Nova conversa”.

---

## Etapa 4 — Corrigir Recebimento em Tempo Real

**Objetivo:** mensagem enviada para o número do escritório aparece na interface sem recarregar manualmente.

**Arquivos:**
- `whatsapp-bot/whatsapp-service.js`
- `whatsapp.html`

**Abordagem preferida:** Server-Sent Events (SSE), sem complexidade de WebSocket próprio.

**Novo endpoint:**
```text
GET /api/events
```

**Backend:**
- manter lista de clientes SSE;
- em `messages.upsert`, emitir:
  ```json
  { "type": "message", "chatId": "...", "message": {...} }
  ```
- em `contacts.upsert`, emitir:
  ```json
  { "type": "chats_updated" }
  ```

**Frontend:**
- criar `new EventSource('/api/events')`;
- ao receber `message`, atualizar conversa aberta;
- ao receber `chats_updated`, recarregar lista;
- manter polling como fallback.

**Validação para avançar:**
- Enviar mensagem de outro celular para o WhatsApp do escritório.
- A mensagem aparece em até 2 segundos na interface.
- Sem reload manual.

---

## Etapa 5 — Suporte Real a Imagem, Vídeo, Áudio e Documento

**Objetivo:** mídia recebida aparece na interface.

**Arquivos:**
- `whatsapp-bot/whatsapp-service.js`
- `whatsapp-bot/server.js`
- `whatsapp.html`

**Backend:**
1. Usar `downloadMediaMessage` do Baileys quando `msg.message` tiver:
   - `imageMessage`
   - `videoMessage`
   - `audioMessage`
   - `documentMessage`
2. Converter para `dataUrl` para POC inicial:
   ```js
   dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`
   ```
3. Limitar tamanho máximo para evitar travar UI:
   - imagens: até 5MB;
   - vídeos: até 20MB;
   - áudios: até 10MB;
   - documentos: até 20MB.
4. Se exceder limite, retornar placeholder:
   ```json
   { "tooLarge": true, "mimetype": "video/mp4" }
   ```

**Frontend render:**
- `image/*` → `<img>`
- `video/*` → `<video controls>`
- `audio/*` → `<audio controls>`
- documento → botão/link download

**Validação para avançar:**
- Receber imagem e ver imagem.
- Receber vídeo e conseguir reproduzir.
- Receber áudio e conseguir reproduzir.
- Receber documento e ver card/baixar.

---

## Etapa 6 — Interface WhatsApp Própria Utilizável

**Objetivo:** deixar `whatsapp.html` funcionando como central básica do WhatsApp do escritório.

**Arquivos:**
- `whatsapp.html`

**Funcionalidades:**
1. Estado QR/offline/online/erro claro.
2. Lista de chats com busca.
3. Chat aberto com mensagens em tempo real.
4. Envio manual de texto.
5. Renderização de mídia.
6. Botão “Nova conversa”:
   - usuário digita telefone;
   - abre chat `55DDDNUMERO@s.whatsapp.net`;
   - permite enviar mensagem manual.
7. Nenhum envio automático.
8. Nenhum bot.

**Validação para avançar:**
- Usuário consegue conversar manualmente com número externo.
- Mensagem recebida aparece.
- Mídia aparece.
- UX não mostra “bot” em nenhum texto.

---

## Etapa 7 — Sidebar no CRM

**Objetivo:** sidebar abre o WhatsApp do escritório em nova aba.

**Arquivo:**
- `index.html`

**Comportamento desejado:**
```js
window.open('http://localhost:3456/whatsapp.html', '_blank');
```

**Regras:**
- Não abrir `web.whatsapp.com`.
- Não iframe.
- Não embutir WhatsApp dentro do Vercel.
- Link visível para todos os usuários autorizados.
- Se servidor offline, exibir mensagem simples na página `whatsapp.html`.

**Validação para avançar:**
- Clicar no botão WHATSAPP no CRM abre `http://localhost:3456/whatsapp.html`.
- Abre em nova aba.
- Usuário logado normal também vê o botão.

---

## Etapa 8 — Aba 2: Criar Grupo Padronizado

**Objetivo:** botão “Criar Grupo” executa a criação controlada do grupo.

**Arquivos:**
- `whatsapp-bot/server.js`
- `whatsapp-bot/whatsapp-service.js`
- `index.html`

**Backend endpoint:**
```text
POST /api/criar-grupo
```

**Payload:**
```json
{
  "cliente": "5571999999999",
  "corretor": "5571988888888",
  "nomeCliente": "JOAO SILVA",
  "nomeCorretor": "MARIA",
  "clienteId": 123
}
```

**Fluxo:**
1. `nomeGrupo = FINANCIAMENTO ${primeiroNome} ${sobrenome}`.
2. Criar grupo com 3 fixos.
3. Definir foto `logo-p.png`.
4. Gerar link convite.
5. Tentar adicionar corretor.
6. Se falhar, enviar link por DM para corretor.
7. Tentar adicionar cliente.
8. Se falhar, enviar link por DM para cliente; se também falhar, enviar para corretor.
9. Salvar `gid`, `link`, `cliente_id`, `subject` no Supabase.
10. Retornar sucesso ao CRM.

**Ponto importante:** isso é uma ação solicitada pelo clique do usuário. Não é bot automático.

**Validação para avançar:**
- Grupo criado.
- Nome correto.
- Foto aplicada ou erro tratado.
- 3 fixos inseridos.
- Dois convidados adicionados ou link enviado.
- Link salvo no Supabase.

---

## Etapa 9 — Aba 2: Mensagem Padronizada para Grupo

**Objetivo:** segundo botão prepara/enviar mensagem padronizada.

**Arquivos:**
- `index.html`
- opcional: `whatsapp-bot/server.js`

**Fluxo desejado:**
1. Buscar grupo vinculado ao cliente em `whatsapp_grupos`.
2. Se encontrou `gid`:
   - exibir confirmação;
   - ao confirmar, `POST /api/enviar-mensagem-grupo`.
3. Se encontrou apenas `link_convite`:
   - copiar mensagem para clipboard;
   - abrir link do grupo.
4. Se não encontrou grupo:
   - copiar mensagem para clipboard;
   - abrir WhatsApp Desktop/chat individual quando houver telefone;
   - avisar usuário para colar onde quiser.

**Validação para avançar:**
- Mensagem chega no grupo quando existe `gid`.
- Quando não existe grupo, mensagem fica copiada.
- Usuário não perde controle da ação.

---

## Etapa 10 — Persistência, Reconexão e Multi-sessão futura

**Objetivo:** garantir que o servidor continue funcionando após reiniciar.

**Arquivos:**
- `whatsapp-bot/whatsapp-service.js`
- `whatsapp-bot/server.js`
- `.gitignore`
- `.vercelignore`

**Regras:**
- sessão em `whatsapp-bot/auth/escritorio/`;
- nunca commitar `auth/`;
- reconectar automaticamente se conexão cair;
- se `loggedOut`, pedir novo QR;
- estrutura preparada para `new WhatsAppService(sessionId)` no futuro.

**Validação:**
```bash
# iniciar, escanear QR, conectar
# parar servidor
# iniciar novamente
# esperado: online sem QR novo
curl -s http://localhost:3456/api/status
```

---

## Etapa 11 — Testes Finais

### Testes obrigatórios

1. **QR Code**
   - limpar sessão de teste;
   - iniciar servidor;
   - QR aparece;
   - escanear;
   - status muda para conectado.

2. **Persistência**
   - reiniciar servidor;
   - não pedir QR novamente.

3. **Recebimento**
   - enviar mensagem de outro celular;
   - aparece na UI em até 2s.

4. **Envio**
   - enviar mensagem pela UI;
   - chega no WhatsApp externo.

5. **Mídia**
   - receber imagem;
   - receber vídeo;
   - receber áudio;
   - receber documento.

6. **Criar grupo**
   - criar grupo teste;
   - validar nome, foto, membros, link.

7. **Mensagem padronizada**
   - enviar para grupo localizado;
   - fallback clipboard quando grupo não localizado.

8. **Sem bot**
   - enviar mensagem para o escritório sem qualquer ação do usuário;
   - sistema deve apenas exibir a mensagem, não responder.

---

## 5. Arquivos Prováveis

### Criados

Nenhum novo arquivo obrigatório além dos já existentes. Opcionalmente, se necessário:

| Arquivo | Motivo |
|---|---|
| `whatsapp-bot/media-cache/` | cache local temporário de mídia se data URL ficar pesado |
| `whatsapp-bot/services/whatsapp-service.js` | somente se decidir organizar; preferir manter arquivo atual para não refatorar demais |

### Modificados

| Arquivo | Motivo |
|---|---|
| `whatsapp-bot/whatsapp-service.js` | corrigir store, contatos, recebimento, mídia e reconexão |
| `whatsapp-bot/server.js` | endpoints SSE, mídia, grupo e status robusto |
| `whatsapp.html` | renderizar chats, mensagens em tempo real e mídia |
| `index.html` | sidebar e botões da Aba 2, mantendo SPA monolítico |
| `whatsapp-bot/package.json` | ajustar versão Baileys se necessário |
| `.gitignore` | garantir `whatsapp-bot/auth/` e cache fora do git |
| `.vercelignore` | garantir `node_modules`, auth e cache fora do deploy |

---

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Baileys v7 não fornece histórico completo automaticamente | Aceitar POC com novas mensagens + botão Nova conversa; investigar history sync em etapa separada |
| Mídia grande pesa no JSON | usar limite e/ou endpoint `/api/media/:id` com cache local |
| WhatsApp limita criação/adicionar membros | fallback por link convite enviado manualmente/DM |
| Sessão corrompida | apagar `auth/escritorio/` e novo QR |
| Número banido por automação | manter tudo sob clique manual e evitar envios em massa |
| HTTPS do Vercel bloqueia HTTP local | abrir `whatsapp.html` diretamente no servidor local |

---

## 7. Critério de Conclusão

A implementação só será considerada concluída quando:

- sidebar abrir a UI local do WhatsApp;
- UI enviar e receber mensagens;
- contatos/grupos ficarem minimamente legíveis;
- imagem/vídeo/áudio renderizarem;
- criar grupo funcionar;
- mensagem padronizada funcionar com grupo e fallback;
- reiniciar servidor não pedir QR novamente;
- nenhuma resposta automática for enviada;
- commit, push e deploy forem feitos somente após validação final.

---

## 8. Próxima Ação Recomendada

Quando o Douglas aprovar a execução:

1. iniciar **Etapa 1** apenas;
2. usar subagentes para diagnóstico separado;
3. validar evidências;
4. só então avançar para a Etapa 2.

Nada deve ser implementado antes dessa aprovação.
