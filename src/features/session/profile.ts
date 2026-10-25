import { z } from 'zod';

import { BIRTHDAY_MONTH_DAYS } from '@/shared/birthday';

/** Only birthday day/month are optional; no birth year or location lookup. */
export const birthdaySchema=z.object({month:z.number().int().min(1).max(12),day:z.number().int().min(1).max(31)}).strict().refine(v=>v.day<=BIRTHDAY_MONTH_DAYS[v.month-1],{message:'Elige un día válido para ese mes'});
export const playerProfileSchema = z.object({
  birthday:birthdaySchema.nullable().optional(),
  age: z.number().int('Introduce una edad entera').min(0, 'La edad no puede ser negativa').max(120, 'La edad debe estar entre 0 y 120 años').optional(),
  locality: z.string().trim().max(80, 'La localidad puede tener hasta 80 caracteres').transform(value => value || undefined).optional(),
});
export type PlayerProfileInput = z.input<typeof playerProfileSchema>;
