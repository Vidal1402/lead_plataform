import puppeteer, { Browser, Page } from 'puppeteer';
import { LeadData } from '../services/leadGenerationService';

export class TelegramScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async scrape(request: any): Promise<LeadData[]> {
    const leads: LeadData[] = [];
    
    try {
      await this.initializeBrowser();
      await this.searchTelegramChannels(request);
      
      const channels = await this.extractChannelLinks(request.quantidade);
      
      for (const channel of channels) {
        const leadData = await this.extractChannelData(channel);
        if (leadData && leadData.nome) {
          leads.push({
            nome: leadData.nome,
            telefone: leadData.telefone || undefined,
            email: leadData.email || undefined,
            site: leadData.site || undefined,
            fonte: 'telegram',
            timestamp: new Date(),
            nicho: request.nicho,
            pais: request.pais,
            cidade: leadData.cidade || request.cidade,
            score: this.calculateScore(leadData)
          });
        }
      }
      
    } catch (error) {
      console.error('Erro no Telegram Scraper:', error);
    } finally {
      await this.cleanup();
    }
    
    return leads;
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    this.page = await this.browser.newPage();
    
    // Configurar user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    
    // Configurar viewport
    await this.page.setViewport({ width: 1920, height: 1080 });
  }

  private async searchTelegramChannels(request: any): Promise<void> {
    if (!this.page) throw new Error('Página não inicializada');
    
    // Usar Google para buscar canais do Telegram
    const searchQuery = `site:t.me ${request.nicho} ${request.cidade}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    
    // Aguardar resultados
    await this.page.waitForSelector('#search', { timeout: 10000 });
  }

  private async extractChannelLinks(limit: number): Promise<string[]> {
    if (!this.page) return [];
    
    return await this.page.evaluate((maxResults) => {
      const links: string[] = [];
      const elements = document.querySelectorAll('a[href*="t.me"]');
      
      for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
        const element = elements[i];
        if (element) {
          const href = element.getAttribute('href');
          if (href && href.includes('t.me')) {
            // Limpar URL do Google
            const cleanUrl = href.replace(/^https?:\/\/www\.google\.com\/url\?q=/, '');
            const telegramUrl = decodeURIComponent(cleanUrl.split('&')[0] || '');
            
            if (telegramUrl.includes('t.me') && !telegramUrl.includes('google.com')) {
              links.push(telegramUrl);
            }
          }
        }
      }
      
      return [...new Set(links)]; // Remover duplicatas
    }, limit);
  }

  private async extractChannelData(channelUrl: string): Promise<Partial<LeadData> | null> {
    if (!this.page) return null;
    
    try {
      await this.page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Aguardar carregamento do canal
      await this.page.waitForTimeout(3000);
      
      const channelData = await this.page.evaluate(() => {
        // Extrair nome do canal
        const nameElement = document.querySelector('h1, .tgme_channel_info_header_title');
        const name = nameElement ? nameElement.textContent?.trim() : '';
        
        // Extrair descrição do canal
        const descElement = document.querySelector('.tgme_channel_info_description, .tgme_page_description');
        const description = descElement ? descElement.textContent?.trim() : '';
        
        // Extrair link na descrição
        const linkElement = document.querySelector('a[href*="http"]');
        const website = linkElement ? linkElement.getAttribute('href') : '';
        
        return {
          nome: name,
          site: website,
          descricao: description
        };
      });
      
      // Extrair informações de contato da descrição
      const contactInfo = this.extractContactFromDescription(channelData.descricao);
      
      // Extrair email do site se disponível
      let email = contactInfo.email;
      if (!email && channelData.site) {
        email = await this.extractEmailFromWebsite(channelData.site);
      }
      
      return {
        nome: channelData.nome,
        telefone: contactInfo.phone || undefined,
        email: email || undefined,
        site: channelData.site || undefined,
        cidade: this.extractCityFromDescription(channelData.descricao)
      };
      
    } catch (error) {
      console.error('Erro ao extrair dados do canal:', error);
      return null;
    }
  }

  private extractContactFromDescription(description: string): { phone: string; email: string } {
    const phoneRegex = /(\+?[1-9]\d{1,14}|\(\d{2,}\)\s*\d{4,5}-?\d{4})/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    const phones = description.match(phoneRegex) || [];
    const emails = description.match(emailRegex) || [];
    
    return {
      phone: phones[0] || '',
      email: emails[0] || ''
    };
  }

  private async extractEmailFromWebsite(website: string): Promise<string> {
    if (!this.page || !this.browser) return '';
    
    try {
      const page = await this.browser.newPage();
      await page.goto(website, { waitUntil: 'networkidle2', timeout: 10000 });
      
      const email = await page.evaluate(() => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const pageText = document.body.innerText;
        const emails = pageText.match(emailRegex);
        return emails ? emails[0] : '';
      });
      
      await page.close();
      return email;
      
    } catch (error) {
      console.error('Erro ao extrair email do site:', error);
      return '';
    }
  }

  private extractCityFromDescription(description: string): string {
    if (!description) return '';
    
    // Padrões comuns de cidades brasileiras
    const cityPatterns = [
      /(?:em|de|para)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*-\s*[A-Z]{2}/g
    ];
    
    for (const pattern of cityPatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return '';
  }

  private calculateScore(leadData: Partial<LeadData>): number {
    let score = 40; // Score base menor para Telegram
    
    if (leadData.telefone) score += 25;
    if (leadData.email) score += 25;
    if (leadData.site) score += 10;
    
    return Math.min(score, 100);
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
} 