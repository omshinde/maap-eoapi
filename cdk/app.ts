#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";

import { Vpc } from "./Vpc";
import { Config } from "./config";
import { PgStacInfra } from "./PgStacInfra";
import { PgStacApplication } from "./PgStacApplication";
const { stage, version, buildStackName, tags, jwksUrl, dataAccessRoleArn, stacApiIntegrationApiArn } =
  new Config();

export const app = new cdk.App({});

const { vpc } = new Vpc(app, buildStackName("vpc"), {
  terminationProtection: true,
  tags,
  natGatewayCount: stage === "prod" ? undefined : 1,
});

const { db, pgstacSecret } = new PgStacInfra(app, buildStackName("pgSTAC"), {
  vpc,
  stage,
  terminationProtection: true,
  tags,
  description: "MAAP pgSTAC database infrastructure stack",
});

new PgStacApplication(app, buildStackName("pgSTAC-stateless"), {
  vpc: vpc,
  stage: stage,
  version : version,
  bastionUserDataPath: "./userdata.yaml",
  bastionIpv4AllowList: [
    "121.141.217.93/32", // Emile work
    "66.17.119.38/32", // Jamison
    "131.215.220.32/32", // Aimee's home
    "104.9.124.28/32", // Sean 
    "222.108.19.128/32", // Emile home
  ],
  bastionHostCreateElasticIp: stage === "prod",
  jwksUrl: jwksUrl,
  dataAccessRoleArn: dataAccessRoleArn,
  stacApiIntegrationApiArn: stacApiIntegrationApiArn,
  pgstacSecret: pgstacSecret,
  db : db,
  terminationProtection: false,
  tags: tags,
  description: "MAAP pgSTAC stateless stack",
});