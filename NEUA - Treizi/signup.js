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
    document.getElementById('termsLink').addEventListener('click', function(e) {
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('termsModal')).show();
    });
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
        } else if (userType === "admin") {
            firstNameField.required = false;
            firstNameField.style.display = 'none';
            firstNameField.parentElement.style.display = 'none';
            middleInitialField.required = false;
            middleInitialField.style.display = 'none';
            middleInitialField.parentElement.style.display = 'none';
            idField.required = false;
            idField.style.display = 'none';
            idField.parentElement.style.display = 'none';
            certificateUploadField.required = false;
            certificateUploadField.style.display = "none";
            certificateUploadLabel.style.display = "none";
            emailField.pattern = "^[a-zA-Z0-9._%+-]+@neu\\.edu\\.ph$";
            emailField.placeholder = "example@neu.edu.ph";
            emailField.title = "Email must end with @neu.edu.ph";
            
            // Make last name field take full width for admin
            lastNameCol.className = 'col-md-12';
        }
    }

    // Email validation for both signup and create user
    emailField.addEventListener("blur", function() {
        if (!this.value) return;

        const formData = new FormData();
        formData.append('action', 'checkEmail');
        formData.append('email', this.value);
        
        fetch('signup.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            const emailExists = document.getElementById("emailExists");
            const submitButton = document.getElementById("submitSignupForm");
            
            if (data.exists) {
                emailExists.style.display = "block";
                submitButton.disabled = true;
            } else {
                emailExists.style.display = "none";
                // For student signup, check terms checkbox
                if (formType === 'studentSignup') {
                    submitButton.disabled = !termsCheckbox.checked;
                } else {
                    submitButton.disabled = false;
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error checking email', 'error');
        });
    });

    // Handle form submission
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

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
        const formData = {
            name: document.getElementById('signupName').value,
            email: emailField.value,
            ID: idField.value,
            userType: userTypeSelect.value,
            password: document.getElementById('signupPassword').value
        };

        try {
            if (formType === 'studentSignup') {
                // Handle student signup flow
                const certificateFile = certificateUploadField.files[0];
                const storageRef = firebase.storage().ref(`certificates/pending/${formData.email}_${certificateFile.name}`);
                await storageRef.put(certificateFile);
                const certificateURL = await storageRef.getDownloadURL();

                // Save to account requests
                await firebase.firestore().collection('accountRequests').add({
                    ...formData,
                    certificateURL,
                    status: 'pending',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                showAlert('Account request submitted successfully! Please wait for admin approval.', 'success');
            } else if (formType === 'createUser') {
                // Handle direct user creation by admin
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(formData.email, formData.password);

                if (certificateUploadField.files.length > 0) {
                    const certificateFile = certificateUploadField.files[0];
                    const storageRef = firebase.storage().ref(`certificates/verified/${formData.email}_${certificateFile.name}`);
                    await storageRef.put(certificateFile);
                    formData.certificateURL = await storageRef.getDownloadURL();
                }

                await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                    ...formData,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                showAlert('User created successfully!', 'success');
            }

            // Close the modal immediately after successful submission
            const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
            modal.hide();

            // Reset form
            form.reset();

        } catch (error) {
            console.error('Signup error:', error);
            showAlert(error.message, 'danger');
        } finally {
            // Reset button state
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
    // Reset the form inputs
    document.getElementById('signupForm').reset(); // Reset the form
    document.getElementById('passwordMismatch').style.display = 'none'; // Hide password mismatch message
    document.getElementById('passwordMatch').style.display = 'none'; // Hide password match message
    
    // Reset submit button state only for student signup
    const submitButton = document.getElementById('submitSignupForm');
    const userType = document.getElementById('userType')?.value;
    if (submitButton && userType === 'Student') {
        submitButton.disabled = true;
    }
});

// Form submission handler
document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (passwordField.value !== confirmPasswordField.value) {
        showAlert('Passwords do not match', 'error');
        return;
    }
    
    // Create user data object with the correct format
    const userData = {
        name: document.getElementById('lastName').value + ', ' + 
              document.getElementById('firstName').value + 
              (document.getElementById('middleInitial').value ? ' ' + document.getElementById('middleInitial').value : ''),
        email: document.getElementById('signupEmail').value,
        user_id: document.getElementById('signupID').value,
        user_type: document.getElementById('userType').value.toLowerCase(),
        password: document.getElementById('signupPassword').value,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    const formData = new FormData();
    formData.append('action', 'requestAccount');
    
    // Append all user data to formData
    Object.keys(userData).forEach(key => {
        formData.append(key, userData[key]);
    });
    
    const certificateFile = document.getElementById('certificateUpload').files[0];
    if (certificateFile) {
        formData.append('certificate', certificateFile);
    }
    
    fetch('signup.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Account request submitted successfully! Please wait for admin approval.', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
            modal.hide();
            document.getElementById('signupForm').reset();
        } else {
            showAlert(data.message || 'Error submitting request', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error submitting request. Please try again.', 'error');
    });
});

// Add email validation for admin create user        
document.getElementById("signupEmail").addEventListener("blur", function() {
    const email = this.value;
    if(email) {
        fetch('adminhomepage.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                action: 'checkEmail',
                email: email 
            })
        })
        .then(response => response.json())
        .then(data => {
            const emailExists = document.getElementById("emailExists");
            const submitButton = document.getElementById("submitSignupForm");
            
            if (data.exists) {
                emailExists.style.display = "block";
                submitButton.disabled = true;
            } else {
                emailExists.style.display = "none";
                submitButton.disabled = false;
            }
        });
    }
});

// Handle modal reset when closed
document.getElementById('signupModal').addEventListener('hidden.bs.modal', function () {
    document.getElementById('signupForm').reset();
    passwordMismatch.style.display = 'none';
    passwordMatch.style.display = 'none';
    document.getElementById('certificateField').style.display = 'block';
});

function toggleAdminFields() {
    const userType = document.getElementById('userType').value;
    const certificateField = document.getElementById('certificateField');
    
    if (userType === 'Admin') {
        certificateField.style.display = 'none';
        certificateField.querySelector('input').required = false;
    } else {
        certificateField.style.display = 'block';
        certificateField.querySelector('input').required = true;
    }
}

// Add this function to refresh account requests
function refreshAccountRequestsRecords() {
    fetch('adminhomepage.php?action=getPendingUsers')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                globalPendingUsers = data.pendingUsers; // Store records globally
                updateAccountRequestsTable(data.pendingUsers);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error fetching account requests', 'error');
        });
}

// Add functions to handle approve/reject actions
function approveUser(requestId) {
    if (!confirm('Are you sure you want to approve this user?')) return;

    const formData = new FormData();
    formData.append('action', 'approveUser');
    formData.append('requestId', requestId);

    fetch('adminhomepage.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('User approved successfully!', 'success');
            refreshAccountRequestsRecords(); // Refresh account requests
            refreshUserRecords(); // Refresh user records
        } else {
            showAlert('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error approving user', 'error');
    });
}

function rejectUser(requestId) {
    if (!confirm('Are you sure you want to reject this user?')) return;

    const formData = new FormData();
    formData.append('action', 'rejectUser');
    formData.append('requestId', requestId);

    fetch('adminhomepage.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('User rejected successfully!', 'success');
            refreshAccountRequestsRecords(); // Refresh only account requests
        } else {
            showAlert('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error rejecting user', 'error');
    });
}

// Add this to initialize the account requests table when the page loads
document.addEventListener('DOMContentLoaded', function() {
    refreshAccountRequestsRecords();
    refreshUserRecords(); // Add this line to load user records on page load
});

// Add function to refresh user records
function refreshUserRecords() {
    fetch('adminhomepage.php?action=getApprovedUsers')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                globalUserRecords = data.approvedUsers; // Store records globally
                updateUserRecordsTable(data.approvedUsers);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error fetching user records', 'error');
        });
}

// Add these new functions
function filterUserRecords() {
    const searchInput = document.getElementById('userSearch').value.toLowerCase();
    
    // If search is empty, show all records
    if (searchInput.trim() === '') {
        updateUserRecordsTable(globalUserRecords);
        return;
    }

    // Filter records based on search input
    const filteredRecords = globalUserRecords.filter(user => 
        user.name.toLowerCase().includes(searchInput) ||
        user.email.toLowerCase().includes(searchInput) ||
        user.user_id.toLowerCase().includes(searchInput) ||
        user.user_type.toLowerCase().includes(searchInput)
    );

    updateUserRecordsTable(filteredRecords);
}

function filterAccountRequests() {
    const searchInput = document.getElementById('accountRequestSearch').value.toLowerCase();
    
    // If search is empty, show all records
    if (searchInput.trim() === '') {
        updateAccountRequestsTable(globalPendingUsers);
        return;
    }

    // Filter records based on search input
    const filteredRequests = globalPendingUsers.filter(user => 
        user.name.toLowerCase().includes(searchInput) ||
        user.email.toLowerCase().includes(searchInput) ||
        user.user_id.toLowerCase().includes(searchInput) ||
        user.user_type.toLowerCase().includes(searchInput)
    );

    updateAccountRequestsTable(filteredRequests);
}

// Add function to update user records table
function updateUserRecordsTable(users) {
    const tbody = document.querySelector('#userRecordsTable tbody');
    tbody.innerHTML = ''; // Clear existing rows
    
    users.forEach((user, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.user_id}</td>
            <td><span class="user-type ${user.user_type}">${user.user_type}</span></td>
            <td class="text-center">${user.certificate_url ? 
                `
                </button>` : ''}</td>
            <td class="actions">
                <div class="actions-dropdown">
                    <button class="btn btn-sm" onclick="toggleActionsMenu(this)">
                        <i class="fas fa-ellipsis"></i>
                    </button>
                    <div class="actions-menu">
                        <div class="action-item" onclick="viewCertificate('${user.certificate_url}')">
                            <i class="fas fa-eye"></i>View
                        </div>
                        <div class="action-item" onclick="editUser('${user.userId}')">
                            <i class="fas fa-edit"></i>Edit
                        </div>
                        <div class="action-item delete-action" onclick="deleteUser('${user.userId}')">
                            <i class="fas fa-trash"></i>Delete
                        </div>
                    </div>
                </div>
            </td>
        `;
    });

    // Update user count in dashboard
    document.getElementById('userCount').textContent = users.length;
}

// Update the updateAccountRequestsTable function
function updateAccountRequestsTable(users) {
    const tbody = document.querySelector('#accountRequestsTable tbody');
    tbody.innerHTML = ''; // Clear existing rows
    
    users.forEach((user, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.studentId || user.user_id || ''}</td>
            <td><span class="user-type ${user.user_type.toLowerCase()}">${user.user_type}</span></td>
            <td class="text-center">
                ${user.certificate_file ? 
                    `<button class="btn btn-sm btn-primary" onclick="viewCertificate('${user.certificate_file}')">
                        <i class="fas fa-eye"></i> View
                    </button>` : '-'}
            </td>
            <td class="actions">
                <button class="btn btn-outline-success btn-sm action-box" onclick="approveUser('${user.requestId}')">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-outline-danger btn-sm action-box" onclick="rejectUser('${user.requestId}')">
                    <i class="fas fa-times"></i>
                </button>
            </td>
        `;
    });

    // Update account requests count in dashboard
    document.getElementById('accountRequestsCount').textContent = users.length;
}

// Add these global variables at the top
let globalUserRecords = [];
let globalPendingUsers = [];

// Add these new functions for user actions
function editUser(userId) {
    // Implement user editing functionality
    console.log('Edit user:', userId);
    // TODO: Add edit user modal and functionality
}

function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    const formData = new FormData();
    formData.append('action', 'deleteUser');
    formData.append('userId', userId);

    fetch('adminhomepage.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('User deleted successfully!', 'success');
            refreshUserRecords();
        } else {
            showAlert('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error deleting user', 'error');
    });
}

// Add function to view certificate
function viewCertificate(certificateUrl) {
    if (!certificateUrl) return;
    window.open(certificateUrl, '_blank');
}

// Add login form handler
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('email', document.getElementById('loginEmail').value);
    formData.append('password', document.getElementById('loginPassword').value);
    
    fetch('login.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.href = data.redirect;
        } else {
            showAlert(data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Login failed. Please try again.', 'error');
    });
});

// Email validation for signup
document.getElementById("signupEmail")?.addEventListener("blur", function() {
    const email = this.value;
    if (email) {
        // Create safe filename from email
        const formData = new FormData();
        formData.append('action', 'checkEmail');
        formData.append('email', email);
        
        fetch('signup.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            const emailExists = document.getElementById("emailExists");
            const submitButton = document.getElementById("submitSignupForm");
            
            if (data.exists) {
                emailExists.style.display = "block";
                submitButton.disabled = true;
            } else {
                emailExists.style.display = "none";
                submitButton.disabled = false;
            }
        });
    }
});

// Fix login form handler
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('email', document.getElementById('userEmail').value);
    formData.append('password', document.getElementById('userPassword').value);
    
    fetch('login.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.href = data.redirect;
        } else {
            showAlert(data.message || 'Invalid email or password', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Login failed. Please try again.', 'error');
    });
});

// Email validation function to be used by both signup and create user forms
function validateEmail(email, emailExistsElement, submitButton, isSignupForm = false) {
    if (!email) return;

    const formData = new FormData();
    formData.append('action', 'checkEmail');
    formData.append('email', email);
    
    fetch('signup.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.exists) {
            emailExistsElement.style.display = "block";
            submitButton.disabled = true;
        } else {
            emailExistsElement.style.display = "none";
            // For signup form, check terms checkbox
            if (isSignupForm) {
                const termsCheckbox = document.getElementById('termsCheckbox');
                submitButton.disabled = !termsCheckbox.checked;
            } else {
                submitButton.disabled = false;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error checking email', 'error');
    });
}

// Email validation for signup form
document.getElementById("signupEmail")?.addEventListener("blur", function() {
    validateEmail(
        this.value,
        document.getElementById("emailExists"),
        document.getElementById("submitSignupForm"),
        true
    );
});

// Email validation for create user form (admin)
document.getElementById("createUserEmail")?.addEventListener("blur", function() {
    validateEmail(
        this.value,
        document.getElementById("emailExistsCreate"),
        document.getElementById("submitCreateUserForm"),
        false
    );
});

// Email validation function
function validateEmail(email, formType) {
    if (!email) return;

    const formData = new FormData();
    formData.append('action', 'checkEmail');
    formData.append('email', email);
    
    fetch('signup.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        const emailExists = document.getElementById(formType === 'signup' ? "emailExists" : "emailExists");
        const submitButton = document.getElementById(formType === 'signup' ? "submitSignupForm" : "submitSignupForm");
        
        if (data.exists) {
            emailExists.style.display = "block";
            submitButton.disabled = true;
        } else {
            emailExists.style.display = "none";
            if (formType === 'signup') {
                // For signup form, check terms checkbox
                const termsCheckbox = document.getElementById("termsCheckbox");
                submitButton.disabled = !termsCheckbox.checked;
            } else {
                submitButton.disabled = false;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error checking email', 'error');
    });
}

// Email validation for signup form
document.getElementById("signupEmail")?.addEventListener("blur", function() {
    validateEmail(this.value, 'signup');
});

// Email validation for create user form
document.getElementById("signupEmail")?.addEventListener("blur", function() {
    validateEmail(this.value, 'create');
});