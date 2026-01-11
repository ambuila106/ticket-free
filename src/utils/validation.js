// Validadores y sanitización de inputs

export const validators = {
  email(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },
  
  phone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Solo números, espacios, +, -, ()
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    const digitsOnly = phone.replace(/\D/g, '');
    return phoneRegex.test(phone) && digitsOnly.length >= 7 && digitsOnly.length <= 15;
  },
  
  text(text, maxLength = 200) {
    if (!text || typeof text !== 'string') return false;
    // Remover caracteres peligrosos
    const sanitized = text.trim().replace(/[<>\"']/g, '');
    return sanitized.length > 0 && sanitized.length <= maxLength;
  },
  
  cantidadBoletas(cantidad) {
    const num = parseInt(cantidad);
    return !isNaN(num) && num > 0 && num <= 100;
  },
  
  precio(precio) {
    if (!precio || precio === 'Gratis' || precio.trim() === '') return true;
    // Permitir formato: $50.000, 50000, 50.000, etc.
    const precioStr = precio.toString().replace(/[^0-9]/g, '');
    const precioNum = parseInt(precioStr);
    return !isNaN(precioNum) && precioNum >= 0 && precioNum <= 100000000;
  },
  
  estado(estado) {
    const estadosPermitidos = ['pagado', 'entregado', 'cancelado'];
    return estadosPermitidos.includes(estado);
  }
};

export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .trim()
    .replace(/[<>\"']/g, '') // Remover caracteres peligrosos
    .substring(0, 500); // Limitar longitud
}

export function sanitizeNumber(value, min = 0, max = 1000000) {
  const num = parseInt(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

