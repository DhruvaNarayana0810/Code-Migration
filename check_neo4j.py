"""Check what's in Neo4j database"""
from neo4j import GraphDatabase
import json

uri = "bolt://127.0.0.1:7687"
user = "neo4j"
password = "omnamahshivaya"

driver = GraphDatabase.driver(uri, auth=(user, password))

with driver.session() as session:
    # Get all entities with their properties
    result = session.run("""
        MATCH (e:Entity)
        RETURN e.name AS name, e.type AS type, e.body AS body, e.file AS file
        LIMIT 10
    """)
    
    for record in result:
        entity = dict(record)
        print(f"\nEntity: {entity['name']}")
        print(f"  Type: {entity['type']}")
        print(f"  File: {entity['file']}")
        body_preview = entity['body'][:100] if entity['body'] else "NULL"
        print(f"  Body: {body_preview}...")
        
driver.close()
