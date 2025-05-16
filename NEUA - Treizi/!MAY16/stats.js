//**Charts and Stats Report------------------------------------------ !!!!!!!!!!!!!!!



// Global variables for chart instances and state
let fileChart, docStatusChart, userChart;
let excludedSegments = {
    fileChart: new Set(),
    docStatusChart: new Set(),
    userChart: new Set()
};

// Store original data for restoration
let originalData = {
    fileChart: null,
    docStatusChart: null,
    userChart: null
};

function initializeCharts() {
    // Common chart options
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const currentValue = context.raw || 0;
                        // Calculate total from non-excluded segments only
                        const activeTotal = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = activeTotal === 0 ? 0 : Math.round((currentValue / activeTotal) * 100);
                        return `${label}: ${currentValue} (${percentage}%)`;
                    }
                }
            }
        },
        animation: {
            animateRotate: true,
            animateScale: true,
            duration: 800
        },
        cutout: '80%',
        elements: {
            arc: {
                borderWidth: 0,
                borderRadius: 6
            }
        },
        layout: {
            padding: {
                top: 12,
                bottom: 12,
                left: 12,
                right: 12
            }
        }   
    };

    // Initialize charts with empty data
    // We'll populate them dynamically based on user's department
    
    // Initialize File Chart with placeholder
    const fileCtx = document.getElementById('fileChart').getContext('2d');
    fileChart = new Chart(fileCtx, {
        type: 'doughnut',
        data: {
            labels: ['Loading...'],
            datasets: [{
                data: [1],
                backgroundColor: ['#6765E7'],
                borderWidth: 0,
                spacing: 6,
                borderRadius: 20,
                hoverOffset: 12 
            }]
        },
        options: { ...chartOptions, id: 'fileChart' }
    });

    // Initialize Document Status Chart with ID
    const docStatusCtx = document.getElementById('docStatusChart').getContext('2d');
    docStatusChart = new Chart(docStatusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Requests', 'Approved', 'Disapproved'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#FF9500', '#34C759', '#FF3B30'],
                borderWidth: 0,
                spacing: 6,
                borderRadius: 20,
                hoverOffset: 12
            }]
        },
        options: { ...chartOptions, id: 'docStatusChart' }
    });

    // Initialize User Chart with ID
    const userCtx = document.getElementById('userChart').getContext('2d');
    userChart = new Chart(userCtx, {
        type: 'doughnut',
        data: {
            labels: ['Student', 'Alumni', 'Faculty', 'Dean', 'Coordinator'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: ['#FF9500', '#34C759', '#0092CC', '#6765E7', '#FF3B30'],
                borderWidth: 0,
                spacing: 6,
                borderRadius: 20,
                hoverOffset: 12
            }]
        },
        options: { ...chartOptions, id: 'userChart' }
    });

    // Initialize legends after fetching data
}

function updateLegends() {
    updateLegend(fileChart, 'fileChartLegend', 'fileChart');
    updateLegend(docStatusChart, 'docStatusChartLegend', 'docStatusChart');
    updateLegend(userChart, 'userChartLegend', 'userChart');
}

function updateLegend(chart, legendId, chartId) {
    const legendContainer = document.getElementById(legendId);
    legendContainer.innerHTML = '';
    
    if (chart.data.labels && chart.data.datasets) {
        chart.data.labels.forEach((label, i) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'chart-legend-item';
            if (excludedSegments[chartId].has(i)) {
                legendItem.classList.add('excluded');
            }
            
            const colorBox = document.createElement('span');
            colorBox.className = 'chart-legend-color';
            colorBox.style.backgroundColor = chart.data.datasets[0].backgroundColor[i];
            
            const labelText = document.createElement('span');
            labelText.className = 'legend-label';
            // Apply strikethrough if segment is excluded
            if (excludedSegments[chartId].has(i)) {
                labelText.style.textDecoration = 'line-through';
                labelText.style.opacity = '0.5';
            }
            const value = originalData[chartId] ? originalData[chartId][i] : chart.data.datasets[0].data[i];
            labelText.textContent = `${label}: ${value || 0}`;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(labelText);
            
            // Add click handler for toggling
            legendItem.addEventListener('click', () => toggleChartSegment(chartId, i));
            
            legendContainer.appendChild(legendItem);
        });
    }
}

function toggleChartSegment(chartId, index) {
    const chart = getChartById(chartId);
    if (!chart) return;

    // Initialize original data if not yet stored
    if (!originalData[chartId]) {
        originalData[chartId] = [...chart.data.datasets[0].data];
    }

    if (excludedSegments[chartId].has(index)) {
        // Include the segment
        excludedSegments[chartId].delete(index);
        // Restore original value
        chart.data.datasets[0].data[index] = originalData[chartId][index];
    } else {
        // Exclude the segment
        excludedSegments[chartId].add(index);
        // Set value to 0 to exclude from chart
        chart.data.datasets[0].data[index] = 0;
    }

    // Calculate total of non-excluded segments
    const total = originalData[chartId].reduce((acc, value, i) => {
        return acc + (excludedSegments[chartId].has(i) ? 0 : value);
    }, 0);

    // Update percentages in chart data
    chart.data.datasets[0].data = originalData[chartId].map((value, i) => {
        if (excludedSegments[chartId].has(i)) {
            return 0;
        }
        return value;
    });

    // Update center count
    const countElement = document.getElementById(getCountElementId(chartId));
    if (countElement) {
        countElement.textContent = total;
    }

    // Update chart with animation
    chart.update();
    updateLegends();
}

function getChartById(chartId) {
    switch(chartId) {
        case 'fileChart': return fileChart;
        case 'docStatusChart': return docStatusChart;
        case 'userChart': return userChart;
        default: return null;
    }
}

function getCountElementId(chartId) {
    switch(chartId) {
        case 'fileChart': return 'fileCount';
        case 'docStatusChart': return 'docStatusCount';
        case 'userChart': return 'userCount';
        default: return null;
    }
}

function updateCharts(fileData, userData, docStatusData) {
    // Update File Chart with course distribution
    fileChart.data.datasets[0].data = [
        fileData.bsit,
        fileData.bscs,
        fileData.bsis,
        fileData.blis,
        fileData.others
    ];
    fileChart.update();

    // Update Document Status Chart
    docStatusChart.data.datasets[0].data = [
        docStatusData.Requests,
        docStatusData.approved,
        docStatusData.disapproved
    ];
    docStatusChart.update();

    // Update User Chart with user type distribution
    userChart.data.datasets[0].data = [
        userData.student,
        userData.alumni,
        userData.faculty,
        userData.dean,
        userData.coordinator
    ];
    userChart.update();

    // Update legends with actual counts
    updateLegends();
}

// Initialize charts when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeCharts();
    
    // Check if we're on the document requests tab
    const docRequestsTab = document.getElementById('docRequests-tab');
    if (docRequestsTab && docRequestsTab.classList.contains('active')) {
        loadDocRequests();
    }
    
    loadChartData();
    
    // Add returned docs tab listener
    const returnedDocsTab = document.getElementById('returned-docs-tab');
    if (returnedDocsTab) {
        returnedDocsTab.addEventListener('click', function() {
            console.log('Returned docs tab clicked');
            loadReturnedDocs();
        });
        
        returnedDocsTab.addEventListener('shown.bs.tab', function() {
            console.log('Returned docs tab shown');
            loadReturnedDocs();
        });
    } else {
        console.error('Could not find returned-docs-tab element');
    }
});

function loadChartData() {
    // First, fetch the user info to determine department and user type
    fetch('get_user_type.php')
        .then(response => response.json())
        .then(userData => {
            const userDepartment = userData.department;
            const userType = userData.user_type ? userData.user_type.toLowerCase() : '';
            console.log('User Department:', userDepartment);
            console.log('User Type:', userType);
            
            // Show or hide doc status chart based on user type
            const docStatusChartContainer = document.getElementById('docStatusChartContainer');
            if (docStatusChartContainer) {
                if (userType === 'dean') {
                    docStatusChartContainer.style.display = 'block';
                } else {
                    docStatusChartContainer.style.display = 'none';
                }
            }
            
            // Now fetch all the data
            Promise.all([
                fetch('admin_dashboard.php?action=getFiles'),
                fetch('admin_dashboard.php?action=getApprovedUsers'),
                fetch('admin_dashboard.php?action=getPendingUsers'),
                fetch('admin_dashboard.php?action=getDocRequests'),
                fetch('admin_dashboard.php?action=getReturnedDocs'),
                fetch('admin_dashboard.php?action=getDisapprovedDocs')
            ])
            .then(responses => Promise.all(responses.map(res => res.json())))
            .then(([fileResponse, userResponse, pendingResponse, docResponse, returnedDocsResponse, disapprovedDocsResponse]) => {
                // Define the department to courses mapping
                const departmentCourses = {
                    'CICS': ['BSIT', 'BSCS', 'BSIS', 'BLIS'],
                    'CEA': ['BSCE', 'BSEE', 'BSME', 'BS Arch'],
                    'CAS': ['BA Econ', 'BA PolSci', 'BS Psych', 'BPA']
                };
                
                // Define colors for each department
                const departmentColors = {
                    'CICS': ['#6765E7', '#0092CC', '#FF794D', '#FF4D6F', '#aeaeae'],
                    'CEA': ['#34C759', '#FF9500', '#5856D6', '#FF3B30', '#aeaeae'],
                    'CAS': ['#FF9500', '#34C759', '#5856D6', '#007AFF', '#aeaeae']
                };
                
                // Determine which courses to show based on user department
                let coursesToShow = departmentCourses['CICS']; // Default to CICS
                let colorsToUse = departmentColors['CICS'];
                
                if (userDepartment && departmentCourses[userDepartment]) {
                    coursesToShow = departmentCourses[userDepartment];
                    colorsToUse = departmentColors[userDepartment];
                }
                
                // Add "Others" category
                coursesToShow.push('Others');
                
                // Process File Records by course
                const fileData = {};
                // Initialize counts for each course to 0
                coursesToShow.forEach(course => {
                    fileData[course.toLowerCase().replace(/\s/g, '_')] = 0;
                });

                if (fileResponse.success && fileResponse.files) {
                    fileResponse.files.forEach(file => {
                        const course = file.course ? file.course.toLowerCase() : '';
                        
                        // Check each course in the selected department
                        let matched = false;
                        for (let i = 0; i < coursesToShow.length - 1; i++) { // Exclude "Others"
                            const courseToCheck = coursesToShow[i].toLowerCase();
                            if (course.includes(courseToCheck) || 
                                course.includes(courseToCheck.replace(/\s/g, ''))) {
                                const key = courseToCheck.replace(/\s/g, '_');
                                fileData[key] = (fileData[key] || 0) + 1;
                                matched = true;
                                break;
                            }
                        }
                        
                        // If not matched to any course, it's "Others"
                        if (!matched) {
                            fileData.others = (fileData.others || 0) + 1;
                        }
                    });
                }

                // Convert the courses for display in the chart
                const fileLabels = [];
                const fileValues = [];
                
                coursesToShow.forEach(course => {
                    const key = course.toLowerCase().replace(/\s/g, '_');
                    fileLabels.push(course);
                    fileValues.push(fileData[key] || 0);
                });
                
                // Update File Chart with dynamic courses
                fileChart.data.labels = fileLabels;
                fileChart.data.datasets[0].data = fileValues;
                fileChart.data.datasets[0].backgroundColor = colorsToUse;
                fileChart.update();
                
                // Store original data for restoration when toggling
                originalData.fileChart = [...fileValues];

                // Process user data - only count active approved users
                const userData = {
                    student: 0,
                    alumni: 0,
                    faculty: 0,
                    dean: 0,
                    coordinator: 0
                };

                if (userResponse.success && userResponse.approvedUsers) {
                    userResponse.approvedUsers.forEach(user => {
                        // Skip deactivated users
                        if (user.account_status === 'deactivated') {
                            return;
                        }
                        
                        const userType = (user.user_type || '').toLowerCase();
                        switch(userType) {
                            case 'student':
                                userData.student++;
                                break;
                            case 'alumni':
                                userData.alumni++;
                                break;
                            case 'faculty':
                                userData.faculty++;
                                break;
                            case 'dean':
                                userData.dean++;
                                break;
                            case 'coordinator':
                                userData.coordinator++;
                                break;
                        }
                    });
                }


                // Document status data (unchanged)
                const docStatusData = {
                    Requests: 0,
                    approved: 0,
                    disapproved: 0
                };

                if (docResponse.success && docResponse.requests) {
                    docResponse.requests.forEach(req => {
                        const status = (req.status ? req.status.toLowerCase() : '');
                        if (status === 'reserved' || status === 'released' || status === 'overdue') {
                            docStatusData.Requests++;
                        }
                    });
                }

                if (returnedDocsResponse.success && returnedDocsResponse.requests) {
                    returnedDocsResponse.requests.forEach(req => {
                        const status = req.status ? req.status.toLowerCase() : '';
                        if (status === 'returned') {
                            docStatusData.approved++;
                        } else if (status === 'disapproved') {
                            docStatusData.disapproved++;
                        }
                    });
                }

                if (disapprovedDocsResponse.success && disapprovedDocsResponse.requests) {
                    // Use length directly since we're getting exactly the disapproved documents
                    docStatusData.disapproved = disapprovedDocsResponse.requests.length;
                    console.log('Disapproved docs count:', docStatusData.disapproved);
                }

                // Update other charts
                docStatusChart.data.datasets[0].data = [
                    docStatusData.Requests,
                    docStatusData.approved,
                    docStatusData.disapproved
                ];
                docStatusChart.update();

                userChart.data.datasets[0].data = [
                    userData.student,
                    userData.alumni,
                    userData.faculty,
                    userData.dean,
                    userData.coordinator
                ];
                userChart.update();

                // Store original data
                originalData.docStatusChart = [...docStatusChart.data.datasets[0].data];
                originalData.userChart = [...userChart.data.datasets[0].data];

                // Update display counts
                document.getElementById('fileCount').textContent = 
                    fileValues.reduce((a, b) => a + b, 0);
                
                document.getElementById('userCount').textContent = 
                    userData.student + userData.alumni + userData.faculty + userData.dean + userData.coordinator;
                
                document.getElementById('docStatusCount').textContent = 
                    Object.values(docStatusData).reduce((a, b) => a + b, 0);

                // Now update the legends
                updateLegends();

                console.log('Updated Stats:', {
                    'Files by Course': fileData,
                    'Users by Type': userData,
                    'Document Requests': docStatusData
                });
            })
            .catch(error => {
                console.error('Error loading chart data:', error);
                showAlert('Error loading chart data', 'danger');
            });
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
            // Fallback to default courses
            loadChartDataWithDefaultCourses();
        });
}

// Fallback function if user data can't be fetched
function loadChartDataWithDefaultCourses() {
    // Similar to original loadChartData but with default CICS courses
    // This is a fallback in case user department can't be determined
    
    // Hide doc status chart in fallback since we don't know the user type
    const docStatusChartContainer = document.getElementById('docStatusChartContainer');
    if (docStatusChartContainer) {
        docStatusChartContainer.style.display = 'none';
    }
    
    Promise.all([
        fetch('admin_dashboard.php?action=getFiles'),
        fetch('admin_dashboard.php?action=getApprovedUsers'),
        fetch('admin_dashboard.php?action=getPendingUsers'),
        fetch('admin_dashboard.php?action=getDocRequests'),
        fetch('admin_dashboard.php?action=getReturnedDocs'),
        fetch('admin_dashboard.php?action=getDisapprovedDocs')
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([fileResponse, userResponse, pendingResponse, docResponse, returnedDocsResponse, disapprovedDocsResponse]) => {
        // Process File Records with default CICS courses
        const fileData = {
            bsit: 0,
            bscs: 0,
            bsis: 0,
            blis: 0,
            others: 0
        };

        if (fileResponse.success && fileResponse.files) {
            fileResponse.files.forEach(file => {
                const course = file.course ? file.course.toLowerCase() : '';
                if (course.includes('bsit') || course.includes('information technology')) {
                    fileData.bsit++;
                } else if (course.includes('bscs') || course.includes('computer science')) {
                    fileData.bscs++;
                } else if (course.includes('bsis') || course.includes('information systems')) {
                    fileData.bsis++;
                } else if (course.includes('blis') || course.includes('library')) {
                    fileData.blis++;
                } else {
                    fileData.others++;
                }
            });
        }

        // Rest of the function remains the same as the original...
        // Update charts with the default data
        fileChart.data.labels = ['BSIT', 'BSCS', 'BSIS', 'BLIS', 'Others'];
        fileChart.data.datasets[0].data = [
            fileData.bsit,
            fileData.bscs,
            fileData.bsis,
            fileData.blis,
            fileData.others
        ];
        fileChart.update();
        
        // Store original data
        originalData.fileChart = [...fileChart.data.datasets[0].data];
        
        // Continue with rest of original function...
    })
    .catch(error => {
        console.error('Error in fallback chart loading:', error);
        showAlert('Error loading chart data', 'danger');
    });
}

// Stats Report -------------------------------------------------------------------------------->
function downloadStatsReport() {
    // Import jsPDF and autotable dynamically
    const jspdfScript = document.createElement('script');
    jspdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    
    const autoTableScript = document.createElement('script');
    autoTableScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';
    
    jspdfScript.onload = function() {
        document.head.appendChild(autoTableScript);
    };
    
    autoTableScript.onload = function() {
        generatePDF();
    };
    
    document.head.appendChild(jspdfScript);
}

function generatePDF() {
    // Create new jsPDF instance
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Set document properties
    doc.setProperties({
        title: 'NEUR Statistics Report',
        creator: 'NEU REPOSITORY'
    });

    // Get current date in local format
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Define theme color and derived colors
    const themeColor = [0, 85, 128]; // #005580 in RGB
    const secondaryColor = [0, 102, 153]; // #006699 in RGB
    const lightThemeColor = [230, 240, 245]; // #E6F0F5 in RGB

    // Main title
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setFontSize(20);
    doc.text('NEU REPOSITORY STATISTICS REPORT', 105, 20, { align: 'center' });
    
   // Date subtitle
doc.setFontSize(12);
doc.setFont('helvetica', 'normal');
doc.setTextColor(128, 128, 128); // Set to gray
doc.text(`As of ${currentDate}`, 105, 28, { align: 'center' });

    
    // Horizontal line
    doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    // Get data from charts
    const fileData = originalData.fileChart || fileChart.data.datasets[0].data;
    const fileLabels = fileChart.data.labels;
    
    const docStatusData = originalData.docStatusChart || docStatusChart.data.datasets[0].data;
    const docStatusLabels = docStatusChart.data.labels;
    
    const userData = originalData.userChart || userChart.data.datasets[0].data;
    const userLabels = userChart.data.labels;

    // Calculate totals correctly
    const totalFiles = fileData.reduce((a, b) => a + b, 0);
    const totalDocs = docStatusData.reduce((a, b) => a + b, 0);
    // Calculate total users (now we don't need to exclude pending users since they're removed)
    const totalUsers = userData.reduce((a, b) => a + b, 0);

    // Fetch additional data
    fetchAdditionalStats().then(additionalData => {
        let yPos = 40; // Initial position
        
        // Summary section - Quick overview stats
        doc.setFillColor(lightThemeColor[0], lightThemeColor[1], lightThemeColor[2]);
        doc.roundedRect(20, yPos, 170, 20, 3, 3, 'F');
        
        // Summary content
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text('SYSTEM SUMMARY', 105, yPos + 6, { align: 'center' });
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        
        doc.text(`Total Files: ${totalFiles}`, 40, yPos + 15);
        doc.text(`Document Requests: ${totalDocs}`, 85, yPos + 15);
        doc.text(`Total Users: ${totalUsers}`, 150, yPos + 15);
        
        yPos += 30;
        
        // Add All-Time Most Borrowed Documents Table (NEW)
        // Prepare all-time top borrowed docs data
        const allTimeTopDocsData = additionalData.allTimeBorrowedDocs.map(doc => 
            [doc.docId, doc.title, doc.count]
        );
        
        // If we have no data, add a placeholder row
        if (allTimeTopDocsData.length === 0) {
            allTimeTopDocsData.push(['No data','-', '-']);
        }
        
        doc.autoTable({
            startY: yPos,
            head: [
                [{ content: 'MOST REQUESTED DOCUMENTS (ALL TIME)', colSpan: 3, styles: { 
                    halign: 'center', 
                    fillColor: null, 
                    textColor: [0, 0, 0], 
                    fontStyle: 'bold',
                    fontSize: 14, 
                    cellPadding: { top: 5, bottom: 5 }, 
                    lineWidth: 0, 
                }}],
                ['Doc ID', 'Title', 'Count']
            ],
            body: allTimeTopDocsData,
            theme: 'grid',
            headStyles: {
                fillColor: themeColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [211, 211, 211]
            },
            styles: {
                font: 'helvetica',
                overflow: 'linebreak',
                cellPadding: 2,
            },
            columnStyles: {
                0: { cellWidth: 40, halign: 'center' },
                1: { cellWidth: 80, halign: 'left' },
                2: { cellWidth: 30, halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { left: 30, right: 30 }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
        
        // Add Most Borrowed Documents in Last 30 Days Table
        // Prepare top borrowed docs data
        const topDocsData = additionalData.topBorrowedDocs.map(doc => 
            [doc.docId, doc.title, doc.count]
        );
        
        // If we have no data, add a placeholder row
        if (topDocsData.length === 0) {
            topDocsData.push(['No data','-', '-']);
        }
        
        doc.autoTable({
            startY: yPos,
            head: [
                [{ content: 'MOST REQUESTED DOCUMENTS (LAST 30 DAYS)', colSpan: 3, styles: { 
                    halign: 'center', 
                    fillColor: null, 
                    textColor: [0, 0, 0], 
                    fontStyle: 'bold',
                    fontSize: 14, 
                    cellPadding: { top: 5, bottom: 5 }, 
                    lineWidth: 0, 
                }}],
                ['Doc ID', 'Title', 'Count']
            ],
            body: topDocsData,
            theme: 'grid',
            headStyles: {
                fillColor: themeColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1,
                lineColor: [211, 211, 211]
            },
            styles: {
                font: 'helvetica',
                overflow: 'linebreak',
                cellPadding: 2,
            },
            columnStyles: {
                0: { cellWidth: 40, halign: 'center' },
                1: { cellWidth: 80, halign: 'left' },
                2: { cellWidth: 30, halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { left: 30, right: 30 }
        });
        
        yPos = doc.lastAutoTable.finalY + 10;
        
        // Start a new page for File Statistics Table
        doc.addPage();
        yPos = 25; // Reset Y position for new page
        
        // File Statistics Table title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('FILES STATISTICS', 105, yPos, { align: 'center' });
        
        yPos += 10;
        
        // File Statistics Table
        const fileTableData = fileLabels.map((label, i) => [label, fileData[i], calculatePercentage(fileData[i], totalFiles)]);
        
        // Add the additional file data
        fileTableData.push(
            ['', '', ''],
            ['Within 5 years', additionalData.filesWithinFiveYears, calculatePercentage(additionalData.filesWithinFiveYears, totalFiles)],
            ['Over 5 years', additionalData.filesOverFiveYears, calculatePercentage(additionalData.filesOverFiveYears, totalFiles)]
        );
        
        doc.autoTable({
            startY: yPos,
            head: [
                ['Category', 'Count', 'Percentage']
            ],
            body: fileTableData,
            theme: 'grid',
            headStyles: {
                fillColor: themeColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1, // Add border
                lineColor: [211, 211, 211]
            },            
            styles: {
                font: 'helvetica',
                overflow: 'linebreak',
                cellPadding: 2, // Reduced cell padding
            },
            columnStyles: {
                0: { cellWidth: 60, halign: 'center' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 50, halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { left: 30, right: 30 }
        });
        
        yPos = doc.lastAutoTable.finalY + 10; // Spacing between tables
        
        // Documents Section with merged headers and larger title
        const docTableData = [
            docStatusLabels.map((label, i) => [label, docStatusData[i], calculatePercentage(docStatusData[i], totalDocs)])
        ].flat();
        
        // Add the additional document data - now with '-' for percentages
        docTableData.push(
            ['', '', ''],
            ['Completed last 7 days', additionalData.completedLast7Days, '-'],
            ['Completed last 30 days', additionalData.completedLast30Days, '-']
        );
        
        doc.autoTable({
            startY: yPos,
            head: [
                [{ content: 'DOCUMENT REQUESTS', colSpan: 3, styles: { 
                    halign: 'center', 
                    fillColor: null, 
                    textColor: [0, 0, 0], 
                    fontStyle: 'bold',
                    fontSize: 14, 
                    cellPadding: { top: 5, bottom: 5 }, 
                    lineWidth: 0, 
                }}],
                ['Status', 'Count', 'Percentage']
            ],
            body: docTableData,
            theme: 'grid',
            headStyles: {
                fillColor: themeColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1, 
                lineColor: [211, 211, 211]
            },
            
            styles: {
                font: 'helvetica',
                overflow: 'linebreak',
                cellPadding: 2, 
            },
            columnStyles: {
                0: { cellWidth: 60, halign: 'center' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 50, halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { left: 30, right: 30 }
        });
        
        // Start a new page for Users Statistics
        doc.addPage();
        yPos = 25; // Reset Y position for new page
        
        // Users Statistics title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('USERS STATISTICS', 105, yPos, { align: 'center' });
        
        yPos += 10;
        
        // Users Section with merged headers and larger title
        const userTableData = [
            userLabels.map((label, i) => [label, userData[i], calculatePercentage(userData[i], totalUsers)])
        ].flat();
        
        // Add the additional user data
        userTableData.push(
            ['', '', ''],
            ['Active', additionalData.activeUsers, calculatePercentage(additionalData.activeUsers, additionalData.activeUsers + additionalData.deactivatedUsers)],
            ['Deactivated', additionalData.deactivatedUsers, calculatePercentage(additionalData.deactivatedUsers, additionalData.activeUsers + additionalData.deactivatedUsers)]
        );
        
        doc.autoTable({
            startY: yPos,
            head: [
                ['User Type', 'Count', 'Percentage']
            ],
            body: userTableData,
            theme: 'grid',
            headStyles: {
                fillColor: themeColor,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1, 
                lineColor: [211, 211, 211]
            },
            
            styles: {
                font: 'helvetica',
                overflow: 'linebreak',
                cellPadding: 2, 
            },
            columnStyles: {
                0: { cellWidth: 60, halign: 'center' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 50, halign: 'center' }
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { left: 30, right: 30 }
        });
        
        // Add footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer line
            doc.setDrawColor(themeColor[0], themeColor[1], themeColor[2]);
            doc.line(20, 280, 190, 280);
            
            // Footer text
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated on ${currentDate} | Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
        }
        
        // Save the PDF
        doc.save(`NEUR_Stats_Report_${formatDateForFilename(new Date())}.pdf`);
    }).catch(error => {
        console.error('Error generating report:', error);
        showAlert('Error generating statistics report', 'danger');
    });
}

function calculatePercentage(value, total) {
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
}

function fetchAdditionalStats() {
    return new Promise((resolve) => {
        // Get the current date and dates for comparison
        const currentDate = new Date();
        const sevenDaysAgo = new Date();
        const thirtyDaysAgo = new Date();
        sevenDaysAgo.setDate(currentDate.getDate() - 7);
        thirtyDaysAgo.setDate(currentDate.getDate() - 30);
        
        // Calculate counts from allFileRecords
        const stats = {
            filesWithinFiveYears: 0,
            filesOverFiveYears: 0,
            completedLast7Days: 0,
            completedLast30Days: 0,
            activeUsers: 0,
            deactivatedUsers: 0,
            topBorrowedDocs: [], // Most borrowed in last 30 days
            allTimeBorrowedDocs: [] // All-time most borrowed documents
        };

        // Count files based on their year
        const currentYear = new Date().getFullYear();
        allFileRecords.forEach(file => {
            const fileYear = parseInt(file.year);
            if (!isNaN(fileYear)) {
                const yearDifference = currentYear - fileYear;
                if (yearDifference < 5) {
                    stats.filesWithinFiveYears++;
                } else {
                    stats.filesOverFiveYears++;
                }
            }
        });

        // Count active users from allUserRecords
        allUserRecords.forEach(user => {
            if (user.account_status === 'deactivated') {
                stats.deactivatedUsers++;
            } else {
                stats.activeUsers++;
            }
        });
        
        // Fetch deactivated users to get an accurate count
        fetch('admin_dashboard.php?action=getDeactivatedUsers')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.deactivatedUsers) {
                    // Set the count from the deactivated users table
                    stats.deactivatedUsers = data.deactivatedUsers.length;
                    console.log('Deactivated users count from API:', stats.deactivatedUsers);
                } else {
                    console.log('No deactivated users data from API, using count from allUserRecords:', stats.deactivatedUsers);
                }
                
                // Continue with the rest of the function
                return fetch('admin_dashboard.php?action=getReturnedDocs');
            })
            .then(response => response.json())
            .then(data => {
                if (data.success && data.requests) {
                    // Get detailed info about data structure for debugging
                    if (data.requests.length > 0) {
                        console.log('First returned document:', data.requests[0]);
                        console.log('Available properties:', Object.keys(data.requests[0]));
                    }
                    
                    // Count documents returned within time periods
                    data.requests.forEach(request => {
                        const status = request.status ? request.status.toLowerCase() : '';
                        // Only count approved/returned documents as completed (exclude disapproved)
                        if (status === 'approved' || status === 'returned') {
                            if (request.date_returned) {
                                const returnedDate = new Date(request.date_returned);
                                
                                // Check for last 7 days
                                if (returnedDate >= sevenDaysAgo && returnedDate <= currentDate) {
                                    stats.completedLast7Days++;
                                }
                                
                                // Check for last 30 days
                                if (returnedDate >= thirtyDaysAgo && returnedDate <= currentDate) {
                                    stats.completedLast30Days++;
                                }
                            }
                        }
                    });
                    
                    // Process for all borrowed documents (all-time and last 30 days)
                    const allTimeDocCounter = {};
                    const last30DaysDocCounter = {};
                    const docTitles = {};
                    
                    // Try to match the data structure seen in the screenshot
                    data.requests.forEach(request => {
                        // From the screenshot, we need Doc ID and Title
                        // Extract Doc ID - examining multiple possible property names
                        let docId = null;
                        let title = 'Unknown Title';
                        
                        // Check all possible property names for Doc ID based on the screenshot
                        if (request.docId) docId = request.docId;
                        else if (request.doc_id) docId = request.doc_id;
                        else if (request.document_id) docId = request.document_id;
                        else if (request.documentId) docId = request.documentId;
                        else {
                            // If none found, try to look for a property that might contain Doc ID
                            const possibleKeys = Object.keys(request);
                            for (const key of possibleKeys) {
                                const lowerKey = key.toLowerCase();
                                if (lowerKey.includes('doc') && lowerKey.includes('id')) {
                                    docId = request[key];
                                    break;
                                }
                            }
                        }
                        
                        // Similarly extract title
                        if (request.title) title = request.title;
                        else if (request.document_title) title = request.document_title;
                        else if (request.fileName) title = request.fileName;
                        else if (request.filename) title = request.filename;
                        else {
                            // Try to find a title-like property
                            const possibleKeys = Object.keys(request);
                            for (const key of possibleKeys) {
                                const lowerKey = key.toLowerCase();
                                if (lowerKey.includes('title') || lowerKey.includes('name')) {
                                    title = request[key];
                                    break;
                                }
                            }
                        }
                        
                        // Only count if we have a valid document ID (not N/A)
                        if (docId && docId !== 'N/A' && docId !== 'N/A') {
                            // Count for all time
                            allTimeDocCounter[docId] = (allTimeDocCounter[docId] || 0) + 1;
                            docTitles[docId] = title;
                            
                            // Check if this document was borrowed in last 30 days
                            if (request.date_returned || request.date_released) {
                                const date = new Date(request.date_returned || request.date_released);
                                if (date >= thirtyDaysAgo && date <= currentDate) {
                                    last30DaysDocCounter[docId] = (last30DaysDocCounter[docId] || 0) + 1;
                                }
                            }
                        }
                    });
                    
                    // Log what we found
                    console.log('Document IDs found (all time):', Object.keys(allTimeDocCounter));
                    console.log('Document counts (all time):', allTimeDocCounter);
                    
                    // Convert to array of objects for all-time sorting
                    const allTimeDocArray = Object.keys(allTimeDocCounter).map(docId => ({
                        docId: docId,
                        title: docTitles[docId],
                        count: allTimeDocCounter[docId]
                    }));
                    
                    // Convert to array of objects for 30-day sorting
                    const last30DaysDocArray = Object.keys(last30DaysDocCounter).map(docId => ({
                        docId: docId,
                        title: docTitles[docId],
                        count: last30DaysDocCounter[docId]
                    }));
                    
                    // Sort by count (descending) and take top 5
                    stats.allTimeBorrowedDocs = allTimeDocArray
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);
                    
                    stats.topBorrowedDocs = last30DaysDocArray
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 5);
                    
                    console.log('Top 5 borrowed docs (all time):', stats.allTimeBorrowedDocs);
                    console.log('Top 5 borrowed docs (30 days):', stats.topBorrowedDocs);
                }
                resolve(stats);
            })
            .catch(error => {
                console.error('Error fetching returned docs:', error);
                resolve(stats); 
            });
    });
}

function formatDateForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// statsReport Button event listener
document.addEventListener('DOMContentLoaded', function() {
    const statsReportBtn = document.getElementById('statsReport');
    if (statsReportBtn) {
        statsReportBtn.addEventListener('click', downloadStatsReport);
    } else {
        console.warn('Stats Report button not found in DOM');
    }
});