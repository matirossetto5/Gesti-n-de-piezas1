/**
 * Input validation utilities for security and data integrity
 * Prevents XSS, SQL injection, and invalid data
 */

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationService {
  /**
   * Sanitize user input to prevent XSS attacks
   */
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): { valid: boolean; error?: string } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'El email es requerido' };
    }

    if (email.length > 254) {
      return { valid: false, error: 'El email es demasiado largo' };
    }

    if (!emailRegex.test(email)) {
      return { valid: false, error: 'El formato del email no es válido' };
    }

    return { valid: true };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'La contraseña es requerida' };
    }

    if (password.length < 6) {
      return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres' };
    }

    if (password.length > 128) {
      return { valid: false, error: 'La contraseña es demasiado larga' };
    }

    return { valid: true };
  }

  /**
   * Validate name field (letters, spaces, hyphens)
   */
  static validateName(name: string): { valid: boolean; error?: string } {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'El nombre es requerido' };
    }

    if (name.trim().length === 0) {
      return { valid: false, error: 'El nombre no puede estar vacío' };
    }

    if (name.length > 100) {
      return { valid: false, error: 'El nombre es demasiado largo' };
    }

    // Allow letters, spaces, hyphens, and accents
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-']+$/;
    if (!nameRegex.test(name)) {
      return { valid: false, error: 'El nombre contiene caracteres no permitidos' };
    }

    return { valid: true };
  }

  /**
   * Validate number (peso, area, etc)
   */
  static validateNumber(value: any, min = 0, max = Infinity): { valid: boolean; error?: string } {
    const num = parseFloat(value);

    if (isNaN(num)) {
      return { valid: false, error: 'Debe ser un número válido' };
    }

    if (num < min) {
      return { valid: false, error: `Debe ser mayor o igual a ${min}` };
    }

    if (num > max) {
      return { valid: false, error: `Debe ser menor o igual a ${max}` };
    }

    return { valid: true };
  }

  /**
   * Validate project name
   */
  static validateProjectName(name: string): { valid: boolean; error?: string } {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'El nombre del proyecto es requerido' };
    }

    if (name.trim().length === 0) {
      return { valid: false, error: 'El nombre no puede estar vacío' };
    }

    if (name.length < 3) {
      return { valid: false, error: 'El nombre debe tener al menos 3 caracteres' };
    }

    if (name.length > 150) {
      return { valid: false, error: 'El nombre es demasiado largo' };
    }

    return { valid: true };
  }

  /**
   * Validate URL
   */
  static validateUrl(url: string): { valid: boolean; error?: string } {
    if (!url) {
      return { valid: true }; // URL is optional
    }

    try {
      new URL(url);
      return { valid: true };
    } catch {
      return { valid: false, error: 'URL no válida' };
    }
  }

  /**
   * Validate piece data from Excel import
   */
  static validatePieceData(piece: any): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];

    // Validate conjunto
    if (!piece.conjunto || typeof piece.conjunto !== 'string' || piece.conjunto.trim() === '') {
      errors.push({ field: 'conjunto', message: 'El conjunto es requerido' });
    } else if (piece.conjunto.length > 200) {
      errors.push({ field: 'conjunto', message: 'El conjunto es demasiado largo' });
    }

    // Validate peso
    const pesoValidation = this.validateNumber(piece.peso, 0, 10000);
    if (!pesoValidation.valid) {
      errors.push({ field: 'peso', message: pesoValidation.error || 'Peso inválido' });
    }

    // Validate numero
    if (piece.numero !== undefined) {
      const numeroValidation = this.validateNumber(piece.numero, 1, 10000);
      if (!numeroValidation.valid) {
        errors.push({ field: 'numero', message: numeroValidation.error || 'Número inválido' });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a safe object from user input, filtering dangerous properties
   */
  static createSafeObject(obj: Record<string, any>, allowedKeys: string[]): Record<string, any> {
    const safe: Record<string, any> = {};

    for (const key of allowedKeys) {
      if (key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
          safe[key] = this.sanitizeInput(value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          safe[key] = value;
        }
        // Skip other types for safety
      }
    }

    return safe;
  }
}
