# alembic/versions/003_add_graph_actions.py
"""Add graph_actions table for undo/redo

Revision ID: 003_add_graph_actions
Revises: 002_add_artifacts_tables
Create Date: 2026-03-12 19:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

# revision identifiers, used by Alembic.
revision = '003_add_graph_actions'
down_revision = '002_add_artifacts_tables'
branch_labels = None
depends_on = None

def upgrade():
    # Создаем таблицу graph_actions
    op.create_table(
        'graph_actions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('graph_id', sa.Integer(), sa.ForeignKey('graphs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('before_state', JSONB, nullable=False),
        sa.Column('after_state', JSONB, nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('user_type', sa.String(20), nullable=False, server_default='user'),
        sa.Column('description', sa.String(200)),
        sa.Column('plugin_id', sa.String(100)),
        sa.Column('group_id', UUID(as_uuid=True)),
    )
    
    # Создаем индексы
    op.create_index(
        'ix_graph_actions_graph_timestamp',
        'graph_actions',
        ['graph_id', 'timestamp'],
        unique=False
    )
    op.create_index(
        'ix_graph_actions_group',
        'graph_actions',
        ['group_id'],
        unique=False
    )
    op.create_index(
        'ix_graph_actions_graph_id',
        'graph_actions',
        ['graph_id'],
        unique=False
    )

def downgrade():
    op.drop_table('graph_actions')
