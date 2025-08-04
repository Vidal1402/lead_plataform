import puppeteer, { Browser, Page } from 'puppeteer';
import { LeadData } from '../services/leadGenerationService';

export interface ScrapeRequest {
  nicho: string;
  cidade: string;
  pais: string;
  quantidade: number;
}

export class GoogleMapsScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async scrape(request: ScrapeRequest): Promise<LeadData[]> {
    const leads: LeadData[] = [];
    
    try {
      await this.initializeBrowser();
      await this.navigateToGoogleMaps(request);
      
      const searchResults = await this.extractSearchResults(request.quantidade);
      
      for (const result of searchResults) {
        const leadData = await this.extractLeadData(result);
        if (leadData && leadData.nome) {
          leads.push({
            nome: leadData.nome,
            telefone: leadData.telefone || undefined,
            email: leadData.email || undefined,
            site: leadData.site || undefined,
            fonte: 'google_maps',
            timestamp: new Date(),
            nicho: request.nicho,
            pais: request.pais,
            cidade: leadData.cidade || request.cidade,
            score: this.calculateScore(leadData)
          });
        }
      }
      
    } catch (error) {
      console.error('Erro no Google Maps Scraper:', error);
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

  private async navigateToGoogleMaps(request: ScrapeRequest): Promise<void> {
    if (!this.page) throw new Error('Página não inicializada');
    
    const searchQuery = `${request.nicho} ${request.cidade} ${request.pais}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    
    // Aguardar carregamento dos resultados
    await this.page.waitForSelector('[data-result-index]', { timeout: 10000 });
    
    // Scroll para carregar mais resultados
    await this.scrollToLoadMore(request.quantidade);
  }

  private async scrollToLoadMore(targetCount: number): Promise<void> {
    if (!this.page) return;
    
    let currentCount = 0;
    let previousCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;
    
    while (currentCount < targetCount && scrollAttempts < maxScrollAttempts) {
      // Contar resultados atuais
      currentCount = await this.page.evaluate(() => {
        return document.querySelectorAll('[data-result-index]').length;
      });
      
      if (currentCount === previousCount) {
        scrollAttempts++;
      } else {
        scrollAttempts = 0;
      }
      
      previousCount = currentCount;
      
      // Scroll para baixo
      await this.page.evaluate(() => {
        const scrollContainer = document.querySelector('[role="feed"]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      });
      
      // Aguardar carregamento
      await this.page.waitForTimeout(2000);
    }
  }

  private async extractSearchResults(limit: number): Promise<any[]> {
    if (!this.page) return [];
    
    return await this.page.evaluate((maxResults) => {
      const results = [];
      const elements = document.querySelectorAll('[data-result-index]');
      
      for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
        const element = elements[i];
        if (element) {
          const resultIndex = element.getAttribute('data-result-index');
          
          if (resultIndex) {
            results.push({
              element: element,
              index: parseInt(resultIndex)
            });
          }
        }
      }
      
      return results;
    }, limit);
  }

  private async extractLeadData(result: any): Promise<Partial<LeadData> | null> {
    if (!this.page) return null;
    
    try {
      // Clicar no resultado para abrir detalhes
      await this.page.evaluate((element) => {
        element.click();
      }, result.element);
      
      // Aguardar carregamento dos detalhes
      await this.page.waitForTimeout(2000);
      
      // Extrair dados
      const leadData = await this.page.evaluate(() => {
        const nameElement = document.querySelector('h1');
        const name = nameElement ? nameElement.textContent?.trim() : '';
        
        const phoneElement = document.querySelector('[data-item-id*="phone"]');
        const phone = phoneElement ? phoneElement.textContent?.trim() : '';
        
        const websiteElement = document.querySelector('[data-item-id*="website"] a');
        const website = websiteElement ? websiteElement.getAttribute('href') : '';
        
        const addressElement = document.querySelector('[data-item-id*="address"]');
        const address = addressElement ? addressElement.textContent?.trim() : '';
        
        return {
          nome: name,
          telefone: phone,
          site: website,
          endereco: address
        };
      });
      
      // Extrair email do site se disponível
      let email = '';
      if (leadData.site) {
        email = await this.extractEmailFromWebsite(leadData.site);
      }
      
      return {
        nome: leadData.nome,
        telefone: leadData.telefone || undefined,
        email: email || undefined,
        site: leadData.site || undefined,
        cidade: this.extractCityFromAddress(leadData.endereco)
      };
      
    } catch (error) {
      console.error('Erro ao extrair dados do lead:', error);
      return null;
    }
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

  private extractCityFromAddress(address: string): string {
    if (!address) return '';
    
    // Extrair cidade do endereço (assumindo formato padrão)
    const cityMatch = address.match(/([^,]+),\s*([A-Z]{2})/);
    return cityMatch && cityMatch[1] ? cityMatch[1].trim() : '';
  }

  private calculateScore(leadData: Partial<LeadData>): number {
    let score = 60; // Score base
    
    if (leadData.telefone) score += 15;
    if (leadData.email) score += 15;
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