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
        message: errors.array()[0]?.msg || 'Erro de validação'
      });
    }

    const { name, email, password } = req.body;

    // Verificar se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email já cadastrado'
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
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro interno do servidor'
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
        message: errors.array()[0]?.msg || 'Erro de validação'
      });
    }

    const { email, password } = req.body;

    // Buscar usuário
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: 'Email ou senha incorretos'
      });
    }

    // Verificar senha
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Email ou senha incorretos'
      });
    }

    // Gerar token
    const token = jwt.sign(
      { userId: user._id },
      process.env['JWT_SECRET']!,
      { expiresIn: '24h' }
    );

    return res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// Verificação de token (endpoint /me)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env['JWT_SECRET']!) as { userId: string };
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      credits: user.credits
    });
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido' });
  }
});

export default router; 