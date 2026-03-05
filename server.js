// server.js FINAL Anim-Formation
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
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ip TEXT
)
`);

/* -----------------------
CREATION PAIEMENT FEDAPAY
----------------------- */

app.post("/create-payment", async (req, res) => {

const { email } = req.body;

if (!email) {
return res.status(400).json({error:"Email requis"});
}

try {

const response = await axios.post(
"https://api.fedapay.com/v1/transactions",
{
transaction:{
description:"Formation Anim-Formation",
amount:10000,
currency:{iso:"XOF"},
metadata:{email:email},
callback_url:"https://anim-formation.onrender.com/confirmation.html"
}
},
{
headers:{
Authorization:`Bearer ${process.env.FEDAPAY_SECRET}`,
"Content-Type":"application/json"
}
}
);

console.log("Réponse FedaPay :",response.data);

/* récupération URL paiement */

let paymentUrl=null;

if(response.data.transaction && response.data.transaction.v1_url){
paymentUrl=response.data.transaction.v1_url;
}

if(response.data.transaction && response.data.transaction.url){
paymentUrl=response.data.transaction.url;
}

if(!paymentUrl){

console.log("Erreur : URL paiement introuvable");

return res.status(500).json({
error:"Erreur FedaPay"
});

}

/* renvoyer url au front */

res.json({
payment_url:paymentUrl
});

}catch(error){

console.log("Erreur FedaPay :");

if(error.response){
console.log(error.response.data);
}else{
console.log(error);
}

res.status(500).json({
error:"Erreur création paiement"
});

}

});


/* -----------------------
WEBHOOK FEDAPAY
----------------------- */

app.post("/webhook", async (req,res)=>{

const event=req.body;

try{

if(event.entity==="transaction" && event.status==="approved"){

const email=event.metadata.email;

const token=crypto.randomBytes(32).toString("hex");

/* enregistrer utilisateur */

db.run(

`INSERT OR REPLACE INTO users (email,token,paid)
VALUES (?,?,1)`,

[email,token],

async function(err){

if(err){
console.log(err);
return;
}

/* envoi email */

const transporter=nodemailer.createTransport({

service:"gmail",

auth:{
user:process.env.EMAIL_USER,
pass:process.env.EMAIL_PASS
}

});

await transporter.sendMail({

from:"Anim-Formation",

to:email,

subject:"Votre accès à Anim-Formation 🎉",

html:`

<h2>Paiement confirmé</h2>

<p>Merci pour votre achat.</p>

<p>Accédez à votre formation via ce lien :</p>

<a href="https://anim-formation.onrender.com/formation/${token}">
Accéder à la formation
</a>

<p>Ce lien est personnel et valable 90 jours.</p>

`

});

}

);

}

res.sendStatus(200);

}catch(error){

console.log(error);

res.sendStatus(200);

}

});


/* -----------------------
ACCES SECURISE FORMATION
----------------------- */

app.get("/formation/:token",(req,res)=>{

const token=req.params.token;

const userIP=
req.headers["x-forwarded-for"] ||
req.socket.remoteAddress;

db.get(

"SELECT * FROM users WHERE token=? AND paid=1",

[token],

(err,row)=>{

if(!row){

return res.send("Accès refusé");

}

/* expiration 90 jours */

const created=new Date(row.created_at);
const now=new Date();

const diffDays=(now-created)/(1000*60*60*24);

if(diffDays>90){

return res.send("Votre accès a expiré");

}

/* anti partage */

if(!row.ip){

db.run(
"UPDATE users SET ip=? WHERE token=?",
[userIP,token]
);

}

else if(row.ip!==userIP){

return res.send(
"Accès bloqué : lien utilisé sur un autre appareil"
);

}

/* accès autorisé */

res.sendFile(
__dirname+"/public/formation-privee.html"
);

}

);

});


/* -----------------------
SERVEUR
----------------------- */

const PORT=process.env.PORT || 3000;

app.listen(PORT,()=>{

console.log("Serveur lancé sur port "+PORT);

});