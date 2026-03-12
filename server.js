const express = require("express")
const { Resend } = require("resend")
require("dotenv").config()

const fetch = require("node-fetch")

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))

const resend = new Resend(process.env.RESEND_API_KEY)

const FEDAPAY_SECRET = process.env.FEDAPAY_SECRET_KEY



async function envoyerEmail(email){

try{

await resend.emails.send({

from: "Anim Formation <onboarding@resend.dev>",

to: email,

subject: "Accès à votre formation",

html: `

<h2>Paiement confirmé</h2>

<p>Merci pour votre achat.</p>

<p>Cliquez ci-dessous pour accéder à votre formation :</p>

<a href="https://anim-formation.onrender.com/formation-privee.html">
Accéder à la formation
</a>

`

})

console.log("EMAIL ENVOYE :", email)

}catch(err){

console.log("ERREUR EMAIL :", err)

throw err

}

}



app.post("/envoyer-acces", async (req,res)=>{

try{

const {email, transaction_id} = req.body

if(!email || !transaction_id){

return res.status(400).send("ERREUR")

}

const response = await fetch(

`https://api.fedapay.com/v1/transactions/${transaction_id}`,

{

headers:{

Authorization:`Bearer ${FEDAPAY_SECRET}`

}

}

)

const data = await response.json()

const transaction = data.v1

if(!transaction){

console.log("Transaction introuvable")

return res.send("ERREUR")

}

if(transaction.status !== "approved"){

console.log("PAIEMENT NON APPROUVE :", transaction.status)

return res.send("ERREUR")

}

await envoyerEmail(email)

return res.send("EMAIL_ENVOYE")

}catch(err){

console.log("ERREUR SERVEUR :", err)

res.status(500).send("ERREUR")

}

})



const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{

console.log("Serveur lancé sur port",PORT)

})