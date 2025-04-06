<?php
session_start(); 
$adminAccounts = [
    ['email' => 'databaseneua@gmail.com', 'password' => password_hash('admin', PASSWORD_DEFAULT)], // account 1
    ['email' => 'admin123@gmail.com', 'password' => password_hash('admin123', PASSWORD_DEFAULT)], // account 2
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'];
    $password = $_POST['password'];

    $loginSuccessful = false;
    foreach ($adminAccounts as $account) {
        if ($email === $account['email'] && password_verify($password, $account['password'])) {
            $loginSuccessful = true;
            break;
        }
    }

    if ($loginSuccessful) {
        $_SESSION['loggedin'] = true;
        $_SESSION['email'] = $email;

       
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
    }
    exit;
}

?>
