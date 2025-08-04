import { createObjectCsvWriter } from 'csv-writer';
import { LeadData } from '../services/leadGenerationService';
import path from 'path';
import fs from 'fs';

export class CSVExporter {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  /**
   * Garante que o diretório temporário existe
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Exporta um batch de leads para CSV
   */
  async exportBatch(leads: LeadData[], sessionId: string): Promise<string> {
    const timestamp = Date.now();
    const filename = `leads_batch_${sessionId}_${timestamp}.csv`;
    const filepath = path.join(this.tempDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'nome', title: 'Nome' },
        { id: 'telefone', title: 'Telefone' },
        { id: 'email', title: 'Email' },
        { id: 'site', title: 'Site' },
        { id: 'fonte', title: 'Fonte' },
        { id: 'cidade', title: 'Cidade' },
        { id: 'nicho', title: 'Nicho' },
        { id: 'pais', title: 'País' },
        { id: 'score', title: 'Score' },
        { id: 'timestamp', title: 'Data/Hora' }
      ]
    });

    // Preparar dados para CSV
    const csvData = leads.map(lead => ({
      nome: lead.nome,
      telefone: lead.telefone || '',
      email: lead.email || '',
      site: lead.site || '',
      fonte: lead.fonte,
      cidade: lead.cidade,
      nicho: lead.nicho,
      pais: lead.pais,
      score: lead.score,
      timestamp: lead.timestamp.toISOString()
    }));

    await csvWriter.writeRecords(csvData);
    return filepath;
  }

  /**
   * Exporta todos os leads de uma sessão para CSV
   */
  async exportSession(sessionId: string, allLeads: LeadData[]): Promise<string> {
    const timestamp = Date.now();
    const filename = `leads_complete_${sessionId}_${timestamp}.csv`;
    const filepath = path.join(this.tempDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'nome', title: 'Nome' },
        { id: 'telefone', title: 'Telefone' },
        { id: 'email', title: 'Email' },
        { id: 'site', title: 'Site' },
        { id: 'fonte', title: 'Fonte' },
        { id: 'cidade', title: 'Cidade' },
        { id: 'nicho', title: 'Nicho' },
        { id: 'pais', title: 'País' },
        { id: 'score', title: 'Score' },
        { id: 'timestamp', title: 'Data/Hora' }
      ]
    });

    // Preparar dados para CSV
    const csvData = allLeads.map(lead => ({
      nome: lead.nome,
      telefone: lead.telefone || '',
      email: lead.email || '',
      site: lead.site || '',
      fonte: lead.fonte,
      cidade: lead.cidade,
      nicho: lead.nicho,
      pais: lead.pais,
      score: lead.score,
      timestamp: lead.timestamp.toISOString()
    }));

    await csvWriter.writeRecords(csvData);
    return filepath;
  }

  /**
   * Exporta leads filtrados do banco de dados
   */
  async exportFilteredLeads(filters: any, userId: string): Promise<string> {
    const timestamp = Date.now();
    const filename = `leads_filtered_${userId}_${timestamp}.csv`;
    const filepath = path.join(this.tempDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'nome', title: 'Nome' },
        { id: 'telefone', title: 'Telefone' },
        { id: 'email', title: 'Email' },
        { id: 'site', title: 'Site' },
        { id: 'fonte', title: 'Fonte' },
        { id: 'cidade', title: 'Cidade' },
        { id: 'estado', title: 'Estado' },
        { id: 'nicho', title: 'Nicho' },
        { id: 'score', title: 'Score' },
        { id: 'dataInsercao', title: 'Data de Inserção' }
      ]
    });

    // Importar modelo Lead aqui para evitar dependência circular
    const { Lead } = await import('../models/Lead');

    // Buscar leads do banco
    const leads = await Lead.find(filters)
      .sort({ score: -1, dataInsercao: -1 })
      .select('nome email telefone cidade estado nicho score dataInsercao');

    // Preparar dados para CSV
    const csvData = leads.map(lead => ({
      nome: lead.nome,
      telefone: lead.telefone || '',
      email: lead.email,
      site: '', // Não temos site no modelo atual
      fonte: lead.origem || 'database',
      cidade: lead.cidade,
      estado: lead.estado,
      nicho: lead.nicho,
      score: lead.score,
      dataInsercao: lead.dataInsercao.toISOString()
    }));

    await csvWriter.writeRecords(csvData);
    return filepath;
  }

  /**
   * Limpa arquivos CSV antigos (mais de 24 horas)
   */
  async cleanupOldFiles(): Promise<void> {
    const files = fs.readdirSync(this.tempDir);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

    for (const file of files) {
      if (file.endsWith('.csv')) {
        const filepath = path.join(this.tempDir, file);
        const stats = fs.statSync(filepath);
        
        if (now - stats.mtime.getTime() > oneDay) {
          fs.unlinkSync(filepath);
        }
      }
    }
  }

  /**
   * Obtém estatísticas do arquivo CSV
   */
  async getFileStats(filepath: string): Promise<{ size: number; lineCount: number }> {
    if (!fs.existsSync(filepath)) {
      throw new Error('Arquivo não encontrado');
    }

    const stats = fs.statSync(filepath);
    const content = fs.readFileSync(filepath, 'utf-8');
    const lineCount = content.split('\n').length - 1; // -1 para excluir header

    return {
      size: stats.size,
      lineCount: lineCount
    };
  }

  /**
   * Verifica se um arquivo existe
   */
  fileExists(filepath: string): boolean {
    return fs.existsSync(filepath);
  }

  /**
   * Remove um arquivo
   */
  removeFile(filepath: string): void {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
} 