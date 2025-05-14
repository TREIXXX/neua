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
                        title: request.title || `Document #${request.document_id}`, // Fallback title
                        borrowerId: request.borrower_id || '',
                        borrowerEmail: request.borrower_email || 'Email not available',
                        dateRequested: request.date_released || '',
                        status: request.status || ''
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
    // Update dialog text and button labels
    showConfirmDialog({
        message: `
          
            <p>By clicking Approve, you agree to download the file, enabling you to send it to your preferred platform.</p>
            <br>
            <p style="color: red;">Disclaimer: The system is not liable for any misuse of the document.</p>
        `,
        title: 'Download & Send Confirmation',
        confirmText: 'Approve',
        cancelText: 'Cancel',
        isHTML: true,
        onConfirm: () => {
            // First, get the document ID for downloading
            const row = document.querySelector(`tr[data-reference-no="${referenceNo}"]`);
            const docId = row.querySelector('td:nth-child(2)').textContent; // Assuming docId is in second column

            // Download the file
            window.open(`admin_dashboard.php?action=downloadPdf&fileId=${encodeURIComponent(docId)}`, '_blank');

            // Update the status to 'Returned' immediately without the second dialog
            fetch('admin_dashboard.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'approveAndDownloadDoc',
                    referenceNo: referenceNo,
                    status: 'Returned'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Document has been approved successfully', 'success');
                    // Refresh both tables
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
            });
        }
    });
}

function rejectDocRequest(referenceNo) {
    // Use the custom confirmation dialog instead of the browser's confirm
    showConfirmDialog({
        message: 'Are you sure you want to reject this document request?',
        title: 'Reject Document Request',
        confirmText: 'Reject',
        cancelText: 'Cancel',
        dialogType: 'danger',
        onConfirm: () => {
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
                    loadDisapprovedDocs(); // Refresh the disapproved documents list
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
    });
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
                    borrowerEmail: request.borrower_email || 'Email not available',
                    dateReleased: request.date_released ? new Date(request.date_released).toLocaleString() : '-'
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

function loadDisapprovedDocs() {
    console.log('Loading disapproved documents...');
    
    fetch('admin_dashboard.php?action=getDisapprovedDocs')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('Received disapproved documents:', data);
            if (data.success) {
                allDisapprovedDocs = [];
                
                if (!data.requests || data.requests.length === 0) {
                    filteredDisapprovedDocs = [];
                    renderDisapprovedDocsTable();
                    return;
                }

                allDisapprovedDocs = data.requests.map(request => ({
                    referenceNo: request.reference_no || '',
                    docId: request.document_id ? String(request.document_id).padStart(4, '0') : '',
                    title: request.title || '',
                    borrowerId: request.borrower_id || '',
                    borrowerEmail: request.borrower_email || 'Email not available',
                    dateDisapproved: request.date_disapproved ? new Date(request.date_disapproved).toLocaleString() : '-'
                }));

                // Initialize filtered records with all records
                filteredDisapprovedDocs = [...allDisapprovedDocs];
                
                // Reset pagination to first page
                tableSettings.disapprovedDocsTable.currentPage = 1;
                
                // Render the table with pagination
                renderDisapprovedDocsTable();
            } else {
                console.error('Failed to load disapproved documents:', data.message);
                showAlert('Failed to load disapproved documents: ' + data.message, 'danger');
                filteredDisapprovedDocs = [];
                renderDisapprovedDocsTable();
            }
        })
        .catch(error => {
            console.error('Error in loadDisapprovedDocs:', error);
            filteredDisapprovedDocs = [];
            renderDisapprovedDocsTable();
        });
}

function filterDisapprovedDocs() {
    const searchTerm = document.getElementById('disapprovedDocsSearch').value.toLowerCase();
    
    filteredDisapprovedDocs = allDisapprovedDocs.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    
    // Reset to first page when filtering
    tableSettings.disapprovedDocsTable.currentPage = 1;
    
    // Render table with pagination
    renderDisapprovedDocsTable();
}

function refreshDisapprovedDocs() {
    showAlert('Refreshing disapproved documents...', 'info');
    
    // Clear search input
    document.getElementById('disapprovedDocsSearch').value = '';
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#disapprovedDocsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredDisapprovedDocs = [];
    
    loadDisapprovedDocs();
}

// Function to render the disapproved docs table with pagination
function renderDisapprovedDocsTable() {
    const tbody = document.querySelector('#disapprovedDocsTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredDisapprovedDocs.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 7;
        cell.className = 'text-center';
        cell.textContent = 'No disapproved documents found';
        return;
    }
    
    // Get pagination settings
    const rowsPerPage = tableSettings.disapprovedDocsTable.rowsPerPage;
    const currentPage = tableSettings.disapprovedDocsTable.currentPage;
    
    // Calculate start and end indices
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filteredDisapprovedDocs.length);
    
    // Render only visible rows for current page
    for (let i = startIndex; i < endIndex; i++) {
        const record = filteredDisapprovedDocs[i];
        const row = tbody.insertRow();
        
        // Add cells for disapproved documents
        const props = ['referenceNo', 'docId', 'title', 'borrowerId', 'borrowerEmail', 'dateDisapproved'];
        props.forEach((prop, index) => {
            const cell = row.insertCell();
            let value = record[prop] || '';
            
            if (prop === 'dateDisapproved') {
                // Format date cells
                cell.className = 'text-center';
                cell.textContent = value;
            } else {
                // Add copy functionality for other columns
                cell.textContent = value;
                cell.setAttribute('title', value);
                cell.style.cursor = 'pointer';
                cell.onclick = () => copyToClipboard(value);
            }
        });
    }
    
    // Update pagination controls
    updateDisapprovedDocsPagination();
}

// Add new function for pagination of disapproved docs
function updateDisapprovedDocsPagination() {
    const pagination = document.getElementById('disapprovedDocsTablePagination');
    if (!pagination) return;
    
    const totalItems = filteredDisapprovedDocs.length;
    const rowsPerPage = tableSettings.disapprovedDocsTable.rowsPerPage;
    const currentPage = tableSettings.disapprovedDocsTable.currentPage;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    
    // Clear existing pagination
    pagination.innerHTML = '';
    
    // If no pages, exit
    if (totalPages === 0) return;
    
    // Create previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            tableSettings.disapprovedDocsTable.currentPage = currentPage - 1;
            renderDisapprovedDocsTable();
        }
    };
    pagination.appendChild(prevButton);
    
    // Create page buttons
    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = i === currentPage ? 'active' : '';
        pageButton.disabled = i === currentPage;
        pageButton.onclick = () => {
            tableSettings.disapprovedDocsTable.currentPage = i;
            renderDisapprovedDocsTable();
        };
        pagination.appendChild(pageButton);
    }
    
    // Create next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            tableSettings.disapprovedDocsTable.currentPage = currentPage + 1;
            renderDisapprovedDocsTable();
        }
    };
    pagination.appendChild(nextButton);
}

// Add to event listeners
document.getElementById('disapproved-docs-tab')?.addEventListener('shown.bs.tab', function (e) {
    loadDisapprovedDocs();
});