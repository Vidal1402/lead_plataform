import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { createError } from './errorHandler';

// Extendendo a interface Request para incluir o usuário
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const protect = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Verificar se o token está no header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Verificar se o token existe
    if (!token) {
      throw createError('Acesso negado. Token não fornecido.', 401);
    }

    // Verificar se o token é válido
    const decoded = jwt.verify(token, process.env['JWT_SECRET']!) as any;

    // Buscar o usuário no banco
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      throw createError('Usuário não encontrado.', 401);
    }

    if (!user.isActive) {
      throw createError('Conta desativada.', 401);
    }

    // Adicionar o usuário à requisição
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(createError('Token inválido.', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(createError('Token expirado.', 401));
    } else {
      next(error);
    }
  }
};

// Middleware para verificar se o usuário tem créditos suficientes
export const checkCredits = (requiredCredits: number = 1) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Usuário não autenticado.', 401));
      return;
    }

    if (req.user.credits < requiredCredits) {
      next(createError(`Créditos insuficientes. Necessário: ${requiredCredits}, Disponível: ${req.user.credits}`, 402));
      return;
    }

    next();
  };
};

// Middleware para verificar se o usuário é admin (opcional)
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(createError('Usuário não autenticado.', 401));
    return;
  }

  // Aqui você pode adicionar lógica para verificar se o usuário é admin
  // Por exemplo, adicionar um campo isAdmin no modelo User
  // if (!req.user.isAdmin) {
  //   next(createError('Acesso negado. Apenas administradores.', 403));
  //   return;
  // }

  next();
};

// Middleware para verificar se o usuário tem permissão para acessar um recurso
export const checkOwnership = (resourceUserIdField: string = 'userId') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Usuário não autenticado.', 401));
      return;
    }

    const resourceUserId = (req.params as any)[resourceUserIdField] || (req.body as any)[resourceUserIdField];

    if (resourceUserId && resourceUserId !== (req.user._id as any).toString()) {
      next(createError('Acesso negado. Você não tem permissão para acessar este recurso.', 403));
      return;
    }

    next();
  };
}; 