function loadFileRecords() {
    // Check if "See All Programs" is checked
    const seeAllPrograms = document.getElementById('seeAllPrograms')?.checked || false;
    
    // Construct the URL with the see_all parameter
    const url = 'admin_dashboard.php?action=getFiles&see_all=' + (seeAllPrograms ? 'true' : 'false');
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received file records:', data);
            if (data.success) {
                // Store the user type globally and ensure it's lowercase
                window.currentUserType = data.user_type.toLowerCase();
                console.log('Current user type:', window.currentUserType);
                
                // Only update program filter options on first load
                if (data.department && !window.programOptionsInitialized) {
                    updateProgramFilterOptions(data.department);
                    window.programOptionsInitialized = true;
                }
                
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
                
                // Only update the badge count for "See All Programs"
                const seeAllCheckbox = document.getElementById('seeAllPrograms');
                if (seeAllCheckbox) {
                    updateFilterCount(seeAllCheckbox.closest('.dropdown-filter'), seeAllCheckbox.checked ? 1 : 0);
                }
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
                case 'custom':
                    if (filterState.files.yearRange) {
                        const [fromYear, toYear] = filterState.files.yearRange;
                        matchesYear = fileYear >= fromYear && fileYear <= toYear;
                    }
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
        year: '',
        yearRange: null
    };
    
    // Reset checkboxes and radio buttons
    document.querySelectorAll('[value="bsit"], [value="bscs"], [value="bsis"], [value="blis"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    document.querySelectorAll('input[name="level"], input[name="year"]').forEach(radio => {
        radio.checked = false;
    });
    
    // Reset custom year range
    const customYearRange = document.getElementById('customYearRange');
    if (customYearRange) {
        customYearRange.style.display = 'none';
        document.getElementById('fromYear').value = '';
        document.getElementById('toYear').value = '';
    }
    
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

    // Get the PDF viewer modal
    const pdfViewerModal = document.getElementById('pdfViewerModal');
    
    // Get the container for the PDF
    const pdfContainer = document.getElementById('pdfModalContainer');
    
    // Show loading indicator
    pdfContainer.innerHTML = `
        <div class="text-center w-100 my-5">
            <div class="spinner-border" role="status" style="color: #005580;"></div>
            <p class="mt-2 w-100">Loading document...</p>
        </div>`;
    
    // Find the document title from our file records
    const fileRecord = allFileRecords.find(record => record.fileName === fileName);
    const documentTitle = fileRecord ? fileRecord.title || fileName : fileName;
    
    // Set the modal title
    document.getElementById('pdfViewerModalLabel').textContent = documentTitle;
    
    // Show the modal
    const modal = new bootstrap.Modal(pdfViewerModal);
    modal.show();
    
    // Make sure PDF.js is loaded
    if (typeof pdfjsLib === 'undefined') {
        // Load PDF.js if not already loaded
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = function() {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            loadPdfInModal(fileName, pdfContainer);
        };
        document.head.appendChild(script);
    } else {
        // PDF.js is already loaded
        loadPdfInModal(fileName, pdfContainer);
    }
}

// Function to load PDF in modal
function loadPdfInModal(fileName, container) {
    // Set the PDF url
    const pdfUrl = `document.php?view=${encodeURIComponent(fileName)}`;
    
    // Load the PDF
    pdfjsLib.getDocument(pdfUrl).promise.then(async function(pdf) {
        console.log('PDF loaded successfully');
        
        // Clear container
        container.innerHTML = '';
        
        const totalPages = pdf.numPages;
        
        // Style container
        container.style.padding = '0';
        container.style.backgroundColor = 'white';
        
        // Render all pages
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pageContainer = document.createElement('div');
            pageContainer.className = 'pdf-page-container';
            pageContainer.style.margin = '0 auto 20px auto';
            pageContainer.style.backgroundColor = 'white';
            pageContainer.style.position = 'relative'; 
            
            container.appendChild(pageContainer);
            
            try {
                const page = await pdf.getPage(pageNum);
                await renderPageInModal(page, pageNum, pageContainer);
            } catch (error) {
                console.error(`Error rendering page ${pageNum}:`, error);
                pageContainer.innerHTML = `<div class="alert alert-danger">Error rendering page ${pageNum}</div>`;
            }
        }
        
        // Add security measures
        container.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });
        
    }).catch(function(error) {
        console.error('Error loading PDF:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <p><strong>Error loading PDF</strong></p>
                <p>${error.message}</p>
            </div>
        `;
    });
}

// Function to render PDF page on canvas
function renderPageInModal(page, pageNum, container) {
    
    container.style.margin = '12px';
    
    const scale = 1.5;
    const viewport = page.getViewport({ scale: scale });
    
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    
    // Explicitly set all the styles to match CSS
    canvas.style.width = '100%';
    canvas.style.display = 'block';
    canvas.style.margin = '10px auto';
    canvas.style.border = '1px solid #ccc';
    canvas.style.backgroundColor = '#f5f5f5';
    
    container.appendChild(canvas);
    
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    return page.render(renderContext).promise.then(function() {
        // Add CSS to prevent selection
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.msUserSelect = 'none';
        canvas.style.mozUserSelect = 'none';
        
        // Disable dragging
        canvas.ondragstart = function() { return false; };
        
        // Add watermark after page is rendered
        addWatermarkToModal(context, canvas.width, canvas.height);
    });
}

// Function to add watermark to the canvas
function addWatermarkToModal(context, canvasWidth, canvasHeight) {
    const watermark = new Image();
    watermark.src = 'neu-logo.png';
    
    // When image loads, draw it on the canvas
    watermark.onload = function() {
        context.save();
        
        // Calculate size for watermark (big but proportional)
        const watermarkWidth = canvasWidth * 0.6; 
        const watermarkHeight = (watermarkWidth / watermark.width) * watermark.height;
        
        // Position at center
        const x = (canvasWidth - watermarkWidth) / 2;
        const y = (canvasHeight - watermarkHeight) / 2;
        
        // Set transparency
        context.globalAlpha = 0.15; 
        
        // Draw the image
        context.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
        
        // Restore context
        context.restore();
    };
    
    // Handle loading errors
    watermark.onerror = function() {
        console.error('Error loading watermark image');
    };
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
    const formData = new FormData();
    formData.append('action', 'updateFile');
    formData.append('originalDocId', fileData.ID);
    formData.append('newDocId', fileData.ID);
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

// Define the program options for each department
const departmentPrograms = {
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
function updateProgramFilterOptions(department) {
    const dropdown = document.getElementById('programFilterDropdown');
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
    const programs = departmentPrograms[department] || departmentPrograms['CICS']; // Default to CICS if department not found
    
    // Add program options at the beginning of the dropdown
    programs.forEach(program => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = program.value;
        
        // Add event listener to checkbox
        checkbox.addEventListener('change', function() {
            // Uncheck "See All Programs" when any individual program is checked
            const seeAllCheckbox = document.getElementById('seeAllPrograms');
            if (seeAllCheckbox && seeAllCheckbox.checked && this.checked) {
                seeAllCheckbox.checked = false;
            }
            
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
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + program.label));
        
        // Insert at the beginning of the dropdown
        dropdown.insertBefore(label, dropdown.firstChild);
    });
}