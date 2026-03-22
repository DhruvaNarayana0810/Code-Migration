"""
backend/services/graph_service.py — Neo4j access layer
"""

import logging
from typing import List, Dict

from neo4j import GraphDatabase

logger = logging.getLogger("GraphService")


class GraphService:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def get_entity_count(self) -> int:
        with self.driver.session() as session:
            result = session.run("MATCH (e:Entity) RETURN count(e) AS count")
            return result.single()["count"]

    def get_graph_data(self) -> Dict:
        """
        Return Cytoscape.js-compatible nodes and edges.
        CRITICAL: edge source/target must exactly match node IDs.
        We use e.name as the canonical ID to keep it simple and consistent.
        """
        nodes = []
        edges = []
        seen_nodes = set()

        with self.driver.session() as session:
            # Collect all entities — use name as ID for consistency
            entity_result = session.run("""
                MATCH (e:Entity)
                RETURN e.id AS eid, e.name AS name, e.type AS type
            """)
            for record in entity_result:
                # Use name as the canonical node ID so edges can match reliably
                node_id = record["name"] or record["eid"]
                if not node_id or node_id in seen_nodes:
                    continue
                seen_nodes.add(node_id)
                nodes.append({
                    "data": {
                        "id": node_id,
                        "label": node_id,
                        "type": record["type"] or "unknown",
                    }
                })

            # Collect edges — source/target must match node IDs above
            edge_result = session.run("""
                MATCH (a:Entity)-[r:DEPENDS_ON]->(b:Entity)
                RETURN a.name AS source, b.name AS target, r.reason AS reason
            """)
            for record in edge_result:
                src = record["source"]
                tgt = record["target"]
                # Only include edge if both endpoints exist as nodes
                if src in seen_nodes and tgt in seen_nodes and src != tgt:
                    edges.append({
                        "data": {
                            "source": src,
                            "target": tgt,
                            "label": record["reason"] or "depends_on",
                        }
                    })

        logger.info(f"Graph: {len(nodes)} nodes, {len(edges)} edges")
        return {"nodes": nodes, "edges": edges}

    def get_dependency_coverage(self) -> float:
        with self.driver.session() as session:
            total = session.run("MATCH (e:Entity) RETURN count(e) AS c").single()["c"]
            if total == 0:
                return 0.0
            connected = session.run("""
                MATCH (e:Entity)
                WHERE (e)-[:DEPENDS_ON]->() OR ()-[:DEPENDS_ON]->(e)
                RETURN count(DISTINCT e) AS c
            """).single()["c"]
            return round(connected / total, 3)

    def clear_graph(self):
        with self.driver.session() as session:
            session.run("MATCH (e:Entity) DETACH DELETE e")
        logger.info("Graph cleared.")