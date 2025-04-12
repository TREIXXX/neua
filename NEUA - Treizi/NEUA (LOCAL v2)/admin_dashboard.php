<?php
require 'vendor/autoload.php'; // Ensure Composer autoload is included

use Smalot\PdfParser\Parser;

$targetDir = "pdfs/";
$textDir = "pdfs/textfile/"; 
$jsonDir = "pdfs/pdfjson/";
$pendingUsersDir = "users/pending/";
$approvedUsersDir = "users/approved/";
$response = array('success' => false, 'message' => '');

// Ensure the text directory exists
if (!is_dir($textDir)) {
    mkdir($textDir, 0755, true); 
}

// Ensure the JSON directory exists
if (!is_dir($jsonDir)) {
    mkdir($jsonDir, 0755, true);
}

// Ensure directories exist
if (!is_dir($pendingUsersDir)) {
    mkdir($pendingUsersDir, 0755, true);
}
if (!is_dir($approvedUsersDir)) {
    mkdir($approvedUsersDir, 0755, true);
}

// Handle PDF file upload and text extraction
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['pdfFiles'])) {
    $files = $_FILES['pdfFiles'];

    // Number of files max limit
    if (count($files['name']) > 20) {
        $response['message'] = 'You can upload a maximum of 20 files.';
        echo json_encode($response);
        exit;
    }

    for ($i = 0; $i < count($files['name']); $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            $response['message'] = 'Error uploading file: ' . $files['name'][$i];
            echo json_encode($response);
            exit;
        }

        // Set target file path for PDF
        $targetFilePath = $targetDir . basename($files['name'][$i]);

        // Move uploaded file to target directory
        if (move_uploaded_file($files['tmp_name'][$i], $targetFilePath)) {
            $parser = new Parser();
            $pdf = $parser->parseFile($targetFilePath);
            $text = $pdf->getText(); // Extract text

            // Process the extracted text to add spaces
            $processedText = addSpacesToText($text);

            // Save the extracted text as a .txt file in the textfile directory
            $textFilePath = $textDir . basename($files['name'][$i], '.pdf') . '.txt'; // Create the .txt file name
            file_put_contents($textFilePath, $processedText); 

            $response['success'] = true; 
        } else {
            $response['message'] = 'Error moving file: ' . $files['name'][$i];
            echo json_encode($response);
            exit;
        }
    }

    $response['message'] = 'All files uploaded successfully!';
}

// Handle file deletion
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'deleteFile' && isset($_GET['file'])) {
    $fileToDelete = $targetDir . basename($_GET['file']);

    if (file_exists($fileToDelete)) {
        if (unlink($fileToDelete)) {
            $response['success'] = true;
            $response['message'] = 'File deleted successfully!';
        } else {
            $response['message'] = 'Failed to delete file.';
        }
    } else {
        $response['message'] = 'File not found.';
    }
}

// Fetch list of files for GET request
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getFiles') {
    // Fetch list of files from the pdfs directory
    $files = scandir($targetDir);
    $files = array_diff($files, array('.', '..')); // Remove . and .. from the list

    $fileRecords = [];
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'pdf') {
            $filePath = $targetDir . $file;
            $jsonPath = $jsonDir . pathinfo($file, PATHINFO_FILENAME) . '.json';
            
            // Get metadata if exists
            $metadata = file_exists($jsonPath) ? json_decode(file_get_contents($jsonPath), true) : [];
            
            $fileInfo = [
                'name' => $file,
                'size' => filesize($filePath),
                'last_modified' => date("Y-m-d", filemtime($filePath)),
                'author' => isset($metadata['author']) ? $metadata['author'] : '',
                'year' => isset($metadata['year']) ? $metadata['year'] : '',
                'course' => isset($metadata['course']) ? $metadata['course'] : ''
            ];
            $fileRecords[] = $fileInfo;
        }
    }

    $response['success'] = true;
    $response['files'] = $fileRecords;
    echo json_encode($response);
    exit;
}

// Fetch pending users with proper certificate URLs
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getPendingUsers') {
    $pendingUsers = [];
    $files = scandir($pendingUsersDir);
    
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..' && pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $userData = json_decode(file_get_contents($pendingUsersDir . $file), true);
            $userData['requestId'] = pathinfo($file, PATHINFO_FILENAME);
            
            // Fix the certificate URL path - remove the duplicate 'uploads/certificates/'
            if (isset($userData['certificate_file'])) {
                // Just use the filename since the path is already included in certificate_file
                $userData['certificate_url'] = $userData['certificate_file'];
            }
            
            $pendingUsers[] = $userData;
        }
    }
    
    $response['success'] = true;
    $response['pendingUsers'] = $pendingUsers;
    echo json_encode($response);
    exit;
}

// Fetch approved users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getApprovedUsers') {
    $approvedUsers = [];
    $files = scandir($approvedUsersDir);
    
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..' && pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $userData = json_decode(file_get_contents($approvedUsersDir . $file), true);
            $userData['userId'] = pathinfo($file, PATHINFO_FILENAME);
            $approvedUsers[] = $userData;
        }
    }
    
    $response['success'] = true;
    $response['approvedUsers'] = $approvedUsers;
    echo json_encode($response);
    exit;
}

// Handle user rejection
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'rejectUser') {
    $response = array('success' => false, 'message' => '');
    
    try {
        $requestId = $_POST['requestId'];
        $pendingFile = $pendingUsersDir . $requestId . '.json';
        
        if (!file_exists($pendingFile)) {
            throw new Exception("User request not found");
        }
        
        // Read user data to get certificate path if exists
        $userData = json_decode(file_get_contents($pendingFile), true);
        if (isset($userData['certificate_url']) && file_exists($userData['certificate_url'])) {
            unlink($userData['certificate_url']); // Delete certificate file
        }
        
        // Delete pending request file
        if (unlink($pendingFile)) {
            $response['success'] = true;
            $response['message'] = 'User request rejected successfully';
        } else {
            throw new Exception("Error rejecting user request");
        }
        
    } catch (Exception $e) {
        $response['message'] = 'Error rejecting user: ' . $e->getMessage();
    }
    
    echo json_encode($response);
    exit;
}

// Handle file update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'updateFile') {
    $originalFileName = $_POST['originalFileName'];
    $newFileName = $_POST['newFileName'];
    $author = $_POST['author'];
    $year = $_POST['year'];
    $course = $_POST['course'];

    $originalPath = $targetDir . $originalFileName;
    $newPath = $targetDir . $newFileName;
    
    try {
        // First check if source file exists
        if (!file_exists($originalPath)) {
            throw new Exception('Source PDF file not found');
        }

        // Create metadata
        $metadata = [
            'author' => $author,
            'year' => $year,
            'course' => $course,
            'last_modified' => date("Y-m-d")
        ];
        
        // If filename is being changed
        if ($originalFileName !== $newFileName) {
            // Rename the PDF file first
            if (!rename($originalPath, $newPath)) {
                throw new Exception('Failed to rename PDF file');
            }
            
            // Update text file if it exists
            $originalTextPath = $textDir . pathinfo($originalFileName, PATHINFO_FILENAME) . '.txt';
            $newTextPath = $textDir . pathinfo($newFileName, PATHINFO_FILENAME) . '.txt';
            if (file_exists($originalTextPath)) {
                rename($originalTextPath, $newTextPath);
            }
            
            // Remove old JSON file if it exists
            $oldJsonPath = $jsonDir . pathinfo($originalFileName, PATHINFO_FILENAME) . '.json';
            if (file_exists($oldJsonPath)) {
                unlink($oldJsonPath);
            }
        }

        // Save metadata to JSON file in the pdfjson directory
        $jsonPath = $jsonDir . pathinfo($newFileName, PATHINFO_FILENAME) . '.json';
        if (!file_put_contents($jsonPath, json_encode($metadata))) {
            throw new Exception('Failed to save metadata');
        }

        // If we renamed the file, remove old metadata file
        if ($originalFileName !== $newFileName) {
            $oldMetadataPath = $targetDir . pathinfo($originalFileName, PATHINFO_FILENAME) . '_metadata.json';
            if (file_exists($oldMetadataPath)) {
                unlink($oldMetadataPath);
            }
        }

        $response['success'] = true;
        $response['message'] = 'File and metadata updated successfully';
        $response['updatedFile'] = [
            'name' => $newFileName,
            'author' => $author,
            'year' => $year,
            'course' => $course,
            'last_modified' => date("Y-m-d")
        ];
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = $e->getMessage();
    }
}

// Handle user creation request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'createUser') {
    $response = array('success' => false, 'message' => '');
    
    try {
        $email = $_POST['email'];
        
        // Check if email already exists
        if (isEmailRegistered($email)) {
            throw new Exception("This email is already registered");
        }
        
        $userData = [
            'name' => $_POST['name'],
            'email' => $email,
            'user_id' => $_POST['id'],
            'user_type' => $_POST['userType'],
            'password' => password_hash($_POST['password'], PASSWORD_DEFAULT),
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        // Handle certificate upload if provided
        if (isset($_FILES['certificate'])) {
            $certificateFile = $_FILES['certificate'];
            $certificatePath = 'certificates/' . uniqid() . '_' . basename($certificateFile['name']);
            if (move_uploaded_file($certificateFile['tmp_name'], $certificatePath)) {
                $userData['certificate_url'] = $certificatePath;
            }
        }
        
        // Save directly to approved users directory since this is admin creation
        $fileName = $approvedUsersDir . uniqid() . '.json';
        if (file_put_contents($fileName, json_encode($userData))) {
            $response['success'] = true;
            $response['message'] = 'User created successfully';
            http_response_code(200);
        } else {
            throw new Exception("Error saving user data");
        }
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = $e->getMessage();
        http_response_code(400);
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Handle account request (for regular signup)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'requestAccount') {
    $response = array('success' => false, 'message' => '');
    
    try {
        $email = $_POST['email'];
        
        // Check if email already exists
        if (isEmailRegistered($email)) {
            throw new Exception("This email is already registered");
        }
        
        $userData = [
            'name' => $_POST['name'],
            'email' => $email,
            'user_id' => $_POST['id'],
            'user_type' => $_POST['userType'],
            'password' => password_hash($_POST['password'], PASSWORD_DEFAULT),
            'request_date' => date('Y-m-d H:i:s')
        ];
        
        // Handle certificate upload if provided
        if (isset($_FILES['certificate'])) {
            $certificateFile = $_FILES['certificate'];
            $certificatePath = 'certificates/' . uniqid() . '_' . basename($certificateFile['name']);
            if (move_uploaded_file($certificateFile['tmp_name'], $certificatePath)) {
                $userData['certificate_url'] = $certificatePath;
            }
        }
        
        // Save to pending users directory
        $fileName = $pendingUsersDir . uniqid() . '.json';
        if (file_put_contents($fileName, json_encode($userData))) {
            $response['success'] = true;
            $response['message'] = 'Account request submitted successfully';
            http_response_code(200);
        } else {
            throw new Exception("Error saving user data");
        }
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = $e->getMessage();
        http_response_code(400);
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Handle user approval with proper data transfer
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'approveUser') {
    try {
        $requestId = $_POST['requestId'];
        $pendingFile = $pendingUsersDir . $requestId . '.json';
        
        if (!file_exists($pendingFile)) {
            throw new Exception("User request not found");
        }
        
        // Read pending user data
        $userData = json_decode(file_get_contents($pendingFile), true);
        $userData['approved_date'] = date('Y-m-d H:i:s');
        
        // Ensure all data is preserved including ID and certificate
        $approvedFile = $approvedUsersDir . uniqid() . '.json';
        if (file_put_contents($approvedFile, json_encode($userData, JSON_PRETTY_PRINT))) {
            unlink($pendingFile);
            $response['success'] = true;
            $response['message'] = 'User approved successfully';
        } else {
            throw new Exception("Error approving user");
        }
        
    } catch (Exception $e) {
        $response['message'] = 'Error approving user: ' . $e->getMessage();
    }
    
    echo json_encode($response);
    exit;
}

// Handle user deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'deleteUser') {
    $response = array('success' => false, 'message' => '');
    
    try {
        $userId = $_POST['userId'];
        $userFile = $approvedUsersDir . $userId . '.json';
        
        if (!file_exists($userFile)) {
            throw new Exception("User not found");
        }
        
        // Read user data to get certificate path if exists
        $userData = json_decode(file_get_contents($userFile), true);
        if (isset($userData['certificate_url']) && file_exists($userData['certificate_url'])) {
            unlink($userData['certificate_url']); // Delete certificate file
        }
        
        // Delete user file
        if (unlink($userFile)) {
            $response['success'] = true;
            $response['message'] = 'User deleted successfully';
        } else {
            throw new Exception("Error deleting user");
        }
        
    } catch (Exception $e) {
        $response['message'] = 'Error deleting user: ' . $e->getMessage();
    }
    
    echo json_encode($response);
    exit;
}

// Add this section to handle email check requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'checkEmail' && isset($input['email'])) {
        $email = $input['email'];
        $pendingPath = "users/pending/" . preg_replace('/[^a-zA-Z0-9]/', '_', $email) . '.json';
        $approvedPath = "users/approved/" . preg_replace('/[^a-zA-Z0-9]/', '_', $email) . '.json';
        
        echo json_encode([
            'exists' => file_exists($pendingPath) || file_exists($approvedPath)
        ]);
        exit;
    }
}

// Handle direct user creation (bypass pending)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'createUserDirectly') {
    try {
        $lastName = $_POST['lastName'];
        $firstName = $_POST['firstName'];
        $middleInitial = $_POST['middleInitial'];
        $email = $_POST['email'];
        
        // Format name as "Last, First MI"
        $formattedName = $lastName . ', ' . $firstName;
        if (!empty($middleInitial)) {
            $formattedName .= ' ' . $middleInitial;
        }
        
        // Create user data
        $userData = [
            'name' => $formattedName,
            'email' => $email,
            'user_id' => $_POST['id'],
            'user_type' => strtolower($_POST['userType']),
            'password' => password_hash($_POST['password'], PASSWORD_DEFAULT),
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        // Handle certificate if provided
        if (isset($_FILES['certificate'])) {
            $certificateFile = $_FILES['certificate'];
            $certificatePath = 'uploads/certificates/' . uniqid() . '_' . $certificateFile['name'];
            if (move_uploaded_file($certificateFile['tmp_name'], $certificatePath)) {
                $userData['certificate_url'] = $certificatePath;
            }
        }
        
        // Save directly to approved users
        $approvedPath = "users/approved/" . preg_replace('/[^a-zA-Z0-9]/', '_', $email) . '.json';
        if (file_put_contents($approvedPath, json_encode($userData, JSON_PRETTY_PRINT))) {
            $response['success'] = true;
            $response['message'] = 'User created successfully';
        } else {
            throw new Exception('Error saving user data');
        }
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = $e->getMessage();
    }
    
    echo json_encode($response);
    exit;
}

echo json_encode($response);

// Function to process extracted text
function addSpacesToText($text) {
    $text = preg_replace('/([a-z])([A-Z])/', '$1 $2', $text);  // Space before capital letters
    $text = preg_replace('/([a-z])([0-9])/', '$1 $2', $text); // Space before numbers
    $text = preg_replace('/([0-9])([a-z])/', '$1 $2', $text);  // Space before numbers
    $text = preg_replace('/(\S)([.,!?;:])/u', '$1 $2', $text);  // Space before punctuation if no space exists

    // For BSIT only
    $text = preg_replace('/Bachelorof Sciencein Information Technology/i', 'Bachelor of Science in Information Technology', $text);

    // For BSCS only
    $text = preg_replace('/Bachelorof Sciencein Computer Science/i', 'Bachelor of Science in Computer Science', $text);

    // For BSIS only
    $text = preg_replace('/Bachelorof Sciencein Information Systems/i', 'Bachelor of Science in Information Systems', $text);

    return trim($text); 
}

// Add this new function after the other functions
function isEmailRegistered($email) {
    global $pendingUsersDir, $approvedUsersDir;
    
    // Check in pending users
    $pendingFiles = scandir($pendingUsersDir);
    foreach ($pendingFiles as $file) {
        if ($file !== '.' && $file !== '..' && pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $userData = json_decode(file_get_contents($pendingUsersDir . $file), true);
            if ($userData['email'] === $email) {
                return true;
            }
        }
    }
    
    // Check in approved users
    $approvedFiles = scandir($approvedUsersDir);
    foreach ($approvedFiles as $file) {
        if ($file !== '.' && $file !== '..' && pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $userData = json_decode(file_get_contents($approvedUsersDir . $file), true);
            if ($userData['email'] === $email) {
                return true;
            }
        }
    }
    
    return false;
}
?>