"""Test the bug-risk and suggest-improvements endpoints"""
import requests
import json

def test_endpoint(name, url, data):
    print(f"\nTesting {name}...")
    try:
        response = requests.post(url, json=data, timeout=30)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Keys: {list(result.keys())}")
            print("✓ SUCCESS")
            return True
        else:
            print(f"✗ Error: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception: {e}")
        return False

# Test data
data = {"path": "workdir/repo"}

# Test backend directly
print("=== Testing Backend Directly ===")
test_endpoint("Bug Risk (backend)", "http://localhost:8000/bug-risk", data)
test_endpoint("Suggest Improvements (backend)", "http://localhost:8000/suggest-improvements", data)

# Test through frontend proxy
print("\n=== Testing Through Frontend Proxy ===")
test_endpoint("Bug Risk (proxy)", "http://localhost:3002/bug-risk", data)
test_endpoint("Suggest Improvements (proxy)", "http://localhost:3002/suggest-improvements", data)