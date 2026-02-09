const express = require("express");
const router = express.Router();
const db = require("../db");


/* ==================================================
ROLE PROTECTION MIDDLEWARE
   (PROFESSIONAL VERSION)
================================================== */

router.use((req, res, next) => {

console.log("📌 ALUMNI ROUTE SESSION:", req.session);

/* NOT LOGGED IN */
if (!req.session.user) {
    return res.status(401).send("Unauthorized - Please login");
}

/*  WRONG ROLE */
if (req.session.user.role !== "alumni") {
    return res.status(403).send("Access denied");
}

next();

});



/* ==================================================
   LOAD ALUMNI PROFILE
================================================== */

router.get("/profile", (req, res) => {

const userId = req.session.user.id;

db.query(
`SELECT * FROM alumni_profiles WHERE user_id=?`,
[userId],
(err,result)=>{

if(err){
console.log("❌ PROFILE LOAD ERROR:", err);
return res.json({});
}

if(result.length === 0){
return res.json({});
}

res.json(result[0]);

});

});



/* ==================================================
   UPDATE PROFILE (UPSERT)
================================================== */

router.post("/alumni/profile/update", (req,res)=>{

const userId = req.session.user.id;

const {
full_name,
graduation_year,
degree,
company,
job_title,
work_location,
linkedin
} = req.body;


db.query(
`
INSERT INTO alumni_profiles
(user_id,full_name,graduation_year,degree,company,job_title,work_location,linkedin)

VALUES (?,?,?,?,?,?,?,?)

ON DUPLICATE KEY UPDATE

full_name=VALUES(full_name),
graduation_year=VALUES(graduation_year),
degree=VALUES(degree),
company=VALUES(company),
job_title=VALUES(job_title),
work_location=VALUES(work_location),
linkedin=VALUES(linkedin)
`,
[
userId,
full_name,
graduation_year,
degree,
company,
job_title,
work_location,
linkedin
],
(err)=>{

if(err){
console.log("❌ PROFILE UPDATE ERROR:", err);
return res.json({success:false});
}

console.log("✅ Alumni profile updated for user:", userId);

res.json({success:true});

});

}); 



/* ==================================================
GET ALUMNI DIRECTORY (Students View)
================================================== */

router.get("/alumni/directory", (req,res)=>{

db.query(`
SELECT 
full_name,
graduation_year,
degree,
company,
job_title,
work_location,
linkedin
FROM alumni_profiles
ORDER BY graduation_year DESC
`,
(err,result)=>{

if(err){
console.log("❌ DIRECTORY ERROR:", err);
return res.json([]);
}

res.json(result);

});

});


module.exports = router;
 