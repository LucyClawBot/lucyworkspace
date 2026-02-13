# 🚀 LucyWorkspace — Deploy Separado

**Repo sugerido:** `lucyworkspace`  
**URL Vercel:** `https://lucyworkspace.vercel.app`  
**Contraseña:** `LucyClawBot`

---

## ⚠️ SEGURIDAD: Variables de Entorno

**NUNCA subas esto al repo.** Tus credenciales van directo en Vercel Dashboard.

Cuando deployes, agrega estas 3 variables en Vercel:

| Variable | Valor |
|----------|-------|
| `SUPABASE_URL` | (tu URL de Supabase) |
| `SUPABASE_SERVICE_KEY` | (tu service key de Supabase) |
| `HEARTBEAT_SECRET` | inventa-algo-seguro-aqui-123456 |

---

## Pasos de Deploy (5 minutos)

### 1. Crear Repo en GitHub
- Ve a github.com/new
- Nombre: `lucyworkspace`
- Público o privado (como prefieras)
- NO agregues README ni nada, repo vacío

### 2. Subir código
```bash
cd /Users/lucy/.openclaw/workspace/lucyworkspace

git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/lucyworkspace.git
git push -u origin main
```

### 3. Deploy en Vercel
- vecel.com/new → Importa `lucyworkspace`
- Framework: **Next.js**
- Agrega las 3 variables de entorno (tabla arriba)
- Deploy

### 4. Configurar dominio
- Settings → Domains → Add `lucyworkspace.vercel.app`

### 5. Probar
- Ve a `https://lucyworkspace.vercel.app`
- Contraseña: `LucyClawBot`
- Listo.

---

**Nota:** Este es un deployment LIMPIO, separado de `clawai`. Tu info sensible está en `.env.example` (placeholders), nunca en el código.
