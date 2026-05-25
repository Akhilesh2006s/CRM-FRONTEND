export const TRAINER_CATEGORIES = ['Abacus', 'Vedic Maths', 'ECC', 'IIT'] as const;

export const normalizeTrainerProducts = (products: string[] = []) =>
  products.map((p) => (p === 'EEL' ? 'ECC' : p));
