#import statements
import requests
import pystac
from pystac import STACValidationError, ItemCollection
import boto3
import json

#Create a test collection for ingesting
test_collection = {
    "id":"test_collection",
    "type":"Collection",
    "links": [],
    "title":"Test Collection",
    "extent": {
        "spatial": {
            "bbox": [
                [
                    -180, 51.6, 180, 78
                ]
            ]
        },
        "temporal": {
            "interval": [
              [
                "2019-01-01T00:00:00.000Z",
                "2021-01-01T00:00:00.000Z"
              ]
            ]
          }        
    },
    "license":"CC-BY",
    "description":"Test collection",
    "item_assets": {
        "tif": {
            "type":"image/tiff; application=geotiff; profile=cloud-optimized",
            "roles": [
                "data",
                "layer"
            ],
            "title":"Test collection",
            "description":"Test collection"
        },
        "csv": {
            "type":"text/csv",
            "roles": [
                "data"
            ],
            "title":"CSV",
            "description":"Test collection"
        }        
    },
    "stac_version":"1.0.0"
}

#Creating a test item for ingestion to test collection
test_item = {
    "type": "Feature",
    "id": "test_item1",
    "stac_version":"1.0.0",
    "collection": "test_collection",
    "links":[{"rel":"collection","type":"application/json","href":"https://stac.test.maap-project.org/collections/test_collection"},{"rel":"parent","type":"application/json","href":"https://stac.test.maap-project.org/collections/test_collection"},{"rel":"root","type":"application/json","href":"https://stac.maap-project.org/"},{"rel":"self","type":"application/geo+json","href":"https://stac.test.maap-project.org/collections/test_collection/items/test_item1"}],
    "bbox":[-78.40290984426046,51.07724585591961,-77.04127077089376,51.92130718597872],
    "assets":{"csv":{"href":"s3://nasa-maap-data-store/file-staging/nasa-map/icesat2-boreal/boreal_agb_202302031675450345_0177_train_data.csv","type":"text/csv","roles":["data"],"title":"CSV","description":"CSV of training data"},"tif":{"href":"s3://nasa-maap-data-store/file-staging/nasa-map/icesat2-boreal/boreal_agb_202302031675450345_0177.tif","type":"image/tiff; application=geotiff; profile=cloud-optimized","roles":["data"],"title":"Cloud Optimized GeoTIFF of boreal data","description":"Cloud Optimized GeoTIFF of boreal data","raster:bands":[{"scale":1.0,"nodata":-9999.0,"offset":0.0,"sampling":"area","data_type":"float32","histogram":{"max":105.78067016601562,"min":7.345508575439453,"count":11,"buckets":[2194,2380,972,469,298,184,85,30,8,4]},"statistics":{"mean":25.281058933423914,"stddev":13.868902983070951,"maximum":105.78067016601562,"minimum":7.345508575439453,"valid_percent":0.6317138671875}},{"scale":1.0,"nodata":-9999.0,"offset":0.0,"sampling":"area","data_type":"float32","histogram":{"max":60.75077819824219,"min":1.4587666988372803,"count":11,"buckets":[5140,1167,250,42,14,4,3,1,2,1]},"statistics":{"mean":5.982097533589976,"stddev":3.7930746502586974,"maximum":60.75077819824219,"minimum":1.4587666988372803,"valid_percent":0.6317138671875}}]}},
    "properties":{"datetime":"2023-02-15T00:00:00+00:00","proj:bbox":[4598521.999999994,5643304.000000009,4688521.999999994,5733304.000000009],"proj:shape":[3000,3000],"proj:geometry":{"type":"Polygon","coordinates":[[[4598521.999999994,5643304.000000009],[4688521.999999994,5643304.000000009],[4688521.999999994,5733304.000000009],[4598521.999999994,5733304.000000009],[4598521.999999994,5643304.000000009]]]},"proj:transform":[30.0,0.0,4598521.999999994,0.0,-30.0,5733304.000000009,0.0,0.0,1.0]},
    "stac_extensions":["https://stac-extensions.github.io/projection/v1.1.0/schema.json","https://stac-extensions.github.io/raster/v1.1.0/schema.json"],
    "geometry":{"type":"Polygon","coordinates":[[[14.114837413118664,67.218607039971],[12.438229073696998,67.70894310918132],[11.17860397724852,67.06631312684836],[12.837754767891637,66.58867761064732],[14.114837413118664,67.218607039971]]]}
}


#Validating the test collection
try:
    pystac.validation.validate_dict(test_collection)
    print("Valid test collection")
except:
    raise STACValidationError

#Validating the test item
try:
    pystac.validation.validate_dict(test_item)
    print("Valid test item")
except:
    raise STACValidationError

#Authentication - Get secret value
stage = "dev"
stac_register_service_id = "MAAP-workflows-EsykqB"
stack_name = f"MAAP-STAC-auth-{stage}"

# session = boto3.session.Session()
client = boto3.client("secretsmanager", region_name='us-west-2')
secret_id = f"{stack_name}/{stac_register_service_id}"

try:
    res_secret = client.get_secret_value(SecretId=secret_id)
except client.exceptions.ResourceNotFoundException:
    raise Exception(
        f"Unable to find a secret for '{secret_id}'. "
        "\n\nHint: Check your stage and service id. Also, verify that the correct "
        "AWS_PROFILE is set on your environment."
    )

#Authentication - Get TOKEN
client_secret = json.loads(res_secret["SecretString"])
client_id = ""
cognito_domain = "https://maap-stac-auth-dev.auth.us-west-2.amazoncognito.com"
scope = "MAAP-STAC-ingestion-registry-server/stac:register"

res_token = requests.post(
            f"{cognito_domain}/oauth2/token",
            headers={
                "Content-Type":"application/x-www-form-urlencoded",
            },
            auth=(client_id, client_secret),
            data={
                "grant_type":"client_credentials",
                # A space-separated list of scopes to request for the generated access token.
                "scope": scope,
            },
        )

TOKEN = res_token.json()["access_token"]

#Insert the test collection
session = requests.Session()
base_url = "https://wynt4rero2.execute-api.us-west-2.amazonaws.com/test"
end_point = "/collections"

r_coll = requests.post(base_url+end_point, json=test_collection, headers={"Authorization": f"bearer {TOKEN}"})
print(r_coll.json())

#Insert the test item
item_end_point = "/ingestions"

r_item = requests.post(base_url+item_end_point, json=test_item, headers={"Authorization": f"bearer {TOKEN}"})
print(r_item.json())

#Querying and verification
#Get request to test the collection endpoint for the published collection
base_url = "https://stac.test.maap-project.org"
collections_end_point = "/collections/"

ingested_collected_id = "test_collection"
req = requests.get(base_url+collections_end_point+f"/{ingested_collected_id}")

#for validation
if req.status_code == 200:
    res_collection = req.json()
    collection_id = req.json()["id"]
    print(req.text)

#If response is 200 then check for items
if req.status_code == 200:
    req_item = requests.get(base_url+collections_end_point+f"/{collection_id}/items")
    res_item = req_item.json()
    print(res_item)

#Testing for valid STAC collection
try:
    pystac.validation.validate_dict(res_collection)
    print(f"***** TEST Successful for collection - {res_collection['id']} *****")
except:
    raise STACValidationError

#Testing for valid STAC items in  the test collection
item_collection: ItemCollection = res_item["features"]

for item1 in item_collection:
    print(item1)
    try:
        pystac.validation.validate_dict(item1)
        print(f"***** TEST Successful for item - {item1['id']} *****")
    except:
        raise STACValidationError
      
print("Tests complete!")
