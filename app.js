import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const port = 3000;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const tableName = "problems";

const db = new pg.Client({
    user:"postgres",
    password:"123456",
    host:"localhost",
    database:"cfproblems",
    port:5432
});

db.connect();

app.get("/", async (req, res) => {
    try {
        const result = await db.query(`SELECT * from (select * from ${tableName} ORDER BY \"sno\" desc LIMIT 10) sub ORDER BY \"sno\" ASC`);

        const ListProblems = result.rows;
        res.render("dashboard.ejs", { problemsData: ListProblems });
    } catch (err) {
        console.error("Failed to make query", err.stack);
        res.status(500).send("Error occurred while fetching problems");
    }
});

app.get("/upload", (req, res) => {
    res.render("problemupload.ejs")
})

app.get('/problem/:id', async (req, res) => {
    try {
    const result = await db.query(`SELECT * from ${tableName} where submissionid = '${req.params.id}'`)
    console.log(result.rows[0]);
    res.render("problemcard.ejs", {problemsData : result.rows[0]})
    } catch(err) {
        console.error("failed to make query", err.stack)
        res.status(500).send("Error occurred while fetching problems");
    }
})

app.post("/submit", async (req, res) => {
    const uploadedProblemID = req.body.subCode.trim();
    const handle = req.body.currentHandle;
    const comment = req.body.comments;
    let uploadedProblem = "";

    console.log(uploadedProblemID)
    const CF_request =  await axios.get(`https://codeforces.com/api/user.status?handle=${handle}&from=1&count=100000`);
    const recentSubmissions = CF_request.data.result;
   
    for(let i = 0; i < recentSubmissions.length; i++){
        if(recentSubmissions[i].id == uploadedProblemID){
            uploadedProblem = recentSubmissions[i];
            break;
        }
    }
   
    if(uploadedProblem === ""){
        let errorMessage = "Could not find submission in user history.";
        res.render("problemupload.ejs", {message : errorMessage})
    } 
    else{
        let dbArray = [handle, uploadedProblem.problem.contestId + uploadedProblem.problem.index, uploadedProblem.problem.name, comment, (uploadedProblem.problem.rating ? uploadedProblem.problem.rating : "unknown")];
        let problemTags = uploadedProblem.problem.tags.map((tag) => {
            return '"' + tag + '"'
        });
        let sizeArray = ["$1", "$2", "$3", "$4", "$5"]
        for(let i = 0 ; i < uploadedProblem.problem.tags.length + 1; i++){
            if(i < uploadedProblem.problem.tags.length){    
                dbArray.push('t');
            }
            sizeArray.push(`$${i+6}`);
        }
        dbArray.push(uploadedProblemID);
       
        let text = `INSERT INTO ${tableName} ("user", problemid, problemname, comment, rating, ` + problemTags.toString() + ",\"submissionid\") VALUES (" + sizeArray.toString() + ")" ;
     
        db.query(text, dbArray)
        res.redirect("/upload");
    }
});

app.post("/tag", async (req, res) => {
    let tag = req.body["tagselect"];
   
    try {
        let dbRequest = `SELECT * FROM ${tableName} where `;
     
        if(typeof(tag) == "string")
            dbRequest += "\"" + tag + "\" = 't' ";
        else{
            for(let i = 0; i < tag.length; i++){
                dbRequest += "\"" + tag[i] + "\" = 't' ";
                if(i < tag.length - 1)
                    dbRequest += "AND ";
            }
        }
       
        const result = await db.query(dbRequest);
        const ListProblems = result.rows;
  
        res.render("dashboard.ejs", { problemsData: ListProblems });
    } catch (err) {
        console.error("Failed to make query", err.stack);
        res.status(500).send("Error occurred while fetching problems");
    }
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})