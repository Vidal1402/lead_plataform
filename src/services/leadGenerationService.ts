import { EventEmitter } from 'events';
import { Lead } from '../models/Lead';
import { GoogleMapsScraper } from '../scrapers/googleMapsScraper';
import { InstagramScraper } from '../scrapers/instagramScraper';
import { TelegramScraper } from '../scrapers/telegramScraper';
import { WebsiteScraper } from '../scrapers/websiteScraper';
import { LeadValidator } from '../utils/leadValidator';
import { CSVExporter } from '../utils/csvExporter';
import path from 'path';
import fs from 'fs';

export interface LeadGenerationRequest {
  nicho: string;
  cidade: string;
  pais: string;
  quantidade: number;
  userId: string;
}

export interface LeadData {
  nome: string;
  telefone?: string | undefined;
  email?: string | undefined;
  site?: string | undefined;
  fonte: string;
  cidade: string;
  timestamp: Date;
  nicho: string;
  pais: string;
  score: number;
}

export interface GenerationProgress {
  sessionId: string;
  totalRequested: number;
  totalGenerated: number;
  totalValid: number;
  progress: number;
  currentSource: string;
  status: 'running' | 'completed' | 'error';
  error?: string;
}

export class LeadGenerationService extends EventEmitter {
  private scrapers: Map<string, any> = new Map();
  private validator: LeadValidator;
  private csvExporter: CSVExporter;
  private progress!: GenerationProgress;
  private isRunning: boolean = false;
  private batchSize: number = 30;

  constructor() {
    super();
    this.validator = new LeadValidator();
    this.csvExporter = new CSVExporter();
    this.initializeScrapers();
  }

  private initializeScrapers(): void {
    this.scrapers.set('google_maps', new GoogleMapsScraper());
    this.scrapers.set('instagram', new InstagramScraper());
    this.scrapers.set('telegram', new TelegramScraper());
    this.scrapers.set('website', new WebsiteScraper());
  }

  async generateLeads(request: LeadGenerationRequest): Promise<string> {
    if (this.isRunning) {
      throw new Error('Geração de leads já está em andamento');
    }

    this.isRunning = true;
    const sessionId = `session_${Date.now()}_${request.userId}`;
    
    // Inicializar progresso
    this.progress = {
      sessionId,
      totalRequested: request.quantidade,
      totalGenerated: 0,
      totalValid: 0,
      progress: 0,
      currentSource: 'Iniciando...',
      status: 'running'
    };

    // Criar diretório temporário para CSV
    const tempDir = path.join(process.cwd(), 'temp', sessionId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      // Iniciar geração em background
      this.startGeneration(request, sessionId);
      
      return sessionId;
    } catch (error) {
      this.isRunning = false;
      this.progress.status = 'error';
      this.progress.error = error instanceof Error ? error.message : 'Erro desconhecido';
      throw error;
    }
  }

  private async startGeneration(request: LeadGenerationRequest, sessionId: string): Promise<void> {
    const validLeads: LeadData[] = [];
    const sources = ['google_maps', 'instagram', 'telegram', 'website'];
    let currentSourceIndex = 0;

    try {
      while (validLeads.length < request.quantidade && currentSourceIndex < sources.length) {
        const source = sources[currentSourceIndex];
        if (source) {
          this.progress.currentSource = source;
          this.emit('progress', this.progress);

          const scraper = this.scrapers.get(source);
          if (!scraper) {
            currentSourceIndex++;
            continue;
          }

          // Gerar leads da fonte atual
          const sourceLeads = await this.generateFromSource(
            scraper, 
            request, 
            request.quantidade - validLeads.length
          );

          // Validar leads
          for (const lead of sourceLeads) {
            this.progress.totalGenerated++;
            
            if (this.validator.isValid(lead)) {
              validLeads.push(lead);
              this.progress.totalValid++;
              
              // Salvar no banco
              await this.saveLead(lead, request.userId);
              
              // Enviar batch a cada 30 leads válidos
              if (validLeads.length % this.batchSize === 0) {
                await this.sendBatch(validLeads.slice(-this.batchSize), sessionId);
              }
            }

            // Atualizar progresso
            this.progress.progress = Math.round((validLeads.length / request.quantidade) * 100);
            this.emit('progress', this.progress);
          }
        }

        currentSourceIndex++;
      }

      // Finalizar geração
      this.progress.status = 'completed';
      this.progress.progress = 100;
      this.emit('progress', this.progress);
      this.emit('completed', { sessionId, totalLeads: validLeads.length });

    } catch (error) {
      this.progress.status = 'error';
      this.progress.error = error instanceof Error ? error.message : 'Erro desconhecido';
      this.emit('progress', this.progress);
      this.emit('error', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async generateFromSource(scraper: any, request: LeadGenerationRequest, remaining: number): Promise<LeadData[]> {
    try {
      return await scraper.scrape({
        nicho: request.nicho,
        cidade: request.cidade,
        pais: request.pais,
        quantidade: remaining
      });
    } catch (error) {
      console.error(`Erro no scraper ${scraper.constructor.name}:`, error);
      return [];
    }
  }

  private async saveLead(leadData: LeadData, userId: string): Promise<void> {
    try {
      await Lead.create({
        ...leadData,
        origem: `generation_${userId}`,
        dataInsercao: new Date(),
        isActive: true
      });
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
    }
  }

  private async sendBatch(leads: LeadData[], sessionId: string): Promise<void> {
    try {
      // Salvar CSV do batch
      const csvPath = await this.csvExporter.exportBatch(leads, sessionId);
      
      // Emitir evento com dados do batch
      this.emit('batch', {
        sessionId,
        leads,
        csvPath,
        batchNumber: Math.floor(leads.length / this.batchSize)
      });
    } catch (error) {
      console.error('Erro ao enviar batch:', error);
    }
  }

  getProgress(): GenerationProgress {
    return this.progress;
  }

  isGenerationRunning(): boolean {
    return this.isRunning;
  }

  async stopGeneration(): Promise<void> {
    this.isRunning = false;
    this.progress.status = 'error';
    this.progress.error = 'Geração interrompida pelo usuário';
    this.emit('progress', this.progress);
  }
}

export const leadGenerationService = new LeadGenerationService(); 