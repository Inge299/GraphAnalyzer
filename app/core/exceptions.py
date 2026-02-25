"""
Custom exceptions for OSINT Graph Analyzer.
"""

class SchemaValidationError(Exception):
    """Raised when schema validation fails."""
    pass

class GraphLockError(Exception):
    """Raised when graph is locked by another process."""
    pass

class NodeNotFoundError(Exception):
    """Raised when node is not found."""
    pass

class EdgeNotFoundError(Exception):
    """Raised when edge is not found."""
    pass
