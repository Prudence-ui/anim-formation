const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const nodemailer = require("nodemailer");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));

/* DATABASE */

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

/* CONFIRM PAYMENT */

app.post("/confirm-payment", async (req,res)=>{

const {email,transaction_id} = req.body;

if(!email || !transaction_id){

return res.status(400).json({
error:"Données manquantes"
});

}

try{

const response = await axios.get(

`https://api.fedapay.com/v1/transactions/${transaction_id}`,

{
headers:{
Authorization:`Bearer ${process.env.FEDAPAY_SECRET}`
}
}

);

/* CORRECTION ICI */

const transaction = response.data.v1.transaction;

if(transaction.status !== "approved"){

return res.status(400).json({
error:"Paiement non validé"
});

}

/* créer token */

const token = crypto.randomBytes(32).toString("hex");

db.run(

`INSERT OR REPLACE INTO users (email,token,paid)
VALUES (?,?,1)`,

[email,token],

async function(err){

if(err){
console.log(err);
return res.sendStatus(500);
}

/* EMAIL */

const transporter = nodemailer.createTransport({

service:"gmail",

auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}

});

const accessLink =
`https://anim-formation.onrender.com/formation/${token}`;

await transporter.sendMail({

from:`Anim-Formation <${process.env.EMAIL_USER}>`,

to:email,

subject:"Votre accès à Anim-Formation 🎉",

html:`

<h2>Paiement confirmé</h2>

<p>Merci pour votre achat.</p>

<p>Accédez à votre formation :</p>

<a href="${accessLink}">
Accéder à la formation
</a>

`

});

console.log("EMAIL ENVOYÉ");

/* SUCCESS */

res.json({
success:true
});

}

);

}catch(error){

console.log("ERREUR FEDA :",error.response?.data || error);

res.status(500).json({
error:"Erreur vérification paiement"
});

}

});

/* ACCES FORMATION */

app.get("/formation/:token",(req,res)=>{

const token=req.params.token;

db.get(

"SELECT * FROM users WHERE token=? AND paid=1",

[token],

(err,row)=>{

if(!row){

return res.send("Accès refusé");

}

res.sendFile(
__dirname+"/public/formation-privee.html"
);

}

);

});

/* SERVER */

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{

console.log("Serveur lancé sur port "+PORT);

});