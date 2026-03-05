// server-test.js – version test pour vérifier v1_url
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

// Route test paiement
app.post("/test-payment", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email requis" });

  try {
    const response = await axios.post(
      "https://api.fedapay.com/v1/transactions",
      {
        transaction: {
          description: "Test Anim-Formation",
          amount: 1000, // petit montant test en FCFA
          currency: { iso: "XOF" },
          metadata: { email },
          callback_url: "https://anim-formation.onrender.com/confirmation.html"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FEDAPAY_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Réponse FedaPay :", response.data);

    // Renvoie toute la réponse pour debug
    res.json(response.data);

  } catch (err) {
    console.error("Erreur création paiement FedaPay :", err.response?.data || err);
    res.status(500).json({ error: "Erreur paiement" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Serveur test lancé sur port " + PORT));