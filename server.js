// server.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

/* -----------------------
INIT RESEND
----------------------- */
const resend = new Resend(process.env.RESEND_API_KEY);

/* -----------------------
DATABASE
----------------------- */
const db = new sqlite3.Database("./database.db");
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  token TEXT,
  paid INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

/* -----------------------
CONFIRM PAYMENT
----------------------- */
app.post("/confirm-payment", async (req, res) => {
  const { email, transaction_id } = req.body;

  if (!email || !transaction_id) {
    return res.status(400).json({ error: "Données manquantes" });
  }

  try {
    // Vérifier le paiement sur FedaPay
    const response = await axios.get(
      `https://api.fedapay.com/v1/transactions/${transaction_id}`,
      { headers: { Authorization: `Bearer ${process.env.FEDAPAY_SECRET}` } }
    );

    // ✅ Correction ici : transaction est directement dans response.data.transaction
    const transaction = response.data.transaction;

    if (!transaction || transaction.status !== "approved") {
      return res.status(400).json({ error: "Paiement non validé" });
    }

    // Créer token unique
    const token = crypto.randomBytes(32).toString("hex");

    // Enregistrer l'utilisateur
    db.run(
      `INSERT OR REPLACE INTO users (email, token, paid) VALUES (?, ?, 1)`,
      [email, token],
      async function (err) {
        if (err) {
          console.log(err);
          return res.sendStatus(500);
        }

        const accessLink = `https://anim-formation.onrender.com/formation/${token}`;

        // Envoyer email avec Resend
        try {
          await resend.emails.send({
            from: "Anim-Formation <onboarding@resend.dev>",
            to: email,
            subject: "Votre accès à Anim-Formation 🎉",
            html: `
              <h2>Paiement confirmé 🎉</h2>
              <p>Merci pour votre achat.</p>
              <p>Accédez à votre formation ici :</p>
              <a href="${accessLink}">Accéder à la formation</a>
              <p>Ce lien est personnel et valable 90 jours.</p>
            `,
          });
          console.log("EMAIL ENVOYÉ");
        } catch (mailError) {
          console.log("Erreur email :", mailError);
        }

        // Renvoie succès pour redirection front
        res.json({ success: true });
      }
    );
  } catch (error) {
    console.log("ERREUR FEDA :", error.response?.data || error);
    res.status(500).json({ error: "Erreur vérification paiement" });
  }
});

/* -----------------------
ACCES SECURISE FORMATION
----------------------- */
app.get("/formation/:token", (req, res) => {
  const token = req.params.token;

  db.get(
    "SELECT * FROM users WHERE token=? AND paid=1",
    [token],
    (err, row) => {
      if (!row) return res.send("Accès refusé");

      const created = new Date(row.created_at);
      const now = new Date();
      const diffDays = (now - created) / (1000 * 60 * 60 * 24);
      if (diffDays > 90) return res.send("Votre accès a expiré");

      res.sendFile(__dirname + "/public/formation-privee.html");
    }
  );
});

/* -----------------------
SERVEUR
----------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Serveur lancé sur port " + PORT));