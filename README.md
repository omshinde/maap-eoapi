# MAAP STAC Infrastructure

## Deployment

### Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template

## Components

### VPC

The VPC is configured with three subnets:

| Name        | Type                                                                                                                         | Description                                                                                    | CIDR mask |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| ingress     | [`PUBLIC`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html#public)                           | Can connect to the Internet and can be connected to from the Internet.                         | 24        |
| application | [`PRIVATE_WITH_EGRESS`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html#private_with_egress) | Can connect to the Internet, but will not allow connections to be initiated from the Internet. | 24        |
| rds         | [`PRIVATE_ISOLATED`](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.SubnetType.html#private_isolated)       | Can only connect to or be connected to from other instances in the same VPC.                   | 28        |

### Bastion Host

The database is located in an isolated subnet, meaning that it is not accessible from the public internet. As such, to interact with the database directly, a user must tunnel through a bastion host.

#### Configuring

This codebase controls _who_ is allowed to connect to the bastion host. This requires two steps:

1. Adding the IP address from which you are connecting to the `ipv4Allowlist` array
1. Creating a bastion host system user by adding the user's configuration inform to `userdata.yaml`

##### Adding an IP address to the `ipv4Allowlist` array

The `BastionHost` construct takes in an `ipv4Allowlist` array as an argument. Find your IP address (eg `curl api.ipify.org`) and add that to the array along with the trailing CIDR block (likely `/32` to indicate that you are adding a single IP address).

##### Creating a user via `userdata.yaml`

Add an entry to the `users` array with a username (likely matching your local systems username, which you can get by running the `whoami` command in your terminal) and a public key (likely your default public key, which you can get by running `cat ~/.ssh/id_*.pub` in your terminal).

<details>

<summary>Tips & Tricks when using the Bastion Host</summary>

##### Connecting to RDS Instance via SSM

```sh
aws ssm start-session --target $INSTANCE_ID \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters '{
        "host": [
            "example-db.c5abcdefghij.us-west-2.rds.amazonaws.com"
        ],
        "portNumber": [
            "5432"
        ],
        "localPortNumber": [
            "9999"
        ]
    }' \
    --profile $AWS_PROFILE
```

```sh
psql -h localhost -p 9999 # continue adding username (-U) and db (-d) here...
```

Connect directly to Bastion Host:

```sh
aws ssm start-session --target $INSTANCE_ID --profile $AWS_PROFILE
```

##### Setting up an SSH tunnel

In your `~/.ssh/config` file, add an entry like:

```
Host db-tunnel
  Hostname {the-bastion-host-address}
  LocalForward 54322 {the-db-hostname}:5432
```

Then a tunnel can be opened via:

```
ssh -N db-tunnel
```

And a connection to the DB can be made via:

```
psql -h 127.0.0.1 -p 5433 -U {username} -d {database}
```

##### Handling `REMOTE HOST IDENTIFICATION HAS CHANGED!` error

If you've redeployed a bastion host that you've previously connected to, you may see an error like:

```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!
Someone could be eavesdropping on you right now (man-in-the-middle attack)!
It is also possible that a host key has just been changed.
The fingerprint for the ECDSA key sent by the remote host is
SHA256:mPnxAOXTpb06PFgI1Qc8TMQ2e9b7goU8y2NdS5hzIr8.
Please contact your system administrator.
Add correct host key in /Users/username/.ssh/known_hosts to get rid of this message.
Offending ECDSA key in /Users/username/.ssh/known_hosts:28
ECDSA host key for ec2-12-34-56-789.us-west-2.compute.amazonaws.com has changed and you have requested strict checking.
Host key verification failed.
```

This is due to the server's fingerprint changing. We can scrub the fingerprint from our system with a command like:

```
ssh-keygen -R 12.34.56.789
```

</details>
