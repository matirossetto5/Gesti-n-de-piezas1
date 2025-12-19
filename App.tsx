import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    User 
} from 'firebase/auth';
import { 
    collection, query, where, getDocs, addDoc, updateDoc, 
    doc, onSnapshot, deleteDoc, orderBy, limit, setDoc, writeBatch
} from 'firebase/firestore';
import { auth, db, appId } from './firebase';
import { 
    UserProfile, Project, Piece, 
    AREAS, STATES, AREA_PERMISSIONS, AuditStatus 
} from './types';
import { formatTime, readExcel, isStateComplete } from './utils';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, Legend
} from 'recharts';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
    Loader2, LogOut, User as UserIcon, Building, FileSpreadsheet, 
    BarChart3, List, CheckCircle2, MessageSquare, 
    AlertTriangle, Trash2, Eye, Upload, Download,
    Filter, Search, ChevronDown, Plus, Save, Edit2, X, Maximize2,
    PieChart as PieIcon, Activity, Scale, Layers, Box, Image as ImageIcon,
    HelpCircle, FileBox, ArrowRight, Link as LinkIcon, ExternalLink, Unlink,
    History, Calendar, Clock, Archive, ArchiveRestore, Settings, Monitor
} from 'lucide-react';

// --- Brand Components ---

const SolanaSymbol = ({ className = "w-10 h-10" }: { className?: string }) => (
    <div className={`${className} rounded-xl overflow-hidden shrink-0 shadow-md border border-slate-100 bg-white`}>
        <img 
            src="https://media.licdn.com/dms/image/v2/C4E0BAQENkX0orEV8KQ/company-logo_200_200/company-logo_200_200/0/1630620084700?e=2147483647&v=beta&t=8OGYSccaJ78FnSmrdWKlTs0G_EYREXv8gvSJoIaL-DQ" 
            alt="Solana Isotype" 
            className="w-full h-full object-cover"
        />
    </div>
);

const SolanaLogoFull = ({ className = "w-full max-w-[280px]" }: { className?: string }) => (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
        <img 
            src="https://www.solanasrl.com.ar/wp-content/uploads/cropped-sticky-2.png" 
            alt="Solana SRL Logo" 
            className="w-full h-auto drop-shadow-sm"
        />
    </div>
);

// --- UI Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, loading = false, title = '', type = 'button' }: any) => {
    const baseStyle = "h-11 px-5 py-2 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm active:scale-95";
    
    const variants = {
        primary: "bg-[#0E3B43] text-white hover:bg-[#15535e] hover:shadow-lg hover:shadow-[#0e3b43]/20 border border-transparent",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md",
        danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-200",
        ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-900 shadow-none"
    };
    return (
        <button 
            type={type}
            onClick={onClick} 
            disabled={disabled || loading} 
            className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
            title={title}
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : children}
        </button>
    );
};

const Modal = ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-white/20">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur sticky top-0 z-10">
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">{title}</h3>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scroll">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Card = ({ children, className = "", title = "", icon: Icon }: any) => (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${className}`}>
        {(title || Icon) && (
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                {Icon && <Icon className="w-5 h-5 text-slate-400" />}
                <h3 className="font-bold text-slate-700">{title}</h3>
            </div>
        )}
        <div className="p-6 flex-1">
            {children}
        </div>
    </div>
);

// --- Main App ---

export default function App() {
    // Auth & User State
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeView, setActiveView] = useState<'pieces' | 'charts'>('pieces');

    // Data State
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [pieces, setPieces] = useState<Piece[]>([]);
    const [projectImage, setProjectImage] = useState<string | null>(null);
    const [projectLink, setProjectLink] = useState<string | null>(null);
    const [loadingData, setLoadingData] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [phaseFilter, setPhaseFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [stateValueFilter, setStateValueFilter] = useState('all');

    // UI State
    const [modals, setModals] = useState({
        login: true,
        profile: false,
        manageProjects: false,
        comment: false,
        confirm: false,
        linkModel: false,
        pieceHistory: false
    });
    const [commentTarget, setCommentTarget] = useState<{id: string, text: string} | null>(null);
    const [historyTarget, setHistoryTarget] = useState<Piece | null>(null);
    const [processing, setProcessing] = useState(false);
    const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
    
    // Visual State
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [visualMode, setVisualMode] = useState<'2d' | '3d'>('2d');
    const [linkInput, setLinkInput] = useState('');

    // Login & Profile State
    const [isRegistering, setIsRegistering] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [regData, setRegData] = useState({ name: '', last: '', role: '', area: '' });
    const [editProfileData, setEditProfileData] = useState({ nombre: '', apellido: '', puesto: '', area: '' });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // --- Auth Logic ---

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                try {
                    const q = query(collection(db, `artifacts/${appId}/public/data/users`), where("authUid", "==", u.uid), limit(1));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        const data = snap.docs[0].data();
                        const profile = { id: snap.docs[0].id, ...data } as UserProfile;
                        setUserProfile(profile);
                        setEditProfileData({
                            nombre: profile.nombre || '',
                            apellido: profile.apellido || '',
                            puesto: profile.puesto || '',
                            area: profile.area || ''
                        });
                    }
                    setModals(m => ({ ...m, login: false }));
                } catch (e) { console.error("Error loading user profile", e); }
            } else {
                setModals(m => ({ ...m, login: true }));
                setUserProfile(null);
                setActiveProjectId(null); 
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load Projects
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/projects`), orderBy('name'));
        return onSnapshot(q, (snap) => {
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
        });
    }, [user]);

    // Project Data Listeners
    useEffect(() => {
        if (!activeProjectId || !user) {
            setPieces([]);
            setProjectImage(null);
            setProjectLink(null);
            return;
        }
        setLoadingData(true);
        
        const piecesCol = collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`);
        const unsubPieces = onSnapshot(piecesCol, (snap) => {
            setPieces(snap.docs.map(d => ({ id: d.id, ...d.data() } as Piece)));
            setLoadingData(false);
        }, () => setLoadingData(false));

        const imgDoc = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/image`);
        const unsubImg = onSnapshot(imgDoc, (snap) => {
            setProjectImage(snap.exists() ? snap.data().base64Image : null);
        });

        const modelDoc = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/model`);
        const unsubModel = onSnapshot(modelDoc, (snap) => {
            setProjectLink(snap.exists() ? snap.data().linkUrl : null);
        });

        return () => { unsubPieces(); unsubImg(); unsubModel(); };
    }, [activeProjectId, user]);

    // Keyboard Listeners
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsImageExpanded(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // --- Permissions ---

    const userArea = userProfile?.area;
    const canEditState = (stateKey: string) => userArea ? AREA_PERMISSIONS[userArea]?.includes(stateKey) : false;
    const isOT = userArea === "Oficina Técnica";

    // --- Handlers ---

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (isRegistering) {
                const cred = await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
                const newProfile = {
                    authUid: cred.user.uid, email: loginEmail, nombre: regData.name,
                    apellido: regData.last, puesto: regData.role, area: regData.area, createdAt: new Date()
                };
                const ref = await addDoc(collection(db, `artifacts/${appId}/public/data/users`), newProfile);
                setUserProfile({ id: ref.id, ...newProfile } as UserProfile);
            } else {
                await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            }
        } catch (err: any) { alert(err.message); } finally { setProcessing(false); }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const name = (form.elements.namedItem('pname') as HTMLInputElement).value;
        if (name) {
            await addDoc(collection(db, `artifacts/${appId}/public/data/projects`), { name, createdAt: new Date(), archived: false });
            form.reset();
        }
    };

    const handleExcelUpload = async (e: any) => {
        if (!activeProjectId || !fileInputRef.current?.files?.[0]) return;
        setProcessing(true);
        try {
            const excelData = await readExcel(fileInputRef.current.files[0]);
            const batch = writeBatch(db);
            const piecesRef = collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`);
            
            excelData.forEach(p => {
                const newRef = doc(piecesRef);
                const newData: any = { ...p, lote: "", eliminada: false, loadedAt: new Date(), loadedBy: userProfile?.id || 'sys', comentario: "" };
                STATES.forEach(s => newData[s.key] = { completado: false, usuarioId: null, usuarioNombre: null, fecha: null });
                batch.set(newRef, newData);
            });
            await batch.commit();
            alert("Importación exitosa");
        } catch (err: any) { alert(err.message); } finally { setProcessing(false); if(fileInputRef.current) fileInputRef.current.value = ""; }
    };

    const toggleState = async (pieceId: string, stateKey: string, currentVal: any) => {
        if (!activeProjectId || !userProfile || !canEditState(stateKey)) return;
        const isDone = isStateComplete(currentVal);
        const auditObj: AuditStatus = {
            completado: !isDone,
            usuarioId: userProfile.id || null,
            usuarioNombre: `${userProfile.nombre} ${userProfile.apellido}`,
            fecha: new Date()
        };
        await updateDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, pieceId), { [stateKey]: auditObj });
    };

    // --- Computed Data ---

    const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);
    const activePieces = useMemo(() => pieces.filter(p => !p.eliminada), [pieces]);
    
    const uniquePhases = useMemo(() => {
        const s = new Set<number>();
        activePieces.forEach(p => { if(p.lote) s.add(Number(p.lote)) });
        return Array.from(s).sort((a,b) => a-b);
    }, [activePieces]);

    const filteredPieces = useMemo(() => {
        return activePieces.filter(p => {
            const s = searchTerm.toLowerCase();
            const mSearch = !searchTerm || p.conjunto.toLowerCase().includes(s) || p.lote.toString().includes(s);
            const mPhase = !phaseFilter || p.lote.toString() === phaseFilter;
            let mState = true;
            if (stateFilter && stateValueFilter !== 'all') {
                const comp = isStateComplete(p[stateFilter]);
                mState = (stateValueFilter === 'true' && comp) || (stateValueFilter === 'false' && !comp);
            }
            return mSearch && mPhase && mState;
        });
    }, [activePieces, searchTerm, phaseFilter, stateFilter, stateValueFilter]);

    const stats = useMemo(() => {
        const res = { kg: 0, states: {} as any };
        STATES.forEach(s => res.states[s.key] = 0);
        filteredPieces.forEach(p => {
            res.kg += (p.peso || 0);
            STATES.forEach(s => { if(isStateComplete(p[s.key])) res.states[s.key] += (p.peso || 0); });
        });
        return res;
    }, [filteredPieces]);

    const dashboardData = useMemo(() => {
        const chartPieces = activePieces.filter(p => selectedPhases.includes(Number(p.lote || 0)));
        const total = chartPieces.reduce((sum, p) => sum + p.peso, 0);
        const bars = STATES.map(st => {
            const kg = chartPieces.filter(p => isStateComplete(p[st.key])).reduce((sum, p) => sum + p.peso, 0);
            return { name: st.label, short: st.short, kg: Math.round(kg), percentage: total > 0 ? (kg/total)*100 : 0, color: st.color };
        });
        const progress = bars.length > 0 ? bars[bars.length - 1].percentage : 0;
        return { bars, totalKg: Math.round(total), progress };
    }, [activePieces, selectedPhases]);

    if (authLoading) return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-[#0E3B43]" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando sistema...</p>
        </div>
    );

    if (modals.login) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-12 border border-slate-100 flex flex-col items-center">
                    <div className="text-center mb-10 w-full flex flex-col items-center">
                        <SolanaLogoFull className="mb-8" />
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Gestión de Producción</h1>
                        <p className="text-slate-400 mt-2 font-medium italic text-sm">Ingrese sus credenciales para continuar</p>
                    </div>

                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 w-full">
                        <button onClick={() => setIsRegistering(false)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isRegistering ? 'bg-white text-[#0E3B43] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Ingresar</button>
                        <button onClick={() => setIsRegistering(true)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isRegistering ? 'bg-white text-[#0E3B43] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Registro</button>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4 w-full">
                        {isRegistering && (
                            <div className="grid grid-cols-2 gap-3">
                                <input required placeholder="Nombre" className="input-modern" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                                <input required placeholder="Apellido" className="input-modern" value={regData.last} onChange={e => setRegData({...regData, last: e.target.value})} />
                            </div>
                        )}
                        <input required type="email" placeholder="Email" className="input-modern" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                        <input required type="password" placeholder="Contraseña" className="input-modern" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                        <Button type="submit" loading={processing} className="w-full mt-6 h-14 text-lg">
                            {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row text-slate-800">
            
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 h-screen sticky top-0 z-30 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.03)]">
                <div className="p-8 border-b border-slate-100">
                    <div className="flex items-center gap-4 mb-10">
                        <SolanaSymbol />
                        <div>
                            <h2 className="font-extrabold text-slate-900 leading-none tracking-tight">SOLANA SRL</h2>
                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[2px] mt-1.5">Producción v2.0</p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 block">Obra Activa</label>
                        <div className="relative group">
                            <select 
                                className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none appearance-none cursor-pointer group-hover:text-[#0E3B43] transition-colors"
                                value={activeProjectId || ''}
                                onChange={(e) => setActiveProjectId(e.target.value || null)}
                            >
                                <option value="">Seleccionar...</option>
                                {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto custom-scroll">
                    <button onClick={() => setActiveView('pieces')} className={`nav-item ${activeView === 'pieces' ? 'active' : ''}`}>
                        <List className="w-5 h-5 shrink-0" /> <span className="flex-1">Gestión de Piezas</span>
                    </button>
                    <button onClick={() => setActiveView('charts')} className={`nav-item ${activeView === 'charts' ? 'active' : ''}`}>
                        <BarChart3 className="w-5 h-5 shrink-0" /> <span className="flex-1">Panel de Control</span>
                    </button>
                </nav>

                <div className="p-6 border-t border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 mb-4 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#0E3B43]/10 flex items-center justify-center text-[#0E3B43] font-black">
                            {userProfile?.nombre?.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-slate-700 truncate">{userProfile?.nombre} {userProfile?.apellido}</p>
                            <p className="text-[10px] text-slate-400 font-bold truncate uppercase tracking-tighter">{userProfile?.puesto}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setModals(m => ({...m, profile: true}))} className="action-btn" title="Perfil"><Settings className="w-4 h-4" /></button>
                        <button onClick={() => signOut(auth)} className="action-btn text-red-500 hover:bg-red-50 hover:border-red-100" title="Salir"><LogOut className="w-4 h-4" /></button>
                    </div>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto max-h-screen custom-scroll bg-[#f8fafc]">
                {!activeProjectId ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-in fade-in zoom-in duration-500">
                        <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                            <Building className="w-12 h-12 text-slate-200" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Comienza ahora</h2>
                        <p className="text-slate-400 max-w-xs text-center font-medium">Selecciona una obra en el menú lateral para cargar los datos de producción.</p>
                        <Button onClick={() => setModals(m => ({...m, manageProjects: true}))} variant="secondary" className="mt-8">
                             Administrar Obras <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                        
                        {/* Header Stats */}
                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                            
                            {/* Summary Card */}
                            <div className="xl:col-span-3 glass-card rounded-[2rem] p-8 border border-white shadow-xl shadow-slate-200/40">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                    <div>
                                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Estado de Obra</h1>
                                        <p className="text-slate-400 font-medium mt-1">Monitoreo de avance y tonelaje</p>
                                    </div>
                                    <div className="px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[2px] block mb-1">Carga Total</span>
                                        <span className="text-2xl font-black text-[#0E3B43]">{stats.kg.toLocaleString('es-AR')} <small className="text-sm font-bold text-slate-400">kg</small></span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                                    {STATES.map(st => {
                                        const kg = stats.states[st.key];
                                        const perc = stats.kg > 0 ? (kg / stats.kg) * 100 : 0;
                                        return (
                                            <div key={st.key} className="group relative bg-white/50 hover:bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
                                                <div className="h-1 w-8 rounded-full mb-3" style={{backgroundColor: st.color}}></div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">{st.label}</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-black text-slate-800">{kg.toLocaleString('es-AR', {maximumFractionDigits:0})}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">kg</span>
                                                </div>
                                                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full transition-all duration-1000" style={{width: `${perc}%`, backgroundColor: st.color}}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Viewer Card */}
                            <div className="relative group rounded-[2rem] overflow-hidden shadow-xl shadow-slate-200/40 border border-slate-200 bg-white h-auto min-h-[340px] flex flex-col">
                                <div className="p-4 border-b border-slate-100 flex gap-2 justify-center bg-slate-50/50 backdrop-blur-sm z-10">
                                    <button onClick={() => setVisualMode('2d')} className={`mode-toggle ${visualMode === '2d' ? 'active' : ''}`}><ImageIcon className="w-4 h-4" /> 2D</button>
                                    <button onClick={() => setVisualMode('3d')} className={`mode-toggle ${visualMode === '3d' ? 'active' : ''}`}><Layers className="w-4 h-4" /> 3D</button>
                                </div>
                                <div className="flex-1 bg-slate-50 relative flex items-center justify-center">
                                    {visualMode === '2d' ? (
                                        projectImage ? (
                                            <img src={projectImage} alt="Plano" onClick={() => setIsImageExpanded(true)} className="w-full h-full object-contain cursor-zoom-in group-hover:scale-[1.02] transition-transform" />
                                        ) : (
                                            <div className="flex flex-col items-center opacity-20"><ImageIcon className="w-12 h-12 mb-2"/><p className="text-xs font-bold uppercase tracking-widest">Sin imagen</p></div>
                                        )
                                    ) : (
                                        projectLink ? (
                                            <iframe src={projectLink} className="w-full h-full border-0" title="Model Viewer" allowFullScreen />
                                        ) : (
                                            <div className="flex flex-col items-center text-slate-300 p-8 text-center">
                                                <Monitor className="w-12 h-12 mb-4 opacity-20"/>
                                                <p className="text-xs font-bold uppercase tracking-widest mb-6">Sin enlace 3D configurado</p>
                                                {isOT && (
                                                    <Button variant="secondary" onClick={() => setModals(m => ({...m, linkModel: true}))} className="scale-90">
                                                        <LinkIcon className="w-4 h-4" /> Vincular Ahora
                                                    </Button>
                                                )}
                                            </div>
                                        )
                                    )}
                                    
                                    {/* Action Buttons for OT */}
                                    {isOT && (
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                                            <Button 
                                                variant="secondary" 
                                                onClick={() => visualMode === '2d' ? imageInputRef.current?.click() : setModals(m => ({...m, linkModel: true}))} 
                                                className="h-10 text-[10px] uppercase font-bold tracking-widest bg-white/90 backdrop-blur shadow-lg border border-slate-200"
                                            >
                                                {visualMode === '2d' ? <ImageIcon className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                                                {visualMode === '2d' ? 'Actualizar Plano' : 'Actualizar Link 3D'}
                                            </Button>
                                            
                                            {visualMode === '2d' && (
                                                <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = async (ev) => {
                                                        await setDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/image`), { base64Image: ev.target?.result, updatedAt: new Date() });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {activeView === 'pieces' && (
                            <div className="space-y-6">
                                {/* Toolbar */}
                                <div className="glass-card p-4 rounded-2xl border border-white shadow-lg shadow-slate-200/30 flex flex-col lg:flex-row items-center justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                                        <div className="relative flex-1 sm:min-w-[320px]">
                                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                placeholder="Buscar por conjunto o fase..." 
                                                className="input-modern pl-11 h-11" 
                                                value={searchTerm} 
                                                onChange={e => setSearchTerm(e.target.value)} 
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <select className="input-modern h-11 text-xs font-bold min-w-[140px]" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                                                <option value="">Cualquier Estado</option>
                                                {STATES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                            </select>
                                            <select className="input-modern h-11 text-xs font-bold" disabled={!stateFilter} value={stateValueFilter} onChange={e => setStateValueFilter(e.target.value)}>
                                                <option value="all">Ver todos</option>
                                                <option value="true">Completados</option>
                                                <option value="false">Pendientes</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 w-full lg:w-auto">
                                        {isOT && (
                                            <Button variant="primary" onClick={() => fileInputRef.current?.click()} loading={processing} className="flex-1 lg:flex-none">
                                                <FileSpreadsheet className="w-4 h-4" /> Importar
                                            </Button>
                                        )}
                                        <Button variant="secondary" onClick={() => {}} className="flex-1 lg:flex-none"><Download className="w-4 h-4" /> Exportar</Button>
                                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx" onChange={handleExcelUpload} />
                                    </div>
                                </div>

                                {/* Piece Table */}
                                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/20 overflow-hidden flex flex-col min-h-[500px]">
                                    <div className="overflow-x-auto flex-1 custom-scroll">
                                        <table className="w-full text-left border-collapse min-w-[1000px]">
                                            <thead>
                                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest pl-10">Conjunto</th>
                                                    <th className="px-4 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Nº</th>
                                                    <th className="px-4 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Peso (kg)</th>
                                                    <th className="px-4 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Fase</th>
                                                    {STATES.map(s => <th key={s.key} className="px-2 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">{s.short}</th>)}
                                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center pr-10">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {loadingData ? (
                                                    <tr><td colSpan={14} className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-[#0E3B43] mx-auto" /></td></tr>
                                                ) : filteredPieces.length === 0 ? (
                                                    <tr><td colSpan={14} className="p-20 text-center text-slate-400 italic">No se encontraron piezas</td></tr>
                                                ) : (
                                                    filteredPieces.map(p => (
                                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                                            <td className="px-6 py-4 font-bold text-slate-700 pl-10">{p.conjunto}</td>
                                                            <td className="px-4 py-4 text-center text-slate-400 font-medium">{p.numero}</td>
                                                            <td className="px-4 py-4 text-right font-mono font-bold text-slate-600">{p.peso.toFixed(2)}</td>
                                                            <td className="px-4 py-4 text-center">
                                                                <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-tighter">{p.lote ? `Fase ${p.lote}` : '-'}</span>
                                                            </td>
                                                            {STATES.map(s => {
                                                                const status = p[s.key];
                                                                const isDone = isStateComplete(status);
                                                                const allowed = canEditState(s.key);
                                                                return (
                                                                    <td key={s.key} className="px-2 py-4">
                                                                        <button 
                                                                            disabled={!allowed}
                                                                            onClick={() => toggleState(p.id, s.key, status)}
                                                                            className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center transition-all duration-300 ${isDone ? 'text-white shadow-lg' : 'bg-slate-50 border border-slate-200 text-slate-200 hover:border-slate-300'} ${!allowed ? 'cursor-not-allowed opacity-30' : 'active:scale-90'}`}
                                                                            style={isDone ? { backgroundColor: s.color, boxShadow: `0 4px 12px ${s.color}40` } : {}}
                                                                        >
                                                                            {isDone ? <CheckCircle2 className="w-5 h-5 stroke-[3]" /> : <Box className="w-4 h-4" />}
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="px-6 py-4 pr-10">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <button onClick={() => { setCommentTarget({id: p.id, text: p.comentario}); setModals(m => ({...m, comment: true})); }} className={`p-2 rounded-lg transition-all ${p.comentario ? 'bg-[#0E3B43]/10 text-[#0E3B43]' : 'text-slate-300 hover:bg-slate-100'}`}><MessageSquare className="w-4 h-4" /></button>
                                                                    <button onClick={() => { setHistoryTarget(p); setModals(m => ({...m, pieceHistory: true})); }} className="p-2 rounded-lg text-slate-300 hover:bg-slate-100"><History className="w-4 h-4" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeView === 'charts' && (
                            <div className="space-y-8 pb-10">
                                {/* Filters Analysis */}
                                <Card title="Filtros de Análisis" icon={Filter}>
                                    <div className="flex flex-wrap gap-2">
                                        {uniquePhases.length === 0 ? <p className="text-slate-400 italic">No hay fases disponibles</p> : 
                                        uniquePhases.map(ph => (
                                            <button 
                                                key={ph} 
                                                onClick={() => {
                                                    if(selectedPhases.includes(ph)) setSelectedPhases(prev => prev.filter(x => x !== ph));
                                                    else setSelectedPhases(prev => [...prev, ph]);
                                                }}
                                                className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${selectedPhases.includes(ph) ? 'bg-[#0E3B43] text-white shadow-lg shadow-[#0E3B43]/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                            >
                                                Fase {ph}
                                            </button>
                                        ))}
                                    </div>
                                </Card>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <Card title="Avance por Etapa (%)" icon={BarChart3} className="h-[500px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dashboardData.bars} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="short" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                                                <Tooltip 
                                                    cursor={{fill: '#f8fafc'}}
                                                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                                                />
                                                <Bar dataKey="percentage" radius={[8, 8, 0, 0]} barSize={45}>
                                                    {dashboardData.bars.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Card>

                                    <div className="grid grid-cols-1 gap-8">
                                        <div className="bg-[#0E3B43] rounded-[2.5rem] p-10 text-white flex flex-col justify-between shadow-2xl shadow-[#0E3B43]/20">
                                            <div className="flex justify-between items-start">
                                                <SolanaSymbol className="w-12 h-12 opacity-90 scale-110" />
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Progreso Estimado</p>
                                                    <h3 className="text-5xl font-black mt-1">{dashboardData.progress.toFixed(1)}%</h3>
                                                </div>
                                            </div>
                                            <div className="mt-12">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-3 opacity-60">
                                                    <span>Eficiencia</span>
                                                    <span>{dashboardData.totalKg.toLocaleString()} kg totales</span>
                                                </div>
                                                <div className="h-5 w-full bg-white/10 rounded-full overflow-hidden p-1.5 border border-white/10">
                                                    <div className="h-full bg-white rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(255,255,255,0.4)]" style={{width: `${dashboardData.progress}%`}}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <Card title="Indicadores Clave" icon={Layers}>
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carga Analizada</span>
                                                    <span className="text-xl font-black text-slate-800">{dashboardData.totalKg.toLocaleString()} kg</span>
                                                </div>
                                                <div className="flex items-center justify-between p-5 bg-[#0E3B43]/5 rounded-2xl border border-[#0E3B43]/10">
                                                    <span className="text-xs font-bold text-[#0E3B43] uppercase tracking-wider">Etapa Crítica</span>
                                                    <span className="text-xl font-black text-[#0E3B43]">{STATES[STATES.length-1].label}</span>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modals */}
            <Modal isOpen={modals.manageProjects} onClose={() => setModals(m => ({...m, manageProjects: false}))} title="Gestión de Obras">
                <div className="space-y-6">
                    {isOT && (
                        <form onSubmit={handleCreateProject} className="flex gap-2">
                            <input name="pname" placeholder="Nombre de nueva obra..." className="input-modern flex-1" required />
                            <Button type="submit"><Plus className="w-5 h-5" /></Button>
                        </form>
                    )}
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scroll pr-1">
                        {projects.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:border-[#0E3B43]/20">
                                <div className="flex items-center gap-3">
                                    <Building className="w-5 h-5 text-slate-300 group-hover:text-[#0E3B43] transition-colors" />
                                    <span className="font-bold text-slate-700">{p.name}</span>
                                </div>
                                {isOT && (
                                    <button onClick={() => { if(confirm("¿Desea eliminar esta obra permanentemente?")) deleteDoc(doc(db, `artifacts/${appId}/public/data/projects`, p.id)); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={modals.comment} onClose={() => setModals(m => ({...m, comment: false}))} title="Notas de Pieza">
                <textarea 
                    className="input-modern w-full h-40 py-4 resize-none mb-6 font-medium text-slate-600 leading-relaxed" 
                    placeholder="Ingrese observaciones técnicas..."
                    value={commentTarget?.text || ''}
                    onChange={e => setCommentTarget(prev => prev ? {...prev, text: e.target.value} : null)}
                />
                <div className="flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setModals(m => ({...m, comment: false}))}>Descartar</Button>
                    <Button onClick={async () => {
                        if(commentTarget) {
                            await updateDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, commentTarget.id), { comentario: commentTarget.text });
                            setModals(m => ({...m, comment: false}));
                        }
                    }}>Guardar</Button>
                </div>
            </Modal>

            <Modal isOpen={modals.linkModel} onClose={() => setModals(m => ({...m, linkModel: false}))} title="Vincular Visor Web">
                <div className="space-y-6">
                    <div className="bg-[#0E3B43]/5 p-4 rounded-2xl border border-[#0E3B43]/10 flex gap-4 items-start">
                        <Monitor className="w-6 h-6 text-[#0E3B43] shrink-0 mt-1" />
                        <div>
                            <p className="text-sm font-bold text-slate-700">Visor de Modelos</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Pega el link de visualización (ej: Autodesk Viewer, Sketchfab o BIM 360) para mostrar el modelo 3D de esta obra.</p>
                        </div>
                    </div>
                    <input 
                        type="url" 
                        placeholder="https://..." 
                        className="input-modern" 
                        value={linkInput} 
                        onChange={e => setLinkInput(e.target.value)} 
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setModals(m => ({...m, linkModel: false}))}>Cancelar</Button>
                        <Button onClick={async () => {
                            if(!linkInput) return alert("Por favor ingresa una URL válida");
                            await setDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/model`), { linkUrl: linkInput, updatedAt: new Date() });
                            setModals(m => ({...m, linkModel: false}));
                            setLinkInput('');
                        }}>Vincular Modelo</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={modals.profile} onClose={() => setModals(m => ({...m, profile: false}))} title="Configuración de Perfil">
                <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    if(userProfile?.id) {
                        await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, userProfile.id), editProfileData);
                        setModals(m => ({...m, profile: false}));
                    }
                }}>
                    <div className="grid grid-cols-2 gap-3">
                        <input className="input-modern" placeholder="Nombre" value={editProfileData.nombre} onChange={e => setEditProfileData({...editProfileData, nombre: e.target.value})} />
                        <input className="input-modern" placeholder="Apellido" value={editProfileData.apellido} onChange={e => setEditProfileData({...editProfileData, apellido: e.target.value})} />
                    </div>
                    <input className="input-modern" placeholder="Cargo" value={editProfileData.puesto} onChange={e => setEditProfileData({...editProfileData, puesto: e.target.value})} />
                    <select className="input-modern" value={editProfileData.area} onChange={e => setEditProfileData({...editProfileData, area: e.target.value})}>
                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <div className="pt-6 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setModals(m => ({...m, profile: false}))}>Cerrar</Button>
                        <Button type="submit">Actualizar</Button>
                    </div>
                </form>
            </Modal>

            {/* Image Expanded View */}
            {isImageExpanded && projectImage && (
                <div className="fixed inset-0 z-[200] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setIsImageExpanded(false)}>
                    <button className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors bg-white/10 p-2 rounded-full"><X className="w-8 h-8" /></button>
                    <img src={projectImage} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()} />
                </div>
            )}

            <style>{`
                .input-modern {
                    @apply w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-semibold text-slate-700 
                    outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#0E3B43]/5 focus:border-[#0E3B43] placeholder:text-slate-300;
                }
                .nav-item {
                    @apply flex items-center gap-4 px-6 py-4 rounded-[1.25rem] text-sm font-black uppercase tracking-widest text-slate-400 transition-all active:scale-95;
                }
                .nav-item:hover { @apply bg-slate-50 text-slate-600; }
                .nav-item.active { @apply bg-[#0E3B43] text-white shadow-xl shadow-[#0E3B43]/20; }
                
                .action-btn {
                    @apply flex items-center justify-center p-3 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 transition-all hover:bg-[#0E3B43]/5 hover:text-[#0E3B43] hover:border-[#0E3B43]/20 active:scale-90;
                }

                .mode-toggle {
                    @apply flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all;
                }
                .mode-toggle.active { @apply bg-white text-[#0E3B43] shadow-md ring-1 ring-black/5; }

                .custom-scroll::-webkit-scrollbar { width: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb { @apply bg-slate-200 rounded-full hover:bg-slate-300; }
            `}</style>
        </div>
    );
}
