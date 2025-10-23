# ===============================================================
# Script Name : getGitApiResponse.ps1
# Description : Calls GitHub REST API and prints + saves full JSON response
# Author      : Akash DevOps
# ===============================================================

# Step 1️⃣ - Setup GitHub API authentication headers
$githeader = @{
    Authorization = "token $env:GIT_TOKEN"
    Accept        = "application/vnd.github.v3+json"
}

# Step 2️⃣ - Define the GitHub API endpoint
# Example: Get pull request details for PR ID 1
$pullRequestID = 1
$pullRequestUrl = "$env:GIT_SERVER_URL$env:GITHUB_REPOSITORY/pulls/$pullRequestID"

Write-Host "Making API call to: $pullRequestUrl"

# Step 3️⃣ - Make the API call (GET request)
try {
    $response = Invoke-RestMethod -Uri $pullRequestUrl -Headers $githeader -Method Get

    # Step 4️⃣ - Convert response to readable JSON
    $jsonResponse = $response | ConvertTo-Json -Depth 10

    # Step 5️⃣ - Print response to console
    Write-Host "✅ GitHub API Response:"
    Write-Output $jsonResponse

    # Step 6️⃣ - Save JSON response to a file
    $outputPath = "response.json"
    $jsonResponse | Out-File -FilePath $outputPath -Encoding utf8

    Write-Host "💾 JSON response saved to: $outputPath"
}
catch {
    Write-Host "❌ Error occurred while calling GitHub API:"
    Write-Host $_
}
