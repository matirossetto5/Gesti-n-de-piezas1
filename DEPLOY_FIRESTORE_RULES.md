# 🚀 Guía de Deployment - Firestore Security Rules

## Objetivo
Proteger tu base de datos Firestore con reglas de seguridad que:
- ✅ Requieren autenticación para acceso
- ✅ Validan estructura de datos
- ✅ Previenen acceso no autorizado
- ✅ Protegen datos sensibles

---

## Pasos para Deployar

### 1. Instalar Firebase CLI (si no lo tienes)
```bash
npm install -g firebase-tools
```

### 2. Autenticarse con Firebase
```bash
firebase login
```
Esto abrirá tu navegador para que autorices el acceso.

### 3. Inicializar Firebase en tu proyecto
```bash
firebase init firestore
```
**Preguntas que te hará:**
- "What file should be used for Firestore Rules?" → Presiona Enter (usa el default)
- "What file should be used for Firestore indexes?" → Presiona Enter

Si ya está inicializado, simplemente continúa al siguiente paso.

### 4. Actualizar las rules
Los archivos deben estar en tu proyecto:
- **firestore.rules** → Las reglas de seguridad
- **firebase.json** → Configuración (auto-generado)

Verifica que `firestore.rules` tenga el contenido correcto:
```bash
ls -la firestore.rules  # Debe existir
```

### 5. Deployar las rules
```bash
firebase deploy --only firestore:rules
```

**Salida esperada:**
```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/gestion-de-piezas-fefdc/firestore
```

### 6. Verificar en Firebase Console
1. Abre: https://console.firebase.google.com
2. Selecciona tu proyecto: `gestion-de-piezas-fefdc`
3. Ve a **Firestore Database** → **Rules**
4. Deberías ver tus rules publicadas

---

## Qué hacen las Reglas

### ✅ Permite
- Leer proyectos y piezas (si estás autenticado)
- Crear nuevas piezas
- Actualizar estado de piezas
- Escribir logs de sincronización

### ❌ Bloquea
- Acceso sin autenticación
- Modificación de logs (append-only)
- Datos inválidos (estructura incorrecta)
- Pesos negativos o superiores a 10,000 kg

---

## Testing de las Rules

### En Desarrollo (Firebase Emulator)

#### Instalar emulator
```bash
firebase emulators:start --only firestore
```

#### Conectar tu app al emulator
En `firebase.ts`, agregar:
```typescript
import { connectFirestoreEmulator } from 'firebase/firestore';

if (location.hostname === 'localhost') {
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

#### Ejecutar tests
```bash
npm test
```

### En Production (Manual)

1. Abre Firebase Console
2. Ve a **Firestore** → **Rules**
3. Haz clic en **"Test your rules"**
4. Intenta operaciones de prueba:
   - Read sin auth → ❌ Debe fallar
   - Write sin auth → ❌ Debe fallar
   - Read con auth válido → ✅ Debe funcionar

---

## Solución de Problemas

### Error: "firebase: command not found"
```bash
# Solución: Instalar globalmente
npm install -g firebase-tools

# O usar con npx
npx firebase deploy --only firestore:rules
```

### Error: "No Firebase project detected"
```bash
# Solución: Asegurate de estar en el directorio correcto
cd /home/user/Gesti-n-de-piezas1
firebase init

# O especifica el proyecto
firebase use gestion-de-piezas-fefdc
firebase deploy --only firestore:rules
```

### Error: "Permission denied" en Firestore
**Significa que las rules no están correctamente configuradas.** Verifica:
1. Que estés autenticado (`auth != null`)
2. Que tu UID esté en la ruta correcta
3. Que los datos tengan la estructura correcta

### Tu app no puede escribir datos
1. Verifica que el usuario esté autenticado
2. Revisa los datos que intentas escribir
3. Abre Firebase Console → **Firestore** → **Rules** → **Test your rules**

---

## Entender las Rules

```javascript
// ✅ Permite leer si estás autenticado
match /artifacts/{artifactId}/public/data/projects/{projectId} {
  allow read: if isAuth();
}

// ✅ Permite crear con validación
allow create: if isAuth() && 
  request.resource.data.name is string && 
  request.resource.data.name.size() > 0;

// ❌ No permite eliminar (por defecto)
// allow delete: if false;
```

---

## Rollback (Revertir cambios)

Si algo sale mal, puedes revertir a las rules de desarrollo:

```bash
# Ver rules actuales
firebase rules:list

# Revertir a rules más permisivas (solo para testing)
firebase deploy --only firestore:rules
```

---

## Monitoreo

### Ver logs de acceso denegado
1. Firebase Console → **Logs**
2. Filtrar por "Firestore"
3. Ver qué operaciones fueron bloqueadas

### Ejemplo de error común
```
Permission denied: Missing or insufficient permissions 
to read: artifacts/user123/public/data/projects/proj456
```

**Solución**: Verificar que `request.auth != null`

---

## Próximos Pasos

### Después de deployar
- [ ] Testear todas las operaciones (create, read, update, delete)
- [ ] Verificar en Firebase Console que las rules estén activas
- [ ] Revisar logs para ver si hay accesos denegados
- [ ] Notificar al equipo que las rules están en production

### Mejoras futuras
- [ ] Agregar validación de permisos por rol
- [ ] Implementar rate limiting
- [ ] Agregar auditoría detallada

---

## Referencia Rápida

```bash
# Listar proyectos Firebase
firebase projects:list

# Usar un proyecto específico
firebase use gestion-de-piezas-fefdc

# Ver estado del deploy
firebase deploy:check

# Deployar solo rules
firebase deploy --only firestore:rules

# Deployar rules e indexes
firebase deploy --only firestore

# Ver historial de deployments
firebase deployments:list
```

---

## ¿Necesitas ayuda?

- **Firebase CLI Docs**: https://firebase.google.com/docs/cli
- **Firestore Rules Guide**: https://firebase.google.com/docs/firestore/security/start
- **Community**: https://stackoverflow.com/questions/tagged/firebase

---

**✅ Una vez completado este deploy, tu base de datos estará protegida con seguridad de nivel production.**
