"""Initial models

Revision ID: 001_initial_models
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '001_initial_models'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Projects table
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, onupdate=sa.func.now())
    )

    # Project schemas table
    op.create_table(
        'project_schemas',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('project_id', sa.Integer, sa.ForeignKey('projects.id', ondelete='CASCADE'), unique=True),
        sa.Column('schema_data', JSONB, nullable=False),
        sa.Column('version', sa.Integer, server_default='1'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, onupdate=sa.func.now())
    )

    # Node types cache
    op.create_table(
        'node_types',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('project_id', sa.Integer, sa.ForeignKey('projects.id', ondelete='CASCADE')),
        sa.Column('type_key', sa.String(100), nullable=False),
        sa.Column('display_name', sa.String(200)),
        sa.Column('color', sa.String(50)),
        sa.Column('icon', sa.String(100)),
        sa.Column('attribute_definitions', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint('project_id', 'type_key', name='uq_node_types_project_type')
    )
    op.create_index('ix_node_types_project', 'node_types', ['project_id'])

    # Edge types cache
    op.create_table(
        'edge_types',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('project_id', sa.Integer, sa.ForeignKey('projects.id', ondelete='CASCADE')),
        sa.Column('type_key', sa.String(100), nullable=False),
        sa.Column('display_name', sa.String(200)),
        sa.Column('from_types', JSONB, nullable=False),
        sa.Column('to_types', JSONB, nullable=False),
        sa.Column('attribute_definitions', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint('project_id', 'type_key', name='uq_edge_types_project_type')
    )
    op.create_index('ix_edge_types_project', 'edge_types', ['project_id'])

    # Graphs table
    op.create_table(
        'graphs',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('project_id', sa.Integer, sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('version', sa.Integer, server_default='1'),
        sa.Column('locked_by', sa.Integer),
        sa.Column('locked_at', sa.DateTime),
        sa.Column('lock_expires', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, onupdate=sa.func.now())
    )
    op.create_index('ix_graphs_project', 'graphs', ['project_id'])

    # Nodes table
    op.create_table(
        'nodes',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('graph_id', sa.Integer, sa.ForeignKey('graphs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('node_id', sa.String(100), nullable=False),
        sa.Column('type', sa.String(100), nullable=False),
        sa.Column('attributes', JSONB, nullable=False, server_default='{}'),
        sa.Column('position_x', sa.Float),
        sa.Column('position_y', sa.Float),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, onupdate=sa.func.now()),
        sa.UniqueConstraint('graph_id', 'node_id', name='uq_nodes_graph_node')
    )
    op.create_index('ix_nodes_graph_id', 'nodes', ['graph_id'])
    op.create_index('ix_nodes_type', 'nodes', ['type'])

    # Edges table
    op.create_table(
        'edges',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('graph_id', sa.Integer, sa.ForeignKey('graphs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('edge_id', sa.String(100), nullable=False),
        sa.Column('source_node', sa.String(100), nullable=False),
        sa.Column('target_node', sa.String(100), nullable=False),
        sa.Column('type', sa.String(100), nullable=False),
        sa.Column('attributes', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, onupdate=sa.func.now()),
        sa.UniqueConstraint('graph_id', 'edge_id', name='uq_edges_graph_edge')
    )
    op.create_index('ix_edges_graph_id', 'edges', ['graph_id'])
    op.create_index('ix_edges_type', 'edges', ['type'])
    op.create_index('ix_edges_source', 'edges', ['graph_id', 'source_node'])
    op.create_index('ix_edges_target', 'edges', ['graph_id', 'target_node'])

def downgrade():
    op.drop_table('edges')
    op.drop_table('nodes')
    op.drop_table('graphs')
    op.drop_table('edge_types')
    op.drop_table('node_types')
    op.drop_table('project_schemas')
    op.drop_table('projects')
