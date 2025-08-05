require('ts-node/register');
const mongoose = require('mongoose');
require('dotenv').config();

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lead_platform');

// Importar modelos
const { User } = require('./src/models/User');
const bcrypt = require('bcryptjs');

async function checkAndCreateUsers() {
  try {
    console.log('🔍 Verificando usuários existentes...\n');

    // Listar todos os usuários
    const users = await User.find({}).select('nome email isActive credits');
    
    if (users.length === 0) {
      console.log('❌ Nenhum usuário encontrado no sistema');
    } else {
      console.log(`📊 Total de usuários: ${users.length}`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.nome} (${user.email}) - Créditos: ${user.credits} - Ativo: ${user.isActive}`);
      });
    }

    // Criar usuário de teste se não existir
    const testUser = await User.findOne({ email: 'teste@teste.com' });
    
    if (!testUser) {
      console.log('\n🔄 Criando usuário de teste...');
      
      const hashedPassword = await bcrypt.hash('senha123', 10);
      
      const newUser = await User.create({
        nome: 'Usuário Teste',
        email: 'teste@teste.com',
        password: hashedPassword,
        credits: 1000,
        isActive: true
      });
      
      console.log('✅ Usuário de teste criado:', newUser.email);
      console.log('🔑 Senha: senha123');
    } else {
      console.log('\n✅ Usuário de teste já existe:', testUser.email);
    }

    // Verificar se há leads associados a usuários
    const { Lead } = require('./src/models/Lead');
    const totalLeads = await Lead.countDocuments();
    const leadsWithUserId = await Lead.countDocuments({ userId: { $exists: true } });
    
    console.log('\n📈 Estatísticas de Leads:');
    console.log(`   Total de leads: ${totalLeads}`);
    console.log(`   Leads com userId: ${leadsWithUserId}`);
    
    if (totalLeads > 0) {
      const sampleLead = await Lead.findOne().populate('userId', 'email');
      if (sampleLead && sampleLead.userId) {
        console.log(`   Exemplo: Lead associado ao usuário: ${sampleLead.userId.email}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Conexão com MongoDB fechada.');
  }
}

// Executar verificação
checkAndCreateUsers(); 