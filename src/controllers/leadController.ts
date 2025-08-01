import { Request, Response, NextFunction } from 'express';
import { Lead, ILead } from '../models/Lead';
import { User, IUser } from '../models/User';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { createObjectCsvWriter } from 'csv-writer';
import { Readable } from 'stream';

interface LeadFilters {
  nicho?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  idadeMin?: number;
  idadeMax?: number;
  includePhone?: boolean;
  includeEmail?: boolean;
  includeWebsite?: boolean;
  limit?: number;
}

// @desc    Gerar leads baseado em filtros
// @route   POST /api/leads/generate
// @access  Private
export const generateLeads = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const filters: LeadFilters = req.body;
  const user = req.user as IUser;

  // Validar filtros obrigatórios
  if (!filters.nicho) {
    throw createError('Nicho é obrigatório.', 400);
  }

  // Construir query de busca
  const query: any = {
    isActive: true,
    nicho: filters.nicho
  };

  if (filters.cidade) {
    query.cidade = { $regex: filters.cidade, $options: 'i' };
  }

  if (filters.estado) {
    query.estado = { $regex: filters.estado, $options: 'i' };
  }

  if (filters.pais) {
    query.pais = { $regex: filters.pais, $options: 'i' };
  }

  if (filters.idadeMin || filters.idadeMax) {
    query.idade = {};
    if (filters.idadeMin) query.idade.$gte = filters.idadeMin;
    if (filters.idadeMax) query.idade.$lte = filters.idadeMax;
  }

  // Contar total de leads disponíveis
  const totalLeads = await Lead.countDocuments(query);

  if (totalLeads === 0) {
    throw createError('Nenhum lead encontrado com os filtros especificados.', 404);
  }

  // Verificar se o usuário tem créditos suficientes
  const requestedLeads = filters.limit || Math.min(totalLeads, 1000);
  
  if (user.credits < requestedLeads) {
    throw createError(`Créditos insuficientes. Necessário: ${requestedLeads}, Disponível: ${user.credits}`, 402);
  }

  // Buscar leads
  const leads = await Lead.find(query)
    .sort({ score: -1, dataInsercao: -1 })
    .limit(requestedLeads)
    .select('nome email telefone idade cidade estado pais nicho score');

  if (leads.length === 0) {
    throw createError('Nenhum lead encontrado com os filtros especificados.', 404);
  }

  // Usar créditos do usuário
  user.useCredits(leads.length);

  // Adicionar ao histórico de busca
  user.addSearchHistory({
    filters,
    date: new Date(),
    totalLeads: leads.length,
    creditsUsed: leads.length
  });

  await user.save();

  // Preparar dados para CSV
  const csvData = leads.map(lead => ({
    Nome: lead.nome,
    Email: filters.includeEmail !== false ? lead.email : '',
    Telefone: filters.includePhone ? (lead.telefone || '') : '',
    Idade: lead.idade,
    Cidade: lead.cidade,
    Estado: lead.estado,
    País: lead.pais,
    Nicho: lead.nicho,
    Score: lead.score
  }));

  // Gerar CSV
  const csvWriter = createObjectCsvWriter({
    path: `temp/leads_${user._id}_${Date.now()}.csv`,
    header: Object.keys(csvData[0]).map(key => ({ id: key, title: key }))
  });

  await csvWriter.writeRecords(csvData);

  res.json({
    success: true,
    data: {
      leads: leads.slice(0, 5), // Preview dos primeiros 5
      totalLeads: leads.length,
      creditsUsed: leads.length,
      remainingCredits: user.credits,
      csvUrl: `/api/leads/download/${user._id}_${Date.now()}.csv`
    }
  });
});

// @desc    Download CSV
// @route   GET /api/leads/download/:filename
// @access  Private
export const downloadCsv = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { filename } = req.params;
  const filePath = `temp/${filename}`;

  // Verificar se o arquivo existe
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    throw createError('Arquivo não encontrado.', 404);
  }

  // Configurar headers para download
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="leads_${Date.now()}.csv"`);

  // Enviar arquivo
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);

  // Deletar arquivo após download
  fileStream.on('end', () => {
    fs.unlinkSync(filePath);
  });
});

// @desc    Obter histórico de buscas
// @route   GET /api/leads/history
// @access  Private
export const getSearchHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.user!._id).select('searchHistory');

  if (!user) {
    throw createError('Usuário não encontrado.', 404);
  }

  res.json({
    success: true,
    data: {
      history: user.searchHistory || [],
      totalSearches: user.searchHistory?.length || 0
    }
  });
});

// @desc    Obter estatísticas de leads
// @route   GET /api/leads/stats
// @access  Private
export const getLeadStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const stats = await Lead.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: null,
        totalLeads: { $sum: 1 },
        avgAge: { $avg: '$idade' },
        avgScore: { $avg: '$score' }
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
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    success: true,
    data: {
      totalLeads: stats[0]?.totalLeads || 0,
      avgAge: Math.round(stats[0]?.avgAge || 0),
      avgScore: Math.round(stats[0]?.avgScore || 0),
      topNichos: nichoStats
    }
  });
});

// @desc    Buscar leads por filtros (sem usar créditos)
// @route   GET /api/leads/search
// @access  Private
export const searchLeads = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { nicho, cidade, estado, pais, idadeMin, idadeMax, limit = 10 } = req.query;

  const query: any = { isActive: true };

  if (nicho) query.nicho = nicho;
  if (cidade) query.cidade = { $regex: cidade as string, $options: 'i' };
  if (estado) query.estado = { $regex: estado as string, $options: 'i' };
  if (pais) query.pais = { $regex: pais as string, $options: 'i' };

  if (idadeMin || idadeMax) {
    query.idade = {};
    if (idadeMin) query.idade.$gte = parseInt(idadeMin as string);
    if (idadeMax) query.idade.$lte = parseInt(idadeMax as string);
  }

  const leads = await Lead.find(query)
    .sort({ score: -1 })
    .limit(parseInt(limit as string))
    .select('nome email telefone idade cidade estado pais nicho score');

  res.json({
    success: true,
    data: {
      leads,
      total: leads.length
    }
  });
}); 