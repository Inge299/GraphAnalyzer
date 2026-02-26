# app/core/exceptions.py
"""
Custom exceptions for OSINT Graph Analyzer.
"""

class SchemaValidationError(Exception):
    """Raised when schema validation fails."""
    pass

class ValidationError(Exception):
    """Raised when data validation fails."""
    pass

class ArtifactNotFoundError(Exception):
    """Raised when artifact is not found."""
    pass

class RelationNotFoundError(Exception):
    """Raised when relation is not found."""
    pass

class VersionNotFoundError(Exception):
    """Raised when version is not found."""
    pass