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



// ENVOI EMAIL
async function envoyerEmail(email){

try{

const response = await resend.emails.send({

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
console.log("RESEND RESPONSE :", response)

}catch(err){

console.log("ERREUR EMAIL :", err)
throw err

}

}



// ROUTE APPELEE APRES PAIEMENT
app.post("/envoyer-acces", async (req,res)=>{

try{

const {email, transaction_id} = req.body

console.log("REQUETE RECUE :", req.body)

if(!email || !transaction_id){

console.log("DONNEES MANQUANTES")

return res.status(400).send("ERREUR")

}



// APPEL API FEDAPAY
const response = await fetch(

`https://api.fedapay.com/v1/transactions/${transaction_id}`,

{
method:"GET",

headers:{
Authorization:`Bearer ${FEDAPAY_SECRET}`,
"Content-Type":"application/json"
}

}

)

const data = await response.json()

console.log("REPONSE FEDAPAY :", JSON.stringify(data,null,2))



// RECUPERATION TRANSACTION FIABLE
let transaction = null

if(data.v1){
transaction = data.v1
}

if(data.transaction){
transaction = data.transaction
}

if(!transaction){

console.log("TRANSACTION INTROUVABLE")

return res.send("ERREUR")

}



// VERIFICATION STATUT
const status = transaction.status

console.log("STATUT TRANSACTION :", status)

if(status !== "approved"){

console.log("PAIEMENT PAS ENCORE APPROUVE")

return res.send("ERREUR")

}



// ENVOI EMAIL
await envoyerEmail(email)

console.log("EMAIL ENVOYE AVEC SUCCES")

return res.send("EMAIL_ENVOYE")

}catch(err){

console.log("ERREUR SERVEUR :", err)

return res.status(500).send("ERREUR")

}

})



// TEST EMAIL
app.get("/test-email", async (req,res)=>{

try{

await resend.emails.send({

from:"Anim Formation <onboarding@resend.dev>",

to:"tchidiprudence7@gmail.com",

subject:"Test email",

html:"Email test fonctionne"

})

res.send("email envoyé")

}catch(err){

console.log("ERREUR TEST EMAIL :", err)

res.send("erreur")

}

})



const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{

console.log("Serveur lancé sur port",PORT)

})