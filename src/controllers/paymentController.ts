import { Request, Response } from 'express';
import Stripe from 'stripe';
import { IUser } from '../models/User';
import { createError, asyncHandler } from '../middleware/errorHandler';
import { CreditService } from '../services/creditService';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, {
  apiVersion: '2023-10-16'
});

// Preços dos pacotes (em centavos)
const PACKAGE_PRICES = {
  '100': 9900,    // R$ 99,00
  '1000': 89000,  // R$ 890,00
  '5000': 399000  // R$ 3.990,00
};

// @desc    Criar checkout com Stripe
// @route   POST /api/payments/checkout
// @access  Private
export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  const { package: packageType } = req.body;
  const user = req.user as IUser;

  // Verificar se o pacote é válido
  if (!PACKAGE_PRICES[packageType as keyof typeof PACKAGE_PRICES]) {
    throw createError('Pacote inválido. Pacotes disponíveis: 100, 1000, 5000', 400);
  }

  const credits = parseInt(packageType);
  const price = PACKAGE_PRICES[packageType as keyof typeof PACKAGE_PRICES];

  try {
    // Criar ou obter customer no Stripe
    let customerId = (user as any).stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: (user._id as any).toString()
        }
      });

      customerId = customer.id;
              (user as any).stripeCustomerId = customerId;
      await user.save();
    }

    // Criar checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${credits} Créditos LeadForge`,
              description: `Pacote de ${credits} créditos para geração de leads`,
            },
            unit_amount: price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env['FRONTEND_URL']}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env['FRONTEND_URL']}/payment/cancel`,
      metadata: {
                  userId: (user._id as any).toString(),
        credits: credits.toString(),
        package: packageType
      },
    });

    res.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        amount: price,
        credits: credits
      }
    });
  } catch (error) {
    console.error('Erro ao criar checkout:', error);
    throw createError('Erro ao processar checkout.', 500);
  }
});

// @desc    Webhook para processar pagamentos do Stripe
// @route   POST /api/payments/webhook
// @access  Public
export const webhookPayment = asyncHandler(async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env['STRIPE_WEBHOOK_SECRET'];

  if (!endpointSecret) {
    throw createError('Webhook secret não configurado.', 500);
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err) {
    console.error('Erro ao verificar webhook:', err);
    throw createError('Webhook signature inválida.', 400);
  }

  // Processar apenas eventos de checkout completado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    try {
      const userId = session.metadata?.['userId'];
      const credits = parseInt(session.metadata?.['credits'] || '0');

      if (!userId || credits <= 0) {
        console.error('Dados inválidos no webhook:', session.metadata);
        return res.status(400).json({ error: 'Dados inválidos' });
      }

      // Adicionar créditos ao usuário
      const user = await CreditService.addCredits(userId, credits);

      console.log(`✅ Créditos adicionados: ${credits} para usuário ${userId}`);
      console.log(`💰 Novo saldo: ${user.credits} créditos`);

    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      return res.status(500).json({ error: 'Erro interno' });
    }
  }

  res.json({ received: true });
  return;
});

// @desc    Obter histórico de pagamentos
// @route   GET /api/payments/history
// @access  Private
export const getPaymentHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;

  if (!(user as any).stripeCustomerId) {
    res.json({
      success: true,
      data: {
        payments: [],
        total: 0
      }
    });
    return;
  }

  try {
    // Buscar pagamentos no Stripe
    const payments = await stripe.paymentIntents.list({
      customer: (user as any).stripeCustomerId,
      limit: 50
    });

    const paymentHistory = payments.data
      .filter(payment => payment.status === 'succeeded')
      .map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        created: payment.created,
        credits: payment.metadata['credits'],
        package: payment.metadata['package']
      }));

    res.json({
      success: true,
      data: {
        payments: paymentHistory,
        total: paymentHistory.length
      }
    });
  } catch (error) {
    console.error('Erro ao buscar histórico de pagamentos:', error);
    throw createError('Erro ao buscar histórico de pagamentos.', 500);
  }
});

// @desc    Obter pacotes disponíveis
// @route   GET /api/payments/packages
// @access  Public
export const getPackages = asyncHandler(async (_req: Request, res: Response) => {
  const packages = [
    {
      id: '100',
      name: 'Pacote Básico',
      credits: 100,
      price: 99.00,
      priceId: PACKAGE_PRICES['100'],
      popular: false
    },
    {
      id: '1000',
      name: 'Pacote Profissional',
      credits: 1000,
      price: 890.00,
      priceId: PACKAGE_PRICES['1000'],
      popular: true
    },
    {
      id: '5000',
      name: 'Pacote Empresarial',
      credits: 5000,
      price: 3990.00,
      priceId: PACKAGE_PRICES['5000'],
      popular: false
    }
  ];

  res.json({
    success: true,
    data: packages
  });
}); 