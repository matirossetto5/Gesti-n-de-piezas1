# 🔐 Guía de Seguridad - Gestión de Piezas Solana

## Resumen de Cambios Implementados

### ✅ Ya implementado en la aplicación
- Autenticación con Firebase Auth
- Control de acceso basado en roles/áreas
- Audit trail de cambios (sync_logs)
- HTTPS requerido en production

### ⚠️ Falta implementar (CRÍTICO)

#### 1. Credenciales en Variables de Entorno
**Estado**: ❌ PENDIENTE
**Archivo**: `firebase.ts`
**Acción recomendada**:
- Usar `firebase-improved.ts` como referencia
- Crear `.env.local` desde `.env.example`
- Nunca commitear credenciales

```bash
# Reemplazar firebase.ts con firebase-improved.ts
# NUNCA commitear .env.local
```

#### 2. Validación de Inputs
**Estado**: ✅ CREADO (services/validation.ts)
**Uso en App.tsx**:
```typescript
import { ValidationService } from './services/validation';

// En handleLogin:
const emailValidation = ValidationService.validateEmail(email);
if (!emailValidation.valid) {
  setAuthMessage({ text: emailValidation.error, type: 'error' });
  return;
}

// En handleSignUp:
const nombreValidation = ValidationService.validateName(nombre);
const apellidoValidation = ValidationService.validateName(apellido);
// ... validar antes de continuar

// En handleFileUpload:
const pieceValidation = ValidationService.validatePieceData(item);
if (!pieceValidation.valid) {
  errors.push(...pieceValidation.errors);
  // ... manejar errores
}
```

#### 3. Firestore Security Rules
**Estado**: ✅ CREADO (firestore.rules)
**Instalación**:
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Deployar rules
firebase deploy --only firestore:rules
```

---

## 🛡️ Checklist de Seguridad

### Antes de deployar a production

- [ ] Credenciales en variables de entorno (no hardcodeadas)
- [ ] Validación en inputs de usuario
- [ ] Firestore security rules deployadas
- [ ] HTTPS habilitado en el dominio
- [ ] CORS correctamente configurado
- [ ] Tokens de autenticación con expiración
- [ ] Logging de acciones sensibles
- [ ] Rate limiting en Cloud Functions (si aplica)
- [ ] Backups automáticos de Firestore
- [ ] Monitoreo de seguridad habilitado

### Durante desarrollo

- [ ] Nunca commitear .env.local
- [ ] Usar .env.example para variables
- [ ] Sanitizar inputs antes de guardar
- [ ] Validar datos en frontend Y backend
- [ ] No exponer errores detallados al usuario
- [ ] Usar HTTPS en desarrollo (si es posible)

---

## 🔒 Mejores Prácticas

### 1. Manejo de Errores
❌ **MALO**:
```typescript
.catch(err => alert(err.message)); // Expone detalles internos
```

✅ **BUENO**:
```typescript
.catch(err => {
  console.error('Error:', err); // Log para debugging
  alert('Ocurrió un error. Por favor intente de nuevo.');
  logError(err); // Enviar a servicio de logging
});
```

### 2. Validación de Datos
❌ **MALO**:
```typescript
await updateDoc(ref, { nombre: nombreInput.value }); // Sin validar
```

✅ **BUENO**:
```typescript
const validation = ValidationService.validateName(nombreInput.value);
if (!validation.valid) {
  setError(validation.error);
  return;
}
await updateDoc(ref, { nombre: nombreInput.value });
```

### 3. Sanitización de Inputs
❌ **MALO**:
```typescript
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // XSS!
```

✅ **BUENO**:
```typescript
const sanitized = ValidationService.sanitizeInput(userInput);
<div>{sanitized}</div> // React escapea automáticamente
```

### 4. Manejo de Credenciales
❌ **MALO**:
```typescript
const config = {
  apiKey: "AIzaSyDtFio7d5...", // Hardcodeado
};
```

✅ **BUENO**:
```typescript
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
};
```

---

## 🚨 Vulnerabilidades Comunes y Cómo Prevenirlas

### XSS (Cross-Site Scripting)
**Riesgo**: Inyección de código malicioso en formularios
**Prevención**:
- Usar `ValidationService.sanitizeInput()`
- React escapea texto por defecto
- Evitar `dangerouslySetInnerHTML`
- Validar inputs en backend también

### SQL Injection
**Riesgo**: No aplica (Firestore no usa SQL)
**Alternativa**: Validar estructura de Firestore queries

### CSRF (Cross-Site Request Forgery)
**Riesgo**: Solicitudes no autorizadas
**Prevención**:
- Firebase Auth maneja tokens automáticamente
- Verificar origen en Cloud Functions

### Acceso no autorizado
**Riesgo**: Usuarios acceden a datos de otros
**Prevención**:
- Firestore security rules correctamente configuradas
- Verificar `request.auth.uid` en rules
- No confiar solo en permisos de frontend

---

## 📊 Flujo de Seguridad Propuesto

```
User Input
    ↓
Frontend Validation (ValidationService)
    ↓
Send to Firebase (Auth tokens verificados automáticamente)
    ↓
Firestore Security Rules (Verificar permisos)
    ↓
Backend Validation (si hay Cloud Functions)
    ↓
Update Database
    ↓
Log Action
    ↓
Return Success Response
```

---

## 🔑 Gestión de Secretos

### En desarrollo
```bash
# .env.local (NUNCA commitear)
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
```

### En production
**Opciones**:
1. **Variables de entorno del servidor**
   - Railway, Vercel, etc. tienen admin de env vars
2. **Secrets Manager**
   - Google Secret Manager
   - AWS Secrets Manager
3. **Firebase Hosting**
   - Env vars en `firebase.json`

---

## 📋 Auditoría y Logging

### Acciones a registrar
- Login/Logout
- Creación/edición de proyectos
- Cambios de estado de piezas
- Importación de datos
- Cambios de permisos
- Descargas/exportes

### Implementación
```typescript
const logAction = (action: string, details: any, severity: 'info' | 'warn' | 'error' = 'info') => {
  const log = {
    timestamp: new Date(),
    action,
    userId: currentUser.uid,
    details,
    severity,
    userAgent: navigator.userAgent,
    ip: null // No disponible en cliente
  };

  // Guardar en Firestore
  addDoc(collection(db, `audits/${appId}`), log);

  // Opcional: enviar a servicio externo
  if (severity === 'error') {
    reportError(log);
  }
};
```

---

## 🧪 Testing de Seguridad

### Instalación de Emulator de Firebase
```bash
firebase emulators:start --only firestore
```

### Tests de Firestore Rules
```javascript
// Ejemplo con firebase-rules-test-library
it('denies read from other users', async () => {
  const db = firebase.firestore();
  const otherUserRef = db.collection('artifacts').doc('other-user-id');
  
  await firebase.assertFails(otherUserRef.get());
});
```

---

## 📞 Contacto y Soporte

Para reportar vulnerabilidades de seguridad:
1. NO publiques en issues públicas
2. Contacta al equipo de seguridad
3. Proporciona pasos reproducibles
4. Espera confirmación antes de divulgar

---

## 📚 Referencias

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/React_Security_Cheat_Sheet.html)
- [Firebase Authentication](https://firebase.google.com/docs/auth/web/manage-users)

