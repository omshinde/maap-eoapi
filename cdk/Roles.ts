import {
    Stack,
    aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class Roles extends Stack {

    public readonly dataAccessRoleArn : string;
    public readonly stacIngestorApiRoleArn : string;

    constructor(scope: Construct, id: string) {
        super(scope, id);
        
        // create the stac ingestor API role. 
        const stacIngestorApiRole = new iam.Role(this, "stac-ingestor-api-role", {
            description:
                "Role used by STAC Ingestor.",
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                "service-role/AWSLambdaBasicExecutionRole",
                ),
                iam.ManagedPolicy.fromAwsManagedPolicyName(
                "service-role/AWSLambdaVPCAccessExecutionRole",
                ),
            ],
            });

        // create data access role and let the stac-ingestor-api-role assume it. 
        const dataAccessRole = new iam.Role(this, "data-access-role", {assumedBy: stacIngestorApiRole});

        // grant the data access role permissions to list and get s3 objects
        dataAccessRole.addToPolicy(
        new iam.PolicyStatement({
            actions: ["s3:Get*", "s3:List*"],
            resources: ["arn:aws:s3:::*"],
        })
        );

        this.dataAccessRoleArn = dataAccessRole.roleArn;
        this.stacIngestorApiRoleArn = stacIngestorApiRole.roleArn;

    }
}
  
 
  