const firebaseConfig = {
    apiKey: "AIzaSyC8eu7JXiwb7cxm0Vnq3JJ0wJqGgZanJ_w",
    authDomain: "neua-5f9cd.firebaseapp.com",
    databaseURL: "https://neua-5f9cd-default-rtdb.firebaseio.com",
    projectId: "neua-5f9cd",
    storageBucket: "neua-5f9cd.appspot.com",
    messagingSenderId: "259473631559",
    appId: "1:259473631559:web:e53ce11445550f5ad6c462",
    measurementId: "G-QW3J7JZENG"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
const db = firebase.firestore();

const searchPhrases = [
    "Bachelor of Science in Information Technology",
    "Bachelor of Science in Computer Science",
    "Bachelor of Science in Information Systems",
    "Bachelor of Library and Information Science",
];
document.addEventListener("DOMContentLoaded", function() {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const fiveYearsAgo = currentYear - 5;

    document.getElementById("lastYear").textContent = `Since ${lastYear}`;
    document.getElementById("fiveYearsAgo").textContent = `Since ${fiveYearsAgo}`;

    // Set data-value attributes for selection logic
    document.getElementById("lastYear").setAttribute("data-value", `Since ${lastYear}`);
    document.getElementById("fiveYearsAgo").setAttribute("data-value", `Since ${fiveYearsAgo}`);
});

// Variables for pagination and filtering
let currentPage = 1;
const resultsPerPage = 20;
let selectedCategory = 'Any Field';
let selectedYear = '';
let sortByDate = false;

// Function to handle Archival Resources link click
function handleArchivalResourcesClick(event) {
    event.preventDefault();
    selectedYear = ''; // Reset year filter
    // selectedCategory = 'Any Field';  <-- Remove this line!
    sortByDate = true;
    currentPage = 1;

    // Update dropdowns visually
    const dropdownBtn = document.getElementById('dropdownBtn');
    if (dropdownBtn) {
        dropdownBtn.innerHTML = `Sort by date <i class="fa-solid fa-chevron-down"></i>`;
    }

    // Perform search
    searchDocuments('');
    history.pushState(null, '', 'searchdocu.html?sort=year');
}


function searchDocuments(searchQuery, page = 1) {
    const documentList = document.getElementById('documentList');
    documentList.innerHTML = ''; // Clear previous results
    currentPage = page;

    db.collection('pdfMetadata').get().then((querySnapshot) => {
        const allDocs = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Category-based filtering
            let categoryMatch = false;
            switch (selectedCategory) {
                case 'Title':
                    categoryMatch = data.fileName && 
                        (searchQuery === '' || data.fileName.toLowerCase().includes(searchQuery.toLowerCase()));
                    break;
                case 'Author':
                    categoryMatch = data.metadata?.author && 
                        (searchQuery === '' || data.metadata.author.toLowerCase().includes(searchQuery.toLowerCase()));
                    break;
                case 'Abstract':
                    categoryMatch = data.metadata?.abstract && 
                        (searchQuery === '' || data.metadata.abstract.toLowerCase().includes(searchQuery.toLowerCase()));
                    break;
                case 'Any Field':
                default:
                    // Only search within title, author, and abstract fields
                    categoryMatch = searchQuery === '' || 
                        (data.fileName && data.fileName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (data.metadata?.author && data.metadata.author.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (data.metadata?.abstract && data.metadata.abstract.toLowerCase().includes(searchQuery.toLowerCase()));
                    break;
            }

            // Year filtering
            let yearMatch = true;
            if (selectedYear && selectedYear !== 'Any time') {
                let creationDate = data.metadata?.creationDate || '';
                const creationDateMatch = creationDate.match(/^D:(\d{4})(\d{2})/);
                if (creationDateMatch) {
                    const year = parseInt(creationDateMatch[1]);
                    const minYear = parseInt(selectedYear.replace('Since ', '').trim());
                    yearMatch = year >= minYear;
                } else {
                    yearMatch = false;
                }
            }

            // Combine category and year filters
            if (categoryMatch && yearMatch) {
                allDocs.push(data);
            }
        });

        // Sorting logic
        allDocs.sort((a, b) => {
            const getYear = (doc) => {
                const creationDate = doc.metadata?.creationDate || '';
                const match = creationDate.match(/^D:(\d{4})/);
                return match ? parseInt(match[1]) : 0;
            };

            const yearA = getYear(a);
            const yearB = getYear(b);

            if (sortByDate) {
                return yearB - yearA; // Descending order when sorting by date
            }

            return yearB - yearA; // Default to descending order
        });

        const totalResults = allDocs.length;

        const resultElement = document.getElementById('result');
        if (totalResults === 0) {
            resultElement.innerHTML = searchQuery
                ? `No results were found for <span class="bold">${searchQuery}</span> in <span class="bold">${selectedCategory}</span>`
                : 'No results were found.';
        } else if (totalResults === 1) {
            resultElement.innerHTML = searchQuery
                ? `<span class="bold">${totalResults}</span> Result found for <span class="bold">${searchQuery}</span> in <span class="bold">${selectedCategory}</span>`
                : `<span class="bold">${totalResults}</span> Result found`;
        } else {
            resultElement.innerHTML = searchQuery
                ? `<span class="bold">${totalResults}</span> Results found for <span class="bold">${searchQuery}</span> in <span class="bold">${selectedCategory}</span>`
                : `<span class="bold">${totalResults}</span> Results found`;
        }

        const totalPages = Math.ceil(totalResults / resultsPerPage);
        const startIndex = (currentPage - 1) * resultsPerPage;
        const endIndex = startIndex + resultsPerPage;

        const docsToShow = allDocs.slice(startIndex, endIndex);

        docsToShow.forEach((data) => {
            const card = document.createElement('div');
            card.classList.add('card');

            card.style.textDecoration = 'none';
            card.style.border = '2px solid #ccc';
            card.style.borderRadius = '12px';

            card.addEventListener('mouseover', function() {
                this.style.border = '2px solid #00415a'; 
            });

            card.addEventListener('mouseout', function() {
                this.style.border = '2px solid #ccc'; 
            });

            const cardBody = document.createElement('div');
            cardBody.classList.add('card-body');

            const title = document.createElement('p');
            title.id = 'title1';
            const fileName = data.fileName ? data.fileName.replace(/\.pdf$/, '') : 'No Title';
            title.innerHTML = `<i class="fa-solid fa-box-archive"></i> ${fileName}`;

            const author = document.createElement('div');
            author.id = 'author';
            author.innerHTML = `<i class="fa-solid fa-user"></i> ${data.metadata?.author || 'N/A'}`;
            let creationDate = 'N/A';

            if (data.metadata?.creationDate) {
                const creationDateMatch = data.metadata.creationDate.match(/^D:(\d{4})(\d{2})/);
                if (creationDateMatch) {
                    const year = creationDateMatch[1];
            const monthIndex = parseInt(creationDateMatch[2], 10) - 1; 
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthName = months[monthIndex];
            creationDate = `${monthName} ${year}`; // Format as "Month Year"
                }
            }

            const yearElement = document.createElement('div');
            yearElement.id = 'year';
            yearElement.innerHTML = `<i class="fa-regular fa-calendar"></i> ${creationDate}`;

            cardBody.appendChild(title);
            cardBody.appendChild(author);
            cardBody.appendChild(yearElement);
            card.appendChild(cardBody);

            card.addEventListener('click', function() {
                const pdfName = encodeURIComponent(data.fileName);
                window.open('document.html?pdf=' + pdfName, '_blank');
            });

            documentList.appendChild(card);
        });
        
        // Create pagination controls
        createPaginationControls(totalPages);
    }).catch((error) => {
        console.error('Error searching documents:', error);
        showAlert('Error searching documents','danger');
    });
}

// Function to create pagination controls
function createPaginationControls(totalPages) {
    const paginationContainer = document.querySelector('.pagination');
    paginationContainer.innerHTML = ''; // Clear previous pagination controls

    if (totalPages > 1) {
        // Previous button
        const prevButton = document.createElement('li');
        prevButton.classList.add('page-item');
        const prevLink = document.createElement('a');
        prevLink.classList.add('page-link');
        prevLink.href = '#';
        prevLink.innerHTML = '&laquo;';
        prevLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                searchDocuments(document.getElementById('searchInput').value.trim(), currentPage - 1);
                scrollToTarget();
            }
        });
        prevButton.appendChild(prevLink);
        paginationContainer.appendChild(prevButton);

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('li');
            pageButton.classList.add('page-item');
            const pageLink = document.createElement('a');
            pageLink.classList.add('page-link');
            pageLink.href = '#';
            pageLink.innerText = i;
            
            if (i === currentPage) {
                pageLink.classList.add('active');
                pageLink.style.backgroundColor = '#00415a';
                pageLink.style.color = '#fff';
                pageLink.style.borderColor = '#00415a';
            }
            
            pageLink.addEventListener('click', (e) => {
                e.preventDefault();
                const searchQuery = document.getElementById('searchInput').value.trim();
                searchDocuments(searchQuery, i);
                scrollToTarget();
            });
            pageButton.appendChild(pageLink);
            paginationContainer.appendChild(pageButton);
        }
        
        // Next button
        const nextButton = document.createElement('li');
        nextButton.classList.add('page-item');
        const nextLink = document.createElement('a');
        nextLink.classList.add('page-link');
        nextLink.href = '#';
        nextLink.innerHTML = '&raquo;';
        nextLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                searchDocuments(document.getElementById('searchInput').value.trim(), currentPage + 1);
                scrollToTarget();
            }
        });
        nextButton.appendChild(nextLink);
        paginationContainer.appendChild(nextButton);
    }
}

// Scroll-to-target function
function scrollToTarget() {
    const targetElement = document.getElementById('scroll-target');
    if (targetElement) {
        const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        const offsetPosition = elementPosition - 50; // Offset for better visibility

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
        });
    } else {
        console.error('Scroll target not found: #scroll-target');
    }
}

// Setup dropdown functionality
function setupDropdown() {
    // User Dropdown
    const userDropdownBtn = document.getElementById('dropdownUser');
    const userDropdownMenu = document.getElementById('dropdownOption');

    if (userDropdownBtn && userDropdownMenu) {
        userDropdownBtn.addEventListener('click', () => {
            userDropdownMenu.style.display =
                userDropdownMenu.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', (event) => {
            if (!userDropdownBtn.contains(event.target) &&
                !userDropdownMenu.contains(event.target)) {
                userDropdownMenu.style.display = 'none';
            }
        });
    }
    
    // Category Dropdown
const categoryDropdownBtn = document.getElementById('dropdownField');
const categoryDropdownMenu = document.getElementById('dropdownCategory');

if (categoryDropdownBtn && categoryDropdownMenu) {
    categoryDropdownBtn.addEventListener('click', () => {
        categoryDropdownMenu.style.display =
            categoryDropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
        if (!categoryDropdownBtn.contains(event.target) &&
            !categoryDropdownMenu.contains(event.target)) {
            categoryDropdownMenu.style.display = 'none';
        }
    });
}

    categoryDropdownMenu.querySelectorAll('a').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            selectedCategory = item.getAttribute('data-value');
            
            // Update button text
            categoryDropdownBtn.innerHTML = `${selectedCategory} <i class="fa-solid fa-chevron-down"></i>`;
            categoryDropdownMenu.style.display = 'none';

            // Perform search
            currentPage = 1;
            searchDocuments(document.getElementById('searchInput').value.trim());
        });
    });

    // Year Dropdown
    const yearDropdownBtn = document.getElementById('dropdownBtn');
    const yearDropdownMenu = document.getElementById('dropdownMenu');

    yearDropdownBtn.addEventListener('click', () => {
        yearDropdownMenu.style.display = yearDropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    yearDropdownMenu.querySelectorAll('a').forEach((item) => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const text = item.textContent.trim();

            // Handle different year selection scenarios
            if (text === 'Sort by date') {
                sortByDate = true;
                selectedYear = ''; // Clear year filter
            } else if (text === 'Any time') {
                selectedYear = ''; // Clear year filter
                sortByDate = false;
            } else {
                selectedYear = text; // Set selected year
                sortByDate = false;
            }

            // Update button text
            yearDropdownBtn.innerHTML = `${text} <i class="fa-solid fa-chevron-down"></i>`;
            yearDropdownMenu.style.display = 'none';

            // Perform search
            currentPage = 1;
            searchDocuments(document.getElementById('searchInput').value.trim());
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        if (!userDropdownBtn.contains(event.target) && !userDropdownMenu.contains(event.target)) {
            userDropdownMenu.style.display = 'none';
        }
        
        if (!categoryDropdownBtn.contains(event.target) && !categoryDropdownMenu.contains(event.target)) {
            categoryDropdownMenu.style.display = 'none';
        }
        if (!yearDropdownBtn.contains(event.target) && !yearDropdownMenu.contains(event.target)) {
            yearDropdownMenu.style.display = 'none';
        }
    });
}

// Perform search on button click
function searchDocumentsOnButtonClick() {
    const searchInput = document.getElementById('searchInput').value.trim();
    if (searchInput !== '') {
        window.location.href = `searchdocu.html?keyword=${encodeURIComponent(searchInput)}&category=${encodeURIComponent(selectedCategory)}`;
    } else {
        showAlert('Please enter a search query', 'info');
    }
}


// Add event listeners when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set up click handler for Archival Resources link
    const archivalResourcesLink = document.getElementById('archivalResourcesLink');
    if (archivalResourcesLink) {
        // Remove this block if unnecessary:
        archivalResourcesLink.addEventListener('click', function(event) {
            if (window.location.pathname.includes('searchdocu.html')) {
                event.preventDefault(); // Prevent the default behavior
                window.location.reload(); // Force page reload
            } else {
                // Let the browser navigate normally
                window.location.href = archivalResourcesLink.href;
            }
        });

    }

    // Get search query from URL
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const searchQuery = urlParams.get('keyword') || urlParams.get('search');
    const categoryParam = urlParams.get('category');
    
    // Check if the URL contains ?sort=year and trigger the search if it does
    if (urlParams.get('sort') === 'year') {
        handleArchivalResourcesClick(new Event('click'));
    } else if (searchQuery) {
        // Perform search if query exists
        document.getElementById('searchInput').value = decodeURIComponent(searchQuery); // Retain search query in input
        searchDocuments(searchQuery);
    }

    if (categoryParam) {
        selectedCategory = decodeURIComponent(categoryParam);
        const categoryDropdownBtn = document.getElementById('dropdownField');
        categoryDropdownBtn.innerHTML = `${selectedCategory} <i class="fa-solid fa-chevron-down"></i>`;
    }

    // Add event listener to search button
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', searchDocumentsOnButtonClick);
    }

    // Add event listener to search input for Enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                searchDocumentsOnButtonClick();
            }
        });
    }

    // Initialize dropdown functionality
    setupDropdown();
});



// DOCUMENT.HTML ----------------------------------------------------------------------------------->>>>>>>>>
document.addEventListener('DOMContentLoaded', function() {
    const requestBtn = document.querySelector('.request-btn');
    requestBtn.addEventListener('click', function() {
        const user = auth.currentUser;
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    document.getElementById('userName').textContent = userData.name;
                    document.getElementById('userEmail').textContent = user.email;
                    document.getElementById('userId').textContent = userData.userId;
                    document.getElementById('userType').textContent = userData.userType;
                }
            }).catch(error => {
                console.log("Error getting user data:", error);
            });

            // Assuming you have the document details available
            const documentDetails = {
                
            };
            document.getElementById('documentTitle').textContent = documentDetails.title;
            document.getElementById('documentId').textContent = documentDetails.id;
        } else {
            alert("User not logged in.");
        }
    });
});

function submitRequest() {
    const purpose = document.getElementById('purpose').value;
    const specifyPurpose = document.getElementById('specifyPurpose').value;

    if (specifyPurpose.length < 150) {
        alert("Please specify the purpose with at least 150 characters.");
        return;
    }

    // Here you can add code to submit the request to your backend or Firestore
    console.log("Request submitted with purpose:", purpose, "and details:", specifyPurpose);
    alert("Request submitted successfully!");
    // Close the modal
    bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
}






document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('pdfViewer') || document.getElementById('pdfContainer')) {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const pdfName = urlParams.get('pdf');

        const storageRef = storage.ref('pdfs/' + pdfName);

        storageRef.getDownloadURL().then(async (downloadURL) => {
            // Embedded PDF Viewer Logic
            const pdfViewer = document.getElementById('pdfViewer');
            if (pdfViewer) {
                pdfViewer.src = `${downloadURL}#toolbar=0&view=fitH`;
            }

            // Custom PDF Rendering Logic
            if (document.getElementById('pdfContainer')) {
                const pdf = await pdfjsLib.getDocument(downloadURL).promise;
                const totalPages = pdf.numPages;
                const pdfContainer = document.getElementById('pdfContainer');

                // Calculate the number of pages to render (totalPages / 5)
                const pagesToRender = Math.ceil(totalPages / 5);

                for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);

                    // Render pages up to the calculated limit
                    if (pageNum <= pagesToRender) {
                        renderPage(page, pageNum, pdfContainer);
                        continue;
                    }

                    // Add the "exclusive content" div after the rendered pages
                    if (pageNum === pagesToRender + 1) {
                        const exclusiveContentDiv = document.createElement('div');
                        exclusiveContentDiv.innerHTML = `
                            <div style="text-align: center; padding: 20px; background-color: rgb(253, 255, 182); border: 1px solid #ccc; margin: 20px 0;">
                                <strong>Full Content Restricted</strong><br>
                                Request document to see the full content.
                            </div>
                        `;
                        pdfContainer.appendChild(exclusiveContentDiv);
                    }

                    // Stop rendering after the calculated limit
                    // (No additional logic for "Appendices" or "References")
                }
            }

            // Metadata Fetching Logic (unchanged)
            db.collection('pdfMetadata').where('fileName', '==', pdfName).get().then(querySnapshot => {
                if (querySnapshot.empty) {
                    console.log('No matching documents.');
                    return;
                }

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const metadata = data.metadata || {};
                    const author = metadata.author || 'N/A';

                    let creationDate = 'N/A';
                    if (metadata.creationDate) {
                        const creationDateMatch = metadata.creationDate.match(/^D:(\d{4})(\d{2})/);
                        if (creationDateMatch) {
                            const year = creationDateMatch[1];
                            const month = creationDateMatch[2];
                            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                            const monthName = monthNames[parseInt(month, 10) - 1];
                            creationDate = `${monthName} ${year}`;
                        }
                    }

                    const title = data.fileName ? data.fileName.replace('.pdf', '') : 'No Title';
                    let abstract = 'See the file below';
                    if (data.text) abstract = extractAbstract(data.text);

                    document.getElementById('documentTitle').textContent = title;
                    document.getElementById('documentAuthor').textContent = author;
                    document.getElementById('documentPublishedDate').textContent = creationDate;
                    document.getElementById('documentAbstract').innerHTML = abstract;
                });
            }).catch(error => {
                console.error('Error fetching document metadata:', error);
                showAlert('Error fetching document metadata','danger');
            });
        }).catch(error => {
            console.error('Error getting download URL:', error);
            showAlert('Error getting download URL','danger');
        });

        // Disable interactions (unchanged)
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && (event.key === 'p' || event.key === 's')) {
                event.preventDefault();
                showAlert('Print/Save disabled.','warning');
            }
        });
        document.addEventListener('selectstart', event => event.preventDefault());

        function extractAbstract(text) {
            const startKeyword = /(?:Abstract:|ABSTRACT|Executive Summary|EXECUTIVE SUMMARY)\s*/i;
            const startMatch = text.match(startKeyword);
            if (startMatch) {
                const startIndex = startMatch.index + startMatch[0].length;
                const abstractText = text.substring(startIndex).trim();
                const sentences = abstractText.split(/(?<=[.!?])\s+/);
                const displayedSentences = sentences.slice(0, 5).join(' ');
                return (sentences.length > 5) ? `${displayedSentences} <strong>(see below)</strong>` : displayedSentences;
            }
            return '(Please refer to the file below)';
        }

        function renderPage(page, pageNum, container) {
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.classList.add('pdf-page-canvas');
            container.appendChild(canvas);

            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            page.render({ canvasContext: context, viewport });
        }
    }
});


















const auth = firebase.auth();
const firestore = firebase.firestore();

// Wait until the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check Firebase authentication state
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log("User is logged in:", user.email);
            const userElement = document.getElementById('signupEmail');
            if (userElement) {
                userElement.textContent = user.email;
            }
        } else {
            console.log("No user is logged in. Redirecting to login.");
            redirectToLogin();
        }
    });

    // Logout functionality
    const logoutButton = document.getElementById('logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});

// Function to redirect to login page
function redirectToLogin() {
    window.location.href = 'login.html'; // Adjust if your login page is different
}

// Function to log out the user
function logout() {
    auth.signOut()
        .then(() => {
            console.log("User signed out successfully.");
            sessionStorage.clear();
            redirectToLogin();
        })
        .catch((error) => {
            console.error("Sign out error:", error);
        });
}


