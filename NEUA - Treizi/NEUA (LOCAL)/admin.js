// Local Storage Configuration
const LOCAL_STORAGE_BASE = '';  // Base URL for local storage
const API_BASE = '';  // Base URL for API endpoints

// Initialize local auth state
let isAuthenticated = false;

// Initialize data arrays
let allFileRecords = [];
let allUserRecords = [];
let allAccountRequests = [];
let filteredFileRows = [];
let filteredUserRows = [];
let filteredAccountRequests = [];

// Add these variables at the top of the file with other global variables
let originalFileRecords = [];
let originalUserRecords = [];
let originalAccountRequests = [];

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
    loadFileRecords();
    loadUserRecords();
    loadAccountRequests();
    
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

// File upload handling
const dropArea = document.querySelector('.file-box');
const fileInput = document.getElementById("pdfFile");
const fileNameDisplay = document.querySelector(".file-name");
const uploadElements = document.querySelector('.upload-elements');
const uploadStatus = document.querySelector('.upload-status');
const selectedFilesContainer = document.querySelector('.selected-files-container');
let selectedFiles = [];

// Prevent selected files container from triggering file input
selectedFilesContainer.addEventListener('click', function(event) {
    event.stopPropagation();
});

// Handle file input change
fileInput.addEventListener("change", function() {
    const files = Array.from(this.files); // Convert FileList to Array

    if (files.length + selectedFiles.length > 20) {
        showAlert("You can only upload up to 20 PDF files.",'info');
        return;
    }

    // Add new files to the selectedFiles array
    selectedFiles = selectedFiles.concat(files);
    displaySelectedFiles();
    uploadElements.style.display = 'none'; // Hide the upload elements
});

// Handle file drop
dropArea.addEventListener('drop', handleDrop, false);
dropArea.addEventListener('dragover', handleDragOver, false);
dropArea.addEventListener('dragleave', handleDragLeave, false);

function handleDragOver(event) {
    event.preventDefault();
    dropArea.classList.add('dragging');
}

function handleDragLeave(event) {
    event.preventDefault();
    dropArea.classList.remove('dragging');
}

function handleDrop(event) {
    event.preventDefault();
    dropArea.classList.remove('dragging');

    const files = Array.from(event.dataTransfer.files); // Convert FileList to Array

    if (files.length + selectedFiles.length > 20) {
        showAlert("You can only upload up to 20 PDF files.",'info');
        return;
    }

    // Add dropped files to the selectedFiles array
    selectedFiles = selectedFiles.concat(files);
    displaySelectedFiles();
    uploadElements.style.display = 'none'; // Hide upload elements
}

function displaySelectedFiles() {
    const selectedFilesContainer = document.querySelector('.selected-files-container');
    selectedFilesContainer.innerHTML = ''; // Clear the container

    if (!selectedFiles.length) {
        uploadElements.style.display = 'block'; // Show upload elements if no files
        return;
    }

    uploadElements.style.display = 'none'; // Hide upload elements if files are selected

    selectedFiles.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'selected-file';

        const isValidFile = file.type.match('application/pdf');
        fileElement.innerHTML = `
            <i class="fas ${isValidFile ? 'fa-file-pdf' : 'fa-triangle-exclamation'} file-icon"></i>
            <span class="file-name">${file.name}</span>
            <button type="button" class="remove-file" onclick="removeSpecificFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Highlight invalid files
        if (!isValidFile) {
            fileElement.classList.add('invalid-file');
        }

        selectedFilesContainer.appendChild(fileElement);
    });
}

function removeSpecificFile(index) {
    selectedFiles.splice(index, 1);
    displaySelectedFiles();
    
    // If no files left, show upload elements again
    if (selectedFiles.length === 0) {
        uploadElements.style.display = 'block';
    }
}

function removeFile() {
    selectedFiles = [];
    displaySelectedFiles();
    uploadElements.style.display = 'block';
    uploadStatus.textContent = '';
    uploadStatus.style.color = '#002635';
}

// Update modal reset
document.getElementById('fileUploadModal').addEventListener('hidden.bs.modal', function () {
    selectedFiles = [];
    displaySelectedFiles();
    uploadElements.style.display = 'block';
    uploadStatus.textContent = '';
    document.getElementById('pdfFile').value = '';
});

// Handle Upload button click
document.querySelector(".btn-upload").addEventListener("click", handleUpload);

function handleUpload() {
    if (selectedFiles.length === 0) {
        showAlert("Please Select PDF Files First.",'primary');
        return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file, index) => {
        formData.append('pdfFiles[]', file);
    });

    fetch('admin_dashboard.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Files uploaded successfully!', 'success');
            loadFileRecords(); // Refresh the file list
        } else {
            showAlert(data.message || 'Upload failed', 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Upload failed', 'danger');
    })
    .finally(() => {
        // Clear selection
        selectedFiles = [];
        displaySelectedFiles();
        uploadElements.style.display = 'block';
        document.getElementById('pdfFile').value = '';
    });
}

// Function to extract PDF metadata using PDF.js
async function extractMetadata(url) {
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        const metadata = await pdf.getMetadata();

        return {
            title: metadata.info.Title || null,
            author: metadata.info.Author || null,
            subject: metadata.info.Subject || null,
            keywords: metadata.info.Keywords || null,
            creationDate: metadata.info.CreationDate || null,
            modificationDate: metadata.info.ModDate || null,
            creator: metadata.info.Creator || null,
            producer: metadata.info.Producer || null
        };
    } catch (error) {
        console.error('Error extracting metadata:', error);
        return {}; // Return empty object on error
    }
}

// Function to extract text from PDF using PDF.js
async function extractTextFromPDF(url) {
    try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            text += pageText + ' ';
        }

        return text.trim();
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        return ''; // Return empty string on error
    }
}

function sortTable(tableId, columnIndex) {
    let records;
    if (tableId === 'fileRecordsTable') {
        records = filteredFileRows.length > 0 ? filteredFileRows : allFileRecords;
        // Store original order if not already stored
        if (originalFileRecords.length === 0) {
            originalFileRecords = [...records];
        }
    } else if (tableId === 'userRecordsTable') {
        records = filteredUserRows.length > 0 ? filteredUserRows : allUserRecords;
        // Store original order if not already stored
        if (originalUserRecords.length === 0) {
            originalUserRecords = [...records];
        }
    } else if (tableId === 'accountRequestsTable') {
        records = filteredAccountRequests.length > 0 ? filteredAccountRequests : allAccountRequests;
        // Store original order if not already stored
        if (originalAccountRequests.length === 0) {
            originalAccountRequests = [...records];
        }
    } else {
        return;
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

    // If default state, return to original order
    if (nextState === 'default') {
        // Get original records based on table type
        if (tableId === 'fileRecordsTable') {
            records = [...originalFileRecords];
        } else if (tableId === 'userRecordsTable') {
            records = [...originalUserRecords];
        } else if (tableId === 'accountRequestsTable') {
            records = [...originalAccountRequests];
        }
    } else {
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
                    const requestProps = ['name', 'email', 'ID', 'userType'];
                    aValue = a[requestProps[columnIndex - 1]] || '';
                    bValue = b[requestProps[columnIndex - 1]] || '';
                    break;
            }

            // Convert to appropriate type for comparison
            if (columnIndex === 1 && tableId === 'fileRecordsTable') {
                // For file ID, convert to number
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
                return nextState === 'asc' ? aValue - bValue : bValue - aValue;
            } else if (columnIndex === 5 && tableId === 'userRecordsTable') {
                // For requests count, convert to number
                aValue = parseInt(aValue) || 0;
                bValue = parseInt(bValue) || 0;
                return nextState === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                // For all other columns, use string comparison
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
                return nextState === 'asc' ? 
                    aValue.localeCompare(bValue) : 
                    bValue.localeCompare(aValue);
            }
        });
    }

    // Set arrow class based on next state
    if (nextState !== 'default') {
        headerSpan.classList.add(nextState);
    }

    // Update the appropriate records array
    if (tableId === 'fileRecordsTable') {
        if (filteredFileRows.length > 0) {
            filteredFileRows = records;
        } else {
            allFileRecords = records;
        }
    } else if (tableId === 'userRecordsTable') {
        if (filteredUserRows.length > 0) {
            filteredUserRows = records;
        } else {
            allUserRecords = records;
        }
    } else if (tableId === 'accountRequestsTable') {
        if (filteredAccountRequests.length > 0) {
            filteredAccountRequests = records;
        } else {
            allAccountRequests = records;
        }
    }

    // Re-render the table
    renderTable(tableId, records);
}

let rowsPerPage = 20;

function changeRowsPerPage() {
    rowsPerPage = parseInt(document.getElementById('rowsPerPage').value);
    renderTable('fileRecordsTable', filteredFileRows.length > 0 ? filteredFileRows : allFileRecords);
    renderTable('userRecordsTable', filteredUserRows.length > 0 ? filteredUserRows : allUserRecords);
    renderTable('accountRequestsTable', filteredAccountRequests.length > 0 ? filteredAccountRequests : allAccountRequests);
}

// Pagination logic
function setupPagination(tableId, rows) {
    const pagination = document.getElementById(`${tableId}Pagination`);
    if (!pagination) {
        console.error(`Pagination container for ${tableId} not found`);
        return;
    }

    let currentPage = 1;

    function showPage(page) {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;

        rows.forEach((row, index) => {
            row.style.display = (index >= start && index < end) ? '' : 'none';
        });

        updatePaginationButtons(page);
    }

    function updatePaginationButtons(page) {
        pagination.innerHTML = '';
        const totalPages = Math.ceil(rows.length / rowsPerPage);

        const createButton = (iconClass, pageNum, disabled = false) => {
            const button = document.createElement('button');
            button.disabled = disabled;

            // Create an icon element
            const icon = document.createElement('i');
            icon.className = iconClass;

            // Append the icon to the button
            button.appendChild(icon);

            // Add click event listener
            button.addEventListener('click', () => {
                currentPage = pageNum;
                showPage(currentPage);
            });

            return button;
        };

        // Previous Button
        const prevButton = createButton('fa-solid fa-chevron-left', currentPage - 1, currentPage === 1);
        pagination.appendChild(prevButton);

        // Page Number Buttons
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.disabled = i === currentPage;
            pageButton.addEventListener('click', () => {
                currentPage = i;
                showPage(currentPage);
            });
            pagination.appendChild(pageButton);
        }

        // Next Button
        const nextButton = createButton('fa-solid fa-chevron-right', currentPage + 1, currentPage === totalPages);
        pagination.appendChild(nextButton);
    }

    showPage(currentPage);
}

// Call setupPagination after loading records

// Replace loadFileRecords with local implementation
function loadFileRecords() {
    fetch('admin_dashboard.php?action=getFiles')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received file records:', data);
            if (data.success) {
                allFileRecords = data.files.map((file, index) => ({
                    index: index + 1,
                    documentId: file.name.split('.')[0],
                    fileName: file.name,
                    author: file.author || '',
                    year: file.year || '',
                    course: convertCourseName(file.course) || ''
                }));
                
                // Update file count in dashboard
                const fileCountElement = document.querySelector('.dashboard-stats .stat:nth-child(1) h3');
                if (fileCountElement) {
                    fileCountElement.textContent = allFileRecords.length;
                }
                
                renderTable('fileRecordsTable', allFileRecords);
            } else {
                console.error('Failed to load files:', data.message);
                showAlert('Failed to load file records: ' + data.message, 'danger');
            }
        })
        .catch(error => {
            console.error('Error loading file records:', error);
            showAlert('Failed to load file records. Check console for details.', 'danger');
        });
}

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
                        status: user.status || 'active'
                    };
                    
                    // Ensure all fields are strings for consistent filtering
                    Object.keys(row).forEach(key => {
                        if (key !== 'certificate_url') {
                            row[key] = String(row[key]);
                        }
                    });
                    allUserRecords.push(row);
                });

                // Update user count in dashboard
                document.querySelector('.dashboard-stats .stat:nth-child(2) h3').textContent = allUserRecords.length;
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

function loadAccountRequests() {
    fetch('admin_dashboard.php?action=getPendingUsers')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received account requests:', data);
            if (data.success) {
                const accountRequestsTable = document.getElementById('accountRequestsTable').getElementsByTagName('tbody')[0];
                accountRequestsTable.innerHTML = '';
                allAccountRequests = [];
                
                data.pendingUsers.forEach((user, index) => {
                    const row = {
                        index: index + 1,
                        name: user.name || '',
                        email: user.email || '',
                        ID: user.user_id || '',
                        userType: user.user_type || '',
                        certificateURL: user.certificate_url || '',
                        requestId: user.requestId || ''
                    };
                    allAccountRequests.push(row);
                });

                // Update account requests count in dashboard
                document.querySelector('.dashboard-stats .stat:nth-child(3) h3').textContent = allAccountRequests.length;
                renderTable('accountRequestsTable', allAccountRequests);
            } else {
                console.error('Failed to load requests:', data.message);
                showAlert('Failed to load account requests: ' + data.message, 'danger');
            }
        })
        .catch(error => {
            console.error('Error loading account requests:', error);
            showAlert('Failed to load account requests. Check console for details.', 'danger');
        });
}

// Add this helper function for course name conversion
function convertCourseName(course) {
    if (!course) return '';
    
    const courseMap = {
        'information technology': 'BSIT',
        'computer science': 'BSCS',
        'information systems': 'BSIS',
        'library information science': 'BLIS'
    };
    
    const lowercaseName = course.toLowerCase();
    return courseMap[lowercaseName] || course;
}

function filterFileRecords() {
    const searchTerm = document.getElementById('fileSearch').value.toLowerCase();
    filteredFileRows = allFileRecords.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    renderTable('fileRecordsTable', filteredFileRows);
}

// Fix user records search functionality
function filterUserRecords() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    filteredUserRows = allUserRecords.filter(record => {
        return Object.values(record).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });
    renderTable('userRecordsTable', filteredUserRows);
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

    records.forEach((record, index) => {
        const row = tbody.insertRow();
        
        // Add checkbox cell for all tables
        const checkboxCell = row.insertCell();
        checkboxCell.innerHTML = `<input type="checkbox" onchange="handleCheckboxClick('${tableId}', this)">`;
        
        switch (tableId) {
            case 'fileRecordsTable':
                // Add cells for file records
                const docIdCell = row.insertCell();
                docIdCell.textContent = record.documentId || '';
                
                const fileNameCell = row.insertCell();
                fileNameCell.textContent = record.fileName || '';
                
                const authorCell = row.insertCell();
                authorCell.textContent = record.author || '';
                
                const yearCell = row.insertCell();
                yearCell.textContent = record.year || '';
                
                const courseCell = row.insertCell();
                courseCell.textContent = record.course || '';

                // Add actions column
                const actionsCell = row.insertCell();
                actionsCell.className = 'actions';
                actionsCell.innerHTML = `
                    <div class="actions-dropdown">
                        <button class="btn btn-sm" onclick="toggleActionsMenu(this)">
                            <i class="fas fa-ellipsis"></i>
                        </button>
                        <div class="actions-menu">
                            <div class="action-item" onclick="viewPdf('${record.fileName}')">
                                <i class="fas fa-eye"></i>View
                            </div>
                            <div class="action-item" onclick="editRow(this.closest('.actions-dropdown'))">
                                <i class="fas fa-edit"></i>Edit
                            </div>
                        </div>
                    </div>`;
                break;

            case 'userRecordsTable':
                const nameCell = row.insertCell();
                nameCell.textContent = record.name || '';
                
                const emailCell = row.insertCell();
                emailCell.textContent = record.email || '';
                
                const idCell = row.insertCell();
                idCell.textContent = record.ID || '';
                
                const userTypeCell = row.insertCell();
                const userTypeSpan = document.createElement('span');
                userTypeSpan.className = `user-type ${(record.userType || '').toLowerCase()}`;
                userTypeSpan.textContent = record.userType || '';
                userTypeCell.appendChild(userTypeSpan);
                
                const requestsCell = row.insertCell();
                requestsCell.textContent = record.requests || '0';

                // Add actions column with data attributes for user identification
                const userActionsCell = row.insertCell();
                userActionsCell.className = 'actions';
                const isActive = record.status !== 'deactivated';
                userActionsCell.innerHTML = `
                    <div class="actions-dropdown" data-user-id="${record.ID}">
                        <button class="btn btn-sm action-button" onclick="toggleActionsMenu(this)">
                            <i class="fas fa-ellipsis"></i>
                        </button>
                        <div class="actions-menu">
                            <div class="action-item" onclick="viewUser('${record.name}', '${record.email}', '${record.ID}', '${record.userType}', '${record.created_at || ''}', '${record.certificate_url || ''}')">
                                <i class="fas fa-eye"></i>View
                            </div>
                            <div class="action-item" onclick="editRow(this.closest('.actions-dropdown'))">
                                <i class="fas fa-edit"></i>Edit
                            </div>
                            <div class="action-item ${isActive ? 'deactivate-action' : 'activate-action'}" onclick="toggleUserStatus('${record.ID}', ${isActive})">
                                <i class="fas ${isActive ? 'fa-circle-minus' : 'fa-circle0check'}"></i>${isActive ? 'Deactivate' : 'Activate'}
                            </div>
                        </div>
                    </div>`;
                break;

            case 'accountRequestsTable':
                // Add cells for account requests
                const reqNameCell = row.insertCell();
                reqNameCell.textContent = record.name || '';
                
                const reqEmailCell = row.insertCell();
                reqEmailCell.textContent = record.email || '';
                
                const reqIdCell = row.insertCell();
                reqIdCell.textContent = record.ID || '';
                
                const reqTypeCell = row.insertCell();
                const reqTypeSpan = document.createElement('span');
                reqTypeSpan.className = `user-type ${(record.userType || '').toLowerCase()}`;
                reqTypeSpan.textContent = record.userType || '';
                reqTypeCell.appendChild(reqTypeSpan);

                // Certificate cell
                const certCell = row.insertCell();
                const viewButton = document.createElement('button');
                viewButton.className = 'btn btn-sm btn-outline-secondary';
                viewButton.innerHTML = 'View';
                viewButton.onclick = () => window.open(record.certificateURL, '_blank');
                certCell.appendChild(viewButton);

                // Actions cell
                const reqActionsCell = row.insertCell();
                reqActionsCell.className = 'actions';
                reqActionsCell.innerHTML = `
                    <div class="actions-dropdown" data-request-id="${record.requestId}">
                        <button class="btn btn-sm" onclick="acceptRequest('${record.requestId}', ${JSON.stringify(record)})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-sm" onclick="rejectRequest('${record.requestId}')">
                            <i class="fas fa-times"></i>
                        </button>`;
                break;
        }
    });

    setupPagination(tableId, Array.from(tbody.getElementsByTagName('tr')));
}

function viewPdf(fileName) {
    if (!fileName) {
        showAlert('No PDF file available', 'info');
        return;
    }

    // Open the PDF in a new tab using the local path
    window.open(`pdfs/${fileName}`, '_blank');
}

function viewUser(name, email, ID, userType, creationDate, certificateURL) {
    // Populate the modal with user details
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

    // Handle certificate image
    const certificateImage = document.getElementById('certificateImage');
    const certificateContainer = document.getElementById('viewCertificate');
    
    if (certificateURL && certificateURL !== 'undefined') {
        certificateImage.src = certificateURL;
        certificateContainer.style.display = 'block';
    } else {
        certificateContainer.style.display = 'none';
    }

    // Show the modal
    const viewUserModal = new bootstrap.Modal(document.getElementById('viewUser'));
    viewUserModal.show();
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

// Refresh functions
function refreshFileRecords() {
    showAlert('Refreshing file records...', 'info');
    loadFileRecords();
}

function refreshUserRecords() {
    showAlert('Refreshing user records...', 'info');
    loadUserRecords();
}

function refreshAccountRequestsRecords() {
    showAlert('Refreshing account requests...', 'info');
    loadAccountRequests();
}

// Add arrow icons to headers (excluding the Actions column)
document.addEventListener('DOMContentLoaded', () => {
    const tables = ['fileRecordsTable', 'userRecordsTable', 'accountRequestsTable'];
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
    const tables = ['fileRecordsTable', 'userRecordsTable', 'accountRequestsTable'];
    tables.forEach(tableId => {
        const headers = document.querySelectorAll(`#${tableId} th:not(.actions)`);
        headers.forEach((header, index) => {
            const span = document.createElement('span');
            span.id = `${tableId}Header${index}`;
            span.innerHTML = ''; // No initial arrow
            header.appendChild(span);
        });
    });
});

function editRow(dropdown) {
    const row = dropdown.closest('tr');
    const cells = row.querySelectorAll('td');
    const menuButton = dropdown.querySelector('button');
    
    // Enter edit mode
    row.classList.add('edit-mode');
    
    // Store original values for potential cancel
    row.dataset.originalValues = JSON.stringify(
        Array.from(cells)
            .filter((_, index) => index !== 0 && index !== 4 && index !== cells.length - 1 && !cells[index].classList.contains('uneditable'))
            .map(cell => cell.textContent)
    );
    
    cells.forEach((cell, index) => {
        if (index !== 0 && index !== 4 && index !== cells.length - 1 && !cell.classList.contains('uneditable')) {
            const originalContent = cell.innerText;
            cell.innerHTML = `<input type="text" value="${originalContent}">`;
        }
    });
    
    // Check and cancel icons
    menuButton.innerHTML = `
        <i class="fas fa-check" onclick="saveChanges(this.closest('tr')); event.stopPropagation();"></i>
        <i class="fas fa-times" onclick="cancelEdit(this.closest('tr')); event.stopPropagation();" style="margin-left: 8px;"></i>
    `;
    
    // Close the dropdown
    dropdown.querySelector('.actions-menu').classList.remove('show');
}

function cancelEdit(row) {
    const cells = row.querySelectorAll('td');
    const originalValues = JSON.parse(row.dataset.originalValues);
    const menuButton = row.querySelector('.actions-dropdown button');
    let valueIndex = 0;
    
    cells.forEach((cell, index) => {
        if (index !== 0 && index !== 4 && index !== cells.length - 1 && !cell.classList.contains('uneditable')) {
            cell.textContent = originalValues[valueIndex];
            valueIndex++;
        }
    });
    
    // Reset button to three dots and remove edit mode
    menuButton.innerHTML = '<i class="fas fa-ellipsis"></i>';
    row.classList.remove('edit-mode');
}

function saveChanges(row) {
    const cells = row.querySelectorAll('td');
    const tableId = row.closest('table').id;
    const updatedData = {};
    const menuButton = row.querySelector('.actions-dropdown button');
    
    cells.forEach((cell, index) => {
        if (index !== 0 && index !== cells.length - 1 && !cell.classList.contains('uneditable')) {
            const input = cell.querySelector('input');
            if (input) {
                const newValue = input.value;
                cell.textContent = newValue;
                
                // Map column index to field name
                let fieldName;
                if (tableId === 'fileRecordsTable') {
                    fieldName = ['fileName', 'author', 'year', 'course'][index - 1];
                } else if (tableId === 'userRecordsTable') {
                    fieldName = ['name', 'email', 'ID', 'userType'][index - 1];
                }
                
                if (fieldName) {
                    updatedData[fieldName] = newValue;
                }
            }
        }
    });

    if (Object.keys(updatedData).length > 0) {
        const formData = new FormData();
        formData.append('action', tableId === 'fileRecordsTable' ? 'updateFile' : 'updateUser');
        
        // Add the identifier and updated data
        if (tableId === 'fileRecordsTable') {
            formData.append('originalFileName', row.cells[1].textContent);
            formData.append('newFileName', updatedData.fileName || row.cells[1].textContent);
            formData.append('author', updatedData.author || '');
            formData.append('year', updatedData.year || '');
            formData.append('course', updatedData.course || '');
        } else if (tableId === 'userRecordsTable') {
            formData.append('userId', row.querySelector('[data-user-id]').getAttribute('data-user-id'));
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

function deleteRow(dropdown) {
    const row = dropdown.closest('tr');
    const tableId = row.closest('table').id;
    
    if (tableId === 'fileRecordsTable') {
        const fileName = row.cells[1].textContent; // Get filename from second column
        if (confirm(`Are you sure you want to delete ${fileName}?`)) {
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
    } else if (tableId === 'userRecordsTable') {
        const userId = row.querySelector('[data-user-id]').getAttribute('data-user-id');
        if (confirm('Are you sure you want to delete this user?')) {
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

// Copy-to-clipboard function
function copyToClipboard(text) {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    
    // Select and copy the text
    textarea.select();
    try {
        document.execCommand('copy');
        showAlert('Text copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text:', err);
        showAlert('Failed to copy text', 'danger');
    }
    
    // Remove the temporary textarea
    document.body.removeChild(textarea);
}

// File management functions
function updateFileDetails(originalFileName) {
    const newFileName = document.getElementById('editFileName').value;
    const author = document.getElementById('editAuthor').value;
    const year = document.getElementById('editYear').value;
    const course = document.getElementById('editCourse').value;

    const formData = new FormData();
    formData.append('action', 'updateFile');
    formData.append('originalFileName', originalFileName);
    formData.append('newFileName', newFileName);
    formData.append('author', author);
    formData.append('year', year);
    formData.append('course', course);

    fetch('admin_dashboard.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('File details updated successfully', 'success');
            loadFileRecords(); // Refresh the file list
            const modal = bootstrap.Modal.getInstance(document.getElementById('editFileModal'));
            modal.hide();
        } else {
            showAlert(data.message || 'Error updating file details', 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error updating file details', 'danger');
    });
}

// User management functions
function createUser(event) {
    event.preventDefault();
    
    const formData = new FormData(document.getElementById('signupForm'));
    formData.append('action', 'createUserDirectly');

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

function acceptRequest(requestId, userData) {
    if (confirm('Are you sure you want to approve this account request?')) {
        const formData = new FormData();
        formData.append('action', 'approveUser');
        formData.append('requestId', requestId);

        fetch('admin_dashboard.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Account request approved successfully', 'success');
                loadAccountRequests(); // Refresh requests
                loadUserRecords(); // Refresh user list
            } else {
                showAlert(data.message || 'Error approving request', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error approving request', 'danger');
        });
    }
}

function rejectRequest(requestId) {
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

// Alert handling
function showAlert(message, type) {
    const alertElement = document.getElementById('customAlert');
    const alertMessage = document.getElementById('alertMessage');
    const alertIcon = document.querySelector('.alert-icon');
    
    alertElement.className = `custom-alert alert alert-${type} show`;
    alertMessage.textContent = message;
    
    // Set icon based on alert type
    switch(type) {
        case 'success':
            alertIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            break;
        case 'danger':
            alertIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            break;
        case 'warning':
            alertIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'info':
        case 'primary':
            alertIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
            break;
    }
    
    // Show alert
    alertElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideAlert();
    }, 5000);
}

function hideAlert() {
    const alertElement = document.getElementById('customAlert');
    alertElement.className = 'custom-alert alert';
    alertElement.style.display = 'none';
}

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

// Replace deleteSelectedFiles with local implementation
function deleteSelectedFiles() {
    const checkboxes = document.querySelectorAll('#fileRecordsTable input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        showAlert('Please select files to delete', 'warning');
        return;
    }

    if (confirm(`Are you sure you want to delete ${checkboxes.length} file(s)?`)) {
        const filesToDelete = Array.from(checkboxes).map(checkbox => {
            const row = checkbox.closest('tr');
            return row.cells[1].textContent; // Get filename from second column
        });

        const promises = filesToDelete.map(filename =>
            fetch(`admin_dashboard.php?action=deleteFile&file=${encodeURIComponent(filename)}`)
                .then(response => response.json())
        );

        Promise.all(promises)
            .then(results => {
                const successCount = results.filter(r => r.success).length;
                showAlert(`Successfully deleted ${successCount} file(s)`, 'success');
                loadFileRecords();
            })
            .catch(error => {
                console.error('Error deleting files:', error);
                showAlert('Error deleting some files', 'danger');
            });
    }
}

// Add drag and drop event listeners
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    dropArea.classList.add('highlight');
}

function unhighlight(e) {
    dropArea.classList.remove('highlight');
}

// Update file display functions
function displaySelectedFiles() {
    const selectedFilesContainer = document.querySelector('.selected-files-container');
    selectedFilesContainer.innerHTML = ''; // Clear the container

    if (!selectedFiles.length) {
        uploadElements.style.display = 'block'; // Show upload elements if no files
        return;
    }

    uploadElements.style.display = 'none'; // Hide upload elements if files are selected

    selectedFiles.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'selected-file';

        const isValidFile = file.type.match('application/pdf');
        fileElement.innerHTML = `
            <i class="fas ${isValidFile ? 'fa-file-pdf' : 'fa-triangle-exclamation'} file-icon"></i>
            <span class="file-name">${file.name}</span>
            <button type="button" class="remove-file" onclick="removeSpecificFile(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Highlight invalid files
        if (!isValidFile) {
            fileElement.classList.add('invalid-file');
        }

        selectedFilesContainer.appendChild(fileElement);
    });
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

// Add event listeners for search inputs
document.addEventListener('DOMContentLoaded', () => {
    const fileSearch = document.getElementById('fileSearch');
    const userSearch = document.getElementById('userSearch');
    const accountRequestSearch = document.getElementById('accountRequestSearch');

    if (fileSearch) {
        fileSearch.addEventListener('input', filterFileRecords);
    }
    if (userSearch) {
        userSearch.addEventListener('input', filterUserRecords);
    }
    if (accountRequestSearch) {
        accountRequestSearch.addEventListener('input', filterAccountRequests);
    }

    // Initialize tables
    loadFileRecords();
    loadUserRecords();
    loadAccountRequests();
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
                      tableId === 'userRecordsTable' ? 'users' : 'account requests';
    
    if (confirm(`Are you sure you want to delete ${selectedRows.length} ${recordType}?`)) {
        const promises = Array.from(selectedRows).map(checkbox => {
            const row = checkbox.closest('tr');
            const formData = new FormData();
            
            if (tableId === 'fileRecordsTable') {
                const fileName = row.cells[1].textContent;
                formData.append('action', 'deleteFile');
                formData.append('file', fileName);
            } else if (tableId === 'userRecordsTable') {
                const userId = row.querySelector('[data-user-id]').getAttribute('data-user-id');
                formData.append('action', 'deleteUser');
                formData.append('userId', userId);
            } else if (tableId === 'accountRequestsTable') {
                const requestId = row.querySelector('[data-request-id]').getAttribute('data-request-id');
                formData.append('action', 'rejectUser');
                formData.append('requestId', requestId);
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
                
                // Refresh the appropriate table
                if (tableId === 'fileRecordsTable') {
                    loadFileRecords();
                } else if (tableId === 'userRecordsTable') {
                    loadUserRecords();
                } else if (tableId === 'accountRequestsTable') {
                    loadAccountRequests();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Error deleting records', 'danger');
            });
    }
}

function toggleUserStatus(userId, isCurrentlyActive) {
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
        const formData = new FormData();
        formData.append('action', 'toggleUserStatus');
        formData.append('userId', userId);
        formData.append('status', isCurrentlyActive ? 'deactivated' : 'active');

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