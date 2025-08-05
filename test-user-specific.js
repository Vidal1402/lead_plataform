const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

// Função para fazer login e obter token
async function login(email, password) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data.token;
  } catch (error) {
    console.error(`Erro no login para ${email}:`, error.response?.data || error.message);
    return null;
  }
}

// Função para obter estatísticas
async function getStats(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error.response?.data || error.message);
    return null;
  }
}

// Função para obter histórico
async function getHistory(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/leads/history`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao obter histórico:', error.response?.data || error.message);
    return null;
  }
}

// Teste principal
async function testUserSpecificData() {
  console.log('🧪 Testando dados específicos por usuário...\n');

  // Teste com usuário que existe (baseado na migração)
  console.log('👤 Testando Usuário existente...');
  const token = await login('teste@teste.com', 'senha123');
  if (token) {
    const stats = await getStats(token);
    const history = await getHistory(token);
    
    console.log('📊 Estatísticas:', stats?.data?.geral?.totalLeads || 'Erro');
    console.log('📋 Histórico:', history?.data?.totalSearches || 'Erro');
    
    // Verificar se os dados são específicos do usuário
    if (stats?.data?.geral?.totalLeads === 1000) {
      console.log('⚠️  ATENÇÃO: Ainda retornando dados globais (1000 leads)');
      console.log('❌ A correção pode não estar funcionando corretamente');
    } else {
      console.log('✅ Dados específicos do usuário funcionando corretamente');
    }
  } else {
    console.log('❌ Falha no login');
  }

  console.log('\n✅ Teste concluído!');
  console.log('📝 Resultado esperado:');
  console.log('   - Usuário deve ver apenas seus próprios leads');
  console.log('   - Não deve mais retornar 1000 leads globais');
  console.log('   - Dados devem ser filtrados por userId');
}

// Executar teste
testUserSpecificData().catch(console.error); 