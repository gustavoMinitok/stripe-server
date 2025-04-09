require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const Parse = require('parse/node');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const app = express();

// 🔥 ESSENCIAL: rota de webhook ANTES de qualquer bodyParser.json()
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Erro na assinatura do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.metadata?.email;

    console.log("🎯 Webhook recebido para o e-mail:", email);

    if (email) {
      Parse.initialize("tZ6IL6qBYk79B7xQpiwvOVFm1DQLoeNtrN82XrTP", "UP63xGM8dWYhQg02LcPfXSw8ATHgSIaaXkHiwFXW");
      Parse.serverURL = "https://parseapi.back4app.com/";

      const query = new Parse.Query(Parse.User);
      query.equalTo("email", email);

      try {
        const user = await query.first({ useMasterKey: true });
        if (user) {
          user.set("hasPass", true);
          await user.save(null, { useMasterKey: true });
          console.log("✅ Passe ativado com sucesso para:", email);
        } else {
          console.log("❌ Usuário não encontrado:", email);
        }
      } catch (err) {
        console.error("❌ Erro ao atualizar usuário:", err);
      }
    }
  }

  res.status(200).send();
});

// AGORA bodyParser.json() para o restante
app.use(bodyParser.json());

app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: 'GemUpass' },
        unit_amount: 499,
      },
      quantity: 1,
    }],
    success_url: 'http://localhost:5173/',
    cancel_url: 'http://localhost:5173/',
    metadata: {
      email: req.body.email,
    },
  });

  res.json({ url: session.url });
});

app.listen(4242, () => console.log('🚀 Servidor rodando na porta 4242'));
