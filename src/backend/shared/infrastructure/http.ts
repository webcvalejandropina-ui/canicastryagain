import { AppError } from '@/backend/shared/domain/AppError';
import { ZodError } from 'zod';

export function toHttpError(error: unknown): { status: number; body: { error: string; code: string } } {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code
      }
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: error.issues[0]?.message ?? 'Solicitud inválida',
        code: 'INVALID_REQUEST'
      }
    };
  }

  if (error instanceof Error && 'code' in error &&
      ['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(String(error.code))) {
    return { status: 503, body: { error: 'El servidor está ocupado. Comprobamos el estado antes de repetir la jugada.', code: 'SERVER_BUSY' } };
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled API error:', error);
  }

  return {
    status: 500,
    body: {
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    }
  };
}
