//**Document Request Functions !!!!!!!!!!!!!!!


// Doc Requests ----------------------------------------------------------------------------------------------
function loadDocRequests() {
    fetch('admin_dashboard.php?action=getDocRequests')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allDocRequests = [];
                
                data.requests.forEach((request, index) => {
                    // Check if the request is expired (24 hours old)
                    const isExpired = request.status === 'reserved' && 
                        new Date(request.date_released) < new Date(Date.now() - 24 * 60 * 60 * 1000);
                    
                    if (isExpired) {
                        // This will be cleaned up in the next checkExpiredReservations call
                        return;
                    }
                    
                    const row = {
                        index: index + 1,
                        referenceNo: request.reference_no || '',
                        docId: request.document_id || '',
                        title: request.title || '',
                        borrowerId: request.borrower_id || '',
                        status: request.status || '',
                        dateReleased: request.date_released || ''
                    };
                    
                    allDocRequests.push(row);
                });
                
                // Clear any existing filters
                filteredDocRequests = [];
                
                // Use the common table rendering system
                renderTable('docRequestsTable', allDocRequests);
            }
        })
        .catch(error => console.error('Error loading document requests:', error));
}

function filterDocRequests() {
    const searchTerm = document.getElementById('docRequestSearch').value.toLowerCase();
    filteredDocRequests = allDocRequests.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    renderTable('docRequestsTable', filteredDocRequests);
}

// Refresh functions
function refreshDocRequestsRecords() {
    showAlert('Refreshing document requests...', 'info');
    
    // Clear search input
    document.getElementById('docRequestSearch').value = '';
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#docRequestsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredDocRequests = [];
    
    loadDocRequests();
}

// Overdue 24 hours 
function checkIfOverdue(dateReleased, status) {
    if (!dateReleased || status !== 'Released') return false;
    
    const releaseDate = new Date(dateReleased);
    const currentDate = new Date();
    const hoursDifference = (currentDate - releaseDate) / (1000 * 60 * 60); // Convert to hours
    
    return hoursDifference >= 24; // Check for 24 hours
}

// Function to update status to overdue in database
function updateToOverdue(referenceNo) {
    fetch('admin_dashboard.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'updateToOverdue',
            referenceNo: referenceNo
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Failed to update overdue status:', data.message);
        }
    })
    .catch(error => {
        console.error('Error updating overdue status:', error);
    });
}

// Add periodic check for overdue items
function startOverdueCheck() {
    // Check every minute
    setInterval(() => {
        if (document.querySelector('#docRequests.active')) {
            loadDocRequests(); // Reload if the doc requests tab is active
        }
    }, 60000); // 60000 ms = 1 minute
}

// Update the tab shown event listener
document.getElementById('docRequests-tab')?.addEventListener('shown.bs.tab', function (e) {
    loadDocRequests();
});

// Add function to mark document as returned
function acceptDocRequest(referenceNo, currentStatus) {
    // Different confirmation messages based on status
    const confirmMessage = currentStatus.toLowerCase() === 'reserved' 
        ? 'Are you sure you want to accept this document request?' 
        : 'Are you sure you want to mark this document as returned?';

    if (confirm(confirmMessage)) {
        const button = document.querySelector(`button[onclick="acceptDocRequest('${referenceNo}', '${currentStatus}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        // Different actions based on status
        const action = currentStatus.toLowerCase() === 'reserved' 
            ? 'acceptDocRequest' 
            : 'markAsReturned';

        fetch('admin_dashboard.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: action,
                referenceNo: referenceNo,
                dateReturned: currentStatus.toLowerCase() !== 'reserved' ? new Date().toISOString() : null
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const successMessage = currentStatus.toLowerCase() === 'reserved'
                    ? 'Document request accepted successfully'
                    : 'Document marked as returned successfully';
                showAlert(successMessage, 'success');
                loadDocRequests(); // Refresh the document requests list
                loadReturnedDocs(); // Refresh the returned documents table
                loadChartData();   // Refresh the charts
            } else {
                showAlert(data.message || 'Error processing request', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error processing request', 'danger');
        })
        .finally(() => {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-check"></i>';
            }
        });
    }
}

function rejectDocRequest(referenceNo) {
    if (confirm('Are you sure you want to reject this document request?')) {
        // Add loading state to the button
        const button = document.querySelector(`button[onclick="rejectDocRequest('${referenceNo}')"]`);
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        fetch('admin_dashboard.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'rejectDocRequest',
                referenceNo: referenceNo
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Document request rejected successfully', 'success');
                loadDocRequests(); // Refresh the document requests list
                loadChartData();   // Refresh the charts to show updated stats
            } else {
                showAlert(data.message || 'Error rejecting request', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error rejecting request', 'danger');
        })
        .finally(() => {
            // Reset button state
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-times"></i>';
            }
        });
    }
}













// Returned Docs -----------------------------------------------------------------------------------------------
function loadReturnedDocs() {
    console.log('Loading returned documents...');
    
    fetch('admin_dashboard.php?action=getReturnedDocs')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('Received returned documents:', data);
            if (data.success) {
                allReturnedDocs = [];
                
                if (!data.requests || data.requests.length === 0) {
                    renderTable('returnedDocsTable', []);
                    return;
                }

                allReturnedDocs = data.requests.map(request => ({
                    referenceNo: request.reference_no || '',
                    docId: request.document_id ? String(request.document_id).padStart(4, '0') : '',
                    title: request.title || '',
                    borrowerId: request.borrower_id || '',
                    status: request.status || '',
                    dateReleased: request.date_released ? new Date(request.date_released).toLocaleString() : '-',
                    dateReturned: request.status === 'Missing' ? '-' : 
                        (request.date_returned ? new Date(request.date_returned).toLocaleString() : '-')
                }));

                // Clear filtered records and use main rendering system
                filteredReturnedDocs = [];
                renderTable('returnedDocsTable', allReturnedDocs);
            } else {
                console.error('Failed to load returned documents:', data.message);
                showAlert('Failed to load returned documents: ' + data.message, 'danger');
                renderTable('returnedDocsTable', []);
            }
        })
        .catch(error => {
            console.error('Error in loadReturnedDocs:', error);
            renderTable('returnedDocsTable', []);
        });
}

function filterReturnedDocs() {
    const searchTerm = document.getElementById('returnedDocsSearch').value.toLowerCase();
    filteredReturnedDocs = allReturnedDocs.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    renderTable('returnedDocsTable', filteredReturnedDocs);
}

function refreshReturnedDocs() {
    showAlert('Refreshing returned documents...', 'info');
    
    // Clear search input
    document.getElementById('returnedDocsSearch').value = '';
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#returnedDocsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredReturnedDocs = [];
    
    loadReturnedDocs();
}

// Add functions to handle broken and missing status
function markAsDamaged(referenceNo) {
    if (confirm('Are you sure you want to mark this document as damaged?')) {
        updateDocumentStatus(referenceNo, 'Damaged');
    }
}

function markAsMissing(referenceNo) {
    if (confirm('Are you sure you want to mark this document as missing?')) {
        updateDocumentStatus(referenceNo, 'Missing');
    }
}

function updateDocumentStatus(referenceNo, status) {
    fetch('admin_dashboard.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'updateDocumentStatus',
            referenceNo: referenceNo,
            status: status
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const message = status === 'Returned' ? 
                'Document has been resolved!' : 
                `Document marked as ${status.toLowerCase()} successfully`;
            showAlert(message, 'success');
            loadReturnedDocs();
            loadDocRequests();
            loadChartData();
        } else {
            showAlert(data.message || `Error updating document status`, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert(`Error updating document status`, 'danger');
    });
}

// Add new function to handle resolving Broken/Missing status
function markAsResolved(referenceNo) {
    if (confirm('Are you sure you want to mark this document as resolved?')) {
        updateDocumentStatus(referenceNo, 'Returned');
    }
}

// Initialize tables on DOM load
document.addEventListener('DOMContentLoaded', function() {
    // Set up returned docs tab event listener
    document.getElementById('returned-docs-tab')?.addEventListener('shown.bs.tab', function (e) {
        loadReturnedDocs();
    });
    
    // Initial check
    checkExpiredReservations();
    
    // Set up periodic checks every 5 minutes
    setInterval(checkExpiredReservations, 5 * 60 * 1000);
    
    // Initial check for overdue documents
    checkAndUpdateOverdueStatus();
    
    // Set up periodic checks every minute
    setInterval(checkAndUpdateOverdueStatus, 60000); // Check every minute
});

// Add this function to check for expired reservations
function checkExpiredReservations() {
    const formData = new FormData();
    formData.append('action', 'checkExpiredReservations');

    fetch('admin_dashboard.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.deletedCount > 0) {
            // Refresh the tables if any documents were deleted
            loadDocRequests();
            const verb = data.deletedCount === 1 ? 'has' : 'have';
showAlert(`${data.deletedCount} expired reservation${data.deletedCount === 1 ? '' : 's'} ${verb} been removed`, 'info');
        }
    })
    .catch(error => console.error('Error checking expired reservations:', error));
}

// Add this new function to periodically check for overdue documents
function checkAndUpdateOverdueStatus() {
    fetch('admin_dashboard.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'checkOverdueStatus'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.updated) {
            loadDocRequests(); // Refresh the table if any updates were made
        }
    })
    .catch(error => console.error('Error checking overdue status:', error));
}