import {
  Stack,
  StackProps,
  aws_apigateway as apigateway,
  aws_iam as iam,
  aws_ec2 as ec2,
  aws_rds as rds,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  BastionHost,
  PgStacApiLambda,
  PgStacDatabase,
  StacIngestor,
} from "cdk-pgstac";
import { readFileSync } from "fs";

export class PgStacInfra extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { vpc, stage, version } = props;

    const { db, pgstacSecret } = new PgStacDatabase(this, "pgstac-db", {
      vpc,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_14,
      }),
      vpcSubnets: {
        subnetType: props.dbSubnetPublic
          ? ec2.SubnetType.PUBLIC
          : ec2.SubnetType.PRIVATE_ISOLATED,
      },
      allocatedStorage: 1024,
      instanceType: new ec2.InstanceType('t3.small')
    });

    const apiSubnetSelection: ec2.SubnetSelection = {
      subnetType: props.dbSubnetPublic
        ? ec2.SubnetType.PUBLIC
        : ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    const { url } = new PgStacApiLambda(this, "pgstac-api", {
      apiEnv: {
        NAME: `MAAP STAC API (${stage})`,
        VERSION: version,
        DESCRIPTION: "STAC API for the MAAP STAC system.",
      },
      vpc,
      db,
      dbSecret: pgstacSecret,
      subnetSelection: apiSubnetSelection,
    });

    new BastionHost(this, "bastion-host", {
      vpc,
      db,
      ipv4Allowlist: props.bastionIpv4AllowList,
      userData: ec2.UserData.custom(
        readFileSync(props.bastionUserDataPath, { encoding: "utf-8" })
      ),
      createElasticIp: props.bastionHostCreateElasticIp,
    });

    const apiResourcePolicy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: ['execute-api:Invoke'],
          principals: [new iam.AnyPrincipal()],
          resources: ['execute-api:/*/*/*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.DENY,
          principals: [new iam.AnyPrincipal()],
          actions: ['execute-api:Invoke'],
          resources: ['execute-api:/*/*/*'],
          conditions: {
            'NotIpAddress': {
              "aws:SourceIp": props.ingestorApiGatewayIpv4AllowList
            }
          }
        })
      ]
    })

    new StacIngestor(this, "stac-ingestor", {
      vpc,
      stacUrl: url,
      dataAccessRoleArn: props.dataAccessRoleArn,
      stacIngestorRoleArn: props.stacIngestorRoleArn,
      stage,
      stacDbSecret: pgstacSecret,
      stacDbSecurityGroup: db.connections.securityGroups[0],
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      apiEnv: {
        REQUESTER_PAYS: "true",
      },
      apiPolicy: apiResourcePolicy
    });
  
  }
}

export interface Props extends StackProps {
  vpc: ec2.Vpc;

  /**
   * Stage this stack. Used for naming resources.
   */
  stage: string;

  /**
   * Version of this stack. Used to correlate codebase versions
   * to services running.
   */
  version: string;

  /**
   * Flag to control whether database should be deployed into a
   * public subnet.
   */
  dbSubnetPublic?: boolean;

  /**
   * Where userdata.yaml is found.
   */
  bastionUserDataPath: string;

  /**
   * Which IPs to allow to access bastion host.
   */
  bastionIpv4AllowList: string[];

  /**
   * Which IPs to allow to access the ingestor API gatew
   */
  ingestorApiGatewayIpv4AllowList: string[];

  /**
   * Flag to control whether the Bastion Host should make a non-dynamic elastic IP.
   */
  bastionHostCreateElasticIp?: boolean;

  /**
   * ARN of AWS Role used to validate access to S3 data. 
   */
  dataAccessRoleArn: string;

  /**
   * ARN of AWS Role to be used by the ingestor API lambda. Must have permissions to
   * assume the role represented by `dataAccessRoleArn` along with `service-role/AWSLambdaBasicExecutionRole` 
   * and `service-role/AWSLambdaVPCAccessExecutionRole` managed policies.
   */
  stacIngestorRoleArn: string;

}
        