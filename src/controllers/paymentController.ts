import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import { User, IUser } from '../models/User';
import { createError, asyncHandler } from '../middleware/errorHandler';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

// Preços dos pacotes (em centavos)
const PACKAGE_PRICES = {
  '100': 9900,    // R$ 99,00
  '1000': 89000,  // R$ 890,00
  '5000': 399000  // R$ 3.990,00
};

// @desc    Criar payment intent
// @route   POST /api/payments/create-intent
// @access  Private
export const createPaymentIntent = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { amount, package: packageType } = req.body;
  const user = req.user as IUser;

  // Verificar se o pacote é válido
  if (!PACKAGE_PRICES[packageType as keyof typeof PACKAGE_PRICES]) {
    throw createError('Pacote inválido.', 400);
  }

  const price = PACKAGE_PRICES[packageType as keyof typeof PACKAGE_PRICES];

  try {
    // Criar ou obter customer no Stripe
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user._id.toString()
        }
      });

      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Criar payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price,
      currency: 'brl',
      customer: customerId,
      metadata: {
        userId: user._id.toString(),
        credits: amount,
        package: packageType
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: price,
        credits: amount
      }
    });
  } catch (error) {
    console.error('Erro ao criar payment intent:', error);
    throw createError('Erro ao processar pagamento.', 500);
  }
});

// @desc    Confirmar pagamento
// @route   POST /api/payments/confirm
// @access  Private
export const confirmPayment = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { paymentIntentId, amount } = req.body;
  const user = req.user as IUser;

  try {
    // Verificar payment intent no Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw createError('Pagamento não foi confirmado.', 400);
    }

    // Verificar se o payment intent pertence ao usuário
    if (paymentIntent.metadata.userId !== user._id.toString()) {
      throw createError('Payment intent não pertence ao usuário.', 403);
    }

    // Adicionar créditos ao usuário
    user.addCredits(amount);
    await user.save();

    res.json({
      success: true,
      data: {
        message: 'Pagamento confirmado com sucesso!',
        creditsAdded: amount,
        totalCredits: user.credits
      }
    });
  } catch (error) {
    console.error('Erro ao confirmar pagamento:', error);
    throw createError('Erro ao confirmar pagamento.', 500);
  }
});

// @desc    Obter histórico de pagamentos
// @route   GET /api/payments/history
// @access  Private
export const getPaymentHistory = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;

  if (!user.stripeCustomerId) {
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
      customer: user.stripeCustomerId,
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
        credits: payment.metadata.credits,
        package: payment.metadata.package
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
export const getPackages = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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