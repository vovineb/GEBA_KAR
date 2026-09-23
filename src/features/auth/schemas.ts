import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters');
export const otpSchema = z.string().trim().regex(/^\d{6,10}$/, 'Enter the code from the email');

export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') });

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your name').max(80),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
