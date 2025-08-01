import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { createError, asyncHandler } from '../middleware/errorHandler';

// Gerar JWT Token
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: '30d'
  });
};

// @desc    Registrar usuário
// @route   POST /api/auth/register
// @access  Public
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password } = req.body;

  // Verificar se o usuário já existe
  const userExists = await User.findOne({ email });

  if (userExists) {
    throw createError('Usuário já existe com este email.', 400);
  }

  // Criar usuário
  const user = await User.create({
    name,
    email,
    password
  });

  if (user) {
    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        token: generateToken(user._id)
      }
    });
  } else {
    throw createError('Dados inválidos.', 400);
  }
});

// @desc    Autenticar usuário
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  // Verificar se o usuário existe
  const user = await User.findOne({ email });

  if (!user) {
    throw createError('Credenciais inválidas.', 401);
  }

  // Verificar se a senha está correta
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw createError('Credenciais inválidas.', 401);
  }

  // Verificar se a conta está ativa
  if (!user.isActive) {
    throw createError('Conta desativada.', 401);
  }

  // Atualizar último login
  user.lastLogin = new Date();
  await user.save();

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      token: generateToken(user._id)
    }
  });
});

// @desc    Obter perfil do usuário
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.user!._id).select('-password');

  res.json({
    success: true,
    data: user
  });
});

// @desc    Atualizar perfil do usuário
// @route   PUT /api/auth/me
// @access  Private
export const updateProfile = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email } = req.body;

  const user = await User.findById(req.user!._id);

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  // Verificar se o email já está em uso por outro usuário
  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email });
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
      credits: updatedUser.credits
    }
  });
});

// @desc    Alterar senha
// @route   PUT /api/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user!._id);

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  // Verificar senha atual
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    throw createError('Senha atual incorreta.', 400);
  }

  // Atualizar senha
  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Senha alterada com sucesso.'
  });
});

// @desc    Logout (opcional - token é invalidado no frontend)
// @route   POST /api/auth/logout
// @access  Private
export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  res.json({
    success: true,
    message: 'Logout realizado com sucesso.'
  });
}); 