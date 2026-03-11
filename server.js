const express = require("express")
const bodyParser = require("body-parser")
const { Resend } = require("resend")
require("dotenv").config()

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

const resend = new Resend(process.env.RESEND_API_KEY)

async function envoyerEmail(email){

try{

await resend.emails.send({

from: "Anim Formation <onboarding@resend.dev>",
to: email,

subject: "Accès à votre formation",

html: `
<h2>Paiement confirmé</h2>

<p>Merci pour votre achat.</p>

<p>Accédez à la formation :</p>

<a href="https://anim-formation.onrender.com/formation-privee.html">
Voir la formation
</a>
`

})

console.log("EMAIL ENVOYE :", email)

}catch(err){

console.log("ERREUR EMAIL :", err)

}

}

app.post("/webhook", async (req,res)=>{

try{

console.log("WEBHOOK BODY :", req.body)

const transaction = req.body.entity || req.body.data

if(!transaction){
return res.sendStatus(200)
}

if(transaction.status !== "approved"){
return res.sendStatus(200)
}

let email = null

if(transaction.metadata){

let meta = transaction.metadata

if(typeof meta === "string"){
meta = JSON.parse(meta)
}

email = meta.email

}

if(!email){
email = transaction.customer?.email
}

if(!email){
console.log("EMAIL INTROUVABLE")
return res.sendStatus(200)
}

await envoyerEmail(email)

res.sendStatus(200)

}catch(err){

console.log("ERREUR WEBHOOK :", err)
res.sendStatus(500)

}

})

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{

console.log("Serveur lancé sur port",PORT)

})

const fetch = require("node-fetch")

const FEDAPAY_SECRET = process.env.FEDAPAY_SECRET_KEY

app.post("/envoyer-acces", async (req,res)=>{

try{

const {email, transaction_id} = req.body

if(!email || !transaction_id){
return res.status(400).send("Données manquantes")
}

// vérification du paiement chez FedaPay
const response = await fetch(
`https://api.fedapay.com/v1/transactions/${transaction_id}`,
{
headers:{
Authorization:`Bearer ${FEDAPAY_SECRET}`
}
})

const data = await response.json()

const status = data.v1?.status

if(status !== "approved"){

console.log("PAIEMENT NON APPROUVE :", status)

return res.send("Paiement non confirmé")

}

// paiement validé → email envoyé
await envoyerEmail(email)

res.send("EMAIL ENVOYE")

}catch(err){

console.log("ERREUR VERIFICATION :", err)

res.status(500).send("Erreur serveur")

}

})