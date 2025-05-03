//**Users and Account Requests Functions !!!!!!!!!!!!!!!


// Users ----------------------------------------------------------------------------------------------
function loadUserRecords() {
    fetch('admin_dashboard.php?action=getApprovedUsers')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received user records:', data);
            if (data.success) {
                const userRecordsTable = document.getElementById('userRecordsTable').getElementsByTagName('tbody')[0];
                userRecordsTable.innerHTML = '';
                allUserRecords = [];
                
                data.approvedUsers.forEach((user, index) => {
                    // Format user type to capitalize first letter
                    const userType = user.user_type ? 
                        user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1).toLowerCase() : '';
                    
                    const row = {
                        index: index + 1,
                        name: user.name || '',
                        email: user.email || '',
                        ID: user.user_id || '',
                        userType: userType,
                        requests: user.requests || 0,
                        created_at: user.created_at || '',
                        certificate_url: user.certificate_url || '',
                        account_status: user.account_status || 'activated'
                    };
                    
                    // Ensure all fields are strings for consistent filtering
                    Object.keys(row).forEach(key => {
                        if (key !== 'certificate_url') {
                            row[key] = String(row[key]);
                        }
                    });
                    allUserRecords.push(row);
                });

                renderTable('userRecordsTable', allUserRecords);
            } else {
                console.error('Failed to load users:', data.message);
                showAlert('Failed to load user records: ' + data.message, 'danger');
            }
        })
        .catch(error => {
            console.error('Error loading user records:', error);
            showAlert('Failed to load user records. Check console for details.', 'danger');
        });
}


function filterUserRecords() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    
    // Apply filters first
    filteredUserRows = allUserRecords.filter(record => {
        // Search term filter
        const matchesSearch = Object.values(record).some(value => 
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






// Initialize filters when the page loads
document.addEventListener('DOMContentLoaded', function() {
    setupUserFilters();
});

function refreshUserRecords() {
    showAlert('Refreshing user records...', 'info');
    
    // Reset user filters
    filterState.users = {
        userType: new Set(),
        status: '',
        withRequests: false
    };
    
    // Reset checkboxes and radio buttons
    document.querySelectorAll('[value="student"], [value="alumni"], [value="faculty"]').forEach(checkbox => {
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
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#userRecordsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredUserRows = [];
    
    // Load user records and update stats
    fetch('admin_dashboard.php?action=getApprovedUsers')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update user records
                allUserRecords = [];
                data.approvedUsers.forEach((user, index) => {
                    const userType = user.user_type ? 
                        user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1).toLowerCase() : '';
                    
                    const row = {
                        index: index + 1,
                        name: user.name || '',
                        email: user.email || '',
                        ID: user.user_id || '',
                        userType: userType,
                        requests: user.requests || 0,
                        created_at: user.created_at || '',
                        certificate_url: user.certificate_url || '',
                        account_status: user.account_status || 'activated'
                    };
                    
                    Object.keys(row).forEach(key => {
                        if (key !== 'certificate_url') {
                            row[key] = String(row[key]);
                        }
                    });
                    allUserRecords.push(row);
                });

                renderTable('userRecordsTable', allUserRecords);
                
                // Also refresh other stats that might depend on user data
                loadChartData(); // This will update any charts that show user-related data
            } else {
                throw new Error(data.message || 'Failed to refresh user records');
            }
        })
        .catch(error => {
            console.error('Error refreshing user records:', error);
            showAlert('Failed to refresh user records: ' + error.message, 'danger');
        });
}






function viewUser(name, email, ID, userType, creationDate, certificateURL) {
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
    
    document.getElementById('viewCreationDate').textContent = creationDate || 'Not available';

    // Show/Hide certificate section based on user type
    const certificateSection = document.querySelector('.accordion.mb-3');
    if (userType.toLowerCase() === 'faculty') {
        certificateSection.style.display = 'none';
    } else {
        certificateSection.style.display = 'block';
    const certificateImage = document.getElementById('certificateImage');
    if (certificateURL && certificateURL !== 'undefined') {
        certificateImage.src = certificateURL;
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
    // First get the total user count by fetching both approved and pending users
    Promise.all([
        fetch('admin_dashboard.php?action=getApprovedUsers'),
        fetch('admin_dashboard.php?action=getPendingUsers')
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([approvedData, pendingData]) => {
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
                    certificateURL: user.certificate_url || '',
                    requestId: user.requestId || ''
                };
                allAccountRequests.push(row);
            });

            // Update total user count in dashboard (approved + pending)
            const totalUsers = (approvedData.success ? approvedData.approvedUsers.length : 0) + 
                             allAccountRequests.length;
            
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

    if (confirm('Are you sure you want to approve this account request?')) {
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
                showAlert('Account request approved successfully', 'success');
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
}

function rejectUserRequest(requestId) {
    if (confirm('Are you sure you want to reject this account request?')) {
        const formData = new FormData();
        formData.append('action', 'rejectUser');
        formData.append('requestId', requestId);

        fetch('admin_dashboard.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Account request rejected successfully', 'success');
                loadAccountRequests(); // Refresh the requests list
            } else {
                showAlert(data.message || 'Error rejecting request', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error rejecting request', 'danger');
        });
    }
}






function toggleUserStatus(userId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
        const formData = new FormData();
        formData.append('action', 'toggleUserStatus');
        formData.append('userId', userId);
        formData.append('status', isCurrentlyActive ? 'deactivated' : 'activated');

        fetch('admin_dashboard.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(`User ${action}d successfully`, 'success');
                loadUserRecords(); // Refresh the user list
            } else {
                showAlert(data.message || `Error ${action}ing user`, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert(`Error ${action}ing user`, 'danger');
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

function showCertificateOverlay(certificateURL) {
    const overlay = document.querySelector('.certificate-overlay');
    const image = overlay.querySelector('#overlayImage');
    
    image.src = certificateURL;
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Add click event listener
    overlay.onclick = (e) => {
        // Close only if clicking the dark overlay, not the image
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
