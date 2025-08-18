#!/bin/bash

# Generate SSL certificates for development/testing
# For production, use proper certificates from a CA like Let's Encrypt

set -e

CERTS_DIR="./certs"
DOMAIN="${1:-localhost}"

echo "Generating SSL certificates for domain: $DOMAIN"

# Create certs directory if it doesn't exist
mkdir -p "$CERTS_DIR"

# Generate private key
openssl genrsa -out "$CERTS_DIR/key.pem" 2048

# Generate certificate signing request
openssl req -new -key "$CERTS_DIR/key.pem" -out "$CERTS_DIR/csr.pem" -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

# Generate self-signed certificate
openssl x509 -req -in "$CERTS_DIR/csr.pem" -signkey "$CERTS_DIR/key.pem" -out "$CERTS_DIR/cert.pem" -days 365 -extensions v3_req -extfile <(
cat <<EOF
[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = localhost
DNS.3 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF
)

# Clean up CSR file
rm "$CERTS_DIR/csr.pem"

# Set appropriate permissions
chmod 600 "$CERTS_DIR/key.pem"
chmod 644 "$CERTS_DIR/cert.pem"

echo "SSL certificates generated successfully:"
echo "  Certificate: $CERTS_DIR/cert.pem"
echo "  Private Key: $CERTS_DIR/key.pem"
echo ""
echo "For production, replace these with proper certificates from a trusted CA."
echo "Consider using Let's Encrypt with certbot for free SSL certificates."