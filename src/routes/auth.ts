import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User';

const router = express.Router();

// Registro
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0]?.msg || 'Erro de validação'
      });
    }

    const { name, email, password } = req.body;

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email já cadastrado'
      });
    }

    // Criar usuário
    const user = await User.create({
      name,
      email,
      password,
      credits: 100 // Créditos iniciais
    });

    // Gerar token
    const token = jwt.sign(
      { userId: user._id },
      process.env['JWT_SECRET']!,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          credits: user.credits
        },
        token
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao registrar usuário'
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0]?.msg || 'Erro de validação'
      });
    }

    const { email, password } = req.body;

    // Buscar usuário
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha inválidos'
      });
    }

    // Verificar senha
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha inválidos'
      });
    }

    // Gerar token
    const token = jwt.sign(
      { userId: user._id },
      process.env['JWT_SECRET']!,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          credits: user.credits
        },
        token
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao fazer login'
    });
  }
});

export default router; 