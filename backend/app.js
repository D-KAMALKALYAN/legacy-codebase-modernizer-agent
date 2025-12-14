const express = require("express");
const cors = require("cors");
const app = express();

//middleware
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use("/health" , (req , res) => {
    res.json({status : "Auth Service is running" , timestamp: new Date()});
})

module.exports = app;
