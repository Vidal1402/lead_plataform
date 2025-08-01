import express, { Request, Response } from 'express';
import { User } from '../models/User';

const router = express.Router();

// Buscar perfil do usuário
router.get('/me', async (_req: Request, res: Response) => {
  try {
    // Por enquanto, vamos retornar um usuário de exemplo
    // Em uma implementação real, você extrairia o userId do token JWT
    const user = await User.findOne({ email: 'test@leadforge.com' });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          credits: user.credits,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar perfil'
    });
  }
});

export default router; 