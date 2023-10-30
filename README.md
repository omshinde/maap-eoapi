# MAAP eoapi

## Overview

This repository contains the AWS CDK code (written in typescript) used to deploy the MAAP project eoapi infrastructure. It is based on the [eoapi-template example](https://github.com/developmentseed/eoapi-template). For the MAAP use case, we use a subset of the eoapi CDK constructs to define a database, an ingestion API, a STAC API, a raster API (i.e a tiling API) and a bastion host for direct connections to the database. Here, we deploy all these components into a custom VPC. 

## Automated Deployment

Deployment happens through a github workflow manually triggered and defined in `.github/workflows/deploy.yaml`.

## Networking and accessibility of the database. 

Because of security requirements, the networking set up imposes the following constraints : 

- For security reasons, the database is in a _private_ subnet of the VPC. As such, only instances running inside of the same VPC can access the database. This means that, for example, even if a user has the password and her IP is allowed inbound connections to the database, access will _not_ be allowed. 

This has three consequences : 

1. The APIs that need access to the database (the STAC API, the tiling API, the ingestion API) need to be deployed in that same VPC. 
2. In addition, because these APIs _also_ sometimes need access to the internet, a NAT gateway must in addition be deployed in that VPC. 
3. For direct, administrative connections to the database, one _must_ go through an instance placed in the same VPC as the database. 

We approach (3) by re-using the 'bastion host' eoAPI construct, which deploys an EC2 instance that can connect to the database, and can be used to create a tunnel from a user's machine to the database. See the eoAPI docs for more information. 


## Ingestion

The term "ingestion" refers to the process of cataloging data in the STAC catalog associated with this deployment. 

### Direct ingestion

For a small record ingestion (for example a collection record or just one item), one can directly connect to the database and perform loading. This can be done using the `pypgstac` library. For example, to load an item stored locally in `test_item.json`, with `pypgstac` installed, you can run the following command : 

```
pypgstac load --table items test_item.json
```

or for a collection

```
pypgstac load --table collections test_collection.json
```

This requires 

1. that you are allowed to connect to the database. Because of the security requirements mentioned above, you must go through a tunnel using the bastion host. [See these docs for more details](https://developmentseed.org/eoapi-cdk/#bastionhost-)
2. [the configuration](https://stac-utils.github.io/pgstac/pypgstac/) for the database connection is present in your environment. 


### Indirect ingestion through the ingestion pipeline deployment

For larger scale ingestions (a lot of items, for example), in MAAP we defined an approach where we : 
1. First develop a python module that builds a STAC item out of a single input. It can be conformant to the [stactools-packages](https://github.com/stactools-packages) framework, or be as simple as [this example.](https://github.com/MAAP-Project/tri_seasonal_s1_sar_composites).
2. Define an AWS lambda function that runs this module, an AWS queue where the lambda takes tasks from, and a file listing the tasks that fills the queue. 

[This set up can be found here, defined as code](https://github.com/MAAP-Project/stac-pipeline).


