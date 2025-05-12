//**For Shared Functions !!!!!!!!!!!!!!!

// Local Storage Configuration
const LOCAL_STORAGE_BASE = '';  
const API_BASE = '';  

// Initialize local auth state
let isAuthenticated = false;

// Initialize data arrays
let allFileRecords = [];
let allUserRecords = [];
let allAccountRequests = [];
let allDocRequests = [];
let allReturnedDocs = [];
let filteredFileRows = [];
let filteredUserRows = [];
let filteredAccountRequests = [];
let filteredDocRequests = [];
let filteredReturnedDocs = [];
let originalFileRecords = [];
let originalUserRecords = [];
let originalAccountRequests = [];
let originalDocRequests = [];
let originalReturnedDocs = [];
let allDisapprovedDocs = [];
let filteredDisapprovedDocs = [];
let originalDisapprovedDocs = [];

// Table settings
const tableSettings = {
    fileRecordsTable: { rowsPerPage: 20, currentPage: 1 },
    userRecordsTable: { rowsPerPage: 20, currentPage: 1 },
    accountRequestsTable: { rowsPerPage: 20, currentPage: 1 },
    docRequestsTable: { rowsPerPage: 20, currentPage: 1 },
    returnedDocsTable: { rowsPerPage: 20, currentPage: 1 },
    disapprovedDocsTable: { rowsPerPage: 20, currentPage: 1 }
};

function logout() {
    // Call PHP logout endpoint
    fetch('logout.php')
        .then(() => {
            console.log("User signed out");
            sessionStorage.clear();
            window.location.href = "admin.html";
        })
        .catch((error) => {
            console.error("Sign out error:", error);
            showAlert("Error signing out. Please try again.", 'danger');
        });
}

window.onload = function() {
    checkAuth();
    
    // Load data for all tables
    loadFileRecords();
    loadUserRecords();
    loadAccountRequests();
    loadDocRequests();
    loadReturnedDocs();
    
    // Load chart data if available
    if (typeof loadChartData === 'function') {
        loadChartData();
    }
    
    // Start overdue check if the function exists
    if (typeof startOverdueCheck === 'function') {
        startOverdueCheck();
    }
    
    // Clear the session when the user closes the browser or navigates away
    window.addEventListener("beforeunload", clearSessionOnExit);
};

// Keep the existing helper functions
function redirectToLogin() {
    showAlert('Please log in first.','primary');
    window.location.replace('admin.html');
}

function clearSessionOnExit() {
    sessionStorage.removeItem('adminAuthenticated');
}

function sortTable(tableId, columnIndex) {
    let records;
    let searchActive;
    let filterActive;
    
    // Determine which records to use based on table and filter state
    switch (tableId) {
        case 'fileRecordsTable':
            searchActive = document.getElementById('fileSearch').value !== '';
            filterActive = filterState.files.program.size > 0 || filterState.files.level || filterState.files.year;
            records = (searchActive || filterActive) ? [...filteredFileRows] : [...allFileRecords];
            break;
        case 'userRecordsTable':
            searchActive = document.getElementById('userSearch').value !== '';
            filterActive = filterState.users.userType.size > 0 || filterState.users.status || filterState.users.withRequests;
            records = (searchActive || filterActive) ? [...filteredUserRows] : [...allUserRecords];
            break;
        case 'accountRequestsTable':
            searchActive = document.getElementById('accountRequestSearch').value !== '';
            records = searchActive ? [...filteredAccountRequests] : [...allAccountRequests];
            break;
        case 'docRequestsTable':
            searchActive = document.getElementById('docRequestSearch').value !== '';
            records = searchActive ? [...filteredDocRequests] : [...allDocRequests];
            break;
        case 'returnedDocsTable':
            searchActive = document.getElementById('returnedDocsSearch').value !== '';
            records = searchActive ? [...filteredReturnedDocs] : [...allReturnedDocs];
            break;
        default:
        return;
    }

    // Store original records if not already stored
    if (tableId === 'fileRecordsTable' && originalFileRecords.length === 0) {
        originalFileRecords = [...allFileRecords];
    } else if (tableId === 'userRecordsTable' && originalUserRecords.length === 0) {
        originalUserRecords = [...allUserRecords];
    } else if (tableId === 'accountRequestsTable' && originalAccountRequests.length === 0) {
        originalAccountRequests = [...allAccountRequests];
    } else if (tableId === 'docRequestsTable' && originalDocRequests.length === 0) {
        originalDocRequests = [...allDocRequests];
    } else if (tableId === 'returnedDocsTable' && originalReturnedDocs.length === 0) {
        originalReturnedDocs = [...allReturnedDocs];
    }

    const headerSpan = document.getElementById(`${tableId}Header${columnIndex}`);
    const currentState = headerSpan.classList.contains('asc') ? 'asc' : 
                        headerSpan.classList.contains('desc') ? 'desc' : 'default';

    // Clear all arrow classes
    document.querySelectorAll(`#${tableId} th span`).forEach(span => {
        span.classList.remove('asc', 'desc');
    });

    // Determine next state
    let nextState;
    if (currentState === 'asc') {
        nextState = 'desc';
    } else if (currentState === 'desc') {
        nextState = 'default';
    } else {
        nextState = 'asc';
    }

    // If returning to default state, reapply filters to original data
    if (nextState === 'default') {
        switch (tableId) {
            case 'fileRecordsTable':
                applyFileFilters();
                break;
            case 'userRecordsTable':
                applyUserFilters();
                break;
            case 'accountRequestsTable':
                filterAccountRequests();
                break;
            case 'docRequestsTable':
                filterDocRequests();
                break;
            case 'returnedDocsTable':
                filterReturnedDocs();
                break;
        }
        return;
    }

    // Set arrow class based on next state
    if (nextState !== 'default') {
        headerSpan.classList.add(nextState);
    }

        // Sort Records
        records.sort((a, b) => {
            // Get the correct property name based on table and column
            let aValue, bValue;
            
            switch (tableId) {
                case 'fileRecordsTable':
                    const fileProps = ['documentId', 'fileName', 'author', 'year', 'course'];
                    aValue = a[fileProps[columnIndex - 1]] || '';
                    bValue = b[fileProps[columnIndex - 1]] || '';
                    break;
                    
                case 'userRecordsTable':
                    const userProps = ['name', 'email', 'ID', 'userType', 'requests'];
                    aValue = a[userProps[columnIndex - 1]] || '';
                    bValue = b[userProps[columnIndex - 1]] || '';
                    break;
                    
                case 'accountRequestsTable':
                    const requestProps = ['name', 'email', 'ID', 'userType', 'department'];
                    aValue = a[requestProps[columnIndex - 1]] || '';
                    bValue = b[requestProps[columnIndex - 1]] || '';
                    break;
                
            case 'docRequestsTable':
                    const docRequestProps = ['referenceNo', 'docId', 'title', 'borrowerId', 'borrowerEmail', 'dateRequested'];
                aValue = a[docRequestProps[columnIndex - 1]] || '';
                bValue = b[docRequestProps[columnIndex - 1]] || '';
                break;
                
            case 'returnedDocsTable':
                    const returnedDocProps = ['referenceNo', 'docId', 'title', 'borrowerId', 'borrowerEmail', 'dateReleased'];
                aValue = a[returnedDocProps[columnIndex - 1]] || '';
                bValue = b[returnedDocProps[columnIndex - 1]] || '';
                break;
            }

            // Convert to appropriate type for comparison
            if (columnIndex === 6 && tableId === 'fileRecordsTable') {
                // For file ID, convert to number
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
                return nextState === 'asc' ? aValue - bValue : bValue - aValue;
            } else if (columnIndex === 5 && tableId === 'userRecordsTable') {
                // For requests count, convert to number
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
                return nextState === 'asc' ? aValue - bValue : bValue - aValue;
            } else if ((columnIndex === 6 && tableId === 'docRequestsTable') || 
                      (columnIndex === 6 || columnIndex === 7) && tableId === 'returnedDocsTable') {
                // For date columns in doc requests and returned docs tables
            const dateA = new Date(aValue);
            const dateB = new Date(bValue);
            return nextState === 'asc' ? dateA - dateB : dateB - dateA;
            } else {
                // For all other columns, use string comparison
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
                return nextState === 'asc' ? 
                    aValue.localeCompare(bValue) : 
                    bValue.localeCompare(aValue);
            }
        });

    // Update the appropriate filtered array while preserving filter state
    switch (tableId) {
        case 'fileRecordsTable':
            if (searchActive || filterActive) filteredFileRows = records;
            break;
        case 'userRecordsTable':
            if (searchActive || filterActive) filteredUserRows = records;
            break;
        case 'accountRequestsTable':
            if (searchActive) filteredAccountRequests = records;
            break;
        case 'docRequestsTable':
            if (searchActive) filteredDocRequests = records;
            break;
        case 'returnedDocsTable':
            if (searchActive) filteredReturnedDocs = records;
            break;
    }

    // Render the appropriate dataset
    renderTable(tableId, records);
}

let rowsPerPage = 20;

function changeRowsPerPage(tableId, newValue) {
    // Update the table settings
    tableSettings[tableId].rowsPerPage = parseInt(newValue);
    tableSettings[tableId].currentPage = 1; // Reset to first page
    
    // Get current data for the table
    let currentData;
    switch (tableId) {
        case 'fileRecordsTable':
            currentData = filteredFileRows.length > 0 ? filteredFileRows : allFileRecords;
            break;
        case 'userRecordsTable':
            currentData = filteredUserRows.length > 0 ? filteredUserRows : allUserRecords;
            break;
        case 'accountRequestsTable':
            currentData = filteredAccountRequests.length > 0 ? filteredAccountRequests : allAccountRequests;
            break;
        case 'docRequestsTable':
            currentData = filteredDocRequests.length > 0 ? filteredDocRequests : allDocRequests;
            break;
        case 'returnedDocsTable':
            currentData = filteredReturnedDocs.length > 0 ? filteredReturnedDocs : allReturnedDocs;
            break;
    }

    // Re-render the table with new page size
    renderTable(tableId, currentData);
}

// Pagination logic
function setupPagination(tableId, rows) {
    const pagination = document.getElementById(`${tableId}Pagination`);
    if (!pagination) return;

    const settings = tableSettings[tableId];
    const totalPages = Math.ceil(rows.length / settings.rowsPerPage);
    
    // Ensure current page is valid
    if (settings.currentPage > totalPages) {
        settings.currentPage = totalPages || 1;
    }

    function showPage(page) {
        settings.currentPage = page;
        const start = (page - 1) * settings.rowsPerPage;
        const end = start + settings.rowsPerPage;

        // Hide all rows
        rows.forEach(row => row.style.display = 'none');

        // Show rows for current page
        for (let i = start; i < Math.min(end, rows.length); i++) {
            rows[i].style.display = '';
        }

        updatePaginationButtons(page);
    }

    function updatePaginationButtons(currentPage) {
        pagination.innerHTML = '';

        // Previous button
        const prevButton = document.createElement('button');
        prevButton.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevButton.disabled = currentPage === 1;
        prevButton.onclick = () => showPage(currentPage - 1);
        pagination.appendChild(prevButton);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.disabled = i === currentPage;
            pageButton.onclick = () => showPage(i);
            pageButton.className = i === currentPage ? 'active' : '';
            pagination.appendChild(pageButton);
        }

        // Next button
        const nextButton = document.createElement('button');
        nextButton.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextButton.disabled = currentPage === totalPages;
        nextButton.onclick = () => showPage(currentPage + 1);
        pagination.appendChild(nextButton);
    }

    // Show initial page
    showPage(settings.currentPage);
}

// Improve table rendering with better actions menu handling
function renderTable(tableId, records) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const tbody = table.getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';

    // Close any open action menus before rendering
    document.querySelectorAll('.actions-menu.show').forEach(menu => {
        menu.classList.remove('show');
    });

    if (records.length === 0) {
        // Add a "No results found" row
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = table.getElementsByTagName('th').length; // Span all columns
        cell.className = 'text-center';
        cell.innerHTML = 'No results found';
        return;
    }

    records.forEach((record, index) => {
        const row = tbody.insertRow();
        if (tableId === 'userRecordsTable') {
            row.setAttribute('data-db-id', record.dbId || record.id || ''); // Use the actual DB id
        }
        
        // Conditionally add checkbox column
        if (['fileRecordsTable', 'userRecordsTable', 'accountRequestsTable'].includes(tableId)) {
        const checkboxCell = row.insertCell();
        checkboxCell.innerHTML = `<input type="checkbox" onchange="handleCheckboxClick('${tableId}', this)">`;
        }
        
        switch (tableId) {
            case 'fileRecordsTable':
                // Add cells for file records with copy functionality
                ['documentId', 'title', 'author', 'year', 'course'].forEach((prop, index) => {
                    const cell = row.insertCell();
                    const value = record[prop] || '';
                    
                    // Add copy functionality for all file record columns
                    cell.textContent = value;
                    cell.setAttribute('title', value);
                    cell.style.cursor = 'pointer';
                    cell.onclick = (e) => {
                        // Don't copy if row is in edit mode
                        if (e.target.closest('tr').classList.contains('edit-mode')) {
                            return;
                        }
                        copyToClipboard(value);
                    };
                });

                // Add actions column
                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';

                // First, check if this document is already reserved
                const isReserved = checkIfDocumentReserved(record.documentId);
                
                // Create base menu items that everyone sees
                let menuItems = `
                    <div class="action-item" onclick="viewPdf('${record.fileName}')">
                        <i class="fas fa-eye"></i>View
                    </div>
                    <div class="action-item" onclick="editRow(this.closest('.actions-dropdown'))">
                        <i class="fas fa-edit"></i>Edit
                    </div>
                    <div class="action-item" onclick="downloadPdf('${record.documentId}')" title="Download this file">
                        <i class="fas fa-download"></i>Download
                    </div>`;

                // Only add request option for coordinators and only if not already reserved
                if (window.currentUserType === 'coordinator' && !isReserved) {
                    menuItems += `
                        <div class="action-item" onclick="requestDocument('${record.documentId}')">
                            <i class="fas fa-paper-plane"></i>Request
                        </div>`;
                } else if (window.currentUserType === 'coordinator' && isReserved) {
                    menuItems += `
                        <div class="action-item disabled" title="Someone already requested this file">
                            <i class="fas fa-paper-plane"></i>Request
                        </div>`;
                }

                // Create the complete dropdown HTML
                actionsCell.innerHTML = `
                    <div class="actions-dropdown">
                        <button class="btn btn-sm" onclick="toggleActionsMenu(this)">
                            <i class="fas fa-ellipsis"></i>
                        </button>
                        <div class="actions-menu">
                            ${menuItems}
                        </div>
                    </div>`;
                break;

           
                case 'userRecordsTable':
                    // Add deactivated class if user is deactivated
                    if (record.account_status === 'deactivated') {
                        row.classList.add('deactivated');
                    }
                    
                    // Add cells for user records with copy functionality
                    ['name', 'email', 'ID', 'userType', 'department'].forEach((prop, index) => {
                        const cell = row.insertCell();
                        const value = record[prop] || '';
                    
                        if (prop === 'userType') {
                            const userTypeSpan = document.createElement('span');
                            userTypeSpan.className = `user-type ${(value || '').toLowerCase()}`;
                            userTypeSpan.textContent = value;
                            cell.appendChild(userTypeSpan);
                        } else if (index <= 2) {
                            cell.textContent = value;
                            cell.setAttribute('title', value);
                            cell.style.cursor = 'pointer';
                            cell.onclick = (e) => {
                                if (e.target.closest('tr').classList.contains('edit-mode')) {
                                    return;
                                }
                                copyToClipboard(value);
                            };
                        } else {
                            cell.textContent = value;
                        }
                    });
    
                    // Add actions column with data attributes for user identification
                    const userActionsCell = row.insertCell();
                    userActionsCell.className = 'actions';
                    const isActive = record.account_status !== 'deactivated';
                    userActionsCell.innerHTML = `
                        <div class="actions-dropdown" data-user-id="${record.ID}">
                            <button class="btn btn-sm action-button" onclick="toggleActionsMenu(this)">
                                <i class="fas fa-ellipsis"></i>
                            </button>
                            <div class="actions-menu">
                                <div class="action-item" onclick="viewUser('${record.name || ''}', '${record.email || ''}', '${record.ID || ''}', '${record.userType || ''}', '${record.created_at || ''}', '${record.certificate_url || ''}', '${record.created_by || ''}')">
                                    <i class="fas fa-eye"></i>View
                                </div>
                                <div class="action-item ${isActive ? 'deactivate-action' : 'activate-action'}" onclick="toggleUserStatus('${record.ID}', ${isActive})">
                                    <i class="fas ${isActive ? 'fa-circle-minus' : 'fa-circle-check'}"></i>${isActive ? 'Deactivate' : 'Activate'}
                                </div>
                            </div>
                        </div>`;
                    break;

            case 'accountRequestsTable':
                // Add cells for account requests with copy functionality
                ['name', 'email', 'ID', 'userType', 'department'].forEach((prop, index) => {
                    const cell = row.insertCell();
                    const value = record[prop] || '';

                    if (prop === 'userType') {
                        const span = document.createElement('span');
                        span.textContent = value;
                        span.className = `user-type ${value.toLowerCase()}`;
                        cell.appendChild(span);
                    } else if (index <= 2) { // Add copy functionality for first 3 columns
                        cell.textContent = value;
                        cell.setAttribute('title', value);
                        cell.style.cursor = 'pointer';
                        cell.onclick = (e) => {
                            // Don't copy if row is in edit mode
                            if (e.target.closest('tr').classList.contains('edit-mode')) {
                                return;
                            }
                            copyToClipboard(value);
                        };
                    } else {
                        cell.textContent = value;
                    }
                });

                

                // Certificate cell
                
                const certCell = row.insertCell();
                const viewButton = document.createElement('button');
                viewButton.className = 'btn btn-sm btn-outline-secondary';
                viewButton.innerHTML = 'View';
                viewButton.onclick = () => {
                    // Add debug logging
                    console.log('Certificate URL:', record.certificate_url);
                    if (record.certificate_url) {
                        showCertificateOverlay(record.certificate_url);
                    } else {
                        showAlert('No certificate available', 'warning');
                    }
                };
                certCell.appendChild(viewButton);

                // Actions cell
                const reqActionsCell = row.insertCell();
                reqActionsCell.className = 'actions';
                reqActionsCell.innerHTML = `
                    <div class="actions-dropdown" data-request-id="${record.requestId}">
                        <button class="btn btn-sm" onclick="acceptUserRequest('${record.requestId}')">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm" onclick="rejectUserRequest('${record.requestId}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>`;
                break;
                
            case 'docRequestsTable':
                // Add cells for document requests
                const docProps = ['referenceNo', 'docId', 'title', 'borrowerId', 'borrowerEmail', 'dateRequested'];
                docProps.forEach((prop, index) => {
                    const cell = row.insertCell();
                    let value = record[prop] || '';
                    
                    if (prop === 'dateRequested') {
                        // Format date
                        cell.className = 'text-center';
                        cell.textContent = value ? new Date(value).toLocaleString() : '-';
                    } else {
                        // Add copy functionality for other columns
                        cell.textContent = value;
                        cell.setAttribute('title', value);
                        cell.style.cursor = 'pointer';
                        cell.onclick = () => copyToClipboard(value);
                    }
                });
                
                // Add actions column
                const docActionsCell = row.insertCell();
                docActionsCell.className = 'actions';
                
                // Add data attribute for reference number
                row.setAttribute('data-reference-no', record.referenceNo);
                row.setAttribute('data-status', record.status); // Keep status as data attribute
                
                // Create actions based on the document status (stored in data attribute)
                const status = record.status ? record.status.toLowerCase() : '';
                if (status === 'reserved') {
                    docActionsCell.innerHTML = `
                        <div class="actions-dropdown" data-request-id="${record.referenceNo}">
                            <button class="btn btn-sm" onclick="acceptDocRequest('${record.referenceNo}', 'reserved')">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-sm" onclick="rejectDocRequest('${record.referenceNo}')">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>`;
                } else if (status === 'released' || status === 'overdue') {
                    docActionsCell.innerHTML = `
                        <div class="actions-dropdown" data-request-id="${record.referenceNo}">
                            <button class="btn btn-sm" onclick="acceptDocRequest('${record.referenceNo}', '${status}')">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-sm" style="visibility: hidden">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>`;
                } else if (status === 'sent') {
                    // For sent status, show in returned docs table
                    docActionsCell.innerHTML = `
                        <div class="actions-dropdown" data-request-id="${record.referenceNo}">
                            <button class="btn btn-sm" disabled>
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="btn btn-sm" style="visibility: hidden">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>`;
                }
                break;
                
            case 'returnedDocsTable':
                // Add cells for returned documents
                const returnedProps = ['referenceNo', 'docId', 'title', 'borrowerId', 'borrowerEmail', 'dateReleased'];
                returnedProps.forEach((prop, index) => {
                    const cell = row.insertCell();
                    let value = record[prop] || '';
                    
                    if (prop === 'dateReleased') {
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
                // No actions column
                break;

            case 'disapprovedDocsTable':
                // Add cells for disapproved documents
                const disapprovedProps = ['referenceNo', 'docId', 'title', 'borrowerId', 'borrowerEmail', 'dateDisapproved'];
                disapprovedProps.forEach((prop, index) => {
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
                break;
        }
    });

    setupPagination(tableId, Array.from(tbody.getElementsByTagName('tr')));
}

function toggleActionsMenu(button) {
    const allMenus = document.querySelectorAll('.actions-menu');
    const menu = button.nextElementSibling;
    
    // If this menu is already shown, just hide it
    if (menu.classList.contains('show')) {
        menu.classList.remove('show');
        return;
    }

    // Hide all other menus
    allMenus.forEach(m => m.classList.remove('show'));
    
    // Show this menu
    menu.classList.add('show');
    
    // Add click outside listener
    function closeMenu(e) {
        if (!menu.contains(e.target) && !button.contains(e.target)) {
            menu.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    }
    
    // Add the listener with a slight delay to prevent immediate triggering
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

// Add arrow icons to headers (excluding the Actions column)
document.addEventListener('DOMContentLoaded', () => {
    const tables = ['fileRecordsTable', 'userRecordsTable', 'accountRequestsTable', 'docRequestsTable', 'returnedDocsTable'];
    tables.forEach(tableId => {
        const headers = document.querySelectorAll(`#${tableId} th:not(.actions)`); // Exclude Actions column
        headers.forEach((header, index) => {
            const span = document.createElement('span');
            span.innerHTML = ''; // No initial arrow
            header.appendChild(span);
        });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const tables = ['fileRecordsTable', 'userRecordsTable', 'accountRequestsTable', 'docRequestsTable', 'returnedDocsTable'];
    tables.forEach(tableId => {
        const headers = document.querySelectorAll(`#${tableId} th:not(.actions)`);
        headers.forEach((header, index) => {
            // Create span element for sort indicator
            const span = document.createElement('span');
            span.id = `${tableId}Header${index}`;
            span.innerHTML = ''; // No initial arrow
            header.appendChild(span);
        });
    });
    
    // Set up filtration and search events
    const fileSearch = document.getElementById('fileSearch');
    const userSearch = document.getElementById('userSearch');
    const accountRequestSearch = document.getElementById('accountRequestSearch');
    const docRequestSearch = document.getElementById('docRequestSearch');
    const returnedDocsSearch = document.getElementById('returnedDocsSearch');

    if (fileSearch) {
        fileSearch.addEventListener('input', filterFileRecords);
    }
    if (userSearch) {
        userSearch.addEventListener('input', filterUserRecords);
    }
    if (accountRequestSearch) {
        accountRequestSearch.addEventListener('input', filterAccountRequests);
    }
    if (docRequestSearch) {
        docRequestSearch.addEventListener('input', filterDocRequests);
    }
    if (returnedDocsSearch) {
        returnedDocsSearch.addEventListener('input', filterReturnedDocs);
    }
    
    // Initialize filter handlers
    setupFilterHandlers();
});

function editRow(dropdown) {
    const row = dropdown.closest('tr');
    const cells = row.querySelectorAll('td');
    const menuButton = dropdown.querySelector('button');
    const tableId = row.closest('table').id;
    
    // Enter edit mode
    row.classList.add('edit-mode');
    
    let editableCells = [];
    
    // Define editable columns based on table type
    if (tableId === 'fileRecordsTable') {
        // Make all columns except checkbox and actions editable
        editableCells = Array.from(cells).slice(1, 6); // columns 1-5 (id, title, author, year, course)
        // Store the original Doc ID for later use
        row.dataset.originalDocId = row.cells[1].textContent;
    } else if (tableId === 'userRecordsTable') {
        // Make only name, email, and ID editable
        editableCells = Array.from(cells).slice(1, 4); // columns 1-3 (name, email, ID)
    }
    
    // Store original values for potential cancel
    row.dataset.originalValues = JSON.stringify(
        editableCells.map(cell => cell.textContent)
    );
    
    // Convert editable cells to input fields
    editableCells.forEach(cell => {
        const originalContent = cell.textContent;
        
        // Store the original attributes we need to restore later
        cell.dataset.originalTitle = cell.getAttribute('title') || '';
        cell.dataset.originalCursor = cell.style.cursor || '';
        
        // Completely remove previous event handlers and styling for edit mode
        cell.removeAttribute('title');
        cell.style.cursor = 'default';
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.value = originalContent;
        newInput.style.width = '100%';
        newInput.style.boxSizing = 'border-box';
        newInput.onclick = (e) => {
            e.stopPropagation(); // Prevent cell click event
        };
        
        // Clear the cell and append the input
        cell.innerHTML = '';
        cell.appendChild(newInput);
    });
    
    // Check and cancel icons with improved event handling
    menuButton.innerHTML = `
        <i class="fas fa-check" onclick="event.stopPropagation(); saveChanges(this.closest('tr'));"></i>
        <i class="fas fa-times" onclick="event.stopPropagation(); cancelEdit(this.closest('tr'));" style="margin-left: 8px;"></i>
    `;
    
    // Prevent clicks on the button from triggering the dropdown while in edit mode
    menuButton.onclick = (e) => {
        e.stopPropagation();
        if (!row.classList.contains('edit-mode')) {
            toggleActionsMenu(menuButton);
        }
    };
    
    // Close the dropdown
    dropdown.querySelector('.actions-menu').classList.remove('show');
}
window.editRow = editRow;

function cancelEdit(row) {
    const cells = row.querySelectorAll('td');
    const originalValues = JSON.parse(row.dataset.originalValues);
    const menuButton = row.querySelector('.actions-dropdown button');
    const tableId = row.closest('table').id;
    
    // Restore original values based on table type
    let startIndex = 1;
    let endIndex = tableId === 'fileRecordsTable' ? 5 : 3;
    
    for (let i = 0; i < endIndex; i++) {
        const cellIndex = i + startIndex;
        const cell = cells[cellIndex];
        const value = originalValues[i];
        
        // Restore content
        cell.textContent = value;
        
        // Restore copy to clipboard functionality and original attributes
        if (tableId === 'fileRecordsTable' || (tableId === 'userRecordsTable' && i < 3)) {
            // Restore original attributes if they exist
            if (cell.dataset.originalTitle) {
                cell.setAttribute('title', cell.dataset.originalTitle);
            } else {
                cell.setAttribute('title', value);
            }
            
            if (cell.dataset.originalCursor) {
                cell.style.cursor = cell.dataset.originalCursor;
            } else {
                cell.style.cursor = 'pointer';
            }
            
            // Restore click functionality
            cell.onclick = (e) => {
                // Don't copy if row is in edit mode
                if (e.target.closest('tr').classList.contains('edit-mode')) {
                    return;
                }
                copyToClipboard(value);
            };
        }
    }
    
    // Reset button to three dots and remove edit mode
    menuButton.innerHTML = '<i class="fas fa-ellipsis"></i>';
    row.classList.remove('edit-mode');
}
window.cancelEdit = cancelEdit;

function saveChanges(row) {
    const cells = row.querySelectorAll('td');
    const tableId = row.closest('table').id;
    const updatedData = {};
    const menuButton = row.querySelector('.actions-dropdown button');
    
    if (tableId === 'fileRecordsTable') {
        // Get values from columns 1-5
        const fields = ['documentId', 'title', 'author', 'year', 'course'];
        fields.forEach((field, index) => {
            const cellIndex = index + 1;
            const input = cells[cellIndex].querySelector('input');
            if (input) {
                const newValue = input.value;
                updatedData[field] = newValue;
                
                // Reset cell content
                cells[cellIndex].textContent = newValue;
                
                // Restore copy to clipboard functionality with the new value
                cells[cellIndex].setAttribute('title', newValue);
                cells[cellIndex].style.cursor = 'pointer';
                cells[cellIndex].onclick = (e) => {
                    // Don't copy if row is in edit mode
                    if (e.target.closest('tr').classList.contains('edit-mode')) {
                        return;
                    }
                    copyToClipboard(newValue);
                };
            }
        });
    } else if (tableId === 'userRecordsTable') {
        // Get values from columns 1-3
        const fields = ['name', 'email', 'ID'];
        fields.forEach((field, index) => {
            const cellIndex = index + 1;
            const input = cells[cellIndex].querySelector('input');
            if (input) {
                const newValue = input.value;
                updatedData[field] = newValue;
                
                // Reset cell content
                cells[cellIndex].textContent = newValue;
                
                // Restore copy to clipboard functionality with the new value
                cells[cellIndex].setAttribute('title', newValue);
                cells[cellIndex].style.cursor = 'pointer';
                cells[cellIndex].onclick = (e) => {
                    // Don't copy if row is in edit mode
                    if (e.target.closest('tr').classList.contains('edit-mode')) {
                        return;
                    }
                    copyToClipboard(newValue);
                };
            }
        });
    }
    
    if (Object.keys(updatedData).length > 0) {
        const formData = new FormData();
        formData.append('action', tableId === 'fileRecordsTable' ? 'updateFile' : 'updateUser');
        
        if (tableId === 'fileRecordsTable') {
            const originalDocId = row.dataset.originalDocId || row.cells[1].textContent;
            const newDocId = updatedData.documentId || row.cells[1].textContent;

            formData.append('originalDocId', originalDocId);
            formData.append('newDocId', newDocId);
            formData.append('newFileName', updatedData.title || row.cells[2].textContent);
            formData.append('title', updatedData.title || row.cells[2].textContent);
            formData.append('author', updatedData.author || row.cells[3].textContent);
            formData.append('year', updatedData.year || row.cells[4].textContent);
            formData.append('course', updatedData.course || row.cells[5].textContent);
        } else if (tableId === 'userRecordsTable') {
            const dbId = row.getAttribute('data-db-id');
            formData.append('userId', dbId);
            Object.keys(updatedData).forEach(key => {
                formData.append(key, updatedData[key]);
            });
        }

        fetch('admin_dashboard.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Changes saved successfully', 'success');
                if (tableId === 'fileRecordsTable') {
                    loadFileRecords();
                } else if (tableId === 'userRecordsTable') {
                    loadUserRecords();
                }
            } else {
                showAlert(data.message || 'Error saving changes', 'danger');
            }
        })
        .catch(error => {
            console.error('Error saving changes:', error);
            showAlert('Error saving changes', 'danger');
        });
    }

    // Reset button to three dots and remove edit mode
    menuButton.innerHTML = '<i class="fas fa-ellipsis"></i>';
    row.classList.remove('edit-mode');
}
window.saveChanges = saveChanges;

function deleteRow(dropdown) {
    const row = dropdown.closest('tr');
    const tableId = row.closest('table').id;
    
    if (tableId === 'fileRecordsTable') {
        const fileName = row.cells[1].textContent; // Get filename from second column
        
        showConfirmDialog({
            message: `Are you sure you want to delete ${fileName}?`,
            title: 'Delete File',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            dialogType: 'danger',
            onConfirm: () => {
                fetch(`admin_dashboard.php?action=deleteFile&file=${encodeURIComponent(fileName)}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            showAlert('File deleted successfully', 'success');
                            loadFileRecords(); // Refresh the file list
                        } else {
                            showAlert(data.message || 'Error deleting file', 'danger');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        showAlert('Error deleting file', 'danger');
                    });
            }
        });
    } else if (tableId === 'userRecordsTable') {
        // Get the user ID from the 4th cell (index 3)
        const userId = row.cells[3].textContent.trim();
        
        showConfirmDialog({
            message: 'Are you sure you want to delete this user?',
            title: 'Delete User',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            dialogType: 'danger',
            onConfirm: () => {
                const formData = new FormData();
                formData.append('action', 'deleteUser');
                formData.append('userId', userId);

                fetch('admin_dashboard.php', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showAlert('User deleted successfully', 'success');
                        loadUserRecords(); // Refresh the user list
                    } else {
                        showAlert(data.message || 'Error deleting user', 'danger');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert('Error deleting user', 'danger');
                });
            }
        });
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.actions-dropdown')) {
        document.querySelectorAll('.actions-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});


// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize event listeners for signup form
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', createUser);
    }

    // Initialize file upload modal events
    const fileUploadModal = document.getElementById('fileUploadModal');
    if (fileUploadModal) {
        fileUploadModal.addEventListener('hidden.bs.modal', function () {
            removeFile();
        });
    }

    // Save file details button event
    const saveFileDetails = document.getElementById('saveFileDetails');
    if (saveFileDetails) {
        saveFileDetails.addEventListener('click', function() {
            const originalFileName = document.getElementById('originalFileName').value;
            updateFileDetails(originalFileName);
        });
    }
});

// Back to top button
const mybutton = document.getElementById("myBtn");
window.onscroll = function() {scrollFunction()};

function scrollFunction() {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        mybutton.style.display = "block";
    } else {
        mybutton.style.display = "none";
    }
}

function topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
}

// Export functions
function exportFileRecords() {
    const headers = ['ID', 'Title', 'Author', 'Year', 'Course'];
    const data = allFileRecords.map(record => [
        record.documentId,
        record.fileName,
        record.author,
        record.year,
        record.course
    ]);
    
    downloadCSV(headers, data, 'file_records.csv');
}

function exportUserRecords() {
    const headers = ['Name', 'Email', 'ID', 'User Type', 'Requests'];
    const data = allUserRecords.map(record => [
        record.name,
        record.email,
        record.ID,
        record.userType,
        record.requests
    ]);
    
    downloadCSV(headers, data, 'user_records.csv');
}

function exportAccountRequestsRecords() {
    const headers = ['Name', 'Email', 'ID', 'User Type'];
    const data = allAccountRequests.map(record => [
        record.name,
        record.email,
        record.ID,
        record.userType
    ]);
    
    downloadCSV(headers, data, 'account_requests.csv');
}

function exportDocRequestsRecords() {
    const headers = ['Reference No.', 'Doc ID', 'Title', 'Borrower', 'Email', 'Date Requested'];
    const data = allDocRequests.map(record => [
        record.referenceNo,
        record.docId,
        record.title,
        record.borrowerId,
        record.borrowerEmail,
        record.dateRequested
    ]);
    
    downloadCSV(headers, data, 'document_requests.csv');
}

function exportReturnedDocs() {
    const headers = ['Reference No.', 'Doc ID', 'Title', 'Requester', 'Email', 'Date Sent'];
    const data = allReturnedDocs.map(record => [
        record.referenceNo,
        record.docId,
        record.title,
        record.borrowerId,
        record.borrowerEmail,
        record.dateReleased
    ]);
    
    downloadCSV(headers, data, 'approved_documents.csv');
}

function exportDisapprovedDocs() {
    const headers = ['Reference No.', 'Doc ID', 'Title', 'Requester', 'Email', 'Date Disapproved'];
    const data = allDisapprovedDocs.map(record => [
        record.referenceNo,
        record.docId,
        record.title,
        record.borrowerId,
        record.borrowerEmail,
        record.dateDisapproved
    ]);
    
    downloadCSV(headers, data, 'disapproved_documents.csv');
}

function downloadCSV(headers, data, filename) {
    let csv = headers.join(',') + '\n';
    csv += data.map(row => row.map(cell => 
        typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
    ).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Event listeners initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tables
    loadFileRecords();
    loadUserRecords();
    loadAccountRequests();
    loadDocRequests();
    loadReturnedDocs();
});

// Function to toggle select all checkboxes
function toggleSelectAll(tableId, checkbox) {
    const table = document.getElementById(tableId);
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
    
    // Show/hide delete button based on any checkbox being checked
    const deleteButton = document.querySelector(`#${tableId}`).closest('.tab-pane').querySelector('.btn-delete');
    deleteButton.style.display = checkbox.checked ? 'block' : 'none';
}

// Function to handle individual checkbox clicks
function handleCheckboxClick(tableId, checkbox) {
    const table = document.getElementById(tableId);
    const checkboxes = table.querySelectorAll('tbody input[type="checkbox"]');
    const selectAllCheckbox = table.querySelector('thead input[type="checkbox"]');
    const deleteButton = document.querySelector(`#${tableId}`).closest('.tab-pane').querySelector('.btn-delete');
    
    // Update select all checkbox state
    selectAllCheckbox.checked = Array.from(checkboxes).every(cb => cb.checked);
    
    // Show/hide delete button based on any checkbox being checked
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    deleteButton.style.display = anyChecked ? 'block' : 'none';
}

// Function to delete selected records
function deleteSelectedRecords(tableId) {
    const table = document.getElementById(tableId);
    const selectedRows = table.querySelectorAll('tbody tr input[type="checkbox"]:checked');
    
    if (selectedRows.length === 0) {
        showAlert('Please select records to delete', 'warning');
        return;
    }
    
    const recordType = tableId === 'fileRecordsTable' ? 'files' : 
                      tableId === 'userRecordsTable' ? 'users' : 
                      tableId === 'accountRequestsTable' ? 'account requests' :
                      tableId === 'docRequestsTable' ? 'document requests' : 'post requests';
    
    showConfirmDialog({
        message: `Are you sure you want to delete ${selectedRows.length} ${recordType}?`,
        title: 'Delete Confirmation',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        dialogType: 'danger',
        onConfirm: () => {
            const promises = Array.from(selectedRows).map(checkbox => {
                const row = checkbox.closest('tr');
                const formData = new FormData();
                
                if (tableId === 'fileRecordsTable') {
                    const fileId = row.cells[1].textContent;
                    formData.append('action', 'deleteFile');
                    formData.append('fileId', fileId);
                } else if (tableId === 'userRecordsTable') {
                    // Get the user ID from the 4th cell (index 3)
                    const userId = row.cells[3].textContent.trim();
                    formData.append('action', 'deleteUser');
                    formData.append('userId', userId);
                } else if (tableId === 'accountRequestsTable') {
                    const requestId = row.querySelector('[data-request-id]').getAttribute('data-request-id');
                    formData.append('action', 'rejectUser');
                    formData.append('requestId', requestId);
                } else if (tableId === 'docRequestsTable') {
                    const referenceNo = row.cells[1].textContent;
                    formData.append('action', 'deleteDocRequest');
                    formData.append('referenceNo', referenceNo);
                } else if (tableId === 'returnedDocsTable') {
                    const referenceNo = row.cells[1].textContent;
                    formData.append('action', 'deleteReturnedDoc');
                    formData.append('referenceNo', referenceNo);
                }
                
                return fetch('admin_dashboard.php', {
                    method: 'POST',
                    body: formData
                }).then(response => response.json());
            });
            
            Promise.all(promises)
                .then(results => {
                    const successCount = results.filter(r => r.success).length;
                    showAlert(`Successfully deleted ${successCount} ${recordType}`, 'success');
                    
                    const deleteButton = document.querySelector(`#${tableId}`).closest('.tab-pane').querySelector('.btn-delete');
                    if (deleteButton) deleteButton.style.display = 'none';
                    
                    // Refresh the appropriate table
                    switch (tableId) {
                        case 'fileRecordsTable':
                            loadFileRecords();
                            break;
                        case 'userRecordsTable':
                            loadUserRecords();
                            break;
                        case 'accountRequestsTable':
                            loadAccountRequests();
                            break;
                        case 'docRequestsTable':
                            loadDocRequests();
                            break;
                        case 'returnedDocsTable':
                            loadReturnedDocs();
                            break;
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showAlert('Error deleting records', 'danger');
                });
        }
    });
}

// Filter state
const filterState = {
    files: {
        program: new Set(),
        level: '',
        year: '',
        yearRange: null
    },
    users: {
        userType: new Set(),
        status: '',
        withRequests: false
    }
};

function updateFilterCount(dropdown, count) {
    const countBadge = dropdown.querySelector('.selected-count');
    if (count > 0) {
        countBadge.textContent = count;
        countBadge.classList.add('show');
    } else {
        countBadge.classList.remove('show');
    }
}

// Initialize dropdown filters
document.addEventListener('DOMContentLoaded', function() {
    // Set up dropdown toggles
    document.querySelectorAll('.dropdown-filter button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const menu = this.nextElementSibling;
            const isOpen = menu.classList.contains('show');
            
            // Close all other dropdowns
            document.querySelectorAll('.dropdown-menu.show').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            
            // Toggle this dropdown
            menu.classList.toggle('show');
            
            // Update aria-expanded
            this.setAttribute('aria-expanded', !isOpen);
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-filter')) {
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
});

function setupFilterHandlers() {
    // Program filters (max 3)
    document.querySelectorAll('[value="bsit"], [value="bscs"], [value="bsis"], [value="blis"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked && filterState.files.program.size >= 3) {
                this.checked = false;
                showAlert('Maximum 3 programs can be selected', 'warning');
                return;
            }
            
            if (this.checked) {
                filterState.files.program.add(this.value);
            } else {
                filterState.files.program.delete(this.value);
            }
            
            updateFilterCount(this.closest('.dropdown-filter'), filterState.files.program.size);
            applyFileFilters();
        });
    });

    // Level filter (radio with deselect)
    document.querySelectorAll('input[name="level"]').forEach(radio => {
        radio.addEventListener('click', function() {
            if (this.checked && filterState.files.level === this.value) {
                this.checked = false;
                filterState.files.level = '';
            } else {
                this.checked = true;
                filterState.files.level = this.value;
            }
            updateFilterCount(this.closest('.dropdown-filter'), filterState.files.level ? 1 : 0);
            applyFileFilters();
        });
    });

    // Year filter (radio with deselect)
    document.querySelectorAll('input[name="year"]').forEach(radio => {
        radio.addEventListener('click', function() {
            if (this.checked && filterState.files.year === this.value && this.value !== 'custom') {
                // Allow deselection for non-custom options
                this.checked = false;
                filterState.files.year = '';
                // Hide custom range if showing
                document.getElementById('customYearRange').style.display = 'none';
            } else {
                this.checked = true;
                filterState.files.year = this.value;
                
                // Show/hide custom range based on selection
                if (this.value === 'custom') {
                    document.getElementById('customYearRange').style.display = 'block';
                } else {
                    document.getElementById('customYearRange').style.display = 'none';
                }
            }
            updateFilterCount(this.closest('.dropdown-filter'), filterState.files.year ? 1 : 0);
            if (this.value !== 'custom') {
                applyFileFilters();
            }
        });
    });
    
    // Custom year range apply button
    const applyYearRangeBtn = document.getElementById('applyYearRange');
    if (applyYearRangeBtn) {
        applyYearRangeBtn.addEventListener('click', function() {
            const fromYear = parseInt(document.getElementById('fromYear').value);
            const toYear = parseInt(document.getElementById('toYear').value);
            
            if (isNaN(fromYear) || isNaN(toYear)) {
                showAlert('Please enter valid years', 'warning');
                return;
            }
            
            if (fromYear > toYear) {
                showAlert('From year must be less than To year', 'warning');
                return;
            }
            
            // Set the custom range
            filterState.files.yearRange = [fromYear, toYear];
            
            // Update dropdown button text
            const yearFilterBtn = this.closest('.dropdown-filter').querySelector('button');
            const countBadge = yearFilterBtn.querySelector('.selected-count');
            countBadge.textContent = "1";
            countBadge.classList.add('show');
            
            // Hide the dropdown
            this.closest('.dropdown-menu').classList.remove('show');
            
            // Apply filters
            applyFileFilters();
        });
    }

    // User type filters (max 2)
    document.querySelectorAll('[value="student"], [value="alumni"], [value="faculty"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (this.checked && filterState.users.userType.size >= 2) {
                this.checked = false;
                showAlert('Maximum 2 user types can be selected', 'warning');
                return;
            }
            
            if (this.checked) {
                filterState.users.userType.add(this.value);
            } else {
                filterState.users.userType.delete(this.value);
            }
            
            updateFilterCount(this.closest('.dropdown-filter'), filterState.users.userType.size);
            applyUserFilters();
        });
    });

    // Status filter (radio with deselect)
    document.querySelectorAll('input[name="status"]').forEach(radio => {
        radio.addEventListener('click', function() {
            if (this.checked && filterState.users.status === this.value) {
                this.checked = false;
                filterState.users.status = '';
            } else {
                this.checked = true;
                filterState.users.status = this.value;
            }
            updateFilterCount(this.closest('.dropdown-filter'), filterState.users.status ? 1 : 0);
            applyUserFilters();
        });
    });

    // With requests filter (checkbox)
    document.querySelector('[value="with_requests"]').addEventListener('change', function() {
        filterState.users.withRequests = this.checked;
        applyUserFilters();
    });
}

function applyFileFilters() {
    const searchTerm = document.getElementById('fileSearch').value.toLowerCase();
    
    // Apply filters first
    filteredFileRows = allFileRecords.filter(record => {
        // Search term filter
        const matchesSearch = Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );

        // Program filter
        const matchesProgram = filterState.files.program.size === 0 || 
            filterState.files.program.has(record.course.toLowerCase());

        // Level filter
        const matchesLevel = !filterState.files.level || 
            (filterState.files.level === record.level);

        // Year filter
        let matchesYear = true;
        if (filterState.files.year) {
            const currentYear = new Date().getFullYear();
            const recordYear = parseInt(record.year);
            
            switch(filterState.files.year) {
                case 'current':
                    matchesYear = recordYear === currentYear;
                    break;
                case 'less5':
                    matchesYear = currentYear - recordYear < 5;
                    break;
                case 'more5':
                    matchesYear = currentYear - recordYear >= 5;
                    break;
                case 'custom':
                    if (filterState.files.yearRange) {
                        const [fromYear, toYear] = filterState.files.yearRange;
                        matchesYear = recordYear >= fromYear && recordYear <= toYear;
                    }
                    break;
            }
        }

        return matchesSearch && matchesProgram && matchesLevel && matchesYear;
    });

    // Re-apply current sort if exists
    const currentSortHeader = document.querySelector('#fileRecordsTable th span.asc, #fileRecordsTable th span.desc');
    if (currentSortHeader) {
        const columnIndex = parseInt(currentSortHeader.id.replace('fileRecordsTableHeader', ''));
        const isAsc = currentSortHeader.classList.contains('asc');
        
        filteredFileRows.sort((a, b) => {
            // ... apply same sorting logic as in sortTable ...
            const props = ['documentId', 'fileName', 'author', 'year', 'course'];
            let aValue = a[props[columnIndex - 1]] || '';
            let bValue = b[props[columnIndex - 1]] || '';
            
            return isAsc ? 
                String(aValue).localeCompare(String(bValue)) : 
                String(bValue).localeCompare(String(aValue));
        });
    }

    renderTable('fileRecordsTable', filteredFileRows);
}

function applyUserFilters() {
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
            parseInt(record.requests) > 0;

        return matchesSearch && matchesType && matchesStatus && matchesRequests;
    });

    // Re-apply current sort if exists
    const currentSortHeader = document.querySelector('#userRecordsTable th span.asc, #userRecordsTable th span.desc');
    if (currentSortHeader) {
        const columnIndex = parseInt(currentSortHeader.id.replace('userRecordsTableHeader', ''));
        const isAsc = currentSortHeader.classList.contains('asc');
        
        filteredUserRows.sort((a, b) => {
            // ... apply same sorting logic as in sortTable ...
            const props = ['name', 'email', 'ID', 'userType', 'requests'];
            let aValue = a[props[columnIndex - 1]] || '';
            let bValue = b[props[columnIndex - 1]] || '';
            
            return isAsc ? 
                String(aValue).localeCompare(String(bValue)) : 
                String(bValue).localeCompare(String(aValue));
        });
    }

    renderTable('userRecordsTable', filteredUserRows);
}

function matchesYearFilter(recordYear, filterYear) {
    const currentYear = new Date().getFullYear();
    const year = parseInt(recordYear);
    
    switch(filterYear) {
        case 'current':
            return year === currentYear;
        case 'less5':
            return currentYear - year < 5;
        case 'more5':
            return currentYear - year >= 5;
        default:
            return true;
    }
}

// Update existing filter functions to use the new filter system
function filterFileRecords() {
    applyFileFilters();
}

function filterUserRecords() {
    applyUserFilters();
}

document.addEventListener('DOMContentLoaded', function() {
    
    // Update current year text
    const currentYear = new Date().getFullYear();
    document.getElementById('currentYearText').textContent = currentYear;
    
});

// Copy-to-clipboard function
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showAlert('Text copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text:', err);
        // Fallback to older method if clipboard API fails
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showAlert('Text copied to clipboard!', 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showAlert('Failed to copy text', 'danger');
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

// Add this helper function to convert month number to name
function getMonthName(monthNumber) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[parseInt(monthNumber) - 1] || '';
}

function redirectToHome() {
    // Get admin email from sessionStorage
    const adminEmail = sessionStorage.getItem('adminEmail');
    
    // Get user type and department from PHP session
    fetch('get_user_type.php')
        .then(res => res.json())
        .then(data => {
            // Store admin info in sessionStorage for home page
            sessionStorage.setItem('userAuthenticated', 'true');
            sessionStorage.setItem('user_email', adminEmail);
            sessionStorage.setItem('user_name', 'Admin');
            sessionStorage.setItem('user_type', data.user_type);
            
            // Map department codes to match what home page expects
            const departmentMap = {
                'CICS': 'CICS',  // College of Computing Studies
                'CAS': 'CAS',   // College of Arts and Sciences
                'CEA': 'CEA'    // College of Engineering and Architecture
            };
            
            // Convert department code if it exists in the map
            const mappedDepartment = departmentMap[data.department] || data.department;
            sessionStorage.setItem('department', mappedDepartment);
            
            // Set admin session flag
            sessionStorage.setItem('adminAuthenticated', 'true');
            
            // Redirect to home page
            window.location.href = 'home.html';
        })
        .catch(err => {
            console.error('Error fetching user type:', err);
            // Fallback redirect without department info
            window.location.href = 'home.html';
        });
}

document.addEventListener('DOMContentLoaded', function() {
    // Check if admin is authenticated
    const isAdminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    if (!isAdminAuthenticated) {
        window.location.href = 'admin.html';
    }
});

function downloadPdf(documentId) {
    showConfirmDialog({
        message: 'Do you want to download this document?',
        title: 'Download Confirmation',
        confirmText: 'Download',
        cancelText: 'Cancel',
        onConfirm: () => {
            window.open(`admin_dashboard.php?action=downloadPdf&fileId=${encodeURIComponent(documentId)}`, '_blank');
        }
    });
}

// Custom Dialog Functions
/**
 * Show a custom confirmation dialog
 * @param {string} message - The message to display
 * @param {string} title - The title of the dialog (optional)
 * @param {string} confirmText - The text for the confirm button (optional)
 * @param {string} cancelText - The text for the cancel button (optional)
 * @param {string} dialogType - Dialog type (default, danger, etc.)
 * @param {Function} onConfirm - Function to call when confirmed
 * @returns {Promise} Promise that resolves when the dialog is closed
 */
function showConfirmDialog({ 
    message = 'Are you sure you want to proceed?', 
    title = 'Confirmation', 
    confirmText = 'Confirm', 
    cancelText = 'Cancel',
    dialogType = 'default',
    onConfirm = null
}) {
    return new Promise((resolve) => {
        const dialogOverlay = document.getElementById('customDialog');
        const dialogEl = dialogOverlay.querySelector('.custom-dialog');
        const titleEl = document.getElementById('dialogTitle');
        const messageEl = document.getElementById('dialogMessage');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        const cancelBtn = document.getElementById('dialogCancelBtn');
        
        // Reset dialog state
        dialogEl.className = 'custom-dialog';
        if (dialogType !== 'default') {
            dialogEl.classList.add(dialogType);
        }
        
        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;
        
        // Show dialog with animation
        dialogOverlay.classList.add('show');
        
        // Set up buttons
        const handleConfirm = () => {
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
            closeDialog();
            resolve(true);
        };
        
        const handleCancel = () => {
            closeDialog();
            resolve(false);
        };
        
        // Remove existing event listeners
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        
        // Add new event listeners
        document.getElementById('dialogConfirmBtn').addEventListener('click', handleConfirm);
        document.getElementById('dialogCancelBtn').addEventListener('click', handleCancel);
        
        // Close on escape key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
    });
}

/**
 * Close the custom dialog
 */
function closeDialog() {
    const dialogOverlay = document.getElementById('customDialog');
    dialogOverlay.classList.remove('show');
}

// Replace native confirm with custom dialog
window.originalConfirm = window.confirm;
window.confirm = function(message) {
    return showConfirmDialog({ message });
}

function requestDocument(documentId) {
    // Show confirmation dialog
    showConfirmDialog({
        message: 'Are you sure you want to request this document?',
        title: 'Request Document',
        confirmText: 'Request',
        cancelText: 'Cancel',
        onConfirm: () => {
            // Create form data for the request
            const formData = new FormData();
            formData.append('action', 'requestDocument');
            formData.append('documentId', documentId);

            // Send the request
            fetch('admin_dashboard.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Document requested successfully', 'success');
                    // Refresh the document requests table if it exists
                    if (typeof loadDocRequests === 'function') {
                        loadDocRequests();
                    }
                } else {
                    // Check if the error is about an already reserved document
                    if (data.message && data.message.includes('already requested')) {
                        showAlert('Someone already requested this file', 'warning');
                    } else {
                        showAlert(data.message || 'Error requesting document', 'danger');
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Error requesting document', 'danger');
            });
        }
    });
}

// Add this function to migrate existing reference numbers
function migrateReferenceNumbers() {
    if (confirm('This will update all existing reference numbers to the new format (T001, T002, etc.). Continue?')) {
        fetch('admin_dashboard.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'migrateReferenceNumbers'
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert(data.message, 'success');
                // Refresh all document tables
                loadDocRequests();
                loadReturnedDocs();
                loadDisapprovedDocs();
            } else {
                showAlert(data.message || 'Error updating reference numbers', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error updating reference numbers', 'danger');
        });
    }
}

// Add this function to check if a document is already reserved
let reservedDocuments = new Set(); // This will store IDs of reserved documents

// Function to check if a document is reserved
function checkIfDocumentReserved(documentId) {
    return reservedDocuments.has(documentId);
}

// Update the loadDocRequests function to track reserved documents
function loadDocRequests() {
    // Clear the set of reserved documents
    reservedDocuments.clear();
    
    fetch('admin_dashboard.php?action=getDocRequests')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allDocRequests = [];
                
                data.requests.forEach((request, index) => {
                    // Check if the request is expired
                    const isExpired = request.status === 'reserved' && 
                        new Date(request.date_released) < new Date(Date.now() - 24 * 60 * 60 * 1000);
                    
                    if (isExpired) {
                        return;
                    }
                    
                    // If status is 'reserved', add to the set of reserved documents
                    if (request.status && request.status.toLowerCase() === 'reserved') {
                        reservedDocuments.add(request.document_id);
                    }
                    
                    // ...rest of the existing code...
                });
                
                // After loading requests, refresh file records to update request buttons
                if (typeof loadFileRecords === 'function') {
                    loadFileRecords();
                }
                
                // ...rest of the existing code...
            }
        })
        .catch(error => console.error('Error loading document requests:', error));
}

// Add CSS for disabled action items
document.addEventListener('DOMContentLoaded', function() {
    // Add this style to the document
    const style = document.createElement('style');
    style.textContent = `
        .action-item.disabled {
            opacity: 0.5;
            cursor: not-allowed;
            pointer-events: none;
        }
    `;
    document.head.appendChild(style);
    
    // Load document requests first to populate the reservedDocuments set
    loadDocRequests();
});
