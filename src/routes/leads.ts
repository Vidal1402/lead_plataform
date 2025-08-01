import express, { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { Lead } from '../models/Lead';

const router = express.Router();

// Buscar leads com filtros
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
  query('nicho').optional().isString().withMessage('Nicho deve ser uma string'),
  query('cidade').optional().isString().withMessage('Cidade deve ser uma string'),
  query('estado').optional().isString().withMessage('Estado deve ser uma string'),
  query('idadeMin').optional().isInt({ min: 18, max: 100 }).withMessage('Idade mínima deve ser entre 18 e 100'),
  query('idadeMax').optional().isInt({ min: 18, max: 100 }).withMessage('Idade máxima deve ser entre 18 e 100'),
  query('scoreMin').optional().isInt({ min: 0, max: 100 }).withMessage('Score mínimo deve ser entre 0 e 100'),
  query('scoreMax').optional().isInt({ min: 0, max: 100 }).withMessage('Score máximo deve ser entre 0 e 100')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: errors.array()[0]?.msg || 'Erro de validação'
      });
    }

    const {
      page = 1,
      limit = 20,
      nicho,
      cidade,
      estado,
      idadeMin,
      idadeMax,
      scoreMin,
      scoreMax
    } = req.query;

    // Construir filtros
    const filters: any = { isActive: true };

    if (nicho) filters.nicho = nicho;
    if (cidade) filters.cidade = new RegExp(cidade as string, 'i');
    if (estado) filters.estado = estado;
    
    if (idadeMin || idadeMax) {
      filters.idade = {};
      if (idadeMin) filters.idade.$gte = parseInt(idadeMin as string);
      if (idadeMax) filters.idade.$lte = parseInt(idadeMax as string);
    }

    if (scoreMin || scoreMax) {
      filters.score = {};
      if (scoreMin) filters.score.$gte = parseInt(scoreMin as string);
      if (scoreMax) filters.score.$lte = parseInt(scoreMax as string);
    }

    // Calcular paginação
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Executar consulta
    const [leads, total] = await Promise.all([
      Lead.find(filters)
        .sort({ score: -1, dataInsercao: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .select('-__v'),
      Lead.countDocuments(filters)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit as string));

    return res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages,
          hasNext: parseInt(page as string) < totalPages,
          hasPrev: parseInt(page as string) > 1
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar leads'
    });
  }
});

// Buscar estatísticas
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await Lead.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          avgScore: { $avg: '$score' },
          avgAge: { $avg: '$idade' }
        }
      }
    ]);

    const nichoStats = await Lead.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$nicho',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const estadoStats = await Lead.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return res.json({
      success: true,
      data: {
        geral: stats[0] || { totalLeads: 0, avgScore: 0, avgAge: 0 },
        porNicho: nichoStats,
        porEstado: estadoStats
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
});

export default router; 