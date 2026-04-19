const button = document.getElementById("signupBtn");

button.addEventListener("click", function (e) {
    e.preventDefault();

    const name = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirmPassword = document.getElementById("confirmPassword").value.trim();

    
    if (name === "") {
        alert("Please enter your full name");
        return;
    }

    if (email === "") {
        alert("Please enter your email");
        return;
    }

    if (!email.includes("@") || !email.includes(".")) {
        alert("Enter a valid email");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
    }

    const user = {
        name: name,
        email: email,
        password: password
    };

    localStorage.setItem("user", JSON.stringify(user));

    localStorage.setItem("isLoggedIn", "true");

    alert("Account created successfully");

    window.location.href = "../index.html";  
});