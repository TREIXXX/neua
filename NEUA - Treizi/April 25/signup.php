<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

$response = ['success' => false, 'message' => ''];

// Function to check if email exists in either users or pending_users tables
function checkEmailExists($email, $pdo) {
    // Check in users table
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE LOWER(email) = LOWER(?)");
    $stmt->execute([$email]);
    $userCount = $stmt->fetchColumn();

    // Check in pending_users table
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM pending_users WHERE LOWER(email) = LOWER(?)");
    $stmt->execute([$email]);
    $pendingCount = $stmt->fetchColumn();

    return ($userCount > 0 || $pendingCount > 0);
}

try {
    // Handle email check requests
    if (isset($_POST['action']) && $_POST['action'] === 'checkEmail' && isset($_POST['email'])) {
        $email = strtolower($_POST['email']);
        $exists = checkEmailExists($email, $pdo);
        
        echo json_encode([
            'success' => true,
            'exists' => $exists
        ]);
        exit;
    }

    // Handle user creation (admin)
    if (isset($_POST['action']) && $_POST['action'] === 'createUser') {
        try {
            $lastName = $_POST['lastName'];
            $firstName = $_POST['firstName'];
            $middleInitial = $_POST['middleInitial'];
            $email = strtolower($_POST['email']);
            $userId = $_POST['user_id'];
            $userType = $_POST['userType'];
            $password = $_POST['password'];

            // Validate input patterns
            if (!validateInputs($email, $userId, $userType)) {
                throw new Exception('Invalid email or ID format');
            }

            // Check email uniqueness
            if (checkEmailExists($email, $pdo)) {
                throw new Exception('Email is already registered');
            }

            $formattedName = formatName($lastName, $firstName, $middleInitial);
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $certificateUrl = null;

            // Handle certificate for students and alumni
            if (($userType === 'student' || $userType === 'alumni') && isset($_FILES['certificate'])) {
                $certificateUrl = handleCertificateUpload($_FILES['certificate']);
            }

            // Save directly to users table (admin creation)
            $stmt = $pdo->prepare("INSERT INTO users (name, email, user_id, user_type, password, status, certificate_url, created_at) 
                                 VALUES (?, ?, ?, ?, ?, 'approved', ?, NOW())");
            $stmt->execute([
                $formattedName,
                $email,
                $userId,
                strtolower($userType),
                $hashedPassword,
                $certificateUrl
            ]);

            $response['success'] = true;
            $response['message'] = 'User created successfully';

        } catch (Exception $e) {
            $response['success'] = false;
            $response['message'] = $e->getMessage();
            
            // Clean up certificate if there was an error
            if (isset($certificateUrl) && $certificateUrl && file_exists($certificateUrl)) {
                unlink($certificateUrl);
            }
        }
    }

    // Handle account request (student signup)
    if (isset($_POST['action']) && $_POST['action'] === 'requestAccount') {
        try {
            $email = strtolower($_POST['email']);
            $userId = $_POST['user_id'];

            // Validate inputs
            if (!validateInputs($email, $userId, 'student')) {
                throw new Exception('Invalid email or ID format');
            }

            // Check if email already exists
            if (checkEmailExists($email, $pdo)) {
                throw new Exception('This email is already registered or has a pending request');
            }

            $formattedName = formatName($_POST['lastName'], $_POST['firstName'], $_POST['middleInitial']);
            $hashedPassword = password_hash($_POST['password'], PASSWORD_DEFAULT);
            $certificateUrl = null;

            // Handle certificate upload
            if (isset($_FILES['certificate'])) {
                $certificateUrl = handleCertificateUpload($_FILES['certificate']);
            }

            // Save to pending_users table
            $stmt = $pdo->prepare("INSERT INTO pending_users (name, email, user_id, user_type, password, certificate_url, request_date) 
                                 VALUES (?, ?, ?, 'student', ?, ?, NOW())");
            $stmt->execute([
                $formattedName,
                $email,
                $userId,
                $hashedPassword,
                $certificateUrl
            ]);

            $response['success'] = true;
            $response['message'] = 'Account request submitted successfully! Please wait for admin approval.';

        } catch (Exception $e) {
            $response['success'] = false;
            $response['message'] = $e->getMessage();
            
            // Clean up certificate if there was an error
            if (isset($certificateUrl) && $certificateUrl && file_exists($certificateUrl)) {
                unlink($certificateUrl);
            }
        }
    }

} catch (Exception $e) {
    $response['message'] = $e->getMessage();
}

echo json_encode($response);

// Helper functions remain the same
function validateInputs($email, $id, $userType) {
    $emailPattern = ($userType === 'alumni') ? 
        '/^[a-zA-Z0-9._%+-]+@(neu\.edu\.ph|gmail\.com)$/i' : 
        '/^[a-zA-Z0-9._%+-]+@neu\.edu\.ph$/i';
    
    $idPattern = ($userType === 'faculty') ? 
        '/^\d{6}$/' : 
        '/^\d{2}-\d{5}-\d{3}$/';

    return preg_match($emailPattern, $email) && preg_match($idPattern, $id);
}

function formatName($lastName, $firstName, $middleInitial) {
    // Convert names to title case
    $lastName = ucwords(strtolower(trim($lastName)));
    $firstName = ucwords(strtolower(trim($firstName)));
    $middleInitial = strtoupper(trim($middleInitial));

    // Format the full name
    $name = $lastName . ', ' . $firstName;
    if (!empty($middleInitial)) {
        $name .= ' ' . $middleInitial;
    }
    return $name;
}

function handleCertificateUpload($file) {
    // Check for upload errors
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Error uploading file');
    }

    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    $fileInfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($fileInfo, $file['tmp_name']);
    finfo_close($fileInfo);

    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Invalid file type. Only JPG and PNG files are allowed.');
    }

    // Validate file size (5MB = 5 * 1024 * 1024 bytes)
    $maxSize = 5 * 1024 * 1024;
    if ($file['size'] > $maxSize) {
        throw new Exception('File size exceeds maximum limit of 5MB.');
    }

    $uploadDir = 'uploads/certificates/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $fileName = uniqid() . '_' . time() . '_' . basename($file['name']);
    $targetPath = $uploadDir . $fileName;
    
    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        return $targetPath;
    }
    
    throw new Exception('Failed to save the uploaded file.');
}
?>