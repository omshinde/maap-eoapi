#!/bin/bash

# load config from .env, assumed to be in the same directory as this script and a valid bash file
set -a # automatically export all variables
source .env
set +a

# grab the JWKS_URL from auth deployment
export JWKS_URL=$(aws cloudformation describe-stacks --stack-name 'maap-auth-stack-dev' --query 'Stacks[0].Outputs[?OutputKey==`jwksurl`].OutputValue' --output text)

# cdk synth --all
# cdk deploy --all