// whatsapp-service.js — Baileys v7 com store + mídia + nomes
const { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, makeInMemoryStore, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

class WhatsAppService {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.sock = null;
    this.store = null;  // nativo v6, null no v7
    this.qr = null;
    this.connected = false;
    this.numero = null;
    this.onMessage = null;
    this.authFolder = path.join(__dirname, 'auth', sessionId);

    // Store manual
    this._chats = new Map();
    this._messages = new Map();
    this._contacts = {}; // jid → {name, notify, verifiedName}
  }

  async connect() {
    const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

    // Tentar store nativo (só v6)
    try { this.store = makeInMemoryStore({ logger: pino({ level: 'silent' }) }); } catch (e) { this.store = null; }

    this.sock = makeWASocket({
      auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: false,
    });

    if (this.store) this.store.bind(this.sock.ev);
    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) { this.qr = qr; this.connected = false; console.log('[Baileys] QR pronto'); }
      if (connection === 'open') {
        this.qr = null; this.connected = true;
        this.numero = this.sock.user?.id?.split(':')[0] || null;
        console.log('[Baileys] ✅ Conectado!', this.numero);
        // Buscar metadados de grupos após conectar
        setTimeout(() => this._fetchGroupMetadata(), 3000);
      }
      if (connection === 'close') {
        const sc = lastDisconnect?.error?.output?.statusCode;
        this.connected = false; this.qr = null;
        if (sc !== DisconnectReason.loggedOut) {
          console.log('[Baileys] 🔄 Reconectando...');
          setTimeout(() => this.connect(), 3000);
        }
      }
    });

    // messages.upsert → store + callback
    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!messages) return;
      for (const msg of messages) {
        const jid = msg.key.remoteJid;
        if (!jid) continue;

        const body = this._extractText(msg.message);
        const ts = (msg.messageTimestamp || 0) * 1000;
        const hasMedia = this._hasMedia(msg.message);

        // Download mídia
        let media = null;
        if (hasMedia) {
          try {
            const buf = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }) });
            const mimetype = this._mediaMime(msg.message);
            if (buf && buf.length < 15 * 1024 * 1024) { // 15MB max
              media = { mimetype, dataUrl: `data:${mimetype};base64,${buf.toString('base64')}` };
            } else if (buf) {
              media = { mimetype, tooLarge: true };
            }
          } catch (e) {}
        }

        // Guardar mensagem
        if (!this._messages.has(jid)) this._messages.set(jid, []);
        const arr = this._messages.get(jid);
        arr.push({
          id: msg.key.id, body, from: jid, fromMe: !!msg.key.fromMe,
          author: msg.key.participant || null,
          authorName: msg.key.participant ? this._contactName(msg.key.participant) : null,
          timestamp: ts, hasMedia, media,
          type: Object.keys(msg.message || {})[0] || 'unknown',
        });
        if (arr.length > 300) arr.shift();

        // Atualizar chat
        const pushName = msg.pushName || null;
        const updates = {
          timestamp: ts,
          lastMessage: body?.slice(0, 80) || (hasMedia ? this._mediaLabel(Object.keys(msg.message||{})[0]) : null),
          unreadCount: msg.key.fromMe ? undefined : (this._chats.get(jid)?.unreadCount || 0) + 1,
        };
        // Usar pushName como nome do chat se ainda não tiver nome real
        if (pushName && !msg.key.fromMe) {
          const existing = this._chats.get(jid);
          if (!existing || !existing.name || existing.name.match(/^\d{5,}$/)) {
            updates.name = pushName;
          }
        }
        this._chatUpsert(jid, updates);

        // Callback
        if (this.onMessage) try { this.onMessage(msg); } catch (e) {}
      }
    });

    // contacts.upsert → guardar nomes
    this.sock.ev.on('contacts.upsert', contacts => {
      for (const c of contacts) {
        this._contacts[c.id] = { name: c.name, notify: c.notify, verifiedName: c.verifiedName };
        this._chatUpsert(c.id, {
          name: c.name || c.notify || c.verifiedName || this._chats.get(c.id)?.name,
          isGroup: false,
        });
      }
    });

    // groups.upsert / groups.update (v7 pode usar nomes diferentes)
    this.sock.ev.on('groups.upsert', groups => {
      for (const g of groups) {
        this._chatUpsert(g.id, { name: g.subject, isGroup: true });
      }
    });
    this.sock.ev.on('groups.update', groups => {
      for (const g of groups) {
        this._chatUpsert(g.id, { name: g.subject, isGroup: true });
      }
    });
    // chats.upsert — carrega metadados de chats existentes
    this.sock.ev.on('chats.upsert', chats => {
      for (const c of chats) {
        this._chatUpsert(c.id, {
          name: c.name || this._chats.get(c.id)?.name,
          isGroup: c.id.endsWith('@g.us'),
        });
      }
    });
    this.sock.ev.on('chats.update', chats => {
      for (const c of chats) {
        this._chatUpsert(c.id, {
          name: c.name || this._chats.get(c.id)?.name,
          isGroup: c.id.endsWith('@g.us'),
        });
      }
    });
  }

  // ===== HELPERS =====
  async _fetchGroupMetadata() {
    if (!this.sock) return;
    try {
      const groups = await this.sock.groupFetchAllParticipating();
      if (groups) {
        for (const [id, g] of Object.entries(groups)) {
          // Debug: primeiras 2 entradas
          if (Object.keys(groups).indexOf(id) < 2) {
            console.log('[Debug] Grupo:', JSON.stringify({ id, subject: g.subject, name: g.name, title: g.title }).slice(0, 200));
          }
          const nome = g.subject || g.name || g.title;
          if (nome) {
            this._chatUpsert(id, {
              name: nome,
              isGroup: true,
              timestamp: g.creation * 1000 || this._chats.get(id)?.timestamp || Date.now(),
            });
          }
        }
        console.log(`[Baileys] ${Object.keys(groups).length} grupos carregados`);
      }
    } catch (e) {
      console.log('[Baileys] Erro ao buscar grupos:', e.message);
    }
  }

  _chatUpsert(jid, updates) {
    const existing = this._chats.get(jid) || { id: jid, name: this._jidToName(jid), isGroup: jid.endsWith('@g.us'), timestamp: 0, unreadCount: 0, lastMessage: null };
    // Só sobrescreve name se o update trouxer um nome não-JID
    if (updates.name && !updates.name.match(/^\d+(@|$)/) && updates.name !== jid.split('@')[0]) {
      existing.name = updates.name;
    }
    Object.assign(existing, updates);
    existing.id = jid;
    // Garantir que o nome nunca fique como JID cru
    if (!existing.name || existing.name.match(/^\d{10,}@/)) {
      existing.name = this._jidToName(jid);
    }
    this._chats.set(jid, existing);
  }

  _jidToName(jid) {
    if (!jid) return 'Desconhecido';
    if (jid.endsWith('@g.us')) return 'Grupo';
    if (jid.endsWith('@s.whatsapp.net')) return jid.split('@')[0];
    if (jid.endsWith('@lid')) return jid.split('@')[0];
    return jid.split('@')[0];
  }

  _contactName(jid) {
    const c = this._contacts[jid];
    if (c) return c.name || c.notify || c.verifiedName || jid.split('@')[0];
    return jid.split('@')[0];
  }

  _extractText(msg) {
    if (!msg) return null;
    return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || msg.documentMessage?.caption || '';
  }

  _hasMedia(msg) {
    return !!(msg?.imageMessage || msg?.videoMessage || msg?.audioMessage || msg?.documentMessage || msg?.stickerMessage);
  }

  _mediaMime(msg) {
    const m = msg?.imageMessage || msg?.videoMessage || msg?.audioMessage || msg?.documentMessage || msg?.stickerMessage;
    return m?.mimetype || 'application/octet-stream';
  }

  _mediaLabel(type) {
    const m = { imageMessage: '📷 Imagem', videoMessage: '🎬 Vídeo', audioMessage: '🎤 Áudio', documentMessage: '📄 Documento', stickerMessage: '😀 Figurinha' };
    return m[type] || '📎 Mídia';
  }

  // ===== PUBLIC API =====
  getStatus() {
    return { online: this.connected, numero: this.numero, qr: this.qr || null };
  }

  async getChats() {
    if (this.store?.chats?.all) {
      const raw = await this.store.chats.all();
      return raw.map(c => ({
        id: c.id, name: c.name || c.id.split('@')[0],
        isGroup: c.id.endsWith('@g.us'), timestamp: c.conversationTimestamp || 0,
        unreadCount: c.unreadCount || 0, lastMessage: this._extractText(c.lastMessage?.message),
      }));
    }
    const result = [];
    for (const [, c] of this._chats) { result.push({ ...c }); }
    return result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async getMessages(chatId, limit = 100) {
    if (this.store?.loadMessages) {
      const raw = await this.store.loadMessages(chatId, limit);
      return raw.map(m => ({
        id: m.key.id, body: this._extractText(m.message),
        from: m.key.remoteJid, fromMe: !!m.key.fromMe,
        author: m.key.participant || null, authorName: m.key.participant ? this._contactName(m.key.participant) : null,
        timestamp: (m.messageTimestamp || 0) * 1000,
        hasMedia: this._hasMedia(m.message),
        type: Object.keys(m.message || {})[0] || 'unknown',
      }));
    }
    const arr = this._messages.get(chatId) || [];
    return arr.slice(-limit);
  }

  async sendMessage(chatId, text) {
    if (!this.sock) throw new Error('Não conectado');
    const msg = await this.sock.sendMessage(chatId, { text });
    return { id: msg.key.id };
  }

  async createGroup(name, participants) {
    if (!this.sock) throw new Error('Não conectado');
    const group = await this.sock.groupCreate(name, participants);
    return { gid: group.id || group.gid, name };
  }

  async setGroupPicture(groupId, imagePath) {
    const fs = require('fs');
    if (!fs.existsSync(imagePath)) return false;
    if (this.sock.updateProfilePicture) {
      await this.sock.updateProfilePicture(groupId, { url: imagePath });
    }
    return true;
  }

  async getGroupInviteCode(groupId) {
    const code = await this.sock.groupInviteCode(groupId);
    return `https://chat.whatsapp.com/${code}`;
  }

  async addParticipants(groupId, participants) {
    await this.sock.groupParticipantsUpdate(groupId, participants, 'add');
  }

  async disconnect() {
    if (this.sock) { await this.sock.logout(); this.sock = null; }
    this.connected = false;
  }
}

module.exports = WhatsAppService;
