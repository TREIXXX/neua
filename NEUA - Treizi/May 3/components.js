const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'fontawesome-free-6.7.1-web/css/all.min.css';
  document.head.appendChild(link);


// Custom Alert Functions
const MAX_ALERTS = 3;
  const alertQueue = [];
  
  function showAlert(message, type = 'info') {
      // If we already have max alerts, add to queue
      const alertContainer = document.getElementById('alertContainer');
      if (alertContainer.children.length >= MAX_ALERTS) {
          alertQueue.push({ message, type });
          return;
      }
      
      createAlert(message, type);
  }
  
  function createAlert(message, type) {
      const alertContainer = document.getElementById('alertContainer');
      
      // Create alert element
      const alert = document.createElement('div');
      alert.className = `custom-alert alert alert-${type} show`;
      
      // Create alert content
      const alertContent = document.createElement('div');
      alertContent.className = 'd-flex align-items-center';
      
      // Create icon
      const alertIcon = document.createElement('span');
      alertIcon.className = 'alert-icon';
      
      // Set icon based on type
      switch (type) {
          case 'success':
              alertIcon.className = 'alert-icon fas fa-check-circle';
              break;
          case 'danger':
              alertIcon.className = 'alert-icon fas fa-exclamation-circle';
              break;
          case 'warning':
              alertIcon.className = 'alert-icon fas fa-exclamation-triangle';
              break;
          default:
              alertIcon.className = 'alert-icon fas fa-info-circle';
      }
      
      // Create message
      const alertMessage = document.createElement('span');
      alertMessage.textContent = message;
      
      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'close-btn ms-auto';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML = '&times;';
      closeBtn.onclick = function() {
          removeAlert(alert);
      };
      
      // Assemble the alert
      alertContent.appendChild(alertIcon);
      alertContent.appendChild(alertMessage);
      alertContent.appendChild(closeBtn);
      alert.appendChild(alertContent);
      
      // Add to container (prepend to show newest on top)
      alertContainer.prepend(alert);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
          removeAlert(alert);
      }, 5000);
  }
  
  function removeAlert(alertElement) {
      // Add fade-out animation
      alertElement.style.animation = 'fadeOut 0.3s ease-out';
      
      // Remove after animation completes
      setTimeout(() => {
          alertElement.remove();
          
          // Show next alert from queue if available
          if (alertQueue.length > 0) {
              const nextAlert = alertQueue.shift();
              createAlert(nextAlert.message, nextAlert.type);
          }
      }, 300);
  }





/*Sidebar Menu---------------------------------------------------------------------------------------------*/

document.addEventListener('DOMContentLoaded', function () {
  const sidebarMenu = document.getElementById('sidebarMenu');
  const sidebarBackdrop = document.querySelector('.sidebar-backdrop');
  const sidebarToggle = document.getElementById('sidebarToggle');

  // Toggle sidebar visibility
  sidebarToggle.addEventListener('click', () => {
    const isSidebarOpen = sidebarMenu.classList.contains('show');
    if (isSidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Open sidebar
  function openSidebar() {
    sidebarMenu.classList.add('show');
    sidebarBackdrop.classList.add('show');
  }

  // Close sidebar
  function closeSidebar() {
    sidebarMenu.classList.remove('show');
    sidebarBackdrop.classList.remove('show');
  }

  // Close sidebar when clicking outside
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Close sidebar when clicking the close button
  document.querySelector('.btn-close').addEventListener('click', closeSidebar);

  // Auto close sidebar if the screen width exceeds 768px
  function handleResize() {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  }

  // Listen for window resize events
  window.addEventListener('resize', handleResize);

  // Initial check on page load
  handleResize();
});





/*To-top button---------------------------------------------------------------------------------------------*/
function scrollFunction() {
    let mybutton = document.getElementById("myBtn");
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        mybutton.style.display = "block";
    } else {
        mybutton.style.display = "none";
    }
    }
    
    
    window.onscroll = scrollFunction;
    
    
    function topFunction() {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE, and Opera
    }

    //typewriter feature
    document.addEventListener("DOMContentLoaded", function() {
     
      function typeWriterEffect(elementId, speed = 100, callback) {
          const element = document.getElementById(elementId);
          const text = element.textContent; 
          element.textContent = ""; 
          let i = 0;
  
          function typeWriter() {
              if (i < text.length) {
                  element.textContent += text.charAt(i); 
                  i++;
                  setTimeout(typeWriter, speed); 
              } else if (callback) {
                  callback(); 
              }
          }
  
          typeWriter();
      }
  
          typeWriterEffect("heading", 180);
  });

/* Web Loader --------------------------------------------------------------------------------------------- */
const loader = document.querySelector(".loader");

// Function to check connection speed
async function checkConnectionSpeed() {
    const startTime = performance.now();
    try {
        // Try to fetch a small resource to test connection speed
        const response = await fetch('https://www.google.com/favicon.ico');
        const endTime = performance.now();
        
        // Calculate load time in milliseconds
        const loadTime = endTime - startTime;
        
        // Consider connection slow if load time is greater than 1000ms (1 second)
        return loadTime > 1000;
    } catch (error) {
        console.warn('Connection test failed:', error);
        // If fetch fails, assume slow connection
        return true;
    }
}

// Initialize loader based on connection speed
window.addEventListener("load", async () => {
    const isSlowConnection = await checkConnectionSpeed();
    
    if (!isSlowConnection) {
        // If connection is fast, remove loader immediately
        if (loader && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
        startAutoScroll();
        return;
    }

    // For slow connections, show loader until content is fully loaded
    const hideLoader = () => {
        loader.classList.add("loader--hidden");
        
        loader.addEventListener("transitionend", () => {
            if (loader.parentNode) {
                loader.parentNode.removeChild(loader);
            }
            startAutoScroll();
        });
    };

    // Hide loader when everything is loaded
    if (document.readyState === 'complete') {
        hideLoader();
    } else {
        window.addEventListener('load', hideLoader);
    }
});
/* Autoscroll --------------------------------------------------------------------------------------------- */
function startAutoScroll() {
  // Get the target element
  const targetElement = document.getElementById("scroll-target");

  // Check if the target element exists
  if (targetElement) {
    // Calculate its position and apply offset
    const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
    const offsetPosition = elementPosition - 50;

    // Scroll to the adjusted position
    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const toggleReadingMode = document.getElementById("flexSwitchCheckChecked");

  // Reading Mode Toggle
  toggleReadingMode.addEventListener("change", () => {
    if (toggleReadingMode.checked) {
      const filterDiv = document.createElement("div");
      filterDiv.classList.add("reading-mode");
      filterDiv.id = "readingModeFilter";
      document.body.appendChild(filterDiv);
    } else {
      const filterDiv = document.getElementById("readingModeFilter");
      if (filterDiv) {
        document.body.removeChild(filterDiv);
      }
    }
  });
});










// Add this to your existing JavaScript file

document.addEventListener('DOMContentLoaded', function() {
  const graphics = document.querySelectorAll('.home-graphic-left, .home-graphic-right');
  
  // Fade in function
  const fadeInOnScroll = () => {
      graphics.forEach(graphic => {
          const graphicTop = graphic.getBoundingClientRect().top;
          const windowHeight = window.innerHeight;
          
          if (graphicTop < windowHeight - 100) { // -100 to trigger slightly before element comes into view
              graphic.classList.add('fade-in');
          }
      });
  };

  // Initial check on page load
  fadeInOnScroll();

  // Check on scroll
  window.addEventListener('scroll', fadeInOnScroll);
});