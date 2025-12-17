import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase/firestore';

export const formatTime = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  // Handle Firestore Timestamp
  if (timestamp.toDate) {
    return timestamp.toDate().toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }
  // Handle JS Date or string
  return new Date(timestamp).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

export const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (!e.target?.result) return reject(new Error("Falló lectura archivo"));
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                
                const normalize = (text: any) => (text || '').toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                let headerRow = -1;
                for(let i=0; i<Math.min(json.length, 20); i++) {
                    const row = (json[i]||[]).map(h => normalize(h));
                    const rowStr = row.join(' ');
                    if(rowStr.includes('conjunto') && rowStr.includes('peso') && (rowStr.includes('n') || rowStr.includes('area'))) { 
                        headerRow = i; 
                        break; 
                    }
                }
                if (headerRow === -1) return reject(new Error("No se encontraron cabeceras válidas (Conjunto, N°, Área, Peso)."));

                const rawHeaders = (json[headerRow] as any[]).map(h => normalize(h));
                
                const colMap = { 
                    conjunto: rawHeaders.findIndex(h => h.includes('conjunto')),
                    numero: rawHeaders.findIndex(h => h === 'n' || h.includes('n°') || h.includes('numero')),
                    area: rawHeaders.findIndex(h => h.includes('area')),
                    peso: rawHeaders.findIndex(h => h.includes('peso'))
                };
                
                if (colMap.numero === -1) colMap.numero = rawHeaders.findIndex(h => h === 'n');

                if (Object.values(colMap).includes(-1)) {
                    return reject(new Error(`Faltan columnas requeridas.`));
                }

                const result: any[] = [];
                for(let i=headerRow+1; i<json.length; i++) {
                    const row = json[i];
                    const conjuntoVal = row[colMap.conjunto];
                    
                    if (!conjuntoVal || conjuntoVal.toString().trim() === '') continue;
                    const normalizedConjunto = normalize(conjuntoVal);

                    if (normalizedConjunto.includes('-----') || normalizedConjunto.includes('total')) continue;
                    
                    const rowText = row.map((c: any) => normalize(c)).join('').replace(/ /g, '');
                    if (rowText.length > 0 && /^[-_]+$/.test(rowText)) continue;

                    const basePiece = {
                        conjunto: conjuntoVal.toString().trim(),
                        numero: parseFloat(row[colMap.numero]) || 1, 
                        area: parseFloat(row[colMap.area]) || 0,
                        peso: parseFloat(row[colMap.peso]) || 0
                    };
                    
                    const count = basePiece.numero;
                    if (count <= 0) continue; 
                    
                    // Expansion Logic: 1 row per unit
                    for (let k = 0; k < count; k++) {
                        result.push({
                            conjunto: basePiece.conjunto,
                            numero: 1,
                            area: basePiece.area,
                            peso: basePiece.peso
                        });
                    }
                }
                resolve(result);
            } catch (err) { reject(err); }
        };
        reader.readAsArrayBuffer(file);
    });
};

export const isStateComplete = (status: any): boolean => {
    if (typeof status === 'object' && status !== null) {
        return status.completado === true;
    }
    return status === true; 
};
