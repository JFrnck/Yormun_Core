// Tokens en su propio archivo (mismo motivo que
// src/model-provider/model-provider.tokens.ts): evita imports
// circulares entre budget.module.ts (que necesita el token para el
// factory de config/precios) y los servicios que lo consumen.
export const BUDGET_CONFIG = Symbol('BUDGET_CONFIG');
export const MODEL_PRICES = Symbol('MODEL_PRICES');
