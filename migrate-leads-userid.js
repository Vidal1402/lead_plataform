require('ts-node/register');
const mongoose = require('mongoose');
require('dotenv').config();

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lead_platform');

// Importar modelos usando require com ts-node
const { Lead } = require('./src/models/Lead');
const { User } = require('./src/models/User');

async function migrateLeadsUserId() {
  try {
    console.log('🔄 Iniciando migração de leads...');

    // Verificar se já existe o campo userId
    const sampleLead = await Lead.findOne();
    if (sampleLead && sampleLead.userId) {
      console.log('✅ Campo userId já existe nos leads. Migração não necessária.');
      return;
    }

    // Buscar o primeiro usuário (ou criar um padrão)
    let defaultUser = await User.findOne();
    
    if (!defaultUser) {
      console.log('⚠️  Nenhum usuário encontrado. Criando usuário padrão...');
      defaultUser = await User.create({
        nome: 'Usuário Padrão',
        email: 'admin@leadplatform.com',
        password: 'senha123',
        credits: 1000,
        isActive: true
      });
      console.log('✅ Usuário padrão criado:', defaultUser.email);
    }

    // Atualizar todos os leads existentes com o userId
    const result = await Lead.updateMany(
      { userId: { $exists: false } },
      { $set: { userId: defaultUser._id } }
    );

    console.log(`✅ Migração concluída!`);
    console.log(`📊 Leads atualizados: ${result.modifiedCount}`);
    console.log(`👤 Usuário associado: ${defaultUser.email}`);

    // Verificar se a migração foi bem-sucedida
    const totalLeads = await Lead.countDocuments();
    const leadsWithUserId = await Lead.countDocuments({ userId: { $exists: true } });
    
    console.log(`📈 Total de leads: ${totalLeads}`);
    console.log(`📈 Leads com userId: ${leadsWithUserId}`);

    if (totalLeads === leadsWithUserId) {
      console.log('✅ Todos os leads agora têm userId!');
    } else {
      console.log('⚠️  Alguns leads ainda não têm userId.');
    }

  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexão com MongoDB fechada.');
  }
}

// Executar migração
migrateLeadsUserId(); 