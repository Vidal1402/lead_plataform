import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../services/creditService';
import { createError } from '../middleware/errorHandler';

export interface CreditCheckOptions {
  amount?: number;
  field?: string;
}

/**
 * Middleware para verificar se o usuário tem créditos suficientes
 * @param options - Opções de verificação
 */
export const requireCredits = (options: CreditCheckOptions = {}) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        throw createError('Usuário não autenticado.', 401);
      }

      let requiredCredits = options.amount;

      // Se não foi especificado um valor, pegar do body
      if (!requiredCredits) {
        const field = options.field || 'limit';
        requiredCredits = req.body[field] || req.query[field];
        
        if (!requiredCredits) {
          throw createError('Quantidade de créditos não especificada.', 400);
        }
      }

      const hasEnoughCredits = await CreditService.hasEnoughCredits(userId, requiredCredits);
      
      if (!hasEnoughCredits) {
        const currentCredits = await CreditService.getCredits(userId);
        throw createError(
          `Créditos insuficientes. Disponível: ${currentCredits}, Necessário: ${requiredCredits}`,
          402
        );
      }

      // Adicionar informações de créditos ao request
      req.creditsInfo = {
        required: requiredCredits,
        available: await CreditService.getCredits(userId)
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Extender a interface Request para incluir informações de créditos
declare global {
  namespace Express {
    interface Request {
      creditsInfo?: {
        required: number;
        available: number;
      };
    }
  }
} 