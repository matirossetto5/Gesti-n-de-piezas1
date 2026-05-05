# 🏗️ Plan de Refactorización - Arquitectura de Componentes

## Situación Actual
- **App.tsx**: 1129 líneas - Monolítico
- **Falta de separación de responsabilidades**
- **Componentes UI mezclados con lógica de negocio**
- **Hooks personalizados no creados**

## Arquitectura Propuesta

### Estructura de Directorios
```
src/
├── components/
│   ├── Auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   ├── PasswordResetForm.tsx
│   │   └── AuthContainer.tsx
│   ├── Projects/
│   │   ├── ProjectSelector.tsx
│   │   ├── ProjectList.tsx
│   │   ├── ProjectForm.tsx
│   │   └── ProjectActions.tsx
│   ├── Pieces/
│   │   ├── PiecesTable.tsx
│   │   ├── PieceRow.tsx
│   │   ├── PieceFilters.tsx
│   │   ├── PieceImporter.tsx
│   │   └── PieceActions.tsx
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── Charts/
│   │   │   ├── TonnageChart.tsx
│   │   │   ├── UnitsChart.tsx
│   │   │   └── ProgressChart.tsx
│   │   ├── Stats/
│   │   │   ├── StatCard.tsx
│   │   │   └── StatGrid.tsx
│   │   └── KPIs/
│   │       ├── CertificationKPI.tsx
│   │       └── PhaseProgress.tsx
│   ├── Common/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   └── Loading.tsx
│   ├── Modals/
│   │   ├── CommentModal.tsx
│   │   ├── HistoryModal.tsx
│   │   ├── MassActionModal.tsx
│   │   └── ProfileModal.tsx
│   └── Layout/
│       ├── MainLayout.tsx
│       ├── AuthLayout.tsx
│       └── Navigation.tsx
│
├── hooks/
│   ├── useAuth.ts
│   ├── useProjects.ts
│   ├── usePieces.ts
│   ├── useFirebase.ts
│   ├── useLocalStorage.ts
│   └── useDebounce.ts
│
├── services/
│   ├── firebase.ts
│   ├── authService.ts
│   ├── projectService.ts
│   ├── pieceService.ts
│   ├── validation.ts
│   ├── errorHandler.ts
│   ├── logger.ts
│   └── exportService.ts
│
├── types/
│   ├── auth.ts
│   ├── project.ts
│   ├── piece.ts
│   ├── common.ts
│   └── index.ts
│
├── utils/
│   ├── formatters.ts
│   ├── validators.ts
│   ├── excel.ts
│   └── constants.ts
│
├── constants/
│   ├── areas.ts
│   ├── states.ts
│   ├── permissions.ts
│   └── config.ts
│
├── styles/
│   ├── globals.css
│   ├── tailwind.css
│   └── animations.css
│
├── App.tsx (principal, >100 líneas)
├── main.tsx
└── types.ts → types/index.ts
```

---

## Componentes a Crear

### 1. Hooks Personalizados

#### `hooks/useAuth.ts`
```typescript
export interface UseAuthReturn {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, profile: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  // Lógica del useEffect que maneja autenticación
  // Retornar user, userProfile, loading, métodos
}
```

#### `hooks/useProjects.ts`
```typescript
export const useProjects = (user: User | null) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  
  const createProject = (name: string) => { /* ... */ };
  const updateProject = (id: string, data: Partial<Project>) => { /* ... */ };
  const deleteProject = (id: string) => { /* ... */ };
  
  return { projects, loading, createProject, updateProject, deleteProject };
};
```

#### `hooks/usePieces.ts`
```typescript
export const usePieces = (projectId: string | null, userId: string | null) => {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  const updatePiece = (pieceId: string, state: string, value: AuditStatus) => { /* ... */ };
  const importPieces = (file: File) => { /* ... */ };
  const deletePiece = (pieceId: string) => { /* ... */ };
  
  return { pieces, syncLogs, loading, updatePiece, importPieces, deletePiece };
};
```

#### `hooks/useFirebase.ts`
```typescript
// Abstracción de operaciones Firestore comunes
export const useFirebase = () => {
  const query = async (path: string, conditions: any[]) => { /* ... */ };
  const update = async (path: string, data: any) => { /* ... */ };
  const create = async (path: string, data: any) => { /* ... */ };
  const delete = async (path: string) => { /* ... */ };
  const subscribe = (path: string, callback: (data: any) => void) => { /* ... */ };
  
  return { query, update, create, delete, subscribe };
};
```

### 2. Servicios

#### `services/authService.ts`
```typescript
export class AuthService {
  static async login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
  }

  static async signup(email: string, password: string): Promise<UserCredential> {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  static async logout(): Promise<void> {
    return signOut(auth);
  }

  static async resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(auth, email);
  }

  static async getCurrentUser(): Promise<User | null> {
    return new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, resolve);
      return unsubscribe;
    });
  }
}
```

#### `services/projectService.ts`
```typescript
export class ProjectService {
  static async getProjects(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, `artifacts/${appId}/public/data/projects`),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
  }

  static async createProject(name: string, userId: string): Promise<string> {
    const docRef = await addDoc(
      collection(db, `artifacts/${appId}/public/data/projects`),
      {
        name: name.toUpperCase(),
        createdAt: serverTimestamp(),
        createdBy: userId,
        archived: false
      }
    );
    return docRef.id;
  }

  static async updateProject(projectId: string, data: Partial<Project>): Promise<void> {
    const ref = doc(db, `artifacts/${appId}/public/data/projects`, projectId);
    await updateDoc(ref, data);
  }

  static subscribeToProjects(callback: (projects: Project[]) => void) {
    return onSnapshot(
      collection(db, `artifacts/${appId}/public/data/projects`),
      snapshot => {
        const projects = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Project[];
        callback(projects);
      }
    );
  }
}
```

#### `services/pieceService.ts`
```typescript
export class PieceService {
  static async getPieces(projectId: string): Promise<Piece[]> {
    const snapshot = await getDocs(
      collection(db, `artifacts/${appId}/public/data/projects/${projectId}/pieces`)
    );
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Piece));
  }

  static async updatePieceState(
    projectId: string,
    pieceId: string,
    stateKey: string,
    audit: AuditStatus
  ): Promise<void> {
    const ref = doc(
      db,
      `artifacts/${appId}/public/data/projects/${projectId}/pieces`,
      pieceId
    );
    await updateDoc(ref, { [stateKey]: audit });
  }

  static async importPieces(projectId: string, pieces: Piece[]): Promise<number> {
    const batchSize = 450;
    let imported = 0;

    for (let i = 0; i < pieces.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = pieces.slice(i, i + batchSize);

      chunk.forEach(piece => {
        const ref = doc(
          collection(db, `artifacts/${appId}/public/data/projects/${projectId}/pieces`)
        );
        batch.set(ref, {
          ...piece,
          eliminada: false,
          loadedAt: serverTimestamp()
        });
      });

      await batch.commit();
      imported += chunk.length;
    }

    return imported;
  }

  static subscribeToPieces(projectId: string, callback: (pieces: Piece[]) => void) {
    return onSnapshot(
      collection(db, `artifacts/${appId}/public/data/projects/${projectId}/pieces`),
      snapshot => {
        const pieces = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Piece[];
        callback(pieces);
      }
    );
  }
}
```

### 3. Componentes UI

#### `components/Common/Button.tsx` (Mejorado)
```typescript
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  icon?: ComponentType<any>;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  icon: Icon,
  fullWidth = false,
  ...props
}) => {
  const baseStyles = 'rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2';
  const sizeStyles = {
    sm: 'px-3 py-2 text-xs h-9',
    md: 'px-4 py-3 text-sm h-11 md:px-6',
    lg: 'px-6 py-4 text-base h-14 md:px-8'
  };
  const variantStyles = {
    primary: 'bg-slate-600 text-white shadow-md hover:bg-slate-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white',
    ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};
```

#### `components/Pieces/PieceFilters.tsx`
```typescript
interface PieceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  phaseFilter: string;
  onPhaseChange: (value: string) => void;
  uniquePhases: string[];
  onExportExcel: () => void;
  onExportPDF: () => void;
  onShowLogs: () => void;
}

export const PieceFilters: React.FC<PieceFiltersProps> = ({
  searchTerm,
  onSearchChange,
  phaseFilter,
  onPhaseChange,
  uniquePhases,
  onExportExcel,
  onExportPDF,
  onShowLogs
}) => {
  return (
    <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 flex flex-col lg:flex-row gap-4">
      {/* Búsqueda */}
      <div className="flex-1">
        <input
          placeholder="CONJUNTO..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3"
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>

      {/* Filtro de fase */}
      <select
        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
        value={phaseFilter}
        onChange={e => onPhaseChange(e.target.value)}
      >
        <option value="">Todas las Fases</option>
        {uniquePhases.map(ph => <option key={ph} value={ph}>Fase {ph}</option>)}
      </select>

      {/* Acciones */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onExportExcel}>
          <FileSpreadsheet /> Excel
        </Button>
        <Button variant="secondary" onClick={onExportPDF}>
          <FileText /> PDF
        </Button>
        <Button variant="ghost" onClick={onShowLogs}>
          <History />
        </Button>
      </div>
    </div>
  );
};
```

---

## Guía de Migración

### Paso 1: Crear la estructura
```bash
mkdir -p src/{components,hooks,services,types,utils,constants,styles}
```

### Paso 2: Mover tipos
```bash
# Mover types.ts a types/index.ts
# Crear archivos específicos por dominio
```

### Paso 3: Crear servicios
- Empezar con `services/firebase.ts`
- Luego `services/authService.ts`
- Seguir con `services/projectService.ts`
- Finalmente `services/pieceService.ts`

### Paso 4: Crear hooks
- Usar servicios para abstracción
- Mantener state local en componentes si es necesario

### Paso 5: Migrar componentes
- Empezar con componentes simples (Button, Modal, etc)
- Luego componentes de dominio (Pieces, Projects)
- Finalmente Page/Container components

### Paso 6: Actualizar App.tsx
- Usar componentes nuevos
- Conectar con hooks
- Mantener state global si es necesario

---

## Beneficios de esta Arquitectura

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Líneas por archivo** | 1129 | 100-300 |
| **Reutilización** | ❌ 0% | ✅ 70%+ |
| **Testabilidad** | ❌ Difícil | ✅ Fácil |
| **Mantenibilidad** | ❌ Compleja | ✅ Simple |
| **Escalabilidad** | ❌ Limitada | ✅ Excelente |
| **Type Safety** | 🟡 Parcial | ✅ Total |

---

## Próximos Pasos

1. Revisar estructura propuesta
2. Crear servicios (1-2 semanas)
3. Crear componentes (2-3 semanas)
4. Migrar página principal (1-2 semanas)
5. Testing (2-3 semanas)
6. Code review y deployment (1 semana)

