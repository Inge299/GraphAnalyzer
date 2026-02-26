#!/usr/bin/env python3
"""
OSINT Graph Analyzer - Project Handoff Package Generator
Создает полный слепок проекта для передачи новой LLM
Запуск: python generate_handoff.py /path/to/project
"""

import os
import sys
import json
import hashlib
import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import subprocess

class ProjectHandoffGenerator:
    def __init__(self, project_path: str):
        self.project_path = Path(project_path).resolve()
        self.output = {
            "timestamp": datetime.datetime.now().isoformat(),
            "project_name": "OSINT Graph Analyzer",
            "version": "v1.0",
            "files": {},
            "structure": {},
            "statistics": {},
            "key_files_content": {},
            "architecture": {},
            "decisions": [],
            "status": {},
            "next_steps": [],
            "open_questions": [],
            "api_endpoints": [],
            "database_schema": [],
            "dependencies": {}
        }
        
    def scan_directory(self, path: Path, relative_to: Path, max_file_size: int = 1024 * 1024):
        """Рекурсивно сканирует директорию и собирает информацию о файлах"""
        structure = {}
        
        try:
            for item in sorted(path.iterdir()):
                if item.name.startswith(('.', '__pycache__', 'node_modules', 'dist', 'build')):
                    continue
                    
                rel_path = item.relative_to(relative_to)
                
                if item.is_dir():
                    structure[item.name] = self.scan_directory(item, relative_to, max_file_size)
                else:
                    ext = item.suffix.lower()
                    if ext in ['.py', '.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md', '.sql', '.yml', '.yaml', '.env.example']:
                        try:
                            if item.stat().st_size <= max_file_size:
                                with open(item, 'r', encoding='utf-8') as f:
                                    content = f.read()
                                    lines = content.count('\n') + 1
                                    
                                file_hash = hashlib.md5(content.encode()).hexdigest()[:8]
                                
                                file_info = {
                                    'path': str(rel_path),
                                    'size': item.stat().st_size,
                                    'lines': lines,
                                    'hash': file_hash,
                                    'extension': ext,
                                }
                                
                                self.output['files'][str(rel_path)] = file_info
                                
                                # Сохраняем содержимое ключевых файлов отдельно
                                if self._is_key_file(str(rel_path)):
                                    self.output['key_files_content'][str(rel_path)] = {
                                        'content': content,
                                        'lines': lines,
                                        'hash': file_hash
                                    }
                                
                                structure[item.name] = f"[FILE] {lines} lines"
                            else:
                                structure[item.name] = f"[FILE] {item.stat().st_size} bytes (skipped, too large)"
                        except Exception as e:
                            structure[item.name] = f"[ERROR] {str(e)}"
                    else:
                        structure[item.name] = f"[BINARY] {item.stat().st_size} bytes"
                        
        except Exception as e:
            print(f"Error scanning {path}: {e}")
            
        return structure
    
    def _is_key_file(self, path: str) -> bool:
        """Определяет, является ли файл ключевым для понимания проекта"""
        key_patterns = [
            'app/main.py',
            'app/config.py',
            'app/database.py',
            'app/models/',
            'app/api/routes/',
            'app/services/schema_service.py',
            'frontend/src/App.tsx',
            'frontend/src/store/',
            'frontend/src/components/views/GraphView.tsx',
            'docker-compose.yml',
            'Dockerfile',
            'requirements.txt',
            'frontend/package.json',
        ]
        
        return any(pattern in path for pattern in key_patterns)
    
    def collect_architecture_info(self):
        """Собирает информацию об архитектуре проекта"""
        # Определяем технологии по файлам
        tech_stack = {
            'backend': [],
            'frontend': [],
            'database': [],
            'infrastructure': []
        }
        
        if any('fastapi' in str(f) for f in self.output['files']):
            tech_stack['backend'].append('FastAPI')
        if any('sqlalchemy' in str(f) for f in self.output['files']):
            tech_stack['backend'].append('SQLAlchemy')
        if any('react' in str(f) for f in self.output['files']):
            tech_stack['frontend'].append('React')
        if any('redux' in str(f) for f in self.output['files']):
            tech_stack['frontend'].append('Redux')
        if any('vis-network' in str(f) for f in self.output['files']):
            tech_stack['frontend'].append('vis-network')
        if any('postgres' in str(f) for f in self.output['files']):
            tech_stack['database'].append('PostgreSQL')
        if any('redis' in str(f) for f in self.output['files']):
            tech_stack['database'].append('Redis')
        if any('docker' in str(f) for f in self.output['files']):
            tech_stack['infrastructure'].append('Docker')
            
        self.output['architecture']['tech_stack'] = tech_stack
    
    def collect_dependencies(self):
        """Собирает информацию о зависимостях"""
        # Python зависимости
        req_path = self.project_path / 'requirements.txt'
        if req_path.exists():
            with open(req_path, 'r') as f:
                self.output['dependencies']['python'] = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        
        # Node зависимости
        package_path = self.project_path / 'frontend' / 'package.json'
        if package_path.exists():
            with open(package_path, 'r') as f:
                package = json.load(f)
                self.output['dependencies']['node'] = {
                    'dependencies': package.get('dependencies', {}),
                    'devDependencies': package.get('devDependencies', {})
                }
    
    def collect_api_endpoints(self):
        """Пытается найти и распарсить API эндпоинты из роутов"""
        routes_dir = self.project_path / 'app' / 'api' / 'routes'
        if routes_dir.exists():
            endpoints = []
            for route_file in routes_dir.glob('*.py'):
                if route_file.name.startswith('__'):
                    continue
                with open(route_file, 'r') as f:
                    content = f.read()
                    # Простой парсинг для обнаружения эндпоинтов
                    lines = content.split('\n')
                    for line in lines:
                        if '@router.' in line and '(' in line:
                            endpoints.append({
                                'file': route_file.name,
                                'signature': line.strip()
                            })
            self.output['api_endpoints'] = endpoints
    
    def collect_database_schema(self):
        """Собирает информацию о моделях БД"""
        models_dir = self.project_path / 'app' / 'models'
        if models_dir.exists():
            schema = []
            for model_file in models_dir.glob('*.py'):
                if model_file.name.startswith('__'):
                    continue
                with open(model_file, 'r') as f:
                    content = f.read()
                    # Ищем классы SQLAlchemy
                    lines = content.split('\n')
                    for line in lines:
                        if 'class' in line and '(Base)' in line:
                            schema.append({
                                'file': model_file.name,
                                'class': line.replace('class', '').strip()
                            })
            self.output['database_schema'] = schema
    
    def add_architectural_decisions(self):
        """Добавляет ключевые архитектурные решения"""
        self.output['decisions'] = [
            {
                "decision": "Гибкая мета-модель через JSONB",
                "reason": "Пользователь должен определять типы узлов без изменения кода",
                "location": "app/models/schema.py, app/services/schema_service.py"
            },
            {
                "decision": "JSONB для атрибутов узлов и ребер",
                "reason": "Разные типы имеют разные атрибуты",
                "location": "app/models/node.py, app/models/edge.py"
            },
            {
                "decision": "Batch операции для производительности",
                "reason": "Вставка 1000 узлов должна быть <2 секунд",
                "location": "app/api/routes/nodes.py (/batch)"
            },
            {
                "decision": "Кэширование типов в отдельных таблицах",
                "reason": "Быстрый доступ без парсинга JSON",
                "location": "app/models/schema.py (NodeType, EdgeType)"
            }
        ]
    
    def add_status(self):
        """Добавляет текущий статус проекта"""
        self.output['status'] = {
            "backend_models": "100% - полностью функционально",
            "api_endpoints": "100% - все CRUD операции",
            "validation": "100% - проверка типов, обязательных полей",
            "docker": "100% - работает docker-compose up",
            "frontend_layout": "100% - вкладки, сайдбар, инспектор",
            "visualization": "100% - vis-network, перетаскивание",
            "redux": "100% - все слайсы работают"
        }
    
    def add_next_steps(self):
        """Добавляет следующие шаги (Phase 2)"""
        self.output['next_steps'] = [
            {
                "phase": "2.1",
                "name": "Модель артефактов",
                "description": "Создать таблицы artifacts, relations, history",
                "status": "0%"
            },
            {
                "phase": "2.2",
                "name": "API артефактов",
                "description": "Универсальные CRUD для артефактов",
                "status": "0%"
            },
            {
                "phase": "2.3",
                "name": "Рефакторинг фронтенда",
                "description": "artifactsSlice вместо graphSlice",
                "status": "0%"
            },
            {
                "phase": "2.4",
                "name": "Новые типы",
                "description": "Таблицы, карты, диаграммы",
                "status": "0%"
            },
            {
                "phase": "2.5",
                "name": "Интеграция плагинов",
                "description": "Плагины создают артефакты",
                "status": "0%"
            }
        ]
    
    def add_open_questions(self):
        """Добавляет открытые вопросы"""
        self.output['open_questions'] = [
            "Как организовать версионирование артефактов? Полное копирование или дельты?",
            "Нужен ли Celery для плагинов >10 секунд?",
            "Нужен ли полнотекстовый поиск по JSONB?",
            "Как визуализировать историю изменений?"
        ]
    
    def calculate_statistics(self):
        """Рассчитывает статистику по проекту"""
        total_files = len(self.output['files'])
        total_lines = sum(f.get('lines', 0) for f in self.output['files'].values())
        
        # Группировка по расширениям
        by_type = {}
        for f in self.output['files'].values():
            ext = f.get('extension', 'unknown')
            by_type[ext] = by_type.get(ext, 0) + 1
        
        self.output['statistics'] = {
            'total_files': total_files,
            'total_lines': total_lines,
            'by_type': by_type
        }
    
    def generate_markdown(self) -> str:
        """Генерирует Markdown версию для LLM"""
        md = []
        
        md.append("=" * 77)
        md.append(f"🎯 ПРОЕКТ: {self.output['project_name']}")
        md.append(f"📅 Дата: {self.output['timestamp']}")
        md.append(f"📌 Версия: {self.output['version']}")
        md.append("=" * 77)
        md.append("")
        
        # Статистика
        md.append("📊 СТАТИСТИКА")
        md.append("-" * 50)
        md.append(f"- Всего файлов: {self.output['statistics'].get('total_files', 0)}")
        md.append(f"- Строк кода: {self.output['statistics'].get('total_lines', 0)}")
        md.append(f"- Python файлов: {self.output['statistics'].get('by_type', {}).get('.py', 0)}")
        md.append(f"- TypeScript/JS: {self.output['statistics'].get('by_type', {}).get('.tsx', 0) + self.output['statistics'].get('by_type', {}).get('.ts', 0)}")
        md.append("")
        
        # Архитектура
        md.append("🏗 АРХИТЕКТУРА")
        md.append("-" * 50)
        for category, items in self.output['architecture'].get('tech_stack', {}).items():
            md.append(f"- {category}: {', '.join(items)}")
        md.append("")
        
        # Ключевые решения
        md.append("🔑 КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ")
        md.append("-" * 50)
        for decision in self.output['decisions']:
            md.append(f"📌 {decision['decision']}")
            md.append(f"   └── Причина: {decision['reason']}")
            md.append(f"   └── Где: {decision['location']}")
        md.append("")
        
        # Статус
        md.append("✅ ТЕКУЩИЙ СТАТУС")
        md.append("-" * 50)
        for item, status in self.output['status'].items():
            md.append(f"- {item}: {status}")
        md.append("")
        
        # Следующие шаги
        md.append("🚀 СЛЕДУЮЩИЕ ШАГИ (Phase 2)")
        md.append("-" * 50)
        for step in self.output['next_steps']:
            md.append(f"📌 Этап {step['phase']}: {step['name']}")
            md.append(f"   └── {step['description']}")
            md.append(f"   └── Статус: {step['status']}")
        md.append("")
        
        # Открытые вопросы
        md.append("❓ ОТКРЫТЫЕ ВОПРОСЫ")
        md.append("-" * 50)
        for q in self.output['open_questions']:
            md.append(f"- {q}")
        md.append("")
        
        # Структура проекта
        md.append("📁 СТРУКТУРА ПРОЕКТА")
        md.append("-" * 50)
        md.append("```")
        md.append(json.dumps(self.output['structure'], indent=2, ensure_ascii=False))
        md.append("```")
        md.append("")
        
        # Ключевые файлы
        if self.output['key_files_content']:
            md.append("🔧 КЛЮЧЕВЫЕ ФАЙЛЫ (с содержимым)")
            md.append("-" * 50)
            for path, info in list(self.output['key_files_content'].items())[:10]:  # Ограничиваем до 10 файлов
                md.append(f"\n--- {path} (hash: {info['hash']}) ---")
                md.append(f"// размер: {info['lines']} строк")
                md.append(info['content'])
        
        return "\n".join(md)
    
    def generate(self):
        """Генерирует полный пакет передачи"""
        print(f"🔍 Сканирование проекта: {self.project_path}")
        
        # Сканируем структуру
        self.output['structure'] = self.scan_directory(self.project_path, self.project_path)
        
        # Собираем информацию
        self.collect_architecture_info()
        self.collect_dependencies()
        self.collect_api_endpoints()
        self.collect_database_schema()
        self.add_architectural_decisions()
        self.add_status()
        self.add_next_steps()
        self.add_open_questions()
        self.calculate_statistics()
        
        print(f"✅ Найдено файлов: {self.output['statistics']['total_files']}")
        print(f"✅ Строк кода: {self.output['statistics']['total_lines']}")
        print(f"✅ Ключевых файлов: {len(self.output['key_files_content'])}")
        
        return self.output
    
    def save(self, output_dir: str = "."):
        """Сохраняет результаты в файлы"""
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Сохраняем JSON
        json_path = output_path / "handoff_latest.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.output, f, indent=2, ensure_ascii=False)
        print(f"✅ JSON сохранен: {json_path}")
        
        # Сохраняем Markdown
        md_path = output_path / "handoff_latest.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(self.generate_markdown())
        print(f"✅ Markdown сохранен: {md_path}")
        
        # Сохраняем короткую версию для быстрого старта
        quick_path = output_path / "handoff_quick.md"
        with open(quick_path, 'w', encoding='utf-8') as f:
            f.write(self.generate_quick_summary())
        print(f"✅ Quick summary сохранен: {quick_path}")
    
    def generate_quick_summary(self) -> str:
        """Генерирует краткую версию для быстрого старта"""
        md = []
        
        md.append(f"# OSINT Graph Analyzer - Quick Handoff")
        md.append(f"**Дата:** {self.output['timestamp']}")
        md.append(f"**Версия:** {self.output['version']}")
        md.append("")
        
        md.append("## 🎯 Current Status")
        for item, status in list(self.output['status'].items())[:5]:
            md.append(f"- ✅ {item}: {status}")
        md.append("")
        
        md.append("## 🚀 Next Step")
        if self.output['next_steps']:
            next_step = self.output['next_steps'][0]
            md.append(f"**{next_step['phase']}: {next_step['name']}**")
            md.append(f"> {next_step['description']}")
        md.append("")
        
        md.append("## 🔑 Key Files")
        for path in list(self.output['key_files_content'].keys())[:5]:
            md.append(f"- `{path}`")
        
        return "\n".join(md)


def main():
    """Основная функция"""
    print("=" * 80)
    print("🚀 OSINT Graph Analyzer - Project Handoff Generator")
    print("=" * 80)
    
    # Получаем путь к проекту
    if len(sys.argv) > 1:
        project_path = sys.argv[1]
    else:
        project_path = input("Введите путь к проекту (или Enter для текущей папки): ").strip()
        if not project_path:
            project_path = "."
    
    # Проверяем существование
    if not os.path.exists(project_path):
        print(f"❌ Путь не существует: {project_path}")
        sys.exit(1)
    
    # Генерируем пакет
    generator = ProjectHandoffGenerator(project_path)
    generator.generate()
    
    # Спрашиваем куда сохранить
    output_dir = input("Куда сохранить результаты (Enter для текущей папки): ").strip()
    if not output_dir:
        output_dir = "."
    
    generator.save(output_dir)
    
    print("\n" + "=" * 80)
    print("✅ ПАКЕТ ПЕРЕДАЧИ ГОТОВ!")
    print("=" * 80)
    print("\n📄 Созданы файлы:")
    print("  - handoff_latest.json  (полные данные в JSON)")
    print("  - handoff_latest.md    (полный отчет в Markdown)")
    print("  - handoff_quick.md     (краткое резюме для быстрого старта)")
    print("\n🎯 Используй handoff_latest.md для передачи новой LLM")
    print("=" * 80)


if __name__ == "__main__":
    main()