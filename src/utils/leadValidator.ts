import { LeadData } from '../services/leadGenerationService';

export class LeadValidator {
  private existingLeads: Set<string> = new Set();

  isValid(lead: Partial<LeadData>): boolean {
    // Verificar se tem nome
    if (!lead.nome || lead.nome.trim().length === 0) {
      return false;
    }

    // Verificar se tem pelo menos telefone ou email
    const hasPhone = lead.telefone && this.isValidPhone(lead.telefone);
    const hasEmail = lead.email && this.isValidEmail(lead.email);

    if (!hasPhone && !hasEmail) {
      return false;
    }

    // Verificar se não é duplicado
    if (this.isDuplicate(lead)) {
      return false;
    }

    return true;
  }

  private isValidPhone(phone: string): boolean {
    // Remover espaços, parênteses, hífens e pontos
    const cleanPhone = phone.replace(/[\s\(\)\-\.]/g, '');
    
    // Verificar se tem pelo menos 10 dígitos
    if (cleanPhone.length < 10) {
      return false;
    }

    // Verificar se contém apenas números
    if (!/^\d+$/.test(cleanPhone)) {
      return false;
    }

    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  private isValidWebsite(website: string): boolean {
    try {
      const url = new URL(website);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  calculateScore(lead: Partial<LeadData>): number {
    let score = 0;

    // Score base por ter nome
    if (lead.nome) {
      score += 20;
    }

    // Score por telefone válido
    if (lead.telefone && this.isValidPhone(lead.telefone)) {
      score += 30;
    }

    // Score por email válido
    if (lead.email && this.isValidEmail(lead.email)) {
      score += 30;
    }

    // Score por website válido
    if (lead.site && this.isValidWebsite(lead.site)) {
      score += 10;
    }

    // Score por cidade
    if (lead.cidade && lead.cidade.trim().length > 0) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  normalizeLead(lead: Partial<LeadData>): Partial<LeadData> {
    const normalized: Partial<LeadData> = {};
    
    if (lead.nome) {
      normalized.nome = lead.nome.trim();
    }
    
    if (lead.telefone) {
      normalized.telefone = lead.telefone.trim();
    }
    
    if (lead.email) {
      normalized.email = lead.email.trim();
    }
    
    if (lead.site) {
      normalized.site = lead.site.trim();
    }
    
    if (lead.cidade) {
      normalized.cidade = lead.cidade.trim();
    }
    
    if (lead.fonte) {
      normalized.fonte = lead.fonte;
    }
    
    if (lead.timestamp) {
      normalized.timestamp = lead.timestamp;
    }
    
    if (lead.nicho) {
      normalized.nicho = lead.nicho;
    }
    
    if (lead.pais) {
      normalized.pais = lead.pais;
    }
    
    if (lead.score !== undefined) {
      normalized.score = lead.score;
    }
    
    return normalized;
  }

  isDuplicate(lead: Partial<LeadData>): boolean {
    if (!lead.nome) return false;

    const normalizedName = lead.nome.toLowerCase().trim();
    
    // Verificar se já existe um lead com nome similar
    for (const existingName of this.existingLeads) {
      if (this.calculateSimilarity(normalizedName, existingName) > 0.8) {
        return true;
      }
    }

    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Inicializar matriz
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [];
      for (let j = 0; j <= str1.length; j++) {
        if (i === 0) {
          matrix[i]![j] = j;
        } else if (j === 0) {
          matrix[i]![j] = i;
        } else {
          matrix[i]![j] = 0;
        }
      }
    }

    // Calcular distância
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2[i - 1] === str1[j - 1]) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  addExistingLead(lead: LeadData): void {
    if (lead.nome) {
      this.existingLeads.add(lead.nome.toLowerCase().trim());
    }
  }

  clearExistingLeads(): void {
    this.existingLeads.clear();
  }
} 