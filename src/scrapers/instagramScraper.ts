import puppeteer, { Browser, Page } from 'puppeteer';
import { LeadData } from '../services/leadGenerationService';

export class InstagramScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async scrape(request: any): Promise<LeadData[]> {
    const leads: LeadData[] = [];
    
    try {
      await this.initializeBrowser();
      await this.searchInstagramProfiles(request);
      
      const profiles = await this.extractProfileLinks(request.quantidade);
      
      for (const profile of profiles) {
        const leadData = await this.extractProfileData(profile);
        if (leadData && leadData.nome) {
          leads.push({
            nome: leadData.nome,
            telefone: leadData.telefone || undefined,
            email: leadData.email || undefined,
            site: leadData.site || undefined,
            fonte: 'instagram',
            timestamp: new Date(),
            nicho: request.nicho,
            pais: request.pais,
            cidade: leadData.cidade || request.cidade,
            score: this.calculateScore(leadData)
          });
        }
      }
      
    } catch (error) {
      console.error('Erro no Instagram Scraper:', error);
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

  private async searchInstagramProfiles(request: any): Promise<void> {
    if (!this.page) throw new Error('Página não inicializada');
    
    // Usar Google para buscar perfis do Instagram
    const searchQuery = `site:instagram.com ${request.nicho} ${request.cidade}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    await this.page.goto(url, { waitUntil: 'networkidle2' });
    
    // Aguardar resultados
    await this.page.waitForSelector('#search', { timeout: 10000 });
  }

  private async extractProfileLinks(limit: number): Promise<string[]> {
    if (!this.page) return [];
    
    return await this.page.evaluate((maxResults) => {
      const links: string[] = [];
      const elements = document.querySelectorAll('a[href*="instagram.com"]');
      
      for (let i = 0; i < Math.min(elements.length, maxResults); i++) {
        const element = elements[i];
        if (element) {
          const href = element.getAttribute('href');
          if (href && href.includes('instagram.com')) {
            // Limpar URL do Google
            const cleanUrl = href.replace(/^https?:\/\/www\.google\.com\/url\?q=/, '');
            const instagramUrl = decodeURIComponent(cleanUrl.split('&')[0] || '');
            
            if (instagramUrl.includes('instagram.com') && !instagramUrl.includes('google.com')) {
              links.push(instagramUrl);
            }
          }
        }
      }
      
      return [...new Set(links)]; // Remover duplicatas
    }, limit);
  }

  private async extractProfileData(profileUrl: string): Promise<Partial<LeadData> | null> {
    if (!this.page) return null;
    
    try {
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      
      // Aguardar carregamento do perfil
      await this.page.waitForTimeout(3000);
      
      const profileData = await this.page.evaluate(() => {
        // Extrair nome do perfil
        const nameElement = document.querySelector('h1, h2, [data-testid="user-bio"]');
        const name = nameElement ? nameElement.textContent?.trim() : '';
        
        // Extrair bio
        const bioElement = document.querySelector('[data-testid="user-bio"], ._aa_c');
        const bio = bioElement ? bioElement.textContent?.trim() : '';
        
        // Extrair link na bio
        const linkElement = document.querySelector('a[href*="http"]');
        const website = linkElement ? linkElement.getAttribute('href') : '';
        
        return {
          nome: name,
          bio: bio,
          site: website
        };
      });
      
      // Extrair informações de contato da bio
      const contactInfo = this.extractContactFromBio(profileData.bio);
      
      // Extrair email do site se disponível
      let email = contactInfo.email;
      if (!email && profileData.site) {
        email = await this.extractEmailFromWebsite(profileData.site);
      }
      
      return {
        nome: profileData.nome,
        telefone: contactInfo.phone || undefined,
        email: email || undefined,
        site: profileData.site || undefined,
        cidade: this.extractCityFromBio(profileData.bio)
      };
      
    } catch (error) {
      console.error('Erro ao extrair dados do perfil:', error);
      return null;
    }
  }

  private extractContactFromBio(bio: string): { phone: string; email: string } {
    const phoneRegex = /(\+?[1-9]\d{1,14}|\(\d{2,}\)\s*\d{4,5}-?\d{4})/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    const phones = bio.match(phoneRegex) || [];
    const emails = bio.match(emailRegex) || [];
    
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

  private extractCityFromBio(bio: string): string {
    if (!bio) return '';
    
    // Padrões comuns de cidades brasileiras
    const cityPatterns = [
      /(?:em|de|para)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*-\s*[A-Z]{2}/g
    ];
    
    for (const pattern of cityPatterns) {
      const match = bio.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    
    return '';
  }

  private calculateScore(leadData: Partial<LeadData>): number {
    let score = 50; // Score base menor para Instagram
    
    if (leadData.telefone) score += 20;
    if (leadData.email) score += 20;
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