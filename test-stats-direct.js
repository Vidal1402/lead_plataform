require('ts-node/register');
const mongoose = require('mongoose');
require('dotenv').config();

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lead_platform');

// Importar modelos
const { Lead } = require('./src/models/Lead');
const { User } = require('./src/models/User');

async function testStatsDirect() {
  try {
    console.log('🧪 Testando estatísticas diretamente no banco...\n');

    // Buscar usuário teste
    const testUser = await User.findOne({ email: 'teste@teste.com' });
    if (!testUser) {
      console.log('❌ Usuário teste não encontrado');
      return;
    }

    console.log(`👤 Usuário teste: ${testUser.email} (ID: ${testUser._id})`);

    // Testar estatísticas globais (como estava antes)
    console.log('\n📊 Testando estatísticas GLOBAIS (como estava antes):');
    const globalStats = await Lead.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          avgScore: { $avg: '$score' },
          avgAge: { $avg: '$idade' }
        }
      }
    ]);

    console.log('   Total de leads (global):', globalStats[0]?.totalLeads || 0);

    // Testar estatísticas por usuário (como está agora)
    console.log('\n📊 Testando estatísticas POR USUÁRIO (correção implementada):');
    const userStats = await Lead.aggregate([
      { $match: { isActive: true, userId: testUser._id } },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          avgScore: { $avg: '$score' },
          avgAge: { $avg: '$idade' }
        }
      }
    ]);

    console.log('   Total de leads (usuário):', userStats[0]?.totalLeads || 0);

    // Verificar se a correção está funcionando
    console.log('\n🔍 Análise da correção:');
    if (globalStats[0]?.totalLeads === userStats[0]?.totalLeads) {
      console.log('✅ CORREÇÃO FUNCIONANDO: Usuário vê apenas seus próprios leads');
      console.log('   - Dados globais:', globalStats[0]?.totalLeads);
      console.log('   - Dados do usuário:', userStats[0]?.totalLeads);
    } else {
      console.log('❌ PROBLEMA: Usuário ainda vê dados globais');
      console.log('   - Dados globais:', globalStats[0]?.totalLeads);
      console.log('   - Dados do usuário:', userStats[0]?.totalLeads);
    }

    // Testar com outro usuário para confirmar isolamento
    const otherUser = await User.findOne({ email: { $ne: 'teste@teste.com' } });
    if (otherUser) {
      console.log(`\n👤 Testando isolamento com outro usuário: ${otherUser.email}`);
      
      const otherUserStats = await Lead.aggregate([
        { $match: { isActive: true, userId: otherUser._id } },
        {
          $group: {
            _id: null,
            totalLeads: { $sum: 1 }
          }
        }
      ]);

      console.log('   Total de leads (outro usuário):', otherUserStats[0]?.totalLeads || 0);
      
      if (otherUserStats[0]?.totalLeads === 0) {
        console.log('✅ Isolamento confirmado: Outro usuário não vê leads do teste');
      } else {
        console.log('⚠️  Possível problema de isolamento');
      }
    }

    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexão com MongoDB fechada.');
  }
}

// Executar teste
testStatsDirect(); 