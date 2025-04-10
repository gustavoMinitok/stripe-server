require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Stripe = require('stripe');
const Parse = require('parse/node');
const cors = require('cors');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// ⚠️ ESSENCIAL: rota do webhook precisa do body bruto
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;

    if (!email) {
      console.error("❌ Email não encontrado na sessão");
      return res.status(400).send("Email não encontrado");
    }

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
        console.log("❌ Usuário com email não encontrado:", email);
      }
    } catch (err) {
      console.error("❌ Erro ao atualizar o usuário:", err);
    }
  }

  res.status(200).send();
});

// Agora sim, para as demais rotas:
app.use(cors({ origin: 'https://gemuplay.io' }));
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
    success_url: 'https://gemuplay.io',
    cancel_url: 'https://gemuplay.io',
    metadata: {
      email: req.body.email, // usado se quiser também passar por metadata
    },
    customer_email: req.body.email, // usado para mostrar no checkout e salvar
  });

  res.json({ url: session.url });
});

app.listen(4242, () => console.log('🚀 Servidor rodando na porta 4242'));
