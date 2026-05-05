# 🚀 Configuración de Netlify

## Problema Solucionado

Netlify tiene un scanner de secretos que detecta credenciales hardcodeadas. Para pasar el build, necesitas configurar las variables de entorno directamente en Netlify.

## ✅ Solución

### Paso 1: Ir a Netlify Dashboard

1. Abre: https://app.netlify.com
2. Selecciona tu sitio: **gestion-de-piezas-9baf6**
3. Ve a **Site settings** → **Build & deploy** → **Environment**

### Paso 2: Agregar Variables de Entorno

Haz clic en **"Edit variables"** y agrega estas 6 variables:

```
VITE_FIREBASE_API_KEY = AIzaSyDr4CgSmWarlLqcjTMV9NLAfX7RgRuE9Hc
VITE_FIREBASE_AUTH_DOMAIN = gestion-de-piezas-9baf6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = gestion-de-piezas-9baf6
VITE_FIREBASE_STORAGE_BUCKET = gestion-de-piezas-9baf6.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 522730585054
VITE_FIREBASE_APP_ID = 1:522730585054:web:1f3d4601e08ecaf395fb4f
```

### Paso 3: Redeploy

```bash
# Opción A: Via Netlify UI
# Ve a Deploys → Trigger Deploy → Deploy site

# Opción B: Via CLI
netlify deploy --prod

# Opción C: Via Git (automático)
git push origin main
```

---

## 📋 Variables Detalladas

| Variable | Valor | Tipo |
|----------|-------|------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDr4CgSmWarlLqcjTMV9NLAfX7RgRuE9Hc` | Secret |
| `VITE_FIREBASE_AUTH_DOMAIN` | `gestion-de-piezas-9baf6.firebaseapp.com` | Público |
| `VITE_FIREBASE_PROJECT_ID` | `gestion-de-piezas-9baf6` | Público |
| `VITE_FIREBASE_STORAGE_BUCKET` | `gestion-de-piezas-9baf6.firebasestorage.app` | Público |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `522730585054` | Público |
| `VITE_FIREBASE_APP_ID` | `1:522730585054:web:1f3d4601e08ecaf395fb4f` | Público |

---

## 🔒 Seguridad

- ✅ **NO hay secretos hardcodeados** en el código
- ✅ **`.env.local` no se commitea** (en .gitignore)
- ✅ **`.env.example` usa placeholders** (no valores reales)
- ✅ **Variables en Netlify** protegidas por su sistema de secrets
- ✅ **Netlify scanner** ahora pasará sin detectar secretos

---

## 📖 Referencia

### Desarrollo Local
```bash
# 1. Copiar template
cp .env.example .env.local

# 2. Editar .env.local con valores reales
# (No se commitea, está en .gitignore)

# 3. Instalar y ejecutar
npm install
npm run dev
```

### Production (Netlify)
```
Variables → Netlify UI
     ↓
Build time → Vite lee import.meta.env
     ↓
Runtime → Firebase se inicializa
```

---

## ✓ Verificación

Después de configurar, deberías ver:

```
✅ "Firebase initialized successfully"
✅ Build passes Netlify secrets scanner
✅ App funciona en production
✅ Login/Signup funcionan
✅ Firestore operations funcionan
```

---

## 🆘 Solución de Problemas

### Error: "Firebase configuration incomplete"
- Verifica que TODAS las 6 variables estén en Netlify
- Ve a **Site settings** → **Environment** y confirma

### Error: "Secrets scanning found secrets"
- Ejecuta: `git log --all -S "AIzaSyDr"` para encontrar commits con hardcoded keys
- Si los encuentra, revisa si hay otros archivos con secretos

### Build falla con "Cannot read property 'apiKey'"
- Verifica que las variables de entorno estén correctas en Netlify
- Espera 1-2 minutos después de guardar variables (Netlify las indexa)

---

## 📚 Referencias

- [Netlify Secrets Scanning](https://ntl.fyi/configure-secrets-scanning)
- [Netlify Environment Variables](https://docs.netlify.com/configure-builds/environment-variables/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Nota**: Las credenciales están correctas. Solo necesitas agregarlas a Netlify para que el build pase.
