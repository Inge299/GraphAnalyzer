# app/core/exceptions.py
"""
Custom exceptions for the application.
"""

class BaseAppError(Exception):
    """Base exception for application errors."""
    pass

# ============================================================================
# Schema validation errors
# ============================================================================

class ValidationError(BaseAppError):
    """Raised when validation fails."""
    pass

class SchemaValidationError(ValidationError):
    """Raised when schema validation fails."""
    pass

# ============================================================================
# Artifact errors
# ============================================================================

class ArtifactNotFoundError(BaseAppError):
    """Raised when an artifact is not found."""
    pass

class RelationNotFoundError(BaseAppError):
    """Raised when a relation is not found."""
    pass

class VersionNotFoundError(BaseAppError):
    """Raised when a version is not found."""
    pass

# ============================================================================
# History errors
# ============================================================================

class HistoryError(BaseAppError):
    """Raised when history/undo/redo operations fail."""
    pass

class NoActionsToUndoError(HistoryError):
    """Raised when trying to undo but no actions available."""
    pass

class NoActionsToRedoError(HistoryError):
    """Raised when trying to redo but no actions available."""
    pass

# ============================================================================
# Plugin errors
# ============================================================================

class PluginError(BaseAppError):
    """Raised when plugin execution fails."""
    pass

class PluginNotFoundError(PluginError):
    """Raised when a plugin is not found."""
    pass

class PluginExecutionError(PluginError):
    """Raised when plugin execution fails."""
    pass

# ============================================================================
# Database errors
# ============================================================================

class DatabaseError(BaseAppError):
    """Raised when database operations fail."""
    pass

class IntegrityError(DatabaseError):
    """Raised when database integrity is violated."""
    pass

# ============================================================================
# Project errors
# ============================================================================

class ProjectNotFoundError(BaseAppError):
    """Raised when a project is not found."""
    pass

class GraphNotFoundError(BaseAppError):
    """Raised when a graph is not found."""
    pass

class NodeNotFoundError(BaseAppError):
    """Raised when a node is not found."""
    pass

class EdgeNotFoundError(BaseAppError):
    """Raised when an edge is not found."""
    pass
