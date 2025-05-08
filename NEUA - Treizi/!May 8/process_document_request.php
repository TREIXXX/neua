<?php
require_once 'db_connect.php';

header('Content-Type: application/json');

// Add the checkUserRequestLimit function
function checkUserRequestLimit($pdo, $borrower_id) {
    // Get the count of requests made in the last 24 hours
    $stmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM document_requests 
        WHERE borrower_id = ? 
        AND date_released >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ");
    $stmt->execute([$borrower_id]);
    $count = $stmt->fetchColumn();
    
    return [
        'count' => $count,
        'hasReachedLimit' => $count >= 5
    ];
}

// Function to check for unresolved documents
function checkUnresolvedDocuments($pdo, $borrower_id) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM document_requests 
        WHERE borrower_id = ? 
        AND status IN ('Broken', 'Missing')
    ");
    $stmt->execute([$borrower_id]);
    $count = $stmt->fetchColumn();
    
    return [
        'hasUnresolvedDocs' => $count > 0,
        'count' => $count
    ];
}

try {
    // Get the raw POST data
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);

    if (!$data) {
        throw new Exception('Invalid request data');
    }

    // Check for unresolved documents first
    $unresolvedCheck = checkUnresolvedDocuments($pdo, $data['user']['id']);
    if ($unresolvedCheck['hasUnresolvedDocs']) {
        echo json_encode([
            'success' => false,
            'message' => 'You have ' . $unresolvedCheck['count'] . ' unresolved document(s). Please contact the library staff.'
        ]);
        exit;
    }

    // Function to get the next reference number
    function getNextReferenceNumber($pdo) {
        // Get the last reference number from the database
        $stmt = $pdo->query("SELECT reference_no FROM document_requests WHERE reference_no LIKE 'T%' ORDER BY reference_no DESC LIMIT 1");
        $lastRef = $stmt->fetchColumn();
        
        if ($lastRef) {
            // Extract the number part and increment
            $number = intval(substr($lastRef, 1)) + 1;
        } else {
            // Start with 1 if no existing reference numbers
            $number = 1;
        }
        
        // Format with leading zeros (T001, T002, etc.)
        return 'T' . str_pad($number, 3, '0', STR_PAD_LEFT);
    }

    // Check request limit
    $borrowerId = $data['user']['id'];
    $limitCheck = checkUserRequestLimit($pdo, $borrowerId);

    if ($limitCheck['hasReachedLimit']) {
        echo json_encode([
            'success' => false,
            'message' => 'Request limit reached. Try again tomorrow.'
        ]);
        exit;
    }

    // Generate the next reference number
    $refNo = getNextReferenceNumber($pdo);

    // Prepare the SQL statement
    $stmt = $pdo->prepare("
        INSERT INTO document_requests 
        (reference_no, document_id, title, borrower_name, borrower_email, borrower_id, borrower_type, status, date_released) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 'reserved', NOW())
    ");

    // Execute the statement with the data
    $stmt->execute([
        $refNo,
        $data['documentId'],
        $data['title'],
        $data['user']['name'],
        $data['user']['email'],
        $data['user']['id'],
        $data['user']['type']
    ]);

    // Send success response
    echo json_encode([
        'success' => true,
        'message' => 'Document request submitted successfully',
        'referenceNo' => $refNo
    ]);

} catch (Exception $e) {
    // Log the error for debugging
    error_log("Error in process_document_request.php: " . $e->getMessage());
    
    // Send error response
    echo json_encode([
        'success' => false,
        'message' => 'Error submitting document request: ' . $e->getMessage()
    ]);
}
?>