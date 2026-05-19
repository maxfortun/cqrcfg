#!/bin/bash
set -e

DEPLOY_KEY_SECRET=in_contmgt_strmproc_apps_acq/cqrcfg_deploy_key

SECRET_JSON=$(aws --region us-east-1 --output text secretsmanager get-secret-value --secret-id "$DEPLOY_KEY_SECRET" --query SecretString)

mkdir -p ~/.ssh
echo "$SECRET_JSON" | jq -r '.deploy_key' > ~/.ssh/id_ed25519_enterprise
chmod 600 ~/.ssh/id_ed25519_enterprise

ssh-keyscan github.dowjones.net >> ~/.ssh/known_hosts 2>/dev/null

echo "Deploy key installed"
