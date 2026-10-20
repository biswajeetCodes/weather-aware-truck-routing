import requests

url = "http://127.0.0.1:8000/api/route-weather/"
data = {
    "origin": "New York",
    "destination": "Boston",
    "load_weight": 35000
}

response = requests.post(url, json=data)
print("Server ka Response:")
print(response.json())