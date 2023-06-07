import {
  Stack,
  StackProps,
  aws_ec2 as ec2,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  PgStacDatabase,
} from "cdk-pgstac";

export class PgStacInfra extends Stack {

  db: rds.DatabaseInstance
  pgstacSecret: secretsmanager.ISecret

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const vpc = props.vpc;

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
      instanceType: props.stage === "test" ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO) : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
    });

    this.db = db;
    this.pgstacSecret = pgstacSecret;

  }
}

export interface Props extends StackProps {
  /**
   * VPC to deploy the database into.
   */
  vpc: ec2.Vpc;

  /**
   * Stage this stack. Used for naming resources.
   */
  stage: string;

  /**
   * Flag to control whether database should be deployed into a
   * public subnet.
   */
  dbSubnetPublic?: boolean;
  
}
        