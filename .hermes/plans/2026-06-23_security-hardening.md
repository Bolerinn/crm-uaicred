# Security Hardening — Rate Limiting + HTTPS Headers

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Elevar segurança do CRM de 7/10 para 9/10 com rate limiting no Supabase e headers HTTP de segurança no Vercel.

**Architecture:** Vercel (`vercel.json`) para headers HTTP + Supabase trigger para rate limiting de operações.

**Tech Stack:** Supabase PostgreSQL (trigger/function), Vercel config JSON

**Current state:** HSTS já ativo. Faltam CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, e proteção contra abuso de API.

---

## Task 1: Criar `vercel.json` com headers de segurança

**Objective:** Adicionar headers HTTP de segurança a todas as respostas do Vercel.

**Files:**
- Create: `C:\Users\Prime04D\crm-uaicred\vercel.json`

### Step 1: Criar o arquivo

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self' https://dztiktcvueorlafiocdf.supabase.co https://cdn.tailwindcss.com https://cdn.sheetjs.com https://cdn.jsdelivr.net; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.sheetjs.com https://cdn.jsdelivr.net https://dztiktcvueorlafiocdf.supabase.co; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self' https://dztiktcvueorlafiocdf.supabase.co wss://dztiktcvueorlafiocdf.supabase.co; font-src 'self'"
        }
      ]
    }
  ]
}
```

### Step 2: Verificar

Após deploy, `curl -sI https://crm-uaicred.vercel.app | grep -i "content-security\|x-frame\|x-content\|referrer"` deve retornar os headers.

### Step 3: Commit

```bash
git add vercel.json
git commit -m "security: headers HTTP de seguranca no Vercel"
```

---

## Task 2: Rate limiting via Supabase trigger

**Objective:** Impedir que um usuário faça mais de 50 inserts/updates por hora, prevenindo abuso.

**Files:**
- Create: `C:\Users\Prime04D\crm-uaicred\supabase\rate-limit.sql`

### Step 1: Criar tabela de rate limit

```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rate_limits_user_ts ON rate_limits(user_id, timestamp);
```

### Step 2: Criar função de verificação

```sql
CREATE OR REPLACE FUNCTION check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM rate_limits
  WHERE user_id = auth.uid()
    AND action = TG_OP
    AND timestamp > now() - interval '1 hour';

  IF recent_count > 50 THEN
    RAISE EXCEPTION 'Rate limit exceeded: max 50 operações por hora';
  END IF;

  INSERT INTO rate_limits (user_id, action) VALUES (auth.uid(), TG_OP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: Criar triggers

```sql
CREATE TRIGGER rate_limit_insert
  BEFORE INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();

CREATE TRIGGER rate_limit_update
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION check_rate_limit();
```

### Step 4: Rodar SQL

Executar o arquivo no SQL Editor do Supabase.

### Step 5: Commit do arquivo SQL

```bash
git add supabase/rate-limit.sql
git commit -m "security: rate limiting trigger no Supabase"
```

---

## Task 3: Push + Deploy

```bash
git push
npx vercel --prod --token VERCEL_TOKEN --yes
```

---

## Resumo da nota final

| Controle | Antes | Depois |
|----------|-------|--------|
| Service role exposta | ❌ 0/10 | ✅ 10/10 |
| HTTPS (HSTS) | ✅ | ✅ |
| CSP / X-Frame / X-Content | ❌ | ✅ |
| Rate limiting | ❌ | ✅ |
| **Nota final** | **3/10** | **9/10** |

Faltaria pra 10/10: autenticação 2FA, auditoria de acessos, e Supabase HIPAA/enterprise — mas isso é overkill pra um CRM interno.
