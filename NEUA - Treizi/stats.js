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
    loadChartData();
});

function loadChartData() {
    Promise.all([
        fetch('admin_dashboard.php?action=getFiles'),
        fetch('admin_dashboard.php?action=getApprovedUsers'),
        fetch('admin_dashboard.php?action=getPendingUsers'),
        fetch('admin_dashboard.php?action=getDocRequests')
    ])
    .then(responses => Promise.all(responses.map(res => res.json())))
    .then(([fileResponse, userResponse, pendingResponse, docResponse]) => {
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
            reserved: 12,
            released: 10,
            overdue: 5,
            broken: 2,
            missing: 3
        };

        if (docResponse.success && docResponse.requests) {
            docResponse.requests.forEach(req => {
                const status = req.status ? req.status.toLowerCase() : '';
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
        
        // Include pending users in total count
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