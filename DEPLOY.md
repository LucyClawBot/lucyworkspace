# 🚀 LucyWorkspace — Implementación Completa VoxYZ

**URL:** `https://lucyworkspace.vercel.app`  
**Contraseña:** `LucyClawBot`  
**CEO:** Lucy (ejecución directa)  
**Equipo:** 6 agentes (Minion, Sage, Scout, Quill, Xalt, Observer)

---

## ✅ Arquitectura Implementada

### Closed Loop Completo
```
Proposal → Cap Gates → Auto-Approve → Mission + Steps → Worker → Event → Trigger → Reaction → New Proposal
```

### Pitfalls Evitados
1. ✅ **VPS único executor** — Vercel solo control plane, no ejecuta steps
2. ✅ **Proposal service unificado** — Triggers usan `createProposalAndMaybeAutoApprove`
3. ✅ **Cap Gates** — Rechazo en entrada, no acumulación en cola

### Features Implementadas
- **6 Agentes autónomos** con roles definidos
- **Reaction Matrix** con probabilidad (no 100% determinista)
- **Triggers con cooldown** (evita spam)
- **Self-healing** (recupera steps stuck)
- **Cap Gates** (cuotas por agente/tipo)

---

## 🚀 Deploy (10 minutos)

### 1. Supabase Schema
Ve a: `https://supabase.com/dashboard/project/ddszgovshrmpaavmrkpo/sql`

Copia y pega todo `supabase-setup.sql` → Click **Run**

### 2. Variables de Entorno (Vercel)
Dashboard → Settings → Environment Variables:

```
SUPABASE_URL = (tu URL de Supabase)
SUPABASE_SERVICE_KEY = (tu service key de Supabase)
HEARTBEAT_SECRET = (inventa un secreto largo)
```

### 3. Deploy
```bash
cd /Users/lucy/.openclaw/workspace/lucyworkspace
vercel --prod
```

O conecta el repo GitHub en `vercel.com/new`

### 4. Configurar Dominio
Settings → Domains → Add `lucyworkspace.vercel.app`

### 5. Worker Local (Tu Mac)
```bash
# Añade a ~/.zshrc:
export SUPABASE_URL="(tu URL de Supabase)"
export SUPABASE_KEY="(tu service key de Supabase)"
export WORKER_ID="lucy-macbook"

# Recarga:
source ~/.zshrc

# Corre worker:
./worker.sh
```

Para background (screen/tmux):
```bash
screen -S lucy-worker
./worker.sh
# Ctrl+A, D
```

### 6. Cron Heartbeat
```bash
crontab -e

# Añade (cambia EL_SECRETO por tu HEARTBEAT_SECRET):
*/5 * * * * curl -s -H "Authorization: Bearer EL_SECRETO" https://lucyworkspace.vercel.app/api/ops/heartbeat > /dev/null 2>&1
```

---

## 📊 Estructura del Sistema

```
lucyworkspace/
├── middleware.js              # Protección contraseña
├── pages/
│   ├── index.js              # Dashboard CEO + 6 agentes
│   ├── login.js              # Login
│   └── api/ops/
│       ├── heartbeat.js      # 4 funciones (triggers, reactions, recovery, health)
│       ├── proposal.js       # Crear propuestas
│       └── status.js         # Estado completo
├── lib/
│   ├── proposal-service.js   # ONE FILE TO RULE THEM ALL
│   ├── trigger-evaluator.js  # Triggers con cooldown
│   ├── reaction-matrix.js    # Reacciones probabilísticas
│   ├── self-healing.js       # Recuperación automática
│   └── agents.js             # Definición de 6 agentes
├── worker.sh                 # VPS Worker (ejecutor)
├── supabase-setup.sql        # Schema completo
└── README.md
```

---

## 👥 Agentes

| Agente | Rol | Estado | Capacidades |
|--------|-----|--------|-------------|
| 💼 **Lucy** | CEO | **Activa** | Override total. Todas las capacidades. |
| 👑 **Minion** | Decision Maker | Standby | make_decision, approve_proposal |
| 🧠 **Sage** | Strategic Analyst | Standby | strategic_analysis, diagnose_failure |
| 🔭 **Scout** | Intel Gatherer | Standby | gather_intel, crawl, analyze_viral |
| ✍️ **Quill** | Content Writer | Standby | write_content, draft_tweet |
| 📱 **Xalt** | Social Media | Standby | post_tweet, analyze_engagement |
| 👁️ **Observer** | Quality Checker | Standby | review_content, quality_check |

---

## 🔄 Flujo de Trabajo

### Triggers Automáticos (con cooldown)
- Tweet viral (>5% engagement) → Scout analiza (2h cooldown)
- Mission falla → Sage diagnostica (1h cooldown)
- Contenido publicado → Observer revisa (2h cooldown)

### Reaction Matrix (probabilística)
- Xalt postea tweet → 30% chance Scout analiza
- Mission falla → 100% chance Sage diagnostica
- Quill publica → 50% chance Observer revisa

### Cap Gates (rechazo temprano)
- Daily tweet quota: 8
- Draft quota: 20
- Content quota: 5
- Crawl quota: 20/hora

---

## 🛠️ Comandos Útiles

### Ver estado
```bash
curl https://lucyworkspace.vercel.app/api/ops/status
```

### Crear propuesta manual
```bash
curl -X POST https://lucyworkspace.vercel.app/api/ops/proposal \
  -H "Content-Type: application/json" \
  -d '{"agent":"scout","action":"gather_intel","params":{"topic":"AI"}}'
```

### Trigger heartbeat manual
```bash
curl -H "Authorization: Bearer TU_HEARTBEAT_SECRET" \
  https://lucyworkspace.vercel.app/api/ops/heartbeat
```

---

## 📈 Próximos Pasos (cuando digas)

1. **Activar agentes** — Asignar funciones al asistente/delegado
2. **Integrar Twitter** — Conectar Xalt a API de X
3. **Modo "mientras duermes"** — Tareas autónomas nocturnas
4. **Vitrina pública** — Tips/donaciones, dashboard público
5. **Roundtable** — Discusiones entre agentes antes de decisiones

---

**Token-optimized** | **Kimi K2.5 ready** | **VoxYZ architecture**
