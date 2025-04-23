<?php
header('Content-Type: application/json');
require_once 'db_connect.php';

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

function searchDocuments($searchQuery, $page = 1, $selectedYear = '', $sortByDate = false, $category = 'Any Field', $selectedProgram = '') {
    global $pdo;
    $resultsPerPage = 20;

    try {
        // Start building the base query with DISTINCT to ensure unique results
        $baseQuery = "SELECT DISTINCT p.* FROM pdf_files p WHERE 1=1";
        $params = [];

        // Add search conditions if a search query is provided
        if (!empty($searchQuery)) {
            switch ($category) {
                case 'Title':
                    $baseQuery .= " AND title LIKE :search";
                    break;
                case 'Author':
                    $baseQuery .= " AND author LIKE :search";
                    break;
                case 'Abstract':
                    $baseQuery .= " AND text_content LIKE :search";
                    break;
                default: // Any Field
                    $baseQuery .= " AND (
                        title LIKE :search 
                        OR author LIKE :search 
                        OR text_content LIKE :search
                    )";
            }
            $params[':search'] = "%{$searchQuery}%";
        }

        // Add year filter if selected
        if (!empty($selectedYear)) {
            if (strpos($selectedYear, 'Since') !== false) {
                $year = substr($selectedYear, 6);
                $baseQuery .= " AND year >= :year";
                $params[':year'] = $year;
            } else {
                $baseQuery .= " AND year = :year";
                $params[':year'] = $selectedYear;
            }
        }

        // Add program filter if selected
        if (!empty($selectedProgram) && $selectedProgram !== 'All Programs') {
            $baseQuery .= " AND course = :program";
            $params[':program'] = $selectedProgram;
        }

        // Add sorting
        if ($sortByDate) {
            $baseQuery .= " ORDER BY year DESC, last_modified DESC";
        } else {
            $baseQuery .= " ORDER BY id DESC";
        }

        // Get total count for pagination using a separate subquery to ensure accurate count
        $countQuery = "SELECT COUNT(DISTINCT id) FROM pdf_files WHERE id IN (SELECT id FROM ($baseQuery) as filtered_files)";
        $stmt = $pdo->prepare($countQuery);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $totalResults = $stmt->fetchColumn();

        // Calculate pagination
        $totalPages = ceil($totalResults / $resultsPerPage);
        $currentPage = max(1, min($page, $totalPages));
        $offset = ($currentPage - 1) * $resultsPerPage;

        // Add pagination to main query
        $baseQuery .= " LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($baseQuery);
        
        // Bind all parameters
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $resultsPerPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        
        // Execute the query
        $stmt->execute();
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format the results
        $docs = array_map(function($row) {
            $title = !empty($row['title']) ? $row['title'] : pathinfo($row['filename'], PATHINFO_FILENAME);
            $text = $row['text_content'];
            
            // Clean up any spaces before punctuation in title and text
            $title = preg_replace('/\s+([.,!?:;])/', '$1', $title);
            $text = preg_replace('/\s+([.,!?:;])/', '$1', $text);
            
            return [
                'fileName' => $row['filename'],
                'title' => $title,
                'author' => !empty($row['author']) ? formatAuthors($row['author']) : 'N/A',
                'creationDate' => !empty($row['year']) ? $row['year'] : 'N/A',
                'program' => !empty($row['course']) ? $row['course'] : 'N/A',
                'text' => $text
            ];
        }, $results);

        return [
            'docs' => $docs,
            'totalPages' => $totalPages,
            'currentPage' => $currentPage,
            'totalResults' => $totalResults
        ];

    } catch (PDOException $e) {
        error_log("Database Error: " . $e->getMessage());
        return [
            'docs' => [],
            'totalPages' => 0,
            'currentPage' => $page,
            'totalResults' => 0,
            'error' => 'Database error occurred'
        ];
    }
}

function extractPdfMetadata($filePath) {
    $content = file_get_contents($filePath);
    
    $metadata = [
        'author' => 'N/A',
        'creationDate' => ''
    ];
    
    if (preg_match('/\/Author\s*\((.*?)\)/i', $content, $matches)) {
        $metadata['author'] = trim(str_replace(['(', ')'], '', $matches[1]));
    }
    
    if (preg_match('/\/CreationDate\s*\((.*?)\)/i', $content, $matches)) {
        $metadata['creationDate'] = trim(str_replace(['(', ')'], '', $matches[1]));
    }
    
    return $metadata;
}

function extractTextFileContent($filePath) {
    // read entire content of the text file
    return file_get_contents($filePath);
}

// Get search parameters from request
$searchQuery = isset($_GET['keyword']) ? trim($_GET['keyword']) : '';
$page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$selectedYear = isset($_GET['year']) ? trim($_GET['year']) : '';
$sortByDate = isset($_GET['sortByDate']) ? filter_var($_GET['sortByDate'], FILTER_VALIDATE_BOOLEAN) : false;
$category = isset($_GET['category']) ? trim($_GET['category']) : 'Any Field';
$selectedProgram = isset($_GET['program']) ? trim($_GET['program']) : '';

// Perform search and return results
$searchResults = searchDocuments($searchQuery, $page, $selectedYear, $sortByDate, $category, $selectedProgram);

// Debug: Log the final response
error_log("Search Response: " . print_r($searchResults, true));

echo json_encode($searchResults);
?>