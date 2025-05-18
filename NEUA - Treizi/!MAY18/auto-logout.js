
// Configuration
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes 
const WARNING_BEFORE_TIMEOUT = 1 * 60 * 1000; // Show warning 1 minute before logout
let inactivityTimer;
let warningTimer;
let warningShown = false;

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    initAutoLogout();
});

// Initialize auto-logout functionality
function initAutoLogout() {
    // Reset timer on these events
    const events = [
        'mousedown', 'mousemove', 'keypress', 
        'scroll', 'touchstart', 'click', 'keydown'
    ];
    
    // Add event listeners for all activity events
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
    
    // Start the initial timer
    resetInactivityTimer();
    
    console.log('Auto-logout initialized: ' + (INACTIVITY_TIMEOUT/60000) + ' minutes');
}

// Reset the inactivity timer
function resetInactivityTimer() {
    // Clear existing timers
    clearTimeout(inactivityTimer);
    clearTimeout(warningTimer);
    
    // If warning was shown, hide it
    if (warningShown) {
        hideLogoutWarning();
    }
    
    // Set warning timer
    warningTimer = setTimeout(() => {
        showLogoutWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);
    
    // Set logout timer
    inactivityTimer = setTimeout(() => {
        performAutoLogout();
    }, INACTIVITY_TIMEOUT);
}

// Show warning before logout
function showLogoutWarning() {
    warningShown = true;
    
    // Create or get warning element
    let warningEl = document.getElementById('logout-warning');
    if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = 'logout-warning';
        warningEl.className = 'logout-warning';
        
        // Create title
        const title = document.createElement('h4');
        title.innerText = 'Session Timeout Warning';
        
        // Create message
        const message = document.createElement('p');
        message.innerText = 'Your session will expire in 1 minute due to inactivity. Click anywhere or press any key to stay logged in.';
        
        // Create counter
        const counter = document.createElement('p');
        counter.id = 'logout-counter';
        counter.className = 'logout-counter';
        counter.innerText = '60';
        
        // Create buttons container
        const buttons = document.createElement('div');
        buttons.className = 'logout-buttons';
        
        // Create stay logged in button
        const stayButton = document.createElement('button');
        stayButton.innerText = 'Stay Logged In';
        stayButton.className = 'btn btn-primary';
        stayButton.onclick = resetInactivityTimer;
        
        // Create logout button
        const logoutButton = document.createElement('button');
        logoutButton.innerText = 'Logout Now';
        logoutButton.className = 'btn btn-outline-secondary';
        logoutButton.onclick = performAutoLogout;
        
        // Add elements to warning
        buttons.appendChild(stayButton);
        buttons.appendChild(logoutButton);
        warningEl.appendChild(title);
        warningEl.appendChild(message);
        warningEl.appendChild(counter);
        warningEl.appendChild(buttons);
        
        // Add warning to document
        document.body.appendChild(warningEl);
        
        // Add styles if not already present
        addWarningStyles();
    }
    
    // Show the warning
    warningEl.style.display = 'block';
    
    // Start countdown
    let secondsLeft = 60;
    const counterEl = document.getElementById('logout-counter');
    
    const countdownInterval = setInterval(() => {
        secondsLeft--;
        if (counterEl) {
            counterEl.innerText = secondsLeft;
        }
        
        if (secondsLeft <= 0 || !warningShown) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Hide the logout warning
function hideLogoutWarning() {
    warningShown = false;
    const warningEl = document.getElementById('logout-warning');
    if (warningEl) {
        warningEl.style.display = 'none';
    }
}

// Perform the actual logout
function performAutoLogout() {
    console.log("Auto-logout triggered due to inactivity");
    
    // Call the logout function
    fetch('logout.php')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Clear session storage
                sessionStorage.clear();
                
                // Redirect to login page with message
                window.location.href = 'admin.html?session_expired=true';
            }
        })
        .catch(error => {
            console.error('Auto-logout error:', error);
            // Failsafe - redirect anyway
            window.location.href = 'admin.html?session_expired=true';
        });
}

// Add CSS styles for the warning dialog
function addWarningStyles() {
    // Check if styles already exist
    if (document.getElementById('logout-warning-styles')) {
        return;
    }
    
    const style = document.createElement('style');
    style.id = 'logout-warning-styles';
    style.innerHTML = `
        .logout-warning {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0,0,0,0.3);
            z-index: 9999;
            text-align: center;
            width: 350px;
        }
        .logout-counter {
            font-size: 24px;
            font-weight: bold;
            margin: 15px 0;
        }
        .logout-buttons {
            display: flex;
            justify-content: center;
            gap: 10px;
        }
    `;
    document.head.appendChild(style);
}

// Update login page to show message if session expired
window.addEventListener('DOMContentLoaded', function() {
    // Check if redirected due to session expiry
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('session_expired')) {
        // Show message if we have an alert container
        const alertContainer = document.getElementById('alertContainer');
        if (alertContainer) {
            showAlert('Your session expired due to inactivity. Please log in again.', 'warning');
        }
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});