import express, { Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { Lead } from '../models/Lead';
import { 
  generateLeads, 
  downloadCsv, 
  getSearchHistory, 
  getLeadStats, 
  searchLeads 
} from '../controllers/leadController';
import {
  generateLeadsRealtime,
  getGenerationProgress,
  stopGeneration,
  downloadBatchCsv,
  downloadSessionCsv,
  getGenerationStats,
  validateLeadGeneration
} from '../controllers/leadGenerationController';
import { protect } from '../middleware/auth';
import { requireCredits } from '../middleware/creditCheck';

const router = express.Router();

// Buscar leads com filtros
router.get('/', protect, [
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
    const filters: any = { isActive: true, userId: (req.user as any)._id };

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
router.get('/stats', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)._id;

    const stats = await Lead.aggregate([
      { $match: { isActive: true, userId: userId } },
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
      { $match: { isActive: true, userId: userId } },
      {
        $group: {
          _id: '$nicho',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const estadoStats = await Lead.aggregate([
      { $match: { isActive: true, userId: userId } },
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

// ===== ROTAS DE GERAÇÃO EM TEMPO REAL =====

// @route   POST /api/leads/generate-realtime
// @desc    Iniciar geração de leads em tempo real
// @access  Private
router.post('/generate-realtime', protect, validateLeadGeneration, generateLeadsRealtime);

// @route   GET /api/leads/progress/:sessionId
// @desc    Obter progresso da geração
// @access  Private
router.get('/progress/:sessionId', protect, getGenerationProgress);

// @route   POST /api/leads/stop/:sessionId
// @desc    Parar geração de leads
// @access  Private
router.post('/stop/:sessionId', protect, stopGeneration);

// @route   GET /api/leads/download-batch/:sessionId/:batchNumber
// @desc    Download CSV de batch
// @access  Private
router.get('/download-batch/:sessionId/:batchNumber', protect, downloadBatchCsv);

// @route   GET /api/leads/download-session/:sessionId
// @desc    Download CSV completo da sessão
// @access  Private
router.get('/download-session/:sessionId', protect, downloadSessionCsv);

// @route   GET /api/leads/generation-stats/:sessionId
// @desc    Obter estatísticas da geração
// @access  Private
router.get('/generation-stats/:sessionId', protect, getGenerationStats);

// ===== ROTAS EXISTENTES =====

// @route   POST /api/leads/generate
// @desc    Gerar leads com filtros (usa créditos)
// @access  Private
router.post('/generate', protect, requireCredits(), generateLeads);

// @route   GET /api/leads/download/:filename
// @desc    Download CSV dos leads gerados
// @access  Private
router.get('/download/:filename', protect, downloadCsv);

// @route   GET /api/leads/history
// @desc    Obter histórico de buscas
// @access  Private
router.get('/history', protect, getSearchHistory);

// @route   GET /api/leads/stats
// @desc    Obter estatísticas de leads
// @access  Private
router.get('/stats', protect, getLeadStats);

// @route   GET /api/leads/search
// @desc    Buscar leads por filtros (sem usar créditos)
// @access  Private
router.get('/search', protect, searchLeads);

export default router; 