// Users ----------------------------------------------------------------------------------------------

// Helper function to get user type priority for sorting
function getUserTypePriority(userType) {
    const lowerType = String(userType).toLowerCase();
    switch (lowerType) {
        case 'dean': return 1;
        case 'coordinator': return 2;
        case 'faculty': return 3;
        case 'student': return 4;
        case 'alumni': return 5;
        default: return 9; // Unknown types go at the end
    }
}

function loadUserRecords(seeAll = false) {
    // Construct the URL with the see_all parameter
    const url = 'admin_dashboard.php?action=getApprovedUsers' + (seeAll ? '&see_all=true' : '');
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Server response:', data);
            console.log('User department:', window.currentUserDepartment);
            console.log('User records count before filtering:', data.approvedUsers.length);
            console.log('User records:', data.approvedUsers);
            
            if (data.success) {
                // Store the user type and department globally
                window.currentUserType = data.user_type.toLowerCase();
                window.currentUserDepartment = data.department;
                
                console.log('Current user type:', window.currentUserType);
                console.log('Current user department:', window.currentUserDepartment);
                
                allUserRecords = [];
                
                data.approvedUsers.forEach((user, index) => {
                    // Skip deactivated users - they should only appear in the Deactivated tab
                    if (user.account_status === 'deactivated') {
                        return;
                    }
                    
                    // Format user type to capitalize first letter
                    const userType = user.user_type ? 
                        user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1).toLowerCase() : '';
                    
                    // Set program value based on user type
                    let programValue = user.program || '';
                    
                    // Handle special cases based on user type
                    if (userType.toLowerCase() === 'dean') {
                        programValue = 'All Programs';
                    } else {
                        // For alumni and all other user types, use the program from the database
                        // and format it for display
                        programValue = getProgramDisplayName(programValue);
                    }
                    
                    const row = {
                        index: index + 1,
                        name: user.name || '',
                        email: user.email || '',
                        ID: user.user_id || '',
                        userType: userType,
                        department: user.program || user.department || '',
                        program: programValue,
                        requests: user.requests || 0,
                        created_at: user.created_at || '',
                        account_status: user.account_status || 'activated',
                        created_by: user.created_by || '',
                        certificate_url: user.certificate_url || ''
                    };
                    
                    // Ensure all fields are strings for consistent filtering
                    Object.keys(row).forEach(key => {
                        if (key !== 'certificate_url') {
                            row[key] = String(row[key]);
                        }
                    });
                    allUserRecords.push(row);
                });

                
                // If user is dean, coordinator, or admin and no seeAll parameter,
                // just render the data directly as it's already filtered on the server side
                if (!seeAll && window.currentUserDepartment && 
                    ['dean', 'coordinator', 'admin'].includes(window.currentUserType)) {
                    renderTable('userRecordsTable', allUserRecords);
                    
                    // Update the filter UI to reflect the current department
                    updateUserDepartmentFilterUI(window.currentUserDepartment);
                } else {
                    // If seeAll is true, display all records
                    renderTable('userRecordsTable', allUserRecords);
                }
            } else {
                console.error('Failed to load users:', data.message);
                showAlert('Failed to load user records: ' + data.message, 'danger');
            }
            
            console.log('User records after processing:', allUserRecords.length);
            console.log('Processed records:', allUserRecords);
        })
        .catch(error => {
            console.error('Error loading user records:', error);
            showAlert('Failed to load user records. Check console for details.', 'danger');
        });
}

// Function to update the UI to show which department is being filtered
function updateUserDepartmentFilterUI(department) {
    // Clear all checkboxes first
    document.querySelectorAll('#userDepartmentFilterDropdown [type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Check the appropriate department checkbox
    const departmentCheckbox = document.querySelector(`#userDepartmentFilterDropdown [value="${department}"]`);
    if (departmentCheckbox) {
        departmentCheckbox.checked = true;
        
        // Update the filter count badge
        const dropdown = departmentCheckbox.closest('.dropdown-filter');
        if (dropdown) {
            const countBadge = dropdown.querySelector('.selected-count');
            if (countBadge) {
                countBadge.textContent = "1";
                countBadge.classList.add('show');
            }
        }
    }
    
    // Uncheck the "See All Programs" checkbox
    const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
    if (seeAllCheckbox) {
        seeAllCheckbox.checked = false;
    }
}

function filterUserRecords() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    
    // If filtering is initially empty, show all records received from server
    if (!searchTerm && filterState.users.userType.size === 0 && 
        !filterState.users.status && !filterState.users.withRequests) {
        renderTable('userRecordsTable', allUserRecords);
        return;
    }
    
    // Apply filters
    filteredUserRows = allUserRecords.filter(record => {
        // Search term filter
        const matchesSearch = searchTerm === '' || Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );

        // User type filter
        const matchesType = filterState.users.userType.size === 0 || 
            filterState.users.userType.has(record.userType.toLowerCase());

// Status filter
const matchesStatus = !filterState.users.status || (
    filterState.users.status === 'deactivated' && record.account_status === 'deactivated' ||
    filterState.users.status === 'active' && record.account_status !== 'deactivated'
    );

        // With requests filter
        const matchesRequests = !filterState.users.withRequests || 
            (parseInt(record.requests) > 0);

        return matchesSearch && matchesType && matchesStatus && matchesRequests;
    });

    renderTable('userRecordsTable', filteredUserRows);
}

function refreshUserRecords() {
    showAlert('Refreshing user records...', 'info');
    
    // Reset user filters
    filterState.users = {
        program: new Set(),
        userType: new Set(),
        status: '',
        withRequests: false
    };
    
    // Reset checkboxes and radio buttons
    document.querySelectorAll('#userProgramFilterDropdown input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Update the selector to include coordinator and dean checkboxes
    document.querySelectorAll('[value="student"], [value="alumni"], [value="faculty"], [value="coordinator"], [value="dean"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    document.querySelectorAll('input[name="status"]').forEach(radio => {
        radio.checked = false;
    });
    
    const withRequests = document.querySelector('[value="with_requests"]');
    if (withRequests) withRequests.checked = false;
    
    // Reset filter count badges
    document.querySelectorAll('#users .dropdown-filter .selected-count').forEach(badge => {
        badge.classList.remove('show');
    });
    
    // Clear search input
    document.getElementById('userSearch').value = '';
    
    // Reset sorting
    document.querySelectorAll('#userRecordsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredUserRows = [];
    
    // Load user records with default filtering
    loadUserRecords(false);
}

// Function to toggle to see all programs/departments
function toggleSeeAllPrograms() {
    const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
    if (seeAllCheckbox) {
        seeAllCheckbox.checked = !seeAllCheckbox.checked;
        
        // Update the filter count badge
        const dropdown = seeAllCheckbox.closest('.dropdown-filter');
        updateFilterCount(dropdown, seeAllCheckbox.checked ? 1 : 0);
        
        // If checkbox is now checked, uncheck department checkboxes
        if (seeAllCheckbox.checked) {
            document.querySelectorAll('#userDepartmentFilterDropdown [value="CICS"], #userDepartmentFilterDropdown [value="CAS"], #userDepartmentFilterDropdown [value="CEA"]').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
        
        // Reload records with the appropriate see_all parameter
        loadUserRecords(seeAllCheckbox.checked);
    }
}

// Set up event handlers when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up click handlers for the department filter checkboxes
    document.querySelectorAll('#userDepartmentFilterDropdown [value="CICS"], #userDepartmentFilterDropdown [value="CAS"], #userDepartmentFilterDropdown [value="CEA"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Uncheck "See All Programs" when any department is checked
            const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
            if (seeAllCheckbox && seeAllCheckbox.checked && this.checked) {
                seeAllCheckbox.checked = false;
            }
            
            // Uncheck other department checkboxes - we only allow one department at a time
            document.querySelectorAll('#userDepartmentFilterDropdown [value="CICS"], #userDepartmentFilterDropdown [value="CAS"], #userDepartmentFilterDropdown [value="CEA"]').forEach(otherCheckbox => {
                if (otherCheckbox !== this) {
                    otherCheckbox.checked = false;
                }
            });
            
            // Update the filter count badge
            const dropdown = this.closest('.dropdown-filter');
            updateFilterCount(dropdown, this.checked ? 1 : 0);
            
            // Load user records for the selected department
            if (this.checked) {
                loadUserRecords(false);
            } else {
                // If no department is selected, show all programs
                const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
                if (seeAllCheckbox) {
                    seeAllCheckbox.checked = true;
                    updateFilterCount(seeAllCheckbox.closest('.dropdown-filter'), 1);
                }
                loadUserRecords(true);
            }
        });
    });
    
    // Set up the "See All Programs" checkbox
    const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
    if (seeAllCheckbox) {
        seeAllCheckbox.addEventListener('change', function() {
            // Update the filter count badge
            const dropdown = this.closest('.dropdown-filter');
            updateFilterCount(dropdown, this.checked ? 1 : 0);
            
            // If checked, uncheck all department checkboxes
            if (this.checked) {
                document.querySelectorAll('#userDepartmentFilterDropdown [value="CICS"], #userDepartmentFilterDropdown [value="CAS"], #userDepartmentFilterDropdown [value="CEA"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
            }
            
            // Load user records with the appropriate see_all parameter
            loadUserRecords(this.checked);
        });
    }
});

function setupUserFilters() {
    // Your setupUserFilters code here
}

function viewUser(name, email, ID, userType, creationDate, certificateUrl, createdBy) {
    document.getElementById('viewName').textContent = name || 'N/A';
    document.getElementById('viewEmail').textContent = email || 'N/A';
    document.getElementById('viewID').textContent = ID || 'N/A';
    document.getElementById('viewCreationDate').textContent = creationDate || 'Not available';
    document.getElementById('viewCreatedBy').textContent = createdBy || 'N/A';
    
    // Set user type with appropriate styling
    const userTypeElement = document.getElementById('viewUserType');
    if (userType) {
        userTypeElement.textContent = userType;
        userTypeElement.className = `user-type ${userType.toLowerCase()}`;
    } else {
        userTypeElement.textContent = 'N/A';
        userTypeElement.className = '';
    }
    
    // Show/Hide certificate section based on user type
    const certificateSection = document.querySelector('.accordion.mb-3');
    const userTypeLower = userType ? userType.toLowerCase() : '';
    
    // Hide certificate for Coordinator, Dean, and Faculty
    if (userTypeLower === 'coordinator' || userTypeLower === 'dean' || userTypeLower === 'faculty') {
        certificateSection.style.display = 'none';
    } else {
        certificateSection.style.display = 'block';
        
        // Only show certificate content for student/alumni
        const certificateImage = document.getElementById('certificateImage');
        
        if (certificateUrl && certificateUrl !== 'null' && certificateUrl !== 'undefined') {
            // Format certificate URL properly
            let formattedUrl = certificateUrl;
            
            // If URL doesn't already have the uploads/certificates prefix, add it
            if (!formattedUrl.includes('uploads/certificates/')) {
                // If it already has uploads/ prefix but not certificates/
                if (formattedUrl.startsWith('uploads/')) {
                    formattedUrl = 'uploads/certificates/' + formattedUrl.substring(8);
                } else {
                    // If it has neither prefix
                    formattedUrl = 'uploads/certificates/' + formattedUrl;
                }
            }
            
            // Set the image source
            certificateImage.src = formattedUrl;
            
            // Set up error handler
            certificateImage.onerror = function() {
                console.error('Error loading certificate image:', this.src);
                // Try an alternative path as a fallback
                if (!this.src.includes('/')) {
                    this.src = 'uploads/certificates/' + certificateUrl;
                    console.log('Trying alternative path:', this.src);
                } else {
                    document.getElementById('viewCertificate').innerHTML = 
                        '<p class="text-danger">Certificate image could not be loaded</p>';
                }
            };
            
            // Show the certificate container
            document.getElementById('viewCertificate').style.display = 'block';
        } else {
            document.getElementById('viewCertificate').style.display = 'none';
        }
    }

    // Fetch document requests for this user
    fetch(`admin_dashboard.php?action=getUserDocuments&email=${encodeURIComponent(email)}`)
        .then(response => response.json())
        .then(data => {
            const requestsSection = document.querySelector('.requests-section');
            
            if (data.success && data.requests) {
                // Create requests section
                let requestsHTML = `
                    <hr class="requests-separator">
                    <h5 class="mt-3 mb-3">
                        <i class="fas fa-file-alt me-2"></i>Document Request
                    </h5>
                    <div class="request-container">
                        <div class="detail-row mb-3">
                            <span class="detail-label fw-bold col-4">Document ID</span>
                            <span class="detail-value col-8">${data.requests['Document ID']}</span>
                        </div>
                        <div class="detail-row mb-3">
                            <span class="detail-label fw-bold col-4">Title</span>
                            <span class="detail-value col-8">${data.requests['Title']}</span>
                        </div>
                        <div class="detail-row mb-3">
                            <span class="detail-label fw-bold col-4">Author</span>
                            <span class="detail-value col-8">${data.requests['Author']}</span>
                        </div>
                        <div class="detail-row mb-3">
                            <span class="detail-label fw-bold col-4">Published</span>
                            <span class="detail-value col-8">${data.requests['Published']}</span>
                        </div>
                        <div class="document-actions mt-4 text-end">
                            <button type="button" class="btn btn-outline-dark me-2" onclick="rejectDocumentRequest('${email}')">
                                Reject
                            </button>
                            <button type="button" class="btn btn-dark" onclick="approveDocumentRequest('${email}')">
                                Approve
                            </button>
                        </div>
                    </div>`;
                
                requestsSection.innerHTML = requestsHTML;
                requestsSection.style.display = 'block';
            } else {
                requestsSection.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error fetching document requests:', error);
        });

    // Show the modal
    const viewUserModal = new bootstrap.Modal(document.getElementById('viewUser'));
    viewUserModal.show();
}

// Create user --------------------------------------------------------------------------------
function createUser(event) {
    event.preventDefault();
    const form = document.getElementById('signupForm');
    const formData = new FormData(form);
    formData.append('action', 'createUserDirectly');

    // Set the correct field names as expected by PHP
    formData.set('lastName', form.querySelector('#lastName').value);
    formData.set('firstName', form.querySelector('#firstName').value);
    formData.set('middleInitial', form.querySelector('#middleInitial').value);
    formData.set('email', form.querySelector('#signupEmail').value);
    formData.set('id', form.querySelector('#signupID').value);
    formData.set('userType', form.querySelector('#userType').value);
    formData.set('password', form.querySelector('#signupPassword').value);

    // Handle certificate file if it exists
    const certificateFile = form.querySelector('#certificate');
    if (certificateFile && certificateFile.files.length > 0) {
        formData.append('certificate', certificateFile.files[0]);
    }

    // Add console log to debug
    console.log('Certificate file:', certificateFile?.files[0]);

    fetch('admin_dashboard.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('User created successfully', 'success');
            loadUserRecords(); // Refresh user list
            const modal = bootstrap.Modal.getInstance(document.getElementById('signupModal'));
            modal.hide();
            document.getElementById('signupForm').reset();
        } else {
            showAlert(data.message || 'Error creating user', 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error creating user', 'danger');
    });
}

// Account Requests --------------------------------------------------------------------
function loadAccountRequests() {
    // No need for see_all parameter - we always want to filter by department
    const url = 'admin_dashboard.php?action=getPendingUsers';
    
    Promise.all([
        fetch('admin_dashboard.php?action=getApprovedUsers'),
        fetch(url)
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([approvedData, pendingData]) => {
        console.log('Pending users data:', pendingData);
        
        if (pendingData.success) {
            const accountRequestsTable = document.getElementById('accountRequestsTable').getElementsByTagName('tbody')[0];
            accountRequestsTable.innerHTML = '';
            allAccountRequests = [];
            
            pendingData.pendingUsers.forEach((user, index) => {
                const row = {
                    index: index + 1,
                    name: user.name || '',
                    email: user.email || '',
                    ID: user.user_id || '',
                    userType: user.user_type ? user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1).toLowerCase() : '',
                    department: user.program || user.department || '',
                    certificate_url: user.certificate_url || '',
                    requestId: user.requestId || '',
                    created_by: user.created_by || ''
                };
                
                allAccountRequests.push(row);
            });

            
            renderTable('accountRequestsTable', allAccountRequests);
            
            // Also update the charts to reflect the correct total
            loadChartData();
        } else {
            console.error('Failed to load requests:', pendingData.message);
            showAlert('Failed to load account requests: ' + pendingData.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error loading account requests:', error);
        showAlert('Failed to load account requests. Check console for details.', 'danger');
    });
}

function filterAccountRequests() {
    const searchTerm = document.getElementById('accountRequestSearch').value.toLowerCase();
    filteredAccountRequests = allAccountRequests.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    renderTable('accountRequestsTable', filteredAccountRequests);
}

function refreshAccountRequestsRecords() {
    showAlert('Refreshing account requests...', 'info');
    
    // Clear search input
    document.getElementById('accountRequestSearch').value = '';
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#accountRequestsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredAccountRequests = [];
    
    // Load account requests and update all stats
    loadAccountRequests();
    loadChartData(); // This will ensure all stats are updated correctly
}

function acceptUserRequest(requestId) {
    if (!requestId) {
        showAlert('Invalid request ID', 'danger');
        return;
    }

    showConfirmDialog({
        message: 'Are you sure you want to approve this account request?',
        title: 'Approve Account',
        confirmText: 'Approve',
        cancelText: 'Cancel',
        onConfirm: () => {
            const formData = new FormData();
            formData.append('action', 'approveUser');
            formData.append('requestId', requestId);

            // Show loading state
            showAlert('Processing approval...', 'info');

            fetch('admin_dashboard.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    let message = 'Account request approved successfully';
                    
                    // Add email status to the message
                    if (data.emailSent === true) {
                        message += ' and notification email was sent to the user';
                    } else if (data.emailSent === false) {
                        message += ' but the notification email failed to send';
                        console.error('Email error:', data.emailError);
                    }
                    
                    showAlert(message, 'success');
                    // Refresh both tables
                    loadAccountRequests(); // Refresh pending requests
                    loadUserRecords();     // Refresh approved users
                } else {
                    throw new Error(data.message || 'Failed to approve user');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert(error.message || 'Error approving request', 'danger');
            });
        }
    });
}

function rejectUserRequest(requestId) {
    // Create a dialog with checkboxes for rejection reasons
    const rejectionHTML = `
        <p>Are you sure you want to reject this user account request?</p>
        <div class="rejection-reasons mt-3">
            <p><strong>Reason for Rejection:</strong></p>
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="reason-credentials" name="rejection-reason" value="Invalid credentials provided">
                <label class="form-check-label" for="reason-credentials">Invalid credentials provided</label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="reason-department" name="rejection-reason" value="Rejected by department head">
                <label class="form-check-label" for="reason-department">Rejected by department head</label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="reason-certificate" name="rejection-reason" value="Submitted wrong certificate">
                <label class="form-check-label" for="reason-certificate">Submitted wrong certificate</label>
            </div>
            <div class="mt-2">
                <label for="reason-other">Other reason:</label>
                <input type="text" class="form-control" id="reason-other" placeholder="Specify other reason">
            </div>
        </div>
    `;
    
    showConfirmDialog({
        message: rejectionHTML,
        title: 'Reject User Request',
        confirmText: 'Reject',
        cancelText: 'Cancel',
        dialogType: 'danger',
        isHTML: true,
        onConfirm: () => {
            // Collect all checked reasons
            const checkedReasons = Array.from(document.querySelectorAll('input[name="rejection-reason"]:checked'))
                .map(checkbox => checkbox.value);
            
            // Add other reason if provided
            const otherReason = document.getElementById('reason-other').value;
            if (otherReason.trim()) {
                checkedReasons.push(otherReason);
            }
            
            // Create a string with all reasons
            const rejectionReason = checkedReasons.length > 0 
                ? checkedReasons.join('; ') 
                : 'No reason provided';
            
            // Submit form data
            const formData = new FormData();
            formData.append('action', 'rejectRequest');
            formData.append('requestId', requestId);
            formData.append('reason', rejectionReason);
            
            fetch('admin_dashboard.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('User request rejected!', 'success');
                    loadAccountRequests();
                } else {
                    showAlert(data.message || 'Error rejecting user request', 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Error rejecting user request', 'danger');
            });
        }
    });
}

function toggleUserStatus(userId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    
    if (isCurrentlyActive) {
        // For deactivation, use a dialog with checkboxes for reason
        const deactivationHTML = `
            <p>Are you sure you want to deactivate this user?</p>
            <div class="deactivation-reasons">
                <p><strong>Reason for Deactivation:</strong></p>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="reason-violation" name="deactivation-reason" value="Violation of terms and conditions">
                    <label class="form-check-label" for="reason-violation">Violation of terms and conditions</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="reason-admin" name="deactivation-reason" value="Administrative decision">
                    <label class="form-check-label" for="reason-admin">Administrative decision</label>
                </div>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="reason-requested" name="deactivation-reason" value="Requested account deactivation">
                    <label class="form-check-label" for="reason-requested">Requested account deactivation</label>
                </div>
                <div class="mt-2">
                    <label for="reason-other">Other Reason:</label>
                    <input type="text" class="form-control" id="reason-other" placeholder="Specify other reason">
                </div>
            </div>
        `;
        
        showConfirmDialog({
            message: deactivationHTML,
            title: 'Deactivate User',
            confirmText: 'Deactivate',
            cancelText: 'Cancel',
            dialogType: 'danger',
            isHTML: true,
            onConfirm: () => {
                // Collect all checked reasons
                const checkedReasons = Array.from(document.querySelectorAll('input[name="deactivation-reason"]:checked'))
                    .map(checkbox => checkbox.value);
                
                // Add other reason if provided
                const otherReason = document.getElementById('reason-other').value;
                if (otherReason.trim()) {
                    checkedReasons.push(otherReason);
                }
                
                // Create a string with all reasons
                const deactivationReason = checkedReasons.length > 0 
                    ? checkedReasons.join('; ') 
                    : 'No reason provided';
                
                const formData = new FormData();
                formData.append('action', 'toggleUserStatus');
                formData.append('userId', userId);
                formData.append('status', 'deactivated');
                formData.append('reason', deactivationReason);

                fetch('admin_dashboard.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlert(`User deactivated successfully`, 'success');
                        loadUserRecords(); // Refresh the user list
                    } else {
                        showAlert(data.message || `Error deactivating user`, 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert(`Error deactivating user`, 'danger');
                });
            }
        });
    } else {
        // For activation, use the standard confirmation dialog
        showConfirmDialog({
            message: `Are you sure you want to activate this user?`,
            title: 'Activate User',
            confirmText: 'Activate',
            cancelText: 'Cancel',
            dialogType: 'default',
            onConfirm: () => {
                const formData = new FormData();
                formData.append('action', 'toggleUserStatus');
                formData.append('userId', userId);
                formData.append('status', 'activated');

                fetch('admin_dashboard.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlert(`User activated successfully`, 'success');
                        loadUserRecords(); // Refresh the user list
                    } else {
                        showAlert(data.message || `Error activating user`, 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert(`Error activating user`, 'danger');
                });
            }
        });
    }
}

// View Certificate ------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {

    // Add certificate overlay to body
    const overlay = document.createElement('div');
    overlay.className = 'certificate-overlay';
    overlay.innerHTML = `
        <button class="close-button" onclick="closeCertificateOverlay()">
            <i class="fas fa-times"></i>
        </button>
        <img id="overlayImage" src="" alt="Certificate">
    `;
    document.body.appendChild(overlay);
});

function showCertificateOverlay(certificateUrl) {
    const overlay = document.querySelector('.certificate-overlay');
    const image = overlay.querySelector('#overlayImage');
    
    // Add debug logging
    console.log('Showing certificate with URL:', certificateUrl);
    
    // Add error handling for the image
    image.onerror = function() {
        console.error('Failed to load certificate image from path:', certificateUrl);
        showAlert('Failed to load certificate image', 'danger');
        closeCertificateOverlay();
    };
    
    // Set the image source
    image.src = certificateUrl;
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Add click event listener
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeCertificateOverlay();
        }
    };
}

function closeCertificateOverlay() {
    const overlay = document.querySelector('.certificate-overlay');
    overlay.classList.remove('show');
    
    // Restore body scrolling
    document.body.style.overflow = '';
}

// Add a function to view certificate for pending users
function viewPendingUserCertificate(certificateUrl) {
    if (!certificateUrl) {
        showAlert('No certificate available', 'warning');
        return;
    }
    
    // Add console log for debugging
    console.log('Viewing certificate with URL:', certificateUrl);
    
    showCertificateOverlay(certificateUrl);
}

// Add this function to view pending user details including certificate
function viewPendingUser(name, email, ID, userType, certificateUrl) {
    // Set basic user information
    document.getElementById('viewName').textContent = name || 'N/A';
    document.getElementById('viewEmail').textContent = email || 'N/A';
    document.getElementById('viewID').textContent = ID || 'N/A';
    
    // Set user type with appropriate styling
    const userTypeElement = document.getElementById('viewUserType');
    if (userType) {
        userTypeElement.textContent = userType;
        userTypeElement.className = `user-type ${userType.toLowerCase()}`;
    } else {
        userTypeElement.textContent = 'N/A';
        userTypeElement.className = '';
    }

    // Show/Hide certificate section based on user type
    const certificateSection = document.querySelector('.accordion.mb-3');
    const userTypeLower = userType ? userType.toLowerCase() : '';
    
    // Hide certificate for Coordinator, Dean, and Faculty
    if (userTypeLower === 'coordinator' || userTypeLower === 'dean' || userTypeLower === 'faculty') {
        certificateSection.style.display = 'none';
    } else {
        certificateSection.style.display = 'block';
    }

    // Show the modal
    const viewUserModal = new bootstrap.Modal(document.getElementById('viewUser'));
    viewUserModal.show();

    // Show certificate in overlay if available and user is not coordinator, dean, or faculty
    if (certificateUrl && certificateUrl !== 'undefined' && 
        !['coordinator', 'dean', 'faculty'].includes(userTypeLower)) {
        showCertificateOverlay(certificateUrl);
    }
}

// Global variables
let allDisapprovedUsers = [];
let filteredDisapprovedUsers = [];
let disapprovedRowsPerPage = 20;
let disapprovedCurrentPage = 0;

// Function to load disapproved users
function loadDisapprovedUsers() {
    // No see_all parameter - always filter by department
    const url = 'admin_dashboard.php?action=getDisapprovedUsers';
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Disapproved users data:', data);
            
            if (data.success) {
                allDisapprovedUsers = [];
                
                data.disapprovedUsers.forEach((user, index) => {
                    const row = {
                        index: index + 1,
                        name: user.name || '',
                        email: user.email || '',
                        ID: user.user_id || '',
                        userType: user.user_type ? user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1).toLowerCase() : '',
                        program: user.program || user.department || '',
                        certificate: user.certificate_url || '',
                        reject_reason: user.reject_reason || 'No reason provided',
                        is_old: user.is_old || false
                    };
                    
                    allDisapprovedUsers.push(row);
                });
                
                // Reset pagination to first page
                disapprovedCurrentPage = 0;
                
                // Apply current filter and render
                filterDisapprovedUsers();
            } else {
                showAlert('Error loading disapproved users: ' + (data.message || 'Unknown error'), 'danger');
            }
        })
        .catch(error => {
            console.error('Error loading disapproved users:', error);
            showAlert('Failed to load disapproved users', 'danger');
        });
}

// Function to filter disapproved users
function filterDisapprovedUsers() {
    const searchTerm = document.getElementById('disapprovedUserSearch').value.toLowerCase();
    const hideOldRejected = document.getElementById('hideOldRejectedCheckbox')?.checked || false;
    
    filteredDisapprovedUsers = allDisapprovedUsers.filter(record => {
        // First filter by search term
        const matchesSearch = Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
        
        // Then filter out old rejected users if the checkbox is checked
        const shouldInclude = matchesSearch && (!hideOldRejected || !record.is_old);
        
        return shouldInclude;
    });
    
    renderDisapprovedUsersTable();
    updateDisapprovedUsersPagination();
}

// Updated function to handle individual checkbox clicks in disapproved tab
function updateDisapprovedCheckboxes() {
    const table = document.getElementById('disapprovedUsersTable');
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
    const selectAllCheckbox = document.getElementById('selectAllDisapproved');
    const deleteButton = document.getElementById('deleteDisapprovedBtn');
    
    // Update "select all" checkbox state
    if (checkboxes.length > 0) {
        selectAllCheckbox.checked = Array.from(checkboxes).every(cb => cb.checked);
    } else {
        selectAllCheckbox.checked = false;
    }
    
    // Show/hide delete button based on any checkbox being checked
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    deleteButton.style.display = anyChecked ? 'inline-block' : 'none';
    
    // Log for debugging
    console.log('Any checked:', anyChecked);
    console.log('Delete button display:', deleteButton.style.display);
}

// Update the function to toggle all checkboxes
function toggleAllDisapproved(checkbox) {
    const table = document.getElementById('disapprovedUsersTable');
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
    const deleteButton = document.getElementById('deleteDisapprovedBtn');
    
    checkboxes.forEach(cb => {
        cb.checked = checkbox.checked;
    });
    
    // Show/hide delete button
    deleteButton.style.display = checkbox.checked && checkboxes.length > 0 ? 'inline-block' : 'none';
    
    // Log for debugging
    console.log('Toggle all to:', checkbox.checked);
    console.log('Delete button display:', deleteButton.style.display);
}

// Updated function for rendering disapproved users table
function renderDisapprovedUsersTable() {
    const tbody = document.querySelector('#disapprovedUsersTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredDisapprovedUsers.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7; // Updated to account for removed delete column
        cell.className = 'text-center';
        cell.textContent = 'No disapproved users found';
        return;
    }
    
    // Calculate pagination
    const startIndex = disapprovedCurrentPage * disapprovedRowsPerPage;
    const endIndex = Math.min(startIndex + disapprovedRowsPerPage, filteredDisapprovedUsers.length);
    const paginatedRecords = filteredDisapprovedUsers.slice(startIndex, endIndex);
    
    // Render rows
    paginatedRecords.forEach(record => {
        const row = tbody.insertRow();
        
        // Checkbox cell
        const checkboxCell = row.insertCell();
        checkboxCell.className = 'text-center';
        checkboxCell.innerHTML = `<input type="checkbox" onchange="updateDisapprovedCheckboxes()">`;
        
        // Name cell
        const nameCell = row.insertCell();
        nameCell.className = 'text-center';
        nameCell.textContent = record.name;
        nameCell.title = record.name;
        nameCell.style.cursor = 'pointer';
        nameCell.onclick = () => copyToClipboard(record.name);
        
        // Email cell
        const emailCell = row.insertCell();
        emailCell.className = 'text-center';
        emailCell.textContent = record.email;
        emailCell.title = record.email;
        emailCell.style.cursor = 'pointer';
        emailCell.onclick = () => copyToClipboard(record.email);
        
        // ID cell
        const idCell = row.insertCell();
        idCell.className = 'text-center';
        idCell.textContent = record.ID;
        idCell.title = record.ID;
        idCell.style.cursor = 'pointer';
        idCell.onclick = () => copyToClipboard(record.ID);
        
        // User Type cell
        const typeCell = row.insertCell();
        typeCell.className = 'text-center';
        const userTypeClass = record.userType.toLowerCase();
        typeCell.innerHTML = `<span class="user-type ${userTypeClass}">${record.userType}</span>`;
        
        // Program cell
        const programCell = row.insertCell();
        programCell.className = 'text-center';
        programCell.textContent = record.program;
        
        // Reason cell
        const reasonCell = row.insertCell();
        reasonCell.className = 'text-center';
        reasonCell.innerHTML = `<button class="btn btn-sm btn-outline-secondary view-reason-btn" onclick="viewRejectionReason('${record.name}', '${record.email}', '${record.ID}', '${record.userType}', '${encodeURIComponent(record.reject_reason || 'No reason provided')}')">
            <i class="fas fa-eye"></i> View
        </button>`;
    });
    
    // Make sure to update the select all checkbox state
    updateDisapprovedCheckboxes();
}

// Update the HTML for the select all checkbox
document.addEventListener('DOMContentLoaded', function() {
    const selectAllCheckbox = document.getElementById('selectAllDisapproved');
    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = function() {
            toggleAllDisapproved(this);
        };
    }
});

// Function to delete selected disapproved users
function deleteSelectedDisapprovedUsers() {
    const table = document.getElementById('disapprovedUsersTable');
    const selectedRows = table.querySelectorAll('tbody tr input[type="checkbox"]:checked');
    
    if (selectedRows.length === 0) {
        showAlert('Please select users to delete', 'warning');
        return;
    }
    
    showConfirmDialog({
        message: `Are you sure you want to delete ${selectedRows.length} disapproved user(s)? This action cannot be undone.`,
        title: 'Delete Disapproved Users',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        dialogType: 'danger',
        onConfirm: () => {
            // Collect all user IDs to delete
            const userIds = Array.from(selectedRows).map(checkbox => {
                const row = checkbox.closest('tr');
                return row.cells[3].textContent.trim(); // ID is in the 4th column (index 3)
            });
            
            // Send deletion request
            fetch('admin_dashboard.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'deleteDisapprovedUsers',
                    userIds: userIds
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert(`Successfully deleted ${data.deleted} user(s)`, 'success');
                    loadDisapprovedUsers(); // Refresh the list
                } else {
                    showAlert(data.message || 'Error deleting users', 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Error deleting users', 'danger');
            });
        }
    });
}

// Function to update pagination for disapproved users
function updateDisapprovedUsersPagination() {
    const paginationContainer = document.getElementById('disapprovedUsersTablePagination');
    if (!paginationContainer) return;
    
    const disapprovedTotalPages = Math.max(1, Math.ceil(filteredDisapprovedUsers.length / disapprovedRowsPerPage));
    
    let paginationHTML = '';
    
    // Previous button with icon
    paginationHTML += `<button class="page-btn ${disapprovedCurrentPage === 0 ? 'disabled' : ''}" onclick="changePagination('disapprovedUsersTable', ${disapprovedCurrentPage - 1})" ${disapprovedCurrentPage === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
    
    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(0, disapprovedCurrentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(disapprovedTotalPages - 1, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === disapprovedCurrentPage ? 'active bg-dark text-white' : ''}" onclick="changePagination('disapprovedUsersTable', ${i})">${i + 1}</button>`;
    }
    
    // Next button with icon
    paginationHTML += `<button class="page-btn ${disapprovedCurrentPage === disapprovedTotalPages - 1 ? 'disabled' : ''}" onclick="changePagination('disapprovedUsersTable', ${disapprovedCurrentPage + 1})" ${disapprovedCurrentPage === disapprovedTotalPages - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
    
    paginationContainer.innerHTML = paginationHTML;
}

// Function to change pagination page for disapproved users
function changePagination(tableId, page) {
    if (tableId === 'disapprovedUsersTable') {
        // Validate page number
        const totalPages = Math.ceil(filteredDisapprovedUsers.length / disapprovedRowsPerPage);
        if (page < 0 || page >= totalPages) return;
        
        disapprovedCurrentPage = page;
        renderDisapprovedUsersTable();
        updateDisapprovedUsersPagination();
    } else if (tableId === 'deactivatedUsersTable') {
        deactivatedCurrentPage = page;
        renderDeactivatedUsersTable();
        updateDeactivatedUsersPagination();
    }
}

// Function to refresh disapproved users
function refreshDisapprovedUsers() {
    showAlert('Refreshing disapproved users...', 'info');
    document.getElementById('disapprovedUserSearch').value = '';
    loadDisapprovedUsers();
}

// Function to export disapproved users
function exportDisapprovedUsers() {
    const headers = ['Name', 'Email', 'ID', 'User Type', 'Program', 'Certificate'];
    const data = filteredDisapprovedUsers.map(user => [
        user.name,
        user.email,
        user.ID,
        user.userType,
        user.program,
        user.certificate ? 'Yes' : 'No'
    ]);
    
    downloadCSV(headers, data, 'disapproved_users.csv');
}

/* ROWS PER PAGE FUNCTION (ISSUE)

 // Function to change rows per page
 function changeRowsPerPage(tableId, value) {
     if (tableId === 'disapprovedUsersTable') {
         disapprovedRowsPerPage = parseInt(value);
         disapprovedCurrentPage = 0; // Reset to first page
         renderDisapprovedUsersTable();
         updateDisapprovedUsersPagination();
     } else if (tableId === 'deactivatedUsersTable') {
         deactivatedRowsPerPage = parseInt(value);
         deactivatedCurrentPage = 0; // Reset to first page
         renderDeactivatedUsersTable();
         updateDeactivatedUsersPagination();
     }
 }
*/


// Add event listener for the tab
document.addEventListener('DOMContentLoaded', function() {
    const disapprovedTab = document.getElementById('disapproved-users-tab');
    if (disapprovedTab) {
        disapprovedTab.addEventListener('shown.bs.tab', function() {
            loadDisapprovedUsers();
            
            // Add "Hide Old Rejected" checkbox if it doesn't exist yet
            const filterContainer = document.querySelector('#disapproved-users-container .filter-controls');
            if (filterContainer && !document.getElementById('hideOldRejectedCheckbox')) {
                const hideOldCheckbox = document.createElement('div');
                hideOldCheckbox.className = 'form-check ms-3';
                hideOldCheckbox.innerHTML = `
                    <input class="form-check-input" type="checkbox" id="hideOldRejectedCheckbox" checked>
                    <label class="form-check-label" for="hideOldRejectedCheckbox">
                        Hide users rejected over 6 months ago
                    </label>
                `;
                filterContainer.appendChild(hideOldCheckbox);
                
                // Add event listener for the checkbox
                document.getElementById('hideOldRejectedCheckbox').addEventListener('change', filterDisapprovedUsers);
            }
        });
    }
});

// Define the program options for each department
const userDepartmentPrograms = {
    'CICS': [
        { value: 'bsit', label: 'BSIT' },
        { value: 'bscs', label: 'BSCS' },
        { value: 'bsis', label: 'BSIS' },
        { value: 'blis', label: 'BLIS' }
    ],
    'CAS': [
        { value: 'ba_econ', label: 'BA Econ' },
        { value: 'ba_polsci', label: 'BA PolSci' },
        { value: 'bs_psych', label: 'BS Psych' },
        { value: 'bpa', label: 'BPA' }
    ],
    'CEA': [
        { value: 'bsce', label: 'BSCE' },
        { value: 'bsee', label: 'BSEE' },
        { value: 'bsme', label: 'BSME' },
        { value: 'bs_arch', label: 'BS Arch' }
    ]
};

// Function to update program filter options based on department
function updateUserProgramFilterOptions(department) {
    const dropdown = document.getElementById('userProgramFilterDropdown');
    if (!dropdown) return;
    
    // Clear existing program options (keep divider and See All Programs)
    const dividerIndex = Array.from(dropdown.children).findIndex(child => child.className === 'dropdown-divider');
    if (dividerIndex >= 0) {
        // Remove all elements before the divider
        while (dividerIndex > 0) {
            dropdown.removeChild(dropdown.firstChild);
            dividerIndex--;
        }
    }
    
    // Get program options for the department
    const programs = userDepartmentPrograms[department] || userDepartmentPrograms['CICS'];
    
    // Add program options at the beginning of the dropdown
    programs.forEach(program => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = program.value;
        
        // Add event listener to checkbox
        checkbox.addEventListener('change', function() {
            // Uncheck "See All Programs" when any individual program is checked
            const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
            if (seeAllCheckbox && seeAllCheckbox.checked && this.checked) {
                seeAllCheckbox.checked = false;
            }
            
            if (this.checked && filterState.users.program.size >= 3) {
                this.checked = false;
                showAlert('Maximum 3 programs can be selected', 'warning');
                return;
            }
            
            if (this.checked) {
                filterState.users.program.add(this.value);
            } else {
                filterState.users.program.delete(this.value);
            }
            
            updateFilterCount(this.closest('.dropdown-filter'), filterState.users.program.size);
            applyUserFilters();
        });
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + program.label));
        
        // Insert at the beginning of the dropdown
        dropdown.insertBefore(label, dropdown.firstChild);
    });
}

// Setup See All Programs option for users
function setupSeeAllUserProgramsHandler() {
    const seeAllProgramsCheckbox = document.getElementById('seeAllUserPrograms');
    if (seeAllProgramsCheckbox) {
        seeAllProgramsCheckbox.addEventListener('change', function() {
            // Update filter count badge
            updateFilterCount(this.closest('.dropdown-filter'), this.checked ? 1 : 0);
            
            // Only clear other program filters when checking "See All Programs"
            if (this.checked) {
                document.querySelectorAll('#userProgramFilterDropdown input[type="checkbox"]:not([value="see_all"])').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Clear the program filter set
                filterState.users.program.clear();
            }
            
            // Force a reload of user records from the server with appropriate see_all parameter
            loadUserRecords(this.checked);
        });
    }
}

// This file handles the department-based filtering for User Records

// Function to initialize the department filter based on the logged-in user's department
function initUserDepartmentFilter(userDepartment) {
    // Get references to the department checkboxes
    const cicsCheckbox = document.querySelector('#userDepartmentFilterDropdown [value="CICS"]');
    const casCheckbox = document.querySelector('#userDepartmentFilterDropdown [value="CAS"]');
    const ceaCheckbox = document.querySelector('#userDepartmentFilterDropdown [value="CEA"]');
    
    // Check if we have a valid department to auto-select
    if (userDepartment && (userDepartment === 'CICS' || userDepartment === 'CAS' || userDepartment === 'CEA')) {
        const checkboxToSelect = document.querySelector(`#userDepartmentFilterDropdown [value="${userDepartment}"]`);
        
        if (checkboxToSelect) {
            // Automatically check the checkbox that matches the user's department
            checkboxToSelect.checked = true;
            
            // Add the department to the filter state
            filterState.users.department.add(userDepartment);
            
            // Update the filter count badge
            const dropdown = checkboxToSelect.closest('.dropdown-filter');
            updateFilterCount(dropdown, 1);
            
            // Uncheck "See All Programs" if it's checked
            const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
            if (seeAllCheckbox && seeAllCheckbox.checked) {
                seeAllCheckbox.checked = false;
            }
        }
    } else {
        // If no specific department, check "See All Programs" by default
        const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
        if (seeAllCheckbox) {
            seeAllCheckbox.checked = true;
            
            // Update the filter count badge
            const dropdown = seeAllCheckbox.closest('.dropdown-filter');
            updateFilterCount(dropdown, 1);
        }
    }
}

// Set up event handlers for department checkboxes
function setupDepartmentFilterHandlers() {
    // Department filter checkboxes
    document.querySelectorAll('#userDepartmentFilterDropdown [value="CICS"], #userDepartmentFilterDropdown [value="CAS"], #userDepartmentFilterDropdown [value="CEA"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Uncheck "See All Programs" when any department is checked
            const seeAllCheckbox = document.getElementById('seeAllUserPrograms');
            if (seeAllCheckbox && seeAllCheckbox.checked && this.checked) {
                seeAllCheckbox.checked = false;
            }
            
            if (this.checked) {
                filterState.users.department.add(this.value);
            } else {
                filterState.users.department.delete(this.value);
            }
            
            updateFilterCount(this.closest('.dropdown-filter'), filterState.users.department.size);
            applyUserFilters();
        });
    });
    
    // See All Programs option
    const seeAllProgramsCheckbox = document.getElementById('seeAllUserPrograms');
    if (seeAllProgramsCheckbox) {
        seeAllProgramsCheckbox.addEventListener('change', function() {
            // Update filter count badge
            updateFilterCount(this.closest('.dropdown-filter'), this.checked ? 1 : 0);
            
            // Only clear other department filters when checking "See All Programs"
            if (this.checked) {
                document.querySelectorAll('#userDepartmentFilterDropdown [value="CICS"], #userDepartmentFilterDropdown [value="CAS"], #userDepartmentFilterDropdown [value="CEA"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Clear the department filter set
                filterState.users.department.clear();
            }
            
            // Force a reload of user records from the server with appropriate see_all parameter
            loadUserRecords(this.checked);
        });
    }
}

// Add a function to map program codes to readable names
function getProgramDisplayName(programCode) {
    const programMap = {
        // CICS
        'bsit': 'BSIT',
        'bscs': 'BSCS',
        'bsis': 'BSIS',
        'blis': 'BLIS',
        
        // CAS
        'ba_econ': 'BA Econ',
        'ba_polsci': 'BA PolSci',
        'bs_psych': 'BS Psych',
        'bpa': 'BPA',
        
        // CEA
        'bsce': 'BSCE',
        'bsee': 'BSEE',
        'bsme': 'BSME',
        'bs_arch': 'BS Arch'
    };
    
    // Special cases
    if (programCode === 'All Programs') return 'All Programs';
    if (programCode === '-') return '-';
    
    return programMap[programCode.toLowerCase()] || programCode;
}

// Global variables for deactivated users
let allDeactivatedUsers = [];
let filteredDeactivatedUsers = [];
let deactivatedRowsPerPage = 20;
let deactivatedCurrentPage = 0;

// Function to load deactivated users
function loadDeactivatedUsers() {
    const url = 'admin_dashboard.php?action=getDeactivatedUsers';
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log('Deactivated users data:', data);
            
            if (data.success) {
                allDeactivatedUsers = [];
                
                data.deactivatedUsers.forEach((user, index) => {
                    const row = {
                        index: index + 1,
                        name: user.name || '',
                        email: user.email || '',
                        ID: user.user_id || '',
                        userType: user.user_type ? user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1).toLowerCase() : '',
                        program: user.program || user.department || '',
                        reason: user.deactivation_reason || 'No reason provided',
                        created_at: user.created_at || '',
                        certificate_url: user.certificate_url || '',
                        created_by: user.created_by || ''
                    };
                    
                    allDeactivatedUsers.push(row);
                });
                
                // Reset pagination to first page
                deactivatedCurrentPage = 0;
                
                // Apply current filter and render
                filterDeactivatedUsers();
            } else {
                showAlert('Error loading deactivated users: ' + (data.message || 'Unknown error'), 'danger');
            }
        })
        .catch(error => {
            console.error('Error loading deactivated users:', error);
            showAlert('Failed to load deactivated users', 'danger');
        });
}

// Function to filter deactivated users
function filterDeactivatedUsers() {
    const searchTerm = document.getElementById('deactivatedUserSearch').value.toLowerCase();
    
    filteredDeactivatedUsers = allDeactivatedUsers.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    
    renderDeactivatedUsersTable();
    updateDeactivatedUsersPagination();
}

// Function to render the deactivated users table
function renderDeactivatedUsersTable() {
    const tbody = document.querySelector('#deactivatedUsersTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredDeactivatedUsers.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.className = 'text-center';
        cell.textContent = 'No deactivated users found';
        return;
    }
    
    // Calculate pagination
    const startIndex = deactivatedCurrentPage * deactivatedRowsPerPage;
    const endIndex = Math.min(startIndex + deactivatedRowsPerPage, filteredDeactivatedUsers.length);
    const paginatedRecords = filteredDeactivatedUsers.slice(startIndex, endIndex);
    
    // Render rows
    paginatedRecords.forEach(record => {
        const row = tbody.insertRow();
        
        // Name cell
        const nameCell = row.insertCell();
        nameCell.className = 'text-center';
        nameCell.textContent = record.name;
        nameCell.title = record.name;
        nameCell.style.cursor = 'pointer';
        nameCell.onclick = () => copyToClipboard(record.name);
        
        // Email cell
        const emailCell = row.insertCell();
        emailCell.className = 'text-center';
        emailCell.textContent = record.email;
        emailCell.title = record.email;
        emailCell.style.cursor = 'pointer';
        emailCell.onclick = () => copyToClipboard(record.email);
        
        // ID cell
        const idCell = row.insertCell();
        idCell.className = 'text-center';
        idCell.textContent = record.ID;
        idCell.title = record.ID;
        idCell.style.cursor = 'pointer';
        idCell.onclick = () => copyToClipboard(record.ID);
        
        // User Type cell
        const typeCell = row.insertCell();
        typeCell.className = 'text-center';
        const userTypeClass = record.userType.toLowerCase();
        typeCell.innerHTML = `<span class="user-type ${userTypeClass}">${record.userType}</span>`;
        
        // Program cell
        const programCell = row.insertCell();
        programCell.className = 'text-center';
        programCell.textContent = record.program;
        
        // Reason cell
        const reasonCell = row.insertCell();
        reasonCell.className = 'text-center';
        reasonCell.innerHTML = `<button class="btn btn-sm btn-outline-secondary view-reason-btn" onclick="viewDeactivationReason('${record.name}', '${record.email}', '${record.ID}', '${record.userType}', '${record.created_at}', '${record.certificate_url || ''}', '${record.created_by}', '${encodeURIComponent(record.reason)}')">
            <i class="fas fa-eye"></i> View
        </button>`;
        
        // Actions cell
        const actionsCell = row.insertCell();
        actionsCell.className = 'text-center';
        actionsCell.innerHTML = `
            <button class="btn btn-sm btn-outline-success" style="border-radius: 8px;" onclick="reactivateUser('${record.ID}')">
                <i class="fas fa-sync-alt"></i> Activate
            </button>`;
    });
}

// Function to update pagination for deactivated users
function updateDeactivatedUsersPagination() {
    const paginationContainer = document.getElementById('deactivatedUsersTablePagination');
    if (!paginationContainer) return;
    
    const deactivatedTotalPages = Math.max(1, Math.ceil(filteredDeactivatedUsers.length / deactivatedRowsPerPage));
    
    let paginationHTML = '';
    
    // Previous button with icon
    paginationHTML += `<button class="page-btn ${deactivatedCurrentPage === 0 ? 'disabled' : ''}" onclick="changePagination('deactivatedUsersTable', ${deactivatedCurrentPage - 1})" ${deactivatedCurrentPage === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>`;
    
    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(0, deactivatedCurrentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(deactivatedTotalPages - 1, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="page-btn ${i === deactivatedCurrentPage ? 'active bg-dark text-white' : ''}" onclick="changePagination('deactivatedUsersTable', ${i})">${i + 1}</button>`;
    }
    
    // Next button with icon
    paginationHTML += `<button class="page-btn ${deactivatedCurrentPage === deactivatedTotalPages - 1 ? 'disabled' : ''}" onclick="changePagination('deactivatedUsersTable', ${deactivatedCurrentPage + 1})" ${deactivatedCurrentPage === deactivatedTotalPages - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>`;
    
    paginationContainer.innerHTML = paginationHTML;
}



// Function to refresh deactivated users
function refreshDeactivatedUsers() {
    showAlert('Refreshing deactivated users...', 'info');
    
    // Clear search input
    document.getElementById('deactivatedUserSearch').value = '';
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#deactivatedUsersTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Load fresh data
    loadDeactivatedUsers();
}

// Function to export deactivated users to CSV
function exportDeactivatedUsers() {
    if (filteredDeactivatedUsers.length === 0) {
        showAlert('No deactivated users to export', 'warning');
        return;
    }
    
    const headers = ['Name', 'Email', 'ID', 'User Type', 'Program', 'Deactivation Reason'];
    const data = filteredDeactivatedUsers.map(user => [
        user.name,
        user.email,
        user.ID,
        user.userType,
        user.program,
        user.reason
    ]);
    
    downloadCSV(headers, data, 'deactivated_users.csv');
}

// Function to view deactivated user details
function viewDeactivatedUser(name, email, ID, userType, creationDate, certificateUrl, createdBy, reason) {
    // Set basic user information
    document.getElementById('viewName').textContent = name || 'N/A';
    document.getElementById('viewEmail').textContent = email || 'N/A';
    document.getElementById('viewID').textContent = ID || 'N/A';
    document.getElementById('viewCreationDate').textContent = creationDate ? new Date(creationDate).toLocaleString() : 'N/A';
    document.getElementById('viewCreatedBy').textContent = createdBy || 'N/A';
    
    // Add deactivation reason if available
    let deactivationInfo = '';
    if (reason) {
        deactivationInfo = `<div class="view-row">
            <strong>Deactivation Reason:</strong>
            <span class="text-danger">${reason}</span>
        </div>`;
    }
    
    // Add the deactivation reason to the modal if the element exists
    const extraInfoContainer = document.getElementById('viewExtraInfo');
    if (extraInfoContainer) {
        extraInfoContainer.innerHTML = deactivationInfo;
    }
    
    // Set user type with appropriate styling
    const userTypeElement = document.getElementById('viewUserType');
    if (userTypeElement) {
        userTypeElement.textContent = userType;
        userTypeElement.className = `user-type ${userType.toLowerCase()}`;
    }

    // Show/Hide certificate section based on user type
    const certificateSection = document.querySelector('.accordion.mb-3');
    const userTypeLower = userType ? userType.toLowerCase() : '';
    
    // Hide certificate for Coordinator, Dean, and Faculty
    if (userTypeLower === 'coordinator' || userTypeLower === 'dean' || userTypeLower === 'faculty') {
        certificateSection.style.display = 'none';
    } else {
        certificateSection.style.display = 'block';
        
        // Show certificate button if available for student/alumni
        if (certificateUrl && certificateUrl !== 'undefined' && certificateUrl !== 'null') {
            document.getElementById('viewCertificateBtn').style.display = 'inline-block';
            document.getElementById('viewCertificateBtn').onclick = () => showCertificateOverlay(certificateUrl);
        } else {
            document.getElementById('viewCertificateBtn').style.display = 'none';
        }
    }

    // Show the modal
    const viewUserModal = new bootstrap.Modal(document.getElementById('viewUser'));
    viewUserModal.show();
}

// Function to reactivate a user
function reactivateUser(userId) {
    showConfirmDialog({
        message: 'Are you sure you want to reactivate this user?',
        title: 'Reactivate User',
        confirmText: 'Reactivate',
        cancelText: 'Cancel',
        onConfirm: () => {
            const formData = new FormData();
            formData.append('action', 'toggleUserStatus');
            formData.append('userId', userId);
            formData.append('status', 'activated');

            fetch('admin_dashboard.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('User reactivated successfully', 'success');
                    loadDeactivatedUsers(); // Refresh deactivated users list
                    loadUserRecords();      // Also refresh main user records
                } else {
                    showAlert(data.message || 'Error reactivating user', 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Error reactivating user', 'danger');
            });
        }
    });
}

// Function to view deactivation reason in a modal
function viewDeactivationReason(name, email, ID, userType, creationDate, certificateUrl, createdBy, reason) {
    // Decode the URL-encoded reason
    const decodedReason = decodeURIComponent(reason);
    
    // Format the reason as a bullet list
    let formattedReason = '';
    if (decodedReason && decodedReason !== 'No reason provided') {
        // Split by semicolons and create bullet points
        const reasons = decodedReason.split(';').map(r => r.trim()).filter(r => r);
        if (reasons.length > 0) {
            formattedReason = reasons.map(r => `<li>${r}</li>`).join('');
            formattedReason = `<ul>${formattedReason}</ul>`;
        } else {
            formattedReason = decodedReason;
        }
    } else {
        formattedReason = 'No reason provided';
    }
    
    // Create modal HTML
    const modalHTML = `
    <div class="modal fade" id="reasonModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Deactivation Reason</h5>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <strong>User:</strong> ${name} (${ID})
                </div>
                    <div class="deactivation-reason-container p-3 border rounded">
                        ${formattedReason}
                </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>`;

    // Remove any existing modals with the same ID
    const existingModal = document.getElementById('reasonModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add the modal to the document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show the modal
    const reasonModal = new bootstrap.Modal(document.getElementById('reasonModal'));
    reasonModal.show();
    
    // Clean up when the modal is hidden
    document.getElementById('reasonModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Add initialization for deactivated users tab
document.addEventListener('DOMContentLoaded', function() {
    // Set up deactivated tab functionality
    const deactivatedTab = document.getElementById('deactivated-users-tab');
    if (deactivatedTab) {
        deactivatedTab.addEventListener('click', function() {
            if (allDeactivatedUsers.length === 0) {
                loadDeactivatedUsers();
            }
        });
    }
    
    // Initial load of data for active tab
    const activeTabId = document.querySelector('#userSubTabs .nav-link.active')?.getAttribute('aria-controls');
    if (activeTabId === 'deactivated-users') {
        loadDeactivatedUsers();
    }
});

// Function to view rejection reason in a modal
function viewRejectionReason(name, email, ID, userType, reason) {
    // Decode the URL-encoded reason
    const decodedReason = decodeURIComponent(reason);
    
    // Format the reason as a bullet list
    let formattedReason = '';
    if (decodedReason && decodedReason !== 'No reason provided') {
        // Split by semicolons and create bullet points
        const reasons = decodedReason.split(';').map(r => r.trim()).filter(r => r);
        if (reasons.length > 0) {
            formattedReason = reasons.map(r => `<li>${r}</li>`).join('');
            formattedReason = `<ul>${formattedReason}</ul>`;
        } else {
            formattedReason = decodedReason;
        }
    } else {
        formattedReason = 'No reason provided';
    }
    
    // Create modal HTML
    const modalHTML = `
    <div class="modal fade" id="reasonModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Rejection Reason</h5>
                </div>
                <div class="modal-body">
                    <div class="mb-3">
                        <strong>User:</strong> ${name} (${ID})
                    </div>
                    <div class="rejection-reason-container p-3 border rounded">
                        ${formattedReason}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>`;

    // Remove any existing modals with the same ID
    const existingModal = document.getElementById('reasonModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add the modal to the document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show the modal
    const reasonModal = new bootstrap.Modal(document.getElementById('reasonModal'));
    reasonModal.show();
    
    // Clean up when the modal is hidden
    document.getElementById('reasonModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
}

// Initialize user type column sorting
document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers for user type column headers in all relevant tables
    const userTypeHeaders = {
        'userRecordsTable': 4, // 4th column is user type
        'accountRequestsTable': 4, // 4th column is user type
        'disapprovedUsersTable': 4, // 4th column is user type
        'deactivatedUsersTable': 4  // 4th column is user type
    };
    
    Object.entries(userTypeHeaders).forEach(([tableId, columnIndex]) => {
        const headerCell = document.querySelector(`#${tableId} th:nth-child(${columnIndex + 1})`);
        if (headerCell) {
            headerCell.addEventListener('click', function() {
                sortTable(tableId, columnIndex);
            });
            
            // Add sorting indicator and cursor style
            headerCell.style.cursor = 'pointer';
            if (!headerCell.querySelector('span')) {
                const span = document.createElement('span');
                span.id = `${tableId}Header${columnIndex}`;
                headerCell.appendChild(span);
            }
        }
    });
});