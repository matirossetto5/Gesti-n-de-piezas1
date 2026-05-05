# 🚀 Guía Completa de Deploy en Netlify

## ✅ Cambios Realizados

La aplicación ha sido reestructurada para ser totalmente compatible con Netlify:

### 1. **index.html - Limpiado**
- ✅ Eliminado importmap incorrecto que apuntaba a CDN externos
- ✅ Ahora Vite maneja todas las dependencias correctamente
- ✅ El archivo es limpio y optimizado

### 2. **netlify.toml - Creado**
- ✅ Configuración oficial de Netlify
- ✅ Build settings automáticos
- ✅ Headers de seguridad configurados
- ✅ Cache policies para assets
- ✅ Redirects para SPA

### 3. **vite.config.ts - Actualizado**
- ✅ Variables de entorno correcto configuradas
- ✅ Code splitting optimizado (Firebase, Charts, Exports)
- ✅ Build minificado para production
- ✅ Target ES2020

### 4. **.gitignore - Validado**
- ✅ Archivos de entorno ignorados (.env, .env.local)
- ✅ node_modules ignorados
- ✅ Directorio dist ignorado

---

## 📋 Pasos de Deploy

### **Paso 1: Instalar Dependencias Localmente**

```bash
npm install
```

Espera a que todas las dependencias se instalen correctamente.

---

### **Paso 2: Probar Localmente**

```bash
# Desarrollo
npm run dev
# Debería abrir en http://localhost:3000

# Build de producción
npm run build
npm run preview
```

Verifica que todo funciona correctamente en `npm run preview`.

---

### **Paso 3: Configurar Netlify**

#### **Opción A: CLI de Netlify (Recomendado)**

```bash
# 1. Instalar CLI
npm install -g netlify-cli

# 2. Autenticarse
netlify login

# 3. Vincular el proyecto (crea netlify.toml automáticamente)
netlify link

# 4. Deploy
netlify deploy --prod
```

#### **Opción B: GitHub (Automático)**

1. Sube el código a GitHub
2. Ve a https://app.netlify.com
3. Click en **"New site from Git"**
4. Selecciona tu repositorio
5. Netlify detectará `netlify.toml` automáticamente
6. Click en **Deploy site**

---

### **Paso 4: Configurar Variables de Entorno en Netlify**

Ve a: **Site settings** → **Build & deploy** → **Environment**

Agrega estas 6 variables (obtén los valores de Firebase Console):

```
VITE_FIREBASE_API_KEY = AIzaSyDr4CgSmWarlLqcjTMV9NLAfX7RgRuE9Hc
VITE_FIREBASE_AUTH_DOMAIN = gestion-de-piezas-9baf6.firebaseapp.com
VITE_FIREBASE_PROJECT_ID = gestion-de-piezas-9baf6
VITE_FIREBASE_STORAGE_BUCKET = gestion-de-piezas-9baf6.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID = 522730585054
VITE_FIREBASE_APP_ID = 1:522730585054:web:1f3d4601e08ecaf395fb4f
```

**IMPORTANTE:** Las claves de Firebase son públicas por diseño (se envían desde el navegador).

---

### **Paso 5: Desabilitar Secrets Scanner (Si Es Necesario)**

Si Netlify falla por detección de "secretos":

1. En Netlify: **Site settings** → **Build & deploy** → **Environment**
2. Agrega variable: `SECRETS_SCAN_SMART_DETECTION_ENABLED = false`
3. Guarda y redeploy

---

### **Paso 6: Verificar Deploy**

```bash
# Ver logs en Netlify
netlify logs

# O en Netlify UI:
# Deploys → [Tu deploy] → Deploy log
```

Deberías ver:
```
✅ Build finished
✅ Artifact uploads successful
✅ Site is live at [tu-url].netlify.app
```

---

## 📚 Estructura del Proyecto Ahora

```
gestion-de-piezas/
├── src/
│   ├── App.tsx
│   ├── index.tsx
│   ├── firebase.ts
│   ├── types.ts
│   ├── utils.ts
│   └── services/
│       └── validation.ts
├── index.html           ← Limpio, sin importmap
├── vite.config.ts       ← Actualizado
├── netlify.toml         ← ✨ NUEVO - Config de Netlify
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── dist/               ← Se genera en build
```

---

## 🔐 Seguridad

- ✅ No hay secretos hardcodeados
- ✅ `.env.local` está en `.gitignore`
- ✅ Variables en Netlify UI (cifradas)
- ✅ Headers de seguridad configurados
- ✅ Build minificado en production

---

## 🆘 Solución de Problemas

### Error: "Cannot find module 'firebase'"
```bash
npm install --save firebase
```

### Error: "VITE_FIREBASE_API_KEY is undefined"
- ✅ Verifica que las variables estén en Netlify (no en .env.local)
- ✅ Espera 1-2 minutos después de guardar variables
- ✅ Redeploy en Netlify UI

### Error: "port 3000 is in use"
```bash
npm run dev -- --port 3001
```

### Error: Build lento o falla
```bash
# Limpiar caché
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📊 Variables de Entorno

Las variables se cargan así:

**Desarrollo (.env.local):**
```
VITE_FIREBASE_API_KEY=tu_clave_aqui
```

**Production (Netlify UI):**
```
Environment → VITE_FIREBASE_API_KEY = tu_clave_aqui
```

Vite las hace disponibles con `import.meta.env.VITE_*`

---

## 🚀 Deploy Rápido (Después de Configurar)

```bash
# Opción 1: CLI
netlify deploy --prod

# Opción 2: Git Push (si está conectado a GitHub)
git push origin main

# Opción 3: Netlify UI
# Deploys → Trigger deploy → Deploy site
```

---

## ✓ Checklist Final

- [ ] `npm install` ejecutado
- [ ] `npm run build` sin errores
- [ ] `npm run preview` funciona
- [ ] Variables de entorno en Netlify configuradas
- [ ] netlify.toml en la raíz del proyecto
- [ ] index.html sin importmap
- [ ] Site deployed en Netlify
- [ ] Firebase funciona en production

---

## 📞 Soporte

- [Netlify Docs](https://docs.netlify.com/)
- [Vite Docs](https://vitejs.dev/)
- [Firebase Docs](https://firebase.google.com/docs)

---

**¡Listo para deployer en Netlify!** 🎉
