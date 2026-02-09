document.addEventListener("DOMContentLoaded", () => {

  /* LOAD PROFILE */
  fetch("/dashboard/data", {
    credentials: "include"   // ✅ Important for session cookies
  })
  .then(res => res.json())
  .then(data => {

    document.getElementById("name").value = data.user || "";
    document.getElementById("prn").value = data.prn || "";
    document.getElementById("class").value = data.class || "";
    document.getElementById("division").value = data.division || "";
    document.getElementById("year").value = data.current_year || "";

  });



  /* SAVE PROFILE */
  document.getElementById("saveBtn")
  .addEventListener("click", async () => {

    console.log("SAVE CLICKED ✅");

    const res = await fetch("/dashboard/profile/update", {

      method:"POST",

      credentials:"include", // ✅ VERY important

      headers:{
        "Content-Type":"application/json"
      },

      body: JSON.stringify({

        username:document.getElementById("name").value,
        prn:document.getElementById("prn").value,
        class_name:document.getElementById("class").value,
        division:document.getElementById("division").value,
        current_year:document.getElementById("year").value

      }) 

    });

    const data = await res.json();

    if(data.success){

      alert("✅ Profile Updated!");

      // ✅ FIXED REDIRECT
      window.location="/dashboard";

    }else{

      alert("Update failed");

    }

  });

});
