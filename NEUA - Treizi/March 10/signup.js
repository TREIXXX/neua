// Real-time Password Matching
const passwordField = document.getElementById("signupPassword");
const confirmPasswordField = document.getElementById("confirmPassword");
const passwordMismatch = document.getElementById("passwordMismatch");
const passwordMatch = document.getElementById("passwordMatch");

function checkPasswordMatch() {
  const password = passwordField.value;
  const confirmPassword = confirmPasswordField.value;

  if (password === "" || confirmPassword === "") {
    passwordMismatch.style.display = "none";
    passwordMatch.style.display = "none";
    return;
  }

  if (password === confirmPassword) {
    passwordMismatch.style.display = "none";
    passwordMatch.style.display = "block";
  } else {
    passwordMismatch.style.display = "block";
    passwordMatch.style.display = "none";
  }
}

passwordField.addEventListener("input", checkPasswordMatch);
confirmPasswordField.addEventListener("input", checkPasswordMatch);

// Handle Admin Signup Button Click
document.getElementById("adminSignupButton").addEventListener("click", function () {
  const modalTitle = document.getElementById("signupModalLabel");
  modalTitle.textContent = "New User"; // Set header to "Admin Sign Up"
  const userTypeDropdown = document.getElementById("userType");
  userTypeDropdown.disabled = false; // Enable the dropdown for admin
  userTypeDropdown.value = ""; // Reset the dropdown value

  // Remove the Terms and Conditions checkbox if it exists
  const termsCheckboxContainer = document.getElementById("termsCheckboxContainer");
  if (termsCheckboxContainer) {
    termsCheckboxContainer.remove();
  }

  // Enable the "Send Verification Email" button without requiring the checkbox
  const sendVerificationEmailButton = document.getElementById("sendVerificationEmail");
  sendVerificationEmailButton.disabled = false; // Enable the button
});

// Handle Student Signup Button Click (if it exists)
const studentSignupButton = document.getElementById("studentSignupButton");
if (studentSignupButton) {
  studentSignupButton.addEventListener("click", function () {
    const modalTitle = document.getElementById("signupModalLabel");
    modalTitle.textContent = "Student Sign Up"; // Set header to "Student Sign Up"
    const userTypeDropdown = document.getElementById("userType");
    userTypeDropdown.disabled = true; // Disable the dropdown for student
    userTypeDropdown.value = "student"; // Set the dropdown value to "student"

    // Add the Terms and Conditions checkbox for student signup
    const termsCheckboxContainer = document.createElement("div");
    termsCheckboxContainer.id = "termsCheckboxContainer";
    termsCheckboxContainer.classList.add("form-check", "mb-3");

    const termsCheckbox = document.createElement("input");
    termsCheckbox.type = "checkbox";
    termsCheckbox.classList.add("form-check-input");
    termsCheckbox.id = "termsCheckbox";

    const termsLabel = document.createElement("label");
    termsLabel.classList.add("form-check-label");
    termsLabel.htmlFor = "termsCheckbox";
    termsLabel.innerHTML = 'I agree to the <a href="#" id="termsLink">Terms and Conditions</a>';

    termsCheckboxContainer.appendChild(termsCheckbox);
    termsCheckboxContainer.appendChild(termsLabel);

    // Insert the checkbox before the submit button
    const submitButton = document.getElementById("sendVerificationEmail");
    submitButton.parentNode.insertBefore(termsCheckboxContainer, submitButton);

    // Disable the "Send Verification Email" button until the checkbox is checked
    const sendVerificationEmailButton = document.getElementById("sendVerificationEmail");
    sendVerificationEmailButton.disabled = true; // Disable the button initially

    // Add event listener to the checkbox
    termsCheckbox.addEventListener("change", function () {
      sendVerificationEmailButton.disabled = !this.checked;
    });

    // Add event listener to the terms link
    const termsLink = document.getElementById("termsLink");
    termsLink.addEventListener("click", function (event) {
      event.preventDefault();
      const termsModal = new bootstrap.Modal(document.getElementById("termsModal"));
      termsModal.show();
    });

    // Dynamically add the info popover for student signup
    const infoIcon = document.createElement("i");
    infoIcon.classList.add("fas", "fa-info-circle", "text-dark", "ms-2");
    infoIcon.setAttribute("data-bs-toggle", "popover");
    infoIcon.setAttribute("data-bs-trigger", "hover");
    infoIcon.setAttribute("data-bs-placement", "right");
    infoIcon.setAttribute("data-bs-content", "Alumni and Faculty may contact csd@neu.edu.ph for assistance.");

    // Insert the info icon into the modal title
    modalTitle.appendChild(infoIcon);

    // Initialize the popover
    new bootstrap.Popover(infoIcon);

    // Apply student-specific validations
    const emailField = document.getElementById("signupEmail");
    const idField = document.getElementById("signupID");
    const certificateUploadField = document.getElementById("certificateUpload");

    emailField.pattern = "^[a-zA-Z0-9._%+-]+@neu\\.edu\\.ph$";
    emailField.placeholder = "example@neu.edu.ph";
    emailField.title = "Email must end with @neu.edu.ph";
    idField.pattern = "^\\d{2}-\\d{5}-\\d{3}$";
    idField.placeholder = "25-12345-678";
    idField.title = "ID must be in the format 25-12345-678";
    certificateUploadField.required = true;
  });
}

// Handle Admin Signup Button Click
document.getElementById("adminSignupButton").addEventListener("click", function () {
  const modalTitle = document.getElementById("signupModalLabel");
  modalTitle.textContent = "New User"; // Set header to "Admin Sign Up"
  const userTypeDropdown = document.getElementById("userType");
  userTypeDropdown.disabled = false; // Enable the dropdown for admin
  userTypeDropdown.value = ""; // Reset the dropdown value

  // Remove the Terms and Conditions checkbox if it exists
  const termsCheckboxContainer = document.getElementById("termsCheckboxContainer");
  if (termsCheckboxContainer) {
    termsCheckboxContainer.remove();
  }

  // Remove the info icon if it exists
  const infoIcon = modalTitle.querySelector(".fa-info-circle");
  if (infoIcon) {
    infoIcon.remove();
  }

  // Enable the "Send Verification Email" button without requiring the checkbox
  const sendVerificationEmailButton = document.getElementById("sendVerificationEmail");
  sendVerificationEmailButton.disabled = false; // Enable the button
});

// Reset the form and user type dropdown when the signup modal is closed
document.getElementById("signupModal").addEventListener("hidden.bs.modal", function () {
  const userTypeDropdown = document.getElementById("userType");
  userTypeDropdown.value = ""; // Reset the dropdown to its default value
  userTypeDropdown.disabled = false; // Enable the dropdown (for admin sign-up)
  document.getElementById("signupForm").reset(); // Reset the form
  document.getElementById("sendVerificationEmail").disabled = true; // Disable the submit button
  document.getElementById("passwordMismatch").style.display = "none"; // Hide password mismatch message
  document.getElementById("passwordMatch").style.display = "none"; // Hide password match message

  // Remove the Terms and Conditions checkbox if it exists
  const termsCheckboxContainer = document.getElementById("termsCheckboxContainer");
  if (termsCheckboxContainer) {
    termsCheckboxContainer.remove();
  }

  // Remove the info icon if it exists
  const modalTitle = document.getElementById("signupModalLabel");
  const infoIcon = modalTitle.querySelector(".fa-info-circle");
  if (infoIcon) {
    infoIcon.remove();
  }
});


// Add event listener to the userType dropdown (for admin sign-up)
document.getElementById("userType").addEventListener("change", function () {
  const userType = this.value;
  const emailField = document.getElementById("signupEmail");
  const idField = document.getElementById("signupID");
  const certificateUploadField = document.getElementById("certificateUpload");
  const certificateUploadLabel = document.querySelector('label[for="certificateUpload"]');

  // Reset validation messages and styles
  emailField.setCustomValidity("");
  idField.setCustomValidity("");

  // Set validation rules and placeholders based on user type
  if (userType === "student") {
    emailField.pattern = "^[a-zA-Z0-9._%+-]+@neu\\.edu\\.ph$";
    emailField.placeholder = "example@neu.edu.ph";
    emailField.title = "Email must end with @neu.edu.ph";
    idField.pattern = "^\\d{2}-\\d{5}-\\d{3}$";
    idField.placeholder = "25-12345-678";
    idField.title = "ID must be in the format 25-12345-678";
    certificateUploadField.required = true;
    certificateUploadField.style.display = "block"; // Show certificate upload
    certificateUploadLabel.style.display = "block"; // Show certificate upload label
  } else if (userType === "alumni") {
    emailField.pattern = "^[a-zA-Z0-9._%+-]+@(neu\\.edu\\.ph|gmail\\.com)$";
    emailField.placeholder = "example@neu.edu.ph or example@gmail.com";
    emailField.title = "Email must end with @neu.edu.ph or @gmail.com";
    idField.pattern = "^\\d{2}-\\d{5}-\\d{3}$";
    idField.placeholder = "25-12345-678";
    idField.title = "ID must be in the format 25-12345-678";
    certificateUploadField.required = true;
    certificateUploadField.style.display = "block"; // Show certificate upload
    certificateUploadLabel.style.display = "block"; // Show certificate upload label
  } else if (userType === "faculty") {
    emailField.pattern = "^[a-zA-Z0-9._%+-]+@neu\\.edu\\.ph$";
    emailField.placeholder = "example@neu.edu.ph";
    emailField.title = "Email must end with @neu.edu.ph";
    idField.pattern = "^\\d{6}$";
    idField.placeholder = "123456";
    idField.title = "ID must be a 6-digit number";
    certificateUploadField.required = false;
    certificateUploadField.style.display = "none"; // Hide certificate upload
    certificateUploadLabel.style.display = "none"; // Hide certificate upload label
  }
});

// Handle Sign-Up Form Submission
document.getElementById("signupForm").addEventListener("submit", function (event) {
  event.preventDefault(); // Prevent default form submission

  const userType = document.getElementById("userType").value;
  const name = document.getElementById("signupName").value;
  const id = document.getElementById("signupID").value;
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const certificateFile = document.getElementById("certificateUpload").files[0];

  // Validate Password Length
  if (password.length < 6) {
    showAlert("Password must be at least 6 characters long.", 'danger');
    return;
  }

  // Validate Password Match
  if (password !== confirmPassword) {
    showAlert("Passwords do not match.", 'danger');
    return;
  }

  // Validate ID Format based on user type
  let idPattern;
  if (userType === "student" || userType === "alumni") {
    idPattern = /^\d{2}-\d{5}-\d{3}$/;
  } else if (userType === "faculty") {
    idPattern = /^\d{6}$/;
  }
  if (!idPattern.test(id)) {
    showAlert("Please enter a valid ID format based on your user type.", 'danger');
    return;
  }

  // Validate Email Format based on user type
  let emailPattern;
  if (userType === "student" || userType === "faculty") {
    emailPattern = /^[a-zA-Z0-9._%+-]+@neu\.edu\.ph$/;
  } else if (userType === "alumni") {
    emailPattern = /^[a-zA-Z0-9._%+-]+@(neu\.edu\.ph|gmail\.com)$/;
  }
  if (!emailPattern.test(email)) {
    showAlert("Please enter a valid email address based on your user type.", 'danger');
    return;
  }

  // Validate Certificate Upload for students and alumni
  if ((userType === "student" || userType === "alumni") && !certificateFile) {
    showAlert("Please upload a certificate of matriculation.", 'danger');
    return;
  }

  // Create User in Firebase
  auth
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Upload Certificate to Firebase Storage (if required)
      if (certificateFile) {
        const storageRef = storage.ref(`certificates/${user.uid}/${certificateFile.name}`);
        storageRef.put(certificateFile).then((snapshot) => {
          snapshot.ref.getDownloadURL().then((downloadURL) => {
            // Save additional user data to Firestore
            firestore
              .collection("users")
              .doc(user.uid)
              .set({
                name: name,
                id: id,
                email: email,
                userType: userType,
                certificateURL: downloadURL,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
              })
              .then(() => {
                console.log("User data saved to Firestore.");
              })
              .catch((error) => {
                console.error("Error saving user data: ", error);
              });
          });
        });
      } else {
        // Save user data without certificate
        firestore
          .collection("users")
          .doc(user.uid)
          .set({
            name: name,
            id: id,
            email: email,
            userType: userType,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          })
          .then(() => {
            console.log("User data saved to Firestore.");
          })
          .catch((error) => {
            console.error("Error saving user data: ", error);
          });
      }

      // Send Verification Email
      user
        .sendEmailVerification()
        .then(() => {
          showAlert("Account created successfully! A verification email has been sent to your email address.", 'success');
        })
        .catch((error) => {
          console.error("Error sending verification email: ", error);
          showAlert("Failed to send verification email.", 'danger');
        });
    })
    .catch((error) => {
      console.error("Error creating account: ", error);
      showAlert("Error: " + error.message, 'danger');
    });

  // Reset the form and close the modal
  document.getElementById("signupForm").reset();
  const signupModal = bootstrap.Modal.getInstance(document.getElementById("signupModal"));
  signupModal.hide();
});

function resendVerificationEmail() {
  const user = auth.currentUser;
  if (user) {
    user
      .sendEmailVerification()
      .then(() => {
        showAlert("Verification email has been resent. Please check your inbox.", 'success');
      })
      .catch((error) => {
        console.error("Error resending verification email: ", error);
        showAlert("Failed to resend verification email.", 'danger');
      });
  } else {
    showAlert("No user is currently signed in.", 'danger');
  }
}


// JavaScript to handle terms and conditions checkbox
document.getElementById("termsCheckbox").addEventListener("change", function () {
  const sendVerificationEmailButton = document.getElementById("sendVerificationEmail");
  sendVerificationEmailButton.disabled = !this.checked; // Enable/disable button based on checkbox state
});

// Prevent the signup modal from closing when the terms modal is opened
document.getElementById("termsLink").addEventListener("click", function (event) {
  event.preventDefault();
  const termsModal = new bootstrap.Modal(document.getElementById("termsModal"));
  termsModal.show();
});

// Reset the checkbox and button state when the signup modal is closed
document.getElementById("signupModal").addEventListener("hidden.bs.modal", function () {
  document.getElementById("termsCheckbox").checked = false;
  document.getElementById("sendVerificationEmail").disabled = true;
});