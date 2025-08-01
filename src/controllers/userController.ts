import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { createError, asyncHandler } from '../middleware/errorHandler';

// @desc    Obter créditos do usuário
// @route   GET /api/users/credits
// @access  Private
export const getCredits = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.user!._id).select('credits name email');

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  res.json({
    success: true,
    data: {
      credits: user.credits,
      name: user.name,
      email: user.email
    }
  });
});

// @desc    Atualizar créditos do usuário
// @route   PUT /api/users/credits
// @access  Private
export const updateCredits = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { amount, operation } = req.body;

  if (!amount || !operation) {
    throw createError('Quantidade e operação são obrigatórias.', 400);
  }

  if (!['add', 'subtract'].includes(operation)) {
    throw createError('Operação inválida. Use "add" ou "subtract".', 400);
  }

  const user = await User.findById(req.user!._id);

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  if (operation === 'add') {
    user.addCredits(amount);
  } else {
    if (user.credits < amount) {
      throw createError('Créditos insuficientes.', 400);
    }
    user.useCredits(amount);
  }

  await user.save();

  res.json({
    success: true,
    data: {
      credits: user.credits,
      operation,
      amount
    }
  });
});

// @desc    Obter perfil completo do usuário
// @route   GET /api/users/profile
// @access  Private
export const getProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.user!._id).select('-password');

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  res.json({
    success: true,
    data: user
  });
});

// @desc    Atualizar perfil do usuário
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email } = req.body;

  const user = await User.findById(req.user!._id);

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  // Verificar se o email já está em uso por outro usuário
  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email, _id: { $ne: user._id } });
    if (emailExists) {
      throw createError('Email já está em uso.', 400);
    }
  }

  user.name = name || user.name;
  user.email = email || user.email;

  const updatedUser = await user.save();

  res.json({
    success: true,
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      credits: updatedUser.credits,
      createdAt: updatedUser.createdAt
    }
  });
}); 