// Steps of the product submission wizard. Kept in a plain module (not a
// 'use client' file) so both server pages and client components can read it.
export const WIZARD_STEPS = ['Basic info', 'Pricing', 'Images', 'Features', 'Seller', 'Preview & submit'] as const
