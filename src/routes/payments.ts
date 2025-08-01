import express, { Request, Response } from 'express';

const router = express.Router();

// Rota placeholder para pagamentos
router.get('/', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'API de pagamentos em desenvolvimento'
  });
});

export default router; 