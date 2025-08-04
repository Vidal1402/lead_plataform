# 🚀 LeadForge - Sistema de Geração de Leads em Tempo Real

Sistema backend escalável para geração de leads reais baseado em fontes públicas, com comunicação em tempo real via WebSocket.

## ✨ Funcionalidades

- **Geração em Tempo Real:** Leads gerados e enviados progressivamente
- **Múltiplas Fontes:** Google Maps, Instagram, Telegram, Websites
- **Validação Inteligente:** Apenas leads válidos (nome + telefone/email)
- **WebSocket:** Comunicação em tempo real com o frontend
- **Download Progressivo:** CSV disponível a cada 30 leads
- **Sistema de Créditos:** Controle de uso e pagamentos
- **Escalável:** Arquitetura modular e extensível

## 🛠️ Tecnologias

- **Backend:** Node.js + Express + TypeScript
- **Banco de Dados:** MongoDB + Mongoose
- **Web Scraping:** Puppeteer
- **Tempo Real:** Socket.IO
- **Pagamentos:** Stripe
- **Validação:** Express Validator
- **Segurança:** Helmet, CORS, Rate Limiting

## 📦 Instalação

### 1. Clone o repositório
```bash
git clone <repository-url>
cd lead_plataform
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp env.example .env
```

Edite o arquivo `.env`:
```env
# Configurações do Servidor
PORT=5000
NODE_ENV=development

# Banco de Dados
MONGODB_URI=mongodb://localhost:27017/leadforge

# JWT
JWT_SECRET=sua_chave_jwt_super_secreta_aqui_123456789

# Stripe
STRIPE_SECRET_KEY=sk_test_sua_chave_secreta_stripe
STRIPE_PUBLISHABLE_KEY=pk_test_sua_chave_publica_stripe

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Execute o seed de dados
```bash
npm run seed
```

### 5. Inicie o servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

## 🔧 Configuração do MongoDB

### Local
```bash
# Instalar MongoDB
# Windows: https://docs.mongodb.com/manual/installation/
# macOS: brew install mongodb-community
# Linux: sudo apt install mongodb

# Iniciar MongoDB
mongod
```

### Cloud (MongoDB Atlas)
1. Crie uma conta em [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crie um cluster
3. Obtenha a string de conexão
4. Configure no `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/leadforge
```

## 🚀 Como Usar

### 1. Autenticação
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@leadforge.com",
    "password": "123456"
  }'
```

### 2. Gerar Leads em Tempo Real
```bash
# Iniciar geração
curl -X POST http://localhost:5000/api/leads/generate-realtime \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nicho": "estetica",
    "cidade": "São Paulo",
    "pais": "Brasil",
    "quantidade": 100
  }'
```

### 3. WebSocket (Frontend)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'seu_jwt_token_aqui'
  }
});

// Entrar na sessão de geração
socket.emit('join-generation', 'session_123');

// Receber progresso
socket.on('generation-progress', (progress) => {
  console.log('Progresso:', progress.progress + '%');
});

// Receber batch de leads
socket.on('leads-batch', (batchData) => {
  console.log('Novos leads:', batchData.leads);
  // Download CSV: batchData.csvUrl
});

// Geração concluída
socket.on('generation-completed', (data) => {
  console.log('Concluído!', data.totalLeads, 'leads gerados');
});
```

## 📊 Fontes de Dados

### Google Maps
- **Score:** 60-100
- **Dados:** Nome, telefone, site, email, endereço
- **Método:** Scraping direto do Google Maps

### Instagram
- **Score:** 50-100
- **Dados:** Nome, bio, telefone, email, site
- **Método:** Busca via Google + scraping de perfis

### Telegram
- **Score:** 40-100
- **Dados:** Nome do canal, descrição, contatos
- **Método:** Busca via Google + scraping de canais

### Websites
- **Score:** 70-100
- **Dados:** Nome do negócio, telefone, email, endereço
- **Método:** Busca via Google + scraping de sites

## 🔍 Validação de Leads

### Critérios
- ✅ **Nome:** Obrigatório (mínimo 2 caracteres)
- ✅ **Telefone:** Formato válido (mínimo 10 dígitos)
- ✅ **Email:** Formato válido de email
- ✅ **Validação:** Nome + (telefone OU email)

### Score de Qualidade
- **Base:** 60 pontos
- **Telefone:** +20 pontos
- **Email:** +20 pontos
- **Site:** +10 pontos
- **Cidade:** +5 pontos
- **Fonte:** +2-5 pontos

## 💳 Sistema de Créditos

### Pacotes Disponíveis
- **Básico:** 100 créditos - R$ 99,00
- **Profissional:** 1000 créditos - R$ 890,00
- **Empresarial:** 5000 créditos - R$ 3.990,00

### Uso
- 1 lead = 1 crédito
- Créditos são debitados antecipadamente
- Sistema de pagamento via Stripe

## 📁 Estrutura do Projeto

```
src/
├── config/           # Configurações (DB, Sentry)
├── controllers/      # Controllers da API
├── middleware/       # Middlewares (auth, rate limiting)
├── models/          # Modelos do MongoDB
├── routes/          # Rotas da API
├── scrapers/        # Scrapers para cada fonte
├── services/        # Serviços de negócio
├── utils/           # Utilitários (validação, CSV)
└── index.ts         # Arquivo principal
```

## 🔧 Scrapers

### GoogleMapsScraper
- Busca estabelecimentos no Google Maps
- Extrai dados de contato
- Navega por páginas de resultados

### InstagramScraper
- Busca perfis via Google
- Extrai dados da bio
- Visita sites linkados

### TelegramScraper
- Busca canais via Google
- Extrai informações de descrição
- Coleta dados de contato

### WebsiteScraper
- Busca sites de negócios
- Extrai dados da página
- Usa regex para encontrar contatos

## 🚨 Limitações e Considerações

### Rate Limiting
- 100 requests por 15 minutos
- Proteção contra spam

### Escalabilidade
- Scrapers rodam em paralelo
- Sistema de filas para grandes volumes
- Cache de resultados

### Ética e Legalidade
- Respeita robots.txt
- Delays entre requests
- User agents realistas
- Apenas dados públicos

## 🧪 Testes

```bash
# Executar testes
npm test

# Testes com coverage
npm run test:coverage
```

## 📈 Monitoramento

### Health Check
```bash
curl http://localhost:5000/health
```

### Logs
- Morgan para HTTP requests
- Console logs para scraping
- Sentry para erros (opcional)

## 🔒 Segurança

- **Autenticação:** JWT
- **Rate Limiting:** Express Rate Limit
- **CORS:** Configurado para frontend
- **Helmet:** Headers de segurança
- **Validação:** Express Validator
- **Sanitização:** Input/output validation

## 🚀 Deploy

### Docker
```bash
# Build da imagem
docker build -t leadforge-backend .

# Executar container
docker run -p 5000:5000 leadforge-backend
```

### Railway
```bash
# Deploy automático via GitHub
# Configure as variáveis de ambiente no Railway
```

### Vercel/Netlify
- Não recomendado (WebSocket não suportado)
- Use Railway ou Heroku

## 📞 Suporte

### Usuário de Teste
- **Email:** `test@leadforge.com`
- **Senha:** `123456`
- **Créditos:** 1000

### Logs de Debug
```bash
# Ativar logs detalhados
DEBUG=* npm run dev
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🔮 Roadmap

- [ ] Cache Redis para performance
- [ ] Mais fontes de dados (LinkedIn, Facebook)
- [ ] Machine Learning para score de qualidade
- [ ] Dashboard de analytics
- [ ] API pública para terceiros
- [ ] Sistema de notificações
- [ ] Export para outros formatos (Excel, JSON)
- [ ] Integração com CRMs

---

**Desenvolvido com ❤️ pela equipe LeadForge**