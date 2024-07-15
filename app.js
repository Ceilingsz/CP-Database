import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import bcrypt from "bcrypt";

const port = 3000;
const app = express();
const saltRounds = 10;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
let currentUserEmail = null;

const tableName = "problems";

const db = new pg.Client({
    user:"postgres",
    password:"123456",
    host:"localhost",
    database:"cfproblems",
    port:5432
});

db.connect();

app.get("/", (req, res) => {
    res.render("login.ejs")
})

app.get("/register", (req, res) => {
    res.render("register.ejs")
})

app.post("/login", async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    const result = await db.query(`select * from users where email = '${email}'`);
    if(result.rows.length == 0){
        let errorMessage = "User has not been registered yet. Please register."
        res.render("register.ejs", {message : errorMessage})
    } else {
        const userCredentials = result.rows[0];
        bcrypt.compare(password, userCredentials["password"], (err, result) => {
            if(err){
                console.error("Failed to check if password was correct", err.stack);
                res.status(500).send("Error occurred while authenticating credentials");
            } else {
                if(result){
                    currentUserEmail = email;
                    res.redirect("/dashboard");
                }
                else{
                    res.render("login.ejs", {message : errorMessage})
                }
            }
        })
    }
})

app.post("/register",async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    bcrypt.hash(password, saltRounds, async (err, hash) => {
        if(err){
            console.error("Failed to upload user credentials", err.stack);
            res.status(500).send("Error occurred while salting");
        } else {
            try {
                const result = await db.query(`SELECT * from users where email = '${email}'`);
                if(result.rows.length > 0){
                    let errorMessage = "User with this email already exists. Try logging in.";
                    res.render("register.ejs", {message : errorMessage})
                } else {
                    password = hash;
                    await db.query("INSERT INTO users (email, \"password\") VALUES ($1, $2)", [email, password]);
                    res.redirect("/dashboard")
                }
            } catch (error) {
                console.error("Failed to upload user credentials", error.stack);
            res.status(500).send("Error occurred while authenticating");
            }
        }
        
    })
})

app.get("/dashboard", async (req, res) => {
    console.log(currentUserEmail)
    try {
        const result = await db.query(`SELECT * from (select * from ${tableName} where email = '${currentUserEmail}' ORDER BY \"sno\" desc LIMIT 10) sub ORDER BY \"sno\" ASC`);
        const ListProblems = result.rows;
        res.render("dashboard.ejs", { problemsData: ListProblems, currentUser: currentUserEmail });
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
    const result = await db.query(`SELECT * from ${tableName} where submissionid = '${req.params.id}' and email = '${currentUserEmail}'`)
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

    // console.log(uploadedProblemID)
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

        let dbArray = [handle, currentUserEmail, uploadedProblem.verdict ,uploadedProblem.problem.contestId + uploadedProblem.problem.index, uploadedProblem.problem.name, comment, (uploadedProblem.problem.rating ? uploadedProblem.problem.rating : "unknown")];
        let problemTags = uploadedProblem.problem.tags.map((tag) => {
            return '"' + tag + '"'
        });
        let sizeArray = ["$1", "$2", "$3", "$4", "$5", "$6", "$7"]
        for(let i = 0 ; i < uploadedProblem.problem.tags.length + 1; i++){
            if(i < uploadedProblem.problem.tags.length){    
                dbArray.push('t');
            }
            sizeArray.push(`$${i+8}`);
        }
        dbArray.push(uploadedProblemID);
       
        let text = `INSERT INTO ${tableName} ("user", email , verdict, problemid, problemname, comment, rating, ` + problemTags.toString() + ",\"submissionid\") VALUES (" + sizeArray.toString() + ")" ;
     
        db.query(text, dbArray)
        res.redirect("/upload");
    }
});

app.post("/tag", async (req, res) => {
    let tag = 0;
    if("tagselect" in req.body)
        tag = req.body["tagselect"];
    let lowerBound = req.body["rating-lower"];
    let upperBound = req.body["rating-upper"];
    let verdictFilter = req.body["verdict-select"];
    let needFavs = 0;
    if("wantFav" in req.body){
        needFavs = 1;
    }
    if(lowerBound == '')lowerBound = 0;
    if(upperBound == '')upperBound = 4000;
    try {   
        let dbRequest = `SELECT * FROM ${tableName} where rating >= ${lowerBound} AND rating <= ${upperBound} and email='${currentUserEmail}' `;
        if(verdictFilter !== "Any")
            dbRequest += `AND verdict = '${verdictFilter}' `;
        if(needFavs)
            dbRequest += `AND favorite = true `
        if("tagselect" in req.body){
            dbRequest += `AND `;
            if(typeof(tag) == "string")
                dbRequest += "\"" + tag + "\" = 't' ";
            else{
                for(let i = 0; i < tag.length; i++){
                    dbRequest += "\"" + tag[i] + "\" = 't' ";
                    if(i < tag.length - 1)
                        dbRequest += "AND ";
                }   
            }
        }
        dbRequest.trim();
        console.log(dbRequest)
        const result = await db.query(dbRequest);
        const ListProblems = result.rows;
        res.render("dashboard.ejs", { problemsData: ListProblems, currentUser : currentUserEmail });
    } catch (err) {
        console.error("Failed to make query", err.stack);
        res.status(500).send("Error occurred while fetching problems");
    }
})

app.post("/fav", async (req, res) => {
    let subID = req.body["problemID"];
    let change = req.body["Fav"];

    try {
        if(change === '1')
            await db.query(`update ${tableName} set favorite = 't' where submissionid = '${subID}' and email = '${currentUserEmail}';`)
        else
            await  db.query(`update ${tableName} set favorite = 'f' where submissionid = '${subID}' and email = '${currentUserEmail}';`)
        res.redirect("/dashboard")
    } catch(err) {
        console.error("failed to make query", err.stack)
        res.status(500).send("Error occurred while favoriting");   
    }
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
})

app.get("/logout", (req, res) => {
    currentUserEmail = null;
    res.redirect("/");
})