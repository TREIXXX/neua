<?php
session_start();
header('Content-Type: application/json');

$response = ['success' => false, 'message' => ''];

try {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';

    if (empty($email) || empty($password)) {
        throw new Exception('Email and password are required.');
    }

    // Create a safe filename from the email
    $safeEmail = preg_replace('/[^a-zA-Z0-9]/', '_', $email);
    $userFile = "users/approved/{$safeEmail}.json";

    if (!file_exists($userFile)) {
        throw new Exception('Invalid email or password.');
    }

    // Read and decode the user data
    $userData = json_decode(file_get_contents($userFile), true);

    if (!$userData || !password_verify($password, $userData['password'])) {
        throw new Exception('Invalid email or password.');
    }

    // Set session variables
    $_SESSION['user_logged_in'] = true;
    $_SESSION['user_email'] = $userData['email'];
    $_SESSION['user_type'] = $userData['user_type'];
    $_SESSION['user_name'] = $userData['name'];
    $_SESSION['user_id'] = $userData['user_id'];
    $_SESSION['certificate_url'] = $userData['certificate_url'];

    $response['success'] = true;
    $response['userType'] = $userData['user_type'];
    $response['redirect'] = isset($_SESSION['redirect_url']) ? $_SESSION['redirect_url'] : 'index.html';
    unset($_SESSION['redirect_url']);
} catch (Exception $e) {
    $response['message'] = $e->getMessage();
}

echo json_encode($response);
?>
