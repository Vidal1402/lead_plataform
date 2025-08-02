import mongoose from 'mongoose';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

const nichos = [
  'estetica',
  'petshop',
  'advocacia',
  'medicina',
  'educacao',
  'tecnologia',
  'financas',
  'imoveis',
  'automoveis',
  'beleza',
  'fitness',
  'gastronomia',
  'moda',
  'turismo',
  'outros'
];

const cidades = [
  'São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Salvador',
  'Fortaleza', 'Curitiba', 'Manaus', 'Recife', 'Porto Alegre',
  'Belém', 'Goiânia', 'Guarulhos', 'Campinas', 'São Luís'
];

const estados = [
  'SP', 'RJ', 'MG', 'DF', 'BA', 'CE', 'PR', 'AM', 'PE', 'RS',
  'PA', 'GO', 'SC', 'ES', 'PB', 'RN', 'MT', 'MS', 'RO', 'TO'
];

const nomes = [
  'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Ferreira',
  'Lucia Pereira', 'Roberto Almeida', 'Fernanda Lima', 'Marcos Souza', 'Patricia Rodrigues',
  'Ricardo Gomes', 'Carla Martins', 'Andre Santos', 'Juliana Oliveira', 'Felipe Costa',
  'Camila Silva', 'Diego Pereira', 'Vanessa Almeida', 'Thiago Lima', 'Amanda Souza'
];

const dominios = [
  'gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'uol.com.br',
  'bol.com.br', 'ig.com.br', 'terra.com.br', 'globo.com', 'live.com'
];

const gerarTelefone = (): string => {
  const ddd = Math.floor(Math.random() * 90) + 10;
  const numero = Math.floor(Math.random() * 90000000) + 10000000;
  return `+55${ddd}${numero}`;
};

const gerarEmail = (nome: string): string => {
  // Remove acentos e caracteres especiais
  const nomeLimpo = nome.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]/g, '');
  const dominio = dominios[Math.floor(Math.random() * dominios.length)];
  const numero = Math.floor(Math.random() * 1000);
  return `${nomeLimpo}${numero}@${dominio}`;
};

const gerarLead = () => {
  const nome = nomes[Math.floor(Math.random() * nomes.length)];
  const cidade = cidades[Math.floor(Math.random() * cidades.length)];
  const estado = estados[Math.floor(Math.random() * estados.length)];
  const nicho = nichos[Math.floor(Math.random() * nichos.length)];
  const idade = Math.floor(Math.random() * 50) + 18;
  const temTelefone = Math.random() > 0.3;

  return {
    nome,
    email: gerarEmail(nome!),
    telefone: temTelefone ? gerarTelefone() : undefined,
    idade,
    cidade,
    estado,
    pais: 'Brasil',
    nicho,
    origem: 'seed_data',
    dataInsercao: new Date(),
    isActive: true,
    score: Math.floor(Math.random() * 40) + 60 // Score entre 60-100
  };
};

const seedLeads = async (quantidade: number = 1000) => {
  try {
    console.log('🌱 Iniciando seed de leads...');

    // Limpar leads existentes
    await Lead.deleteMany({ origem: 'seed_data' });
    console.log('🗑️ Leads antigos removidos');

    // Gerar leads
    const leads = [];
    for (let i = 0; i < quantidade; i++) {
      leads.push(gerarLead());
    }

    // Inserir em lotes de 100
    const lotes = [];
    for (let i = 0; i < leads.length; i += 100) {
      lotes.push(leads.slice(i, i + 100));
    }

    for (const lote of lotes) {
      await Lead.insertMany(lote);
    }

    console.log(`✅ ${quantidade} leads criados com sucesso!`);
  } catch (error) {
    console.error('❌ Erro ao criar leads:', error);
  }
};

const seedUsers = async () => {
  try {
    console.log('🌱 Iniciando seed de usuários...');

    // Limpar usuários de teste
    await User.deleteMany({ email: { $regex: /test@/ } });
    console.log('🗑️ Usuários de teste removidos');

    // Criar usuário de teste
    const testUser = await User.create({
      name: 'Usuário Teste',
      email: 'test@leadforge.com',
      password: '123456',
      credits: 1000
    });

    console.log(`✅ Usuário de teste criado: ${testUser.email}`);
    console.log(`🔑 Senha: 123456`);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
  }
};

const main = async () => {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env['MONGODB_URI']!);
    console.log('✅ Conectado ao MongoDB');

    // Seed de usuários
    await seedUsers();

    // Seed de leads
    await seedLeads(1000);

    console.log('🎉 Seed concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  main();
} 