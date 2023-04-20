#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";

import { Vpc } from "./Vpc";
import { Config } from "./config";
import { PgStacInfra } from "./PgStacInfra";
import { Roles } from "./roles";
const { stage, version, buildStackName, tags } =
  new Config();

export const app = new cdk.App({});

const { vpc } = new Vpc(app, buildStackName("vpc"), {
  terminationProtection: false,
  tags,
  natGatewayCount: stage === "prod" ? undefined : 1,
});

const roles = new Roles(app, buildStackName("roles"));

new PgStacInfra(app, buildStackName("pgSTAC"), {
  vpc,
  tags,
  stage,
  version,
  terminationProtection: false,
  dataAccessRoleArn: roles.dataAccessRoleArn,
  stacIngestorRoleArn: roles.stacIngestorApiRoleArn,
  bastionIpv4AllowList: [
    "121.141.217.93/32", // Emile work
    "66.17.119.38/32", // Jamison
    "131.215.220.32/32", // Aimee's home
    "104.9.124.28/32", // Sean 
    "222.108.19.128/32", // Emile home
  ],
  bastionUserDataPath: "./userdata.yaml",
  bastionHostCreateElasticIp: stage === "prod",
  ingestorApiGatewayIpv4AllowList: [
    "121.141.217.93/32", // Emile work
    "66.17.119.38/32", // Jamison
    "131.215.220.32/32", // Aimee's home
    "104.9.124.28/32", // Sean
    "222.108.19.128/32", // Emile home
  ],
});
