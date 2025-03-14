const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'fontawesome-free-6.7.1-web/css/all.min.css';
  document.head.appendChild(link);


// Custom Alert Functions
function showAlert(message, type = 'info') {
  const alert = document.getElementById('customAlert');
  const alertMessage = document.getElementById('alertMessage');
  const alertIcon = alert.querySelector('.alert-icon');

  alert.className = `custom-alert alert alert-${type} show`;
  alertMessage.textContent = message;

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

  setTimeout(() => {
    hideAlert();
  }, 5000); // Auto-hide after 5 seconds
}

function hideAlert() {
  const alert = document.getElementById('customAlert');
  alert.classList.remove('show');
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

// Ensure loader is shown for at least 2 seconds
let minimumLoadingTime = false;

setTimeout(() => {
  minimumLoadingTime = true;
}, 2000); // 2-second delay

window.addEventListener("load", () => {
  const hideLoader = () => {
    loader.classList.add("loader--hidden");

    // Wait for the loader's transition to end before removing it and starting autoscroll
    loader.addEventListener("transitionend", () => {
      if (loader.parentNode) {
        document.body.removeChild(loader);
      }
      startAutoScroll(); // Trigger autoscroll after loader disappears
    });
  };

  if (minimumLoadingTime) {
    // If 2 seconds have already passed, hide the loader immediately
    hideLoader();
  } else {
    // If the website finishes loading before 2 seconds, wait for the remaining time
    const remainingTime = 2000 - (performance.now() % 2000);
    setTimeout(hideLoader, remainingTime);
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
  const toggleHighContrast = document.getElementById("flexSwitchHighContrast");

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

  // High Contrast Text Toggle
  toggleHighContrast.addEventListener("change", () => {
    if (toggleHighContrast.checked) {
      document.documentElement.classList.add("high-contrast-text"); // Apply to <html>
    } else {
      document.documentElement.classList.remove("high-contrast-text");
    }
  });
});




