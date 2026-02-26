# alembic/versions/002_add_artifacts_tables.py
"""Add artifacts tables

Revision ID: 002
Revises: 001_initial_models
Create Date: 2026-02-24 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001_initial_models'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Создание таблицы artifacts
    op.create_table('artifacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('data', JSONB(), nullable=False),
        sa.Column('artifact_metadata', JSONB(), nullable=True),  # Переименовано
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_artifacts_project_id', 'artifacts', ['project_id'])
    op.create_index('ix_artifacts_type', 'artifacts', ['type'])
    
    # Создание таблицы artifact_relations
    op.create_table('artifact_relations',
        sa.Column('source_id', sa.Integer(), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('relation_type', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['source_id'], ['artifacts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_id'], ['artifacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('source_id', 'target_id', 'relation_type')
    )
    
    # Создание таблицы artifact_versions
    op.create_table('artifact_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('artifact_id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('data', JSONB(), nullable=False),
        sa.Column('changed_at', sa.DateTime(), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('changed_by', sa.String(50), nullable=True),
        sa.ForeignKeyConstraint(['artifact_id'], ['artifacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('artifact_id', 'version', name='uq_artifact_version')
    )
    op.create_index('ix_artifact_versions_artifact_id', 'artifact_versions', ['artifact_id'])
    
    # Миграция данных: переносим все graphs в artifacts
    op.execute("""
        INSERT INTO artifacts (project_id, type, name, description, data, artifact_metadata, created_at, updated_at)
        SELECT 
            g.project_id,
            'graph' as type,
            g.name,
            g.description,
            jsonb_build_object(
                'graph_id', g.graph_id,
                'nodes', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'node_id', n.node_id,
                                'type', n.type,
                                'attributes', n.attributes,
                                'position_x', n.position_x,
                                'position_y', n.position_y
                            )
                        )
                        FROM nodes n
                        WHERE n.graph_id = g.id
                    ),
                    '[]'::jsonb
                ),
                'edges', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'edge_id', e.edge_id,
                                'source_node', e.source_node,
                                'target_node', e.target_node,
                                'type', e.type,
                                'attributes', e.attributes
                            )
                        )
                        FROM edges e
                        WHERE e.graph_id = g.id
                    ),
                    '[]'::jsonb
                )
            ) as data,
            jsonb_build_object(
                'migrated_from', 'graph',
                'original_graph_id', g.id
            ) as artifact_metadata,
            g.created_at,
            g.updated_at
        FROM graphs g
    """)
    
    # Создаем VIEW для обратной совместимости
    op.execute("""
        CREATE VIEW graphs_view AS
        SELECT 
            g.id,
            a.id as artifact_id,
            g.project_id,
            g.name,
            g.description,
            g.created_at,
            g.updated_at,
            (a.data->>'graph_id') as graph_id
        FROM graphs g
        JOIN artifacts a ON 
            a.project_id = g.project_id 
            AND a.type = 'graph' 
            AND a.artifact_metadata->>'original_graph_id' = g.id::text
    """)

def downgrade() -> None:
    # Удаляем VIEW
    op.execute("DROP VIEW IF EXISTS graphs_view")
    
    # Удаляем таблицы
    op.drop_table('artifact_versions')
    op.drop_table('artifact_relations')
    op.drop_table('artifacts')