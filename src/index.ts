import { getGrade } from "./ntnu";

import express from "express"
import cors from "cors"

const app = express()
app.use(cors())
const port = 8080



app.post("/getGrade",async (req,res) => {
	const account = req.query!.account
	const password = req.query!.password
	console.log("got request")
	if(typeof account == "string" && typeof password == "string") {
		await getGrade(account ,password).then(result => {
			res.send(result)
		}).catch(
			(err) => {
				console.log(err)
				res.send("Failed")
			}
		)
	}
	else {
		res.send("Input is wrong")
	}
})



app.listen(port,() => {
	console.log(`listen on port ${port}`)
})
