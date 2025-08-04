import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { leadGenerationService } from '../services/leadGenerationService';
import { CreditService } from '../services/creditService';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { IUser } from '../models/User';

// @desc    Iniciar geração de leads em tempo real
// @route   POST /api/leads/generate-realtime
// @access  Private
export const generateLeadsRealtime = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError(errors.array()[0]?.msg || 'Erro de validação', 400);
  }

  const { nicho, cidade, pais, quantidade } = req.body;
  const user = req.user as IUser;

  // Validar quantidade
  if (quantidade < 1 || quantidade > 1000) {
    throw createError('Quantidade deve ser entre 1 e 1000', 400);
  }

  // Verificar se o usuário tem créditos suficientes
  if (user.credits < quantidade) {
    throw createError(`Créditos insuficientes. Necessário: ${quantidade}, Disponível: ${user.credits}`, 402);
  }

  // Verificar se já há uma geração em andamento
  if (leadGenerationService.isGenerationRunning()) {
    throw createError('Já há uma geração de leads em andamento', 409);
  }

  try {
    // Iniciar geração de leads
    const sessionId = await leadGenerationService.generateLeads({
      nicho,
      cidade,
      pais,
      quantidade,
      userId: (user._id as any).toString()
    });

    // Debitar créditos antecipadamente
    await CreditService.debitCredits((user._id as any).toString(), quantidade);

    res.status(202).json({
      success: true,
      data: {
        sessionId,
        message: 'Geração de leads iniciada',
        progressUrl: `/api/leads/progress/${sessionId}`,
        websocketUrl: `/ws/leads/${sessionId}`
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    throw createError(`Erro ao iniciar geração: ${errorMessage}`, 500);
  }
});

// @desc    Obter progresso da geração
// @route   GET /api/leads/progress/:sessionId
// @access  Private
export const getGenerationProgress = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const progress = leadGenerationService.getProgress();

  res.json({
    success: true,
    data: {
      sessionId,
      progress
    }
  });
});

// @desc    Parar geração de leads
// @route   POST /api/leads/stop/:sessionId
// @access  Private
export const stopGeneration = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  await leadGenerationService.stopGeneration();

  res.json({
    success: true,
    data: {
      sessionId,
      message: 'Geração de leads interrompida'
    }
  });
});

// @desc    Download CSV de batch
// @route   GET /api/leads/download-batch/:sessionId/:batchNumber
// @access  Private
export const downloadBatchCsv = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, batchNumber } = req.params;

  // Construir caminho do arquivo
  const tempDir = require('path').join(process.cwd(), 'temp');
  const fs = require('fs');

  // Encontrar arquivo do batch
  const files = fs.readdirSync(tempDir);
  const batchFile = files.find((file: string) => 
    file.startsWith(`leads_batch_${sessionId}_`) && 
    file.endsWith('.csv')
  );

  if (!batchFile) {
    throw createError('Arquivo do batch não encontrado', 404);
  }

  const filepath = require('path').join(tempDir, batchFile);

  // Configurar headers para download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads_batch_${batchNumber}.csv"`);

  // Enviar arquivo
  const fileStream = fs.createReadStream(filepath);
  fileStream.pipe(res);

  // Deletar arquivo após download
  fileStream.on('end', () => {
    fs.unlinkSync(filepath);
  });
});

// @desc    Download CSV completo da sessão
// @route   GET /api/leads/download-session/:sessionId
// @access  Private
export const downloadSessionCsv = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const user = req.user as IUser;

  if (!sessionId) {
    throw createError('SessionId é obrigatório', 400);
  }

  // Importar CSVExporter
  const { CSVExporter } = await import('../utils/csvExporter');
  const csvExporter = new CSVExporter();

  // Buscar todos os leads da sessão
  const { Lead } = await import('../models/Lead');
  const leads = await Lead.find({ 
    origem: `generation_${(user._id as any)}`,
    dataInsercao: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24h
  }).sort({ dataInsercao: -1 });

  if (leads.length === 0) {
    throw createError('Nenhum lead encontrado para esta sessão', 404);
  }

  // Converter para formato LeadData
  const leadData = leads.map(lead => ({
    nome: lead.nome,
    telefone: lead.telefone,
    email: lead.email,
    site: '',
    fonte: lead.origem,
    cidade: lead.cidade,
    nicho: lead.nicho,
    pais: lead.pais,
    score: lead.score,
    timestamp: lead.dataInsercao
  }));

  // Gerar CSV
  const csvPath = await csvExporter.exportSession(sessionId, leadData);

  // Configurar headers para download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads_session_${sessionId}.csv"`);

  // Enviar arquivo
  const fileStream = require('fs').createReadStream(csvPath);
  fileStream.pipe(res);

  // Deletar arquivo após download
  fileStream.on('end', () => {
    require('fs').unlinkSync(csvPath);
  });
});

// @desc    Obter estatísticas da geração
// @route   GET /api/leads/generation-stats/:sessionId
// @access  Private
export const getGenerationStats = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const user = req.user as IUser;

  // Buscar leads da sessão
  const { Lead } = await import('../models/Lead');
  const leads = await Lead.find({ 
    origem: `generation_${(user._id as any)}`,
    dataInsercao: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  // Calcular estatísticas
  const stats = {
    totalLeads: leads.length,
    leadsWithPhone: leads.filter(lead => lead.telefone).length,
    leadsWithEmail: leads.filter(lead => lead.email).length,
    averageScore: leads.length > 0 ? leads.reduce((sum, lead) => sum + (lead.score || 0), 0) / leads.length : 0,
    sources: leads.reduce((acc, lead) => {
      acc[lead.origem] = (acc[lead.origem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  res.json({
    success: true,
    data: {
      sessionId,
      stats
    }
  });
});

// Middleware de validação para geração de leads
export const validateLeadGeneration = [
  body('nicho')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Nicho deve ter entre 2 e 100 caracteres'),
  
  body('cidade')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Cidade deve ter entre 2 e 100 caracteres'),
  
  body('pais')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('País deve ter entre 2 e 50 caracteres'),
  
  body('quantidade')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantidade deve ser um número entre 1 e 1000')
]; 