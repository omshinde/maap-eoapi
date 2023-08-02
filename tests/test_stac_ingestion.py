import pytest
import pystac
from pystac import STACValidationError

# Test validating the collection
def test_validate_collection(test_collection):
    try:
        pystac.validation.validate_dict(test_collection)
    except STACValidationError:
        pytest.fail("Validation failed for test_collection")


# Test validating the item
def test_validate_item(test_item):
    try:
        pystac.validation.validate_dict(test_item)
    except STACValidationError:
        pytest.fail("Validation failed for test_item")


# Test inserting collection
def test_insert_collection(
    stac_ingestion_instance, authentication_token, test_collection
):
    response = stac_ingestion_instance.insert_collection(
        authentication_token, test_collection
    )
    assert response.status_code in [200, 201], "Failed to insert the test_collection"


# Test inserting item
def test_insert_item(stac_ingestion_instance, authentication_token, test_item):
    response = stac_ingestion_instance.insert_item(authentication_token, test_item)
    assert response.status_code in [200, 201], "Failed to insert the test_item"


# Test querying collection and verifying inserted collection
def test_query_collection(stac_ingestion_instance, test_collection):
    response = stac_ingestion_instance.query_collection(test_collection["id"])
    assert response.status_code in [200, 201], "Failed to query the test_collection"
    assert (
        response.json()["id"] == test_collection["id"]
    ), "Queried collection does not match the inserted collection"


# Test querying items and verifying inserted items
def test_query_items(stac_ingestion_instance, test_collection, test_item):
    response = stac_ingestion_instance.query_items(test_collection["id"])
    assert response.status_code in [200, 201], "Failed to query the items"
    items = response.json()["features"]
    assert any(
        item["id"] == test_item["id"] for item in items
    ), f"Inserted item {test_item} \n not found in the queried items {items}"


# Run the tests
if __name__ == "__main__":
    pytest.main()
