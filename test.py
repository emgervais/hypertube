import pytest
import requests

base_url = "http://localhost:8080"

def make_request(url):
    response = requests.post(base_url+url, json={
        "username": "testa",
        "password": "test",
        "email": "test",
        "lastname": "test",
        "firstname": "test",
        "picture": "test"
    })
    return response

def test_register():

    response = make_request("/user")
    print(response.text)
    print(response.status_code)

test_register()