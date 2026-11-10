'use strict';
// Validaciones del servidor. El navegador puede validar para mejorar la experiencia,
// pero la decisión final siempre se toma aquí.
const { HttpError } = require('./http');

function fail(field, message) {
  throw new HttpError(400, 'VALIDATION_ERROR', 'Datos inválidos', [{ field, message }]);
}

const v = {
  object(value, field = 'body') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field, 'Debe ser un objeto JSON');
    return value;
  },
  string(value, field, { min = 1, max = 200, pattern, optional = false } = {}) {
    if (value === undefined || value === null || value === '') {
      if (optional) return null;
      fail(field, 'Es obligatorio');
    }
    if (typeof value !== 'string') fail(field, 'Debe ser texto');
    const s = value.trim();
    if (s.length < min || s.length > max) fail(field, `Debe tener entre ${min} y ${max} caracteres`);
    if (pattern && !pattern.test(s)) fail(field, 'Formato inválido');
    return s;
  },
  int(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
    if (value === undefined || value === null) {
      if (optional) return null;
      fail(field, 'Es obligatorio');
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) fail(field, 'Debe ser un número entero');
    if (value < min || value > max) fail(field, `Debe estar entre ${min} y ${max}`);
    return value;
  },
  bool(value, field, { optional = false } = {}) {
    if (value === undefined || value === null) {
      if (optional) return null;
      fail(field, 'Es obligatorio');
    }
    if (typeof value !== 'boolean') fail(field, 'Debe ser verdadero o falso');
    return value;
  },
  oneOf(value, field, options, { optional = false } = {}) {
    if (value === undefined || value === null) {
      if (optional) return null;
      fail(field, 'Es obligatorio');
    }
    if (!options.includes(value)) fail(field, `Debe ser uno de: ${options.join(', ')}`);
    return value;
  },
  email(value, field = 'email') {
    return v.string(value, field, { min: 5, max: 120, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ }).toLowerCase();
  },
  uuid(value, field) {
    return v.string(value, field, { min: 36, max: 36, pattern: /^[0-9a-f-]{36}$/i });
  },
  allowedKeys(obj, keys, field = 'body') {
    for (const k of Object.keys(obj)) if (!keys.includes(k)) fail(`${field}.${k}`, 'Campo no permitido');
  },
};

module.exports = { v, fail };
