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

    const { vpc, stage, version, jwksUrl} = props;

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
      // set instance type to t3.micro if stage is test, otherwise t3.small
      instanceType: stage === "test" ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO) : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
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

    // create data access role and let the stac-ingestor-api-role assume it. 
    const dataAccessRole = new iam.Role(this, "data-access-role", {assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")});
    
    // grant the data access role permissions to list and get s3 objects
    dataAccessRole.addToPolicy(
    new iam.PolicyStatement({
        actions: ["s3:Get*", "s3:List*"],
        resources: ["arn:aws:s3:::*"],
    })
    );

    const stacIngestor = new StacIngestor(this, "stac-ingestor", {
      vpc,
      stacUrl: url,
      dataAccessRole,
      stage,
      stacDbSecret: pgstacSecret,
      stacDbSecurityGroup: db.connections.securityGroups[0],
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      apiEnv: {
        JWKS_URL: jwksUrl,
        REQUESTER_PAYS: "true",
      }
    });

    const allow_policy = new iam.PolicyStatement({
          actions: ['sts:AssumeRole'],
          principals: [stacIngestor.handlerRole],
          effect: iam.Effect.ALLOW
        });
    
    dataAccessRole.assumeRolePolicy?.addStatements(allow_policy);
  
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
   * Flag to control whether the Bastion Host should make a non-dynamic elastic IP.
   */
  bastionHostCreateElasticIp?: boolean;

  /**
   * URL of JWKS endpoint, provided as output from ASDI-Auth.
   *
   * Example: "https://cognito-idp.{region}.amazonaws.com/{region}_{userpool_id}/.well-known/jwks.json"
   */
  jwksUrl: string;

}
        