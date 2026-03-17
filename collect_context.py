#!/usr/bin/env python3
"""
Script to collect additional context for LLM about OSINT Graph Analyzer project.
Run this before handing off to the agent.
"""

import os
import json
import subprocess
from datetime import datetime
from pathlib import Path

OUTPUT_FILE = "handoff_context_extra.json"

def run_cmd(cmd):
    """Run shell command and return output."""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return {
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {"error": "Command timed out", "success": False}
    except Exception as e:
        return {"error": str(e), "success": False}

def get_file_content(path):
    """Get file content if exists."""
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return None
    except Exception as e:
        return f"Error reading file: {str(e)}"

def main():
    print(f"📊 Collecting additional context for LLM...")
    
    # ИНИЦИАЛИЗИРУЕМ ВСЕ СЛОВАРИ
    context = {
        "timestamp": datetime.now().isoformat(),
        "files": {},
        "database": {},
        "docker": {},
        "git": {},
        "environment": {},
        "api": {},
        "system": {}  # 👈 БЫЛО ПРОПУЩЕНО!
    }
    
    # 1. Критические файлы для проверки
    critical_files = [
        "app/models/action.py",
        "app/api/routes/history.py",
        "app/schemas/action.py",
        "app/services/history_cache.py",
        "frontend/src/hooks/useActionWithUndo.ts",
        "frontend/src/hooks/useKeyboardShortcuts.ts",
        "frontend/src/store/slices/historySlice.ts",
        "frontend/src/components/history/HistoryPanel.tsx",
        "frontend/src/components/history/HistoryPanel.css",
        "frontend/src/components/views/GraphView.tsx",
        "alembic/versions/",
        "alembic/env.py",
        "alembic.ini"
    ]
    
    print("📁 Reading critical files...")
    for filepath in critical_files:
        full_path = Path(filepath)
        if full_path.exists():
            if full_path.is_dir():
                # Для директорий - список файлов
                try:
                    files = [str(f) for f in full_path.glob("*")]
                    context["files"][filepath] = {
                        "type": "directory",
                        "contents": files,
                        "count": len(files)
                    }
                except Exception as e:
                    context["files"][filepath] = {"error": f"Error reading directory: {str(e)}"}
            else:
                try:
                    content = get_file_content(filepath)
                    context["files"][filepath] = {
                        "type": "file",
                        "content": content,
                        "size": full_path.stat().st_size,
                        "modified": datetime.fromtimestamp(full_path.stat().st_mtime).isoformat()
                    }
                except Exception as e:
                    context["files"][filepath] = {"error": f"Error reading file: {str(e)}"}
        else:
            context["files"][filepath] = {"error": "File not found"}
    
    # 2. Состояние базы данных
    print("🐘 Checking PostgreSQL...")
    
    # Проверяем, запущен ли PostgreSQL
    pg_check = run_cmd("docker-compose ps postgres | grep Up")
    if pg_check["success"]:
        # Проверяем таблицы
        tables_check = run_cmd("docker-compose exec -T postgres psql -U osint_user -d osint_db -c \"\\dt\"")
        context["database"]["tables"] = tables_check.get("stdout", "Failed to get tables")
        
        # Проверяем alembic_version
        alembic_check = run_cmd("docker-compose exec -T postgres psql -U osint_user -d osint_db -c \"SELECT * FROM alembic_version;\"")
        context["database"]["alembic_version"] = alembic_check.get("stdout", "Failed to get alembic version")
        
        # Проверяем структуру graph_actions (если существует)
        actions_check = run_cmd("docker-compose exec -T postgres psql -U osint_user -d osint_db -c \"\\d graph_actions\"")
        context["database"]["graph_actions_schema"] = actions_check.get("stdout", "Table graph_actions might not exist")
        
        # Проверяем структуру artifacts
        artifacts_check = run_cmd("docker-compose exec -T postgres psql -U osint_user -d osint_db -c \"\\d artifacts\"")
        context["database"]["artifacts_schema"] = artifacts_check.get("stdout", "Table artifacts might not exist")
    else:
        context["database"]["error"] = "PostgreSQL container not running"
    
    # 3. Docker статус
    print("🐳 Checking Docker containers...")
    docker_ps = run_cmd("docker-compose ps")
    context["docker"]["containers"] = docker_ps.get("stdout", "Failed to get container status")
    
    # Проверяем логи app контейнера (если есть)
    docker_logs = run_cmd("docker-compose logs --tail=50 app 2>/dev/null || echo 'App container not found'")
    context["docker"]["app_logs"] = docker_logs.get("stdout", "No app logs")
    
    # Проверяем логи postgres
    pg_logs = run_cmd("docker-compose logs --tail=20 postgres 2>/dev/null")
    context["docker"]["postgres_logs"] = pg_logs.get("stdout", "No postgres logs")
    
    # 4. Git статус (чтобы видеть незакоммиченные изменения)
    print("📦 Checking Git status...")
    git_status = run_cmd("git status")
    context["git"]["status"] = git_status.get("stdout", "Not a git repo")
    
    git_diff = run_cmd("git diff")
    context["git"]["diff"] = git_diff.get("stdout", "No changes")
    
    git_branch = run_cmd("git branch --show-current")
    context["git"]["branch"] = git_branch.get("stdout", "Unknown").strip()
    
    # 5. Проверка API (если бэкенд запущен)
    print("🌐 Checking API health...")
    health_check = run_cmd("curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/health")
    if health_check["success"] and health_check["stdout"] == "200":
        context["api"]["health"] = "OK"
        # Получаем список проектов для проверки
        projects_check = run_cmd("curl -s http://localhost:5000/api/v1/projects")
        context["api"]["projects"] = projects_check.get("stdout", "Failed to get projects")
    else:
        context["api"]["health"] = f"Backend not accessible (HTTP {health_check.get('stdout', 'N/A')})"
    
    # 6. Версии зависимостей
    print("📦 Checking dependencies...")
    if Path("requirements.txt").exists():
        context["environment"]["requirements"] = get_file_content("requirements.txt")
    
    if Path("frontend/package.json").exists():
        package_json = get_file_content("frontend/package.json")
        if package_json:
            try:
                pkg = json.loads(package_json)
                context["environment"]["frontend_deps"] = {
                    "dependencies": pkg.get("dependencies", {}),
                    "devDependencies": pkg.get("devDependencies", {})
                }
            except json.JSONDecodeError:
                context["environment"]["frontend_deps"] = "Invalid package.json"
            except Exception as e:
                context["environment"]["frontend_deps"] = f"Error parsing: {str(e)}"
    
    # 7. Последние ошибки из логов (если есть)
    print("🔍 Checking for errors...")
    error_logs = run_cmd("docker-compose logs --tail=200 app 2>/dev/null | grep -i error || true")
    context["docker"]["app_errors"] = error_logs.get("stdout", "No recent errors")
    
    # 8. Проверка портов
    print("🔌 Checking ports...")
    
    # Пробуем разные команды для проверки портов
    port_5000_check = run_cmd("ss -tlnp 2>/dev/null | grep :5000 || netstat -tlnp 2>/dev/null | grep :5000 || echo 'Port 5000 free'")
    context["system"]["port_5000"] = port_5000_check.get("stdout", "Could not check port 5000")
    
    port_5432_check = run_cmd("ss -tlnp 2>/dev/null | grep :5432 || netstat -tlnp 2>/dev/null | grep :5432 || echo 'Port 5432 free'")
    context["system"]["port_5432"] = port_5432_check.get("stdout", "Could not check port 5432")
    
    port_6379_check = run_cmd("ss -tlnp 2>/dev/null | grep :6379 || netstat -tlnp 2>/dev/null | grep :6379 || echo 'Port 6379 free'")
    context["system"]["port_6379"] = port_6379_check.get("stdout", "Could not check port 6379")
    
    # 9. Информация о системе
    print("💻 Checking system info...")
    python_version = run_cmd("python --version 2>&1")
    context["system"]["python_version"] = python_version.get("stdout", "Unknown")
    
    node_version = run_cmd("node --version 2>/dev/null || echo 'Node not installed'")
    context["system"]["node_version"] = node_version.get("stdout", "Unknown")
    
    npm_version = run_cmd("npm --version 2>/dev/null || echo 'NPM not installed'")
    context["system"]["npm_version"] = npm_version.get("stdout", "Unknown")
    
    docker_version = run_cmd("docker --version 2>/dev/null || echo 'Docker not installed'")
    context["system"]["docker_version"] = docker_version.get("stdout", "Unknown")
    
    docker_compose_version = run_cmd("docker-compose --version 2>/dev/null || echo 'Docker Compose not installed'")
    context["system"]["docker_compose_version"] = docker_compose_version.get("stdout", "Unknown")
    
    # Сохраняем результат
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(context, f, indent=2, default=str, ensure_ascii=False)
    
    print(f"\n✅ Context collected! Saved to {OUTPUT_FILE}")
    print(f"📏 File size: {Path(OUTPUT_FILE).stat().st_size} bytes")
    
    # Выводим краткую сводку
    print("\n🔍 QUICK SUMMARY:")
    
    # Статус API
    api_status = context["api"].get("health", "Unknown")
    print(f"   - API Health: {api_status}")
    
    # Критические файлы
    found_files = [k for k,v in context["files"].items() if "error" not in v]
    missing_files = [k for k,v in context["files"].items() if "error" in v]
    print(f"   - Files found: {len(found_files)}/{len(critical_files)}")
    if missing_files:
        print(f"     Missing: {', '.join(missing_files[:3])}")
        if len(missing_files) > 3:
            print(f"     ... and {len(missing_files)-3} more")
    
    # База данных
    if "error" in context["database"]:
        print(f"   - Database: ❌ {context['database']['error']}")
    else:
        print(f"   - Database: ✅ Connected")
        if "alembic_version" in context["database"]:
            alembic = context["database"]["alembic_version"].strip()
            print(f"     Alembic version: {alembic if alembic else 'None'}")
    
    # Docker
    containers = context["docker"]["containers"]
    if "app" in containers:
        print(f"   - Docker: ✅ App container running")
    elif "postgres" in containers:
        print(f"   - Docker: ⚠️ PostgreSQL running, App not found")
    else:
        print(f"   - Docker: ⚠️ No containers running?")
    
    # Git
    branch = context["git"].get("branch", "Unknown")
    print(f"   - Git branch: {branch}")
    
    # Порты
    print(f"   - Ports: 5000:{'✅' if '5000' in context['system'].get('port_5000','') else '🟡'} "
          f"5432:{'✅' if '5432' in context['system'].get('port_5432','') else '🟡'} "
          f"6379:{'✅' if '6379' in context['system'].get('port_6379','') else '🟡'}")
    
    print("\n📋 Full details in handoff_context_extra.json")

if __name__ == "__main__":
    main()