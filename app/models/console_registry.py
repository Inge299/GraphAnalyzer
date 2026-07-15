"""
Registry models for console artifacts backed by external stored procedures.
"""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ConsoleDataSource(Base):
    __tablename__ = "console_data_sources"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    dbms = Column(String(50), nullable=False, default="mssql")
    driver = Column(String(100), nullable=False, default="pymssql")
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False, default=1433)
    database_name = Column(String(255), nullable=False)
    auth_type = Column(String(50), nullable=False, default="sql")
    username = Column(String(255), nullable=True)
    password = Column(Text, nullable=True)
    options_json = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    procedures = relationship(
        "ConsoleProcedureProfile",
        back_populates="data_source",
        cascade="all, delete-orphan",
    )


class ConsoleProcedureProfile(Base):
    __tablename__ = "console_procedure_profiles"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), nullable=False, unique=True, index=True)
    source_id = Column(Integer, ForeignKey("console_data_sources.id", ondelete="CASCADE"), nullable=False)
    schema_name = Column(String(255), nullable=False, default="dbo")
    procedure_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    timeout_seconds = Column(Integer, nullable=False, default=120)
    default_row_limit = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    supports_graph_selection = Column(Boolean, nullable=False, default=False)
    result_contract_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    data_source = relationship("ConsoleDataSource", back_populates="procedures")
    params = relationship(
        "ConsoleProcedureParam",
        back_populates="procedure",
        cascade="all, delete-orphan",
        order_by="ConsoleProcedureParam.position.asc(), ConsoleProcedureParam.id.asc()",
    )
    result_sets = relationship(
        "ConsoleResultSetMapping",
        back_populates="procedure",
        cascade="all, delete-orphan",
        order_by="ConsoleResultSetMapping.position.asc(), ConsoleResultSetMapping.result_index.asc(), ConsoleResultSetMapping.id.asc()",
    )

    __table_args__ = (
        UniqueConstraint("source_id", "schema_name", "procedure_name", name="uq_console_source_procedure"),
    )


class ConsoleProcedureParam(Base):
    __tablename__ = "console_procedure_params"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("console_procedure_profiles.id", ondelete="CASCADE"), nullable=False)
    param_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False, default="string")
    is_required = Column(Boolean, nullable=False, default=False)
    default_value = Column(Text, nullable=True)
    binding_mode = Column(String(50), nullable=False, default="manual")
    binding_source = Column(String(100), nullable=True)
    binding_config = Column(JSONB, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    is_hidden = Column(Boolean, nullable=False, default=False)

    procedure = relationship("ConsoleProcedureProfile", back_populates="params")

    __table_args__ = (
        UniqueConstraint("profile_id", "param_name", name="uq_console_profile_param_name"),
    )


class ConsoleResultSetMapping(Base):
    __tablename__ = "console_result_set_mappings"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("console_procedure_profiles.id", ondelete="CASCADE"), nullable=False)
    result_index = Column(Integer, nullable=False)
    result_key = Column(String(100), nullable=True)
    display_name = Column(String(255), nullable=False)
    is_visible = Column(Boolean, nullable=False, default=True)
    position = Column(Integer, nullable=False, default=0)

    procedure = relationship("ConsoleProcedureProfile", back_populates="result_sets")
    columns = relationship(
        "ConsoleResultColumnMapping",
        back_populates="result_set",
        cascade="all, delete-orphan",
        order_by="ConsoleResultColumnMapping.position.asc(), ConsoleResultColumnMapping.id.asc()",
    )

    __table_args__ = (
        UniqueConstraint("profile_id", "result_index", name="uq_console_profile_result_index"),
    )


class ConsoleResultColumnMapping(Base):
    __tablename__ = "console_result_column_mappings"

    id = Column(Integer, primary_key=True, index=True)
    result_set_id = Column(Integer, ForeignKey("console_result_set_mappings.id", ondelete="CASCADE"), nullable=False)
    column_name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    data_type = Column(String(50), nullable=False, default="string")
    width = Column(Integer, nullable=True)
    is_visible = Column(Boolean, nullable=False, default=True)
    position = Column(Integer, nullable=False, default=0)

    result_set = relationship("ConsoleResultSetMapping", back_populates="columns")

    __table_args__ = (
        UniqueConstraint("result_set_id", "column_name", name="uq_console_result_column_name"),
    )


class ConsoleObjectTypeMapping(Base):
    __tablename__ = "console_object_type_mappings"

    id = Column(Integer, primary_key=True, index=True)
    graph_type = Column(String(100), nullable=False, unique=True, index=True)
    procedure_type = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
