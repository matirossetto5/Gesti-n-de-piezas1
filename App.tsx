
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged, 
    signOut,
    User 
} from 'firebase/auth';
import { 
    collection, query, where, getDocs, addDoc, updateDoc, 
    doc, onSnapshot, orderBy, limit, writeBatch, serverTimestamp,
    deleteDoc
} from 'firebase/firestore';
import { auth, db, appId, isConfigured } from './firebase';
import {
    UserProfile, Project, Piece, SyncLog,
    AREAS, STATES, AREA_PERMISSIONS, AuditStatus
} from './types';
import { formatTime, readExcel, isStateComplete } from './utils';
import { ValidationService } from './services/validation';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, Legend, ComposedChart, Line, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { 
    Loader2, LogOut, Building, FileSpreadsheet, 
    Database, LayoutDashboard, CheckCircle2, MessageSquare, 
    Trash2, Upload, Download, Search, ChevronDown, Plus, X, 
    Layers, History, Clock, Archive, ClipboardList,
    TrendingUp, Weight, Zap, Cpu, MoreHorizontal, CheckSquare, Square,
    Monitor, Settings, Info, Calendar, User as UserIcon, ArrowRight,
    Truck, Activity, AlertCircle, Gauge, Boxes, ArrowUpRight, Ship, Warehouse,
    Maximize2, ExternalLink, Image as ImageIcon, Box, Edit3, Camera, Save,
    Filter, UserCircle, Briefcase, FileText, Menu, Mail, Key, UserPlus
} from 'lucide-react';

// --- UI Components ---

const SolanaSymbol = ({ className = "w-10 h-10" }: { className?: string }) => (
    <div className={`${className} rounded-xl overflow-hidden shrink-0 shadow-sm bg-white p-1 ring-1 ring-slate-200`}>
        <img 
            src="https://media.licdn.com/dms/image/v2/C4E0BAQENkX0orEV8KQ/company-logo_200_200/company-logo_200_200/0/1630620084700?e=2147483647&v=beta&t=8OGYSccaJ78FnSmrdWKlTs0G_EYREXv8gvSJoIaL-DQ" 
            alt="Solana" 
            className="w-full h-full object-cover rounded-lg"
        />
    </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', loading = false, disabled = false, type = 'button' }: any) => {
    const base = "h-11 px-4 md:px-6 rounded-xl font-bold transition-all duration-200 flex items-center justify-center gap-2 text-[10px] md:text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50";
    const variants = {
        primary: "bg-slate-600 text-white shadow-md hover:bg-slate-700",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
        danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white shadow-sm",
        ghost: "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
    };
    return (
        <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant as keyof typeof variants]} ${className}`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
        </button>
    );
};

const StatusBadge = ({ state, p, onToggle, allowed }: any) => {
    const status = p[state.key];
    const isDone = isStateComplete(status);
    return (
        <button 
            disabled={!allowed}
            onClick={() => onToggle(p.id, state.key, status)}
            className={`relative w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all duration-300 group/status ${!allowed ? 'opacity-20 cursor-not-allowed' : 'hover:scale-110 active:scale-90'}`}
            title={state.label}
        >
            <div 
                className={`w-full h-full rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${isDone ? 'border-transparent' : 'border-slate-200 bg-white'}`}
                style={isDone ? { backgroundColor: state.color, boxShadow: `0 4px 10px ${state.color}40` } : {}}
            >
                {isDone ? (
                    <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-white stroke-[3] pulse-led" />
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/status:bg-slate-400" />
                )}
            </div>
            {/* Etiqueta móvil */}
            <span className="absolute -bottom-4 text-[7px] font-bold text-slate-400 uppercase md:hidden">{state.short}</span>
        </button>
    );
};

const Modal = ({ isOpen, onClose, title, children, size = 'md' }: any) => {
    if (!isOpen) return null;
    const sizes = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-7xl' };
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6 bg-slate-800/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-2xl w-full ${sizes[size as keyof typeof sizes]} max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200`}>
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="text-sm md:text-xl font-black text-slate-800 tracking-tight uppercase tracking-wider truncate">{title}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all active:scale-90"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-5 md:p-8 overflow-y-auto custom-scroll">
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- Main App ---

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeView, setActiveView] = useState<'pieces' | 'charts'>('pieces');
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [phaseFilter, setPhaseFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [stateValueFilter, setStateValueFilter] = useState('all');
    const [selectedPieces, setSelectedPieces] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Auth states
    const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
    const [authMessage, setAuthMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const [modals, setModals] = useState({
        login: true,
        projects: false,
        logs: false,
        massPhase: false,
        comment: false,
        pieceHistory: false,
        editProject: false,
        profile: false
    });
    const [commentTarget, setCommentTarget] = useState<{id: string, text: string} | null>(null);
    const [historyTargetId, setHistoryTargetId] = useState<string | null>(null);
    const [editTargetProject, setEditTargetProject] = useState<Project | null>(null);
    const [profileEditData, setProfileEditData] = useState<Partial<UserProfile>>({});
    
    const fileRef = useRef<HTMLInputElement>(null);
    const projectImageRef = useRef<HTMLInputElement>(null);
    const avatarRef = useRef<HTMLInputElement>(null);
    const chart1Ref = useRef<HTMLDivElement>(null);
    const chart2Ref = useRef<HTMLDivElement>(null);

    // Auth & Data effects
    useEffect(() => {
        if (!isConfigured) {
            console.error('Firebase not configured with environment variables');
            setAuthLoading(false);
            return;
        }
        // Safety timeout: if onAuthStateChanged never fires (network issues, bad config),
        // stop the loading spinner after 5 seconds and show the login form.
        const timeout = setTimeout(() => {
            console.warn('Auth timeout: Firebase no respondió en 5 segundos');
            setAuthLoading(false);
            setModals(m => ({ ...m, login: true }));
        }, 5000);

        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            clearTimeout(timeout);
            setUser(u);
            if (u) {
                // Unblock the UI immediately — don't wait for Firestore
                setModals(m => ({ ...m, login: false }));
                setAuthLoading(false);
                try {
                    const q = query(collection(db, `artifacts/${appId}/public/data/users`), where("authUid", "==", u.uid), limit(1));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile;
                        setUserProfile(data);
                        setProfileEditData(data);
                    }
                } catch (e) {
                    console.warn('No se pudo cargar el perfil de usuario:', e);
                }
            } else {
                setModals(m => ({ ...m, login: true }));
                setAuthLoading(false);
            }
        });

        return () => {
            clearTimeout(timeout);
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!user) return;
        return onSnapshot(
            query(collection(db, `artifacts/${appId}/public/data/projects`), orderBy('name')),
            (snap) => { setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))); },
            (err) => { console.error('Error cargando proyectos:', err); }
        );
    }, [user]);

    useEffect(() => {
        if (!activeProjectId || !user) {
            setPieces([]); setSyncLogs([]); return;
        }
        setLoadingData(true);
        const unsubPieces = onSnapshot(
            collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`),
            (snap) => { setPieces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Piece))); setLoadingData(false); },
            (err) => { console.error('Error cargando piezas:', err); setLoadingData(false); }
        );
        const unsubLogs = onSnapshot(
            query(collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/sync_logs`), orderBy('date', 'desc'), limit(50)),
            (snap) => { setSyncLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as SyncLog))); },
            (err) => { console.error('Error cargando logs:', err); }
        );
        return () => { unsubPieces(); unsubLogs(); };
    }, [activeProjectId, user]);

    const userArea = userProfile?.area || '';
    const canEditState = (stateKey: string) => AREA_PERMISSIONS[userArea]?.includes(stateKey);
    const isOT = userArea === "Oficina Técnica";

    const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);
    const historyTarget = useMemo(() => pieces.find(p => p.id === historyTargetId), [pieces, historyTargetId]);

    const filteredPieces = useMemo(() => {
        return pieces.filter(p => {
            if (p.eliminada) return false;
            const sMatch = !searchTerm || p.conjunto.toLowerCase().includes(searchTerm.toLowerCase()) || (p.lote||"").toString().includes(searchTerm);
            const pMatch = !phaseFilter || (p.lote||"").toString() === phaseFilter;
            let stMatch = true;
            if (stateFilter && stateValueFilter !== 'all') {
                const comp = isStateComplete(p[stateFilter]);
                stMatch = stateValueFilter === 'true' ? comp : !comp;
            }
            return sMatch && pMatch && stMatch;
        }).sort((a, b) => a.conjunto.localeCompare(b.conjunto));
    }, [pieces, searchTerm, phaseFilter, stateFilter, stateValueFilter]);

    const uniquePhases = useMemo(() => {
        const phases = new Set(pieces.map(p => (p.lote || "").toString()).filter(v => v !== ""));
        return Array.from(phases).sort();
    }, [pieces]);

    const stats = useMemo(() => {
        const res = { 
            totalKg: 0, 
            statesKg: {} as Record<string, number>,
            statesCount: {} as Record<string, number>,
            despachadoSinMontar: 0,
            listoParaDespacho: 0,
            enFabricacion: 0,
            completado: 0
        };
        STATES.forEach(s => {
            res.statesKg[s.key] = 0;
            res.statesCount[s.key] = 0;
        });

        const relevantPieces = pieces.filter(p => {
            if (p.eliminada) return false;
            if (phaseFilter && (p.lote||"").toString() !== phaseFilter) return false;
            return true;
        });

        relevantPieces.forEach(p => {
            res.totalKg += (p.peso || 0);
            
            STATES.forEach(s => { 
                if (isStateComplete(p[s.key])) {
                    res.statesKg[s.key] += (p.peso || 0);
                    res.statesCount[s.key] += 1;
                }
            });

            if (isStateComplete(p.pintura) && !isStateComplete(p.despachado)) res.listoParaDespacho++;
            if (isStateComplete(p.despachado) && !isStateComplete(p.montado)) res.despachadoSinMontar++;
            if (!isStateComplete(p.montado)) res.enFabricacion++;
            if (isStateComplete(p.montado)) res.completado++;
        });

        return res;
    }, [pieces, phaseFilter]);

    // Auth Handlers
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setAuthMessage(null);
        const email = (e.target as any).email.value?.trim() || '';
        const pass = (e.target as any).pass.value;

        // Validate inputs
        const emailValidation = ValidationService.validateEmail(email);
        if (!emailValidation.valid) {
            setAuthMessage({ text: emailValidation.error || "Email inválido", type: 'error' });
            setProcessing(false);
            return;
        }

        const passwordValidation = ValidationService.validatePassword(pass);
        if (!passwordValidation.valid) {
            setAuthMessage({ text: passwordValidation.error || "Contraseña inválida", type: 'error' });
            setProcessing(false);
            return;
        }

        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e: any) {
            const errorMap: Record<string, string> = {
                'auth/user-not-found': 'El correo no está registrado',
                'auth/wrong-password': 'Contraseña incorrecta',
                'auth/invalid-email': 'Email inválido',
                'auth/user-disabled': 'Cuenta desactivada'
            };
            setAuthMessage({ text: errorMap[e.code] || "Credenciales inválidas", type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setAuthMessage(null);
        const email = (e.target as any).email.value?.trim() || '';
        const pass = (e.target as any).pass.value;
        const nombre = (e.target as any).nombre.value?.trim() || '';
        const apellido = (e.target as any).apellido.value?.trim() || '';

        // Validate all inputs
        const emailValidation = ValidationService.validateEmail(email);
        if (!emailValidation.valid) {
            setAuthMessage({ text: emailValidation.error || "Email inválido", type: 'error' });
            setProcessing(false);
            return;
        }

        const passwordValidation = ValidationService.validatePassword(pass);
        if (!passwordValidation.valid) {
            setAuthMessage({ text: passwordValidation.error || "Contraseña inválida", type: 'error' });
            setProcessing(false);
            return;
        }

        const nombreValidation = ValidationService.validateName(nombre);
        if (!nombreValidation.valid) {
            setAuthMessage({ text: nombreValidation.error || "Nombre inválido", type: 'error' });
            setProcessing(false);
            return;
        }

        const apellidoValidation = ValidationService.validateName(apellido);
        if (!apellidoValidation.valid) {
            setAuthMessage({ text: apellidoValidation.error || "Apellido inválido", type: 'error' });
            setProcessing(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            // Create user profile with sanitized data
            const newUserProfile = {
                authUid: userCredential.user.uid,
                email: ValidationService.sanitizeInput(email),
                nombre: ValidationService.sanitizeInput(nombre.toUpperCase()),
                apellido: ValidationService.sanitizeInput(apellido.toUpperCase()),
                area: "Sin Área",
                createdAt: serverTimestamp()
            };
            await addDoc(collection(db, `artifacts/${appId}/public/data/users`), newUserProfile);
            setAuthMessage({ text: "Cuenta creada exitosamente", type: 'success' });
        } catch (e: any) {
            const errorMap: Record<string, string> = {
                'auth/email-already-in-use': 'El correo ya está registrado',
                'auth/weak-password': 'La contraseña es muy débil',
                'auth/invalid-email': 'Email inválido'
            };
            setAuthMessage({ text: errorMap[e.code] || "Error al crear cuenta", type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        setAuthMessage(null);
        const email = (e.target as any).email.value?.trim() || '';

        // Validate email
        const emailValidation = ValidationService.validateEmail(email);
        if (!emailValidation.valid) {
            setAuthMessage({ text: emailValidation.error || "Email inválido", type: 'error' });
            setProcessing(false);
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            setAuthMessage({ text: "Enlace de recuperación enviado al correo", type: 'success' });
        } catch (e: any) {
            const errorMap: Record<string, string> = {
                'auth/user-not-found': 'El correo no está registrado',
                'auth/invalid-email': 'Email inválido'
            };
            setAuthMessage({ text: errorMap[e.code] || "Error al enviar enlace", type: 'error' });
        } finally {
            setProcessing(false);
        }
    };

    // Data Handlers
    const handleToggleState = async (pieceId: string, stateKey: string, currentVal: any) => {
        if (!canEditState(stateKey)) return;
        const isDone = isStateComplete(currentVal);
        const newState = !isDone;
        const stateLabel = STATES.find(s => s.key === stateKey)?.label || stateKey;

        const auditObj = { 
            completado: newState, 
            usuarioId: userProfile?.id || null, 
            usuarioNombre: userProfile ? `${userProfile.nombre} ${userProfile.apellido}` : 'Sistema', 
            fecha: new Date() 
        };

        const batch = writeBatch(db);
        const pieceRef = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, pieceId);
        batch.update(pieceRef, { [stateKey]: auditObj });

        const logRef = doc(collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/sync_logs`));
        const pieceData = pieces.find(p => p.id === pieceId);
        batch.set(logRef, {
            date: serverTimestamp(),
            user: userProfile ? `${userProfile.nombre} ${userProfile.apellido}` : 'Desconocido',
            file: `Cambio de Estado`,
            added: 0,
            removed: 0,
            addedDetails: `Estado "${stateLabel}" marcado como ${newState ? 'OK' : 'PENDIENTE'} para pieza ${pieceData?.conjunto}`,
            removedDetails: ''
        });

        await batch.commit();
    };

    const handleSaveComment = async () => {
        if (!commentTarget || !activeProjectId) return;

        // Validate comment length
        const comment = (commentTarget.text || '').trim();
        if (comment.length > 1000) {
            alert("La nota no puede exceder 1000 caracteres");
            return;
        }

        setProcessing(true);
        try {
            const pieceRef = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, commentTarget.id);
            // Sanitize comment before saving
            await updateDoc(pieceRef, {
                comentario: ValidationService.sanitizeInput(comment)
            });
            setModals(m => ({ ...m, comment: false }));
            setCommentTarget(null);
            alert("✅ Nota guardada correctamente");
        } catch (err: any) {
            console.error('Comment save error:', err);
            alert("❌ Error al guardar nota: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleMassPhase = async (newPhase: string) => {
        if (!activeProjectId || selectedPieces.size === 0) return;
        setProcessing(true);
        try {
            const batchSize = 500;
            const idsArray = Array.from(selectedPieces);
            for (let i = 0; i < idsArray.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = idsArray.slice(i, i + batchSize);
                chunk.forEach(id => {
                    const ref = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, id);
                    batch.update(ref, { lote: newPhase });
                });
                await batch.commit();
            }
            setSelectedPieces(new Set());
            setModals(m => ({ ...m, massPhase: false }));
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeProjectId) return;

        // Validate file
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
            alert("El archivo es demasiado grande (máximo 10MB)");
            return;
        }

        const validTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv)$/i)) {
            alert("Solo se permiten archivos Excel o CSV");
            return;
        }

        setProcessing(true);
        try {
            const data = await readExcel(file);
            const totalItems = data.length;

            // Validate each piece
            const validationErrors: { index: number; piece: any; errors: any[] }[] = [];
            const validPieces: any[] = [];

            data.forEach((item, index) => {
                const validation = ValidationService.validatePieceData(item);
                if (!validation.valid) {
                    validationErrors.push({ index, piece: item, errors: validation.errors });
                } else {
                    // Sanitize piece data before saving
                    validPieces.push({
                        conjunto: ValidationService.sanitizeInput(item.conjunto),
                        numero: Math.max(1, parseInt(item.numero) || 1),
                        area: Math.max(0, parseFloat(item.area) || 0),
                        peso: Math.max(0, parseFloat(item.peso) || 0),
                        lote: item.lote || '',
                        eliminada: false,
                        comentario: ''
                    });
                }
            });

            if (validationErrors.length > 0) {
                const errorSummary = validationErrors.slice(0, 5)
                    .map(e => `Fila ${e.index + 1}: ${e.errors.map(err => err.message).join(', ')}`)
                    .join('\n');
                alert(`Se encontraron ${validationErrors.length} errores de validación:\n\n${errorSummary}${validationErrors.length > 5 ? '\n...' : ''}`);
                setProcessing(false);
                return;
            }

            if (validPieces.length === 0) {
                alert("No se encontraron piezas válidas para importar");
                setProcessing(false);
                return;
            }

            const batchSize = 450;

            for (let i = 0; i < validPieces.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = validPieces.slice(i, i + batchSize);

                chunk.forEach(item => {
                    const ref = doc(collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`));
                    batch.set(ref, {
                        ...item,
                        loadedAt: serverTimestamp(),
                        loadedBy: userProfile ? `${userProfile.nombre} ${userProfile.apellido}` : 'Sistema'
                    });
                });

                if (i + batchSize >= validPieces.length) {
                    const logRef = doc(collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/sync_logs`));
                    batch.set(logRef, {
                        date: serverTimestamp(),
                        user: userProfile ? `${userProfile.nombre} ${userProfile.apellido}` : 'Sistema',
                        file: file.name,
                        added: validPieces.length,
                        removed: 0,
                        addedDetails: `Importación masiva de ${validPieces.length} piezas finalizada correctamente.`,
                        removedDetails: ''
                    });
                }
                await batch.commit();
            }
            alert(`✅ Sincronización completa: ${validPieces.length} piezas importadas correctamente.`);
        } catch (err: any) {
            console.error('Import error:', err);
            alert("❌ Error en importación: " + (err.message || "Intenta de nuevo"));
        } finally {
            setProcessing(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleProjectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editTargetProject) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target?.result as string;
            setEditTargetProject(prev => prev ? { ...prev, imageUrl: base64String } : null);
        };
        reader.readAsDataURL(file);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target?.result as string;
            setProfileEditData(prev => ({ ...prev, avatarUrl: base64String }));
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        const nombre = (profileEditData.nombre || '').trim();
        const apellido = (profileEditData.apellido || '').trim();
        const area = profileEditData.area || '';

        const nombreValidation = ValidationService.validateName(nombre);
        if (!nombreValidation.valid) { alert(nombreValidation.error || "Nombre inválido"); return; }

        const apellidoValidation = ValidationService.validateName(apellido);
        if (!apellidoValidation.valid) { alert(apellidoValidation.error || "Apellido inválido"); return; }

        if (!area || !AREAS.includes(area)) { alert("Área inválida"); return; }

        setProcessing(true);
        try {
            const updatedData = {
                nombre: ValidationService.sanitizeInput(nombre.toUpperCase()),
                apellido: ValidationService.sanitizeInput(apellido.toUpperCase()),
                area: ValidationService.sanitizeInput(area),
                avatarUrl: profileEditData.avatarUrl || ''
            };

            let profileId = userProfile?.id;

            // If profile wasn't loaded yet, try to find it in Firestore
            if (!profileId && user) {
                const q = query(collection(db, `artifacts/${appId}/public/data/users`), where("authUid", "==", user.uid), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    profileId = snap.docs[0].id;
                    const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile;
                    setUserProfile(data);
                    setProfileEditData(data);
                } else {
                    // Profile doesn't exist yet — create it
                    const newRef = await addDoc(collection(db, `artifacts/${appId}/public/data/users`), {
                        authUid: user.uid,
                        email: user.email || '',
                        ...updatedData,
                        createdAt: serverTimestamp()
                    });
                    profileId = newRef.id;
                    setUserProfile({ id: profileId, authUid: user.uid, email: user.email || '', ...updatedData } as UserProfile);
                    setModals(m => ({ ...m, profile: false }));
                    alert("✅ Perfil creado correctamente");
                    return;
                }
            }

            if (!profileId) { alert("❌ No se pudo identificar el perfil. Recargá la página."); return; }

            await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, profileId), updatedData);
            setUserProfile(prev => prev ? ({ ...prev, ...updatedData }) : null);
            setModals(m => ({ ...m, profile: false }));
            alert("✅ Perfil actualizado correctamente");
        } catch (err: any) {
            console.error('Profile update error:', err);
            alert("❌ Error al guardar perfil: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateProjectAssets = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTargetProject) return;
        setProcessing(true);
        try {
            const projectRef = doc(db, `artifacts/${appId}/public/data/projects`, editTargetProject.id);
            await updateDoc(projectRef, {
                imageUrl: editTargetProject.imageUrl || '',
                externalLink: editTargetProject.externalLink || ''
            });
            setModals(m => ({...m, editProject: false}));
            setEditTargetProject(null);
        } catch (e: any) {
            alert("Error al actualizar multimedia: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleExportExcel = () => {
        if (!pieces.length || !activeProject) return;
        
        const dataToExport = pieces.filter(p => !p.eliminada).map(p => {
            const row: any = {
                'Conjunto/Pieza': p.conjunto,
                'Fase': p.lote || '---',
                'Masa (kg)': (p.peso || 0).toFixed(2),
                'Comentario': p.comentario || '',
            };
            
            STATES.forEach(s => {
                const status = p[s.key];
                row[s.label] = isStateComplete(status) ? 'COMPLETADO' : 'PENDIENTE';
            });
            
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Planilla");
        XLSX.writeFile(workbook, `Seguimiento_${activeProject.name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExportPiecesPDF = () => {
        if (!filteredPieces.length || !activeProject) return;
        const doc = new jsPDF('l', 'mm', 'a4');
        const title = `Listado de Piezas - ${activeProject.name}`;
        
        doc.setFontSize(16);
        doc.text(title, 14, 20);
        doc.setFontSize(10);
        doc.text(`Fecha de Reporte: ${new Date().toLocaleString()}`, 14, 28);

        const tableHeaders = ['Conjunto/Pieza', 'Fase', 'Peso (kg)', ...STATES.map(s => s.label)];
        const tableData = filteredPieces.map(p => [
            p.conjunto,
            p.lote || '---',
            (p.peso || 0).toFixed(2),
            ...STATES.map(s => isStateComplete(p[s.key]) ? 'OK' : '-')
        ]);

        autoTable(doc, {
            head: [tableHeaders],
            body: tableData,
            startY: 35,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });

        doc.save(`Piezas_${activeProject.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const handleExportMonitorPDF = async () => {
        if (!activeProject) return;
        setProcessing(true);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const margin = 14;

            doc.setFillColor(51, 65, 85);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.text("INFORME DE PRODUCCIÓN", margin, 20);
            doc.setFontSize(12);
            doc.text(activeProject.name, margin, 30);
            
            doc.setTextColor(51, 65, 85);
            doc.setFontSize(10);
            doc.text(`Generado por: ${userProfile?.nombre} ${userProfile?.apellido}`, margin, 50);
            doc.text(`Fecha: ${new Date().toLocaleString()}`, margin, 55);

            doc.setFontSize(14);
            doc.text("Resumen de Avance", margin, 70);
            const cert = stats.totalKg > 0 ? ((stats.statesKg['montado'] / stats.totalKg) * 100).toFixed(1) : 0;
            
            autoTable(doc, {
                startY: 75,
                head: [['Indicador', 'Valor']],
                body: [
                    ['Porcentaje de Certificación (Montado)', `${cert}%`],
                    ['Tonelaje Total de Obra', `${(stats.totalKg / 1000).toFixed(2)} toneladas`],
                    ['Piezas en Tránsito / Logística', `${stats.despachadoSinMontar} unidades`],
                    ['Piezas Listas para Despacho', `${stats.listoParaDespacho} unidades`],
                    ['Piezas en Proceso de Fábrica', `${stats.enFabricacion} unidades`],
                    ['Piezas Finalizadas', `${stats.completado} unidades`]
                ],
                theme: 'striped',
                headStyles: { fillColor: [13, 148, 136] }
            });

            doc.text("Avance por Etapa de Fabricación", margin, (doc as any).lastAutoTable.finalY + 15);
            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 20,
                head: [['Etapa', 'Peso Procesado (kg)', 'Unidades OK']],
                body: STATES.map(s => [
                    s.label,
                    (stats.statesKg[s.key] || 0).toLocaleString(),
                    stats.statesCount[s.key] || 0
                ]),
                theme: 'grid'
            });

            doc.addPage();
            doc.setFillColor(51, 65, 85);
            doc.rect(0, 0, 210, 20, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.text("REPORTE VISUAL DE MONITOREO", margin, 13);
            
            doc.setTextColor(51, 65, 85);
            doc.setFontSize(14);
            
            let currentY = 35;

            if (chart1Ref.current) {
                const canvas1 = await html2canvas(chart1Ref.current, { scale: 2 });
                const imgData1 = canvas1.toDataURL('image/png');
                doc.text("Flujo de Producción (Tonelaje)", margin, currentY);
                doc.addImage(imgData1, 'PNG', margin, currentY + 5, 180, 80);
                currentY += 105;
            }

            if (chart2Ref.current) {
                const canvas2 = await html2canvas(chart2Ref.current, { scale: 2 });
                const imgData2 = canvas2.toDataURL('image/png');
                doc.text("Conteo Unitario por Etapa", margin, currentY);
                doc.addImage(imgData2, 'PNG', margin, currentY + 5, 180, 80);
            }

            doc.save(`Monitor_${activeProject.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Error al exportar PDF:", error);
            alert("Ocurrió un error al generar el PDF.");
        } finally {
            setProcessing(false);
        }
    };

    if (!isConfigured) return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-red-50 p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <div className="max-w-md text-center">
                <h1 className="text-xl font-black text-red-700 uppercase tracking-widest mb-3">
                    Configuración No Detectada
                </h1>
                <p className="text-sm text-red-600 mb-4 font-medium">
                    Firebase no está configurado correctamente. Las variables de entorno VITE_FIREBASE_* no se encuentran.
                </p>
                <div className="bg-white rounded-xl p-4 text-left text-xs font-mono text-slate-700 border border-red-200 mb-6">
                    <p className="font-bold text-red-600 mb-2">Verifica que en Netlify estén configuradas:</p>
                    <ul className="space-y-1 text-slate-600">
                        <li>✓ VITE_FIREBASE_API_KEY</li>
                        <li>✓ VITE_FIREBASE_AUTH_DOMAIN</li>
                        <li>✓ VITE_FIREBASE_PROJECT_ID</li>
                        <li>✓ VITE_FIREBASE_STORAGE_BUCKET</li>
                        <li>✓ VITE_FIREBASE_MESSAGING_SENDER_ID</li>
                        <li>✓ VITE_FIREBASE_APP_ID</li>
                    </ul>
                </div>
                <p className="text-xs text-slate-500">
                    Consulta la consola del navegador (F12) para más detalles
                </p>
            </div>
        </div>
    );

    if (authLoading) return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
            <Loader2 className="w-10 h-10 animate-spin text-slate-300" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Accediendo...</p>
        </div>
    );

    if (modals.login) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 flex flex-col items-center border border-slate-200">
                    <img src="https://www.solanasrl.com.ar/wp-content/uploads/cropped-sticky-2.png" className="w-48 mb-12" alt="Solana" />
                    
                    <div className="w-full space-y-8 animate-in fade-in duration-500">
                        <div className="text-center">
                            <h1 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-2">
                                {authMode === 'login' ? 'Acceso Industrial' : authMode === 'signup' ? 'Registro de Cuenta' : 'Recuperar Acceso'}
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                {authMode === 'login' ? 'INGRESE SUS CREDENCIALES DE SOLANA' : authMode === 'signup' ? 'COMPLETE LOS DATOS PARA SU NUEVA CUENTA' : 'LE ENVIAREMOS UN ENLACE PARA RESTABLECER'}
                            </p>
                        </div>

                        {authMode === 'login' && (
                            <form className="w-full space-y-4" onSubmit={handleLogin}>
                                <div className="relative">
                                    <Mail className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input name="email" type="email" required placeholder="CORREO ELECTRÓNICO" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-all font-bold text-xs tracking-widest" />
                                </div>
                                <div className="relative">
                                    <Key className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input name="pass" type="password" required placeholder="CONTRASEÑA" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-all font-bold text-xs tracking-widest" />
                                </div>
                                <Button type="submit" loading={processing} className="w-full h-14">Entrar</Button>
                                
                                <div className="flex flex-col gap-3 pt-4">
                                    <button type="button" onClick={() => { setAuthMode('forgot'); setAuthMessage(null); }} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">¿Olvidó su contraseña?</button>
                                    <div className="h-px bg-slate-100" />
                                    <button type="button" onClick={() => { setAuthMode('signup'); setAuthMessage(null); }} className="flex items-center justify-center gap-2 text-[10px] font-black text-teal-600 uppercase hover:text-teal-700 transition-colors">
                                        <UserPlus className="w-3.5 h-3.5" /> Crear una cuenta nueva
                                    </button>
                                </div>
                            </form>
                        )}

                        {authMode === 'signup' && (
                            <form className="w-full space-y-4" onSubmit={handleSignUp}>
                                <div className="grid grid-cols-2 gap-3">
                                    <input name="nombre" required placeholder="NOMBRE" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 font-bold text-xs tracking-widest" />
                                    <input name="apellido" required placeholder="APELLIDO" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 font-bold text-xs tracking-widest" />
                                </div>
                                <div className="relative">
                                    <Mail className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input name="email" type="email" required placeholder="CORREO ELECTRÓNICO" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-all font-bold text-xs tracking-widest" />
                                </div>
                                <div className="relative">
                                    <Key className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input name="pass" type="password" required placeholder="CREAR CONTRASEÑA" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-all font-bold text-xs tracking-widest" />
                                </div>
                                <Button type="submit" loading={processing} className="w-full h-14 bg-teal-600 hover:bg-teal-700">Registrarse</Button>
                                <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(null); }} className="w-full text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">Volver al inicio de sesión</button>
                            </form>
                        )}

                        {authMode === 'forgot' && (
                            <form className="w-full space-y-4" onSubmit={handlePasswordReset}>
                                <div className="relative">
                                    <Mail className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                                    <input name="email" type="email" required placeholder="CORREO ELECTRÓNICO" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-6 py-4 text-slate-800 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-all font-bold text-xs tracking-widest" />
                                </div>
                                <Button type="submit" loading={processing} className="w-full h-14">Enviar Enlace</Button>
                                <button type="button" onClick={() => { setAuthMode('login'); setAuthMessage(null); }} className="w-full text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-colors">Volver al inicio de sesión</button>
                            </form>
                        )}

                        {authMessage && (
                            <div className={`p-4 rounded-xl text-center border animate-in slide-in-from-top-2 duration-300 ${authMessage.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-teal-50 border-teal-100 text-teal-600'}`}>
                                <p className="text-[10px] font-black uppercase tracking-widest">{authMessage.text}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const SidebarContent = () => (
        <>
            <div className="p-8">
                <div className="flex items-center gap-4 mb-10">
                    <SolanaSymbol />
                    <div>
                        <h2 className="text-white font-black tracking-tight text-lg uppercase leading-none">SOLANA</h2>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-400 mt-1">Estructural</p>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-2 mb-3">Navegación</label>
                    <button onClick={() => { setActiveView('pieces'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 ${activeView === 'pieces' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>
                        <Database className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Piezas</span>
                    </button>
                    <button onClick={() => { setActiveView('charts'); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 ${activeView === 'charts' ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}>
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Monitor</span>
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <div className="bg-white/5 rounded-2xl p-6 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proyecto Activo</label>
                        <button onClick={() => { setModals(m => ({...m, projects: true})); setMobileMenuOpen(false); }} className="text-[8px] font-black text-teal-400 uppercase tracking-widest hover:text-teal-300 transition-colors">Administrar</button>
                    </div>
                    <select
                        className="w-full bg-transparent text-xs font-black text-white uppercase tracking-tight outline-none cursor-pointer"
                        value={activeProjectId || ''}
                        onChange={(e) => { setActiveProjectId(e.target.value); setMobileMenuOpen(false); }}
                    >
                        <option value="" className="text-slate-900">Seleccionar Obra...</option>
                        {projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id} className="text-slate-900">{p.name}</option>)}
                    </select>
                </div>
            </div>
            <div className="p-8 border-t border-white/5 bg-black/5">
                <div className="flex items-center gap-4 mb-6 group cursor-pointer" onClick={() => { setProfileEditData(userProfile || {}); setModals(m => ({ ...m, profile: true })); setMobileMenuOpen(false); }}>
                    <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-slate-900 font-black overflow-hidden border border-white/10 group-hover:border-teal-400 transition-all">
                            {userProfile?.avatarUrl ? (
                                <img src={userProfile.avatarUrl} className="w-full h-full object-cover" alt="User" />
                            ) : (
                                userProfile?.nombre?.charAt(0) || '?'
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center border border-white/20 group-hover:bg-teal-500 transition-colors">
                            <Settings className="w-2.5 h-2.5 text-white" />
                        </div>
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-black text-white truncate group-hover:text-teal-400 transition-colors">{userProfile ? `${userProfile.nombre} ${userProfile.apellido}` : 'Sin Perfil'}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase truncate leading-none mt-1">{userArea || 'Visitante'}</p>
                    </div>
                </div>
                <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-red-400 transition-all text-[10px] font-black uppercase tracking-widest">
                    <LogOut className="w-4 h-4" /> Desconexión
                </button>
            </div>
        </>
    );

    return (
        <div className="h-screen flex bg-slate-50 overflow-hidden relative">
            <div className="lg:hidden fixed top-4 left-4 z-[100]">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-3 bg-slate-700 text-white rounded-xl shadow-xl active:scale-95 transition-all">
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            <aside className="hidden lg:flex w-72 bg-slate-700 h-full flex-col z-50 shadow-2xl">
                <SidebarContent />
            </aside>

            <div className={`lg:hidden fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)} />
            <aside className={`lg:hidden fixed left-0 top-0 h-full w-72 bg-slate-700 z-[100] flex flex-col shadow-2xl transition-transform duration-300 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </aside>

            <main className="flex-1 overflow-y-auto h-screen custom-scroll bg-[#f8fafc] w-full">
                {processing && (
                    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6 text-center">
                        <Loader2 className="w-12 h-12 md:w-16 md:h-16 animate-spin text-teal-400 mb-6" />
                        <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest">Procesando...</h2>
                    </div>
                )}
                
                <div className="w-full max-w-[1600px] mx-auto p-4 md:p-10 lg:p-14 space-y-6 md:space-y-10">
                    {!activeProjectId ? (
                        <div className="h-[70vh] flex flex-col items-center justify-center px-6 text-center">
                            <Building className="w-12 h-12 md:w-16 md:h-16 text-slate-200 mb-6" />
                            <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-widest">Gestión de Obra</h2>
                            <p className="text-slate-500 text-sm font-bold mt-2">Seleccione una obra activa para comenzar o gestione sus proyectos.</p>
                            <Button onClick={() => setModals(m => ({...m, projects: true}))} variant="secondary" className="mt-8 px-10">Administrar Proyectos</Button>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-5 duration-500 space-y-6 md:space-y-10">
                            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
                                <div className="w-full md:w-auto">
                                    <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase truncate">{activeProject?.name}</h1>
                                    <div className="flex flex-wrap items-center gap-4 md:gap-6 mt-3">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-500 pulse-led" /><p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</p></div>
                                        <div className="flex items-center gap-2"><Weight className="w-3.5 h-3.5 text-slate-300" /><p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{stats.totalKg.toLocaleString()} KG</p></div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                                    <div className="relative flex-1 lg:flex-none h-12 md:h-14 flex items-center bg-slate-50 border border-slate-200 px-4 md:px-6 rounded-xl group transition-all focus-within:border-teal-400">
                                        <Filter className="w-4 h-4 text-slate-400 mr-2 md:mr-3" />
                                        <select className="bg-transparent text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none appearance-none pr-6 md:pr-8 w-full" value={phaseFilter} onChange={e => setPhaseFilter(e.target.value)}>
                                            <option value="">Todas las Fases</option>
                                            {uniquePhases.map(ph => <option key={ph} value={ph}>Fase {ph}</option>)}
                                        </select>
                                        <ChevronDown className="w-4 h-4 absolute right-4 md:right-5 text-slate-400 pointer-events-none" />
                                    </div>
                                    <div className="bg-slate-800 text-white px-5 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl shadow-xl flex flex-col items-center justify-center min-w-[100px] md:min-w-[140px] flex-none">
                                        <span className="text-[7px] md:text-[9px] font-black text-teal-400 uppercase tracking-widest mb-0.5 md:mb-1">Certificado</span>
                                        <span className="text-lg md:text-2xl font-black">{stats.totalKg > 0 ? ((stats.statesKg['montado'] / stats.totalKg) * 100).toFixed(1) : 0}%</span>
                                    </div>
                                </div>
                            </div>

                            {activeView === 'pieces' ? (
                                <div className="space-y-6 md:space-y-8 pb-20">
                                    <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4 md:gap-6">
                                        <div className="flex-1 flex items-center gap-4 w-full">
                                            <div className="relative flex-1 group">
                                                <Search className="w-5 h-5 absolute left-4 md:left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                                                <input placeholder="CONJUNTO..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 md:pl-14 pr-4 md:pr-6 py-3 md:py-4 text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full lg:w-auto justify-end">
                                            {isOT && (
                                                <>
                                                    <Button onClick={() => fileRef.current?.click()} loading={processing} variant="secondary">
                                                        <Upload className="w-4 h-4" /> <span className="hidden md:inline">Importar</span>
                                                    </Button>
                                                    <input type="file" ref={fileRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
                                                </>
                                            )}
                                            <div className="flex bg-white border border-slate-200 rounded-xl p-0.5">
                                                <button onClick={handleExportExcel} className="p-2 md:p-3 text-slate-400 hover:text-slate-900 transition-colors" title="Excel"><FileSpreadsheet className="w-5 h-5" /></button>
                                                <button onClick={handleExportPiecesPDF} className="p-2 md:p-3 text-slate-400 hover:text-slate-900 transition-colors" title="PDF"><FileText className="w-5 h-5" /></button>
                                                <button onClick={() => setModals(m => ({...m, logs: true}))} className="p-2 md:p-3 text-slate-400 hover:text-slate-900 transition-colors" title="Logs"><History className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="hidden lg:flex items-center px-10 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                            <div className="w-10 text-center mr-8">#</div>
                                            <div className="flex-1">Conjunto / Pieza</div>
                                            <div className="w-28 text-right pr-10">Masa (kg)</div>
                                            <div className="w-32 text-center">Fase</div>
                                            <div className="flex-1 flex justify-center gap-6">Procesos Estructurales</div>
                                            <div className="w-24 text-center">Acciones</div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3">
                                            {filteredPieces.length === 0 ? (
                                                <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 text-slate-400 font-bold italic">No se encontraron piezas</div>
                                            ) : filteredPieces.map(p => (
                                                <div key={p.id} className={`bg-white rounded-[1.5rem] md:rounded-2xl p-4 md:px-10 md:py-3.5 flex flex-col lg:flex-row lg:items-center transition-all border border-slate-200 row-card-hover ${selectedPieces.has(p.id) ? 'ring-2 ring-teal-500' : ''}`}>
                                                    <div className="flex items-center justify-between mb-4 lg:mb-0">
                                                        <div className="flex items-center gap-4">
                                                            <button onClick={() => {
                                                                const n = new Set(selectedPieces);
                                                                if (n.has(p.id)) n.delete(p.id); else n.add(p.id);
                                                                setSelectedPieces(n);
                                                            }} className={selectedPieces.has(p.id) ? 'text-teal-600' : 'text-slate-200 hover:text-slate-400'}>
                                                                {selectedPieces.has(p.id) ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                                                            </button>
                                                            <div>
                                                                <p className="font-bold text-slate-700 text-sm md:text-base leading-tight">{p.conjunto}</p>
                                                                <p className="lg:hidden text-[10px] font-black text-slate-400 uppercase mt-1">Masa: {(p.peso||0).toFixed(2)} kg</p>
                                                            </div>
                                                        </div>
                                                        <div className="lg:hidden">
                                                            <span className="text-[9px] font-black bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-lg uppercase">F {p.lote || '-'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="hidden lg:block flex-1" />
                                                    <div className="hidden lg:block w-28 text-right pr-10 font-mono text-xs">{(p.peso||0).toFixed(2)}</div>
                                                    <div className="hidden lg:block w-32 text-center"><span className="text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-lg uppercase">{p.lote || '---'}</span></div>
                                                    
                                                    <div className="flex-1 flex items-center justify-between lg:justify-center gap-3 md:gap-4 overflow-x-auto pb-6 pt-2 lg:pb-0 lg:pt-0 no-scrollbar">
                                                        {STATES.map(s => <StatusBadge key={s.key} state={s} p={p} onToggle={handleToggleState} allowed={canEditState(s.key)} />)}
                                                    </div>

                                                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50 lg:mt-0 lg:pt-0 lg:border-t-0 lg:w-24 lg:justify-center lg:gap-2">
                                                        <div className="flex gap-2">
                                                            <button onClick={() => { setCommentTarget({id: p.id, text: p.comentario}); setModals(m => ({...m, comment: true})); }} className={`p-2 rounded-xl transition-all ${p.comentario ? 'text-teal-600 bg-teal-50' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`} title="Notas"><MessageSquare className="w-5 h-5" /></button>
                                                            <button onClick={() => { setHistoryTargetId(p.id); setModals(m => ({...m, pieceHistory: true})); }} className="p-2 text-slate-300 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all" title="Historia"><History className="w-5 h-5" /></button>
                                                        </div>
                                                        <span className="lg:hidden text-[8px] font-bold text-slate-300 uppercase tracking-tighter">ID: {p.id.slice(0,6)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-500 pb-20">
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                                        <div className="lg:col-span-8 bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[350px] md:min-h-[500px]">
                                            <div className="p-5 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                                                <div>
                                                    <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight uppercase">Modelo BIM</h3>
                                                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronización gráfica</p>
                                                </div>
                                                <div className="flex gap-2 w-full md:w-auto">
                                                    <Button onClick={handleExportMonitorPDF} variant="secondary" className="flex-1 md:flex-none h-10 text-[9px] md:text-[10px] px-3 md:px-5" loading={processing}><FileText className="w-4 h-4" /> PDF</Button>
                                                    {isOT && (
                                                        <button onClick={() => { setEditTargetProject(activeProject!); setModals(m => ({...m, editProject: true})); }} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 transition-all"><Edit3 className="w-5 h-5" /></button>
                                                    )}
                                                    {activeProject?.externalLink && (
                                                        <a href={activeProject.externalLink} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none">
                                                            <Button className="w-full h-10 text-[9px] md:text-[10px] px-3 md:px-5"><ExternalLink className="w-4 h-4" /> Enlace</Button>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-1 bg-slate-50 relative flex items-center justify-center min-h-[250px]">
                                                {activeProject?.imageUrl ? <img src={activeProject.imageUrl} className="w-full h-full object-contain" alt="Proyecto" /> : <div className="flex flex-col items-center opacity-20"><ImageIcon className="w-12 h-12 md:w-20 md:h-20 mb-4" /><p className="font-black uppercase tracking-widest text-[9px] md:text-xs text-center">Sin Multimedia</p></div>}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-4 flex flex-col gap-6">
                                            <div className="bg-slate-800 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 text-white shadow-xl flex-1 flex flex-col">
                                                <div className="flex justify-between items-center mb-6"><h4 className="text-[9px] md:text-[10px] font-black text-teal-400 uppercase tracking-widest">Avance por Fase</h4></div>
                                                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scroll pr-2 md:pr-4">
                                                    {(phaseFilter ? uniquePhases.filter(ph => ph === phaseFilter) : uniquePhases).map(ph => {
                                                        const phPieces = pieces.filter(p => (p.lote||"").toString() === ph && !p.eliminada);
                                                        const montado = phPieces.filter(p => isStateComplete(p.montado)).length;
                                                        const progress = phPieces.length > 0 ? (montado / phPieces.length) * 100 : 0;
                                                        return (<div key={ph} className="p-4 md:p-5 bg-white/5 rounded-2xl border border-white/5"><div className="flex justify-between items-center mb-2"><span className="text-xs md:text-sm font-black uppercase">Fase {ph}</span><span className="text-teal-400 font-bold text-xs">{progress.toFixed(0)}%</span></div><div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${progress}%` }} /></div></div>);
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                        {[
                                            { label: "En Tránsito", val: stats.despachadoSinMontar, icon: Truck, color: "amber" },
                                            { label: "Listo Desp.", val: stats.listoParaDespacho, icon: Warehouse, color: "emerald" },
                                            { label: "En Proceso", val: stats.enFabricacion, icon: Boxes, color: "blue" },
                                            { label: "Montado", val: stats.completado, icon: Ship, color: "teal" }
                                        ].map(card => (
                                            <div key={card.label} className="bg-white p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
                                                <div className={`p-3 md:p-4 w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl mb-3 md:mb-6 flex items-center justify-center bg-${card.color}-50 text-${card.color}-600`}><card.icon className="w-5 h-5 md:w-6 md:h-6" /></div>
                                                <p className="text-xl md:text-4xl font-black text-slate-900 tracking-tighter">{card.val}</p>
                                                <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 md:mt-2">{card.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-10">
                                        <div ref={chart1Ref} className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 border border-slate-200 shadow-sm h-[350px] md:h-[500px] flex flex-col">
                                            <h3 className="text-sm md:text-xl font-black text-slate-900 tracking-tight uppercase mb-6 md:mb-10">Tonelaje por Etapa</h3>
                                            <div className="flex-1 w-full overflow-hidden">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={STATES.map(s => ({ name: s.label, kg: stats.statesKg[s.key] || 0, color: s.color }))}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '8px' }} interval={0} angle={-45} textAnchor="end" height={50} />
                                                        <YAxis hide axisLine={false} tickLine={false} />
                                                        <Bar dataKey="kg" radius={[6, 6, 0, 0]} barSize={20}>
                                                            {STATES.map((s, index) => <Cell key={`cell-${index}`} fill={s.color} />)}
                                                            <LabelList dataKey="kg" position="top" formatter={(v: number) => `${(v/1000).toFixed(1)}t`} style={{ fontSize: '8px', fontWeight: '800' }} />
                                                        </Bar>
                                                        <Line type="monotone" dataKey="kg" stroke="#334155" strokeWidth={2} dot={{ r: 4, fill: '#334155' }} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div ref={chart2Ref} className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-12 border border-slate-200 shadow-sm h-[350px] md:h-[500px] flex flex-col">
                                            <h3 className="text-sm md:text-xl font-black text-slate-900 tracking-tight uppercase mb-6 md:mb-10">Unidades Totales</h3>
                                            <div className="flex-1 w-full overflow-hidden">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={STATES.map(s => ({ name: s.label, count: stats.statesCount[s.key] || 0 }))} layout="vertical">
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} style={{ fontSize: '8px' }} />
                                                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={15}>
                                                            {STATES.map((s, index) => <Cell key={`cell-${index}`} fill={s.color} fillOpacity={0.2} stroke={s.color} strokeWidth={2} />)}
                                                            <LabelList dataKey="count" position="right" style={{ fontSize: '9px', fontWeight: '800' }} />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <button onClick={() => setActiveView(activeView === 'pieces' ? 'charts' : 'pieces')} className="fixed bottom-6 right-6 w-14 h-14 md:w-16 md:h-16 bg-slate-700 text-white rounded-2xl md:rounded-[1.8rem] shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all z-[80] border-4 border-white">
                {activeView === 'pieces' ? <Activity className="w-6 h-6 md:w-7 md:h-7" /> : <Boxes className="w-6 h-6 md:w-7 md:h-7" />}
            </button>

            {selectedPieces.size > 0 && (
                <div className="fixed bottom-24 left-4 right-4 md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:right-auto z-[80] animate-in slide-in-from-bottom-10">
                    <div className="bg-slate-700 text-white px-6 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-[2.5rem] shadow-2xl flex items-center justify-between md:gap-10 border border-white/10 backdrop-blur-md">
                        <div className="flex flex-col md:flex-row md:items-center md:gap-2"><span className="font-black text-lg md:text-xl leading-none">{selectedPieces.size}</span><span className="text-[7px] md:text-[10px] opacity-40 uppercase tracking-widest font-bold">Piezas</span></div>
                        <div className="hidden md:block w-px h-10 bg-white/10" />
                        <div className="flex gap-2"><button onClick={() => setModals(m => ({...m, massPhase: true}))} className="px-4 md:px-8 py-2 md:py-3 bg-white text-slate-800 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase shadow-xl hover:scale-105 active:scale-95 transition-all">Fase</button><button onClick={() => setSelectedPieces(new Set())} className="px-4 md:px-8 py-2 md:py-3 bg-white/10 hover:bg-white/20 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase transition-all">Limpiar</button></div>
                    </div>
                </div>
            )}

            <Modal isOpen={modals.profile} onClose={() => setModals(m => ({ ...m, profile: false }))} title="Perfil Usuario">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="flex flex-col items-center mb-6">
                        <div onClick={() => avatarRef.current?.click()} className="relative w-24 h-24 rounded-[1.5rem] bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-teal-400 group overflow-hidden transition-all">
                            {profileEditData.avatarUrl ? <img src={profileEditData.avatarUrl} className="w-full h-full object-cover" alt="Avatar" /> : <UserCircle className="w-10 h-10 text-slate-300 group-hover:text-teal-400" />}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="text-white w-5 h-5" /></div>
                            <input type="file" ref={avatarRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold text-slate-800 outline-none" value={profileEditData.nombre || ''} onChange={e => setProfileEditData(prev => ({ ...prev, nombre: e.target.value }))} required /></div>
                        <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Apellido</label><input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold text-slate-800 outline-none" value={profileEditData.apellido || ''} onChange={e => setProfileEditData(prev => ({ ...prev, apellido: e.target.value }))} required /></div>
                    </div>
                    <div className="p-6 bg-slate-800 rounded-2xl space-y-4">
                        <label className="text-[9px] font-black text-teal-400 uppercase tracking-widest block">Área de Desempeño</label>
                        <select className="w-full bg-slate-700 border border-white/10 rounded-xl px-5 py-3 text-xs font-black text-white uppercase outline-none" value={profileEditData.area || ''} onChange={e => setProfileEditData(prev => ({ ...prev, area: e.target.value }))} required>
                            <option value="" disabled>Seleccionar Área...</option>
                            {AREAS.map(area => <option key={area} value={area}>{area}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><Button variant="ghost" onClick={() => setModals(m => ({ ...m, profile: false }))}>Cancelar</Button><Button type="submit" loading={processing} className="flex-1 md:flex-none">Guardar</Button></div>
                </form>
            </Modal>

            <Modal isOpen={modals.comment} onClose={() => { setModals(m => ({...m, comment: false})); setCommentTarget(null); }} title="Observaciones">
                <div className="space-y-6"><textarea className="w-full min-h-[120px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-800 outline-none focus:border-teal-500" placeholder="Nota interna..." value={commentTarget?.text || ''} onChange={e => setCommentTarget(prev => prev ? {...prev, text: e.target.value} : null)} /><Button onClick={handleSaveComment} loading={processing} className="w-full">Guardar Nota</Button></div>
            </Modal>

            <Modal isOpen={modals.massPhase} onClose={() => setModals(m => ({...m, massPhase: false}))} title="Cambio de Fase">
                <div className="space-y-6"><input placeholder="Nueva Fase..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-sm font-black text-slate-800 outline-none" id="massPhaseInput" /><Button onClick={() => { const val = (document.getElementById('massPhaseInput') as HTMLInputElement).value; handleMassPhase(val); }} loading={processing} className="w-full">Confirmar</Button></div>
            </Modal>

            <Modal isOpen={modals.pieceHistory} onClose={() => { setModals(m => ({...m, pieceHistory: false})); setHistoryTargetId(null); }} title={`Bitácora: ${historyTarget?.conjunto || ''}`}>
                <div className="space-y-4">
                    {!historyTarget ? <p className="text-center py-10 font-bold opacity-30">Sin datos</p> : STATES.map(s => {
                        const audit = historyTarget[s.key] as AuditStatus;
                        const done = isStateComplete(audit);
                        return (<div key={s.key} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${done ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-40'}`}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: done ? s.color : '#cbd5e1' }}>{done ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}</div><p className="text-[10px] font-black text-slate-800 uppercase">{s.label}</p></div>{done && (<div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase">{audit.usuarioNombre || 'Sistema'}</p><p className="text-[7px] font-bold text-slate-300">{formatTime(audit.fecha)}</p></div>)}</div>);
                    })}
                </div>
            </Modal>

            <Modal isOpen={modals.projects} onClose={() => setModals(m => ({...m, projects: false}))} title="Obras Solana" size="lg">
                <div className="space-y-8">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const name = (e.target as any).pname.value;
                        if (!name) return;
                        setProcessing(true);
                        addDoc(collection(db, `artifacts/${appId}/public/data/projects`), { name: name.toUpperCase(), createdAt: serverTimestamp(), archived: false }).then(() => { (e.target as any).reset(); setProcessing(false); }).catch((err) => { alert("❌ Error al crear obra: " + err.message); setProcessing(false); });
                    }} className="flex flex-col md:flex-row gap-3"><input name="pname" placeholder="NOMBRE DE LA OBRA..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold uppercase outline-none" required /><Button type="submit" loading={processing} className="w-full md:w-auto px-10">Crear Obra</Button></form>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scroll pr-2">
                        {projects.map(p => (<div key={p.id} className={`flex items-center justify-between p-4 md:p-6 rounded-2xl border transition-all ${p.archived ? 'bg-slate-50 opacity-40 border-slate-100' : 'bg-white border-slate-200 hover:shadow-lg'}`}><div className="flex items-center gap-4 truncate"><Building className="w-5 h-5 text-slate-300 flex-none" /><div className="truncate"><h4 className="font-black text-slate-900 tracking-tight text-sm uppercase truncate">{p.name}</h4><p className="text-[8px] font-bold text-slate-400 uppercase mt-1">ID: {p.id.slice(0,8)}</p></div></div><div className="flex gap-2">{!p.archived && <button onClick={() => { setActiveProjectId(p.id); setModals(m => ({...m, projects: false})); }} className="px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-[9px] font-black uppercase border border-teal-100 active:scale-95 transition-all">Abrir</button>}{isOT && (<button onClick={() => confirm("Eliminar?") && deleteDoc(doc(db, `artifacts/${appId}/public/data/projects`, p.id))} className="p-2 text-slate-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>)}</div></div>))}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={modals.logs} onClose={() => setModals(m => ({...m, logs: false}))} title="Historial Operativo" size="lg">
                <div className="space-y-4 max-h-[65vh] overflow-y-auto custom-scroll pr-4 py-2">
                    {syncLogs.length === 0 ? <div className="text-center py-20 text-slate-400 font-bold italic">No hay registros recientes</div> : syncLogs.map(log => (<div key={log.id} className="p-6 bg-white rounded-[2rem] border border-slate-200 shadow-sm"><div className="flex justify-between items-center mb-4"><div className="flex items-center gap-4"><div className="p-3 bg-slate-50 rounded-xl text-slate-700"><ClipboardList className="w-5 h-5" /></div><div><p className="font-black text-slate-900 text-base uppercase">{log.user}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formatTime(log.date)}</p></div></div>{log.added > 0 && <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[10px] font-black border border-emerald-100">+{log.added} Piezas</span>}</div><div className="px-5 py-4 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-600 leading-relaxed italic">"{log.addedDetails}"</div></div>))}
                </div>
            </Modal>

            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes pulse-soft { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
                .pulse-led { animation: pulse-soft 2s infinite ease-in-out; }
            `}</style>
        </div>
    );
}
