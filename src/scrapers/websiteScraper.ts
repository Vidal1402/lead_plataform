import puppeteer, { Browser, Page } from 'puppeteer';
import { LeadData } from '../services/leadGenerationService';

export class WebsiteScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async scrape(request: any): Promise<LeadData[]> {
    const leads: LeadData[] = [];
    
    try {
      await this.initializeBrowser();
      const websites = await this.findBusinessWebsites(request);
      
      for (const website of websites) {
        const leadData = await this.extractWebsiteData(website);
        if (leadData && leadData.nome) {
          leads.push({
            nome: leadData.nome,
            telefone: leadData.telefone || undefined,
            email: leadData.email || undefined,
            site: leadData.site || undefined,
            fonte: 'website',
            timestamp: new Date(),
            nicho: request.nicho,
            pais: request.pais,
            cidade: leadData.cidade || request.cidade,
            score: this.calculateScore(leadData)
          });
        }
      }
      
    } catch (error) {
      console.error('Erro no Website Scraper:', error);
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

  private async findBusinessWebsites(request: any): Promise<string[]> {
    if (!this.page) return [];
    
    const websites: string[] = [];
    
    try {
      // Buscar no Google por sites de negócios
      const searchQuery = `${request.nicho} ${request.cidade} site`;
      const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      
      await this.page.goto(url, { waitUntil: 'networkidle2' });
      await this.page.waitForSelector('#search', { timeout: 10000 });
      
      // Extrair links de sites
      const siteLinks = await this.page.evaluate((maxResults) => {
        const links: string[] = [];
        const elements = document.querySelectorAll('a[href^="http"]');
        
        for (let i = 0; i < Math.min(elements.length, maxResults * 2); i++) {
          const element = elements[i];
          if (element) {
            const href = element.getAttribute('href');
            if (href && !href.includes('google.com') && !href.includes('youtube.com')) {
              // Limpar URL do Google
              const cleanUrl = href.replace(/^https?:\/\/www\.google\.com\/url\?q=/, '');
              const websiteUrl = decodeURIComponent(cleanUrl.split('&')[0] || '');
              
              if (websiteUrl.startsWith('http') && !websiteUrl.includes('google.com')) {
                links.push(websiteUrl);
              }
            }
          }
        }
        
        return [...new Set(links)]; // Remover duplicatas
      }, request.quantidade);
      
      websites.push(...siteLinks);
      
    } catch (error) {
      console.error('Erro ao buscar sites:', error);
    }
    
    return websites.slice(0, request.quantidade);
  }

  private async extractWebsiteData(websiteUrl: string): Promise<Partial<LeadData> | null> {
    if (!this.page) return null;
    
    try {
      await this.page.goto(websiteUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Aguardar carregamento da página
      await this.page.waitForTimeout(2000);
      
      const websiteData = await this.page.evaluate(() => {
        // Extrair título da página
        const title = document.title || '';
        
        // Extrair nome do negócio (título ou h1)
        const h1Element = document.querySelector('h1');
        const businessName = h1Element ? h1Element.textContent?.trim() : title;
        
        // Extrair todo o texto da página
        const pageText = document.body.innerText;
        
        // Extrair emails
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = pageText.match(emailRegex) || [];
        
        // Extrair telefones
        const phoneRegex = /(\+?[1-9]\d{1,14}|\(\d{2,}\)\s*\d{4,5}-?\d{4}|\d{2,}\s*\d{4,5}-?\d{4})/g;
        const phones = pageText.match(phoneRegex) || [];
        
        // Extrair endereços
        const addressRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*\d+[^,]*,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*-\s*[A-Z]{2}/g;
        const addresses = pageText.match(addressRegex) || [];
        
        // Extrair cidade do endereço
        let city = '';
        if (addresses.length > 0 && addresses[0]) {
          const cityMatch = addresses[0].match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*-\s*[A-Z]{2}/);
          if (cityMatch && cityMatch[1]) {
            city = cityMatch[1];
          }
        }
        
        return {
          nome: businessName,
          telefone: phones[0] || '',
          email: emails[0] || '',
          site: window.location.href,
          cidade: city
        };
      });
      
      return {
        nome: websiteData.nome,
        telefone: websiteData.telefone || undefined,
        email: websiteData.email || undefined,
        site: websiteData.site || undefined,
        cidade: websiteData.cidade
      };
      
    } catch (error) {
      console.error('Erro ao extrair dados do site:', error);
      return null;
    }
  }

  private calculateScore(leadData: Partial<LeadData>): number {
    let score = 70; // Score base alto para websites
    
    if (leadData.telefone) score += 15;
    if (leadData.email) score += 15;
    
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