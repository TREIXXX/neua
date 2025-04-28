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

    // Initialize File Chart with ID
    const fileCtx = document.getElementById('fileChart').getContext('2d');
    fileChart = new Chart(fileCtx, {
        type: 'doughnut',
        data: {
            labels: ['BSIT', 'BSCS', 'BSIS', 'BLIS', 'Unidentified'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: ['#6765E7', '#52BAEA', '#FF794D', '#FF4D6F', '#aeaeae'],
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
            labels: ['Reserved', 'Released', 'Overdue', 'Broken', 'Missing'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: ['#0092CC', '#34C759', '#FF9500', '#FF3B30', '#aeaeae'],
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
            labels: ['Student', 'Alumni', 'Faculty', 'Pending'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#FF9500', '#34C759', '#0092CC', '#aeaeae'],
                borderWidth: 0,
                spacing: 6,
                borderRadius: 20,
                hoverOffset: 12
            }]
        },
        options: { ...chartOptions, id: 'userChart' }
    });

    // Initialize custom legends
    updateLegends();
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
        fileData.unidentified
    ];
    fileChart.update();

    // Update Document Status Chart
    docStatusChart.data.datasets[0].data = [
        docStatusData.reserved,
        docStatusData.released,
        docStatusData.overdue,
        docStatusData.broken,
        docStatusData.missing
    ];
    docStatusChart.update();

    // Update User Chart with user type distribution
    userChart.data.datasets[0].data = [
        userData.student,
        userData.alumni,
        userData.faculty,
        userData.pending
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
    startOverdueCheck();
    
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
    Promise.all([
        fetch('admin_dashboard.php?action=getFiles'),
        fetch('admin_dashboard.php?action=getApprovedUsers'),
        fetch('admin_dashboard.php?action=getPendingUsers'),
        fetch('admin_dashboard.php?action=getDocRequests'),
        fetch('admin_dashboard.php?action=getReturnedDocs')
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([fileResponse, userResponse, pendingResponse, docResponse, returnedDocsResponse]) => {
        // Process File Records by course
        const fileData = {
            bsit: 0,
            bscs: 0,
            bsis: 0,
            blis: 0,
            unidentified: 0
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
                    fileData.unidentified++;
                }
            });
        }

        const userData = {
            student: 0,
            alumni: 0,
            faculty: 0,
            pending: 0
        };

        if (userResponse.success && userResponse.approvedUsers) {
            userResponse.approvedUsers.forEach(user => {
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
                }
            });
        }

        if (pendingResponse.success && pendingResponse.pendingUsers) {
            userData.pending = pendingResponse.pendingUsers.length;
        }

        const docStatusData = {
            reserved: 0,
            released: 0,
            overdue: 0,
            broken: 0,
            missing: 0
        };

        // Count active requests (Reserved, Released, Overdue)
        if (docResponse.success && docResponse.requests) {
            docResponse.requests.forEach(req => {
                const isOverdue = checkIfOverdue(req.date_released, req.status);
                const status = isOverdue ? 'overdue' : (req.status ? req.status.toLowerCase() : '');
                
                switch(status) {
                    case 'reserved':
                        docStatusData.reserved++;
                        break;
                    case 'released':
                        docStatusData.released++;
                        break;
                    case 'overdue':
                        docStatusData.overdue++;
                        break;
                }
            });
        }

        // Count returned docs including Broken and Missing
        if (returnedDocsResponse.success && returnedDocsResponse.requests) {
            returnedDocsResponse.requests.forEach(req => {
                const status = req.status ? req.status.toLowerCase() : '';
                switch(status) {
                    case 'broken':
                        docStatusData.broken++;
                        break;
                    case 'missing':
                        docStatusData.missing++;
                        break;
                }
            });
        }

        updateCharts(fileData, userData, docStatusData);

        document.getElementById('fileCount').textContent = 
            Object.values(fileData).reduce((a, b) => a + b, 0);
        
        document.getElementById('userCount').textContent = 
            userData.student + userData.alumni + userData.faculty + userData.pending;
        
        document.getElementById('docStatusCount').textContent = 
            Object.values(docStatusData).reduce((a, b) => a + b, 0);

        console.log('Updated Stats:', {
            'Files by Course': fileData,
            'Users by Type': userData,
            'Document Status': docStatusData
        });
    })
    .catch(error => {
        console.error('Error loading chart data:', error);
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
        title: 'NEUR Stats Report',
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
        
        const totalFiles = fileData.reduce((a, b) => a + b, 0);
        const totalDocs = docStatusData.reduce((a, b) => a + b, 0);
        const totalUsers = userData.reduce((a, b) => a + b, 0);
        
        doc.text(`Total Files: ${totalFiles}`, 40, yPos + 15);
        doc.text(`Requested Documents: ${totalDocs}`, 85, yPos + 15);
        doc.text(`Total Users: ${totalUsers}`, 150, yPos + 15);
        
        yPos += 30; 
        
        
        const fileTableData = [
            fileLabels.map((label, i) => [label, fileData[i], calculatePercentage(fileData[i], totalFiles)])
        ].flat();
        
        // Add the additional file data
        fileTableData.push(
            ['', '', ''],
            ['Within 5 years', additionalData.filesWithinFiveYears, calculatePercentage(additionalData.filesWithinFiveYears, totalFiles)],
            ['Over 5 years', additionalData.filesOverFiveYears, calculatePercentage(additionalData.filesOverFiveYears, totalFiles)]
        );
        
        doc.autoTable({
            startY: yPos,
            head: [
                [{ content: 'FILES STATISTICS', colSpan: 3, styles: { 
                    halign: 'center', 
                    fillColor: null, 
                    textColor: [0, 0, 0], 
                    fontStyle: 'bold',
                    fontSize: 14, 
                    cellPadding: { top: 5, bottom: 5 }, 
                    lineWidth: 0, 
                }}],
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
                [{ content: 'DOCUMENTS STATUS', colSpan: 3, styles: { 
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
        
        yPos = doc.lastAutoTable.finalY + 10; 
        
        // Check if we need a new page for user section - adjusted threshold
        if (yPos > 240) {
            doc.addPage();
            
            yPos = 25; // Start position on new page
        }
        
        // Users Section with merged headers and larger title
        const userTableData = [
            userLabels.map((label, i) => [label, userData[i], calculatePercentage(userData[i], totalUsers)])
        ].flat();
        
        // Add the additional user data
        userTableData.push(
            ['', '', ''],
            ['Active', additionalData.activeUsers, calculatePercentage(additionalData.activeUsers, totalUsers)],
            ['Deactivated', additionalData.deactivatedUsers, calculatePercentage(additionalData.deactivatedUsers, totalUsers)]
        );
        
        doc.autoTable({
            startY: yPos,
            head: [
                [{ content: 'USERS STATISTICS', colSpan: 3, styles: { 
                    halign: 'center', 
                    fillColor: null, 
                    textColor: [0, 0, 0], 
                    fontStyle: 'bold',
                    fontSize: 14, 
                    cellPadding: { top: 5, bottom: 5 }, 
                    lineWidth: 0, 
                }}],
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
            deactivatedUsers: 0
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

        // Count active and deactivated users from allUserRecords
        allUserRecords.forEach(user => {
            if (user.account_status === 'deactivated') {
                stats.deactivatedUsers++;
            } else {
                stats.activeUsers++;
            }
        });

        // Fetch returned documents to count completions
        fetch('admin_dashboard.php?action=getReturnedDocs')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.requests) {
                    // Count documents returned within time periods
                    data.requests.forEach(request => {
                        if (request.status === 'Returned' && request.date_returned) {
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
                    });
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

