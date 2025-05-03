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
                allFileRecords = data.files.map(file => ({
                    index: file.ID,
                    documentId: String(file.ID).padStart(4, '0'),
                    fileName: file.filename,
                    title: file.title || 'N/A',
                    author: file.author || '',
                    year: file.year || '',
                    month: file.month ? getMonthName(file.month) : '',
                    course: convertCourseName(file.course) || ''
                }));
                
                
                
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



function filterFileRecords() {
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
            const fileYear = parseInt(record.year);
            
            switch(filterState.files.year) {
                case 'current':
                    matchesYear = fileYear === currentYear;
                    break;
                case 'less5':
                    matchesYear = currentYear - fileYear < 5;
                    break;
                case 'more5':
                    matchesYear = currentYear - fileYear >= 5;
                    break;
            }
        }

        return matchesSearch && matchesProgram && matchesLevel && matchesYear;
    });

    renderTable('fileRecordsTable', filteredFileRows);
}


// Refresh functions
function refreshFileRecords() {
    showAlert('Refreshing file records...', 'info');
    
    // Reset file filters
    filterState.files = {
        program: new Set(),
        level: '',
        year: ''
    };
    
    // Reset checkboxes and radio buttons
    document.querySelectorAll('[value="bsit"], [value="bscs"], [value="bsis"], [value="blis"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('input[name="level"], input[name="year"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Reset filter count badges
    document.querySelectorAll('#files .dropdown-filter .selected-count').forEach(badge => {
        badge.classList.remove('show');
    });
    
    // Clear search input
    document.getElementById('fileSearch').value = '';
    
    // Reset sorting (clear arrow indicators)
    document.querySelectorAll('#fileRecordsTable th span').forEach(span => {
        span.classList.remove('asc', 'desc');
    });
    
    // Reset filtered rows
    filteredFileRows = [];
    
    loadFileRecords();
}



function viewPdf(fileName) {
    if (!fileName) {
        showAlert('No PDF file available', 'info');
        return;
    }

    // Open the PDF in a new tab using document.php
    window.open(`document.php?view=${encodeURIComponent(fileName)}`, '_blank');
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



// File management functions
function updateFileDetails(fileData) {
    // Get form values
    const formData = new FormData();
    formData.append('action', 'updateFile');
    formData.append('fileId', fileData.ID);
    formData.append('newFileName', document.getElementById('editFileName').value);
    formData.append('title', document.getElementById('editTitle').value);
    formData.append('author', document.getElementById('editAuthor').value);
    formData.append('year', document.getElementById('editYear').value);
    formData.append('course', document.getElementById('editCourse').value);

    // Debug log
    console.log('Sending update with ID:', fileData.ID);

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








// File upload handling--------------------------------------------------------
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
        showAlert("Please Select PDF Files First.", 'primary');
        return;
    }

    const uploadStatus = document.querySelector('.upload-status');
    
    // Clear any previous status
    uploadStatus.style.display = 'block';
    uploadStatus.textContent = 'Preparing files for upload...';
    uploadStatus.style.color = '#005580'; 

    // Disable upload button during upload
    const uploadButton = document.querySelector('.btn-upload');
    uploadButton.disabled = true;

    const formData = new FormData();
    
    // Use selectedFiles array instead of directly accessing input files
    selectedFiles.forEach((file, index) => {
        formData.append('pdfFiles[]', file);
    });

    // Create and configure the AJAX request
    const xhr = new XMLHttpRequest();
    
    xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
            const percentComplete = ((e.loaded / e.total) * 100).toFixed(2);
            uploadStatus.textContent = `Uploading: ${percentComplete}%`;
        }
    };

    xhr.onload = function() {
        try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
                uploadStatus.textContent = 'Upload completed successfully!';
                uploadStatus.style.color = '#198754';
                showAlert('Files uploaded successfully!', 'success');
                loadFileRecords();
                
                // Close the modal after successful upload
                const modal = bootstrap.Modal.getInstance(document.getElementById('fileUploadModal'));
                if (modal) {
                    modal.hide();
                }
            } else {
                throw new Error(response.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Error:', error);
            uploadStatus.textContent = 'Upload failed: ' + error.message;
            uploadStatus.style.color = '#dc3545';
            showAlert('Upload failed: ' + error.message, 'danger');
        }
    };

    xhr.onerror = function() {
        console.error('Upload failed');
        uploadStatus.textContent = 'Upload failed: Network error';
        uploadStatus.style.color = '#dc3545';
        showAlert('Upload failed: Network error', 'danger');
    };

    xhr.onloadend = function() {
        // Re-enable upload button
        uploadButton.disabled = false;
        
        // Clear selection and reset UI after a short delay
        setTimeout(() => {
            selectedFiles = [];
            displaySelectedFiles();
            uploadElements.style.display = 'block';
            document.getElementById('pdfFile').value = '';
            // Keep the status visible for a moment so user can read it
            setTimeout(() => {
                uploadStatus.textContent = '';
            }, 3000);
        }, 1000);
    };

    xhr.open('POST', 'admin_dashboard.php', true);
    xhr.send(formData);
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