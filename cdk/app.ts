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
    "121.141.217.93/32", // emile work
  ],
  bastionUserDataPath: "./userdata.yaml",
  bastionHostCreateElasticIp: stage === "prod",
});
