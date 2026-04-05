"""Test the entity-info endpoint"""
import requests
import json

# Test the graph endpoint
response = requests.get('http://localhost:8000/graph')
if response.status_code == 200:
    data = response.json()
    print(f"✓ Graph: {len(data['nodes'])} nodes, {len(data['edges'])} edges")
    if data['nodes']:
        first_node = data['nodes'][0]['data']['label']
        print(f"  First node: {first_node}")
        
        # Test entity-info endpoint with this node
        entity_response = requests.get(f'http://localhost:8000/entity-info?entity_name={first_node}')
        print(f"\n✓ Entity Info Response Status: {entity_response.status_code}")
        try:
            entity_data = entity_response.json()
            print(f"  Response JSON: {json.dumps(entity_data, indent=2)}")
        except Exception as e:
            print(f"  Error parsing JSON: {e}")
            print(f"  Raw response: {entity_response.text[:200]}")
else:
    print(f"✗ Graph endpoint error: {response.status_code}")
