#!/bin/bash
set -e

awslocal sqs create-queue --queue-name cnpj-sync-queue 2>/dev/null || true
