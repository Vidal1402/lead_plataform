import axios from 'axios';
import { LeadData } from '../services/leadGenerationService';

export class GoogleMapsScraper {
  async scrape(request: { nicho: string; cidade: string; pais: string; quantidade: number; userId?: string }): Promise<LeadData[]> {
    try {
      const response = await axios.post('http://localhost:8000/api/leads/generate', {
        nicho: request.nicho,
        cidade: request.cidade,
        quantidade: request.quantidade,
        userId: request.userId || 'default' // Passe o userId recebido ou um valor padrão
      });
      return (response.data.leads || []).map((lead: any) => ({
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        site: lead.site,
        fonte: 'google_maps',
        timestamp: new Date(),
        nicho: request.nicho,
        pais: request.pais,
        cidade: lead.cidade,
        score: 60
      }));
    } catch (error) {
      console.error('Erro ao chamar o scraper Python:', error);
      return [];
    }
  }
}