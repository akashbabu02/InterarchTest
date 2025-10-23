#!/bin/bash
echo "Sending email using Bash..."

TO="akashbharathi18@gmail.com"
FROM="akashbharathi2222@gmail.com"
SUBJECT="Deployment Notification"
BODY="Hello Team,

A new push was made to the repository.
Artifacts and reports have been generated.

Regards,
DevOps Bot"

curl --url "smtps://smtp.gmail.com:465" \
  --ssl-reqd \
  --mail-from "$FROM" \
  --mail-rcpt "$TO" \
  --user "$FROM:${SMTP_PASS}" \
  -T <(echo -e "From: $FROM\nTo: $TO\nSubject: $SUBJECT\n\n$BODY")

echo "Email sent successfully!"