import {
  Stack,
  StackProps,
  aws_certificatemanager as acm,
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
  TitilerPgstacApiLambda,
  StacIngestorProps,
  TitilerPgStacApiLambdaProps,
  PgStacApiLambdaProps,
} from "../eoapi-cdk/lib";

import { DomainName } from "@aws-cdk/aws-apigatewayv2-alpha";
import { readFileSync } from "fs";
import { load } from "js-yaml";

export class PgStacInfra extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { vpc, stage, version, jwksUrl, dataAccessRoleArn, allocatedStorage, titilerBucketsPath} = props;

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
      allocatedStorage: allocatedStorage,
      // set instance type to t3.micro if stage is test, otherwise t3.small
      instanceType: stage === "test" ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO) : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
    });

    const apiSubnetSelection: ec2.SubnetSelection = {
      subnetType: props.dbSubnetPublic
        ? ec2.SubnetType.PUBLIC
        : ec2.SubnetType.PRIVATE_WITH_EGRESS,
    };

    console.log("stacApiDomainName: ", 
      props.stacApiCustomDomainName,
      props.stacApiRegionalDomainName,
      props.stacApiRegionalHostedZoneId
    );
    console.log("titilerPgstacApiDomainName: ",
      props.titilerPgStacApiCustomDomainName,
      props.titilerPgStacApiRegionalDomainName,
      props.titilerPgStacApiRegionalHostedZoneId
    )
    let stacApiProps: PgStacApiLambdaProps = {
      apiEnv: {
        NAME: `MAAP STAC API (${stage})`,
        VERSION: version,
        DESCRIPTION: "STAC API for the MAAP STAC system.",
      },
      vpc,
      db,
      dbSecret: pgstacSecret,
      subnetSelection: apiSubnetSelection,
    };

    if (
      props.stacApiCustomDomainName
      && props.stacApiRegionalDomainName
      && props.stacApiRegionalHostedZoneId
    ) {
      const existingDomain = DomainName.fromDomainNameAttributes(this, 'stac-api-domain-name', {
        name: props.stacApiCustomDomainName,
        regionalDomainName: props.stacApiRegionalDomainName,
        regionalHostedZoneId: props.stacApiRegionalHostedZoneId,
      });
  
      stacApiProps = {
        ...stacApiProps,
        stacApiDomainName: existingDomain,
      };
    }

    const stacApiLambda = new PgStacApiLambda(this, "pgstac-api", stacApiProps);

    stacApiLambda.stacApiLambdaFunction.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: props.stacApiIntegrationApiArn,
    });

    const fileContents = readFileSync(titilerBucketsPath, 'utf8')
    const buckets = load(fileContents) as string[];

    let titilerPgstacProps: TitilerPgStacApiLambdaProps = {
      apiEnv: {
        NAME: `MAAP titiler pgstac API (${stage})`,
        VERSION: version,
        DESCRIPTION: "titiler pgstac API for the MAAP STAC system.",
      },
      vpc,
      db,
      dbSecret: pgstacSecret,
      subnetSelection: apiSubnetSelection,
      buckets: buckets,
    };

    if (
      props.titilerPgStacApiCustomDomainName
      && props.titilerPgStacApiRegionalDomainName
      && props.titilerPgStacApiRegionalHostedZoneId
    ) {
      const existingDomain = DomainName.fromDomainNameAttributes(this, 'titiler-pgstac-domain-name', {
        name: props.titilerPgStacApiCustomDomainName,
        regionalDomainName: props.titilerPgStacApiRegionalDomainName,
        regionalHostedZoneId: props.titilerPgStacApiRegionalHostedZoneId,
      });

      titilerPgstacProps = {
        ...titilerPgstacProps,
        titilerPgstacApiDomainName: existingDomain
      };
    }
    new TitilerPgstacApiLambda(this, "titiler-pgstac-api", titilerPgstacProps);

    new BastionHost(this, "bastion-host", {
      vpc,
      db,
      ipv4Allowlist: props.bastionIpv4AllowList,
      userData: ec2.UserData.custom(
        readFileSync(props.bastionUserDataPath, { encoding: "utf-8" })
      ),
      createElasticIp: props.bastionHostCreateElasticIp,
    });

    
    const dataAccessRole = iam.Role.fromRoleArn(this, "data-access-role", dataAccessRoleArn);

    let stacIngestorProps: StacIngestorProps = {
      vpc,
      stacUrl: stacApiLambda.url,
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
      },
    };

    if (props.IngestorDomainName && props.certificateArn) {
      stacIngestorProps = {
        ...stacIngestorProps,
        ingestorDomainNameOptions: {
          domainName: props.IngestorDomainName,
          certificate: acm.Certificate.fromCertificateArn(
            this,
            "ingestorCustomDomainNameCertificate",
            props.certificateArn
          ),
        },
      };
    }

   new StacIngestor(this, "stac-ingestor", stacIngestorProps);
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

  /**
   * ARN of IAM role that will be assumed by the STAC Ingestor.
   */
  dataAccessRoleArn: string;

  /**
   * STAC API api gateway source ARN to be granted STAC API lambda invoke permission.
   */
  stacApiIntegrationApiArn: string;

  /**
   * allocated storage for pgstac database
   */
  allocatedStorage: number;

  /**
   * yaml file containing the list of buckets the titiler lambda should be granted access to
   */
  titilerBucketsPath: string;

  /**
   * ARN of ACM certificate to use for CDN.
   * Example: "arn:aws:acm:us-west-2:123456789012:certificate/12345678-1234-1234-1234-123456789012"
  */
  certificateArn?: string | undefined;

  /**
   * Domain name to use for CDN.
   * Example: "stac.maap.xyz"
  */
  IngestorDomainName?: string | undefined;


  /**
   * Domain name to use for titiler pgstac api.
   * Example: "titiler-pgstac-api.dit.maap-project.org"
   */
  titilerPgStacApiCustomDomainName?: string | undefined;
  titilerPgStacApiRegionalDomainName?: string | undefined;
  titilerPgStacApiRegionalHostedZoneId?: string | undefined;

  /**
   * Domain name to use for stac api.
   * Example: "stac-api.dit.maap-project.org""
   */
  stacApiCustomDomainName?: string | undefined;
  stacApiRegionalDomainName?: string | undefined;
  stacApiRegionalHostedZoneId?: string | undefined;
}
