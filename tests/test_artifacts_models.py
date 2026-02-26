# tests/test_artifacts_models.py
"""
Базовые тесты для моделей артефактов.
"""
import unittest
import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.pool import StaticPool
from sqlalchemy.types import TypeDecorator, TEXT

# Создаем Base до использования
Base = declarative_base()

# Создаем свой тип JSON для SQLite
class JSON(TypeDecorator):
    """Platform-independent JSON type."""
    impl = TEXT

    def load_dialect_impl(self, dialect):
        if dialect.name == 'sqlite':
            return dialect.type_descriptor(TEXT)
        else:
            return dialect.type_descriptor(self.impl)

    def process_bind_param(self, value, dialect):
        if value is not None:
            value = json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            value = json.loads(value)
        return value

# Создаем тестовую модель Project
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationship for tests
    artifacts = relationship("Artifact", back_populates="project", cascade="all, delete-orphan")

# Создаем тестовую модель Artifact
class Artifact(Base):
    __tablename__ = "artifacts"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    data = Column(JSON, nullable=False)  # Используем наш JSON тип
    artifact_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    project = relationship("Project", back_populates="artifacts")
    source_relations = relationship(
        "ArtifactRelation",
        foreign_keys="ArtifactRelation.source_id",
        back_populates="source",
        cascade="all, delete-orphan"
    )
    target_relations = relationship(
        "ArtifactRelation",
        foreign_keys="ArtifactRelation.target_id",
        back_populates="target",
        cascade="all, delete-orphan"
    )
    versions = relationship(
        "ArtifactVersion",
        back_populates="artifact",
        cascade="all, delete-orphan",
        order_by="ArtifactVersion.version.desc()"
    )

# Создаем тестовую модель ArtifactRelation
class ArtifactRelation(Base):
    __tablename__ = "artifact_relations"
    
    source_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True)
    target_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), primary_key=True)
    relation_type = Column(String(50), primary_key=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationships
    source = relationship("Artifact", foreign_keys=[source_id], back_populates="source_relations")
    target = relationship("Artifact", foreign_keys=[target_id], back_populates="target_relations")

# Создаем тестовую модель ArtifactVersion
class ArtifactVersion(Base):
    __tablename__ = "artifact_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    artifact_id = Column(Integer, ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)
    changed_at = Column(DateTime, server_default=func.now(), nullable=False)
    changed_by = Column(String(50), nullable=True)
    
    # Relationships
    artifact = relationship("Artifact", back_populates="versions")
    
    __table_args__ = (
        UniqueConstraint('artifact_id', 'version', name='uq_artifact_version'),
    )

class TestArtifactModels(unittest.TestCase):
    """Тесты для моделей артефактов."""
    
    @classmethod
    def setUpClass(cls):
        """Создаем тестовую БД один раз для всех тестов."""
        cls.engine = create_engine(
            'sqlite:///:memory:',  # Используем in-memory database
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )
        cls.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)
    
    def setUp(self):
        """Создаем таблицы перед каждым тестом."""
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()
    
    def tearDown(self):
        """Очищаем после каждого теста."""
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)
    
    def test_create_project_and_artifact(self):
        """Тест создания проекта и артефакта."""
        # Создаем проект
        project = Project(name="Test Project", description="Test Description")
        self.db.add(project)
        self.db.commit()
        
        # Проверяем проект
        self.assertIsNotNone(project.id)
        self.assertEqual(project.name, "Test Project")
        
        # Создаем артефакт
        artifact = Artifact(
            project_id=project.id,
            type="graph",
            name="Test Graph",
            description="Test Graph Description",
            data={
                "nodes": [
                    {"id": "1", "label": "Node 1"},
                    {"id": "2", "label": "Node 2"}
                ],
                "edges": [
                    {"from": "1", "to": "2", "label": "connects"}
                ]
            },
            artifact_metadata={"source": "test", "version": "1.0"}
        )
        self.db.add(artifact)
        self.db.commit()
        
        # Проверяем артефакт
        self.assertIsNotNone(artifact.id)
        self.assertEqual(artifact.type, "graph")
        self.assertEqual(artifact.name, "Test Graph")
        self.assertEqual(len(artifact.data["nodes"]), 2)
        self.assertEqual(len(artifact.data["edges"]), 1)
        self.assertEqual(artifact.artifact_metadata["source"], "test")
        
        # Проверяем связь с проектом
        self.assertEqual(len(project.artifacts), 1)
        self.assertEqual(project.artifacts[0].id, artifact.id)
    
    def test_artifact_relations(self):
        """Тест связей между артефактами."""
        # Создаем проект
        project = Project(name="Test Project")
        self.db.add(project)
        self.db.commit()
        
        # Создаем два артефакта
        source = Artifact(
            project_id=project.id,
            type="graph",
            name="Source Graph",
            data={}
        )
        target = Artifact(
            project_id=project.id,
            type="table",
            name="Derived Table",
            data={}
        )
        self.db.add_all([source, target])
        self.db.commit()
        
        # Создаем связь
        relation = ArtifactRelation(
            source_id=source.id,
            target_id=target.id,
            relation_type="derived_from"
        )
        self.db.add(relation)
        self.db.commit()
        
        # Проверяем связи через source
        self.assertEqual(len(source.source_relations), 1)
        self.assertEqual(source.source_relations[0].target_id, target.id)
        self.assertEqual(source.source_relations[0].relation_type, "derived_from")
        
        # Проверяем связи через target
        self.assertEqual(len(target.target_relations), 1)
        self.assertEqual(target.target_relations[0].source_id, source.id)
        
        # Проверяем прямой запрос
        saved_relation = self.db.query(ArtifactRelation).first()
        self.assertEqual(saved_relation.source_id, source.id)
        self.assertEqual(saved_relation.target_id, target.id)
    
    def test_artifact_versions(self):
        """Тест версионирования артефактов."""
        # Создаем проект и артефакт
        project = Project(name="Test Project")
        self.db.add(project)
        self.db.commit()
        
        artifact = Artifact(
            project_id=project.id,
            type="document",
            name="Test Doc",
            data={"content": "Version 1", "title": "Doc"}
        )
        self.db.add(artifact)
        self.db.commit()
        
        # Создаем несколько версий
        version1 = ArtifactVersion(
            artifact_id=artifact.id,
            version=1,
            data={"content": "Version 1", "title": "Doc"},
            changed_by="user"
        )
        version2 = ArtifactVersion(
            artifact_id=artifact.id,
            version=2,
            data={"content": "Version 2", "title": "Doc Updated"},
            changed_by="user"
        )
        self.db.add_all([version1, version2])
        self.db.commit()
        
        # Проверяем версии
        self.assertEqual(len(artifact.versions), 2)
        
        # Проверяем порядок (должен быть по убыванию версии)
        self.assertEqual(artifact.versions[0].version, 2)  # последняя версия первая
        self.assertEqual(artifact.versions[1].version, 1)
        
        # Проверяем данные версий
        self.assertEqual(artifact.versions[1].data["content"], "Version 1")
        self.assertEqual(artifact.versions[0].data["content"], "Version 2")
    
    def test_cascade_delete(self):
        """Тест каскадного удаления."""
        # Создаем проект
        project = Project(name="Test Project")
        self.db.add(project)
        self.db.commit()
        
        # Создаем артефакт
        artifact = Artifact(
            project_id=project.id,
            type="graph",
            name="To Delete",
            data={}
        )
        self.db.add(artifact)
        self.db.commit()
        
        # Добавляем версию
        version = ArtifactVersion(
            artifact_id=artifact.id,
            version=1,
            data={},
            changed_by="user"
        )
        self.db.add(version)
        self.db.commit()
        
        # Добавляем связь (сам с собой для простоты)
        relation = ArtifactRelation(
            source_id=artifact.id,
            target_id=artifact.id,
            relation_type="self"
        )
        self.db.add(relation)
        self.db.commit()
        
        # Удаляем артефакт
        self.db.delete(artifact)
        self.db.commit()
        
        # Проверяем что все связанное удалилось
        self.assertEqual(self.db.query(ArtifactVersion).count(), 0)
        self.assertEqual(self.db.query(ArtifactRelation).count(), 0)
        self.assertEqual(self.db.query(Artifact).count(), 0)
    
    def test_multiple_artifact_types(self):
        """Тест разных типов артефактов."""
        project = Project(name="Test Project")
        self.db.add(project)
        self.db.commit()
        
        # Создаем артефакты разных типов
        types = [
            ("graph", {"nodes": [], "edges": []}),
            ("table", {"columns": ["id", "name"], "rows": []}),
            ("map", {"center": [0, 0], "zoom": 10, "layers": []}),
            ("chart", {"type": "bar", "data": [1, 2, 3]}),
            ("document", {"content": "# Title", "format": "markdown"})
        ]
        
        for artifact_type, sample_data in types:
            artifact = Artifact(
                project_id=project.id,
                type=artifact_type,
                name=f"Test {artifact_type}",
                data=sample_data
            )
            self.db.add(artifact)
        
        self.db.commit()
        
        # Проверяем что все создались
        self.assertEqual(self.db.query(Artifact).count(), 5)
        
        # Проверяем фильтрацию по типу
        graphs = self.db.query(Artifact).filter(Artifact.type == "graph").all()
        self.assertEqual(len(graphs), 1)
        self.assertEqual(graphs[0].data["nodes"], [])

if __name__ == '__main__':
    unittest.main(verbosity=2)