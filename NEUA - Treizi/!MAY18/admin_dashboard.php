<?php
require_once 'check_session.php';
// Increase all PHP limits for large file uploads
ini_set('memory_limit', '1024M');  // Set memory limit to 1GB
ini_set('upload_max_filesize', '100M');  // Allow uploads up to 100MB
ini_set('post_max_size', '100M');  // Allow POST data up to 100MB
ini_set('max_execution_time', 600);  // 10 minutes execution time
ini_set('max_input_time', 600);  // 10 minutes for input processing

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_error.log');

// Clear output buffer
if (ob_get_level()) ob_end_clean();

// Required includes
require_once __DIR__ . '/vendor/autoload.php';
require_once 'db_connect.php';

// Use statements
use setasign\Fpdi\Fpdi;
use Smalot\PdfParser\Parser;

$response = array('success' => false, 'message' => '');

// Add this function to process the text and clean up titles
function cleanTitle($text) {
    // First, try to extract the title using the specific pattern
    if (preg_match('/Department of (?:Information Technology|Computer Studies|Information Studies)\s*\n\s*\n(.*?)(?=\s*\n\s*An Undergraduate)/s', $text, $matches)) {
        $title = $matches[1];
        
        // Clean up the title:
        // 1. Replace all newlines and their surrounding whitespace with a single space
        $title = preg_replace('/\s*\n\s*/', ' ', $title);
        
        // 2. Replace multiple spaces with a single space
        $title = preg_replace('/\s+/', ' ', $title);
        
     
        
        // 4. Clean up spaces around parentheses
        $title = preg_replace('/\s*\(\s*/', ' (', $title);
        $title = preg_replace('/\s*\)\s*/', ') ', $title);
        
        // 5. Final trim to remove any leading/trailing whitespace
        return trim($title);
    }
    return 'No Title';
}

// Function to generate custom document ID
function generateCustomDocumentId($course, $year, $pdo) {
    // Define course prefix mappings
    $prefixMap = [
        // College of Arts and Sciences
        'BA Econ' => 'BAEcon',
        'BA PolSci' => 'BAPolsci',
        'BS Psych' => 'BSPsych',
        'BPA' => 'BPA',

        
        // College of Engineering and Architecture
        'BSCE' => 'BSCE',
        'BSEE' => 'BSEE',
        'BSME' => 'BSME',
        'BS Arch' => 'BSArch',
        
        // College of Informatics and Computing Studies
        'BSIT' => 'BSIT',
        'BSCS' => 'BSCS',
        'BSIS' => 'BSIS',
        'BLIS' => 'BLIS'
    ];
    
    // Get the course prefix
    $prefix = $prefixMap[$course] ?? 'XX'; // Default to XX if course not found
    
    // Get year suffix (last 2 digits)
    $yearSuffix = substr($year, -2);
    
    // Get ALL document IDs and find the highest serial number
    $stmt = $pdo->query("SELECT id FROM pdf_files");
    $allIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $highestSerial = 0;
    foreach ($allIds as $id) {
        // Extract the numeric part between the hyphens (e.g., "0001" from "BAPolsci-0001-25")
        if (preg_match('/\-(\d{4})\-/', $id, $matches)) {
            $currentSerial = intval($matches[1]);
            if ($currentSerial > $highestSerial) {
                $highestSerial = $currentSerial;
            }
        }
    }
    
    // Next serial number
    $nextSerial = $highestSerial + 1;
    
    // Force 4 digits for the serial number using sprintf
    $serialNumber = sprintf("%04d", $nextSerial);
    
    // Combine to create the final ID: BAPolsci-0001-25
    $documentId = sprintf("%s-%s-%s", $prefix, $serialNumber, $yearSuffix);
    
    // Debug log to verify the format
    error_log("Generated Document ID: " . $documentId);
    
    // Validate the format
    if (!preg_match('/^[A-Za-z]+\-\d{4}\-\d{2}$/', $documentId)) {
        error_log("Warning: Generated ID does not match expected format: " . $documentId);
    }
    
    return $documentId;
}


// Add this function at the top of the file
function createCutPDF($sourcePath, $cutPage) {
    try {
        if (!class_exists('setasign\Fpdi\Fpdi')) {
            throw new Exception('FPDI class not found. Please check your installation.');
        }
        
        // Create new FPDI instance with full namespace
        $pdf = new \setasign\Fpdi\Fpdi();
        
        // Get the number of pages in source file
        $pageCount = $pdf->setSourceFile($sourcePath);
        
        // Ensure cut page is not beyond total pages
        $cutPage = min($cutPage, $pageCount);
        
        error_log("Creating cut PDF with $cutPage pages from total $pageCount pages");
        
        // Add pages up to cut point
        for ($pageNo = 1; $pageNo <= $cutPage; $pageNo++) {
            error_log("Processing page $pageNo");
            // Import page
            $templateId = $pdf->importPage($pageNo);
            
            // Get the size of imported page
            $size = $pdf->getTemplateSize($templateId);
            
            // Add page with same orientation and size
            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            
            // Use the imported page
            $pdf->useTemplate($templateId);
        }
        
        error_log("PDF cutting completed successfully");
        // Return PDF as string
        return $pdf->Output('S');
    } catch (Exception $e) {
        error_log("Error in createCutPDF: " . $e->getMessage());
        throw $e;
    }
}

// Modify the file upload section
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['pdfFiles'])) {
    // Clear any existing output and set JSON header
    while (ob_get_level()) {
        ob_end_clean();
    }
    header('Content-Type: application/json');
    
    try {
        if (!isset($_FILES['pdfFiles']) || empty($_FILES['pdfFiles']['name'][0])) {
            throw new Exception('No files were uploaded');
        }

        $files = $_FILES['pdfFiles'];
        $uploadedFiles = 0;
        $errors = [];

        // Start transaction
        $pdo->beginTransaction();

        for ($i = 0; $i < count($files['name']); $i++) {
            try {
                error_log("Processing file: " . $files['name'][$i]);
                
            if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                    throw new Exception('Upload error occurred: ' . $files['error'][$i]);
                }

            $tempFile = $files['tmp_name'][$i];

                // Verify it's a PDF
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mimeType = finfo_file($finfo, $tempFile);
                finfo_close($finfo);
                
                if ($mimeType !== 'application/pdf') {
                    throw new Exception('File must be a PDF');
                }

                // Parse PDF to find cut point
                $parser = new Parser();
                $pdf = $parser->parseFile($tempFile);
                $pages = $pdf->getPages();
                $totalPages = count($pages);
                
                // Initialize variables
                $cutPage = 0;
                $foundTOC = false;
                $tocPage = 0;
                $foundChapter1 = false;

                // First pass: identify the Table of Contents
                for ($page = 1; $page <= $totalPages; $page++) {
                    $pageText = $pages[$page-1]->getText();
                    
                    // Look for Table of Contents/Content (including versions without spaces)
                    if (!$foundTOC && preg_match('/(Table\s+of\s+(?:Content|Contents)|TABLE\s+OF\s+(?:CONTENT|CONTENTS)|Contents|CONTENTS|TableofContents|TableofContent)/i', $pageText)) {
                        $foundTOC = true;
                        $tocPage = $page;
                        error_log("Found TOC at page $page");
                    }
                }

                // Second pass: find Chapter 1 after TOC
                if ($foundTOC) {
                    $skipUntilPage = $tocPage + 1; // Skip checking until after TOC
                } else {
                    $skipUntilPage = 1; // No TOC found, start from beginning
                }

                // Look for Chapter 1 only after the TOC
                for ($page = $skipUntilPage; $page <= $totalPages; $page++) {
                    $pageText = $pages[$page-1]->getText();
                    
                    // Check if page appears to be a chapter start page
                    $isChapterStartPage = preg_match('/^\s*(CHAPTER|Chapter)\s+[1I]/m', $pageText) || 
                                         preg_match('/^(?:\s*)(CHAPTER|Chapter)\s+[1I]/i', $pageText);
                    
                    // Enhanced pattern to capture all capitalization formats
                    if (preg_match('/(CHAPTER\s+[1I]|Chapter\s+[1I]|CHAPTER\s*1|Chapter\s*1|CHAPTER1|Chapter1)[\s.:]*(?:(?:THE\s+PROBLEM\s+AND\s+ITS\s+BACKGROUND)|(?:The\s+Problem\s+and\s+Its\s+Background)|(?:THE\s+PROBLEM)|(?:The\s+Problem))/i', $pageText)) {
                        $foundChapter1 = true;
                        $cutPage = $page - 1; // Cut BEFORE Chapter 1
                        error_log("Found Chapter 1 The Problem and Its Background at page $page, cutting at page $cutPage");
                        break;
                    }
                    
                    // Additional pattern to specifically look for all-caps version
                    if (!$foundChapter1 && (strpos($pageText, 'CHAPTER 1') !== false || strpos($pageText, 'CHAPTER1') !== false) && 
                        (strpos($pageText, 'THE PROBLEM') !== false || strpos($pageText, 'THEPROBLEM') !== false)) {
                        $foundChapter1 = true;
                        $cutPage = $page - 1; // Cut BEFORE Chapter 1
                        error_log("Found all-caps CHAPTER 1 and THE PROBLEM at page $page, cutting at page $cutPage");
                        break;
                    }
                    
                    // Check for mixed case versions separately if not found in combined patterns
                    if (!$foundChapter1 && 
                        (preg_match('/(CHAPTER|Chapter)\s*(1|I|ONE)/i', $pageText) && 
                         preg_match('/(THE\s+PROBLEM|The\s+Problem|THEPROBLEM|TheProblem)/i', $pageText))) {
                        $foundChapter1 = true;
                        $cutPage = $page - 1; // Cut BEFORE Chapter 1
                        error_log("Found separate Chapter 1 and The Problem sections at page $page, cutting at page $cutPage");
                        break;
                    }
                }

                // If we didn't find Chapter 1, use first 5 pages as fallback
                if ($cutPage === 0) {
                    $cutPage = min(5, $totalPages);
                    error_log("No Chapter 1 found, using fallback to page $cutPage");
                }

                // Ensure cut page is valid
                $cutPage = max(1, min($cutPage, $totalPages));
                
                // Create cut version of PDF
                error_log("Final cut page determined: $cutPage");
                error_log("Total pages in document: $totalPages");
                $cutPdfContent = createCutPDFWithMessage($tempFile, $cutPage, $totalPages);

                // Update the content message to be accurate
                $fullContentMessage = "This document contains restricted content. ";
                $fullContentMessage .= "Only preliminary pages before Chapter 1 are available for preview. ";
                $fullContentMessage .= "The full document contains " . $totalPages . " pages. ";
                $fullContentMessage .= "Please request access to view the complete document.";

                // Get full text content before cutting the PDF
                $parser = new Parser();
                $pdf = $parser->parseFile($tempFile);
                $pages = $pdf->getPages();
                $fullText = '';

                // Extract text from ALL pages
                for ($page = 1; $page <= count($pages); $page++) {
                    $fullText .= $pages[$page-1]->getText() . "\n";
                }

                // Add this right after you extract the text from the PDF
                error_log("Extracted text from PDF: " . substr($fullText, 0, 500)); // Log first 500 characters

                // Process the full text for metadata
                $processedFullText = addSpacesToText($fullText);
                $title = extractTitle($processedFullText);
                $authors = extractAuthors($processedFullText);
                $year = extractYear($processedFullText);
                $month = extractMonth($processedFullText);
                $course = extractCourse($processedFullText);
                $customId = generateCustomDocumentId($course, $year, $pdo);

                // Insert into database with FULL text content but CUT PDF content
                $stmt = $pdo->prepare("
                    INSERT INTO pdf_files (
                        id, filename, title, size, last_modified, 
                        author, year, month, course, text_content, 
                        file_content
                    ) VALUES (
                        ?, ?, ?, ?, NOW(), 
                        ?, ?, ?, ?, ?, 
                        ?
                    )
                ");

                $success = $stmt->execute([
                    $customId,
                    $files['name'][$i],
                    $title,
                    strlen($cutPdfContent),
                    $authors,
                    $year,
                    $month,
                    $course,
                    $processedFullText,  // Store the FULL text content
                    $cutPdfContent      // Store only the cut PDF content
                ]);

                if (!$success) {
                    throw new Exception('Database error: ' . implode(', ', $stmt->errorInfo()));
                }

                // Save the FULL PDF and FULL text to docu_shelf
                $fullPdfContent = file_get_contents($tempFile); // Get the original, uncut PDF

                $stmtShelf = $pdo->prepare("
                    INSERT INTO docu_shelf (
                        id, filename, title, size, last_modified, 
                        author, year, month, course, text_content, 
                        file_content
                    ) VALUES (
                        ?, ?, ?, ?, NOW(), 
                        ?, ?, ?, ?, ?, 
                        ?
                    )
                ");

                $stmtShelf->execute([
                    $customId,
                    $files['name'][$i],
                    $title,
                    strlen($fullPdfContent),
                    $authors,
                    $year,
                    $month,
                    $course,
                    $processedFullText,  // Store the FULL text content
                    $fullPdfContent      // Store the FULL PDF content
                ]);

                $uploadedFiles++;
                error_log("Successfully processed file {$files['name'][$i]}");

            } catch (Exception $e) {
                error_log('Error processing file: ' . $e->getMessage());
                $errors[] = "Error processing {$files['name'][$i]}: " . $e->getMessage();
                continue;
            }
        }

        if ($uploadedFiles > 0) {
            $pdo->commit();
            $response = [
                'success' => true,
                'message' => $uploadedFiles . " file(s) uploaded successfully!",
                'errors' => $errors
            ];
        } else {
            throw new Exception('No files were uploaded successfully. ' . implode('; ', $errors));
        }

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $response = [
            'success' => false,
            'message' => $e->getMessage(),
            'errors' => $errors ?? []
        ];
        error_log('Upload error: ' . $e->getMessage());
    }

    // Ensure clean output
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    echo json_encode($response);
    exit;
}

// Download endpoint: fetch the full PDF from docu_shelf
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'downloadPdf') {
    try {
        $fileId = $_GET['fileId'];
        $stmt = $pdo->prepare("SELECT filename, file_content FROM docu_shelf WHERE id = ?");
        $stmt->execute([$fileId]);
        $fileData = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($fileData && $fileData['file_content']) {
            // Set headers for PDF download
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $fileData['filename'] . '"');
            header('Content-Length: ' . strlen($fileData['file_content']));
            header('Cache-Control: private, max-age=0, must-revalidate');
            header('Pragma: public');

            // Output the PDF content
            echo $fileData['file_content'];
            exit;
        } else {
            throw new Exception('PDF file not found');
        }
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error downloading file: ' . $e->getMessage();
        echo json_encode($response);
        exit;
    }
}

// Update the getFiles function to include download links
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getFiles') {
    try {
        // Get the "see_all" parameter from the request (default to false)
        $seeAll = isset($_GET['see_all']) && $_GET['see_all'] === 'true';
        
        // Define the SQL query with a placeholder for potential WHERE clause
        $sql = "SELECT ID, filename, title, size, last_modified, author, year, course FROM pdf_files";
        $params = [];
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        $departmentFiltering = false;
        $userDept = null;
        
        // Only apply department filtering for dean, coordinator, or admin
        // AND only if the "see_all" parameter is false
        if (!$seeAll && in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            // Get user's department
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
            
            if (!empty($userDept)) {
                // Department to courses mapping
                $departmentCourses = [
                    'CICS' => ["BSCS", "BSIT", "BSIS", "BLIS", "BSEMC"],
                    'CAS' => ["BA Econ", "BA PolSci", "BS Psych", "BPA", "Psych", "Pub Adm."],
                    'CEA' => ["BSCE", "BSEE", "BSME", "BS Arch"]
                ];
                
                if (isset($departmentCourses[$userDept])) {
                    // Filter by course in the department
                    $courses = $departmentCourses[$userDept];
                    $placeholders = array_map(function($i) { return "?"; }, array_keys($courses));
                    $sql .= " WHERE course IN (" . implode(", ", $placeholders) . ")";
                    $params = $courses;
                    $departmentFiltering = true;
                }
            }
        }
        
        // Add ordering
        $sql .= " ORDER BY last_modified DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $files = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($files as &$file) {
            $file['doc_id'] = $file['ID'];
            
            if (empty($file['title']) || $file['title'] === 'No Title') {
                $file['title'] = pathinfo($file['filename'], PATHINFO_FILENAME);
            }
            
            $file['size'] = number_format($file['size'] / 1024, 2) . ' KB';
            $file['last_modified'] = date('Y-m-d H:i:s', strtotime($file['last_modified']));
            $file['download_url'] = '?action=downloadPdf&fileId=' . $file['ID'];
        }
        
        $response['success'] = true;
        $response['files'] = $files;
        $response['user_type'] = $userType;
        $response['department'] = $userDept ?? '';
        $response['department_filtered'] = $departmentFiltering;
        $response['see_all'] = $seeAll;
        
        // Debug log
        error_log("User type: $userType, Department: " . ($userDept ?? 'None') . ", Filtered: " . ($departmentFiltering ? 'Yes' : 'No') . ", See All: " . ($seeAll ? 'Yes' : 'No'));
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error fetching files: ' . $e->getMessage();
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Function to extract title from text
function extractTitle($text) {
    // Add debug logging
    error_log("Starting title extraction...");
    
    // First, try to find the title after any of the department headers
    $departmentPatterns = [
        // College of Informatics and Computing Studies departments
        '/Department of Computer Science\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Information Systems\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Library and Information Systems\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        
        // College of Arts and Sciences departments
        '/Department of Political Science\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Economics\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Biology\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Psychology\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Public Administration\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        
        // College of Engineering and Architecture departments
        '/Department of Civil Engineering\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Electrical Engineering\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Mechanical Engineering\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        '/Department of Architecture\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s',
        
        // Generic department pattern (keep as fallback)
        '/Department of (?:Information Technology|Computer Studies|Information Studies)\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate))/s'
    ];

    // Try each department pattern
    foreach ($departmentPatterns as $pattern) {
        if (preg_match($pattern, $text, $matches)) {
            error_log("Found title using department pattern: " . $matches[1]);
            return cleanTitleText($matches[1]);
        }
    }

    // If no department pattern matches, try finding title after common headers
    $headers = [
        'Title:',
        'TITLE:',
        'Thesis Title:',
        'THESIS TITLE:',
        'Research Title:',
        'RESEARCH TITLE:',
        'Document Title:',
        'DOCUMENT TITLE:'
    ];

    foreach ($headers as $header) {
        $pattern = '/' . preg_quote($header) . '\s*\n\s*(.*?)(?=\s*\n\s*(?:An Undergraduate|A Graduate|Chapter|Abstract|Introduction|Table of Contents))/s';
        if (preg_match($pattern, $text, $matches)) {
            error_log("Found title using header pattern: " . $matches[1]);
            return cleanTitleText($matches[1]);
        }
    }

    // Look for any text that appears to be a title in the first few pages
    $pages = explode("\n\n", $text);
    $firstPages = array_slice($pages, 0, 3); // Look in first 3 pages

    foreach ($firstPages as $page) {
        // Look for text that appears to be a title (usually in all caps or with special formatting)
        if (preg_match('/[A-Z][A-Z\s]+(?:[A-Z][a-z]+)*/', $page, $matches)) {
            $potentialTitle = $matches[0];
            // Check if this potential title is followed by "An Undergraduate" or "A Graduate"
            if (preg_match('/' . preg_quote($potentialTitle) . '\s*\n\s*(?:An Undergraduate|A Graduate)/s', $page)) {
                error_log("Found title using bold text pattern: " . $potentialTitle);
                return cleanTitleText($potentialTitle);
            }
        }
    }

    // If we still haven't found a title, try a more aggressive approach
    // Look for any text that appears to be a title in the first 1000 characters
    $firstPart = substr($text, 0, 1000);
    if (preg_match('/[A-Z][A-Za-z\s\-\:]+(?=\s*\n\s*(?:An Undergraduate|A Graduate|Chapter|Abstract|Introduction|Table of Contents))/s', $firstPart, $matches)) {
        error_log("Found title using aggressive pattern: " . $matches[0]);
        return cleanTitleText($matches[0]);
    }

    error_log("No title found in the document");
    return 'No Title';
}

// Helper function to clean up the extracted title text
function cleanTitleText($title) {
    // 1. Replace all newlines and their surrounding whitespace with a single space
    $title = preg_replace('/\s*\n\s*/', ' ', $title);
    
    // 2. Fix spacing around colons
    $title = preg_replace('/\s*:\s*/', ': ', $title);
    
    // 3. Fix spacing around hyphens
    $title = preg_replace('/\s*-\s*/', '-', $title);
    
    // 4. Fix spacing around parentheses
    $title = preg_replace('/\s*\(\s*/', ' (', $title);
    $title = preg_replace('/\s*\)\s*/', ') ', $title);
    
    // 5. Fix spacing between words (ensure single space between words)
    $title = preg_replace('/\s+/', ' ', $title);
    
    // 6. Fix spacing after periods in abbreviations (e.g., "A.I." should not have space after the first period)
    $title = preg_replace('/([A-Z])\.\s+([A-Z])\./', '$1.$2.', $title);
    
    // 7. Fix spacing around apostrophes
    $title = preg_replace('/\s*\'\s*/', '\'', $title);
    
    // 8. Remove any remaining header text that might have been captured
    $title = preg_replace('/^(?:Title|TITLE|Thesis Title|THESIS TITLE|Research Title|RESEARCH TITLE|Document Title|DOCUMENT TITLE)[:\s]+/i', '', $title);
    
    // 9. Fix spacing for common patterns
    $title = preg_replace('/\s+([A-Za-z])\s+([A-Za-z])/', ' $1$2', $title); // Fix joined words
    
    // 10. Add space between words that are incorrectly joined
    $title = preg_replace('/([a-zA-Z])([A-Z][a-z])/', '$1 $2', $title); // Add space before capital letter followed by lowercase
    $title = preg_replace('/([a-z])([A-Z])/', '$1 $2', $title); // Add space between lowercase and capital
    

    
    foreach ($functionWords as $word) {
        // Add space before function word if it's not at the start of the title and not already preceded by a space
        // Only match if the function word is a complete word (not part of another word)
        $title = preg_replace('/([a-zA-Z])' . $word . '(?![a-zA-Z])/i', '$1 ' . $word, $title);
        
        // Add space after function word if it's not at the end of the title and not already followed by a space
        // Only match if the function word is a complete word (not part of another word)
        $title = preg_replace('/(?<![a-zA-Z])' . $word . '([a-zA-Z])/i', $word . ' $1', $title);
    }
    
    // 12. Fix any double spaces that might have been created
    $title = preg_replace('/\s+/', ' ', $title);
    
    // 13. Final trim to remove any leading/trailing whitespace
    return trim($title);
}

// Function to extract authors from text
function extractAuthors($text) {
    // Get the first page content
    $pages = explode("\n\n", $text);
    $firstPage = $pages[0];

    // Define course patterns
    $coursePatterns = [
        'Bachelor of Arts in Economics',
        'Bachelor of Arts in Political Science',
        'Bachelor of Science in Psychology',
        'Bachelor of Public Administration',
        'Bachelor of Science in Civil Engineering',
        'Bachelor of Science in Electrical Engineering',
        'Bachelor of Science in Mechanical Engineering',
        'Bachelor of Science in Architecture',
        'Bachelor of Science in Information Technology',
        'Bachelor of Science in Computer Science',
        'Bachelor of Science in Information Systems',
        'Bachelor of Library and Information Systems'
    ];

    // First try the regex-based approach with multiple date patterns
    foreach ($coursePatterns as $course) {
        // Try different date patterns
        $datePatterns = [
            // Month-Year pattern (original working pattern)
            '/(?:' . preg_quote($course) . '.*?\n)(.*?)(?:\s*\n\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/s',
            
            // Year pattern
            '/(?:' . preg_quote($course) . '.*?\n)(.*?)(?:\s*\n\s*\b(19|20)\d{2}\b)/s',
            
            // Year-Year pattern
            '/(?:' . preg_quote($course) . '.*?\n)(.*?)(?:\s*\n\s*\b(19|20)\d{2}-(19|20)\d{2}\b)/s',
            
            // Year-Month pattern
            '/(?:' . preg_quote($course) . '.*?\n)(.*?)(?:\s*\n\s*(19|20)\d{2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December))/s',
            
            // Month pattern
            '/(?:' . preg_quote($course) . '.*?\n)(.*?)(?:\s*\n\s*(?:January|February|March|April|May|June|July|August|September|October|November|December))/s'
        ];

        foreach ($datePatterns as $pattern) {
            if (preg_match($pattern, $firstPage, $matches)) {
                $authorSection = trim($matches[1]);
                $authorNames = preg_split('/\n/', $authorSection);
                $authorNames = array_map('trim', $authorNames);
                $authorNames = array_filter($authorNames, function($name) {
                    return !empty($name) &&
                        preg_match('/^[A-Za-z\s,\.]+$/', $name) &&
                        !preg_match('/Bachelor|Science|Information|Technology|Computer|Studies|System/i', $name);
                });
                if (!empty($authorNames)) {
                    return implode(' ; ', $authorNames);
                }
            }
        }
    }

    // If regex approach fails, fall back to the original line-by-line approach
    $lines = array_map('trim', explode("\n", $firstPage));
    $courseLineIndex = -1;
    $dateLineIndex = -1;

    // Find the course line index
    foreach ($lines as $i => $line) {
        foreach ($coursePatterns as $course) {
            if (stripos($line, $course) !== false) {
                $courseLineIndex = $i;
                break 2;
            }
        }
    }

    // Find the published date line index (search from the bottom up)
    for ($i = count($lines) - 1; $i > $courseLineIndex; $i--) {
        $line = $lines[$i];
        if (
            // Year (e.g., 2024)
            preg_match('/\b(19|20)\d{2}\b/', $line) ||
            // Year-Year (e.g., 2024-2025)
            preg_match('/\b(19|20)\d{2}-(19|20)\d{2}\b/', $line) ||
            // Month-Year (e.g., January 2024)
            preg_match('/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}/i', $line) ||
            // Year-Month (e.g., 2024 January)
            preg_match('/(19|20)\d{2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i', $line) ||
            // Month (e.g., January)
            preg_match('/(?:January|February|March|April|May|June|July|August|September|October|November|December)/i', $line)
        ) {
            $dateLineIndex = $i;
            break;
        }
    }

    // Extract authors between course and published date
    if ($courseLineIndex !== -1 && $dateLineIndex !== -1 && $dateLineIndex > $courseLineIndex) {
        $authorLines = array_slice($lines, $courseLineIndex + 1, $dateLineIndex - $courseLineIndex - 1);
        // Filter out empty lines and join with semicolon
        $authors = array_filter(array_map('trim', $authorLines), function($line) {
            return !empty($line);
        });
        return !empty($authors) ? implode(' ; ', $authors) : 'N/A';
    }

    return 'N/A';
}

// Function to extract year from text
function extractYear($text) {
    // Get the first page content
    $pages = explode("\n\n", $text);
    $firstPage = $pages[0];
    
    // Look for date patterns at the bottom of first page
    $datePatterns = [
        // Year (e.g., 2024)
        '/\b(19|20)\d{2}\b/',
        
        // Year-Year (e.g., 2024-2025)
        '/\b(19|20)\d{2}-(19|20)\d{2}\b/',
        
        // Month-Year (e.g., January 2024)
        '/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}/i',
        
        // Year-Month (e.g., 2024 January)
        '/(19|20)\d{2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i',
        
        // Month (e.g., January)
        '/(?:January|February|March|April|May|June|July|August|September|October|November|December)/i'
    ];

    foreach ($datePatterns as $pattern) {
        if (preg_match($pattern, $firstPage, $matches)) {
            // For Year-Year format, return the first year
            if (strpos($matches[0], '-') !== false) {
                return substr($matches[0], 0, 4);
            }
            // For Month-Year format, return the year
            if (preg_match('/\d{4}/', $matches[0], $yearMatch)) {
                return $yearMatch[0];
            }
            // For Year-Month format, return the year
            if (preg_match('/^\d{4}/', $matches[0], $yearMatch)) {
                return $yearMatch[0];
            }
            // For simple Year format, return the year
            if (preg_match('/^\d{4}$/', $matches[0])) {
                return $matches[0];
            }
        }
    }

    return date('Y'); // Default to current year if no date found
}

// Function to extract month from text
function extractMonth($text) {
    // Get the first page content
    $pages = explode("\n\n", $text);
    $firstPage = $pages[0];
    
    // First check if there's only a year or year-year format
    $yearOnlyPatterns = [
        // Year (e.g., 2024)
        '/\b(19|20)\d{2}\b/',
        // Year-Year (e.g., 2024-2025)
        '/\b(19|20)\d{2}-(19|20)\d{2}\b/'
    ];

    foreach ($yearOnlyPatterns as $pattern) {
        if (preg_match($pattern, $firstPage, $matches)) {
            // If we find only a year format, return null
            return null;
        }
    }
    
    // If no year-only format found, look for month patterns
    $monthPatterns = [
        // Month-Year (e.g., January 2024)
        '/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(19|20)\d{2}/i',
        
        // Year-Month (e.g., 2024 January)
        '/(19|20)\d{2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)/i',
        
        // Month (e.g., January)
        '/(?:January|February|March|April|May|June|July|August|September|October|November|December)/i'
    ];

    foreach ($monthPatterns as $pattern) {
        if (preg_match($pattern, $firstPage, $matches)) {
            // Extract month name
            if (preg_match('/(?:January|February|March|April|May|June|July|August|September|October|November|December)/i', $matches[0], $monthMatch)) {
                $month = $monthMatch[0];
        // Convert month name to number (01-12)
        return str_pad(date('m', strtotime($month)), 2, '0', STR_PAD_LEFT);
    }
        }
    }

    return null; // Return null if no month found
}

// Function to extract course from text
function extractCourse($text) {
    // Define course mappings
    $courseMappings = [
        // College of Arts and Sciences
        'Bachelor of Arts in Economics' => 'BA Econ',
        'Bachelor of Arts in Political Science' => 'BA PolSci',
        'Bachelor of Science in Psychology' => 'BS Psych',
        'Bachelor of Public Administration' => 'BPA',
        
        // College of Engineering and Architecture
        'Bachelor of Science in Civil Engineering' => 'BSCE',
        'Bachelor of Science in Electrical Engineering' => 'BSEE',
        'Bachelor of Science in Mechanical Engineering' => 'BSME',
        'Bachelor of Science in Architecture' => 'BS Arch',
        
        // College of Informatics and Computing Studies (keep existing mappings)
        'Bachelor of Science in Information Technology' => 'BSIT',
        'Bachelor of Science in Computer Science' => 'BSCS',
        'Bachelor of Science in Information Systems' => 'BSIS',
        'Bachelor of Library and Information Systems' => 'BLIS'
    ];

    // Get the first page content
    $pages = explode("\n\n", $text);
    $firstPage = $pages[0];

    // Look for exact course matches
    foreach ($courseMappings as $fullCourse => $shortCode) {
        if (strpos($firstPage, $fullCourse) !== false) {
            return $shortCode;
        }
    }

    // If no exact match found, try flexible matching
    foreach ($courseMappings as $fullCourse => $shortCode) {
        // Create a pattern that allows for some flexibility in spacing and line breaks
        $pattern = '/Bachelor\s+of\s+(?:Arts|Science)\s+in\s+' . preg_quote(str_replace('Bachelor of ', '', $fullCourse), '/') . '/i';
        if (preg_match($pattern, $firstPage)) {
            return $shortCode;
        }
    }

    return 'N/A';
}

// Helper function to convert course name to code
function getCourseCode($courseName) {
    switch (strtolower($courseName)) {
        case 'information technology':
            return 'BSIT';
        case 'computer science':
            return 'BSCS';
        case 'information systems':
            return 'BSIS';
        default:
            return 'N/A';
    }
}

// Function to process extracted text
function addSpacesToText($text) {
    $text = preg_replace('/([a-z])([A-Z])/', '$1 $2', $text);
    $text = preg_replace('/([a-z])([0-9])/', '$1 $2', $text);
    $text = preg_replace('/([0-9])([a-z])/', '$1 $2', $text);
    $text = preg_replace('/(\S)([.,!?;:])/u', '$1 $2', $text);

    // Clean up degree program names
    $text = preg_replace('/Bachelorof Sciencein Information Technology/i', 'Bachelor of Science in Information Technology', $text);
    $text = preg_replace('/Bachelorof Sciencein Computer Science/i', 'Bachelor of Science in Computer Science', $text);
    $text = preg_replace('/Bachelorof Sciencein Information Systems/i', 'Bachelor of Science in Information Systems', $text);

    return trim($text);
}

// Handle file deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'deleteFile') {
    try {
        $fileId = $_POST['fileId'];

        // Delete from pdf_files
        $stmt1 = $pdo->prepare("DELETE FROM pdf_files WHERE ID = ?");
        $stmt1->execute([$fileId]);

        // Delete from docu_shelf
        $stmt2 = $pdo->prepare("DELETE FROM docu_shelf WHERE id = ?");
        $stmt2->execute([$fileId]);

        if ($stmt1->rowCount() > 0 || $stmt2->rowCount() > 0) {
            $response['success'] = true;
            $response['message'] = 'File deleted successfully from all tables';
        } else {
            throw new Exception('File not found in either table');
        }
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error deleting file: ' . $e->getMessage();
    }
    
    echo json_encode($response);
    exit;
}

// Fetch pending users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getPendingUsers') {
    try {
        // Define the SQL query 
        $sql = "SELECT id, name, email, user_id, user_type, department, program, request_date, certificate_url 
                FROM pending_users 
                WHERE (status = 'pending' OR status IS NULL)";
        $params = [];
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        
        // Only apply department filtering for dean, coordinator, or admin
        if (in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            // Get user's department
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
            
            if (!empty($userDept)) {
                // Filter by department directly - no option to see all
                $sql .= " AND department = ?";
                $params[] = $userDept;
            }
        }
        
        // Add ordering
        $sql .= " ORDER BY request_date DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $pendingUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($pendingUsers as &$user) {
            $user['requestId'] = $user['id'];
            // Ensure the certificate URL is properly formatted
            if ($user['certificate_url']) {
                // If the URL doesn't start with 'uploads/', add it
                if (strpos($user['certificate_url'], 'uploads/') !== 0) {
                    $user['certificate_url'] = 'uploads/' . $user['certificate_url'];
                }
            }
            $user['request_date'] = date('Y-m-d H:i:s', strtotime($user['request_date']));
        }

        $response['success'] = true;
        $response['pendingUsers'] = $pendingUsers;
        $response['user_type'] = $userType;
        $response['department'] = $userDept ?? null;
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error fetching pending users: ' . $e->getMessage();
    }
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Fetch approved users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getApprovedUsers') {
    try {
        // Get the "see_all" parameter from the request (default to false)
        $seeAll = isset($_GET['see_all']) && $_GET['see_all'] === 'true';
        
        // Define the SQL query with a placeholder for potential WHERE clause
        $sql = "SELECT id, name, email, user_id, user_type, department, program, created_at, account_status, certificate_url, created_by FROM users";
        $params = [];
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        $departmentFiltering = false;
        $userDept = null;
        
        // Only apply department filtering for dean, coordinator, or admin
        // AND only if the "see_all" parameter is false
        if (!$seeAll && in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            // Get user's department
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
            
            if (!empty($userDept)) {
                // Filter by the user's department directly
                $sql .= " WHERE department = ?";
                $params = [$userDept];
                $departmentFiltering = true;
            }
        }
        
        // Add ordering
        $sql .= " ORDER BY created_at DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $approvedUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($approvedUsers as &$user) {
            $user['userId'] = $user['id'];
            $user['created_at'] = date('Y-m-d H:i:s', strtotime($user['created_at']));
            $stmt2 = $pdo->prepare("SELECT COUNT(*) FROM document_requests WHERE borrower_id = ? AND status IN ('Reserved', 'Released', 'Overdue')");
            $stmt2->execute([$user['user_id']]);
            $user['requests'] = (int)$stmt2->fetchColumn();
        }

        $response['success'] = true;
        $response['approvedUsers'] = $approvedUsers;
        $response['user_type'] = $userType;
        $response['department'] = $userDept;
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error fetching approved users: ' . $e->getMessage();
    }
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Include the email sending function
require_once 'send_approval_email.php';

// Approve user request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'approveUser') {
    try {
        $requestId = $_POST['requestId'];
        if (!$requestId) throw new Exception("Invalid request ID");

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("SELECT * FROM pending_users WHERE id = ?");
        $stmt->execute([$requestId]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$userData) throw new Exception("User request not found");

        $acceptedBy = $_SESSION['user_name'] ?? 'Admin';

        $stmt = $pdo->prepare("INSERT INTO users (name, email, user_id, user_type, password, status, certificate_url, created_at, account_status, department, program, created_by) 
            VALUES (?, ?, ?, ?, ?, 'approved', ?, NOW(), 'activated', ?, ?, ?)");
        $stmt->execute([
            $userData['name'],
            $userData['email'],
            $userData['user_id'],
            $userData['user_type'],
            $userData['password'],
            $userData['certificate_url'],
            $userData['department'],
            $userData['program'],
            $acceptedBy
        ]);

        $stmt = $pdo->prepare("DELETE FROM pending_users WHERE id = ?");
        $stmt->execute([$requestId]);
        $pdo->commit();
        
        // Send approval email notification
        $emailResult = sendApprovalEmail($userData['email'], $userData['name']);
        
        $response['success'] = true;
        $response['message'] = 'User approved successfully';
        $response['emailSent'] = $emailResult['success'];
        if (!$emailResult['success']) {
            $response['emailError'] = $emailResult['message'];
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $response['success'] = false;
        $response['message'] = 'Error: ' . $e->getMessage();
    }
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Reject user request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'rejectUser') {
    try {
        $requestId = $_POST['requestId'];
        $stmt = $pdo->prepare("UPDATE pending_users SET status = 'disapproved' WHERE id = ?");
        $stmt->execute([$requestId]);
        echo json_encode(['success' => true, 'message' => 'User disapproved successfully']);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
    }
    exit;
}

// Add the formatName function at the top with other functions
function formatName($lastName, $firstName, $middleInitial) {
    // Convert names to title case
    $lastName = ucwords(strtolower(trim($lastName)));
    $firstName = ucwords(strtolower(trim($firstName)));
    $middleInitial = strtoupper(trim($middleInitial));

    // Format the full name
    $name = $lastName . ', ' . $firstName;
    if (!empty($middleInitial)) {
        $name .= ' ' . $middleInitial . '.';
    }
    return $name;
}

// Handle user creation request
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'createUserDirectly') {
    try {
        $lastName = $_POST['lastName'];
        $firstName = $_POST['firstName'];
        $middleInitial = $_POST['middleInitial'];
        $email = strtolower($_POST['email']);
        $userId = $_POST['id'];
        $userType = strtolower($_POST['userType']);
        $password = $_POST['password'];
        
        // Validate email based on user type
        if ($userType === 'alumni') {
            if (!preg_match('/^[a-zA-Z0-9._%+-]+@(neu\.edu\.ph|gmail\.com)$/i', $email)) {
                throw new Exception('Invalid email format. Alumni must use @neu.edu.ph or @gmail.com');
            }
        } else {
            if (!preg_match('/^[a-zA-Z0-9._%+-]+@neu\.edu\.ph$/i', $email)) {
                throw new Exception('Invalid email format. Must use @neu.edu.ph');
            }
        }
        
        // Format name using the formatName function
        $formattedName = formatName($lastName, $firstName, $middleInitial);
        
        // Check if email already exists in database
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE LOWER(email) = ?");
        $stmt->execute([$email]);
        if ($stmt->fetchColumn() > 0) {
            throw new Exception('Email is already registered');
        }
        
        // Check if user_id already exists
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE user_id = ?");
        $stmt->execute([$userId]);
        if ($stmt->fetchColumn() > 0) {
            throw new Exception('User ID is already registered');
        }
        
        // Handle certificate upload
        $certificateUrl = null;
        if (isset($_FILES['certificate']) && $_FILES['certificate']['error'] === UPLOAD_ERR_OK) {
            // Create uploads/certificates directory if it doesn't exist
            $uploadDir = 'uploads/certificates';
            if (!file_exists($uploadDir)) {
                if (!mkdir($uploadDir, 0777, true)) {
                    throw new Exception('Failed to create upload directory');
                }
            }

            // Validate file type
            $allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            $fileType = $_FILES['certificate']['type'];
            if (!in_array($fileType, $allowedTypes)) {
                throw new Exception('Invalid file type. Only JPG, PNG, and PDF files are allowed.');
            }

            // Generate unique filename
            $fileExtension = pathinfo($_FILES['certificate']['name'], PATHINFO_EXTENSION);
            $certificateFilename = $userId . '_' . time() . '.' . $fileExtension;
            $certificateUrl = $uploadDir . '/' . $certificateFilename;

            // Move uploaded file to certificates directory
            if (!move_uploaded_file($_FILES['certificate']['tmp_name'], $certificateUrl)) {
                throw new Exception('Failed to upload certificate. Error: ' . error_get_last()['message']);
            }

            // Verify file was moved successfully
            if (!file_exists($certificateUrl)) {
                throw new Exception('Certificate file was not saved properly');
            }
        }
        
        // Get department and program values
        $department = $_POST['department'];
        $program = isset($_POST['program']) ? $_POST['program'] : '';
        
        // Set default program values for specific user types
        if ($userType === 'dean') {
            $program = 'All Programs';
        } else if ($userType === 'admin') {
            $program = '-';
        }
        
        // Get the admin's name from session (or POST if you pass it from JS)
        $createdBy = $_SESSION['user_name'] ?? 'Admin';

        // Update the INSERT query to include program
        $stmt = $pdo->prepare("INSERT INTO users (name, email, user_id, user_type, password, status, certificate_url, created_at, account_status, department, program, created_by) 
                             VALUES (?, ?, ?, ?, ?, 'approved', ?, NOW(), 'activated', ?, ?, ?)");
        
        $stmt->execute([
            $formattedName,
            $email,
            $userId,
            $userType,
            password_hash($password, PASSWORD_DEFAULT),
            $certificateUrl,
            $department,
            $program,
            $createdBy
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
            // Create uploads/certificates directory if it doesn't exist
            $uploadDir = 'uploads/certificates';
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            // Generate unique filename
            $fileExtension = pathinfo($_FILES['certificate']['name'], PATHINFO_EXTENSION);
            $certificateFilename = $_POST['id'] . '_' . time() . '.' . $fileExtension;
            $certificateUrl = $uploadDir . '/' . $certificateFilename;

            // Move uploaded file to certificates directory
            if (!move_uploaded_file($_FILES['certificate']['tmp_name'], $certificateUrl)) {
                throw new Exception('Failed to upload certificate');
            }

            $userData['certificate_url'] = $certificateUrl;
        }
        
        // Save to pending users table with certificate URL
        $stmt = $pdo->prepare("INSERT INTO pending_users (name, email, user_id, user_type, password, request_date, certificate_url) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)");
        
        $stmt->execute([
            $userData['name'],
            $userData['email'],
            $userData['user_id'],
            $userData['user_type'],
            $userData['password'],
            $userData['request_date'],
            $userData['certificate_url'] ?? null
        ]);
        
        $response['success'] = true;
        $response['message'] = 'Account request submitted successfully';
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = $e->getMessage();
        
        // Clean up certificate if there was an error
        if (isset($certificateUrl) && $certificateUrl && file_exists($certificateUrl)) {
            unlink($certificateUrl);
        }
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Handle user deletion
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'deleteUser') {
    try {
        $userId = $_POST['userId'];
        
        // Get certificate URL before deletion
        $stmt = $pdo->prepare("SELECT certificate_url FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $userData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Delete certificate file if it exists
        if ($userData && !empty($userData['certificate_url']) && file_exists($userData['certificate_url'])) {
            unlink($userData['certificate_url']);
        }
        
        // Delete from users table
        $stmt = $pdo->prepare("DELETE FROM users WHERE user_id = ?");
        $stmt->execute([$userId]);
        
        if ($stmt->rowCount() > 0) {
            $response['success'] = true;
            $response['message'] = 'User deleted successfully';
        } else {
            throw new Exception("User not found");
        }
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error deleting user: ' . $e->getMessage();
    }
    
    header('Content-Type: application/json');
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

// In admin_dashboard.php, add this case to your action handler
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getUserDocuments') {
    $email = $_GET['email'] ?? '';
    $requestFile = 'documents/requests/' . $email . '.json';
    
    if (file_exists($requestFile)) {
        $requestData = json_decode(file_get_contents($requestFile), true);
        echo json_encode([
            'success' => true,
            'requests' => $requestData
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'requests' => null
        ]);
    }
    exit;
}

// Add this to admin_dashboard.php
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'submitDocRequest') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Get the highest existing reference number and generate the next one
        $stmt = $pdo->query("SELECT reference_no FROM document_requests WHERE reference_no LIKE 'T%' ORDER BY reference_no DESC LIMIT 1");
        $lastRef = $stmt->fetch(PDO::FETCH_COLUMN);

        // New improved code that handles any format of T-prefixed reference numbers
        if ($lastRef) {
            // Extract the number part (everything after 'T')
            $numPart = substr($lastRef, 1);
            
            // Ensure it's a number, or default to 0
            $nextNum = is_numeric($numPart) ? intval($numPart) + 1 : 1;
        } else {
            // Start from 1 if no existing reference found
            $nextNum = 1;
        }

        // Format as T001, T002, etc.
        $referenceNo = 'T' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
        
        $stmt = $pdo->prepare("
            INSERT INTO document_requests 
            (reference_no, document_id, title, borrower_id, status, date_released) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'released', NOW())
        ");
        
        $stmt->execute([
            $referenceNo,
            $data['documentId'],
            $data['title'],
            $data['user']['name'],
            $data['user']['email'],
            $data['user']['id'],
            $data['user']['type']
        ]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Document request submitted successfully',
            'referenceNo' => $referenceNo
        ]);
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error submitting document request: ' . $e->getMessage()
        ]);
    }
    exit;
}

// Add this new function to automatically update overdue status
function updateOverdueStatus($pdo) {
    try {
        $stmt = $pdo->prepare("
            UPDATE document_requests 
            SET status = 'Overdue' 
            WHERE status = 'Released' 
            AND TIMESTAMPDIFF(HOUR, date_released, NOW()) >= 24
        ");
        $stmt->execute();
        return true;
    } catch (Exception $e) {
        error_log("Error updating overdue status: " . $e->getMessage());
        return false;
    }
}

// Add this to your existing getDocRequests endpoint (at the beginning)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getDocRequests') {
    try {
        // Set header to ensure JSON response
        header('Content-Type: application/json');
        
        // First update any overdue statuses
        updateOverdueStatus($pdo);
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        $userDept = null;
        
        // Get user's department if they are a dean, coordinator or admin
        if (in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
        }
        
        // Check if the borrower_email column exists
        $hasEmailColumn = false;
        try {
            $checkStmt = $pdo->query("SHOW COLUMNS FROM document_requests LIKE 'borrower_email'");
            $hasEmailColumn = $checkStmt->rowCount() > 0;
        } catch (Exception $e) {
            $hasEmailColumn = false;
        }
        
        // Construct the base SQL query
        $sql = "SELECT 
                    dr.reference_no,
                    dr.document_id,
                    COALESCE(dr.title, pf.title, CONCAT('Document #', dr.document_id)) as title,
                    dr.borrower_id,";
                    
        // Add email column based on table structure
        if ($hasEmailColumn) {
            $sql .= "dr.borrower_email,";
        } else {
            $sql .= "u.email as borrower_email,";
        }
        
        $sql .= "dr.status,
                 dr.date_released,
                 dr.date_returned
                 FROM document_requests dr
                 LEFT JOIN pdf_files pf ON dr.document_id = pf.id
                 LEFT JOIN users u ON dr.borrower_id = u.user_id
                 WHERE dr.status IN ('Released', 'Reserved', 'Overdue')";
        
        // Add department filter based on document ID prefix
        $params = [];
        if (!empty($userDept)) {
            // Define department to document prefix mappings
            $departmentPrefixes = [];
            
            if ($userDept === 'CICS') {
                $departmentPrefixes = ['BSIT', 'BSCS', 'BSIS', 'BLIS'];
            } elseif ($userDept === 'CAS') {
                $departmentPrefixes = ['BAEcon', 'BAPolsci', 'BSPsych', 'BPA'];
            } elseif ($userDept === 'CEA') {
                $departmentPrefixes = ['BSCE', 'BSEE', 'BSME', 'BSArch'];
            }
            
            if (!empty($departmentPrefixes)) {
                $prefixConditions = [];
                foreach ($departmentPrefixes as $prefix) {
                    $prefixConditions[] = "dr.document_id LIKE CONCAT(?, '-%')";
                    $params[] = $prefix;
                }
                $sql .= " AND (" . implode(" OR ", $prefixConditions) . ")";
            }
        }
        
        $sql .= " ORDER BY dr.date_released DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($requests as &$request) {
            // Set default email if not found
            if (!isset($request['borrower_email']) || !$request['borrower_email']) {
                $request['borrower_email'] = 'Email not available';
            }
            
            // Double-check title is not empty
            if (empty($request['title'])) {
                $request['title'] = 'Document #' . $request['document_id'];
            }
            
            if ($request['date_released']) {
                $request['date_released'] = date('Y-m-d H:i:s', strtotime($request['date_released']));
            }
            if ($request['date_returned']) {
                $request['date_returned'] = date('Y-m-d H:i:s', strtotime($request['date_returned']));
            }
        }
        
        echo json_encode([
            'success' => true,
            'requests' => $requests
        ]);
        
    } catch (Exception $e) {
        // Ensure we send a JSON response even on error
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching document requests: ' . $e->getMessage()
        ]);
    }
    exit;
}

// Handle document request acceptance
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'acceptDocRequest') {
        try {
            $referenceNo = $input['referenceNo'];
            
            // Start transaction
            $pdo->beginTransaction();
            
            // Update the document request status to Released and set date_released
            $stmt = $pdo->prepare("UPDATE document_requests 
                                 SET status = 'Released', 
                                     date_released = NOW() 
                                 WHERE reference_no = ?");
            $stmt->execute([$referenceNo]);
            
            if ($stmt->rowCount() > 0) {
                // Commit the transaction
                $pdo->commit();
                
                $response['success'] = true;
                $response['message'] = 'Document request accepted successfully';
            } else {
                throw new Exception("Document request not found");
            }
            
        } catch (Exception $e) {
            // Rollback on error
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $response['success'] = false;
            $response['message'] = 'Error: ' . $e->getMessage();
        }
        
        header('Content-Type: application/json');
        echo json_encode($response);
        exit;
    }
}

// Handle document request rejection
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'rejectDocRequest') {
        try {
            $referenceNo = $input['referenceNo'];
            
            // Update status to Disapproved instead of deleting
            $stmt = $pdo->prepare("UPDATE document_requests SET status = 'Disapproved', date_disapproved = NOW() WHERE reference_no = ?");
            $stmt->execute([$referenceNo]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document request rejected successfully'
                ]);
            } else {
                throw new Exception("Document request not found");
            }
            
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Handle updating to overdue status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['action']) && $data['action'] === 'updateToOverdue') {
        try {
            $stmt = $pdo->prepare("
                UPDATE document_requests 
                SET status = 'Overdue' 
                WHERE reference_no = ? 
                AND status = 'Released'
                AND TIMESTAMPDIFF(HOUR, date_released, NOW()) >= 24
            ");
            
            $stmt->execute([$data['referenceNo']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Status updated to overdue successfully'
            ]);
            
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error updating status: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Handle marking document as returned
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['action']) && $data['action'] === 'markAsReturned') {
        try {
            $stmt = $pdo->prepare("
                UPDATE document_requests 
                SET status = 'Returned',
                    date_returned = NOW()
                WHERE reference_no = ?
                AND (status = 'Released' OR status = 'Overdue')
            ");
            
            $result = $stmt->execute([$data['referenceNo']]);
            
            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document marked as returned successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to mark document as returned'
                ]);
            }
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Handle getting returned documents
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getReturnedDocs') {
    try {
        // Set header to ensure JSON response
        header('Content-Type: application/json');
        
        // Add debug logging
        error_log('Fetching returned documents');
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        $userDept = null;
        
        // Get user's department if they are a dean, coordinator or admin
        if (in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
        }
        
        // Check if the borrower_email column exists
        $hasEmailColumn = false;
        try {
            $checkStmt = $pdo->query("SHOW COLUMNS FROM document_requests LIKE 'borrower_email'");
            $hasEmailColumn = $checkStmt->rowCount() > 0;
        } catch (Exception $e) {
            $hasEmailColumn = false;
        }
        
        // Construct the base SQL query
        $sql = "SELECT 
                    dr.reference_no,
                    dr.document_id,
                    dr.borrower_id,";
                    
        // Add email column based on table structure
        if ($hasEmailColumn) {
            $sql .= "dr.borrower_email,";
        } else {
            $sql .= "u.email as borrower_email,";
        }
        
        $sql .= "dr.status,
                 dr.date_released,
                 dr.date_returned,
                 COALESCE(dr.title, pf.title, CONCAT('Document #', dr.document_id)) as title
                 FROM document_requests dr
                 LEFT JOIN pdf_files pf ON dr.document_id = pf.ID
                 LEFT JOIN users u ON dr.borrower_id = u.user_id
                 WHERE dr.status = 'Returned'";
        
        // Add department filter based on document ID prefix
        $params = [];
        if (!empty($userDept)) {
            // Define department to document prefix mappings
            $departmentPrefixes = [];
            
            if ($userDept === 'CICS') {
                $departmentPrefixes = ['BSIT', 'BSCS', 'BSIS', 'BLIS'];
            } elseif ($userDept === 'CAS') {
                $departmentPrefixes = ['BAEcon', 'BAPolsci', 'BSPsych', 'BPA'];
            } elseif ($userDept === 'CEA') {
                $departmentPrefixes = ['BSCE', 'BSEE', 'BSME', 'BSArch'];
            }
            
            if (!empty($departmentPrefixes)) {
                $prefixConditions = [];
                foreach ($departmentPrefixes as $prefix) {
                    $prefixConditions[] = "dr.document_id LIKE CONCAT(?, '-%')";
                    $params[] = $prefix;
                }
                $sql .= " AND (" . implode(" OR ", $prefixConditions) . ")";
            }
        }
        
        $sql .= " ORDER BY dr.date_returned DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Set a default email if not found
        foreach ($requests as &$request) {
            if (empty($request['borrower_email'])) {
                $request['borrower_email'] = 'Email not available';
            }
        }
        
        // Log the number of returned documents found
        error_log('Found ' . count($requests) . ' returned documents');
        
        echo json_encode([
            'success' => true,
            'requests' => $requests
        ]);
    } catch (Exception $e) {
        // Ensure JSON response even on error
        header('Content-Type: application/json');
        error_log('Error fetching returned documents: ' . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching returned documents: ' . $e->getMessage()
        ]);
    }
    exit;
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

// Handle updating document status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['action']) && $data['action'] === 'updateDocumentStatus') {
        try {
            $stmt = $pdo->prepare("
                UPDATE document_requests 
                SET status = ?
                WHERE reference_no = ?
                AND date_returned IS NOT NULL
            ");
            
            $result = $stmt->execute([$data['status'], $data['referenceNo']]);
            
            if ($result) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document status updated successfully'
                ]);
            } else {
                echo json_encode([
                    'success' => false,
                    'message' => 'Failed to update document status'
                ]);
            }
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Add this new function to create PDF with message
function createCutPDFWithMessage($sourcePath, $cutPage, $totalPages) {
    try {
        $pdf = new \setasign\Fpdi\Fpdi();
        
        // Get the number of pages in source file
        $pageCount = $pdf->setSourceFile($sourcePath);
        
        // Ensure cut page is not beyond total pages
        $cutPage = min($cutPage, $pageCount);
        
        // Import pages up to cut point
        for ($pageNo = 1; $pageNo <= $cutPage; $pageNo++) {
            $templateId = $pdf->importPage($pageNo);
            $size = $pdf->getTemplateSize($templateId);
            $pdf->AddPage($size['orientation'], array($size['width'], $size['height']));
            $pdf->useTemplate($templateId);
        }

        // Always add a blank page at the end
        $pdf->AddPage();

        return $pdf->Output('S');
    } catch (Exception $e) {
        error_log("Error creating cut PDF with message: " . $e->getMessage());
        throw $e;
    }
}

// Handle user status toggle
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'toggleUserStatus') {
    try {
        $userId = $_POST['userId'];
        $status = $_POST['status'];
        
        // Check if a reason was provided for deactivation
        $reason = isset($_POST['reason']) ? $_POST['reason'] : null;
        
        if ($status === 'deactivated' && $reason) {
            // Update user account_status and store the deactivation reason
            $stmt = $pdo->prepare("UPDATE users SET account_status = ?, deactivation_reason = ? WHERE user_id = ?");
            $stmt->execute([$status, $reason, $userId]);
        } else {
            // Just update the account status
            $stmt = $pdo->prepare("UPDATE users SET account_status = ? WHERE user_id = ?");
            $stmt->execute([$status, $userId]);
        }
        
        if ($stmt->rowCount() > 0) {
            $response['success'] = true;
            $response['message'] = 'User status updated successfully';
        } else {
            throw new Exception("User not found");
        }
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error updating user status: ' . $e->getMessage();
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Add this function to handle expired reservations
function deleteExpiredReservations($pdo) {
    try {
        // Delete reservations that have been in 'Reserved' status for more than 24 hours
        $stmt = $pdo->prepare("
            DELETE FROM document_requests 
            WHERE status = 'reserved' 
            AND TIMESTAMPDIFF(HOUR, date_released, NOW()) >= 24
        ");
        
        $stmt->execute();
        return [
            'success' => true,
            'deletedCount' => $stmt->rowCount()
        ];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => $e->getMessage()
        ];
    }
}

// Add a new endpoint to check and delete expired reservations
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'checkExpiredReservations') {
    $result = deleteExpiredReservations($pdo);
    header('Content-Type: application/json');
    echo json_encode($result);
    exit;
}

// Add this new endpoint for checking overdue status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['action']) && $data['action'] === 'checkOverdueStatus') {
        try {
            $updated = updateOverdueStatus($pdo);
            echo json_encode([
                'success' => true,
                'updated' => $updated
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error checking overdue status: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Handle file update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'updateFile') {
    try {
        $originalDocId = $_POST['originalDocId'];
        $newDocId = $_POST['newDocId'];
        $newFileName = $_POST['newFileName'];
        $title = $_POST['title'];
        $author = $_POST['author'];
        $year = $_POST['year'];
        $course = $_POST['course'];

        $stmt = $pdo->prepare("UPDATE pdf_files SET id = ?, filename = ?, title = ?, author = ?, year = ?, course = ? WHERE id = ?");
        $stmt->execute([$newDocId, $newFileName, $title, $author, $year, $course, $originalDocId]);

        if ($stmt->rowCount() > 0) {
            $response['success'] = true;
            $response['message'] = 'File updated successfully';
        } else {
            throw new Exception('No changes made or file not found');
        }
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error updating file: ' . $e->getMessage();
    }
    echo json_encode($response);
    exit;
}

// Handle user update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'updateUser') {
    try {
        $userId = $_POST['userId'];
        $name = $_POST['name'];
        $email = $_POST['email'];
        $ID = $_POST['ID'];

        $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, user_id = ? WHERE id = ?");
        $stmt->execute([$name, $email, $ID, $userId]);

        if ($stmt->rowCount() > 0) {
            $response['success'] = true;
            $response['message'] = 'User updated successfully';
        } else {
            throw new Exception('No changes made or user not found');
        }
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error updating user: ' . $e->getMessage();
    }
    echo json_encode($response);
    exit;
}

// Add this to the POST action handlers in admin_dashboard.php
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'requestDocument') {
    try {
        // Check if user is logged in
        if (!isset($_SESSION['loggedin']) || !$_SESSION['loggedin']) {
            throw new Exception('Please log in to request documents');
        }

        $documentId = $_POST['documentId'];
        
        // Check if the document is already reserved
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM document_requests WHERE document_id = ? AND status = 'reserved'");
        $checkStmt->execute([$documentId]);
        $alreadyReserved = $checkStmt->fetchColumn() > 0;
        
        if ($alreadyReserved) {
            throw new Exception('Someone already requested this file');
        }
        
        // Get coordinator's name from session
        $coordinatorName = $_SESSION['user_name'];
        
        // Get email - first try from session, then try to find in database
        $coordinatorEmail = isset($_SESSION['user_email']) ? $_SESSION['user_email'] : null;
        
        // If email not in session, try to get it from database
        if (!$coordinatorEmail) {
            $userStmt = $pdo->prepare("SELECT email FROM users WHERE user_id = ? OR name = ? LIMIT 1");
            $userStmt->execute([$coordinatorName, $coordinatorName]);
            $userData = $userStmt->fetch(PDO::FETCH_ASSOC);
            
            if ($userData && isset($userData['email'])) {
                $coordinatorEmail = $userData['email'];
            } else {
                // Default email if not found
                $coordinatorEmail = "no-email@provided.com";
            }
        }
        
        // Get the highest existing reference number and generate the next one
        $stmt = $pdo->query("SELECT reference_no FROM document_requests WHERE reference_no LIKE 'T%' ORDER BY reference_no DESC LIMIT 1");
        $lastRef = $stmt->fetch(PDO::FETCH_COLUMN);

        // New improved code that handles any format of T-prefixed reference numbers
        if ($lastRef) {
            // Extract the number part (everything after 'T')
            $numPart = substr($lastRef, 1);
            
            // Ensure it's a number, or default to 0
            $nextNum = is_numeric($numPart) ? intval($numPart) + 1 : 1;
        } else {
            // Start from 1 if no existing reference found
            $nextNum = 1;
        }

        // Format as T001, T002, etc.
        $referenceNo = 'T' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
        
        // Get document details with better error handling
        $stmt = $pdo->prepare("SELECT ID, title FROM pdf_files WHERE ID = ?");
        $stmt->execute([$documentId]);
        $document = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$document) {
            throw new Exception('Document not found');
        }
        
        // If title is empty or null, use a generic title with the document ID
        $title = $document['title'];
        if (empty($title)) {
            $title = "Document #" . $document['ID'];
        }
        
        // Insert the request into the document_requests table
        $stmt = $pdo->prepare("INSERT INTO document_requests (reference_no, document_id, borrower_id, borrower_email, title, status, date_released) VALUES (?, ?, ?, ?, ?, 'reserved', NOW())");
        $stmt->execute([$referenceNo, $documentId, $coordinatorName, $coordinatorEmail, $title]);
        
        $response['success'] = true;
        $response['message'] = 'Document requested successfully';
        
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error requesting document: ' . $e->getMessage();
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['action']) && $data['action'] === 'approveAndDownloadDoc') {
        try {
            $referenceNo = $data['referenceNo'];
            
            // Update the document request status to 'Returned' and set both date_released and date_returned to now
            $stmt = $pdo->prepare("UPDATE document_requests 
                                 SET status = 'Returned', 
                                     date_released = NOW(),
                                     date_returned = NOW()
                                 WHERE reference_no = ?");
            $stmt->execute([$referenceNo]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Document status updated to Returned successfully'
                ]);
            } else {
                throw new Exception("Document request not found");
            }
            
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Get disapproved users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getDisapprovedUsers') {
    try {
        // Calculate the date 6 months ago
        $sixMonthsAgo = date('Y-m-d H:i:s', strtotime('-6 months'));
        
        // Define the SQL query - now filtering out old rejected users directly
        $sql = "SELECT id, name, email, user_id, user_type, department, program, request_date, certificate_url, reject_reason 
                FROM pending_users 
                WHERE status = 'disapproved'
                AND (date_rejected IS NULL OR date_rejected >= ?)";
        
        $params = [$sixMonthsAgo]; // Add six months ago parameter
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        
        // Only apply department filtering for dean, coordinator, or admin
        if (in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            // Get user's department
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
            
            if (!empty($userDept)) {
                // Filter by department directly - no option to see all
                $sql .= " AND department = ?";
                $params[] = $userDept;
            }
        }
        
        // Add ordering
        $sql .= " ORDER BY request_date DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $disapprovedUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($disapprovedUsers as &$user) {
            // Ensure the certificate URL is properly formatted
            if ($user['certificate_url']) {
                // If the URL doesn't start with 'uploads/', add it
                if (strpos($user['certificate_url'], 'uploads/') !== 0) {
                    $user['certificate_url'] = 'uploads/' . $user['certificate_url'];
                }
            }
            
            // Make sure reject_reason is available (default if not set)
            if (!isset($user['reject_reason']) || $user['reject_reason'] === null) {
                $user['reject_reason'] = 'No reason provided';
            }
        }

        $response['success'] = true;
        $response['disapprovedUsers'] = $disapprovedUsers;
        $response['user_type'] = $userType;
        $response['department'] = $userDept ?? null;
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error fetching disapproved users: ' . $e->getMessage();
    }
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Update reject user endpoint
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'rejectUser') {
        try {
            $requestId = $input['requestId'];
            
            // Update status to disapproved instead of deleting
            $stmt = $pdo->prepare("UPDATE pending_users SET status = 'disapproved' WHERE id = ?");
            $stmt->execute([$requestId]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'User request rejected successfully'
                ]);
            } else {
                throw new Exception("User request not found");
            }
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Reconsider a disapproved user (move back to pending)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'reconsiderUser') {
        try {
            $requestId = $input['requestId'];
            
            // Update status back to pending
            $stmt = $pdo->prepare("UPDATE pending_users SET status = 'pending' WHERE id = ?");
            $stmt->execute([$requestId]);
            
            if ($stmt->rowCount() > 0) {
                echo json_encode([
                    'success' => true,
                    'message' => 'User moved back to pending requests'
                ]);
            } else {
                throw new Exception("User request not found");
            }
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Delete disapproved users
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'deleteDisapprovedUsers') {
        try {
            $userIds = $input['userIds'];
            $deletedCount = 0;
            
            foreach ($userIds as $userId) {
                // Get certificate URL before deletion
                $stmt = $pdo->prepare("SELECT certificate_url FROM pending_users WHERE user_id = ? AND status = 'disapproved'");
                $stmt->execute([$userId]);
                $userData = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Delete certificate file if it exists
                if ($userData && !empty($userData['certificate_url'])) {
                    $certificatePath = $userData['certificate_url'];
                    if (file_exists($certificatePath)) {
                        unlink($certificatePath);
                    }
                }
                
                // Delete the user from the database
                $stmt = $pdo->prepare("DELETE FROM pending_users WHERE user_id = ? AND status = 'disapproved'");
                $stmt->execute([$userId]);
                $deletedCount += $stmt->rowCount();
            }
            
            echo json_encode([
                'success' => true,
                'deleted' => $deletedCount,
                'message' => "Successfully deleted $deletedCount user(s)"
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error deleting users: ' . $e->getMessage()
            ]);
        }
        exit;
    }
}

// Handle getting disapproved documents
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getDisapprovedDocs') {
    try {
        // Set header to ensure JSON response
        header('Content-Type: application/json');
        
        // Add debug logging
        error_log('Fetching disapproved documents');
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        $userDept = null;
        
        // Get user's department if they are a dean, coordinator or admin
        if (in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
        }
        
        // Check if the borrower_email column exists
        $hasEmailColumn = false;
        try {
            $checkStmt = $pdo->query("SHOW COLUMNS FROM document_requests LIKE 'borrower_email'");
            $hasEmailColumn = $checkStmt->rowCount() > 0;
        } catch (Exception $e) {
            $hasEmailColumn = false;
        }
        
        // Construct the base SQL query
        $sql = "SELECT 
                    dr.reference_no,
                    dr.document_id,
                    dr.borrower_id,";
                    
        // Add email column based on table structure
        if ($hasEmailColumn) {
            $sql .= "dr.borrower_email,";
        } else {
            $sql .= "u.email as borrower_email,";
        }
        
        $sql .= "dr.status,
                 dr.date_released,
                 dr.date_disapproved,
                 COALESCE(dr.title, pf.title, CONCAT('Document #', dr.document_id)) as title
                 FROM document_requests dr
                 LEFT JOIN pdf_files pf ON dr.document_id = pf.ID
                 LEFT JOIN users u ON dr.borrower_id = u.user_id
                 WHERE dr.status = 'Disapproved'";
        
        // Add department filter based on document ID prefix
        $params = [];
        if (!empty($userDept)) {
            // Define department to document prefix mappings
            $departmentPrefixes = [];
            
            if ($userDept === 'CICS') {
                $departmentPrefixes = ['BSIT', 'BSCS', 'BSIS', 'BLIS'];
            } elseif ($userDept === 'CAS') {
                $departmentPrefixes = ['BAEcon', 'BAPolsci', 'BSPsych', 'BPA'];
            } elseif ($userDept === 'CEA') {
                $departmentPrefixes = ['BSCE', 'BSEE', 'BSME', 'BSArch'];
            }
            
            if (!empty($departmentPrefixes)) {
                $prefixConditions = [];
                foreach ($departmentPrefixes as $prefix) {
                    $prefixConditions[] = "dr.document_id LIKE CONCAT(?, '-%')";
                    $params[] = $prefix;
                }
                $sql .= " AND (" . implode(" OR ", $prefixConditions) . ")";
            }
        }
        
        $sql .= " ORDER BY dr.date_disapproved DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Set a default email if not found
        foreach ($requests as &$request) {
            if (empty($request['borrower_email'])) {
                $request['borrower_email'] = 'Email not available';
            }
        }
        
        // Log the number of disapproved documents found
        error_log('Found ' . count($requests) . ' disapproved documents');
        
        echo json_encode([
            'success' => true,
            'requests' => $requests
        ]);
    } catch (Exception $e) {
        // Ensure JSON response even on error
        header('Content-Type: application/json');
        error_log('Error fetching disapproved documents: ' . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Error fetching disapproved documents: ' . $e->getMessage()
        ]);
    }
    exit;
}

// Add this function to update existing reference numbers (run it once)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'migrateReferenceNumbers') {
    try {
        // Get all document requests with old reference numbers
        $stmt = $pdo->query("SELECT reference_no FROM document_requests WHERE reference_no NOT LIKE 'T%' ORDER BY id ASC");
        $oldRefs = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        $updated = 0;
        
        // For each old reference, generate a new one and update it
        foreach ($oldRefs as $oldRef) {
            // Get the highest existing T-format reference number
            $stmt = $pdo->query("SELECT reference_no FROM document_requests WHERE reference_no LIKE 'T%' ORDER BY reference_no DESC LIMIT 1");
            $lastRef = $stmt->fetch(PDO::FETCH_COLUMN);
            
            if ($lastRef && preg_match('/^T(\d+)$/', $lastRef, $matches)) {
                // Extract the number and increment it
                $nextNum = intval($matches[1]) + 1;
            } else {
                // Start from 1 if no existing reference found
                $nextNum = 1;
            }
            
            // Format as T001, T002, etc.
            $newRef = 'T' . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
            
            // Update the reference number
            $updateStmt = $pdo->prepare("UPDATE document_requests SET reference_no = ? WHERE reference_no = ?");
            $updateStmt->execute([$newRef, $oldRef]);
            
            $updated++;
        }
        
        echo json_encode([
            'success' => true,
            'message' => "Updated $updated reference numbers to the new format"
        ]);
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error migrating reference numbers: ' . $e->getMessage()
        ]);
    }
    exit;
}

// Get deactivated users
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'getDeactivatedUsers') {
    try {
        // Define the SQL query
        $sql = "SELECT id, name, email, user_id, user_type, department, program, created_at, deactivation_reason 
                FROM users 
                WHERE account_status = 'deactivated'";
        $params = [];
        
        // Check user type and department from session
        $userType = strtolower($_SESSION['user_type'] ?? '');
        $userEmail = $_SESSION['email'] ?? '';
        
        // Only apply department filtering for dean, coordinator, or admin
        if (in_array($userType, ['dean', 'coordinator', 'admin']) && !empty($userEmail)) {
            // Get user's department
            $stmtDept = $pdo->prepare("SELECT department FROM users WHERE email = ?");
            $stmtDept->execute([$userEmail]);
            $userDept = $stmtDept->fetchColumn();
            
            if (!empty($userDept)) {
                // Filter by department directly - no option to see all
                $sql .= " AND department = ?";
                $params[] = $userDept;
            }
        }
        
        // Add ordering
        $sql .= " ORDER BY created_at DESC";
        
        // Prepare and execute the query
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $deactivatedUsers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $response['success'] = true;
        $response['deactivatedUsers'] = $deactivatedUsers;
        $response['user_type'] = $userType;
        $response['department'] = $userDept ?? null;
    } catch (Exception $e) {
        $response['success'] = false;
        $response['message'] = 'Error fetching deactivated users: ' . $e->getMessage();
    }
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

// Add this to admin_dashboard.php where other POST handlers are located
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'rejectRequest') {
    $requestId = $_POST['requestId'] ?? null;
    $rejectionReason = $_POST['reason'] ?? 'No reason provided';
    
    if ($requestId) {
        try {
            // First get the user data from pending_users
            $stmt = $pdo->prepare("SELECT * FROM pending_users WHERE id = ?");
            $stmt->execute([$requestId]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($userData) {
                // Update the pending_users record status to disapproved
                $stmt = $pdo->prepare("UPDATE pending_users SET status = 'disapproved', reject_reason = ?, date_rejected = NOW() WHERE id = ?");
                $result = $stmt->execute([$rejectionReason, $requestId]);
                
                if ($result) {
                    $response['success'] = true;
                    $response['message'] = 'User request rejected successfully!';
                } else {
                    $response['success'] = false;
                    $response['message'] = 'Error rejecting user request';
                }
            } else {
                $response['success'] = false;
                $response['message'] = 'User request not found';
            }
        } catch (Exception $e) {
            $response['success'] = false;
            $response['message'] = 'Error: ' . $e->getMessage();
        }
    } else {
        $response['success'] = false;
        $response['message'] = 'Invalid request ID';
    }
    
    header('Content-Type: application/json');
    echo json_encode($response);
    exit;
}

echo json_encode($response);

// Function to delete rejected users older than 6 months
function deleteOldRejectedUsers($pdo) {
    try {
        // Calculate the date 6 months ago
        $sixMonthsAgo = date('Y-m-d H:i:s', strtotime('-6 months'));
        
        // Get certificate URLs before deletion to clean up files
        $stmt = $pdo->prepare("SELECT certificate_url FROM pending_users 
                              WHERE status = 'disapproved' 
                              AND date_rejected IS NOT NULL 
                              AND date_rejected < ?");
        $stmt->execute([$sixMonthsAgo]);
        $certificates = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Delete certificate files
        foreach ($certificates as $certificate) {
            if ($certificate && file_exists($certificate)) {
                unlink($certificate);
            }
        }
        
        // Delete the rejected users
        $stmt = $pdo->prepare("DELETE FROM pending_users 
                              WHERE status = 'disapproved' 
                              AND date_rejected IS NOT NULL 
                              AND date_rejected < ?");
        $stmt->execute([$sixMonthsAgo]);
        
        $deletedCount = $stmt->rowCount();
        
        return [
            'success' => true,
            'message' => "Deleted $deletedCount rejected users older than 6 months",
            'count' => $deletedCount
        ];
    } catch (Exception $e) {
        return [
            'success' => false,
            'message' => 'Error deleting old rejected users: ' . $e->getMessage()
        ];
    }
}

// Add scheduled tasks runner
function runScheduledTasks($pdo) {
    // Track the last run time in a file
    $lastRunFile = 'cleanup_last_run.txt';
    $currentTime = time();
    $shouldRun = true;
    
    // Check when we last ran the cleanup
    if (file_exists($lastRunFile)) {
        $lastRunTime = (int)file_get_contents($lastRunFile);
        // Run at most once per day (86400 seconds)
        $shouldRun = ($currentTime - $lastRunTime) > 86400;
    }
    
    if ($shouldRun) {
        // Run the cleanup tasks
        deleteOldRejectedUsers($pdo);
        
        // Update the last run timestamp
        file_put_contents($lastRunFile, $currentTime);
        
        // Log the run
        error_log("Scheduled cleanup tasks run at " . date('Y-m-d H:i:s'));
    }
}

// Call the scheduler near the beginning of your script
// but only on normal page loads, not API calls
if (!isset($_GET['action']) && !isset($_POST['action'])) {
    runScheduledTasks($pdo);
}