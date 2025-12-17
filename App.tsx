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
    History, Calendar, Clock
} from 'lucide-react';

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, loading = false, title = '', type = 'button' }: any) => {
    const baseStyle = "h-10 px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 shadow-sm";
    
    const variants = {
        primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border border-transparent",
        secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:ring-slate-200",
        danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 focus:ring-red-200",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200 border border-transparent shadow-none"
    };
    return (
        <button 
            type={type}
            onClick={onClick} 
            disabled={disabled || loading} 
            className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
            title={title}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
};

const Modal = ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-slate-100">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- Main App ---

export default function App() {
    // Auth & User State
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [activeView, setActiveView] = useState<'pieces' | 'charts' | 'activity'>('pieces');

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
        history: false,
        comment: false,
        confirm: false,
        linkModel: false,
        pieceHistory: false
    });
    const [commentTarget, setCommentTarget] = useState<{id: string, text: string} | null>(null);
    const [historyTarget, setHistoryTarget] = useState<Piece | null>(null);
    const [confirmAction, setConfirmAction] = useState<{title: string, msg: string, action: () => void} | null>(null);
    const [processing, setProcessing] = useState(false);
    const [selectedPhases, setSelectedPhases] = useState<number[]>([]);
    
    // Visual State
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [visualMode, setVisualMode] = useState<'2d' | '3d'>('2d');
    const [linkInput, setLinkInput] = useState('');

    // Login Form State
    const [isRegistering, setIsRegistering] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [regData, setRegData] = useState({ name: '', last: '', role: '', area: '' });

    // Profile Edit State
    const [editProfileData, setEditProfileData] = useState({ nombre: '', apellido: '', puesto: '', area: '' });

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // --- Effects ---

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                // Fetch Profile
                const q = query(collection(db, `artifacts/${appId}/public/data/users`), where("authUid", "==", u.uid), limit(1));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    const profile = { id: snap.docs[0].id, ...data } as UserProfile;
                    setUserProfile(profile);
                    // Init edit form data
                    setEditProfileData({
                        nombre: profile.nombre || '',
                        apellido: profile.apellido || '',
                        puesto: profile.puesto || '',
                        area: profile.area || ''
                    });
                }
                setModals(m => ({ ...m, login: false }));
            } else {
                setModals(m => ({ ...m, login: true }));
                setUserProfile(null);
                setActiveProjectId(null); 
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        // Load Projects
        const q = query(collection(db, `artifacts/${appId}/public/data/projects`), orderBy('name'));
        const unsub = onSnapshot(q, (snap) => {
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
        }, (error) => {
            console.error("Error loading projects:", error);
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (!activeProjectId || !user) {
            setPieces([]);
            setProjectImage(null);
            setProjectLink(null);
            return;
        }
        setLoadingData(true);
        
        // 1. Pieces Listener
        const piecesCol = collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`);
        const unsubPieces = onSnapshot(piecesCol, (snap) => {
            const list: Piece[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() } as Piece));
            setPieces(list);
            setLoadingData(false);
        }, (error) => {
            console.error("Error loading pieces:", error);
            setLoadingData(false);
        });

        // 2. Image Listener
        const imgDoc = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/image`);
        const unsubImg = onSnapshot(imgDoc, (snap) => {
            if (snap.exists()) setProjectImage(snap.data().base64Image);
            else setProjectImage(null);
        }, (error) => {
            console.error("Error loading image:", error);
        });

        // 3. Model/Link Listener
        const modelDoc = doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/model`);
        const unsubModel = onSnapshot(modelDoc, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                // Check if it is a link
                if (data.linkUrl) {
                    setProjectLink(data.linkUrl);
                } else {
                    setProjectLink(null);
                }
            } else {
                setProjectLink(null);
            }
        }, (error) => {
            console.error("Error loading model config:", error);
        });

        return () => {
            unsubPieces();
            unsubImg();
            unsubModel();
        };
    }, [activeProjectId, user]);

    // Add keydown listener for ESC to close image
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsImageExpanded(false);
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    // --- Permissions Helpers ---

    const userArea = userProfile?.area;
    
    const canEditState = (stateKey: string) => {
        if (!userArea) return false;
        return AREA_PERMISSIONS[userArea]?.includes(stateKey) || false;
    };

    const canManageProjects = userArea === "Oficina Técnica";
    const canUpload = userArea === "Oficina Técnica";
    const canManagePhases = ["Oficina Técnica", "Producción", "Obra"].includes(userArea || '');

    // --- Actions ---

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessing(true);
        try {
            if (isRegistering) {
                const cred = await createUserWithEmailAndPassword(auth, loginEmail, loginPass);
                const newProfileData = {
                    authUid: cred.user.uid,
                    email: loginEmail,
                    nombre: regData.name,
                    apellido: regData.last,
                    puesto: regData.role,
                    area: regData.area,
                    createdAt: new Date()
                };
                const ref = await addDoc(collection(db, `artifacts/${appId}/public/data/users`), newProfileData);
                setUserProfile({ id: ref.id, ...newProfileData } as UserProfile);
                setEditProfileData({ nombre: regData.name, apellido: regData.last, puesto: regData.role, area: regData.area });
            } else {
                await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            }
        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile?.id) return;
        setProcessing(true);
        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/users`, userProfile.id), {
                nombre: editProfileData.nombre,
                apellido: editProfileData.apellido,
                puesto: editProfileData.puesto,
                area: editProfileData.area
            });
            setUserProfile(prev => prev ? ({...prev, ...editProfileData}) : null);
            setModals(m => ({...m, profile: false}));
        } catch (err: any) {
            alert("Error al actualizar perfil: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManageProjects) return;
        const form = e.target as HTMLFormElement;
        const name = (form.elements.namedItem('pname') as HTMLInputElement).value;
        if (name) {
            await addDoc(collection(db, `artifacts/${appId}/public/data/projects`), { name, createdAt: new Date() });
            form.reset();
        }
    };

    const handleDeleteProject = (pid: string) => {
        setConfirmAction({
            title: "Eliminar Proyecto",
            msg: "¿Estás seguro? Se perderán todos los datos asociados.",
            action: async () => {
                await deleteDoc(doc(db, `artifacts/${appId}/public/data/projects`, pid));
                if(activeProjectId === pid) setActiveProjectId(null);
                setModals(m => ({ ...m, confirm: false }));
            }
        });
        setModals(m => ({ ...m, confirm: true }));
    };

    const handleExcelUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canUpload || !activeProjectId || !fileInputRef.current?.files?.[0]) return;
        
        setProcessing(true);
        try {
            const file = fileInputRef.current.files[0];
            const excelData = await readExcel(file);
            if (!excelData.length) throw new Error("Archivo vacío.");

            const batch = writeBatch(db);
            const piecesRef = collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`);
            const logsRef = collection(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/sync_logs`);

            const existingPieces = pieces.filter(p => !p.eliminada);
            const getKey = (p: any) => `${p.conjunto}|${p.peso.toFixed(2)}|${p.area.toFixed(2)}`;
            
            const excelMap = new Map<string, any[]>();
            excelData.forEach(p => {
                const k = getKey(p);
                if(!excelMap.has(k)) excelMap.set(k, []);
                excelMap.get(k)!.push(p);
            });

            const existMap = new Map<string, Piece[]>();
            existingPieces.forEach(p => {
                const k = getKey(p);
                if(!existMap.has(k)) existMap.set(k, []);
                existMap.get(k)!.push(p);
            });

            let added = 0, removed = 0;
            const addedDet: string[] = [], removedDet: string[] = [];
            const matchedIds = new Set<string>();

            for (const [key, excelList] of excelMap.entries()) {
                const existList = existMap.get(key) || [];
                for (let i = 0; i < excelList.length; i++) {
                    const exPiece = excelList[i];
                    const dbPiece = existList[i];

                    if (dbPiece) {
                        matchedIds.add(dbPiece.id);
                        if (dbPiece.area !== exPiece.area || dbPiece.peso !== exPiece.peso) {
                             batch.update(doc(piecesRef, dbPiece.id), { area: exPiece.area, peso: exPiece.peso });
                        }
                    } else {
                        const newRef = doc(piecesRef);
                        const newData: any = {
                            ...exPiece,
                            lote: "",
                            eliminada: false,
                            loadedAt: new Date(),
                            loadedBy: userProfile?.id || 'unknown',
                            comentario: ""
                        };
                        STATES.forEach(s => newData[s.key] = { completado: false, usuarioId: null, usuarioNombre: null, fecha: null });
                        batch.set(newRef, newData);
                        added++;
                        addedDet.push(exPiece.conjunto);
                    }
                }
            }

            existingPieces.forEach(p => {
                if(!matchedIds.has(p.id)) {
                    batch.update(doc(piecesRef, p.id), { eliminada: true });
                    removed++;
                    removedDet.push(p.conjunto);
                }
            });

            await batch.commit();
            await addDoc(logsRef, {
                date: new Date(), user: `${userProfile?.nombre} ${userProfile?.apellido}`,
                file: file.name, added, removed, 
                addedDetails: addedDet.join(', '), removedDetails: removedDet.join(', ')
            });

            alert(`Sincronización: +${added}, -${removed}`);
            if(e.target instanceof HTMLFormElement) e.target.reset();

        } catch (err: any) {
            alert(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const toggleState = async (pieceId: string, stateKey: string, currentStateVal: any) => {
        if (!activeProjectId || !userProfile) return;
        if (!canEditState(stateKey)) return alert("No tienes permiso para modificar este estado.");

        const isComplete = isStateComplete(currentStateVal);
        const newState = !isComplete;

        const auditObj: AuditStatus = {
            completado: newState,
            usuarioId: userProfile.id || null,
            usuarioNombre: `${userProfile.nombre} ${userProfile.apellido}`,
            fecha: new Date()
        };

        await updateDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, pieceId), {
            [stateKey]: auditObj
        });
    };

    const updatePhase = async (pieceId: string, val: string) => {
        if (!activeProjectId || !canManagePhases) return;
        await updateDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, pieceId), {
            lote: val ? parseInt(val) : ""
        });
    };

    const saveComment = async () => {
        if (!activeProjectId || !commentTarget) return;
        await updateDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/pieces`, commentTarget.id), {
            comentario: commentTarget.text
        });
        setModals(m => ({ ...m, comment: false }));
        setCommentTarget(null);
    };

    const handleImageUpload = async () => {
        if (!activeProjectId || !canUpload || !imageInputRef.current?.files?.[0]) return;
        const file = imageInputRef.current.files[0];
        if (file.size > 5 * 1024 * 1024) return alert("Imagen muy grande (Max 5MB)");
        
        setProcessing(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const b64 = e.target?.result as string;
            await setDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/image`), {
                base64Image: b64, fileName: file.name, uploadedBy: userProfile?.nombre, uploadedAt: new Date()
            }, { merge: true });
            setProcessing(false);
            if(imageInputRef.current) imageInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    };

    const handleLinkSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeProjectId || !canUpload || !linkInput) return;
        
        setProcessing(true);
        try {
            await setDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/model`), {
                linkUrl: linkInput,
                updatedBy: userProfile?.nombre,
                updatedAt: new Date(),
                type: 'link'
            });
            setModals(m => ({...m, linkModel: false}));
            setVisualMode('3d');
            setLinkInput('');
        } catch (err: any) {
            alert("Error al guardar link: " + err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleUnlink = async () => {
        if (!activeProjectId || !canUpload) return;
        if (!confirm("¿Estás seguro de eliminar el enlace al visualizador?")) return;
        setProcessing(true);
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/projects/${activeProjectId}/config/model`));
            setProjectLink(null);
        } catch (err: any) {
            alert("Error al desvincular: " + err.message);
        } finally {
            setProcessing(false);
        }
    };
    
    const openHistory = (p: Piece) => {
        setHistoryTarget(p);
        setModals(m => ({...m, pieceHistory: true}));
    };

    // --- Derived Data ---

    const activePieces = useMemo(() => pieces.filter(p => !p.eliminada), [pieces]);
    
    const uniquePhases = useMemo(() => {
        const s = new Set<number>();
        activePieces.forEach(p => { if(p.lote) s.add(Number(p.lote)) });
        return Array.from(s).sort((a,b) => a-b);
    }, [activePieces]);

    useEffect(() => {
        // Default select all phases
        if(selectedPhases.length === 0 && uniquePhases.length > 0) {
             setSelectedPhases(uniquePhases);
        }
    }, [uniquePhases]);

    const filteredPieces = useMemo(() => {
        return activePieces.filter(p => {
            const matchesSearch = !searchTerm || p.conjunto.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesPhase = !phaseFilter || p.lote.toString() === phaseFilter;
            
            let matchesState = true;
            if (stateFilter && stateValueFilter !== 'all') {
                const completed = isStateComplete(p[stateFilter]);
                matchesState = (stateValueFilter === 'true' && completed) || (stateValueFilter === 'false' && !completed);
            }
            return matchesSearch && matchesPhase && matchesState;
        });
    }, [activePieces, searchTerm, phaseFilter, stateFilter, stateValueFilter]);

    const stats = useMemo(() => {
        const s = { num: 0, area: 0, kg: 0 };
        const states: any = {};
        STATES.forEach(st => states[st.key] = 0);

        filteredPieces.forEach(p => {
            s.num += 1;
            s.area += (p.area || 0);
            s.kg += (p.peso || 0);
            STATES.forEach(st => {
                if(isStateComplete(p[st.key])) states[st.key] += (p.peso || 0);
            });
        });
        return { totals: s, states };
    }, [filteredPieces]);

    // --- Enhanced Dashboard Data Logic ---
    const dashboardData = useMemo(() => {
        // Filter active pieces by selected phases
        const chartPieces = activePieces.filter(p => selectedPhases.includes(Number(p.lote || 0)));
        const totalKg = chartPieces.reduce((sum, p) => sum + p.peso, 0);

        const bars = STATES.map(st => {
            const kg = chartPieces.filter(p => isStateComplete(p[st.key])).reduce((sum, p) => sum + p.peso, 0);
            return {
                name: st.label,
                short: st.short,
                kg: Math.round(kg),
                porcentaje: totalKg > 0 ? parseFloat(((kg / totalKg) * 100).toFixed(1)) : 0,
                color: st.color
            };
        });

        const distribution: Record<string, number> = {};
        let pendingKg = 0;

        chartPieces.forEach(p => {
            let foundState = false;
            for (let i = STATES.length - 1; i >= 0; i--) {
                const st = STATES[i];
                if (isStateComplete(p[st.key])) {
                    distribution[st.key] = (distribution[st.key] || 0) + p.peso;
                    foundState = true;
                    break; 
                }
            }
            if (!foundState) pendingKg += p.peso;
        });

        const currentStatusData = STATES.map(st => ({
            name: st.label,
            value: Math.round(distribution[st.key] || 0),
            color: st.color
        }));

        if (pendingKg > 0) {
            currentStatusData.unshift({ name: 'Pendiente / Sin Iniciar', value: Math.round(pendingKg), color: '#94a3b8' });
        }

        const finishedKg = bars[bars.length - 1].kg; 
        const progressGlobal = totalKg > 0 ? (finishedKg / totalKg) * 100 : 0;

        return { bars, currentStatusData, kpis: { totalKg: Math.round(totalKg), finishedKg, progressGlobal } };
    }, [activePieces, selectedPhases]);

    // --- Exports ---
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text(`Reporte: ${projects.find(p => p.id === activeProjectId)?.name}`, 14, 15);
        
        const tableData = filteredPieces.map(p => [
            p.conjunto, p.numero, p.area.toFixed(2), p.peso.toFixed(2), formatTime(p.loadedAt),
            p.lote ? `Fase ${p.lote}` : '-',
            ...STATES.map(s => isStateComplete(p[s.key]) ? 'Sí' : 'No'),
            p.comentario
        ]);
        
        autoTable(doc, {
            startY: 25,
            head: [['Conjunto', 'Nº', 'Área', 'Peso', 'Fecha', 'Fase', ...STATES.map(s => s.short), 'Com.']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 8 }
        });
        doc.save('reporte.pdf');
    };

    const exportExcel = () => {
        const data = filteredPieces.map(p => {
            const row: any = {
                'Conjunto': p.conjunto, 'Nº': p.numero, 'Área': p.area, 'Peso': p.peso, 'Fase': p.lote
            };
            STATES.forEach(s => {
                const st = p[s.key];
                const comp = isStateComplete(st);
                row[s.label] = comp ? 'Sí' : 'No';
                if(comp && typeof st === 'object') {
                    row[`${s.label} (User)`] = st.usuarioNombre;
                    row[`${s.label} (Fecha)`] = formatTime(st.fecha);
                }
            });
            row['Comentario'] = p.comentario;
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Piezas");
        XLSX.writeFile(wb, "reporte.xlsx");
    };

    if (authLoading) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50 text-blue-600"><Loader2 className="w-10 h-10 animate-spin"/></div>;

    if (modals.login) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/40 blur-3xl"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/40 blur-3xl"></div>

                <div className="bg-white/90 backdrop-blur-lg p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/50 relative z-10">
                    <div className="text-center mb-8">
                        <img src="https://www.solanasrl.com.ar/wp-content/uploads/cropped-sticky-2.png" alt="Solana SRL" className="h-14 mx-auto mb-4 object-contain drop-shadow-sm" />
                        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestión de Piezas</h1>
                        <p className="text-slate-500 text-sm mt-1">Control integral de obras y producción</p>
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
                        <button 
                            onClick={() => setIsRegistering(false)} 
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegistering ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Iniciar Sesión
                        </button>
                        <button 
                            onClick={() => setIsRegistering(true)} 
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegistering ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Registrarse
                        </button>
                    </div>
                    <form onSubmit={handleAuth} className="space-y-4">
                        {isRegistering && (
                            <div className="space-y-3 animate-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <input required placeholder="Nombre" className="input-field" value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} />
                                    <input required placeholder="Apellido" className="input-field" value={regData.last} onChange={e => setRegData({...regData, last: e.target.value})} />
                                </div>
                                <input required placeholder="Puesto" className="input-field" value={regData.role} onChange={e => setRegData({...regData, role: e.target.value})} />
                                <div className="relative">
                                    <select required className="input-field bg-white appearance-none" value={regData.area} onChange={e => setRegData({...regData, area: e.target.value})}>
                                        <option value="">Seleccionar Área</option>
                                        {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none"/>
                                </div>
                            </div>
                        )}
                        <div className="space-y-3">
                            <input required type="email" placeholder="Correo Electrónico" className="input-field" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                            <input required type="password" placeholder="Contraseña" className="input-field" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                        </div>
                        <Button type="submit" loading={processing} className="w-full py-2.5 mt-2 text-base">{isRegistering ? 'Crear Cuenta' : 'Ingresar'}</Button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row font-sans text-slate-800">
            
            {/* Mobile Header */}
            <div className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <img src="https://www.solanasrl.com.ar/wp-content/uploads/cropped-sticky-2.png" alt="Solana SRL" className="h-8 object-contain" />
                </div>
                <button onClick={() => signOut(auth)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600"><LogOut className="w-5 h-5" /></button>
            </div>

            {/* Sidebar (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] z-20">
                <div className="p-6 border-b border-slate-100/80">
                    <img src="https://www.solanasrl.com.ar/wp-content/uploads/cropped-sticky-2.png" alt="Solana SRL" className="h-9 mb-5 object-contain self-start" />
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs ring-2 ring-blue-50">
                            {userProfile?.nombre?.charAt(0) || user?.email?.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-slate-700 truncate">{userProfile?.nombre || 'Usuario'}</p>
                            <p className="text-xs text-slate-400 truncate">{userProfile?.puesto || 'Sin puesto'}</p>
                        </div>
                    </div>
                </div>
                
                <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block px-2">Proyecto Activo</label>
                        <div className="relative">
                            <select 
                                className="w-full p-2.5 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none transition-shadow cursor-pointer hover:bg-slate-100"
                                value={activeProjectId || ''}
                                onChange={(e) => setActiveProjectId(e.target.value || null)}
                            >
                                <option value="">-- Seleccionar Obra --</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none"/>
                        </div>
                    </div>

                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block px-2">Menú Principal</label>
                    <button onClick={() => setActiveView('pieces')} className={`nav-btn group ${activeView === 'pieces' ? 'active' : ''}`}>
                        <List className={`w-5 h-5 shrink-0 transition-colors ${activeView === 'pieces' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="font-medium">Gestión de Piezas</span>
                    </button>
                    <button onClick={() => setActiveView('charts')} className={`nav-btn group ${activeView === 'charts' ? 'active' : ''}`}>
                        <BarChart3 className={`w-5 h-5 shrink-0 transition-colors ${activeView === 'charts' ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="font-medium">Gráficos y Avance</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-2 bg-slate-50/50">
                    <button onClick={() => setModals(m => ({...m, manageProjects: true}))} className="nav-btn group text-slate-600 hover:bg-white hover:shadow-sm">
                        <Building className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-600" /> <span className="font-medium">Obras</span>
                    </button>
                    <button onClick={() => setModals(m => ({...m, profile: true}))} className="nav-btn group text-slate-600 hover:bg-white hover:shadow-sm">
                        <UserIcon className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-600" /> <span className="font-medium">Mi Perfil</span>
                    </button>
                    <button onClick={() => signOut(auth)} className="nav-btn group text-red-600 hover:bg-red-50 hover:text-red-700">
                        <LogOut className="w-5 h-5 shrink-0 text-red-400 group-hover:text-red-600" /> <span className="font-medium">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-h-screen scroll-smooth">
                {!activeProjectId ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-in fade-in duration-500">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                            <Building className="w-10 h-10 text-slate-300" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-600 mb-2">No hay obra seleccionada</h2>
                        <p className="text-slate-400 max-w-xs text-center">Selecciona un proyecto en el menú lateral para comenzar a gestionar.</p>
                    </div>
                ) : (
                    <>
                        {activeView === 'pieces' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Top Cards Section */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    
                                    {/* Stats Summary */}
                                    <div className="lg:col-span-8 bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                                        <div className="flex justify-between items-center mb-5">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">Resumen de Avance</h3>
                                                <p className="text-xs text-slate-400">Kilogramos procesados por estado</p>
                                            </div>
                                            <div className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-bold border border-slate-200">
                                                Total: {stats.totals.kg.toLocaleString('es-AR')} Kg
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 flex-1">
                                            {STATES.map(st => {
                                                const currentKg = stats.states[st.key];
                                                const percentage = stats.totals.kg > 0 ? (currentKg / stats.totals.kg) * 100 : 0;
                                                
                                                return (
                                                    <div key={st.key} className="relative flex flex-col p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden group">
                                                        <div className="absolute top-0 left-0 right-0 h-1" style={{backgroundColor: st.color}}></div>
                                                        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1 mt-1">{st.short}</span>
                                                        <div className="font-bold text-slate-800 text-lg sm:text-xl mt-auto tracking-tight group-hover:text-blue-700 transition-colors truncate">
                                                            {currentKg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                                        </div>
                                                        <div className="flex items-baseline justify-between mt-1">
                                                            <span className="text-[10px] text-slate-400 font-medium">Kg</span>
                                                            <span className="text-xs font-bold" style={{color: st.color}}>{percentage.toFixed(1)}%</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Visual Project Card (2D/3D Link) */}
                                    <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-auto min-h-[300px] group relative">
                                        {/* Header with toggle */}
                                        <div className="p-3 border-b border-slate-100 flex gap-2 justify-center bg-slate-50/50">
                                            <button 
                                                onClick={() => setVisualMode('2d')} 
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${visualMode === '2d' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                <ImageIcon className="w-3.5 h-3.5" /> Imagen 2D
                                            </button>
                                            <button 
                                                onClick={() => setVisualMode('3d')} 
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${visualMode === '3d' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                <LinkIcon className="w-3.5 h-3.5" /> Visualizador Web
                                            </button>
                                        </div>
                                        
                                        {/* Content Area */}
                                        <div className="flex-1 relative bg-slate-50 flex items-center justify-center overflow-hidden">
                                            {visualMode === '2d' ? (
                                                projectImage ? (
                                                    <>
                                                        <img 
                                                            src={projectImage} 
                                                            alt="Project" 
                                                            onClick={() => setIsImageExpanded(true)}
                                                            className="w-full h-full object-contain cursor-zoom-in hover:scale-105 transition-transform duration-500" 
                                                        />
                                                        <div className="absolute top-2 right-2 bg-black/50 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <Maximize2 className="w-4 h-4" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center text-slate-400 flex flex-col items-center">
                                                        <ImageIcon className="w-8 h-8 opacity-20 mb-2"/>
                                                        <p className="text-xs font-medium">Sin imagen</p>
                                                    </div>
                                                )
                                            ) : (
                                                projectLink ? (
                                                    <div className="w-full h-full relative">
                                                        <iframe
                                                            src={projectLink}
                                                            className="w-full h-full border-0"
                                                            title="Visualizador 3D"
                                                            allowFullScreen
                                                        />
                                                        {/* Overlay controls for link */}
                                                        <div className="absolute top-2 right-2 flex gap-2">
                                                             <a 
                                                                href={projectLink} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 bg-white/90 backdrop-blur text-slate-600 rounded-md shadow-sm hover:text-blue-600 border border-slate-200"
                                                                title="Abrir en nueva pestaña"
                                                             >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                             </a>
                                                             {canUpload && (
                                                                 <button 
                                                                    onClick={handleUnlink}
                                                                    className="p-1.5 bg-white/90 backdrop-blur text-red-500 rounded-md shadow-sm hover:bg-red-50 border border-red-100"
                                                                    title="Desvincular enlace"
                                                                 >
                                                                    <Unlink className="w-3.5 h-3.5" />
                                                                 </button>
                                                             )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-slate-400 flex flex-col items-center px-4">
                                                        <LinkIcon className="w-8 h-8 opacity-20 mb-2"/>
                                                        <p className="text-xs font-medium mb-2">Sin visualizador vinculado</p>
                                                        {canUpload && (
                                                            <button onClick={() => setModals(m => ({...m, linkModel: true}))} className="text-xs text-blue-600 hover:underline font-medium">
                                                                Vincular URL
                                                            </button>
                                                        )}
                                                    </div>
                                                )
                                            )}

                                            {/* Upload Action (Hover) */}
                                            {canUpload && !projectLink && visualMode === '3d' && (
                                                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 translate-y-2 group-hover:translate-y-0 flex flex-col items-center gap-2 w-full px-4">
                                                     <Button variant="secondary" onClick={() => setModals(m => ({...m, linkModel: true}))} className="shadow-lg border-white/20 text-slate-800 h-8 text-xs px-3 backdrop-blur-sm bg-white/90">
                                                        <LinkIcon className="w-3.5 h-3.5"/> Vincular Link
                                                     </Button>
                                                 </div>
                                            )}
                                            {canUpload && visualMode === '2d' && (
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 translate-y-2 group-hover:translate-y-0 flex flex-col items-center gap-2 w-full px-4">
                                                    <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
                                                    <Button variant="secondary" onClick={() => imageInputRef.current?.click()} className="shadow-lg border-white/20 text-slate-800 h-8 text-xs px-3 backdrop-blur-sm bg-white/90">
                                                        <Upload className="w-3.5 h-3.5"/> Cargar Imagen
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Toolbar Container */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex flex-col xl:flex-row gap-4 justify-between">
                                        
                                        {/* Left: Filters Group */}
                                        <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                                            <div className="relative w-full sm:w-64 group">
                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input 
                                                    placeholder="Buscar pieza..." 
                                                    className="input-field pl-10" 
                                                    value={searchTerm} 
                                                    onChange={e => setSearchTerm(e.target.value)} 
                                                />
                                            </div>
                                            <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <input 
                                                    placeholder="Fase..." 
                                                    className="input-field w-24 text-center" 
                                                    value={phaseFilter} 
                                                    onChange={e => setPhaseFilter(e.target.value)} 
                                                />
                                                <div className="relative min-w-[140px]">
                                                    <select className="input-field appearance-none pr-8 cursor-pointer" value={stateFilter} onChange={e => setStateFilter(e.target.value)}>
                                                        <option value="">Estado...</option>
                                                        {STATES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                                                    </select>
                                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
                                                </div>
                                                <div className="relative min-w-[120px]">
                                                    <select className="input-field appearance-none pr-8 cursor-pointer disabled:bg-slate-50 disabled:text-slate-400" disabled={!stateFilter} value={stateValueFilter} onChange={e => setStateValueFilter(e.target.value)}>
                                                        <option value="all">Todos</option>
                                                        <option value="true">Completado</option>
                                                        <option value="false">Pendiente</option>
                                                    </select>
                                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Actions Group */}
                                        <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-end items-center pt-4 xl:pt-0 border-t xl:border-0 border-slate-100">
                                            {canUpload && (
                                                <>
                                                    <input type="file" ref={fileInputRef} accept=".xlsx" className="hidden" onChange={handleExcelUpload} />
                                                    <Button variant="primary" onClick={() => fileInputRef.current?.click()} loading={processing} className="w-full sm:w-auto">
                                                        <FileSpreadsheet className="w-4 h-4"/> <span className="hidden sm:inline">Importar Excel</span>
                                                    </Button>
                                                </>
                                            )}
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <Button variant="secondary" onClick={exportPDF} title="Exportar PDF" className="flex-1 sm:flex-none">
                                                    <Download className="w-4 h-4"/> PDF
                                                </Button>
                                                <Button variant="secondary" onClick={exportExcel} title="Exportar Excel" className="flex-1 sm:flex-none">
                                                    <Download className="w-4 h-4"/> XLS
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Main Table */}
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-450px)] min-h-[400px]">
                                    <div className="overflow-auto flex-1 relative">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                                                <tr>
                                                    <th className="p-3.5 font-semibold pl-6 w-48">Conjunto</th>
                                                    <th className="p-3.5 font-semibold w-16 text-center">Nº</th>
                                                    <th className="p-3.5 font-semibold w-24 text-right">Área</th>
                                                    <th className="p-3.5 font-semibold w-24 text-right">Peso</th>
                                                    <th className="p-3.5 font-semibold w-24 text-center">Fase</th>
                                                    {STATES.map(s => <th key={s.key} className="p-3.5 text-center font-semibold w-16" title={s.label}>{s.short}</th>)}
                                                    <th className="p-3.5 text-center w-16">Com</th>
                                                    <th className="p-3.5 text-center w-16">Hist</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {loadingData ? (
                                                    <tr><td colSpan={14} className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2"/><p className="text-slate-400 text-xs">Cargando datos...</p></td></tr>
                                                ) : filteredPieces.length === 0 ? (
                                                    <tr><td colSpan={14} className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full w-full absolute"><Search className="w-8 h-8 mb-2 opacity-20"/>No se encontraron piezas con los filtros actuales.</td></tr>
                                                ) : (
                                                    filteredPieces.map(p => (
                                                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group border-b border-slate-50 last:border-0">
                                                            <td className="p-3 font-medium text-slate-800 pl-6 truncate max-w-[200px]" title={p.conjunto}>{p.conjunto}</td>
                                                            <td className="p-3 text-slate-500 text-center">{p.numero}</td>
                                                            <td className="p-3 text-slate-500 text-right font-mono">{p.area.toFixed(2)}</td>
                                                            <td className="p-3 text-slate-500 text-right font-mono">{p.peso.toFixed(2)}</td>
                                                            <td className="p-3 text-center">
                                                                <select 
                                                                    disabled={!canManagePhases}
                                                                    className="bg-slate-100/50 border-transparent hover:bg-slate-100 rounded text-slate-600 focus:ring-0 cursor-pointer disabled:cursor-not-allowed p-1 text-xs h-auto w-16 text-center font-medium appearance-none"
                                                                    value={p.lote}
                                                                    onChange={(e) => updatePhase(p.id, e.target.value)}
                                                                >
                                                                    <option value="">-</option>
                                                                    {[...Array(10)].map((_, i) => <option key={i} value={i+1}>F {i+1}</option>)}
                                                                </select>
                                                            </td>
                                                            {STATES.map(s => {
                                                                const status = p[s.key];
                                                                const isDone = isStateComplete(status);
                                                                const allowed = canEditState(s.key);
                                                                return (
                                                                    <td key={s.key} className="p-2 text-center">
                                                                        <button 
                                                                            disabled={!allowed}
                                                                            onClick={() => toggleState(p.id, s.key, status)}
                                                                            className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center transition-all duration-200 ${
                                                                                isDone 
                                                                                ? `text-white shadow-sm hover:shadow hover:scale-105` 
                                                                                : 'bg-slate-50 border border-slate-200 text-slate-300 hover:border-slate-300 hover:bg-slate-100'
                                                                            } ${!allowed ? 'opacity-40 cursor-not-allowed hover:scale-100 hover:bg-slate-50 hover:border-slate-200' : ''}`}
                                                                            style={isDone ? { backgroundColor: s.color, borderColor: s.color } : {}}
                                                                            title={isDone && typeof status === 'object' ? `Completado por: ${status.usuarioNombre}\nFecha: ${formatTime(status.fecha)}` : ''}
                                                                        >
                                                                            {isDone && <CheckCircle2 className="w-4 h-4 stroke-[3]" />}
                                                                        </button>
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-3 text-center">
                                                                <button 
                                                                    onClick={() => { setCommentTarget({id: p.id, text: p.comentario}); setModals(m => ({...m, comment: true})); }}
                                                                    className={`transition-all p-1.5 rounded-lg hover:bg-blue-50 ${p.comentario ? 'text-blue-600 bg-blue-50/50' : 'text-slate-300 hover:text-blue-500'}`}
                                                                    title={p.comentario || "Agregar comentario"}
                                                                >
                                                                    <MessageSquare className="w-4 h-4 fill-current" />
                                                                </button>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <button 
                                                                    onClick={() => openHistory(p)}
                                                                    className="transition-all p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50"
                                                                    title="Ver historial de estados"
                                                                >
                                                                    <History className="w-4 h-4" />
                                                                </button>
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
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-8">
                                
                                {/* Phase Filter Section - Enhanced */}
                                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                                            <Filter className="w-5 h-5 text-slate-400"/> Filtro de Fases
                                        </h3>
                                        <button 
                                            onClick={() => setSelectedPhases(selectedPhases.length === uniquePhases.length ? [] : uniquePhases)}
                                            className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md font-medium hover:bg-blue-100 transition-colors"
                                        >
                                            {selectedPhases.length === uniquePhases.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniquePhases.length === 0 ? <p className="text-slate-400 text-sm italic">No hay fases definidas en este proyecto.</p> :
                                        uniquePhases.map(ph => (
                                            <label key={ph} className={`group flex items-center gap-2 text-sm cursor-pointer px-4 py-2 rounded-full border transition-all select-none ${selectedPhases.includes(ph) ? 'bg-slate-800 border-slate-800 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedPhases.includes(ph)}
                                                    onChange={e => {
                                                        if(e.target.checked) setSelectedPhases(prev => [...prev, ph]);
                                                        else setSelectedPhases(prev => prev.filter(x => x !== ph));
                                                    }}
                                                    className="hidden"
                                                />
                                                <span className="font-medium">Fase {ph}</span>
                                                {selectedPhases.includes(ph) && <CheckCircle2 className="w-3.5 h-3.5 text-blue-300" />}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                            <Scale className="w-6 h-6"/>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Peso Total (Selección)</p>
                                            <p className="text-2xl font-bold text-slate-800">{dashboardData.kpis.totalKg.toLocaleString('es-AR')} <span className="text-sm text-slate-400 font-normal">kg</span></p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                            <CheckCircle2 className="w-6 h-6"/>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Terminado (Montado)</p>
                                            <p className="text-2xl font-bold text-slate-800">{dashboardData.kpis.finishedKg.toLocaleString('es-AR')} <span className="text-sm text-slate-400 font-normal">kg</span></p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                                            <Activity className="w-6 h-6"/>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500 font-medium">Progreso Global</p>
                                            <p className="text-2xl font-bold text-slate-800">{dashboardData.kpis.progressGlobal.toFixed(1)}%</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Charts Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Bar Chart (Cumulative) */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px] flex flex-col">
                                        <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-slate-400"/> Avance Acumulado por Etapa</h3>
                                        <div className="flex-1 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={dashboardData.bars} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} interval={0} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                                                    <Tooltip 
                                                        cursor={{fill: '#f8fafc'}} 
                                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                                                        formatter={(value: any, name: any, props: any) => [`${value}% (${props.payload.kg} kg)`, name]}
                                                    />
                                                    <Bar dataKey="porcentaje" radius={[6, 6, 0, 0]} barSize={40}>
                                                        {dashboardData.bars.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Horizontal Bar Chart (Current Inventory) - REPLACED PIE CHART */}
                                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[450px] flex flex-col">
                                        <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Layers className="w-5 h-5 text-slate-400"/> Inventario en Proceso (Estado Actual)</h3>
                                        <p className="text-xs text-slate-400 mb-4">Cantidad de kg acumulados en cada estación (Cuellos de botella)</p>
                                        <div className="flex-1 min-h-0">
                                            {dashboardData.currentStatusData.length === 0 ? (
                                                <div className="h-full w-full flex flex-col items-center justify-center text-slate-300">
                                                    <List className="w-12 h-12 mb-2 opacity-20"/>
                                                    <p className="text-sm">Sin datos para mostrar</p>
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart 
                                                        layout="vertical" 
                                                        data={dashboardData.currentStatusData} 
                                                        margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                                                        <YAxis 
                                                            dataKey="name" 
                                                            type="category" 
                                                            axisLine={false} 
                                                            tickLine={false} 
                                                            tick={{fill: '#475569', fontSize: 11, fontWeight: 500}} 
                                                            width={100}
                                                        />
                                                        <Tooltip 
                                                            cursor={{fill: '#f8fafc'}}
                                                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                                            formatter={(value: any) => [`${value.toLocaleString('es-AR')} kg`, 'Stock Actual']}
                                                        />
                                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                                                            {dashboardData.currentStatusData.map((entry, index) => (
                                                                <Cell key={`cell-inv-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Modals */}
            
            <Modal isOpen={modals.manageProjects} onClose={() => setModals(m => ({...m, manageProjects: false}))} title="Gestión de Obras">
                {canManageProjects && (
                    <form onSubmit={handleCreateProject} className="flex gap-3 mb-6">
                        <input name="pname" placeholder="Nombre de nueva obra" className="input-field flex-1" />
                        <Button variant="primary"><Plus className="w-4 h-4"/> Crear</Button>
                    </form>
                )}
                <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {projects.length === 0 ? <p className="text-center text-slate-400 italic py-4">No hay obras registradas.</p> :
                    projects.map(p => (
                        <li key={p.id} className="flex justify-between items-center p-3.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors group">
                            <div className="flex items-center gap-3">
                                <Building className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors"/>
                                <span className="font-medium text-slate-700">{p.name}</span>
                            </div>
                            {canManageProjects && (
                                <button onClick={() => handleDeleteProject(p.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all" title="Eliminar obra">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </Modal>

            <Modal isOpen={modals.comment} onClose={() => setModals(m => ({...m, comment: false}))} title="Comentario de la Pieza">
                <textarea 
                    className="input-field w-full h-32 resize-none mb-4 text-sm leading-relaxed"
                    placeholder="Escriba un comentario relevante..."
                    value={commentTarget?.text || ''}
                    onChange={e => setCommentTarget(prev => prev ? {...prev, text: e.target.value} : null)}
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setModals(m => ({...m, comment: false}))}>Cancelar</Button>
                    <Button onClick={saveComment}>Guardar Comentario</Button>
                </div>
            </Modal>
            
            <Modal isOpen={modals.profile} onClose={() => setModals(m => ({...m, profile: false}))} title="Mi Perfil">
                <form onSubmit={handleUpdateProfile} className="space-y-5">
                    <div className="flex items-center gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                        <div className="w-16 h-16 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center text-2xl font-bold shadow-inner">
                            {userProfile?.nombre?.charAt(0) || user?.email?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <p className="text-slate-500 text-xs uppercase font-bold mb-1">Cuenta de Usuario</p>
                            <p className="text-slate-800 font-medium">{user?.email}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase">Nombre</label>
                            <input 
                                required 
                                className="input-field" 
                                value={editProfileData.nombre} 
                                onChange={e => setEditProfileData({...editProfileData, nombre: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase">Apellido</label>
                            <input 
                                required 
                                className="input-field" 
                                value={editProfileData.apellido} 
                                onChange={e => setEditProfileData({...editProfileData, apellido: e.target.value})}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Puesto / Rol</label>
                        <input 
                            required 
                            className="input-field" 
                            value={editProfileData.puesto} 
                            onChange={e => setEditProfileData({...editProfileData, puesto: e.target.value})}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Área</label>
                        <div className="relative">
                            <select 
                                required 
                                className="input-field appearance-none bg-white" 
                                value={editProfileData.area} 
                                onChange={e => setEditProfileData({...editProfileData, area: e.target.value})}
                            >
                                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none"/>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setModals(m => ({...m, profile: false}))}>Cancelar</Button>
                        <Button type="submit" loading={processing}>
                            <Save className="w-4 h-4" /> Guardar Cambios
                        </Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={modals.confirm} onClose={() => setModals(m => ({...m, confirm: false}))} title={confirmAction?.title}>
                <div className="flex flex-col items-center text-center p-2">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-2">{confirmAction?.title}</h4>
                    <p className="text-slate-500 mb-8 leading-relaxed">{confirmAction?.msg}</p>
                    <div className="flex gap-3 w-full">
                        <Button variant="secondary" className="flex-1" onClick={() => setModals(m => ({...m, confirm: false}))}>Cancelar</Button>
                        <Button variant="danger" className="flex-1" onClick={confirmAction?.action}>Confirmar Eliminación</Button>
                    </div>
                </div>
            </Modal>
            
            <Modal isOpen={modals.pieceHistory} onClose={() => setModals(m => ({...m, pieceHistory: false}))} title={`Historial de Pieza: ${historyTarget?.conjunto}`}>
                <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {/* Creation Info */}
                    <div className="relative pl-10">
                         <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-slate-300 border-2 border-white shadow-sm z-10"></div>
                         <div className="flex flex-col">
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Creación</span>
                             <p className="text-slate-800 font-medium">Cargado al sistema</p>
                             <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                <Calendar className="w-3 h-3"/> {historyTarget ? formatTime(historyTarget.loadedAt) : '-'}
                             </div>
                         </div>
                    </div>

                    {STATES.map((st, index) => {
                        const status = historyTarget ? historyTarget[st.key] : null;
                        const isDone = isStateComplete(status);
                        const auditData = isDone && typeof status === 'object' ? status : null;

                        return (
                            <div key={st.key} className="relative pl-10">
                                <div 
                                    className={`absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors ${isDone ? '' : 'bg-slate-100'}`}
                                    style={isDone ? { backgroundColor: st.color } : {}}
                                ></div>
                                <div className={`p-3 rounded-lg border ${isDone ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200 opacity-70'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider" style={{color: isDone ? st.color : '#94a3b8'}}>{st.label}</span>
                                            <p className="font-medium text-slate-800">{isDone ? 'Completado' : 'Pendiente'}</p>
                                        </div>
                                        {isDone && auditData && (
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-1.5 text-xs font-medium text-slate-700 mb-0.5">
                                                    <UserIcon className="w-3 h-3 text-slate-400"/> {auditData.usuarioNombre || 'Desconocido'}
                                                </div>
                                                <div className="flex items-center justify-end gap-1.5 text-xs text-slate-500">
                                                    <Clock className="w-3 h-3 text-slate-400"/> {formatTime(auditData.fecha)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <Button variant="secondary" onClick={() => setModals(m => ({...m, pieceHistory: false}))}>Cerrar</Button>
                </div>
            </Modal>

            <Modal isOpen={modals.linkModel} onClose={() => setModals(m => ({...m, linkModel: false}))} title="Vincular Visualizador Externo">
                <form onSubmit={handleLinkSave}>
                    <div className="space-y-4 mb-6">
                         <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
                             Puedes pegar aquí el enlace público de tu modelo en Autodesk Viewer, Sketchfab, o cualquier visor web.
                         </div>
                         <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-500 uppercase">URL del Modelo</label>
                             <input 
                                required
                                type="url"
                                placeholder="https://viewer.autodesk.com/..." 
                                className="input-field"
                                value={linkInput}
                                onChange={e => setLinkInput(e.target.value)}
                             />
                         </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setModals(m => ({...m, linkModel: false}))}>Cancelar</Button>
                        <Button type="submit" loading={processing}>Guardar Enlace</Button>
                    </div>
                </form>
            </Modal>

            {/* Fullscreen Image Modal (Lightbox) */}
            {isImageExpanded && projectImage && (
                <div 
                    className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setIsImageExpanded(false)}
                >
                    {/* Close button */}
                    <button 
                        onClick={() => setIsImageExpanded(false)}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    
                    {/* Image */}
                    <img 
                        src={projectImage} 
                        alt="Project Fullscreen" 
                        className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-300 rounded-md"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
                    />
                </div>
            )}

            <style>{`
                .input-field { 
                    @apply w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 
                    focus:ring-2 focus:ring-blue-100 focus:border-blue-500 
                    outline-none transition-all text-sm shadow-sm placeholder:text-slate-400 h-10; 
                }
                .nav-btn { 
                    @apply w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-500 
                    transition-all duration-200 border border-transparent whitespace-nowrap; 
                }
                .nav-btn:hover { 
                    @apply bg-slate-100 text-slate-900; 
                }
                .nav-btn.active { 
                    @apply bg-blue-600 text-white shadow-md shadow-blue-600/20 border-transparent; 
                }
                /* Custom Scrollbar for Table */
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </div>
    );
}