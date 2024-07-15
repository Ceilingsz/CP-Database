CP Database is an application that allows you to upload user submissions from codeforces for easy access. It uses Express JS for the backend with PostgreSQL for a database. It has been deployed at https://cfdb.onrender.com/ :) 

# Set up to run locally

Create a new database in PGSQL and create two tables, one for the uploaded problems and one for storing user email/passwords. You can use the database.txt and users.txt file to find the necessary code for creating the tables. 
Make sure to edit in the information correctly in app.js to ensure connection to database. Run `npm i` to install the required dependencies, 

# Running the application

Use `node app.js` to run the application locally after setting up the database.
