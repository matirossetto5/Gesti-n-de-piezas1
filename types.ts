
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  id?: string;
  authUid: string;
  email: string;
  nombre: string;
  apellido: string;
  puesto: string;
  area: string;
  avatarUrl?: string;
  createdAt: any;
}

export interface Project {
  id: string;
  name: string;
  createdAt: any;
  archived?: boolean;
  imageUrl?: string;
  externalLink?: string;
}

export interface AuditStatus {
  completado: boolean;
  usuarioId: string | null;
  usuarioNombre: string | null;
  fecha: Timestamp | Date | null;
}

// Flexible interface to allow dynamic state keys
export interface Piece {
  id: string;
  conjunto: string;
  numero: number;
  area: number;
  peso: number;
  lote: number | string; // Fase
  comentario: string;
  eliminada: boolean;
  loadedAt: any;
  loadedBy: string;
  
  // States
  planoCorte?: AuditStatus | boolean;
  planoArmado?: AuditStatus | boolean;
  corte?: AuditStatus | boolean;
  armado?: AuditStatus | boolean;
  pintura?: AuditStatus | boolean;
  despachado?: AuditStatus | boolean;
  montado?: AuditStatus | boolean;
  
  [key: string]: any;
}

export interface ProjectConfig {
  base64Image: string;
  fileName: string;
  uploadedBy: string;
  uploadedAt: any;
}

export interface SyncLog {
  id: string;
  date: any;
  user: string;
  file: string;
  added: number;
  removed: number;
  addedDetails: string;
  removedDetails: string;
}

export const AREAS = [
  "Dirección", "Técnico-Comercial", "Recursos Humanos", "Finanzas",
  "Compras", "Almacén", "Producción", "Oficina Técnica", "Obra",
  "Soporte IT", "Logistica"
];

export const STATES = [
  { key: 'planoCorte', label: 'Pl. Corte', short: 'PC', color: '#3b82f6' },
  { key: 'planoArmado', label: 'Pl. Armado', short: 'PA', color: '#14b8a6' },
  { key: 'corte', label: 'Corte', short: 'CT', color: '#eab308' },
  { key: 'armado', label: 'Armado', short: 'AR', color: '#f97316' },
  { key: 'pintura', label: 'Pintura', short: 'PT', color: '#a855f7' },
  { key: 'despachado', label: 'Despachado', short: 'DP', color: '#ef4444' },
  { key: 'montado', label: 'Montado', short: 'MT', color: '#22c55e' }
];

export const AREA_PERMISSIONS: Record<string, string[]> = {
  "Oficina Técnica": [ "planoCorte", "planoArmado" ],
  "Producción": [ "corte", "armado", "pintura", "despachado" ],
  "Obra": [ "despachado", "montado" ],
  "Logistica": [ "despachado" ],
  "Dirección": [],
  "Técnico-Comercial": [],
  "Recursos Humanos": [],
  "Finanzas": [],
  "Compras": [],
  "Almacén": [],
  "Soporte IT": []
};
