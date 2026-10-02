// Steps of the product submission wizard. Kept in a plain module (not a
// 'use client' file) so both server pages and client components can read it.
// Labels are dictionary keys.
export const WIZARD_STEPS = ['seller.steps.basics', 'seller.steps.pricing', 'seller.steps.images', 'seller.steps.features', 'seller.steps.seller', 'seller.steps.preview'] as const
