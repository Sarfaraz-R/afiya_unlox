from langgraph.graph import END, START, StateGraph

from app.graph.nodes import extract_node, severity_impact_node, validate_node
from app.graph.state import PipelineState

_graph_builder = StateGraph(PipelineState)
_graph_builder.add_node("extract", extract_node)
_graph_builder.add_node("assess", severity_impact_node)
_graph_builder.add_node("validate", validate_node)

_graph_builder.add_edge(START, "extract")
_graph_builder.add_edge("extract", "assess")
_graph_builder.add_edge("assess", "validate")
_graph_builder.add_edge("validate", END)

compiled_graph = _graph_builder.compile()


def run_pipeline(raw_text: str, current_fields: dict | None = None) -> PipelineState:
    return compiled_graph.invoke({"raw_text": raw_text, "current_fields": current_fields or {}})
