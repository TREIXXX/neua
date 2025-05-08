<?php
require_once 'check_session.php';
require_once 'db_connect.php';

if (isset($_GET['view'])) {
    try {
        $id = $_GET['view'];
        
        // Check if it's a number (ID) or a filename
        if (is_numeric($id)) {
            $stmt = $pdo->prepare("SELECT filename, file_content FROM pdf_files WHERE id = ?");
            $stmt->execute([$id]);
        } else {
            $stmt = $pdo->prepare("SELECT filename, file_content FROM pdf_files WHERE filename = ?");
            $stmt->execute([$id]);
        }
        
        $file = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($file && $file['file_content']) {
            // Clear any existing output
            ob_clean();
            
            // Set headers for PDF display
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="' . $file['filename'] . '"');
            header('Cache-Control: private, max-age=0, must-revalidate');
            header('Pragma: public');
            
            // Output PDF content
            echo $file['file_content'];
            exit;
        } else {
            header('HTTP/1.1 404 Not Found');
            echo "PDF not found";
            exit;
        }
    } catch (Exception $e) {
        error_log("PDF Error: " . $e->getMessage());
        header('HTTP/1.1 500 Internal Server Error');
        echo "Error loading PDF: " . $e->getMessage();
        exit;
    }
}

// Add this endpoint to handle user details requests
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getUserDetails') {
    if (isset($_GET['email'])) {
        try {
            require_once 'db_connect.php';// Make sure this points to your database connection file
            
            $email = $_GET['email'];
            $stmt = $pdo->prepare("SELECT name, user_id, user_type FROM users WHERE email = ? AND status = 'approved'");
            $stmt->execute([$email]);
            
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($user) {
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => true,
                    'name' => $user['name'],
                    'user_id' => $user['user_id'],
                    'user_type' => $user['user_type']
                ]);
            } else {
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'message' => 'User not found'
                ]);
            }
        } catch (PDOException $e) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Database error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Add this function at the top of the file
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

// Add this at the beginning of your file
function cleanupExpiredReservations($pdo) {
    try {
        $stmt = $pdo->prepare("
            DELETE FROM document_requests 
            WHERE status = 'Reserved' 
            AND TIMESTAMPDIFF(HOUR, date_released, NOW()) >= 24
        ");
        $stmt->execute();
    } catch (Exception $e) {
        error_log("Error cleaning up expired reservations: " . $e->getMessage());
    }
}

// Function to check for unresolved documents
function checkUnresolvedDocuments($pdo, $borrower_id) {
    $stmt = $pdo->prepare("
        SELECT COUNT(*) 
        FROM document_requests 
        WHERE borrower_id = ? 
        AND status IN ('Damaged', 'Missing')
    ");
    $stmt->execute([$borrower_id]);
    $count = $stmt->fetchColumn();
    
    return [
        'hasUnresolvedDocs' => $count > 0,
        'count' => $count
    ];
}

// Modify the checkDocStatus endpoint
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'checkDocStatus') {
    // Clean up expired reservations first
    cleanupExpiredReservations($pdo);
    
    $docId = $_GET['docId'];
    $userId = $_GET['userId'] ?? null;
    
    // Check for unresolved documents first
    $unresolvedCheck = null;
    if ($userId) {
        $unresolvedCheck = checkUnresolvedDocuments($pdo, $userId);
        if ($unresolvedCheck['hasUnresolvedDocs']) {
            echo json_encode([
                'unavailable' => true,
                'status' => 'restricted',
                'messageType' => 'unavailable',
                'message' => 'Currently Unavailable',
                'requestCount' => 0
            ]);
            exit;
        }
    }
    
    $reservedStatuses = ['reserved', 'Released', 'Overdue'];
    $unavailableStatuses = ['Broken', 'Missing'];
    
    $stmt = $pdo->prepare("SELECT status FROM document_requests WHERE document_id = ? ORDER BY date_released DESC LIMIT 1");
    $stmt->execute([$docId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $status = $row ? $row['status'] : null;
    
    $isReserved = $status && in_array($status, $reservedStatuses);
    $isUnavailable = $status && in_array($status, $unavailableStatuses);
    
    // Check user's request limit if user ID is provided
    $limitReached = false;
    $requestCount = 0;
    if ($userId) {
        $limitCheck = checkUserRequestLimit($pdo, $userId);
        $limitReached = $limitCheck['hasReachedLimit'];
        $requestCount = $limitCheck['count'];
    }
    
    echo json_encode([
        'unavailable' => $isReserved || $isUnavailable || $limitReached,
        'status' => $status,
        'messageType' => $limitReached ? 'limit' : ($isUnavailable ? 'unavailable' : ($isReserved ? 'reserved' : null)),
        'requestCount' => $requestCount
    ]);
    exit;
}

header('Content-Type: application/json');
function formatAuthors($authorString) {
    // Debug: Log the incoming author string
    error_log("Original author string: " . $authorString);
    
    // Split authors by semicolon if multiple authors
    $authors = array_filter(array_map('trim', explode(';', $authorString)));
    
    if (empty($authors)) {
        return 'N/A';
    }
    
    // Clean up extra spaces around punctuation for each author
    foreach ($authors as &$author) {
        // Fix spaces around commas and periods
        $author = preg_replace('/\s*([,.])\s*/', '$1 ', $author);
        // Remove trailing spaces
        $author = rtrim($author);
    }
    
    // Format based on number of authors
    $count = count($authors);
    
    if ($count <= 3) {
        // For 1-3 authors, join with commas and 'and' before the last author
        if ($count == 1) {
            return $authors[0];
        } elseif ($count == 2) {
            return $authors[0] . '; ' . $authors[1];
        } else { // 3 authors
            return $authors[0] . '; ' . $authors[1] . '; ' . $authors[2];
        }
    } else {
        // For 4+ authors, show only first author plus et al
        return $authors[0] . ' et al.';
    }
}
function getPdfContent($pdfId) {
    global $pdo;
    
    try {
        // First try to find by filename, then by id
        $stmt = $pdo->prepare("SELECT * FROM pdf_files WHERE filename = :filename OR id = :id");
        $stmt->execute([
            ':filename' => $pdfId,
            ':id' => $pdfId
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            return [
                'error' => 'Document not found in database'
            ];
        }

// Format the date as Month 20XX
$month = !empty($result['month']) ? (int)$result['month'] : 1;
$year = !empty($result['year']) ? $result['year'] : 'N/A';

$months = [
    1 => 'January', 2 => 'February', 3 => 'March', 4 => 'April',
    5 => 'May', 6 => 'June', 7 => 'July', 8 => 'August',
    9 => 'September', 10 => 'October', 11 => 'November', 12 => 'December'
];

$monthName = $months[$month] ?? 'Unknown';
$creationDate = $monthName . ' ' . $year;

        // Format authors
        $formattedAuthor = formatAuthors($result['author']);

        // Get the text content
        $textContent = $result['text_content'] ?: '';
        
        // Split content into sections based on common document markers
        $sections = preg_split('/\n(?=(?:CHAPTER|Chapter|ABSTRACT|Abstract|INTRODUCTION|Introduction|METHODOLOGY|Methodology|RESULTS|Results|CONCLUSION|Conclusion|REFERENCES|References|APPENDIX|Appendix))/i', $textContent);
        
        // Format sections into pages with proper styling
        $formattedPages = [];
        $currentPage = '';
        $pageCount = 0;
        
        foreach ($sections as $section) {
            // Detect headings
            if (preg_match('/^(CHAPTER|Abstract|INTRODUCTION|METHODOLOGY|RESULTS|CONCLUSION|REFERENCES|APPENDIX)/i', trim($section), $matches)) {
                // Start new page for major sections
                if (!empty($currentPage)) {
                    $formattedPages[] = $currentPage;
                }
                $currentPage = "<div class='section-header'>" . htmlspecialchars(trim($matches[0])) . "</div>";
                $pageCount++;
            }
            
            // Format paragraphs
            $paragraphs = explode("\n\n", $section);
            foreach ($paragraphs as $paragraph) {
                if (trim($paragraph)) {
                    $currentPage .= "<p class='paragraph'>" . htmlspecialchars(trim($paragraph)) . "</p>";
                }
            }
            
            // Start new page after approximately 3000 characters
            if (strlen($currentPage) > 3000) {
                $formattedPages[] = $currentPage;
                $currentPage = '';
                $pageCount++;
            }
        }
        
        // Add any remaining content
        if (!empty($currentPage)) {
            $formattedPages[] = $currentPage;
            $pageCount++;
        }
        
        // Determine where to stop showing content
        $stopPage = ceil($pageCount / 5); // Default to 1/5 of content
        for ($i = 0; $i < min(20, count($formattedPages)); $i++) {
            if (stripos($formattedPages[$i], 'list of tables') !== false) {
                $stopPage = $i + 1;
                    break;
            } else if (stripos($formattedPages[$i], 'chapter 5') !== false || 
                      stripos($formattedPages[$i], 'chapter v') !== false) {
                $stopPage = $i + 1;
            }
        }

        // Get preview pages
        $previewPages = array_slice($formattedPages, 0, $stopPage);
        
        return [
            'id' => $result['id'],
            'title' => $result['title'] ?: pathinfo($result['filename'], PATHINFO_FILENAME),
            'author' => $formattedAuthor,
            'creationDate' => $creationDate,
            'abstract' => extractAbstract($textContent),
            'pages' => $previewPages,
            'totalPages' => $pageCount,
            'previewPages' => $stopPage,
            'styles' => [
                '.section-header' => [
                    'font-size' => '18px',
                    'font-weight' => 'bold',
                    'margin' => '20px 0',
                    'text-align' => 'center',
                    'text-transform' => 'uppercase'
                ],
                '.paragraph' => [
                    'text-align' => 'justify',
                    'line-height' => '1.6',
                    'margin' => '12px 0',
                    'text-indent' => '40px'
                ]
            ]
        ];
    } catch (PDOException $e) {
        error_log("Database Error: " . $e->getMessage());
        return [
            'error' => 'Database error occurred: ' . $e->getMessage()
        ];
    }
}

function extractAbstract($text) {
    // Try to match either Abstract or Executive Summary, stopping at Table of Contents/Content, Acknowledgment, or Dedication
    if (preg_match('/(?:EXECUTIVE\s+SUMMARY|Executive\s+Summary|ABSTRACT|Abstract)\s*\n\s*(.*?)(?=\s*(?:Table\s+of\s+Contents?|TABLE\s+OF\s+CONTENTS?|Acknowledgment|ACKNOWLEDGMENT|Dedication|DEDICATION))/si', $text, $matches)) {
        $abstract = trim($matches[1]);
        
        // Clean up the text
        $abstract = preg_replace('/\s+/', ' ', $abstract); 
        $abstract = preg_replace('/\s+([.,!?:;])/', '$1', $abstract); // Remove spaces before punctuation
        
        // Split into sentences and trim each one
        $sentences = preg_split('/(?<=[.!?])\s+(?=[A-Z])/', $abstract, -1, PREG_SPLIT_NO_EMPTY);
        $sentences = array_map(function($sentence) {
            $sentence = trim($sentence);
            // Clean up any remaining spaces before punctuation that might occur after splitting
            return preg_replace('/\s+([.,!?:;])/', '$1', $sentence);
        }, $sentences);
        
        // Return the full abstract
        return implode(' ', $sentences);
    }
    
    // If no abstract or executive summary is found
    return '(Please see the file below)';
}

$pdfId = isset($_GET['pdf']) ? $_GET['pdf'] : '';
$response = getPdfContent($pdfId);

// Debug logging
error_log("PDF ID requested: " . $pdfId);
error_log("Response: " . json_encode($response));

echo json_encode($response);