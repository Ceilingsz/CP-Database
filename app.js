import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const port = 3000;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
let handle = "";

const db = new pg.Client({
    user:"postgres",
    password:"123456",
    host:"localhost",
    database:"cfproblems",
    port:5432
});

db.connect();

app.get("/", (req, res) => {
    res.render("handle.ejs");
});

app.get("/dashboard", async (req, res) => {
    let ListProblems = 'hi';
    try {
        const result = await db.query("SELECT * from (select * from problems ORDER BY \"sno\" desc LIMIT 10) sub ORDER BY \"sno\" ASC");
        const ListProblems = result.rows;
        console.log(ListProblems);
        res.render("dashboard.ejs", { problemsData: ListProblems });
    } catch (err) {
        console.error("Failed to make query", err.stack);
        res.status(500).send("Error occurred while fetching problems");
    }
});

app.post("/submithandle", (req, res) => {
    handle = req.body.currentHandle;
    console.log(handle);
    res.redirect("/dashboard");
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})