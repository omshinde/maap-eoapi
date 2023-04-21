#!/bin/bash

# script to deploy the infrastructure

# grab the JWKS_URL from maap-auth-stack-test
export JWKS_URL=$(aws cloudformation describe-stacks --stack-name 'maap-auth-stack-test' --query 'Stacks[0].Outputs[?OutputKey==`jwksurl`].OutputValue' --output text)
# stage
export STAGE="test"

cdk synth --all
cdk deploy --all