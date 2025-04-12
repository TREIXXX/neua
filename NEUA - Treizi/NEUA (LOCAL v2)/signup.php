<?php
header('Content-Type: application/json');

$response = ['success' => false, 'message' => ''];

// Function to check if email exists in a directory
function checkEmailInDirectory($email, $directory) {
    if (!is_dir($directory)) return false;
    $files = scandir($directory);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        if (pathinfo($file, PATHINFO_EXTENSION) === 'json') {
            $userData = json_decode(file_get_contents($directory . '/' . $file), true);
            if (isset($userData['email']) && $userData['email'] === $email) {
                return true;
            }
        }
    }
    return false;
}

try {
    // Handle email check requests
    if (isset($_POST['action']) && $_POST['action'] === 'checkEmail' && isset($_POST['email'])) {
        $email = $_POST['email'];
        $exists = checkEmailInDirectory($email, 'users/approved') || 
                 checkEmailInDirectory($email, 'users/pending');
        
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
            $email = $_POST['email'];
            $userId = $_POST['user_id'];
            $userType = $_POST['userType'];
            $password = $_POST['password'];

            // Validate input patterns
            if (!validateInputs($email, $userId, $userType)) {
                throw new Exception('Invalid email or ID format');
            }

            $formattedName = formatName($lastName, $firstName, $middleInitial);

            // Check email uniqueness
            if (checkEmailInDirectory($email, 'users/approved') || checkEmailInDirectory($email, 'users/pending')) {
                throw new Exception('Email is already registered');
            }

            $userData = [
                'name' => $formattedName,
                'email' => $email,
                'user_id' => $userId,
                'user_type' => strtolower($userType),
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'created_at' => date('Y-m-d H:i:s')
            ];

            // Handle certificate for students and alumni
            if (($userType === 'student' || $userType === 'alumni') && isset($_FILES['certificate'])) {
                $certificateFile = handleCertificateUpload($_FILES['certificate']);
                if ($certificateFile) {
                    $userData['certificate_url'] = $certificateFile;
                }
            }

            // Save directly to approved users for admin creation
            $approvedPath = "users/approved/" . preg_replace('/[^a-zA-Z0-9]/', '_', $email) . '.json';
            if (!is_dir('users/approved')) {
                mkdir('users/approved', 0777, true);
            }

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
    }

    // Handle account request (student signup)
    if (isset($_POST['action']) && $_POST['action'] === 'requestAccount') {
        try {
            // Similar validation as above
            if (!validateInputs($_POST['email'], $_POST['user_id'], 'student')) {
                throw new Exception('Invalid email or ID format');
            }

            // Create pending user record
            $userData = [
                'name' => formatName($_POST['lastName'], $_POST['firstName'], $_POST['middleInitial']),
                'email' => $_POST['email'],
                'user_id' => $_POST['user_id'],
                'user_type' => 'student',
                'password' => password_hash($_POST['password'], PASSWORD_DEFAULT),
                'created_at' => date('Y-m-d H:i:s'),
                'status' => 'pending'
            ];

            if (isset($_FILES['certificate'])) {
                $certificateFile = handleCertificateUpload($_FILES['certificate']);
                if ($certificateFile) {
                    $userData['certificate_url'] = $certificateFile;
                }
            }

            $pendingPath = "users/pending/" . preg_replace('/[^a-zA-Z0-9]/', '_', $_POST['email']) . '.json';
            if (!is_dir('users/pending')) {
                mkdir('users/pending', 0777, true);
            }

            if (file_put_contents($pendingPath, json_encode($userData, JSON_PRETTY_PRINT))) {
                $response['success'] = true;
                $response['message'] = 'Account request submitted successfully! Please wait for admin approval.';
            } else {
                throw new Exception('Error submitting account request');
            }
        } catch (Exception $e) {
            $response['success'] = false;
            $response['message'] = $e->getMessage();
        }
    }

    // Validate required fields
    $requiredFields = ['firstName', 'lastName', 'email', 'studentId', 'password'];
    foreach ($requiredFields as $field) {
        if (!isset($_POST[$field]) || empty($_POST[$field])) {
            throw new Exception("$field is required");
        }
    }

    // Handle certificate upload
    $certificateFile = null;
    if (isset($_FILES['certificate']) && $_FILES['certificate']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/certificates/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        $fileName = time() . '_' . $_FILES['certificate']['name'];
        $targetPath = $uploadDir . $fileName;
        
        if (move_uploaded_file($_FILES['certificate']['tmp_name'], $targetPath)) {
            $certificateFile = $fileName;
        }
    }

    // Format user data to match required structure
    $userData = [
        'name' => $_POST['lastName'] . ' ' . $_POST['firstName'] . 
                 (!empty($_POST['middleInitial']) ? ' ' . $_POST['middleInitial'] : ''),
        'email' => $email,
        'user_id' => $_POST['studentId'],
        'user_type' => 'Student', // Capitalized to match display formatting
        'password' => password_hash($_POST['password'], PASSWORD_DEFAULT),
        'created_at' => date('Y-m-d H:i:s'),
        'certificate_file' => $certificateFile,
        'status' => 'pending'
    ];

    // Save user data as JSON
    $pendingPath = "users/pending/" . preg_replace('/[^a-zA-Z0-9]/', '_', $email) . '.json';
    if (file_put_contents($pendingPath, json_encode($userData, JSON_PRETTY_PRINT))) {
        $response['success'] = true;
        $response['message'] = 'Your account request has been submitted and is pending approval';
    } else {
        throw new Exception('Error saving user data');
    }

} catch (Exception $e) {
    $response['message'] = $e->getMessage();
}

echo json_encode($response);

// Helper functions
function validateInputs($email, $id, $userType) {
    $emailPattern = ($userType === 'alumni') ? 
        '/^[a-zA-Z0-9._%+-]+@(neu\.edu\.ph|gmail\.com)$/' : 
        '/^[a-zA-Z0-9._%+-]+@neu\.edu\.ph$/';
    
    $idPattern = ($userType === 'faculty') ? 
        '/^\d{6}$/' : 
        '/^\d{2}-\d{5}-\d{3}$/';

    return preg_match($emailPattern, $email) && preg_match($idPattern, $id);
}

function formatName($lastName, $firstName, $middleInitial) {
    $name = $lastName . ', ' . $firstName;
    if (!empty($middleInitial)) {
        $name .= ' ' . $middleInitial;
    }
    return $name;
}

function handleCertificateUpload($file) {
    if ($file['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/certificates/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        $fileName = uniqid() . '_' . time() . '_' . basename($file['name']);
        $targetPath = $uploadDir . $fileName;
        
        if (move_uploaded_file($file['tmp_name'], $targetPath)) {
            return $targetPath;
        }
    }
    return null;
}
?>
