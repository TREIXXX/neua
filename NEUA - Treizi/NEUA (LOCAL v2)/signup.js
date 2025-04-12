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

// Initialize popovers
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Initialize terms modal trigger
    const termsLink = document.getElementById('termsLink');
    if (termsLink) {
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            new bootstrap.Modal(document.getElementById('termsModal')).show();
        });
    }
});

// Form validation functions
function setupFormValidation(formType) {
    const form = document.getElementById('signupForm');
    const userTypeSelect = document.getElementById('userType');
    const emailField = document.getElementById('signupEmail');
    const idField = document.getElementById('signupID');
    const certificateUploadField = document.getElementById('certificateUpload');
    const certificateUploadLabel = certificateUploadField.previousElementSibling;
    const termsCheckbox = document.getElementById('termsCheckbox');
    const submitButton = document.getElementById('submitSignupForm');
    const firstNameField = document.getElementById('firstName');
    const middleInitialField = document.getElementById('middleInitial');

    // Update form fields based on user type
    function updateFormFields() {
        const userType = userTypeSelect.value;
        const lastNameCol = document.getElementById('lastName').parentElement;
        const firstNameCol = document.getElementById('firstName').parentElement;
        const middleInitialCol = document.getElementById('middleInitial').parentElement;
        
        // Reset all fields to required and visible
        firstNameField.required = true;
        firstNameField.style.display = 'block';
        firstNameField.parentElement.style.display = 'block';
        middleInitialField.required = false;
        middleInitialField.style.display = 'block';
        middleInitialField.parentElement.style.display = 'block';
        idField.required = true;
        idField.style.display = 'block';
        idField.parentElement.style.display = 'block';
        certificateUploadField.required = true;
        certificateUploadField.style.display = 'block';
        certificateUploadLabel.style.display = 'block';
        
        // Reset column sizes
        lastNameCol.className = 'col-md-5';
        firstNameCol.className = 'col-md-5';
        middleInitialCol.className = 'col-md-2';
        
        // Set email pattern and placeholder based on user type
        if (userType === "student") {
            emailField.pattern = "^[a-zA-Z0-9._%+-]+@neu\\.edu\\.ph$";
            emailField.placeholder = "example@neu.edu.ph";
            emailField.title = "Email must end with @neu.edu.ph";
            idField.pattern = "^\\d{2}-\\d{5}-\\d{3}$";
            idField.placeholder = "25-12345-678";
            idField.title = "ID must be in the format 25-12345-678";
        } else if (userType === "alumni") {
            emailField.pattern = "^[a-zA-Z0-9._%+-]+@(neu\\.edu\\.ph|gmail\\.com)$";
            emailField.placeholder = "example@neu.edu.ph / example@gmail.com";
            emailField.title = "Email must end with @neu.edu.ph or @gmail.com";
            idField.pattern = "^\\d{2}-\\d{5}-\\d{3}$";
            idField.placeholder = "25-12345-678";
            idField.title = "ID must be in the format 25-12345-678";
        } else if (userType === "faculty") {
            emailField.pattern = "^[a-zA-Z0-9._%+-]+@neu\\.edu\\.ph$";
            emailField.placeholder = "example@neu.edu.ph";
            emailField.title = "Email must end with @neu.edu.ph";
            idField.pattern = "^\\d{6}$";
            idField.placeholder = "123456";
            idField.title = "ID must be a 6-digit number";
            certificateUploadField.required = false;
            certificateUploadField.style.display = "none";
            certificateUploadLabel.style.display = "none";
        }
    }

    function validateForm() {
        const userType = userTypeSelect.value;
        const email = emailField.value;
        const id = idField.value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        let isValid = true;
        let errorMessage = '';

        // Reset previous validation states
        form.classList.remove('was-validated');
        
        // Check password match
        if (password !== confirmPassword) {
            errorMessage = 'Passwords do not match';
            isValid = false;
        }

        // Email validation
        if (userType === "student" || userType === "faculty") {
            if (!email.match(/^[a-zA-Z0-9._%+-]+@neu\.edu\.ph$/)) {
                errorMessage = 'Invalid email format. Must be @neu.edu.ph';
                isValid = false;
            }
        } else if (userType === "alumni") {
            if (!email.match(/^[a-zA-Z0-9._%+-]+@(neu\.edu\.ph|gmail\.com)$/)) {
                errorMessage = 'Invalid email format. Must be @neu.edu.ph or @gmail.com';
                isValid = false;
            }
        }

        // ID validation
        if (userType === "student" || userType === "alumni") {
            if (!id.match(/^\d{2}-\d{5}-\d{3}$/)) {
                errorMessage = 'Invalid ID format. Must be XX-XXXXX-XXX';
                isValid = false;
            }
        } else if (userType === "faculty") {
            if (!id.match(/^\d{6}$/)) {
                errorMessage = 'Invalid ID format. Must be 6 digits';
                isValid = false;
            }
        }

        // Certificate validation for students and alumni
        if ((userType === "student" || userType === "alumni") && 
            certificateUploadField.required && 
            certificateUploadField.files.length === 0) {
            errorMessage = 'Certificate is required';
            isValid = false;
        }

        if (!isValid) {
            showAlert(errorMessage, 'danger');
        }
        return isValid;
    }

    // Handle form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Validate form before submission
        if (!validateForm()) {
            return;
        }

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        const submitButton = document.getElementById('submitSignupForm');
        const originalButtonText = submitButton.innerHTML;

        // Set loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...';

        const formData = new FormData();
        
        // Different handling for student signup vs admin create user
        if (formType === 'studentSignup') {
            formData.append('action', 'requestAccount');
            formData.append('user_type', 'student');
        } else {
            formData.append('action', 'createUser');
            formData.append('userType', userTypeSelect.value);
        }

        // Common form data
        formData.append('lastName', document.getElementById('lastName').value);
        formData.append('firstName', document.getElementById('firstName').value);
        formData.append('middleInitial', document.getElementById('middleInitial').value || '');
        formData.append('email', emailField.value);
        formData.append('user_id', idField.value);
        formData.append('password', document.getElementById('signupPassword').value);

        // Only append certificate for students and alumni
        const userType = userTypeSelect.value;
        if ((userType === 'student' || userType === 'alumni') && certificateUploadField.files.length > 0) {
            formData.append('certificate', certificateUploadField.files[0]);
        }

        try {
            const response = await fetch('signup.php', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                showAlert(result.message, 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
                modal.hide();
                form.reset();
            } else {
                showAlert(result.message || 'Error processing request', 'danger');
            }
        } catch (error) {
            console.error('Signup error:', error);
            showAlert('An error occurred while processing your request.', 'danger');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });

    // Enable/disable submit button based on terms checkbox
    if (termsCheckbox && formType === 'studentSignup') {
        submitButton.disabled = true;  // Initially disabled for student signup
        termsCheckbox.addEventListener('change', function() {
            submitButton.disabled = !this.checked;
        });
    } else if (formType === 'createUser') {
        submitButton.disabled = false;  // Never disabled for create user
    }

    // Update fields when user type changes
    userTypeSelect.addEventListener('change', updateFormFields);
    
    // Initial field setup
    updateFormFields();
}

// Initialize appropriate form validation based on button click
document.getElementById('Studentsignup')?.addEventListener('click', () => setupFormValidation('studentSignup'));
document.getElementById('CreateUser')?.addEventListener('click', () => setupFormValidation('createUser'));

// Reset signup modal when closed
document.getElementById('signupModal').addEventListener('hidden.bs.modal', function () {
    const form = document.getElementById('signupForm');
    const userTypeSelect = document.getElementById('userType');
    const emailField = document.getElementById('signupEmail');
    const idField = document.getElementById('signupID');
    const termsCheckbox = document.getElementById('termsCheckbox');
    const submitButton = document.getElementById('submitSignupForm');
    const passwordMismatch = document.getElementById('passwordMismatch');
    const passwordMatch = document.getElementById('passwordMatch');

    // Reset all form fields
    form.reset();
    form.classList.remove('was-validated');

    // Reset custom validations
    passwordMismatch.style.display = 'none';
    passwordMatch.style.display = 'none';

    // Reset file input if exists
    const certificateUpload = document.getElementById('certificateUpload');
    if (certificateUpload) {
        certificateUpload.value = '';
    }

    // Reset email and ID fields
    emailField.value = '';
    idField.value = '';

    // Reset terms checkbox if it exists
    if (termsCheckbox) {
        termsCheckbox.checked = false;
    }

    // Reset submit button state
    if (submitButton) {
        submitButton.disabled = userTypeSelect.value === 'student';
    }

    // Clear any alerts
    const alertContainer = document.querySelector('.alert');
    if (alertContainer) {
        alertContainer.remove();
    }
});