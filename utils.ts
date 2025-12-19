import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase/firestore';

export const formatTime = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  if (timestamp.toDate) {
    return timestamp.toDate().toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }
  return new Date(timestamp).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
};

export const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (!e.target?.result) return reject(new Error("No se pudo leer el archivo."));
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
                
                const normalize = (text: any) => (text || '').toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                let headerRow = -1;
                // Buscamos la fila que contiene las cabeceras críticas
                for(let i=0; i<Math.min(json.length, 50); i++) {
                    const row = (json[i]||[]).map(h => normalize(h));
                    const hasConjunto = row.some(h => h.includes('conjunto') || h.includes('pieza') || h.includes('descripcion') || h.includes('nombre'));
                    const hasPeso = row.some(h => h.includes('peso') || h.includes('masa') || h.includes('kg') || h.includes('kgs'));
                    const hasNumero = row.some(h => h === 'n' || h.includes('n°') || h.includes('numero') || h.includes('cantidad') || h.includes('cant') || h.includes('unid'));

                    if(hasConjunto && (hasPeso || hasNumero)) { 
                        headerRow = i; 
                        break; 
                    }
                }
                
                if (headerRow === -1) {
                    return reject(new Error("No se encontraron cabeceras válidas. El Excel debe tener columnas como: Conjunto/Pieza, Peso/Kg y Cantidad/N°."));
                }

                const rawHeaders = (json[headerRow] as any[]).map(h => normalize(h));
                
                const colMap = { 
                    conjunto: rawHeaders.findIndex(h => h.includes('conjunto') || h.includes('pieza') || h.includes('descripcion') || h.includes('nombre')),
                    numero: rawHeaders.findIndex(h => h === 'n' || h.includes('n°') || h.includes('numero') || h.includes('cantidad') || h.includes('cant') || h.includes('unid')),
                    area: rawHeaders.findIndex(h => h.includes('area') || h.includes('superficie')),
                    peso: rawHeaders.findIndex(h => h.includes('peso') || h.includes('masa') || h.includes('kg') || h.includes('kgs'))
                };

                const result: any[] = [];
                for(let i=headerRow+1; i<json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;
                    
                    const conjuntoVal = row[colMap.conjunto];
                    if (!conjuntoVal || conjuntoVal.toString().trim() === '') continue;
                    
                    const normalizedConjunto = normalize(conjuntoVal);
                    // Ignorar filas de sumatorias o guiones
                    if (normalizedConjunto.includes('-----') || normalizedConjunto.includes('total') || normalizedConjunto === 'total') continue;
                    
                    const pesoRaw = parseFloat(row[colMap.peso]) || 0;
                    const numeroRaw = parseInt(row[colMap.numero]) || 1;
                    const areaRaw = parseFloat(row[colMap.area]) || 0;

                    // Si numeroRaw > 1, podemos elegir tratarlo como una sola entrada o varias.
                    // Para el sistema de seguimiento unitario, expandimos las piezas.
                    const count = Math.max(1, numeroRaw);
                    for (let k = 0; k < count; k++) {
                        result.push({
                            conjunto: conjuntoVal.toString().trim(),
                            numero: 1, // Cada entrada es 1 unidad
                            area: areaRaw,
                            peso: pesoRaw / count // Repartimos el peso si el Excel traía el peso total del lote
                        });
                    }
                }
                
                if (result.length === 0) return reject(new Error("El archivo no contiene datos de piezas procesables."));
                resolve(result);
            } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error("Error de lectura de archivo."));
        reader.readAsArrayBuffer(file);
    });
};

export const isStateComplete = (status: any): boolean => {
    if (status === true) return true;
    if (typeof status === 'object' && status !== null) {
        return status.completado === true;
    }
    return false; 
};