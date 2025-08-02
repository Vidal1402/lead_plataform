import { User, IUser } from '../models/User';
import { createError } from '../middleware/errorHandler';

export class CreditService {
  /**
   * Adiciona créditos ao usuário
   * @param userId - ID do usuário
   * @param amount - Quantidade de créditos a adicionar
   */
  static async addCredits(userId: string, amount: number): Promise<IUser> {
    if (amount <= 0) {
      throw createError('Quantidade de créditos deve ser maior que zero.', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw createError('Usuário não encontrado.', 404);
    }

    user.credits += amount;
    await user.save();

    return user;
  }

  /**
   * Debita créditos do usuário
   * @param userId - ID do usuário
   * @param amount - Quantidade de créditos a debitar
   */
  static async debitCredits(userId: string, amount: number): Promise<IUser> {
    if (amount <= 0) {
      throw createError('Quantidade de créditos deve ser maior que zero.', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw createError('Usuário não encontrado.', 404);
    }

    if (user.credits < amount) {
      throw createError(`Créditos insuficientes. Disponível: ${user.credits}, Necessário: ${amount}`, 402);
    }

    user.credits -= amount;
    await user.save();

    return user;
  }

  /**
   * Verifica se o usuário tem créditos suficientes
   * @param userId - ID do usuário
   * @param amount - Quantidade de créditos necessários
   */
  static async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }

    return user.credits >= amount;
  }

  /**
   * Obtém o saldo de créditos do usuário
   * @param userId - ID do usuário
   */
  static async getCredits(userId: string): Promise<number> {
    const user = await User.findById(userId);
    if (!user) {
      throw createError('Usuário não encontrado.', 404);
    }

    return user.credits;
  }
} 