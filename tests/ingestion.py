import requests
import json
import pystac
from pystac import STACValidationError
import os
import boto3
from dotenv import load_dotenv

load_dotenv()

class StacIngestion:

    """Class representing various test operations"""

    def __init__(self):
        self.base_url = os.getenv("BASE_URL")
        self.stac_url = os.getenv("STAC_URL")
        self.collections_endpoint = os.getenv("COLLECTIONS_ENDPOINT")
        self.items_endpoint = os.getenv("ITEMS_ENDPOINT")
        self.current_file_path = os.path.dirname(os.path.abspath(__file__))

    def validate_collection(self, collection):
        try:
            pystac.validation.validate_dict(collection)
        except STACValidationError:
            raise STACValidationError("Validation failed for the collection")

    def validate_item(self, item):
        try:
            pystac.validation.validate_dict(item)
        except STACValidationError:
            raise STACValidationError("Validation failed for the item")

    def get_authentication_token(self):
        #Authentication - Get secret value
        stage = os.getenv("STAGE")
        stac_register_service_id = os.getenv("STAC_REGISTER_SERVICE_ID")
        stack_name = f"MAAP-STAC-auth-{stage}"

        # session = boto3.session.Session()
        client = boto3.client("secretsmanager", region_name=os.getenv("REGION_NAME"))
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
        secret = json.loads(res_secret["SecretString"])
        client_secret = secret["client_secret"]
        client_id = secret["client_id"]
        cognito_domain = os.getenv("COGNITO_DOMAIN")
        scope = os.getenv("SCOPE")

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

        authentication_token = res_token.json()["access_token"]
        return authentication_token

    def insert_collection(self, authentication_token, collection):
        headers = {"Authorization": f"bearer {authentication_token}"}
        response = requests.post(self.base_url + self.collections_endpoint, json=collection, headers=headers)
        return response

    def insert_item(self, authentication_token, item):
        headers = {"Authorization": f"bearer {authentication_token}"}
        response = requests.post(self.base_url + self.items_endpoint, json=item, headers=headers)
        return response

    def query_collection(self, collection_id):
        response = requests.get(self.stac_url + self.collections_endpoint + f"/{collection_id}")
        return response

    def query_items(self, collection_id):
        response = requests.get(self.stac_url + self.collections_endpoint + f"/{collection_id}/items")
        return response

    def get_test_collection(self):
        with open(os.path.join(self.current_file_path, 'fixtures', 'test_collection.json'), 'r') as f:
            test_collection = json.load(f)        
        return test_collection

    def get_test_item(self):
        print(os.getcwd())
        with open(os.path.join(self.current_file_path, 'fixtures', 'test_item.json'), 'r') as f:
            test_item = json.load(f)
        return test_item