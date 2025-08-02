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

## 2. Checkout com Stripe

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

## 3. Geração de Leads

### Gerar Leads (usa créditos)
```http
POST /api/leads/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "nicho": "estetica",
  "cidade": "São Paulo",
  "estado": "SP",
  "pais": "Brasil",
  "idadeMin": 25,
  "idadeMax": 45,
  "includePhone": true,
  "includeEmail": true,
  "limit": 100
}
```

**Filtros disponíveis:**
- `nicho` (obrigatório): estetica, petshop, advocacia, medicina, educacao, tecnologia, financas, imoveis, automoveis, beleza, fitness, gastronomia, moda, turismo, outros
- `cidade`: nome da cidade
- `estado`: sigla do estado
- `pais`: nome do país
- `idadeMin`: idade mínima
- `idadeMax`: idade máxima
- `includePhone`: incluir telefone no CSV
- `includeEmail`: incluir email no CSV
- `limit`: quantidade de leads (usa créditos)

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "nome": "João Silva",
        "email": "joaosilva123@gmail.com",
        "telefone": "+5511999999999",
        "idade": 30,
        "cidade": "São Paulo",
        "estado": "SP",
        "pais": "Brasil",
        "nicho": "estetica",
        "score": 85
      }
    ],
    "totalLeads": 100,
    "creditsUsed": 100,
    "remainingCredits": 900,
    "csvUrl": "/api/leads/download/user_123_1234567890.csv"
  }
}
```

### Download CSV
```http
GET /api/leads/download/:filename
Authorization: Bearer <token>
```

### Buscar Leads (sem usar créditos)
```http
GET /api/leads/search?nicho=estetica&cidade=São Paulo&limit=10
Authorization: Bearer <token>
```

### Histórico de Buscas
```http
GET /api/leads/history
Authorization: Bearer <token>
```

### Estatísticas de Leads
```http
GET /api/leads/stats
Authorization: Bearer <token>
```

## 4. Serviços de Créditos

### CreditService
```typescript
// Adicionar créditos
await CreditService.addCredits(userId, amount);

// Debitar créditos
await CreditService.debitCredits(userId, amount);

// Verificar se tem créditos suficientes
await CreditService.hasEnoughCredits(userId, amount);

// Obter saldo
await CreditService.getCredits(userId);
```

## 5. Middleware de Verificação de Créditos

### requireCredits
```typescript
// Verificar créditos antes de gerar leads
router.post('/generate', requireAuth, requireCredits(), generateLeads);

// Verificar créditos específicos
router.post('/generate', requireAuth, requireCredits({ amount: 100 }), generateLeads);

// Verificar créditos de campo específico
router.post('/generate', requireAuth, requireCredits({ field: 'limit' }), generateLeads);
```

## Configuração do Ambiente

### Variáveis de Ambiente (.env)
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# MongoDB
MONGODB_URI=mongodb+srv://...

# JWT
JWT_SECRET=sua_chave_jwt_super_secreta_aqui

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Fluxo de Pagamento

1. **Cliente solicita checkout:**
   ```http
   POST /api/payments/checkout
   ```

2. **Stripe retorna URL de checkout**

3. **Cliente redirecionado para Stripe**

4. **Após pagamento, Stripe envia webhook:**
   ```http
   POST /api/payments/webhook
   ```

5. **Sistema adiciona créditos automaticamente**

6. **Cliente pode gerar leads:**
   ```http
   POST /api/leads/generate
   ```

## Usuário de Teste

**Email:** `test@leadforge.com`  
**Senha:** `123456`  
**Créditos:** 1000

## Endpoints Resumidos

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| POST | `/api/payments/checkout` | Criar checkout | ✅ |
| POST | `/api/payments/webhook` | Webhook Stripe | ❌ |
| GET | `/api/payments/packages` | Listar pacotes | ❌ |
| GET | `/api/payments/history` | Histórico pagamentos | ✅ |
| POST | `/api/leads/generate` | Gerar leads | ✅ |
| GET | `/api/leads/download/:filename` | Download CSV | ✅ |
| GET | `/api/leads/search` | Buscar leads | ✅ |
| GET | `/api/leads/history` | Histórico buscas | ✅ |
| GET | `/api/leads/stats` | Estatísticas | ✅ |
| GET | `/api/users/credits` | Verificar créditos | ✅ | 