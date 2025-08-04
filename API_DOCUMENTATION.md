# API Documentation - LeadForge Backend

## Autenticação
Todas as rotas privadas requerem o header `Authorization: Bearer <token>`

## 1. Sistema de Créditos

### Verificar Créditos
```http
GET /api/users/credits
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "credits": 1000
  }
}
```

## 2. Geração de Leads em Tempo Real

### Iniciar Geração de Leads
```http
POST /api/leads/generate-realtime
Authorization: Bearer <token>
Content-Type: application/json

{
  "nicho": "estetica",
  "cidade": "São Paulo",
  "pais": "Brasil",
  "quantidade": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_1703123456789_user123",
    "message": "Geração de leads iniciada",
    "progressUrl": "/api/leads/progress/session_1703123456789_user123",
    "websocketUrl": "/ws/leads/session_1703123456789_user123"
  }
}
```

### Obter Progresso da Geração
```http
GET /api/leads/progress/:sessionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_1703123456789_user123",
    "progress": {
      "totalRequested": 100,
      "totalGenerated": 45,
      "totalValid": 30,
      "progress": 30,
      "currentSource": "google_maps",
      "status": "running"
    }
  }
}
```

### Parar Geração
```http
POST /api/leads/stop/:sessionId
Authorization: Bearer <token>
```

### Download CSV de Batch
```http
GET /api/leads/download-batch/:sessionId/:batchNumber
Authorization: Bearer <token>
```

### Download CSV Completo da Sessão
```http
GET /api/leads/download-session/:sessionId
Authorization: Bearer <token>
```

### Estatísticas da Geração
```http
GET /api/leads/generation-stats/:sessionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "session_1703123456789_user123",
    "stats": {
      "totalLeads": 100,
      "bySource": {
        "google_maps": 40,
        "instagram": 25,
        "telegram": 20,
        "website": 15
      },
      "byScore": {
        "high": 30,
        "medium": 45,
        "low": 25
      },
      "withPhone": 85,
      "withEmail": 70,
      "avgScore": 75
    }
  }
}
```

## 3. WebSocket Events

### Conectar ao WebSocket
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'seu_jwt_token_aqui'
  }
});
```

### Eventos Disponíveis

#### Entrar em Sessão de Geração
```javascript
socket.emit('join-generation', 'session_1703123456789_user123');
```

#### Receber Progresso
```javascript
socket.on('generation-progress', (progress) => {
  console.log('Progresso:', progress);
});
```

#### Receber Batch de Leads
```javascript
socket.on('leads-batch', (batchData) => {
  console.log('Novo batch:', batchData);
  // batchData.leads - array com 30 leads
  // batchData.csvUrl - URL para download do CSV
});
```

#### Geração Concluída
```javascript
socket.on('generation-completed', (completionData) => {
  console.log('Geração concluída:', completionData);
});
```

#### Erro na Geração
```javascript
socket.on('generation-error', (error) => {
  console.error('Erro:', error);
});
```

## 4. Fontes de Dados

### Google Maps
- **Dados extraídos:** Nome, telefone, site, email, endereço
- **Score base:** 60-100
- **Validação:** Nome + telefone OU email

### Instagram
- **Dados extraídos:** Nome, bio, telefone, email, site
- **Score base:** 50-100
- **Validação:** Nome + telefone OU email

### Telegram
- **Dados extraídos:** Nome do canal, descrição, telefone, email, site
- **Score base:** 40-100
- **Validação:** Nome + telefone OU email

### Websites
- **Dados extraídos:** Nome do negócio, telefone, email, endereço
- **Score base:** 70-100
- **Validação:** Nome + telefone OU email

## 5. Validação de Leads

### Critérios de Validação
- **Nome:** Obrigatório, mínimo 2 caracteres
- **Telefone:** Formato válido, mínimo 10 dígitos
- **Email:** Formato válido de email
- **Validação:** Lead é válido se tiver nome + (telefone OU email)

### Cálculo de Score
- **Score base:** 60 pontos
- **Telefone:** +20 pontos
- **Email:** +20 pontos
- **Site:** +10 pontos
- **Cidade:** +5 pontos
- **Fonte:** +2-5 pontos (dependendo da confiabilidade)

## 6. Checkout com Stripe

### Criar Checkout
```http
POST /api/payments/checkout
Authorization: Bearer <token>
Content-Type: application/json

{
  "package": "1000"
}
```

**Pacotes disponíveis:**
- `"100"` - 100 créditos (R$ 99,00)
- `"1000"` - 1000 créditos (R$ 890,00)
- `"5000"` - 5000 créditos (R$ 3.990,00)

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/...",
    "sessionId": "cs_...",
    "amount": 89000,
    "credits": 1000
  }
}
```

### Webhook de Pagamento
```http
POST /api/payments/webhook
Content-Type: application/json
Stripe-Signature: <signature>

{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_...",
      "metadata": {
        "userId": "...",
        "credits": "1000"
      }
    }
  }
}
```

### Obter Pacotes Disponíveis
```http
GET /api/payments/packages
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "100",
      "name": "Pacote Básico",
      "credits": 100,
      "price": 99.00,
      "priceId": 9900,
      "popular": false
    },
    {
      "id": "1000",
      "name": "Pacote Profissional",
      "credits": 1000,
      "price": 890.00,
      "priceId": 89000,
      "popular": true
    },
    {
      "id": "5000",
      "name": "Pacote Empresarial",
      "credits": 5000,
      "price": 3990.00,
      "priceId": 399000,
      "popular": false
    }
  ]
}
```

### Histórico de Pagamentos
```http
GET /api/payments/history
Authorization: Bearer <token>
```

## 7. Geração de Leads (Legado)

### Gerar Leads (usa créditos)
```http
POST /api/leads/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "nicho": "estetica",
  "cidade": "São Paulo",
  "estado": "SP",
  "idadeMin": 25,
  "idadeMax": 45,
  "includePhone": true,
  "limit": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [...], // Preview dos primeiros 5
    "totalLeads": 100,
    "creditsUsed": 100,
    "remainingCredits": 900,
    "csvUrl": "/api/leads/download/..."
  }
}
```

### Download CSV
```http
GET /api/leads/download/:filename
Authorization: Bearer <token>
```

### Buscar Leads
```http
GET /api/leads/search?nicho=estetica&cidade=São Paulo&limit=10
Authorization: Bearer <token>
```

### Estatísticas de Leads
```http
GET /api/leads/stats
Authorization: Bearer <token>
```

## 8. Autenticação

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@leadforge.com",
  "password": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Usuário Teste",
      "email": "test@leadforge.com",
      "credits": 1000
    },
    "token": "jwt_token_aqui"
  }
}
```

### Registro
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Novo Usuário",
  "email": "novo@email.com",
  "password": "123456"
}
```

## 9. Health Check

### Status do Servidor
```http
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2023-12-21T10:30:00.000Z",
  "version": "1.0.0",
  "websocket": {
    "totalConnections": 5,
    "activeRooms": 3
  }
}
```

## 10. Códigos de Erro

- `400` - Erro de validação
- `401` - Não autorizado
- `402` - Créditos insuficientes
- `404` - Recurso não encontrado
- `409` - Conflito (geração já em andamento)
- `500` - Erro interno do servidor

## 11. Limites e Restrições

- **Quantidade máxima:** 1000 leads por geração
- **Tamanho do batch:** 30 leads por vez
- **Rate limiting:** 100 requests por 15 minutos
- **Tamanho do arquivo:** 10MB máximo
- **Tempo de sessão:** 24 horas
- **Arquivos CSV:** Auto-deletados após 24 horas 