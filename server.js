const express = require("express")
const bodyParser = require("body-parser")
const axios = require("axios")
const sqlite3 = require("sqlite3").verbose()
const crypto = require("crypto")
const { Resend } = require("resend")
require("dotenv").config()

const app = express()

app.use(bodyParser.json())
app.use(express.static("public"))

const resend = new Resend(process.env.RESEND_API_KEY)

const db = new sqlite3.Database("./database.db")

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
token TEXT,
paid INTEGER DEFAULT 0,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`)

async function envoyerEmail(email,token){

const link = `https://anim-formation.onrender.com/formation/${token}`

try{

await resend.emails.send({
from:"Anim-Formation <onboarding@resend.dev>",
to:email,
subject:"Accès à votre formation",
html:`
<h2>Paiement confirmé</h2>

<p>Merci pour votre achat.</p>

<p>Accédez à votre formation :</p>

<a href="${link}">
Accéder à la formation
</a>

<p>Accès valable 90 jours.</p>
`
})

console.log("EMAIL ENVOYE",email)

}catch(err){

console.log("ERREUR EMAIL",err)

}

}

app.post("/confirm-payment",async(req,res)=>{

const {email,transaction_id}=req.body

if(!email||!transaction_id)
return res.status(400).json({error:"Données manquantes"})

try{

const response = await axios.get(
`https://api.fedapay.com/v1/transactions/${transaction_id}`,
{
headers:{
Authorization:`Bearer ${process.env.FEDAPAY_SECRET}`
}
}
)

const transaction = response.data.transaction

if(!transaction || transaction.status!=="approved"){

return res.json({error:"Paiement non validé"})

}

const token = crypto.randomBytes(32).toString("hex")

db.run(
`INSERT OR REPLACE INTO users(email,token,paid) VALUES(?,?,1)`,
[email,token],
async()=>{

await envoyerEmail(email,token)

res.json({success:true})

}
)

}catch(err){

console.log(err)

res.status(500).json({error:"Erreur serveur"})

}

})

app.post("/webhook",async(req,res)=>{

console.log("WEBHOOK",req.body)

try{

if(
req.body.entity==="transaction" &&
req.body.action==="approved"
){

const transaction = req.body.data

const email = transaction.metadata?.email

if(!email){
return res.sendStatus(200)
}

const token = crypto.randomBytes(32).toString("hex")

db.run(
`INSERT OR REPLACE INTO users(email,token,paid) VALUES(?,?,1)`,
[email,token],
async()=>{

await envoyerEmail(email,token)

console.log("Paiement confirmé webhook",email)

}
)

}

res.sendStatus(200)

}catch(err){

console.log(err)

res.sendStatus(500)

}

})

app.get("/formation/:token",(req,res)=>{

const token=req.params.token

db.get(
"SELECT * FROM users WHERE token=? AND paid=1",
[token],
(err,row)=>{

if(!row) return res.send("Accès refusé")

const created=new Date(row.created_at)
const now=new Date()

const diff=(now-created)/(1000*60*60*24)

if(diff>90) return res.send("Accès expiré")

res.sendFile(__dirname+"/public/formation-privee.html")

}
)

})

const PORT=process.env.PORT||3000

app.listen(PORT,()=>{

console.log("Serveur lancé sur port",PORT)

})