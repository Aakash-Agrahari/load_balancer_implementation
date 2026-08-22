import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/", (req,res) => {
    res.send(`Hello from Server ${PORT}`)
});

app.get("/health", (req,res) => {
    res.status(200).json({
        status: "UP",
        port: PORT
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});