=============================================================================
🎯 ПРОЕКТ: OSINT Graph Analyzer
📅 Дата: 2026-03-13T17:28:33.500320
📌 Версия: v1.0
=============================================================================

📊 СТАТИСТИКА
--------------------------------------------------
- Всего файлов: 5552
- Строк кода: 2082288
- Python файлов: 5452
- TypeScript/JS: 26

🏗 АРХИТЕКТУРА
--------------------------------------------------
- backend: FastAPI, SQLAlchemy
- frontend: 
- database: PostgreSQL, Redis
- infrastructure: Docker

🔑 КЛЮЧЕВЫЕ АРХИТЕКТУРНЫЕ РЕШЕНИЯ
--------------------------------------------------
📌 Гибкая мета-модель через JSONB
   └── Причина: Пользователь должен определять типы узлов без изменения кода
   └── Где: app/models/schema.py, app/services/schema_service.py
📌 JSONB для атрибутов узлов и ребер
   └── Причина: Разные типы имеют разные атрибуты
   └── Где: app/models/node.py, app/models/edge.py
📌 Batch операции для производительности
   └── Причина: Вставка 1000 узлов должна быть <2 секунд
   └── Где: app/api/routes/nodes.py (/batch)
📌 Кэширование типов в отдельных таблицах
   └── Причина: Быстрый доступ без парсинга JSON
   └── Где: app/models/schema.py (NodeType, EdgeType)

✅ ТЕКУЩИЙ СТАТУС
--------------------------------------------------
- backend_models: 100% - полностью функционально
- api_endpoints: 100% - все CRUD операции
- validation: 100% - проверка типов, обязательных полей
- docker: 100% - работает docker-compose up
- frontend_layout: 100% - вкладки, сайдбар, инспектор
- visualization: 100% - vis-network, перетаскивание
- redux: 100% - все слайсы работают

🚀 СЛЕДУЮЩИЕ ШАГИ (Phase 2)
--------------------------------------------------
📌 Этап 2.1: Модель артефактов
   └── Создать таблицы artifacts, relations, history
   └── Статус: 0%
📌 Этап 2.2: API артефактов
   └── Универсальные CRUD для артефактов
   └── Статус: 0%
📌 Этап 2.3: Рефакторинг фронтенда
   └── artifactsSlice вместо graphSlice
   └── Статус: 0%
📌 Этап 2.4: Новые типы
   └── Таблицы, карты, диаграммы
   └── Статус: 0%
📌 Этап 2.5: Интеграция плагинов
   └── Плагины создают артефакты
   └── Статус: 0%

❓ ОТКРЫТЫЕ ВОПРОСЫ
--------------------------------------------------
- Как организовать версионирование артефактов? Полное копирование или дельты?
- Нужен ли Celery для плагинов >10 секунд?
- Нужен ли полнотекстовый поиск по JSONB?
- Как визуализировать историю изменений?

📁 СТРУКТУРА ПРОЕКТА
--------------------------------------------------
```
{
  "Dockerfile": "[BINARY] 1276 bytes",
  "alembic": {
    "env.py": "[FILE] 96 lines",
    "versions": {
      "001_initial_models.py": "[FILE] 128 lines",
      "002_add_artifacts_tables.py": "[FILE] 140 lines",
      "003_add_graph_actions.py": "[FILE] 58 lines",
      "004_add_graph_actions.py": "[FILE] 59 lines"
    }
  },
  "alembic.ini": "[BINARY] 1734 bytes",
  "app": {
    "api": {
      "deps.py": "[FILE] 50 lines",
      "routes": {
        "__init__.py": "[FILE] 8 lines",
        "artifacts.py": "[FILE] 727 lines",
        "edges.py": "[FILE] 219 lines",
        "graphs.py": "[FILE] 59 lines",
        "history.py": "[FILE] 269 lines",
        "history.py.bkp": "[BINARY] 7703 bytes",
        "nodes.py": "[FILE] 249 lines",
        "projects.py": "[FILE] 142 lines",
        "schema.py": "[FILE] 93 lines"
      }
    },
    "config.py": "[FILE] 64 lines",
    "core": {
      "exceptions.py": "[FILE] 101 lines"
    },
    "database.py": "[FILE] 71 lines",
    "main.py": "[FILE] 140 lines",
    "models": {
      "__init__.py": "[FILE] 24 lines",
      "action.py": "[FILE] 59 lines",
      "artifact.py": "[FILE] 96 lines",
      "edge.py": "[FILE] 48 lines",
      "graph.py": "[FILE] 37 lines",
      "node.py": "[FILE] 49 lines",
      "project.py": "[FILE] 30 lines",
      "schema.py": "[FILE] 65 lines"
    },
    "routers": {
      "__init__.py": "[FILE] 6 lines",
      "analytics.py": "[FILE] 38 lines",
      "graphs.py": "[FILE] 29 lines",
      "plugins.py": "[FILE] 29 lines"
    },
    "schemas": {
      "action.py": "[FILE] 50 lines"
    },
    "services": {
      "history_cache.py": "[FILE] 140 lines",
      "schema_service.py": "[FILE] 232 lines"
    }
  },
  "backup.sh": "[BINARY] 2331 bytes",
  "backups": {
    "checksums_20260313_020005.txt": "[BINARY] 954 bytes",
    "data_20260313_020005.tar.gz": "[BINARY] 143 bytes",
    "db_20260313_020005.sql.gz": "[BINARY] 2410 bytes",
    "docker-compose_20260313_020005.yml": "[FILE] 86 lines",
    "env_20260313_020005.backup": "[BINARY] 609 bytes",
    "npm-deps_20260313_020005.txt": "[BINARY] 52 bytes",
    "requirements_20260313_020005.txt": "[BINARY] 1215 bytes",
    "system_info_20260313_020005.txt": "[BINARY] 352 bytes",
    "volume_postgres_20260313_020005.tar.gz": "[BINARY] 87 bytes",
    "volume_redis_20260313_020005.tar.gz": "[BINARY] 87 bytes"
  },
  "clean-database.sh": "[BINARY] 7117 bytes",
  "clean-database.sh:Zone.Identifier": "[BINARY] 0 bytes",
  "create-test-data.sh": "[BINARY] 14787 bytes",
  "create-test-data.sh:Zone.Identifier": "[BINARY] 0 bytes",
  "data": {},
  "docker-compose.override.yml": "[FILE] 39 lines",
  "docker-compose.yml": "[FILE] 86 lines",
  "docker-compose.yml.backup": "[BINARY] 1709 bytes",
  "frontend": {
    "index.html": "[BINARY] 369 bytes",
    "package-lock.json": "[FILE] 4787 lines",
    "package.json": "[FILE] 50 lines",
    "src": {
      "App.css": "[FILE] 777 lines",
      "App.tsx": "[FILE] 179 lines",
      "components": {
        "history": {
          "HistoryPanel.css": "[FILE] 266 lines",
          "HistoryPanel.tsx": "[FILE] 237 lines"
        },
        "layout": {
          "InspectorPanel.tsx": "[FILE] 419 lines",
          "Sidebar.tsx": "[FILE] 274 lines",
          "Sidebar_new.tsx": "[FILE] 966 lines",
          "TabBar.tsx": "[FILE] 68 lines"
        },
        "views": {
          "ArtifactView.tsx": "[FILE] 348 lines",
          "ChartView.tsx": "[FILE] 27 lines",
          "DocumentView.tsx": "[FILE] 34 lines",
          "GraphView.css": "[FILE] 112 lines",
          "GraphView.tsx": "[FILE] 466 lines",
          "MapView.tsx": "[FILE] 27 lines",
          "TableView.tsx": "[FILE] 51 lines"
        }
      },
      "hooks": {
        "useActionWithUndo.ts": "[FILE] 225 lines",
        "useKeyboardShortcuts.ts": "[FILE] 34 lines"
      },
      "index.css": "[FILE] 14 lines",
      "main.tsx": "[FILE] 14 lines",
      "services": {
        "api.ts": "[FILE] 76 lines"
      },
      "store": {
        "index.ts": "[FILE] 38 lines",
        "slices": {
          "artifactsSlice.ts": "[FILE] 371 lines",
          "graphSlice.ts": "[FILE] 100 lines",
          "historySlice.ts": "[FILE] 165 lines",
          "historySlice.ts]": "[BINARY] 1590 bytes",
          "projectsSlice.ts": "[FILE] 68 lines",
          "uiSlice.ts": "[FILE] 106 lines"
        }
      },
      "types": {
        "api.ts": "[FILE] 35 lines"
      },
      "utils": {
        "formatters.ts": "[FILE] 52 lines"
      },
      "vite-env.d.ts": "[FILE] 12 lines"
    },
    "step3.py": "[FILE] 1950 lines",
    "tsconfig.json": "[FILE] 32 lines",
    "tsconfig.node.json": "[FILE] 12 lines",
    "vite.config.ts": "[FILE] 33 lines"
  },
  "get-docker.sh": "[BINARY] 22405 bytes",
  "get_structure.py": "[FILE] 493 lines",
  "handoff_latest.json": "[FILE] 2045521 bytes (skipped, too large)",
  "handoff_latest.md": "[FILE] 12152 lines",
  "handoff_quick.md": "[FILE] 21 lines",
  "osint-backups": {
    "checksums_20260224_214935.txt": "[BINARY] 879 bytes",
    "checksums_20260226_071109.txt": "[BINARY] 1749 bytes",
    "checksums_20260301_200321.txt": "[BINARY] 2423 bytes",
    "docker-compose_20260224_214935.yml": "[FILE] 73 lines",
    "docker-compose_20260226_071109.yml": "[FILE] 86 lines",
    "docker-compose_20260301_200321.yml": "[FILE] 86 lines",
    "env_20260224_214935.backup": "[BINARY] 663 bytes",
    "env_20260226_071109.backup": "[BINARY] 629 bytes",
    "env_20260301_200321.backup": "[BINARY] 629 bytes",
    "npm-deps_20260224_214935.txt": "[BINARY] 53 bytes",
    "npm-deps_20260226_071109.txt": "[BINARY] 53 bytes",
    "npm-deps_20260301_200321.txt": "[BINARY] 53 bytes",
    "requirements_20260224_214935.txt": "[BINARY] 0 bytes",
    "requirements_20260226_071109.txt": "[BINARY] 1001 bytes",
    "requirements_20260301_200321.txt": "[BINARY] 1001 bytes",
    "system_info_20260224_214935.txt": "[BINARY] 381 bytes",
    "system_info_20260226_071109.txt": "[BINARY] 381 bytes",
    "system_info_20260301_200321.txt": "[BINARY] 385 bytes"
  },
  "package-lock.json": "[FILE] 7 lines",
  "plugins": {
    "__init__.py": "[FILE] 56 lines",
    "examples": {
      "__init__.py": "[FILE] 9 lines",
      "community_detector.py": "[FILE] 112 lines",
      "degree_analyzer.py": "[FILE] 81 lines"
    }
  },
  "project_context.json": "[FILE] 4777 lines",
  "pytest.ini": "[BINARY] 169 bytes",
  "requirements.txt": "[BINARY] 409 bytes",
  "requirements.txt.backup": "[BINARY] 409 bytes",
  "requirements_no_psycopg2.txt": "[BINARY] 385 bytes",
  "restore-local.sh": "[BINARY] 4104 bytes",
  "test_artifacts.db": "[BINARY] 90112 bytes",
  "tests": {
    "conftest.py": "[FILE] 26 lines",
    "test_artifacts_api.py": "[FILE] 218 lines",
    "test_artifacts_api_async.py": "[FILE] 404 lines",
    "test_artifacts_api_sync.py": "[FILE] 235 lines",
    "test_artifacts_models.py": "[FILE] 357 lines"
  },
  "venv": {
    "bin": {
      "Activate.ps1": "[BINARY] 9033 bytes",
      "activate": "[BINARY] 2062 bytes",
      "activate.csh": "[BINARY] 933 bytes",
      "activate.fish": "[BINARY] 2208 bytes",
      "alembic": "[BINARY] 194 bytes",
      "celery": "[BINARY] 195 bytes",
      "dotenv": "[BINARY] 193 bytes",
      "httpx": "[BINARY] 185 bytes",
      "mako-render": "[BINARY] 194 bytes",
      "pip": "[BINARY] 254 bytes",
      "pip3": "[BINARY] 254 bytes",
      "pip3.12": "[BINARY] 254 bytes",
      "pyrsa-decrypt": "[BINARY] 193 bytes",
      "pyrsa-encrypt": "[BINARY] 193 bytes",
      "pyrsa-keygen": "[BINARY] 191 bytes",
      "pyrsa-priv2pub": "[BINARY] 214 bytes",
      "pyrsa-sign": "[BINARY] 187 bytes",
      "pyrsa-verify": "[BINARY] 191 bytes",
      "python": "[BINARY] 8020928 bytes",
      "python3": "[BINARY] 8020928 bytes",
      "python3.12": "[BINARY] 8020928 bytes",
      "uvicorn": "[BINARY] 192 bytes",
      "watchfiles": "[BINARY] 192 bytes",
      "websockets": "[BINARY] 194 bytes"
    },
    "include": {
      "site": {
        "python3.12": {
          "greenlet": {
            "greenlet.h": "[BINARY] 4755 bytes"
          }
        }
      }
    },
    "lib": {
      "python3.12": {
        "site-packages": {
          "SQLAlchemy-2.0.23.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1100 bytes",
            "METADATA": "[BINARY] 9551 bytes",
            "RECORD": "[BINARY] 40360 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "_cffi_backend.cpython-312-x86_64-linux-gnu.so": "[BINARY] 348808 bytes",
          "_yaml": {
            "__init__.py": "[FILE] 34 lines"
          },
          "alembic": {
            "__init__.py": "[FILE] 7 lines",
            "__main__.py": "[FILE] 5 lines",
            "autogenerate": {
              "__init__.py": "[FILE] 11 lines",
              "api.py": "[FILE] 648 lines",
              "compare.py": "[FILE] 1395 lines",
              "render.py": "[FILE] 1083 lines",
              "rewriter.py": "[FILE] 228 lines"
            },
            "command.py": "[FILE] 745 lines",
            "config.py": "[FILE] 635 lines",
            "context.py": "[FILE] 6 lines",
            "context.pyi": "[BINARY] 31463 bytes",
            "ddl": {
              "__init__.py": "[FILE] 7 lines",
              "base.py": "[FILE] 333 lines",
              "impl.py": "[FILE] 748 lines",
              "mssql.py": "[FILE] 417 lines",
              "mysql.py": "[FILE] 472 lines",
              "oracle.py": "[FILE] 198 lines",
              "postgresql.py": "[FILE] 775 lines",
              "sqlite.py": "[FILE] 224 lines"
            },
            "environment.py": "[FILE] 2 lines",
            "migration.py": "[FILE] 2 lines",
            "op.py": "[FILE] 6 lines",
            "op.pyi": "[BINARY] 48591 bytes",
            "operations": {
              "__init__.py": "[FILE] 16 lines",
              "base.py": "[FILE] 1838 lines",
              "batch.py": "[FILE] 719 lines",
              "ops.py": "[FILE] 2765 lines",
              "schemaobj.py": "[FILE] 288 lines",
              "toimpl.py": "[FILE] 224 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "runtime": {
              "__init__.py": "[FILE] 1 lines",
              "environment.py": "[FILE] 1044 lines",
              "migration.py": "[FILE] 1381 lines"
            },
            "script": {
              "__init__.py": "[FILE] 5 lines",
              "base.py": "[FILE] 1054 lines",
              "revision.py": "[FILE] 1709 lines",
              "write_hooks.py": "[FILE] 177 lines"
            },
            "templates": {
              "async": {
                "README": "[BINARY] 58 bytes",
                "alembic.ini.mako": "[BINARY] 3505 bytes",
                "env.py": "[FILE] 90 lines",
                "script.py.mako": "[BINARY] 635 bytes"
              },
              "generic": {
                "README": "[BINARY] 38 bytes",
                "alembic.ini.mako": "[BINARY] 3614 bytes",
                "env.py": "[FILE] 79 lines",
                "script.py.mako": "[BINARY] 635 bytes"
              },
              "multidb": {
                "README": "[BINARY] 606 bytes",
                "alembic.ini.mako": "[BINARY] 3708 bytes",
                "env.py": "[FILE] 141 lines",
                "script.py.mako": "[BINARY] 1090 bytes"
              }
            },
            "testing": {
              "__init__.py": "[FILE] 30 lines",
              "assertions.py": "[FILE] 168 lines",
              "env.py": "[FILE] 519 lines",
              "fixtures.py": "[FILE] 307 lines",
              "plugin": {
                "__init__.py": "[FILE] 1 lines",
                "bootstrap.py": "[FILE] 5 lines"
              },
              "requirements.py": "[FILE] 199 lines",
              "schemacompare.py": "[FILE] 161 lines",
              "suite": {
                "__init__.py": "[FILE] 8 lines",
                "_autogen_fixtures.py": "[FILE] 336 lines",
                "test_autogen_comments.py": "[FILE] 243 lines",
                "test_autogen_computed.py": "[FILE] 204 lines",
                "test_autogen_diffs.py": "[FILE] 274 lines",
                "test_autogen_fks.py": "[FILE] 1191 lines",
                "test_autogen_identity.py": "[FILE] 227 lines",
                "test_environment.py": "[FILE] 365 lines",
                "test_op.py": "[FILE] 43 lines"
              },
              "util.py": "[FILE] 127 lines",
              "warnings.py": "[FILE] 41 lines"
            },
            "util": {
              "__init__.py": "[FILE] 36 lines",
              "compat.py": "[FILE] 74 lines",
              "editor.py": "[FILE] 82 lines",
              "exc.py": "[FILE] 7 lines",
              "langhelpers.py": "[FILE] 291 lines",
              "messaging.py": "[FILE] 113 lines",
              "pyfiles.py": "[FILE] 111 lines",
              "sqla_compat.py": "[FILE] 640 lines"
            }
          },
          "alembic-1.12.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1058 bytes",
            "METADATA": "[BINARY] 7306 bytes",
            "RECORD": "[BINARY] 10905 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 48 bytes",
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "amqp": {
            "__init__.py": "[FILE] 76 lines",
            "abstract_channel.py": "[FILE] 164 lines",
            "basic_message.py": "[FILE] 123 lines",
            "channel.py": "[FILE] 2128 lines",
            "connection.py": "[FILE] 785 lines",
            "exceptions.py": "[FILE] 289 lines",
            "method_framing.py": "[FILE] 190 lines",
            "platform.py": "[FILE] 80 lines",
            "protocol.py": "[FILE] 13 lines",
            "sasl.py": "[FILE] 192 lines",
            "serialization.py": "[FILE] 583 lines",
            "spec.py": "[FILE] 122 lines",
            "transport.py": "[FILE] 680 lines",
            "utils.py": "[FILE] 65 lines"
          },
          "amqp-5.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2372 bytes",
            "METADATA": "[BINARY] 8887 bytes",
            "RECORD": "[BINARY] 2163 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "top_level.txt": "[BINARY] 5 bytes"
          },
          "annotated_types": {
            "__init__.py": "[FILE] 433 lines",
            "py.typed": "[BINARY] 0 bytes",
            "test_cases.py": "[FILE] 152 lines"
          },
          "annotated_types-0.7.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 15046 bytes",
            "RECORD": "[BINARY] 802 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1083 bytes"
            }
          },
          "anyio": {
            "__init__.py": "[FILE] 170 lines",
            "_backends": {
              "__init__.py": "[FILE] 1 lines",
              "_asyncio.py": "[FILE] 2118 lines",
              "_trio.py": "[FILE] 997 lines"
            },
            "_core": {
              "__init__.py": "[FILE] 1 lines",
              "_compat.py": "[FILE] 218 lines",
              "_eventloop.py": "[FILE] 154 lines",
              "_exceptions.py": "[FILE] 95 lines",
              "_fileio.py": "[FILE] 604 lines",
              "_resources.py": "[FILE] 19 lines",
              "_signals.py": "[FILE] 27 lines",
              "_sockets.py": "[FILE] 608 lines",
              "_streams.py": "[FILE] 48 lines",
              "_subprocesses.py": "[FILE] 136 lines",
              "_synchronization.py": "[FILE] 597 lines",
              "_tasks.py": "[FILE] 181 lines",
              "_testing.py": "[FILE] 83 lines",
              "_typedattr.py": "[FILE] 84 lines"
            },
            "abc": {
              "__init__.py": "[FILE] 91 lines",
              "_resources.py": "[FILE] 32 lines",
              "_sockets.py": "[FILE] 161 lines",
              "_streams.py": "[FILE] 204 lines",
              "_subprocesses.py": "[FILE] 80 lines",
              "_tasks.py": "[FILE] 120 lines",
              "_testing.py": "[FILE] 71 lines"
            },
            "from_thread.py": "[FILE] 501 lines",
            "lowlevel.py": "[FILE] 175 lines",
            "py.typed": "[BINARY] 0 bytes",
            "pytest_plugin.py": "[FILE] 143 lines",
            "streams": {
              "__init__.py": "[FILE] 1 lines",
              "buffered.py": "[FILE] 119 lines",
              "file.py": "[FILE] 148 lines",
              "memory.py": "[FILE] 280 lines",
              "stapled.py": "[FILE] 141 lines",
              "text.py": "[FILE] 144 lines",
              "tls.py": "[FILE] 321 lines"
            },
            "to_process.py": "[FILE] 250 lines",
            "to_thread.py": "[FILE] 68 lines"
          },
          "anyio-3.7.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1081 bytes",
            "METADATA": "[BINARY] 4708 bytes",
            "RECORD": "[BINARY] 5527 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 39 bytes",
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "asyncpg": {
            "__init__.py": "[FILE] 20 lines",
            "_asyncio_compat.py": "[FILE] 88 lines",
            "_testbase": {
              "__init__.py": "[FILE] 528 lines",
              "fuzzer.py": "[FILE] 307 lines"
            },
            "_version.py": "[FILE] 14 lines",
            "cluster.py": "[FILE] 689 lines",
            "compat.py": "[FILE] 62 lines",
            "connect_utils.py": "[FILE] 1082 lines",
            "connection.py": "[FILE] 2656 lines",
            "connresource.py": "[FILE] 45 lines",
            "cursor.py": "[FILE] 324 lines",
            "exceptions": {
              "__init__.py": "[FILE] 1199 lines",
              "_base.py": "[FILE] 300 lines"
            },
            "introspection.py": "[FILE] 293 lines",
            "pgproto": {
              "__init__.pxd": "[BINARY] 213 bytes",
              "__init__.py": "[FILE] 6 lines",
              "buffer.pxd": "[BINARY] 4382 bytes",
              "buffer.pyx": "[BINARY] 25310 bytes",
              "codecs": {
                "__init__.pxd": "[BINARY] 6013 bytes",
                "bits.pyx": "[BINARY] 1475 bytes",
                "bytea.pyx": "[BINARY] 997 bytes",
                "context.pyx": "[BINARY] 623 bytes",
                "datetime.pyx": "[BINARY] 12831 bytes",
                "float.pyx": "[BINARY] 1031 bytes",
                "geometry.pyx": "[BINARY] 4665 bytes",
                "hstore.pyx": "[BINARY] 2018 bytes",
                "int.pyx": "[BINARY] 4527 bytes",
                "json.pyx": "[BINARY] 1454 bytes",
                "jsonpath.pyx": "[BINARY] 833 bytes",
                "misc.pyx": "[BINARY] 484 bytes",
                "network.pyx": "[BINARY] 3917 bytes",
                "numeric.pyx": "[BINARY] 10373 bytes",
                "pg_snapshot.pyx": "[BINARY] 1814 bytes",
                "text.pyx": "[BINARY] 1516 bytes",
                "tid.pyx": "[BINARY] 1549 bytes",
                "uuid.pyx": "[BINARY] 855 bytes"
              },
              "consts.pxi": "[BINARY] 375 bytes",
              "cpythonx.pxd": "[BINARY] 736 bytes",
              "debug.pxd": "[BINARY] 263 bytes",
              "frb.pxd": "[BINARY] 1212 bytes",
              "frb.pyx": "[BINARY] 409 bytes",
              "hton.pxd": "[BINARY] 953 bytes",
              "pgproto.cpython-312-x86_64-linux-gnu.so": "[BINARY] 2849672 bytes",
              "pgproto.pxd": "[BINARY] 430 bytes",
              "pgproto.pyx": "[BINARY] 1249 bytes",
              "tohex.pxd": "[BINARY] 361 bytes",
              "types.py": "[FILE] 424 lines",
              "uuid.pyx": "[BINARY] 9943 bytes"
            },
            "pool.py": "[FILE] 1131 lines",
            "prepared_stmt.py": "[FILE] 260 lines",
            "protocol": {
              "__init__.py": "[FILE] 10 lines",
              "codecs": {
                "__init__.py": "[FILE] 1 lines",
                "array.pyx": "[BINARY] 29486 bytes",
                "base.pxd": "[BINARY] 6224 bytes",
                "base.pyx": "[BINARY] 33475 bytes",
                "pgproto.pyx": "[BINARY] 17175 bytes",
                "range.pyx": "[BINARY] 6359 bytes",
                "record.pyx": "[BINARY] 2362 bytes",
                "textutils.pyx": "[BINARY] 2011 bytes"
              },
              "consts.pxi": "[BINARY] 381 bytes",
              "coreproto.pxd": "[BINARY] 6149 bytes",
              "coreproto.pyx": "[BINARY] 38015 bytes",
              "cpythonx.pxd": "[BINARY] 613 bytes",
              "encodings.pyx": "[BINARY] 1644 bytes",
              "pgtypes.pxi": "[BINARY] 6924 bytes",
              "prepared_stmt.pxd": "[BINARY] 1115 bytes",
              "prepared_stmt.pyx": "[BINARY] 13052 bytes",
              "protocol.cpython-312-x86_64-linux-gnu.so": "[BINARY] 8713328 bytes",
              "protocol.pxd": "[BINARY] 1950 bytes",
              "protocol.pyx": "[BINARY] 34824 bytes",
              "record": {
                "__init__.pxd": "[BINARY] 495 bytes"
              },
              "scram.pxd": "[BINARY] 1299 bytes",
              "scram.pyx": "[BINARY] 14594 bytes",
              "settings.pxd": "[BINARY] 1066 bytes",
              "settings.pyx": "[BINARY] 3795 bytes"
            },
            "serverversion.py": "[FILE] 61 lines",
            "transaction.py": "[FILE] 247 lines",
            "types.py": "[FILE] 178 lines",
            "utils.py": "[FILE] 46 lines"
          },
          "asyncpg-0.29.0.dist-info": {
            "AUTHORS": "[BINARY] 130 bytes",
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 11466 bytes",
            "METADATA": "[BINARY] 4356 bytes",
            "RECORD": "[BINARY] 8764 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "bcrypt": {
            "__init__.py": "[FILE] 44 lines",
            "__init__.pyi": "[BINARY] 333 bytes",
            "_bcrypt.abi3.so": "[BINARY] 631768 bytes",
            "py.typed": "[BINARY] 0 bytes"
          },
          "bcrypt-5.0.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 10524 bytes",
            "RECORD": "[BINARY] 835 bytes",
            "WHEEL": "[BINARY] 111 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 10850 bytes"
            },
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "billiard": {
            "__init__.py": "[FILE] 62 lines",
            "_ext.py": "[FILE] 33 lines",
            "_win.py": "[FILE] 115 lines",
            "common.py": "[FILE] 157 lines",
            "compat.py": "[FILE] 280 lines",
            "connection.py": "[FILE] 1041 lines",
            "context.py": "[FILE] 421 lines",
            "dummy": {
              "__init__.py": "[FILE] 167 lines",
              "connection.py": "[FILE] 93 lines"
            },
            "einfo.py": "[FILE] 194 lines",
            "exceptions.py": "[FILE] 53 lines",
            "forkserver.py": "[FILE] 265 lines",
            "heap.py": "[FILE] 286 lines",
            "managers.py": "[FILE] 1211 lines",
            "pool.py": "[FILE] 2054 lines",
            "popen_fork.py": "[FILE] 90 lines",
            "popen_forkserver.py": "[FILE] 69 lines",
            "popen_spawn_posix.py": "[FILE] 75 lines",
            "popen_spawn_win32.py": "[FILE] 122 lines",
            "process.py": "[FILE] 401 lines",
            "queues.py": "[FILE] 404 lines",
            "reduction.py": "[FILE] 294 lines",
            "resource_sharer.py": "[FILE] 163 lines",
            "semaphore_tracker.py": "[FILE] 147 lines",
            "sharedctypes.py": "[FILE] 259 lines",
            "spawn.py": "[FILE] 390 lines",
            "synchronize.py": "[FILE] 437 lines",
            "util.py": "[FILE] 238 lines"
          },
          "billiard-4.2.4.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE.txt": "[BINARY] 1483 bytes",
            "METADATA": "[BINARY] 4770 bytes",
            "RECORD": "[BINARY] 4127 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "celery": {
            "__init__.py": "[FILE] 173 lines",
            "__main__.py": "[FILE] 20 lines",
            "_state.py": "[FILE] 198 lines",
            "app": {
              "__init__.py": "[FILE] 77 lines",
              "amqp.py": "[FILE] 615 lines",
              "annotations.py": "[FILE] 53 lines",
              "autoretry.py": "[FILE] 67 lines",
              "backends.py": "[FILE] 69 lines",
              "base.py": "[FILE] 1367 lines",
              "builtins.py": "[FILE] 188 lines",
              "control.py": "[FILE] 780 lines",
              "defaults.py": "[FILE] 415 lines",
              "events.py": "[FILE] 41 lines",
              "log.py": "[FILE] 248 lines",
              "registry.py": "[FILE] 69 lines",
              "routes.py": "[FILE] 137 lines",
              "task.py": "[FILE] 1145 lines",
              "trace.py": "[FILE] 764 lines",
              "utils.py": "[FILE] 416 lines"
            },
            "apps": {
              "__init__.py": "[FILE] 1 lines",
              "beat.py": "[FILE] 161 lines",
              "multi.py": "[FILE] 507 lines",
              "worker.py": "[FILE] 388 lines"
            },
            "backends": {
              "__init__.py": "[FILE] 2 lines",
              "arangodb.py": "[FILE] 191 lines",
              "asynchronous.py": "[FILE] 334 lines",
              "azureblockblob.py": "[FILE] 166 lines",
              "base.py": "[FILE] 1111 lines",
              "cache.py": "[FILE] 164 lines",
              "cassandra.py": "[FILE] 257 lines",
              "consul.py": "[FILE] 117 lines",
              "cosmosdbsql.py": "[FILE] 219 lines",
              "couchbase.py": "[FILE] 115 lines",
              "couchdb.py": "[FILE] 100 lines",
              "database": {
                "__init__.py": "[FILE] 223 lines",
                "models.py": "[FILE] 109 lines",
                "session.py": "[FILE] 90 lines"
              },
              "dynamodb.py": "[FILE] 494 lines",
              "elasticsearch.py": "[FILE] 249 lines",
              "filesystem.py": "[FILE] 113 lines",
              "mongodb.py": "[FILE] 334 lines",
              "redis.py": "[FILE] 669 lines",
              "rpc.py": "[FILE] 343 lines",
              "s3.py": "[FILE] 88 lines"
            },
            "beat.py": "[FILE] 737 lines",
            "bin": {
              "__init__.py": "[FILE] 1 lines",
              "amqp.py": "[FILE] 313 lines",
              "base.py": "[FILE] 288 lines",
              "beat.py": "[FILE] 73 lines",
              "call.py": "[FILE] 72 lines",
              "celery.py": "[FILE] 237 lines",
              "control.py": "[FILE] 204 lines",
              "events.py": "[FILE] 95 lines",
              "graph.py": "[FILE] 198 lines",
              "list.py": "[FILE] 39 lines",
              "logtool.py": "[FILE] 158 lines",
              "migrate.py": "[FILE] 64 lines",
              "multi.py": "[FILE] 481 lines",
              "purge.py": "[FILE] 71 lines",
              "result.py": "[FILE] 31 lines",
              "shell.py": "[FILE] 174 lines",
              "upgrade.py": "[FILE] 92 lines",
              "worker.py": "[FILE] 361 lines"
            },
            "bootsteps.py": "[FILE] 416 lines",
            "canvas.py": "[FILE] 2395 lines",
            "concurrency": {
              "__init__.py": "[FILE] 49 lines",
              "asynpool.py": "[FILE] 1361 lines",
              "base.py": "[FILE] 181 lines",
              "eventlet.py": "[FILE] 182 lines",
              "gevent.py": "[FILE] 123 lines",
              "prefork.py": "[FILE] 173 lines",
              "solo.py": "[FILE] 32 lines",
              "thread.py": "[FILE] 65 lines"
            },
            "contrib": {
              "__init__.py": "[FILE] 1 lines",
              "abortable.py": "[FILE] 166 lines",
              "migrate.py": "[FILE] 417 lines",
              "pytest.py": "[FILE] 217 lines",
              "rdb.py": "[FILE] 188 lines",
              "sphinx.py": "[FILE] 106 lines",
              "testing": {
                "__init__.py": "[FILE] 1 lines",
                "app.py": "[FILE] 113 lines",
                "manager.py": "[FILE] 240 lines",
                "mocks.py": "[FILE] 138 lines",
                "tasks.py": "[FILE] 10 lines",
                "worker.py": "[FILE] 222 lines"
              }
            },
            "events": {
              "__init__.py": "[FILE] 16 lines",
              "cursesmon.py": "[FILE] 535 lines",
              "dispatcher.py": "[FILE] 230 lines",
              "dumper.py": "[FILE] 104 lines",
              "event.py": "[FILE] 64 lines",
              "receiver.py": "[FILE] 136 lines",
              "snapshot.py": "[FILE] 112 lines",
              "state.py": "[FILE] 731 lines"
            },
            "exceptions.py": "[FILE] 313 lines",
            "fixups": {
              "__init__.py": "[FILE] 2 lines",
              "django.py": "[FILE] 214 lines"
            },
            "loaders": {
              "__init__.py": "[FILE] 19 lines",
              "app.py": "[FILE] 9 lines",
              "base.py": "[FILE] 273 lines",
              "default.py": "[FILE] 43 lines"
            },
            "local.py": "[FILE] 544 lines",
            "platforms.py": "[FILE] 832 lines",
            "result.py": "[FILE] 1088 lines",
            "schedules.py": "[FILE] 866 lines",
            "security": {
              "__init__.py": "[FILE] 75 lines",
              "certificate.py": "[FILE] 114 lines",
              "key.py": "[FILE] 36 lines",
              "serialization.py": "[FILE] 102 lines",
              "utils.py": "[FILE] 29 lines"
            },
            "signals.py": "[FILE] 155 lines",
            "states.py": "[FILE] 152 lines",
            "utils": {
              "__init__.py": "[FILE] 38 lines",
              "abstract.py": "[FILE] 147 lines",
              "collections.py": "[FILE] 865 lines",
              "debug.py": "[FILE] 194 lines",
              "deprecated.py": "[FILE] 114 lines",
              "dispatch": {
                "__init__.py": "[FILE] 5 lines",
                "signal.py": "[FILE] 355 lines"
              },
              "functional.py": "[FILE] 403 lines",
              "graph.py": "[FILE] 310 lines",
              "imports.py": "[FILE] 164 lines",
              "iso8601.py": "[FILE] 77 lines",
              "log.py": "[FILE] 296 lines",
              "nodenames.py": "[FILE] 103 lines",
              "objects.py": "[FILE] 143 lines",
              "saferepr.py": "[FILE] 267 lines",
              "serialization.py": "[FILE] 274 lines",
              "static": {
                "__init__.py": "[FILE] 15 lines",
                "celery_128.png": "[BINARY] 2556 bytes"
              },
              "sysinfo.py": "[FILE] 49 lines",
              "term.py": "[FILE] 178 lines",
              "text.py": "[FILE] 199 lines",
              "threads.py": "[FILE] 332 lines",
              "time.py": "[FILE] 430 lines",
              "timer2.py": "[FILE] 155 lines"
            },
            "worker": {
              "__init__.py": "[FILE] 5 lines",
              "autoscale.py": "[FILE] 155 lines",
              "components.py": "[FILE] 241 lines",
              "consumer": {
                "__init__.py": "[FILE] 16 lines",
                "agent.py": "[FILE] 22 lines",
                "connection.py": "[FILE] 37 lines",
                "consumer.py": "[FILE] 746 lines",
                "control.py": "[FILE] 34 lines",
                "events.py": "[FILE] 69 lines",
                "gossip.py": "[FILE] 206 lines",
                "heart.py": "[FILE] 37 lines",
                "mingle.py": "[FILE] 77 lines",
                "tasks.py": "[FILE] 66 lines"
              },
              "control.py": "[FILE] 625 lines",
              "heartbeat.py": "[FILE] 62 lines",
              "loops.py": "[FILE] 136 lines",
              "pidbox.py": "[FILE] 123 lines",
              "request.py": "[FILE] 791 lines",
              "state.py": "[FILE] 289 lines",
              "strategy.py": "[FILE] 209 lines",
              "worker.py": "[FILE] 410 lines"
            }
          },
          "celery-5.3.4.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2717 bytes",
            "METADATA": "[BINARY] 21051 bytes",
            "RECORD": "[BINARY] 21833 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 48 bytes",
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "certifi": {
            "__init__.py": "[FILE] 5 lines",
            "__main__.py": "[FILE] 13 lines",
            "cacert.pem": "[BINARY] 272441 bytes",
            "core.py": "[FILE] 84 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "certifi-2026.2.25.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2474 bytes",
            "RECORD": "[BINARY] 1023 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 989 bytes"
            },
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "cffi": {
            "__init__.py": "[FILE] 15 lines",
            "_cffi_errors.h": "[BINARY] 3908 bytes",
            "_cffi_include.h": "[BINARY] 15055 bytes",
            "_embedding.h": "[BINARY] 18786 bytes",
            "_imp_emulation.py": "[FILE] 84 lines",
            "_shimmed_dist_utils.py": "[FILE] 46 lines",
            "api.py": "[FILE] 968 lines",
            "backend_ctypes.py": "[FILE] 1122 lines",
            "cffi_opcode.py": "[FILE] 188 lines",
            "commontypes.py": "[FILE] 83 lines",
            "cparser.py": "[FILE] 1016 lines",
            "error.py": "[FILE] 32 lines",
            "ffiplatform.py": "[FILE] 114 lines",
            "lock.py": "[FILE] 31 lines",
            "model.py": "[FILE] 619 lines",
            "parse_c_type.h": "[BINARY] 5976 bytes",
            "pkgconfig.py": "[FILE] 122 lines",
            "recompiler.py": "[FILE] 1599 lines",
            "setuptools_ext.py": "[FILE] 230 lines",
            "vengine_cpy.py": "[FILE] 1088 lines",
            "vengine_gen.py": "[FILE] 680 lines",
            "verifier.py": "[FILE] 307 lines"
          },
          "cffi-2.0.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2559 bytes",
            "RECORD": "[BINARY] 3281 bytes",
            "WHEEL": "[BINARY] 151 bytes",
            "entry_points.txt": "[BINARY] 75 bytes",
            "licenses": {
              "AUTHORS": "[BINARY] 208 bytes",
              "LICENSE": "[BINARY] 1123 bytes"
            },
            "top_level.txt": "[BINARY] 19 bytes"
          },
          "click": {
            "__init__.py": "[FILE] 124 lines",
            "_compat.py": "[FILE] 623 lines",
            "_termui_impl.py": "[FILE] 853 lines",
            "_textwrap.py": "[FILE] 52 lines",
            "_utils.py": "[FILE] 37 lines",
            "_winconsole.py": "[FILE] 297 lines",
            "core.py": "[FILE] 3416 lines",
            "decorators.py": "[FILE] 552 lines",
            "exceptions.py": "[FILE] 309 lines",
            "formatting.py": "[FILE] 302 lines",
            "globals.py": "[FILE] 68 lines",
            "parser.py": "[FILE] 533 lines",
            "py.typed": "[BINARY] 0 bytes",
            "shell_completion.py": "[FILE] 668 lines",
            "termui.py": "[FILE] 884 lines",
            "testing.py": "[FILE] 578 lines",
            "types.py": "[FILE] 1210 lines",
            "utils.py": "[FILE] 628 lines"
          },
          "click-8.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2621 bytes",
            "RECORD": "[BINARY] 2531 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 1475 bytes"
            }
          },
          "click_didyoumean": {
            "__init__.py": "[FILE] 67 lines"
          },
          "click_didyoumean-0.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1056 bytes",
            "METADATA": "[BINARY] 3943 bytes",
            "RECORD": "[BINARY] 574 bytes",
            "WHEEL": "[BINARY] 88 bytes"
          },
          "click_plugins": {
            "__init__.py": "[FILE] 62 lines",
            "core.py": "[FILE] 93 lines"
          },
          "click_plugins-1.1.1.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6461 bytes",
            "RECORD": "[BINARY] 1129 bytes",
            "WHEEL": "[BINARY] 109 bytes",
            "licenses": {
              "AUTHORS.txt": "[BINARY] 90 bytes",
              "LICENSE.txt": "[BINARY] 1517 bytes"
            },
            "top_level.txt": "[BINARY] 14 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "click_plugins.py": "[FILE] 238 lines",
          "click_repl": {
            "__init__.py": "[FILE] 12 lines",
            "_completer.py": "[FILE] 297 lines",
            "_repl.py": "[FILE] 153 lines",
            "exceptions.py": "[FILE] 24 lines",
            "utils.py": "[FILE] 223 lines"
          },
          "click_repl-0.3.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1141 bytes",
            "METADATA": "[BINARY] 3553 bytes",
            "RECORD": "[BINARY] 1146 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "cryptography": {
            "__about__.py": "[FILE] 18 lines",
            "__init__.py": "[FILE] 14 lines",
            "exceptions.py": "[FILE] 53 lines",
            "fernet.py": "[FILE] 225 lines",
            "hazmat": {
              "__init__.py": "[FILE] 14 lines",
              "_oid.py": "[FILE] 357 lines",
              "asn1": {
                "__init__.py": "[FILE] 11 lines",
                "asn1.py": "[FILE] 117 lines"
              },
              "backends": {
                "__init__.py": "[FILE] 14 lines",
                "openssl": {
                  "__init__.py": "[FILE] 10 lines",
                  "backend.py": "[FILE] 303 lines"
                }
              },
              "bindings": {
                "__init__.py": "[FILE] 4 lines",
                "_rust": {
                  "__init__.pyi": "[BINARY] 1257 bytes",
                  "_openssl.pyi": "[BINARY] 230 bytes",
                  "asn1.pyi": "[BINARY] 354 bytes",
                  "declarative_asn1.pyi": "[BINARY] 892 bytes",
                  "exceptions.pyi": "[BINARY] 640 bytes",
                  "ocsp.pyi": "[BINARY] 4020 bytes",
                  "openssl": {
                    "__init__.pyi": "[BINARY] 1522 bytes",
                    "aead.pyi": "[BINARY] 2688 bytes",
                    "ciphers.pyi": "[BINARY] 1315 bytes",
                    "cmac.pyi": "[BINARY] 564 bytes",
                    "dh.pyi": "[BINARY] 1564 bytes",
                    "dsa.pyi": "[BINARY] 1299 bytes",
                    "ec.pyi": "[BINARY] 1691 bytes",
                    "ed25519.pyi": "[BINARY] 532 bytes",
                    "ed448.pyi": "[BINARY] 514 bytes",
                    "hashes.pyi": "[BINARY] 984 bytes",
                    "hmac.pyi": "[BINARY] 702 bytes",
                    "kdf.pyi": "[BINARY] 2029 bytes",
                    "keys.pyi": "[BINARY] 912 bytes",
                    "poly1305.pyi": "[BINARY] 585 bytes",
                    "rsa.pyi": "[BINARY] 1364 bytes",
                    "x25519.pyi": "[BINARY] 523 bytes",
                    "x448.pyi": "[BINARY] 505 bytes"
                  },
                  "pkcs12.pyi": "[BINARY] 1605 bytes",
                  "pkcs7.pyi": "[BINARY] 1601 bytes",
                  "test_support.pyi": "[BINARY] 757 bytes",
                  "x509.pyi": "[BINARY] 9784 bytes"
                },
                "_rust.abi3.so": "[BINARY] 12807728 bytes",
                "openssl": {
                  "__init__.py": "[FILE] 4 lines",
                  "_conditional.py": "[FILE] 208 lines",
                  "binding.py": "[FILE] 138 lines"
                }
              },
              "decrepit": {
                "__init__.py": "[FILE] 6 lines",
                "ciphers": {
                  "__init__.py": "[FILE] 6 lines",
                  "algorithms.py": "[FILE] 113 lines"
                }
              },
              "primitives": {
                "__init__.py": "[FILE] 4 lines",
                "_asymmetric.py": "[FILE] 20 lines",
                "_cipheralgorithm.py": "[FILE] 61 lines",
                "_serialization.py": "[FILE] 169 lines",
                "asymmetric": {
                  "__init__.py": "[FILE] 4 lines",
                  "dh.py": "[FILE] 148 lines",
                  "dsa.py": "[FILE] 168 lines",
                  "ec.py": "[FILE] 471 lines",
                  "ed25519.py": "[FILE] 130 lines",
                  "ed448.py": "[FILE] 132 lines",
                  "padding.py": "[FILE] 112 lines",
                  "rsa.py": "[FILE] 286 lines",
                  "types.py": "[FILE] 112 lines",
                  "utils.py": "[FILE] 25 lines",
                  "x25519.py": "[FILE] 123 lines",
                  "x448.py": "[FILE] 126 lines"
                },
                "ciphers": {
                  "__init__.py": "[FILE] 28 lines",
                  "aead.py": "[FILE] 24 lines",
                  "algorithms.py": "[FILE] 137 lines",
                  "base.py": "[FILE] 147 lines",
                  "modes.py": "[FILE] 269 lines"
                },
                "cmac.py": "[FILE] 11 lines",
                "constant_time.py": "[FILE] 15 lines",
                "hashes.py": "[FILE] 247 lines",
                "hmac.py": "[FILE] 14 lines",
                "kdf": {
                  "__init__.py": "[FILE] 24 lines",
                  "argon2.py": "[FILE] 14 lines",
                  "concatkdf.py": "[FILE] 126 lines",
                  "hkdf.py": "[FILE] 17 lines",
                  "kbkdf.py": "[FILE] 304 lines",
                  "pbkdf2.py": "[FILE] 63 lines",
                  "scrypt.py": "[FILE] 20 lines",
                  "x963kdf.py": "[FILE] 62 lines"
                },
                "keywrap.py": "[FILE] 178 lines",
                "padding.py": "[FILE] 70 lines",
                "poly1305.py": "[FILE] 12 lines",
                "serialization": {
                  "__init__.py": "[FILE] 66 lines",
                  "base.py": "[FILE] 15 lines",
                  "pkcs12.py": "[FILE] 177 lines",
                  "pkcs7.py": "[FILE] 412 lines",
                  "ssh.py": "[FILE] 1620 lines"
                },
                "twofactor": {
                  "__init__.py": "[FILE] 10 lines",
                  "hotp.py": "[FILE] 102 lines",
                  "totp.py": "[FILE] 57 lines"
                }
              }
            },
            "py.typed": "[BINARY] 0 bytes",
            "utils.py": "[FILE] 139 lines",
            "x509": {
              "__init__.py": "[FILE] 271 lines",
              "base.py": "[FILE] 849 lines",
              "certificate_transparency.py": "[FILE] 36 lines",
              "extensions.py": "[FILE] 2529 lines",
              "general_name.py": "[FILE] 282 lines",
              "name.py": "[FILE] 477 lines",
              "ocsp.py": "[FILE] 380 lines",
              "oid.py": "[FILE] 38 lines",
              "verification.py": "[FILE] 35 lines"
            }
          },
          "cryptography-46.0.5.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 5748 bytes",
            "RECORD": "[BINARY] 16073 bytes",
            "WHEEL": "[BINARY] 108 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 197 bytes",
              "LICENSE.APACHE": "[BINARY] 11360 bytes",
              "LICENSE.BSD": "[BINARY] 1532 bytes"
            }
          },
          "dateutil": {
            "__init__.py": "[FILE] 25 lines",
            "_common.py": "[FILE] 44 lines",
            "_version.py": "[FILE] 5 lines",
            "easter.py": "[FILE] 90 lines",
            "parser": {
              "__init__.py": "[FILE] 62 lines",
              "_parser.py": "[FILE] 1614 lines",
              "isoparser.py": "[FILE] 417 lines"
            },
            "relativedelta.py": "[FILE] 600 lines",
            "rrule.py": "[FILE] 1738 lines",
            "tz": {
              "__init__.py": "[FILE] 13 lines",
              "_common.py": "[FILE] 420 lines",
              "_factories.py": "[FILE] 81 lines",
              "tz.py": "[FILE] 1850 lines",
              "win.py": "[FILE] 371 lines"
            },
            "tzwin.py": "[FILE] 3 lines",
            "utils.py": "[FILE] 72 lines",
            "zoneinfo": {
              "__init__.py": "[FILE] 168 lines",
              "rebuild.py": "[FILE] 76 lines"
            }
          },
          "dotenv": {
            "__init__.py": "[FILE] 50 lines",
            "__main__.py": "[FILE] 7 lines",
            "cli.py": "[FILE] 200 lines",
            "ipython.py": "[FILE] 40 lines",
            "main.py": "[FILE] 383 lines",
            "parser.py": "[FILE] 176 lines",
            "py.typed": "[BINARY] 26 bytes",
            "variables.py": "[FILE] 87 lines",
            "version.py": "[FILE] 2 lines"
          },
          "ecdsa": {
            "__init__.py": "[FILE] 105 lines",
            "_compat.py": "[FILE] 139 lines",
            "_rwlock.py": "[FILE] 87 lines",
            "_sha3.py": "[FILE] 182 lines",
            "_version.py": "[FILE] 22 lines",
            "curves.py": "[FILE] 591 lines",
            "der.py": "[FILE] 479 lines",
            "ecdh.py": "[FILE] 337 lines",
            "ecdsa.py": "[FILE] 1095 lines",
            "eddsa.py": "[FILE] 253 lines",
            "ellipticcurve.py": "[FILE] 1610 lines",
            "errors.py": "[FILE] 5 lines",
            "keys.py": "[FILE] 1632 lines",
            "numbertheory.py": "[FILE] 836 lines",
            "rfc6979.py": "[FILE] 114 lines",
            "ssh.py": "[FILE] 84 lines",
            "test_curves.py": "[FILE] 362 lines",
            "test_der.py": "[FILE] 603 lines",
            "test_ecdh.py": "[FILE] 450 lines",
            "test_ecdsa.py": "[FILE] 695 lines",
            "test_eddsa.py": "[FILE] 1125 lines",
            "test_ellipticcurve.py": "[FILE] 295 lines",
            "test_jacobi.py": "[FILE] 935 lines",
            "test_keys.py": "[FILE] 1139 lines",
            "test_malformed_sigs.py": "[FILE] 379 lines",
            "test_numbertheory.py": "[FILE] 484 lines",
            "test_pyecdsa.py": "[FILE] 2565 lines",
            "test_rw_lock.py": "[FILE] 181 lines",
            "test_sha3.py": "[FILE] 112 lines",
            "util.py": "[FILE] 534 lines"
          },
          "ecdsa-0.19.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1147 bytes",
            "METADATA": "[BINARY] 29641 bytes",
            "RECORD": "[BINARY] 4164 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "fastapi": {
            "__init__.py": "[FILE] 26 lines",
            "_compat.py": "[FILE] 630 lines",
            "applications.py": "[FILE] 4638 lines",
            "background.py": "[FILE] 60 lines",
            "concurrency.py": "[FILE] 41 lines",
            "datastructures.py": "[FILE] 205 lines",
            "dependencies": {
              "__init__.py": "[FILE] 1 lines",
              "models.py": "[FILE] 59 lines",
              "utils.py": "[FILE] 811 lines"
            },
            "encoders.py": "[FILE] 342 lines",
            "exception_handlers.py": "[FILE] 35 lines",
            "exceptions.py": "[FILE] 177 lines",
            "logger.py": "[FILE] 4 lines",
            "middleware": {
              "__init__.py": "[FILE] 2 lines",
              "asyncexitstack.py": "[FILE] 26 lines",
              "cors.py": "[FILE] 2 lines",
              "gzip.py": "[FILE] 2 lines",
              "httpsredirect.py": "[FILE] 4 lines",
              "trustedhost.py": "[FILE] 4 lines",
              "wsgi.py": "[FILE] 2 lines"
            },
            "openapi": {
              "__init__.py": "[FILE] 1 lines",
              "constants.py": "[FILE] 4 lines",
              "docs.py": "[FILE] 345 lines",
              "models.py": "[FILE] 612 lines",
              "utils.py": "[FILE] 531 lines"
            },
            "param_functions.py": "[FILE] 2361 lines",
            "params.py": "[FILE] 778 lines",
            "py.typed": "[BINARY] 0 bytes",
            "requests.py": "[FILE] 3 lines",
            "responses.py": "[FILE] 49 lines",
            "routing.py": "[FILE] 4363 lines",
            "security": {
              "__init__.py": "[FILE] 16 lines",
              "api_key.py": "[FILE] 302 lines",
              "base.py": "[FILE] 7 lines",
              "http.py": "[FILE] 421 lines",
              "oauth2.py": "[FILE] 639 lines",
              "open_id_connect_url.py": "[FILE] 85 lines",
              "utils.py": "[FILE] 11 lines"
            },
            "staticfiles.py": "[FILE] 2 lines",
            "templating.py": "[FILE] 2 lines",
            "testclient.py": "[FILE] 2 lines",
            "types.py": "[FILE] 12 lines",
            "utils.py": "[FILE] 230 lines",
            "websockets.py": "[FILE] 4 lines"
          },
          "fastapi-0.104.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 24298 bytes",
            "RECORD": "[BINARY] 6399 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1086 bytes"
            }
          },
          "greenlet": {
            "CObjects.cpp": "[BINARY] 3508 bytes",
            "PyGreenlet.cpp": "[BINARY] 26311 bytes",
            "PyGreenlet.hpp": "[BINARY] 1463 bytes",
            "PyGreenletUnswitchable.cpp": "[BINARY] 4375 bytes",
            "PyModule.cpp": "[BINARY] 8649 bytes",
            "TBrokenGreenlet.cpp": "[BINARY] 1021 bytes",
            "TExceptionState.cpp": "[BINARY] 1359 bytes",
            "TGreenlet.cpp": "[BINARY] 25909 bytes",
            "TGreenlet.hpp": "[BINARY] 28700 bytes",
            "TGreenletGlobals.cpp": "[BINARY] 3264 bytes",
            "TMainGreenlet.cpp": "[BINARY] 3420 bytes",
            "TPythonState.cpp": "[BINARY] 17155 bytes",
            "TStackState.cpp": "[BINARY] 7381 bytes",
            "TThreadState.hpp": "[BINARY] 20439 bytes",
            "TThreadStateCreator.hpp": "[BINARY] 2620 bytes",
            "TThreadStateDestroy.cpp": "[BINARY] 8395 bytes",
            "TUserGreenlet.cpp": "[BINARY] 23553 bytes",
            "__init__.py": "[FILE] 72 lines",
            "_greenlet.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1448744 bytes",
            "greenlet.cpp": "[BINARY] 11093 bytes",
            "greenlet.h": "[BINARY] 4755 bytes",
            "greenlet_allocator.hpp": "[BINARY] 1835 bytes",
            "greenlet_compiler_compat.hpp": "[BINARY] 4346 bytes",
            "greenlet_cpython_compat.hpp": "[BINARY] 4253 bytes",
            "greenlet_exceptions.hpp": "[BINARY] 4503 bytes",
            "greenlet_internal.hpp": "[BINARY] 2709 bytes",
            "greenlet_msvc_compat.hpp": "[BINARY] 3195 bytes",
            "greenlet_refs.hpp": "[BINARY] 34436 bytes",
            "greenlet_slp_switch.hpp": "[BINARY] 3298 bytes",
            "greenlet_thread_support.hpp": "[BINARY] 867 bytes",
            "platform": {
              "__init__.py": "[FILE] 1 lines",
              "setup_switch_x64_masm.cmd": "[BINARY] 143 bytes",
              "switch_aarch64_gcc.h": "[BINARY] 4307 bytes",
              "switch_alpha_unix.h": "[BINARY] 671 bytes",
              "switch_amd64_unix.h": "[BINARY] 2748 bytes",
              "switch_arm32_gcc.h": "[BINARY] 2479 bytes",
              "switch_arm32_ios.h": "[BINARY] 1892 bytes",
              "switch_arm64_masm.asm": "[BINARY] 1245 bytes",
              "switch_arm64_masm.obj": "[BINARY] 746 bytes",
              "switch_arm64_msvc.h": "[BINARY] 398 bytes",
              "switch_csky_gcc.h": "[BINARY] 1331 bytes",
              "switch_loongarch64_linux.h": "[BINARY] 779 bytes",
              "switch_m68k_gcc.h": "[BINARY] 928 bytes",
              "switch_mips_unix.h": "[BINARY] 1462 bytes",
              "switch_ppc64_aix.h": "[BINARY] 3860 bytes",
              "switch_ppc64_linux.h": "[BINARY] 3815 bytes",
              "switch_ppc_aix.h": "[BINARY] 2941 bytes",
              "switch_ppc_linux.h": "[BINARY] 2759 bytes",
              "switch_ppc_macosx.h": "[BINARY] 2624 bytes",
              "switch_ppc_unix.h": "[BINARY] 2652 bytes",
              "switch_riscv_unix.h": "[BINARY] 949 bytes",
              "switch_s390_unix.h": "[BINARY] 2763 bytes",
              "switch_sh_gcc.h": "[BINARY] 901 bytes",
              "switch_sparc_sun_gcc.h": "[BINARY] 2797 bytes",
              "switch_x32_unix.h": "[BINARY] 1509 bytes",
              "switch_x64_masm.asm": "[BINARY] 1841 bytes",
              "switch_x64_masm.obj": "[BINARY] 1078 bytes",
              "switch_x64_msvc.h": "[BINARY] 1805 bytes",
              "switch_x86_msvc.h": "[BINARY] 12838 bytes",
              "switch_x86_unix.h": "[BINARY] 3059 bytes"
            },
            "slp_platformselect.h": "[BINARY] 3959 bytes",
            "tests": {
              "__init__.py": "[FILE] 249 lines",
              "_test_extension.c": "[BINARY] 6921 bytes",
              "_test_extension.cpython-312-x86_64-linux-gnu.so": "[BINARY] 17256 bytes",
              "_test_extension_cpp.cpp": "[BINARY] 6686 bytes",
              "_test_extension_cpp.cpython-312-x86_64-linux-gnu.so": "[BINARY] 58384 bytes",
              "fail_clearing_run_switches.py": "[FILE] 48 lines",
              "fail_cpp_exception.py": "[FILE] 34 lines",
              "fail_initialstub_already_started.py": "[FILE] 79 lines",
              "fail_slp_switch.py": "[FILE] 30 lines",
              "fail_switch_three_greenlets.py": "[FILE] 45 lines",
              "fail_switch_three_greenlets2.py": "[FILE] 56 lines",
              "fail_switch_two_greenlets.py": "[FILE] 42 lines",
              "leakcheck.py": "[FILE] 337 lines",
              "test_contextvars.py": "[FILE] 313 lines",
              "test_cpp.py": "[FILE] 74 lines",
              "test_extension_interface.py": "[FILE] 116 lines",
              "test_gc.py": "[FILE] 87 lines",
              "test_generator.py": "[FILE] 60 lines",
              "test_generator_nested.py": "[FILE] 169 lines",
              "test_greenlet.py": "[FILE] 1366 lines",
              "test_greenlet_trash.py": "[FILE] 188 lines",
              "test_interpreter_shutdown.py": "[FILE] 321 lines",
              "test_leaks.py": "[FILE] 475 lines",
              "test_stack_saved.py": "[FILE] 20 lines",
              "test_throw.py": "[FILE] 129 lines",
              "test_tracing.py": "[FILE] 300 lines",
              "test_version.py": "[FILE] 42 lines",
              "test_weakref.py": "[FILE] 36 lines"
            }
          },
          "greenlet-3.3.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3731 bytes",
            "RECORD": "[BINARY] 10609 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1434 bytes",
              "LICENSE.PSF": "[BINARY] 2424 bytes"
            },
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "h11": {
            "__init__.py": "[FILE] 63 lines",
            "_abnf.py": "[FILE] 133 lines",
            "_connection.py": "[FILE] 660 lines",
            "_events.py": "[FILE] 370 lines",
            "_headers.py": "[FILE] 283 lines",
            "_readers.py": "[FILE] 251 lines",
            "_receivebuffer.py": "[FILE] 154 lines",
            "_state.py": "[FILE] 366 lines",
            "_util.py": "[FILE] 136 lines",
            "_version.py": "[FILE] 17 lines",
            "_writers.py": "[FILE] 146 lines",
            "py.typed": "[BINARY] 7 bytes"
          },
          "h11-0.16.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8348 bytes",
            "RECORD": "[BINARY] 1830 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 1124 bytes"
            },
            "top_level.txt": "[BINARY] 4 bytes"
          },
          "httpcore": {
            "__init__.py": "[FILE] 142 lines",
            "_api.py": "[FILE] 95 lines",
            "_async": {
              "__init__.py": "[FILE] 40 lines",
              "connection.py": "[FILE] 223 lines",
              "connection_pool.py": "[FILE] 421 lines",
              "http11.py": "[FILE] 380 lines",
              "http2.py": "[FILE] 593 lines",
              "http_proxy.py": "[FILE] 368 lines",
              "interfaces.py": "[FILE] 138 lines",
              "socks_proxy.py": "[FILE] 342 lines"
            },
            "_backends": {
              "__init__.py": "[FILE] 1 lines",
              "anyio.py": "[FILE] 147 lines",
              "auto.py": "[FILE] 53 lines",
              "base.py": "[FILE] 102 lines",
              "mock.py": "[FILE] 144 lines",
              "sync.py": "[FILE] 242 lines",
              "trio.py": "[FILE] 160 lines"
            },
            "_exceptions.py": "[FILE] 82 lines",
            "_models.py": "[FILE] 517 lines",
            "_ssl.py": "[FILE] 10 lines",
            "_sync": {
              "__init__.py": "[FILE] 40 lines",
              "connection.py": "[FILE] 223 lines",
              "connection_pool.py": "[FILE] 421 lines",
              "http11.py": "[FILE] 380 lines",
              "http2.py": "[FILE] 593 lines",
              "http_proxy.py": "[FILE] 368 lines",
              "interfaces.py": "[FILE] 138 lines",
              "socks_proxy.py": "[FILE] 342 lines"
            },
            "_synchronization.py": "[FILE] 319 lines",
            "_trace.py": "[FILE] 108 lines",
            "_utils.py": "[FILE] 38 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "httpcore-1.0.9.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 21529 bytes",
            "RECORD": "[BINARY] 4762 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 28 lines"
            }
          },
          "httptools": {
            "__init__.py": "[FILE] 7 lines",
            "_version.py": "[FILE] 14 lines",
            "parser": {
              "__init__.py": "[FILE] 7 lines",
              "cparser.pxd": "[BINARY] 4977 bytes",
              "errors.py": "[FILE] 31 lines",
              "parser.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1264464 bytes",
              "parser.pyi": "[BINARY] 1861 bytes",
              "parser.pyx": "[BINARY] 15140 bytes",
              "protocol.py": "[FILE] 16 lines",
              "python.pxd": "[BINARY] 138 bytes",
              "url_cparser.pxd": "[BINARY] 779 bytes",
              "url_parser.cpython-312-x86_64-linux-gnu.so": "[BINARY] 483328 bytes",
              "url_parser.pyi": "[BINARY] 565 bytes",
              "url_parser.pyx": "[BINARY] 3758 bytes"
            }
          },
          "httptools-0.7.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3472 bytes",
            "RECORD": "[BINARY] 2021 bytes",
            "WHEEL": "[BINARY] 186 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1093 bytes"
            },
            "top_level.txt": "[BINARY] 10 bytes"
          },
          "httpx": {
            "__init__.py": "[FILE] 139 lines",
            "__version__.py": "[FILE] 4 lines",
            "_api.py": "[FILE] 446 lines",
            "_auth.py": "[FILE] 353 lines",
            "_client.py": "[FILE] 2007 lines",
            "_compat.py": "[FILE] 42 lines",
            "_config.py": "[FILE] 369 lines",
            "_content.py": "[FILE] 239 lines",
            "_decoders.py": "[FILE] 325 lines",
            "_exceptions.py": "[FILE] 344 lines",
            "_main.py": "[FILE] 507 lines",
            "_models.py": "[FILE] 1215 lines",
            "_multipart.py": "[FILE] 267 lines",
            "_status_codes.py": "[FILE] 159 lines",
            "_transports": {
              "__init__.py": "[FILE] 1 lines",
              "asgi.py": "[FILE] 180 lines",
              "base.py": "[FILE] 83 lines",
              "default.py": "[FILE] 379 lines",
              "mock.py": "[FILE] 39 lines",
              "wsgi.py": "[FILE] 145 lines"
            },
            "_types.py": "[FILE] 134 lines",
            "_urlparse.py": "[FILE] 465 lines",
            "_urls.py": "[FILE] 643 lines",
            "_utils.py": "[FILE] 443 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "httpx-0.25.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 7095 bytes",
            "RECORD": "[BINARY] 3727 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "entry_points.txt": "[BINARY] 37 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 13 lines"
            }
          },
          "idna": {
            "__init__.py": "[FILE] 46 lines",
            "codec.py": "[FILE] 123 lines",
            "compat.py": "[FILE] 16 lines",
            "core.py": "[FILE] 438 lines",
            "idnadata.py": "[FILE] 4310 lines",
            "intranges.py": "[FILE] 58 lines",
            "package_data.py": "[FILE] 2 lines",
            "py.typed": "[BINARY] 0 bytes",
            "uts46data.py": "[FILE] 8842 lines"
          },
          "idna-3.11.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8378 bytes",
            "RECORD": "[BINARY] 1392 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 32 lines"
            }
          },
          "jose": {
            "__init__.py": "[FILE] 11 lines",
            "backends": {
              "__init__.py": "[FILE] 33 lines",
              "_asn1.py": "[FILE] 84 lines",
              "base.py": "[FILE] 90 lines",
              "cryptography_backend.py": "[FILE] 606 lines",
              "ecdsa_backend.py": "[FILE] 151 lines",
              "native.py": "[FILE] 77 lines",
              "rsa_backend.py": "[FILE] 285 lines"
            },
            "constants.py": "[FILE] 99 lines",
            "exceptions.py": "[FILE] 60 lines",
            "jwe.py": "[FILE] 608 lines",
            "jwk.py": "[FILE] 80 lines",
            "jws.py": "[FILE] 267 lines",
            "jwt.py": "[FILE] 497 lines",
            "utils.py": "[FILE] 109 lines"
          },
          "kombu": {
            "__init__.py": "[FILE] 116 lines",
            "abstract.py": "[FILE] 144 lines",
            "asynchronous": {
              "__init__.py": "[FILE] 10 lines",
              "aws": {
                "__init__.py": "[FILE] 18 lines",
                "connection.py": "[FILE] 279 lines",
                "ext.py": "[FILE] 34 lines",
                "sqs": {
                  "__init__.py": "[FILE] 1 lines",
                  "connection.py": "[FILE] 336 lines",
                  "ext.py": "[FILE] 10 lines",
                  "message.py": "[FILE] 36 lines",
                  "queue.py": "[FILE] 131 lines"
                }
              },
              "debug.py": "[FILE] 68 lines",
              "http": {
                "__init__.py": "[FILE] 29 lines",
                "base.py": "[FILE] 275 lines",
                "curl.py": "[FILE] 294 lines"
              },
              "hub.py": "[FILE] 404 lines",
              "semaphore.py": "[FILE] 128 lines",
              "timer.py": "[FILE] 242 lines"
            },
            "clocks.py": "[FILE] 157 lines",
            "common.py": "[FILE] 457 lines",
            "compat.py": "[FILE] 228 lines",
            "compression.py": "[FILE] 122 lines",
            "connection.py": "[FILE] 1145 lines",
            "entity.py": "[FILE] 888 lines",
            "exceptions.py": "[FILE] 113 lines",
            "log.py": "[FILE] 144 lines",
            "matcher.py": "[FILE] 145 lines",
            "message.py": "[FILE] 235 lines",
            "messaging.py": "[FILE] 679 lines",
            "mixins.py": "[FILE] 304 lines",
            "pidbox.py": "[FILE] 424 lines",
            "pools.py": "[FILE] 153 lines",
            "resource.py": "[FILE] 232 lines",
            "serialization.py": "[FILE] 464 lines",
            "simple.py": "[FILE] 164 lines",
            "transport": {
              "SLMQ.py": "[FILE] 203 lines",
              "SQS.py": "[FILE] 1185 lines",
              "__init__.py": "[FILE] 94 lines",
              "azureservicebus.py": "[FILE] 499 lines",
              "azurestoragequeues.py": "[FILE] 264 lines",
              "base.py": "[FILE] 272 lines",
              "confluentkafka.py": "[FILE] 381 lines",
              "consul.py": "[FILE] 324 lines",
              "etcd.py": "[FILE] 301 lines",
              "filesystem.py": "[FILE] 353 lines",
              "gcpubsub.py": "[FILE] 820 lines",
              "librabbitmq.py": "[FILE] 191 lines",
              "memory.py": "[FILE] 107 lines",
              "mongodb.py": "[FILE] 555 lines",
              "native_delayed_delivery.py": "[FILE] 135 lines",
              "pyamqp.py": "[FILE] 254 lines",
              "pyro.py": "[FILE] 213 lines",
              "qpid.py": "[FILE] 1749 lines",
              "redis.py": "[FILE] 1502 lines",
              "sqlalchemy": {
                "__init__.py": "[FILE] 263 lines",
                "models.py": "[FILE] 77 lines"
              },
              "virtual": {
                "__init__.py": "[FILE] 12 lines",
                "base.py": "[FILE] 1040 lines",
                "exchange.py": "[FILE] 165 lines"
              },
              "zookeeper.py": "[FILE] 224 lines"
            },
            "utils": {
              "__init__.py": "[FILE] 21 lines",
              "amq_manager.py": "[FILE] 23 lines",
              "collections.py": "[FILE] 46 lines",
              "compat.py": "[FILE] 138 lines",
              "debug.py": "[FILE] 78 lines",
              "div.py": "[FILE] 38 lines",
              "encoding.py": "[FILE] 98 lines",
              "eventio.py": "[FILE] 330 lines",
              "functional.py": "[FILE] 361 lines",
              "imports.py": "[FILE] 69 lines",
              "json.py": "[FILE] 147 lines",
              "limits.py": "[FILE] 88 lines",
              "objects.py": "[FILE] 68 lines",
              "scheduling.py": "[FILE] 112 lines",
              "text.py": "[FILE] 74 lines",
              "time.py": "[FILE] 10 lines",
              "url.py": "[FILE] 133 lines",
              "uuid.py": "[FILE] 16 lines"
            }
          },
          "kombu-5.6.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3465 bytes",
            "RECORD": "[BINARY] 11150 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1664 bytes"
            },
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "mako": {
            "__init__.py": "[FILE] 9 lines",
            "_ast_util.py": "[FILE] 714 lines",
            "ast.py": "[FILE] 203 lines",
            "cache.py": "[FILE] 240 lines",
            "cmd.py": "[FILE] 100 lines",
            "codegen.py": "[FILE] 1320 lines",
            "compat.py": "[FILE] 71 lines",
            "exceptions.py": "[FILE] 418 lines",
            "ext": {
              "__init__.py": "[FILE] 1 lines",
              "autohandler.py": "[FILE] 71 lines",
              "babelplugin.py": "[FILE] 58 lines",
              "beaker_cache.py": "[FILE] 83 lines",
              "extract.py": "[FILE] 130 lines",
              "linguaplugin.py": "[FILE] 58 lines",
              "preprocessors.py": "[FILE] 21 lines",
              "pygmentplugin.py": "[FILE] 151 lines",
              "turbogears.py": "[FILE] 62 lines"
            },
            "filters.py": "[FILE] 164 lines",
            "lexer.py": "[FILE] 482 lines",
            "lookup.py": "[FILE] 362 lines",
            "parsetree.py": "[FILE] 657 lines",
            "pygen.py": "[FILE] 310 lines",
            "pyparser.py": "[FILE] 236 lines",
            "runtime.py": "[FILE] 969 lines",
            "template.py": "[FILE] 712 lines",
            "testing": {
              "__init__.py": "[FILE] 1 lines",
              "_config.py": "[FILE] 129 lines",
              "assertions.py": "[FILE] 167 lines",
              "config.py": "[FILE] 18 lines",
              "exclusions.py": "[FILE] 81 lines",
              "fixtures.py": "[FILE] 120 lines",
              "helpers.py": "[FILE] 72 lines"
            },
            "util.py": "[FILE] 389 lines"
          },
          "mako-1.3.10.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2919 bytes",
            "RECORD": "[BINARY] 4761 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "entry_points.txt": "[BINARY] 512 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1098 bytes"
            },
            "top_level.txt": "[BINARY] 5 bytes"
          },
          "markupsafe": {
            "__init__.py": "[FILE] 397 lines",
            "_native.py": "[FILE] 9 lines",
            "_speedups.c": "[BINARY] 4327 bytes",
            "_speedups.cpython-312-x86_64-linux-gnu.so": "[BINARY] 44072 bytes",
            "_speedups.pyi": "[BINARY] 41 bytes",
            "py.typed": "[BINARY] 0 bytes"
          },
          "markupsafe-3.0.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2690 bytes",
            "RECORD": "[BINARY] 1116 bytes",
            "WHEEL": "[BINARY] 190 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 1475 bytes"
            },
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "multipart": {
            "__init__.py": "[FILE] 16 lines",
            "decoders.py": "[FILE] 172 lines",
            "exceptions.py": "[FILE] 47 lines",
            "multipart.py": "[FILE] 1894 lines",
            "tests": {
              "__init__.py": "[FILE] 1 lines",
              "compat.py": "[FILE] 134 lines",
              "test_data": {
                "http": {
                  "CR_in_header.http": "[BINARY] 149 bytes",
                  "CR_in_header.yaml": "[FILE] 4 lines",
                  "CR_in_header_value.http": "[BINARY] 149 bytes",
                  "CR_in_header_value.yaml": "[FILE] 4 lines",
                  "almost_match_boundary.http": "[BINARY] 264 bytes",
                  "almost_match_boundary.yaml": "[FILE] 9 lines",
                  "almost_match_boundary_without_CR.http": "[BINARY] 132 bytes",
                  "almost_match_boundary_without_CR.yaml": "[FILE] 9 lines",
                  "almost_match_boundary_without_LF.http": "[BINARY] 133 bytes",
                  "almost_match_boundary_without_LF.yaml": "[FILE] 9 lines",
                  "almost_match_boundary_without_final_hyphen.http": "[BINARY] 133 bytes",
                  "almost_match_boundary_without_final_hyphen.yaml": "[FILE] 9 lines",
                  "bad_end_of_headers.http": "[BINARY] 149 bytes",
                  "bad_end_of_headers.yaml": "[FILE] 4 lines",
                  "bad_header_char.http": "[BINARY] 149 bytes",
                  "bad_header_char.yaml": "[FILE] 4 lines",
                  "bad_initial_boundary.http": "[BINARY] 149 bytes",
                  "bad_initial_boundary.yaml": "[FILE] 4 lines",
                  "base64_encoding.http": "[BINARY] 173 bytes",
                  "base64_encoding.yaml": "[FILE] 8 lines",
                  "empty_header.http": "[BINARY] 130 bytes",
                  "empty_header.yaml": "[FILE] 4 lines",
                  "multiple_fields.http": "[BINARY] 242 bytes",
                  "multiple_fields.yaml": "[FILE] 11 lines",
                  "multiple_files.http": "[BINARY] 348 bytes",
                  "multiple_files.yaml": "[FILE] 14 lines",
                  "quoted_printable_encoding.http": "[BINARY] 180 bytes",
                  "quoted_printable_encoding.yaml": "[FILE] 8 lines",
                  "single_field.http": "[BINARY] 149 bytes",
                  "single_field.yaml": "[FILE] 7 lines",
                  "single_field_blocks.http": "[BINARY] 115 bytes",
                  "single_field_blocks.yaml": "[FILE] 7 lines",
                  "single_field_longer.http": "[BINARY] 262 bytes",
                  "single_field_longer.yaml": "[FILE] 7 lines",
                  "single_field_single_file.http": "[BINARY] 192 bytes",
                  "single_field_single_file.yaml": "[FILE] 14 lines",
                  "single_field_with_leading_newlines.http": "[BINARY] 153 bytes",
                  "single_field_with_leading_newlines.yaml": "[FILE] 7 lines",
                  "single_file.http": "[BINARY] 202 bytes",
                  "single_file.yaml": "[FILE] 9 lines",
                  "utf8_filename.http": "[BINARY] 208 bytes",
                  "utf8_filename.yaml": "[FILE] 9 lines"
                }
              },
              "test_multipart.py": "[FILE] 1306 lines"
            }
          },
          "networkx": {
            "__init__.py": "[FILE] 50 lines",
            "algorithms": {
              "__init__.py": "[FILE] 133 lines",
              "approximation": {
                "__init__.py": "[FILE] 25 lines",
                "clique.py": "[FILE] 259 lines",
                "clustering_coefficient.py": "[FILE] 67 lines",
                "connectivity.py": "[FILE] 413 lines",
                "dominating_set.py": "[FILE] 127 lines",
                "kcomponents.py": "[FILE] 370 lines",
                "matching.py": "[FILE] 44 lines",
                "maxcut.py": "[FILE] 114 lines",
                "ramsey.py": "[FILE] 53 lines",
                "steinertree.py": "[FILE] 221 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_approx_clust_coeff.py": "[FILE] 42 lines",
                  "test_clique.py": "[FILE] 114 lines",
                  "test_connectivity.py": "[FILE] 200 lines",
                  "test_distance_measures.py": "[FILE] 61 lines",
                  "test_dominating_set.py": "[FILE] 79 lines",
                  "test_kcomponents.py": "[FILE] 304 lines",
                  "test_matching.py": "[FILE] 9 lines",
                  "test_maxcut.py": "[FILE] 83 lines",
                  "test_ramsey.py": "[FILE] 32 lines",
                  "test_steinertree.py": "[FILE] 192 lines",
                  "test_traveling_salesman.py": "[FILE] 964 lines",
                  "test_treewidth.py": "[FILE] 281 lines",
                  "test_vertex_cover.py": "[FILE] 69 lines"
                },
                "traveling_salesman.py": "[FILE] 1443 lines",
                "treewidth.py": "[FILE] 253 lines",
                "vertex_cover.py": "[FILE] 83 lines"
              },
              "assortativity": {
                "__init__.py": "[FILE] 6 lines",
                "connectivity.py": "[FILE] 123 lines",
                "correlation.py": "[FILE] 303 lines",
                "mixing.py": "[FILE] 251 lines",
                "neighbor_degree.py": "[FILE] 161 lines",
                "pairs.py": "[FILE] 119 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "base_test.py": "[FILE] 82 lines",
                  "test_connectivity.py": "[FILE] 144 lines",
                  "test_correlation.py": "[FILE] 124 lines",
                  "test_mixing.py": "[FILE] 177 lines",
                  "test_neighbor_degree.py": "[FILE] 109 lines",
                  "test_pairs.py": "[FILE] 88 lines"
                }
              },
              "asteroidal.py": "[FILE] 171 lines",
              "bipartite": {
                "__init__.py": "[FILE] 88 lines",
                "basic.py": "[FILE] 322 lines",
                "centrality.py": "[FILE] 291 lines",
                "cluster.py": "[FILE] 281 lines",
                "covering.py": "[FILE] 58 lines",
                "edgelist.py": "[FILE] 360 lines",
                "extendability.py": "[FILE] 106 lines",
                "generators.py": "[FILE] 604 lines",
                "matching.py": "[FILE] 590 lines",
                "matrix.py": "[FILE] 168 lines",
                "projection.py": "[FILE] 529 lines",
                "redundancy.py": "[FILE] 112 lines",
                "spectral.py": "[FILE] 69 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_basic.py": "[FILE] 126 lines",
                  "test_centrality.py": "[FILE] 193 lines",
                  "test_cluster.py": "[FILE] 85 lines",
                  "test_covering.py": "[FILE] 34 lines",
                  "test_edgelist.py": "[FILE] 230 lines",
                  "test_extendability.py": "[FILE] 327 lines",
                  "test_generators.py": "[FILE] 401 lines",
                  "test_matching.py": "[FILE] 327 lines",
                  "test_matrix.py": "[FILE] 80 lines",
                  "test_project.py": "[FILE] 408 lines",
                  "test_redundancy.py": "[FILE] 38 lines",
                  "test_spectral_bipartivity.py": "[FILE] 81 lines"
                }
              },
              "boundary.py": "[FILE] 168 lines",
              "bridges.py": "[FILE] 206 lines",
              "centrality": {
                "__init__.py": "[FILE] 21 lines",
                "betweenness.py": "[FILE] 436 lines",
                "betweenness_subset.py": "[FILE] 275 lines",
                "closeness.py": "[FILE] 282 lines",
                "current_flow_betweenness.py": "[FILE] 344 lines",
                "current_flow_betweenness_subset.py": "[FILE] 227 lines",
                "current_flow_closeness.py": "[FILE] 98 lines",
                "degree_alg.py": "[FILE] 150 lines",
                "dispersion.py": "[FILE] 108 lines",
                "eigenvector.py": "[FILE] 342 lines",
                "flow_matrix.py": "[FILE] 131 lines",
                "group.py": "[FILE] 786 lines",
                "harmonic.py": "[FILE] 81 lines",
                "katz.py": "[FILE] 332 lines",
                "laplacian.py": "[FILE] 147 lines",
                "load.py": "[FILE] 200 lines",
                "percolation.py": "[FILE] 129 lines",
                "reaching.py": "[FILE] 207 lines",
                "second_order.py": "[FILE] 139 lines",
                "subgraph_alg.py": "[FILE] 341 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_betweenness_centrality.py": "[FILE] 781 lines",
                  "test_betweenness_centrality_subset.py": "[FILE] 341 lines",
                  "test_closeness_centrality.py": "[FILE] 307 lines",
                  "test_current_flow_betweenness_centrality.py": "[FILE] 198 lines",
                  "test_current_flow_betweenness_centrality_subset.py": "[FILE] 148 lines",
                  "test_current_flow_closeness.py": "[FILE] 44 lines",
                  "test_degree_centrality.py": "[FILE] 145 lines",
                  "test_dispersion.py": "[FILE] 74 lines",
                  "test_eigenvector_centrality.py": "[FILE] 176 lines",
                  "test_group.py": "[FILE] 279 lines",
                  "test_harmonic_centrality.py": "[FILE] 116 lines",
                  "test_katz_centrality.py": "[FILE] 346 lines",
                  "test_laplacian_centrality.py": "[FILE] 222 lines",
                  "test_load_centrality.py": "[FILE] 345 lines",
                  "test_percolation_centrality.py": "[FILE] 88 lines",
                  "test_reaching.py": "[FILE] 118 lines",
                  "test_second_order_centrality.py": "[FILE] 83 lines",
                  "test_subgraph.py": "[FILE] 111 lines",
                  "test_trophic.py": "[FILE] 303 lines",
                  "test_voterank.py": "[FILE] 66 lines"
                },
                "trophic.py": "[FILE] 163 lines",
                "voterank_alg.py": "[FILE] 95 lines"
              },
              "chains.py": "[FILE] 173 lines",
              "chordal.py": "[FILE] 441 lines",
              "clique.py": "[FILE] 754 lines",
              "cluster.py": "[FILE] 606 lines",
              "coloring": {
                "__init__.py": "[FILE] 5 lines",
                "equitable_coloring.py": "[FILE] 506 lines",
                "greedy_coloring.py": "[FILE] 573 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_coloring.py": "[FILE] 866 lines"
                }
              },
              "communicability_alg.py": "[FILE] 163 lines",
              "community": {
                "__init__.py": "[FILE] 25 lines",
                "asyn_fluid.py": "[FILE] 151 lines",
                "centrality.py": "[FILE] 172 lines",
                "community_utils.py": "[FILE] 30 lines",
                "kclique.py": "[FILE] 80 lines",
                "kernighan_lin.py": "[FILE] 140 lines",
                "label_propagation.py": "[FILE] 338 lines",
                "louvain.py": "[FILE] 374 lines",
                "lukes.py": "[FILE] 227 lines",
                "modularity_max.py": "[FILE] 449 lines",
                "quality.py": "[FILE] 347 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_asyn_fluid.py": "[FILE] 130 lines",
                  "test_centrality.py": "[FILE] 85 lines",
                  "test_kclique.py": "[FILE] 92 lines",
                  "test_kernighan_lin.py": "[FILE] 92 lines",
                  "test_label_propagation.py": "[FILE] 241 lines",
                  "test_louvain.py": "[FILE] 245 lines",
                  "test_lukes.py": "[FILE] 153 lines",
                  "test_modularity_max.py": "[FILE] 334 lines",
                  "test_quality.py": "[FILE] 139 lines",
                  "test_utils.py": "[FILE] 29 lines"
                }
              },
              "components": {
                "__init__.py": "[FILE] 7 lines",
                "attracting.py": "[FILE] 115 lines",
                "biconnected.py": "[FILE] 394 lines",
                "connected.py": "[FILE] 209 lines",
                "semiconnected.py": "[FILE] 71 lines",
                "strongly_connected.py": "[FILE] 432 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_attracting.py": "[FILE] 71 lines",
                  "test_biconnected.py": "[FILE] 249 lines",
                  "test_connected.py": "[FILE] 118 lines",
                  "test_semiconnected.py": "[FILE] 56 lines",
                  "test_strongly_connected.py": "[FILE] 208 lines",
                  "test_weakly_connected.py": "[FILE] 91 lines"
                },
                "weakly_connected.py": "[FILE] 197 lines"
              },
              "connectivity": {
                "__init__.py": "[FILE] 12 lines",
                "connectivity.py": "[FILE] 827 lines",
                "cuts.py": "[FILE] 616 lines",
                "disjoint_paths.py": "[FILE] 413 lines",
                "edge_augmentation.py": "[FILE] 1270 lines",
                "edge_kcomponents.py": "[FILE] 585 lines",
                "kcomponents.py": "[FILE] 223 lines",
                "kcutsets.py": "[FILE] 234 lines",
                "stoerwagner.py": "[FILE] 151 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_connectivity.py": "[FILE] 422 lines",
                  "test_cuts.py": "[FILE] 310 lines",
                  "test_disjoint_paths.py": "[FILE] 250 lines",
                  "test_edge_augmentation.py": "[FILE] 503 lines",
                  "test_edge_kcomponents.py": "[FILE] 489 lines",
                  "test_kcomponents.py": "[FILE] 297 lines",
                  "test_kcutsets.py": "[FILE] 267 lines",
                  "test_stoer_wagner.py": "[FILE] 103 lines"
                },
                "utils.py": "[FILE] 88 lines"
              },
              "core.py": "[FILE] 546 lines",
              "covering.py": "[FILE] 143 lines",
              "cuts.py": "[FILE] 401 lines",
              "cycles.py": "[FILE] 1231 lines",
              "d_separation.py": "[FILE] 458 lines",
              "dag.py": "[FILE] 1259 lines",
              "dominance.py": "[FILE] 136 lines",
              "dominating.py": "[FILE] 95 lines",
              "efficiency_measures.py": "[FILE] 169 lines",
              "euler.py": "[FILE] 470 lines",
              "flow": {
                "__init__.py": "[FILE] 12 lines",
                "boykovkolmogorov.py": "[FILE] 374 lines",
                "capacityscaling.py": "[FILE] 406 lines",
                "dinitz_alg.py": "[FILE] 218 lines",
                "edmondskarp.py": "[FILE] 251 lines",
                "gomory_hu.py": "[FILE] 178 lines",
                "maxflow.py": "[FILE] 608 lines",
                "mincost.py": "[FILE] 336 lines",
                "networksimplex.py": "[FILE] 665 lines",
                "preflowpush.py": "[FILE] 430 lines",
                "shortestaugmentingpath.py": "[FILE] 305 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "gl1.gpickle.bz2": "[BINARY] 44623 bytes",
                  "gw1.gpickle.bz2": "[BINARY] 42248 bytes",
                  "netgen-2.gpickle.bz2": "[BINARY] 18972 bytes",
                  "test_gomory_hu.py": "[FILE] 129 lines",
                  "test_maxflow.py": "[FILE] 561 lines",
                  "test_maxflow_large_graph.py": "[FILE] 158 lines",
                  "test_mincost.py": "[FILE] 477 lines",
                  "test_networksimplex.py": "[FILE] 388 lines",
                  "wlm3.gpickle.bz2": "[BINARY] 88132 bytes"
                },
                "utils.py": "[FILE] 189 lines"
              },
              "graph_hashing.py": "[FILE] 314 lines",
              "graphical.py": "[FILE] 484 lines",
              "hierarchy.py": "[FILE] 49 lines",
              "hybrid.py": "[FILE] 196 lines",
              "isolate.py": "[FILE] 108 lines",
              "isomorphism": {
                "__init__.py": "[FILE] 8 lines",
                "ismags.py": "[FILE] 1170 lines",
                "isomorph.py": "[FILE] 249 lines",
                "isomorphvf2.py": "[FILE] 1061 lines",
                "matchhelpers.py": "[FILE] 353 lines",
                "temporalisomorphvf2.py": "[FILE] 309 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "iso_r01_s80.A99": "[BINARY] 1442 bytes",
                  "iso_r01_s80.B99": "[BINARY] 1442 bytes",
                  "si2_b06_m200.A99": "[BINARY] 310 bytes",
                  "si2_b06_m200.B99": "[BINARY] 1602 bytes",
                  "test_ismags.py": "[FILE] 328 lines",
                  "test_isomorphism.py": "[FILE] 41 lines",
                  "test_isomorphvf2.py": "[FILE] 411 lines",
                  "test_match_helpers.py": "[FILE] 65 lines",
                  "test_temporalisomorphvf2.py": "[FILE] 212 lines",
                  "test_tree_isomorphism.py": "[FILE] 283 lines",
                  "test_vf2pp.py": "[FILE] 1609 lines",
                  "test_vf2pp_helpers.py": "[FILE] 3104 lines",
                  "test_vf2userfunc.py": "[FILE] 201 lines"
                },
                "tree_isomorphism.py": "[FILE] 284 lines",
                "vf2pp.py": "[FILE] 1069 lines",
                "vf2userfunc.py": "[FILE] 193 lines"
              },
              "link_analysis": {
                "__init__.py": "[FILE] 3 lines",
                "hits_alg.py": "[FILE] 335 lines",
                "pagerank_alg.py": "[FILE] 500 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_hits.py": "[FILE] 79 lines",
                  "test_pagerank.py": "[FILE] 218 lines"
                }
              },
              "link_prediction.py": "[FILE] 605 lines",
              "lowest_common_ancestors.py": "[FILE] 269 lines",
              "matching.py": "[FILE] 1152 lines",
              "minors": {
                "__init__.py": "[FILE] 28 lines",
                "contraction.py": "[FILE] 631 lines",
                "tests": {
                  "test_contraction.py": "[FILE] 446 lines"
                }
              },
              "mis.py": "[FILE] 78 lines",
              "moral.py": "[FILE] 60 lines",
              "node_classification.py": "[FILE] 219 lines",
              "non_randomness.py": "[FILE] 97 lines",
              "operators": {
                "__init__.py": "[FILE] 5 lines",
                "all.py": "[FILE] 320 lines",
                "binary.py": "[FILE] 445 lines",
                "product.py": "[FILE] 535 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_all.py": "[FILE] 329 lines",
                  "test_binary.py": "[FILE] 469 lines",
                  "test_product.py": "[FILE] 436 lines",
                  "test_unary.py": "[FILE] 56 lines"
                },
                "unary.py": "[FILE] 77 lines"
              },
              "planar_drawing.py": "[FILE] 465 lines",
              "planarity.py": "[FILE] 1180 lines",
              "polynomials.py": "[FILE] 306 lines",
              "reciprocity.py": "[FILE] 98 lines",
              "regular.py": "[FILE] 213 lines",
              "richclub.py": "[FILE] 122 lines",
              "shortest_paths": {
                "__init__.py": "[FILE] 6 lines",
                "astar.py": "[FILE] 215 lines",
                "dense.py": "[FILE] 257 lines",
                "generic.py": "[FILE] 720 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_astar.py": "[FILE] 211 lines",
                  "test_dense.py": "[FILE] 213 lines",
                  "test_dense_numpy.py": "[FILE] 90 lines",
                  "test_generic.py": "[FILE] 445 lines",
                  "test_unweighted.py": "[FILE] 150 lines",
                  "test_weighted.py": "[FILE] 973 lines"
                },
                "unweighted.py": "[FILE] 571 lines",
                "weighted.py": "[FILE] 2515 lines"
              },
              "similarity.py": "[FILE] 1711 lines",
              "simple_paths.py": "[FILE] 979 lines",
              "smallworld.py": "[FILE] 404 lines",
              "smetric.py": "[FILE] 61 lines",
              "sparsifiers.py": "[FILE] 296 lines",
              "structuralholes.py": "[FILE] 284 lines",
              "summarization.py": "[FILE] 562 lines",
              "swap.py": "[FILE] 406 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_asteroidal.py": "[FILE] 24 lines",
                "test_boundary.py": "[FILE] 155 lines",
                "test_bridges.py": "[FILE] 145 lines",
                "test_chains.py": "[FILE] 141 lines",
                "test_chordal.py": "[FILE] 130 lines",
                "test_clique.py": "[FILE] 292 lines",
                "test_cluster.py": "[FILE] 544 lines",
                "test_communicability.py": "[FILE] 81 lines",
                "test_core.py": "[FILE] 186 lines",
                "test_covering.py": "[FILE] 86 lines",
                "test_cuts.py": "[FILE] 173 lines",
                "test_cycles.py": "[FILE] 972 lines",
                "test_d_separation.py": "[FILE] 229 lines",
                "test_dag.py": "[FILE] 772 lines",
                "test_distance_measures.py": "[FILE] 669 lines",
                "test_distance_regular.py": "[FILE] 67 lines",
                "test_dominance.py": "[FILE] 286 lines",
                "test_dominating.py": "[FILE] 47 lines",
                "test_efficiency.py": "[FILE] 59 lines",
                "test_euler.py": "[FILE] 308 lines",
                "test_graph_hashing.py": "[FILE] 658 lines",
                "test_graphical.py": "[FILE] 164 lines",
                "test_hierarchy.py": "[FILE] 40 lines",
                "test_hybrid.py": "[FILE] 25 lines",
                "test_isolate.py": "[FILE] 27 lines",
                "test_link_prediction.py": "[FILE] 583 lines",
                "test_lowest_common_ancestors.py": "[FILE] 428 lines",
                "test_matching.py": "[FILE] 606 lines",
                "test_max_weight_clique.py": "[FILE] 182 lines",
                "test_mis.py": "[FILE] 63 lines",
                "test_moral.py": "[FILE] 16 lines",
                "test_node_classification.py": "[FILE] 141 lines",
                "test_non_randomness.py": "[FILE] 38 lines",
                "test_planar_drawing.py": "[FILE] 275 lines",
                "test_planarity.py": "[FILE] 443 lines",
                "test_polynomials.py": "[FILE] 58 lines",
                "test_reciprocity.py": "[FILE] 38 lines",
                "test_regular.py": "[FILE] 87 lines",
                "test_richclub.py": "[FILE] 98 lines",
                "test_similarity.py": "[FILE] 924 lines",
                "test_simple_paths.py": "[FILE] 770 lines",
                "test_smallworld.py": "[FILE] 79 lines",
                "test_smetric.py": "[FILE] 37 lines",
                "test_sparsifiers.py": "[FILE] 138 lines",
                "test_structuralholes.py": "[FILE] 140 lines",
                "test_summarization.py": "[FILE] 642 lines",
                "test_swap.py": "[FILE] 157 lines",
                "test_threshold.py": "[FILE] 270 lines",
                "test_time_dependent.py": "[FILE] 432 lines",
                "test_tournament.py": "[FILE] 163 lines",
                "test_triads.py": "[FILE] 278 lines",
                "test_vitality.py": "[FILE] 42 lines",
                "test_voronoi.py": "[FILE] 104 lines",
                "test_walks.py": "[FILE] 55 lines",
                "test_wiener.py": "[FILE] 67 lines"
              },
              "threshold.py": "[FILE] 980 lines",
              "time_dependent.py": "[FILE] 143 lines",
              "tournament.py": "[FILE] 407 lines",
              "traversal": {
                "__init__.py": "[FILE] 6 lines",
                "beamsearch.py": "[FILE] 107 lines",
                "breadth_first_search.py": "[FILE] 582 lines",
                "depth_first_search.py": "[FILE] 470 lines",
                "edgebfs.py": "[FILE] 178 lines",
                "edgedfs.py": "[FILE] 176 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_beamsearch.py": "[FILE] 33 lines",
                  "test_bfs.py": "[FILE] 213 lines",
                  "test_dfs.py": "[FILE] 252 lines",
                  "test_edgebfs.py": "[FILE] 148 lines",
                  "test_edgedfs.py": "[FILE] 132 lines"
                }
              },
              "tree": {
                "__init__.py": "[FILE] 7 lines",
                "branchings.py": "[FILE] 1601 lines",
                "coding.py": "[FILE] 413 lines",
                "decomposition.py": "[FILE] 89 lines",
                "mst.py": "[FILE] 1134 lines",
                "operations.py": "[FILE] 129 lines",
                "recognition.py": "[FILE] 274 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_branchings.py": "[FILE] 633 lines",
                  "test_coding.py": "[FILE] 114 lines",
                  "test_decomposition.py": "[FILE] 80 lines",
                  "test_mst.py": "[FILE] 709 lines",
                  "test_operations.py": "[FILE] 54 lines",
                  "test_recognition.py": "[FILE] 163 lines"
                }
              },
              "triads.py": "[FILE] 566 lines",
              "vitality.py": "[FILE] 77 lines",
              "voronoi.py": "[FILE] 86 lines",
              "walks.py": "[FILE] 81 lines",
              "wiener.py": "[FILE] 80 lines"
            },
            "classes": {
              "__init__.py": "[FILE] 14 lines",
              "coreviews.py": "[FILE] 368 lines",
              "digraph.py": "[FILE] 1324 lines",
              "filters.py": "[FILE] 76 lines",
              "function.py": "[FILE] 1314 lines",
              "graph.py": "[FILE] 2031 lines",
              "graphviews.py": "[FILE] 268 lines",
              "multidigraph.py": "[FILE] 964 lines",
              "multigraph.py": "[FILE] 1279 lines",
              "reportviews.py": "[FILE] 1432 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "dispatch_interface.py": "[FILE] 195 lines",
                "historical_tests.py": "[FILE] 475 lines",
                "test_backends.py": "[FILE] 77 lines",
                "test_coreviews.py": "[FILE] 363 lines",
                "test_digraph.py": "[FILE] 332 lines",
                "test_digraph_historical.py": "[FILE] 111 lines",
                "test_filters.py": "[FILE] 178 lines",
                "test_function.py": "[FILE] 783 lines",
                "test_graph.py": "[FILE] 921 lines",
                "test_graph_historical.py": "[FILE] 13 lines",
                "test_graphviews.py": "[FILE] 351 lines",
                "test_multidigraph.py": "[FILE] 460 lines",
                "test_multigraph.py": "[FILE] 529 lines",
                "test_reportviews.py": "[FILE] 1424 lines",
                "test_special.py": "[FILE] 132 lines",
                "test_subgraphviews.py": "[FILE] 363 lines"
              }
            },
            "conftest.py": "[FILE] 266 lines",
            "convert.py": "[FILE] 497 lines",
            "convert_matrix.py": "[FILE] 1201 lines",
            "drawing": {
              "__init__.py": "[FILE] 8 lines",
              "layout.py": "[FILE] 1298 lines",
              "nx_agraph.py": "[FILE] 470 lines",
              "nx_latex.py": "[FILE] 572 lines",
              "nx_pydot.py": "[FILE] 455 lines",
              "nx_pylab.py": "[FILE] 1595 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "baseline": {
                  "test_house_with_colors.png": "[BINARY] 21918 bytes"
                },
                "test_agraph.py": "[FILE] 255 lines",
                "test_latex.py": "[FILE] 293 lines",
                "test_layout.py": "[FILE] 470 lines",
                "test_pydot.py": "[FILE] 191 lines",
                "test_pylab.py": "[FILE] 792 lines"
              }
            },
            "exception.py": "[FILE] 126 lines",
            "generators": {
              "__init__.py": "[FILE] 33 lines",
              "atlas.dat.gz": "[BINARY] 8887 bytes",
              "atlas.py": "[FILE] 180 lines",
              "classic.py": "[FILE] 923 lines",
              "cographs.py": "[FILE] 68 lines",
              "community.py": "[FILE] 1072 lines",
              "degree_seq.py": "[FILE] 869 lines",
              "directed.py": "[FILE] 502 lines",
              "duplication.py": "[FILE] 164 lines",
              "ego.py": "[FILE] 66 lines",
              "expanders.py": "[FILE] 207 lines",
              "geometric.py": "[FILE] 847 lines",
              "harary_graph.py": "[FILE] 200 lines",
              "internet_as_graphs.py": "[FILE] 442 lines",
              "intersection.py": "[FILE] 125 lines",
              "interval_graph.py": "[FILE] 72 lines",
              "joint_degree_seq.py": "[FILE] 665 lines",
              "lattice.py": "[FILE] 368 lines",
              "line.py": "[FILE] 500 lines",
              "mycielski.py": "[FILE] 111 lines",
              "nonisomorphic_trees.py": "[FILE] 193 lines",
              "random_clustered.py": "[FILE] 118 lines",
              "random_graphs.py": "[FILE] 1332 lines",
              "small.py": "[FILE] 979 lines",
              "social.py": "[FILE] 547 lines",
              "spectral_graph_forge.py": "[FILE] 122 lines",
              "stochastic.py": "[FILE] 52 lines",
              "sudoku.py": "[FILE] 132 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_atlas.py": "[FILE] 76 lines",
                "test_classic.py": "[FILE] 623 lines",
                "test_cographs.py": "[FILE] 21 lines",
                "test_community.py": "[FILE] 363 lines",
                "test_degree_seq.py": "[FILE] 231 lines",
                "test_directed.py": "[FILE] 163 lines",
                "test_duplication.py": "[FILE] 74 lines",
                "test_ego.py": "[FILE] 40 lines",
                "test_expanders.py": "[FILE] 87 lines",
                "test_geometric.py": "[FILE] 336 lines",
                "test_harary_graph.py": "[FILE] 135 lines",
                "test_internet_as_graphs.py": "[FILE] 177 lines",
                "test_intersection.py": "[FILE] 29 lines",
                "test_interval_graph.py": "[FILE] 146 lines",
                "test_joint_degree_seq.py": "[FILE] 126 lines",
                "test_lattice.py": "[FILE] 247 lines",
                "test_line.py": "[FILE] 310 lines",
                "test_mycielski.py": "[FILE] 27 lines",
                "test_nonisomorphic_trees.py": "[FILE] 65 lines",
                "test_random_clustered.py": "[FILE] 35 lines",
                "test_random_graphs.py": "[FILE] 349 lines",
                "test_small.py": "[FILE] 206 lines",
                "test_spectral_graph_forge.py": "[FILE] 50 lines",
                "test_stochastic.py": "[FILE] 72 lines",
                "test_sudoku.py": "[FILE] 93 lines",
                "test_time_series.py": "[FILE] 64 lines",
                "test_trees.py": "[FILE] 218 lines",
                "test_triads.py": "[FILE] 15 lines"
              },
              "time_series.py": "[FILE] 74 lines",
              "trees.py": "[FILE] 1157 lines",
              "triads.py": "[FILE] 78 lines"
            },
            "lazy_imports.py": "[FILE] 191 lines",
            "linalg": {
              "__init__.py": "[FILE] 14 lines",
              "algebraicconnectivity.py": "[FILE] 657 lines",
              "attrmatrix.py": "[FILE] 465 lines",
              "bethehessianmatrix.py": "[FILE] 79 lines",
              "graphmatrix.py": "[FILE] 167 lines",
              "laplacianmatrix.py": "[FILE] 429 lines",
              "modularitymatrix.py": "[FILE] 167 lines",
              "spectrum.py": "[FILE] 186 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_algebraic_connectivity.py": "[FILE] 403 lines",
                "test_attrmatrix.py": "[FILE] 109 lines",
                "test_bethehessian.py": "[FILE] 42 lines",
                "test_graphmatrix.py": "[FILE] 277 lines",
                "test_laplacian.py": "[FILE] 243 lines",
                "test_modularity.py": "[FILE] 88 lines",
                "test_spectrum.py": "[FILE] 72 lines"
              }
            },
            "readwrite": {
              "__init__.py": "[FILE] 19 lines",
              "adjlist.py": "[FILE] 311 lines",
              "edgelist.py": "[FILE] 490 lines",
              "gexf.py": "[FILE] 1066 lines",
              "gml.py": "[FILE] 879 lines",
              "graph6.py": "[FILE] 417 lines",
              "graphml.py": "[FILE] 1052 lines",
              "json_graph": {
                "__init__.py": "[FILE] 19 lines",
                "adjacency.py": "[FILE] 157 lines",
                "cytoscape.py": "[FILE] 175 lines",
                "node_link.py": "[FILE] 245 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_adjacency.py": "[FILE] 79 lines",
                  "test_cytoscape.py": "[FILE] 79 lines",
                  "test_node_link.py": "[FILE] 145 lines",
                  "test_tree.py": "[FILE] 49 lines"
                },
                "tree.py": "[FILE] 138 lines"
              },
              "leda.py": "[FILE] 109 lines",
              "multiline_adjlist.py": "[FILE] 394 lines",
              "p2g.py": "[FILE] 105 lines",
              "pajek.py": "[FILE] 287 lines",
              "sparse6.py": "[FILE] 377 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_adjlist.py": "[FILE] 269 lines",
                "test_edgelist.py": "[FILE] 315 lines",
                "test_gexf.py": "[FILE] 558 lines",
                "test_gml.py": "[FILE] 754 lines",
                "test_graph6.py": "[FILE] 170 lines",
                "test_graphml.py": "[FILE] 1530 lines",
                "test_leda.py": "[FILE] 31 lines",
                "test_p2g.py": "[FILE] 63 lines",
                "test_pajek.py": "[FILE] 131 lines",
                "test_sparse6.py": "[FILE] 174 lines",
                "test_text.py": "[FILE] 1810 lines"
              },
              "text.py": "[FILE] 951 lines"
            },
            "relabel.py": "[FILE] 286 lines",
            "tests": {
              "__init__.py": "[FILE] 1 lines",
              "test_all_random_functions.py": "[FILE] 248 lines",
              "test_convert.py": "[FILE] 322 lines",
              "test_convert_numpy.py": "[FILE] 396 lines",
              "test_convert_pandas.py": "[FILE] 321 lines",
              "test_convert_scipy.py": "[FILE] 283 lines",
              "test_exceptions.py": "[FILE] 41 lines",
              "test_import.py": "[FILE] 12 lines",
              "test_lazy_imports.py": "[FILE] 98 lines",
              "test_relabel.py": "[FILE] 348 lines"
            },
            "utils": {
              "__init__.py": "[FILE] 7 lines",
              "backends.py": "[FILE] 976 lines",
              "decorators.py": "[FILE] 1271 lines",
              "heaps.py": "[FILE] 341 lines",
              "mapped_queue.py": "[FILE] 299 lines",
              "misc.py": "[FILE] 492 lines",
              "random_sequence.py": "[FILE] 165 lines",
              "rcm.py": "[FILE] 159 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test__init.py": "[FILE] 12 lines",
                "test_decorators.py": "[FILE] 492 lines",
                "test_heaps.py": "[FILE] 132 lines",
                "test_mapped_queue.py": "[FILE] 269 lines",
                "test_misc.py": "[FILE] 256 lines",
                "test_random_sequence.py": "[FILE] 39 lines",
                "test_rcm.py": "[FILE] 64 lines",
                "test_unionfind.py": "[FILE] 56 lines"
              },
              "union_find.py": "[FILE] 107 lines"
            }
          },
          "networkx-3.2.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE.txt": "[BINARY] 1763 bytes",
            "METADATA": "[BINARY] 5232 bytes",
            "RECORD": "[BINARY] 98361 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 87 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "packaging": {
            "__init__.py": "[FILE] 16 lines",
            "_elffile.py": "[FILE] 109 lines",
            "_manylinux.py": "[FILE] 263 lines",
            "_musllinux.py": "[FILE] 86 lines",
            "_parser.py": "[FILE] 366 lines",
            "_structures.py": "[FILE] 70 lines",
            "_tokenizer.py": "[FILE] 194 lines",
            "licenses": {
              "__init__.py": "[FILE] 148 lines",
              "_spdx.py": "[FILE] 800 lines"
            },
            "markers.py": "[FILE] 389 lines",
            "metadata.py": "[FILE] 979 lines",
            "py.typed": "[BINARY] 0 bytes",
            "pylock.py": "[FILE] 636 lines",
            "requirements.py": "[FILE] 87 lines",
            "specifiers.py": "[FILE] 1069 lines",
            "tags.py": "[FILE] 652 lines",
            "utils.py": "[FILE] 159 lines",
            "version.py": "[FILE] 793 lines"
          },
          "packaging-26.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3309 bytes",
            "RECORD": "[BINARY] 2918 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 197 bytes",
              "LICENSE.APACHE": "[BINARY] 10174 bytes",
              "LICENSE.BSD": "[BINARY] 1344 bytes"
            }
          },
          "passlib": {
            "__init__.py": "[FILE] 4 lines",
            "_data": {
              "wordsets": {
                "bip39.txt": "[BINARY] 13117 bytes",
                "eff_long.txt": "[BINARY] 62144 bytes",
                "eff_prefixed.txt": "[BINARY] 10778 bytes",
                "eff_short.txt": "[BINARY] 7180 bytes"
              }
            },
            "apache.py": "[FILE] 1256 lines",
            "apps.py": "[FILE] 246 lines",
            "context.py": "[FILE] 2638 lines",
            "crypto": {
              "__init__.py": "[FILE] 2 lines",
              "_blowfish": {
                "__init__.py": "[FILE] 170 lines",
                "_gen_files.py": "[FILE] 205 lines",
                "base.py": "[FILE] 442 lines",
                "unrolled.py": "[FILE] 772 lines"
              },
              "_md4.py": "[FILE] 245 lines",
              "des.py": "[FILE] 849 lines",
              "digest.py": "[FILE] 1058 lines",
              "scrypt": {
                "__init__.py": "[FILE] 282 lines",
                "_builtin.py": "[FILE] 245 lines",
                "_gen_files.py": "[FILE] 155 lines",
                "_salsa.py": "[FILE] 171 lines"
              }
            },
            "exc.py": "[FILE] 398 lines",
            "ext": {
              "__init__.py": "[FILE] 2 lines",
              "django": {
                "__init__.py": "[FILE] 7 lines",
                "models.py": "[FILE] 37 lines",
                "utils.py": "[FILE] 1277 lines"
              }
            },
            "handlers": {
              "__init__.py": "[FILE] 2 lines",
              "argon2.py": "[FILE] 1010 lines",
              "bcrypt.py": "[FILE] 1244 lines",
              "cisco.py": "[FILE] 441 lines",
              "des_crypt.py": "[FILE] 608 lines",
              "digests.py": "[FILE] 169 lines",
              "django.py": "[FILE] 513 lines",
              "fshp.py": "[FILE] 215 lines",
              "ldap_digests.py": "[FILE] 360 lines",
              "md5_crypt.py": "[FILE] 347 lines",
              "misc.py": "[FILE] 270 lines",
              "mssql.py": "[FILE] 245 lines",
              "mysql.py": "[FILE] 129 lines",
              "oracle.py": "[FILE] 173 lines",
              "pbkdf2.py": "[FILE] 476 lines",
              "phpass.py": "[FILE] 136 lines",
              "postgres.py": "[FILE] 56 lines",
              "roundup.py": "[FILE] 30 lines",
              "scram.py": "[FILE] 583 lines",
              "scrypt.py": "[FILE] 384 lines",
              "sha1_crypt.py": "[FILE] 159 lines",
              "sha2_crypt.py": "[FILE] 535 lines",
              "sun_md5_crypt.py": "[FILE] 364 lines",
              "windows.py": "[FILE] 335 lines"
            },
            "hash.py": "[FILE] 69 lines",
            "hosts.py": "[FILE] 107 lines",
            "ifc.py": "[FILE] 354 lines",
            "pwd.py": "[FILE] 810 lines",
            "registry.py": "[FILE] 548 lines",
            "tests": {
              "__init__.py": "[FILE] 2 lines",
              "__main__.py": "[FILE] 7 lines",
              "_test_bad_register.py": "[FILE] 16 lines",
              "backports.py": "[FILE] 68 lines",
              "sample1.cfg": "[BINARY] 243 bytes",
              "sample1b.cfg": "[BINARY] 252 bytes",
              "sample1c.cfg": "[BINARY] 490 bytes",
              "sample_config_1s.cfg": "[BINARY] 238 bytes",
              "test_apache.py": "[FILE] 770 lines",
              "test_apps.py": "[FILE] 140 lines",
              "test_context.py": "[FILE] 1787 lines",
              "test_context_deprecated.py": "[FILE] 744 lines",
              "test_crypto_builtin_md4.py": "[FILE] 161 lines",
              "test_crypto_des.py": "[FILE] 195 lines",
              "test_crypto_digest.py": "[FILE] 545 lines",
              "test_crypto_scrypt.py": "[FILE] 635 lines",
              "test_ext_django.py": "[FILE] 1081 lines",
              "test_ext_django_source.py": "[FILE] 251 lines",
              "test_handlers.py": "[FILE] 1820 lines",
              "test_handlers_argon2.py": "[FILE] 508 lines",
              "test_handlers_bcrypt.py": "[FILE] 689 lines",
              "test_handlers_cisco.py": "[FILE] 458 lines",
              "test_handlers_django.py": "[FILE] 414 lines",
              "test_handlers_pbkdf2.py": "[FILE] 481 lines",
              "test_handlers_scrypt.py": "[FILE] 112 lines",
              "test_hosts.py": "[FILE] 98 lines",
              "test_pwd.py": "[FILE] 206 lines",
              "test_registry.py": "[FILE] 229 lines",
              "test_totp.py": "[FILE] 1605 lines",
              "test_utils.py": "[FILE] 1172 lines",
              "test_utils_handlers.py": "[FILE] 871 lines",
              "test_utils_md4.py": "[FILE] 42 lines",
              "test_utils_pbkdf2.py": "[FILE] 324 lines",
              "test_win32.py": "[FILE] 51 lines",
              "tox_support.py": "[FILE] 84 lines",
              "utils.py": "[FILE] 3622 lines"
            },
            "totp.py": "[FILE] 1909 lines",
            "utils": {
              "__init__.py": "[FILE] 1221 lines",
              "binary.py": "[FILE] 885 lines",
              "compat": {
                "__init__.py": "[FILE] 475 lines",
                "_ordered_dict.py": "[FILE] 243 lines"
              },
              "decor.py": "[FILE] 234 lines",
              "des.py": "[FILE] 47 lines",
              "handlers.py": "[FILE] 2712 lines",
              "md4.py": "[FILE] 30 lines",
              "pbkdf2.py": "[FILE] 194 lines"
            },
            "win32.py": "[FILE] 69 lines"
          },
          "passlib-1.7.4.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 4954 bytes",
            "METADATA": "[BINARY] 1688 bytes",
            "RECORD": "[BINARY] 14607 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 8 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "pip": {
            "__init__.py": "[FILE] 14 lines",
            "__main__.py": "[FILE] 25 lines",
            "__pip-runner__.py": "[FILE] 51 lines",
            "_internal": {
              "__init__.py": "[FILE] 19 lines",
              "cache.py": "[FILE] 292 lines",
              "cli": {
                "__init__.py": "[FILE] 4 lines",
                "autocompletion.py": "[FILE] 185 lines",
                "base_command.py": "[FILE] 256 lines",
                "cmdoptions.py": "[FILE] 1268 lines",
                "command_context.py": "[FILE] 29 lines",
                "index_command.py": "[FILE] 196 lines",
                "main.py": "[FILE] 86 lines",
                "main_parser.py": "[FILE] 137 lines",
                "parser.py": "[FILE] 359 lines",
                "progress_bars.py": "[FILE] 154 lines",
                "req_command.py": "[FILE] 448 lines",
                "spinners.py": "[FILE] 236 lines",
                "status_codes.py": "[FILE] 7 lines"
              },
              "commands": {
                "__init__.py": "[FILE] 140 lines",
                "cache.py": "[FILE] 256 lines",
                "check.py": "[FILE] 67 lines",
                "completion.py": "[FILE] 137 lines",
                "configuration.py": "[FILE] 289 lines",
                "debug.py": "[FILE] 204 lines",
                "download.py": "[FILE] 147 lines",
                "freeze.py": "[FILE] 108 lines",
                "hash.py": "[FILE] 59 lines",
                "help.py": "[FILE] 41 lines",
                "index.py": "[FILE] 167 lines",
                "inspect.py": "[FILE] 93 lines",
                "install.py": "[FILE] 811 lines",
                "list.py": "[FILE] 399 lines",
                "lock.py": "[FILE] 176 lines",
                "search.py": "[FILE] 179 lines",
                "show.py": "[FILE] 232 lines",
                "uninstall.py": "[FILE] 114 lines",
                "wheel.py": "[FILE] 172 lines"
              },
              "configuration.py": "[FILE] 397 lines",
              "exceptions.py": "[FILE] 972 lines",
              "index": {
                "__init__.py": "[FILE] 2 lines",
                "collector.py": "[FILE] 489 lines",
                "package_finder.py": "[FILE] 1126 lines",
                "sources.py": "[FILE] 288 lines"
              },
              "locations": {
                "__init__.py": "[FILE] 441 lines",
                "_distutils.py": "[FILE] 174 lines",
                "_sysconfig.py": "[FILE] 219 lines",
                "base.py": "[FILE] 83 lines"
              },
              "main.py": "[FILE] 13 lines",
              "metadata": {
                "__init__.py": "[FILE] 170 lines",
                "_json.py": "[FILE] 88 lines",
                "base.py": "[FILE] 686 lines",
                "importlib": {
                  "__init__.py": "[FILE] 7 lines",
                  "_compat.py": "[FILE] 88 lines",
                  "_dists.py": "[FILE] 230 lines",
                  "_envs.py": "[FILE] 144 lines"
                },
                "pkg_resources.py": "[FILE] 299 lines"
              },
              "models": {
                "__init__.py": "[FILE] 2 lines",
                "candidate.py": "[FILE] 26 lines",
                "direct_url.py": "[FILE] 228 lines",
                "format_control.py": "[FILE] 79 lines",
                "index.py": "[FILE] 29 lines",
                "installation_report.py": "[FILE] 58 lines",
                "link.py": "[FILE] 618 lines",
                "release_control.py": "[FILE] 93 lines",
                "scheme.py": "[FILE] 26 lines",
                "search_scope.py": "[FILE] 127 lines",
                "selection_prefs.py": "[FILE] 57 lines",
                "target_python.py": "[FILE] 123 lines",
                "wheel.py": "[FILE] 81 lines"
              },
              "network": {
                "__init__.py": "[FILE] 2 lines",
                "auth.py": "[FILE] 569 lines",
                "cache.py": "[FILE] 129 lines",
                "download.py": "[FILE] 342 lines",
                "lazy_wheel.py": "[FILE] 216 lines",
                "session.py": "[FILE] 533 lines",
                "utils.py": "[FILE] 99 lines",
                "xmlrpc.py": "[FILE] 62 lines"
              },
              "operations": {
                "__init__.py": "[FILE] 1 lines",
                "check.py": "[FILE] 176 lines",
                "freeze.py": "[FILE] 260 lines",
                "install": {
                  "__init__.py": "[FILE] 2 lines",
                  "wheel.py": "[FILE] 746 lines"
                },
                "prepare.py": "[FILE] 748 lines"
              },
              "pyproject.py": "[FILE] 124 lines",
              "req": {
                "__init__.py": "[FILE] 104 lines",
                "constructors.py": "[FILE] 569 lines",
                "pep723.py": "[FILE] 42 lines",
                "req_dependency_group.py": "[FILE] 76 lines",
                "req_file.py": "[FILE] 632 lines",
                "req_install.py": "[FILE] 829 lines",
                "req_set.py": "[FILE] 82 lines",
                "req_uninstall.py": "[FILE] 640 lines"
              },
              "resolution": {
                "__init__.py": "[FILE] 1 lines",
                "base.py": "[FILE] 21 lines",
                "legacy": {
                  "__init__.py": "[FILE] 1 lines",
                  "resolver.py": "[FILE] 599 lines"
                },
                "resolvelib": {
                  "__init__.py": "[FILE] 1 lines",
                  "base.py": "[FILE] 143 lines",
                  "candidates.py": "[FILE] 592 lines",
                  "factory.py": "[FILE] 857 lines",
                  "found_candidates.py": "[FILE] 167 lines",
                  "provider.py": "[FILE] 286 lines",
                  "reporter.py": "[FILE] 99 lines",
                  "requirements.py": "[FILE] 252 lines",
                  "resolver.py": "[FILE] 333 lines"
                }
              },
              "self_outdated_check.py": "[FILE] 256 lines",
              "utils": {
                "__init__.py": "[FILE] 1 lines",
                "_jaraco_text.py": "[FILE] 110 lines",
                "_log.py": "[FILE] 39 lines",
                "appdirs.py": "[FILE] 53 lines",
                "compat.py": "[FILE] 86 lines",
                "compatibility_tags.py": "[FILE] 202 lines",
                "datetime.py": "[FILE] 29 lines",
                "deprecation.py": "[FILE] 127 lines",
                "direct_url_helpers.py": "[FILE] 88 lines",
                "egg_link.py": "[FILE] 82 lines",
                "entrypoints.py": "[FILE] 89 lines",
                "filesystem.py": "[FILE] 204 lines",
                "filetypes.py": "[FILE] 25 lines",
                "glibc.py": "[FILE] 103 lines",
                "hashes.py": "[FILE] 151 lines",
                "logging.py": "[FILE] 397 lines",
                "misc.py": "[FILE] 772 lines",
                "packaging.py": "[FILE] 45 lines",
                "pylock.py": "[FILE] 117 lines",
                "retry.py": "[FILE] 46 lines",
                "subprocess.py": "[FILE] 249 lines",
                "temp_dir.py": "[FILE] 295 lines",
                "unpacking.py": "[FILE] 363 lines",
                "urls.py": "[FILE] 56 lines",
                "virtualenv.py": "[FILE] 106 lines",
                "wheel.py": "[FILE] 133 lines"
              },
              "vcs": {
                "__init__.py": "[FILE] 16 lines",
                "bazaar.py": "[FILE] 131 lines",
                "git.py": "[FILE] 572 lines",
                "mercurial.py": "[FILE] 187 lines",
                "subversion.py": "[FILE] 336 lines",
                "versioncontrol.py": "[FILE] 696 lines"
              },
              "wheel_builder.py": "[FILE] 262 lines"
            },
            "_vendor": {
              "README.rst": "[BINARY] 9394 bytes",
              "__init__.py": "[FILE] 118 lines",
              "cachecontrol": {
                "LICENSE.txt": "[BINARY] 558 bytes",
                "__init__.py": "[FILE] 33 lines",
                "_cmd.py": "[FILE] 71 lines",
                "adapter.py": "[FILE] 168 lines",
                "cache.py": "[FILE] 76 lines",
                "caches": {
                  "__init__.py": "[FILE] 9 lines",
                  "file_cache.py": "[FILE] 146 lines",
                  "redis_cache.py": "[FILE] 49 lines"
                },
                "controller.py": "[FILE] 512 lines",
                "filewrapper.py": "[FILE] 122 lines",
                "heuristics.py": "[FILE] 158 lines",
                "py.typed": "[BINARY] 0 bytes",
                "serialize.py": "[FILE] 147 lines",
                "wrapper.py": "[FILE] 44 lines"
              },
              "certifi": {
                "LICENSE": "[BINARY] 989 bytes",
                "__init__.py": "[FILE] 5 lines",
                "__main__.py": "[FILE] 13 lines",
                "cacert.pem": "[BINARY] 270954 bytes",
                "core.py": "[FILE] 84 lines",
                "py.typed": "[BINARY] 0 bytes"
              },
              "dependency_groups": {
                "LICENSE.txt": "[BINARY] 1099 bytes",
                "__init__.py": "[FILE] 14 lines",
                "__main__.py": "[FILE] 66 lines",
                "_implementation.py": "[FILE] 210 lines",
                "_lint_dependency_groups.py": "[FILE] 60 lines",
                "_pip_wrapper.py": "[FILE] 63 lines",
                "_toml_compat.py": "[FILE] 10 lines",
                "py.typed": "[BINARY] 0 bytes"
              },
              "idna": {
                "LICENSE.md": "[FILE] 32 lines",
                "__init__.py": "[FILE] 46 lines",
                "codec.py": "[FILE] 123 lines",
                "compat.py": "[FILE] 16 lines",
                "core.py": "[FILE] 438 lines",
                "idnadata.py": "[FILE] 4310 lines",
                "intranges.py": "[FILE] 58 lines",
                "package_data.py": "[FILE] 2 lines",
                "py.typed": "[BINARY] 0 bytes",
                "uts46data.py": "[FILE] 8842 lines"
              },
              "msgpack": {
                "COPYING": "[BINARY] 614 bytes",
                "__init__.py": "[FILE] 56 lines",
                "exceptions.py": "[FILE] 49 lines",
                "ext.py": "[FILE] 171 lines",
                "fallback.py": "[FILE] 930 lines"
              },
              "packaging": {
                "LICENSE": "[BINARY] 197 bytes",
                "LICENSE.APACHE": "[BINARY] 10174 bytes",
                "LICENSE.BSD": "[BINARY] 1344 bytes",
                "__init__.py": "[FILE] 16 lines",
                "_elffile.py": "[FILE] 109 lines",
                "_manylinux.py": "[FILE] 263 lines",
                "_musllinux.py": "[FILE] 86 lines",
                "_parser.py": "[FILE] 366 lines",
                "_structures.py": "[FILE] 70 lines",
                "_tokenizer.py": "[FILE] 194 lines",
                "licenses": {
                  "__init__.py": "[FILE] 148 lines",
                  "_spdx.py": "[FILE] 800 lines"
                },
                "markers.py": "[FILE] 389 lines",
                "metadata.py": "[FILE] 979 lines",
                "py.typed": "[BINARY] 0 bytes",
                "pylock.py": "[FILE] 636 lines",
                "requirements.py": "[FILE] 87 lines",
                "specifiers.py": "[FILE] 1069 lines",
                "tags.py": "[FILE] 652 lines",
                "utils.py": "[FILE] 159 lines",
                "version.py": "[FILE] 793 lines"
              },
              "pkg_resources": {
                "LICENSE": "[BINARY] 1023 bytes",
                "__init__.py": "[FILE] 3677 lines"
              },
              "platformdirs": {
                "LICENSE": "[BINARY] 1089 bytes",
                "__init__.py": "[FILE] 632 lines",
                "__main__.py": "[FILE] 56 lines",
                "android.py": "[FILE] 250 lines",
                "api.py": "[FILE] 300 lines",
                "macos.py": "[FILE] 147 lines",
                "py.typed": "[BINARY] 0 bytes",
                "unix.py": "[FILE] 273 lines",
                "version.py": "[FILE] 35 lines",
                "windows.py": "[FILE] 279 lines"
              },
              "pygments": {
                "LICENSE": "[BINARY] 1331 bytes",
                "__init__.py": "[FILE] 83 lines",
                "__main__.py": "[FILE] 18 lines",
                "console.py": "[FILE] 71 lines",
                "filter.py": "[FILE] 71 lines",
                "filters": {
                  "__init__.py": "[FILE] 941 lines"
                },
                "formatter.py": "[FILE] 130 lines",
                "formatters": {
                  "__init__.py": "[FILE] 158 lines",
                  "_mapping.py": "[FILE] 24 lines"
                },
                "lexer.py": "[FILE] 964 lines",
                "lexers": {
                  "__init__.py": "[FILE] 363 lines",
                  "_mapping.py": "[FILE] 603 lines",
                  "python.py": "[FILE] 1202 lines"
                },
                "modeline.py": "[FILE] 44 lines",
                "plugin.py": "[FILE] 73 lines",
                "regexopt.py": "[FILE] 92 lines",
                "scanner.py": "[FILE] 105 lines",
                "sphinxext.py": "[FILE] 248 lines",
                "style.py": "[FILE] 204 lines",
                "styles": {
                  "__init__.py": "[FILE] 62 lines",
                  "_mapping.py": "[FILE] 55 lines"
                },
                "token.py": "[FILE] 215 lines",
                "unistring.py": "[FILE] 154 lines",
                "util.py": "[FILE] 325 lines"
              },
              "pyproject_hooks": {
                "LICENSE": "[BINARY] 1081 bytes",
                "__init__.py": "[FILE] 32 lines",
                "_impl.py": "[FILE] 411 lines",
                "_in_process": {
                  "__init__.py": "[FILE] 22 lines",
                  "_in_process.py": "[FILE] 390 lines"
                },
                "py.typed": "[BINARY] 0 bytes"
              },
              "requests": {
                "LICENSE": "[BINARY] 10142 bytes",
                "__init__.py": "[FILE] 180 lines",
                "__version__.py": "[FILE] 15 lines",
                "_internal_utils.py": "[FILE] 51 lines",
                "adapters.py": "[FILE] 697 lines",
                "api.py": "[FILE] 158 lines",
                "auth.py": "[FILE] 315 lines",
                "certs.py": "[FILE] 18 lines",
                "compat.py": "[FILE] 91 lines",
                "cookies.py": "[FILE] 562 lines",
                "exceptions.py": "[FILE] 152 lines",
                "help.py": "[FILE] 128 lines",
                "hooks.py": "[FILE] 34 lines",
                "models.py": "[FILE] 1040 lines",
                "packages.py": "[FILE] 26 lines",
                "sessions.py": "[FILE] 832 lines",
                "status_codes.py": "[FILE] 129 lines",
                "structures.py": "[FILE] 100 lines",
                "utils.py": "[FILE] 1087 lines"
              },
              "resolvelib": {
                "LICENSE": "[BINARY] 751 bytes",
                "__init__.py": "[FILE] 28 lines",
                "providers.py": "[FILE] 197 lines",
                "py.typed": "[BINARY] 0 bytes",
                "reporters.py": "[FILE] 56 lines",
                "resolvers": {
                  "__init__.py": "[FILE] 28 lines",
                  "abstract.py": "[FILE] 48 lines",
                  "criterion.py": "[FILE] 49 lines",
                  "exceptions.py": "[FILE] 58 lines",
                  "resolution.py": "[FILE] 628 lines"
                },
                "structs.py": "[FILE] 210 lines"
              },
              "rich": {
                "LICENSE": "[BINARY] 1056 bytes",
                "__init__.py": "[FILE] 178 lines",
                "__main__.py": "[FILE] 246 lines",
                "_cell_widths.py": "[FILE] 455 lines",
                "_emoji_codes.py": "[FILE] 3611 lines",
                "_emoji_replace.py": "[FILE] 33 lines",
                "_export_format.py": "[FILE] 77 lines",
                "_extension.py": "[FILE] 11 lines",
                "_fileno.py": "[FILE] 25 lines",
                "_inspect.py": "[FILE] 269 lines",
                "_log_render.py": "[FILE] 95 lines",
                "_loop.py": "[FILE] 44 lines",
                "_null_file.py": "[FILE] 70 lines",
                "_palettes.py": "[FILE] 310 lines",
                "_pick.py": "[FILE] 18 lines",
                "_ratio.py": "[FILE] 154 lines",
                "_spinners.py": "[FILE] 483 lines",
                "_stack.py": "[FILE] 17 lines",
                "_timer.py": "[FILE] 20 lines",
                "_win32_console.py": "[FILE] 662 lines",
                "_windows.py": "[FILE] 72 lines",
                "_windows_renderer.py": "[FILE] 57 lines",
                "_wrap.py": "[FILE] 94 lines",
                "abc.py": "[FILE] 34 lines",
                "align.py": "[FILE] 307 lines",
                "ansi.py": "[FILE] 242 lines",
                "bar.py": "[FILE] 94 lines",
                "box.py": "[FILE] 475 lines",
                "cells.py": "[FILE] 175 lines",
                "color.py": "[FILE] 622 lines",
                "color_triplet.py": "[FILE] 39 lines",
                "columns.py": "[FILE] 188 lines",
                "console.py": "[FILE] 2681 lines",
                "constrain.py": "[FILE] 38 lines",
                "containers.py": "[FILE] 168 lines",
                "control.py": "[FILE] 220 lines",
                "default_styles.py": "[FILE] 194 lines",
                "diagnose.py": "[FILE] 40 lines",
                "emoji.py": "[FILE] 92 lines",
                "errors.py": "[FILE] 35 lines",
                "file_proxy.py": "[FILE] 58 lines",
                "filesize.py": "[FILE] 89 lines",
                "highlighter.py": "[FILE] 233 lines",
                "json.py": "[FILE] 140 lines",
                "jupyter.py": "[FILE] 102 lines",
                "layout.py": "[FILE] 443 lines",
                "live.py": "[FILE] 401 lines",
                "live_render.py": "[FILE] 107 lines",
                "logging.py": "[FILE] 298 lines",
                "markup.py": "[FILE] 252 lines",
                "measure.py": "[FILE] 152 lines",
                "padding.py": "[FILE] 142 lines",
                "pager.py": "[FILE] 35 lines",
                "palette.py": "[FILE] 101 lines",
                "panel.py": "[FILE] 318 lines",
                "pretty.py": "[FILE] 1017 lines",
                "progress.py": "[FILE] 1716 lines",
                "progress_bar.py": "[FILE] 224 lines",
                "prompt.py": "[FILE] 401 lines",
                "protocol.py": "[FILE] 43 lines",
                "py.typed": "[BINARY] 0 bytes",
                "region.py": "[FILE] 11 lines",
                "repr.py": "[FILE] 150 lines",
                "rule.py": "[FILE] 131 lines",
                "scope.py": "[FILE] 87 lines",
                "screen.py": "[FILE] 55 lines",
                "segment.py": "[FILE] 753 lines",
                "spinner.py": "[FILE] 133 lines",
                "status.py": "[FILE] 132 lines",
                "style.py": "[FILE] 793 lines",
                "styled.py": "[FILE] 43 lines",
                "syntax.py": "[FILE] 986 lines",
                "table.py": "[FILE] 1007 lines",
                "terminal_theme.py": "[FILE] 154 lines",
                "text.py": "[FILE] 1362 lines",
                "theme.py": "[FILE] 116 lines",
                "themes.py": "[FILE] 6 lines",
                "traceback.py": "[FILE] 900 lines",
                "tree.py": "[FILE] 258 lines"
              },
              "tomli": {
                "LICENSE": "[BINARY] 1072 bytes",
                "__init__.py": "[FILE] 9 lines",
                "_parser.py": "[FILE] 778 lines",
                "_re.py": "[FILE] 116 lines",
                "_types.py": "[FILE] 11 lines",
                "py.typed": "[BINARY] 26 bytes"
              },
              "tomli_w": {
                "LICENSE": "[BINARY] 1072 bytes",
                "__init__.py": "[FILE] 5 lines",
                "_writer.py": "[FILE] 230 lines",
                "py.typed": "[BINARY] 26 bytes"
              },
              "truststore": {
                "LICENSE": "[BINARY] 1086 bytes",
                "__init__.py": "[FILE] 37 lines",
                "_api.py": "[FILE] 342 lines",
                "_macos.py": "[FILE] 572 lines",
                "_openssl.py": "[FILE] 69 lines",
                "_ssl_constants.py": "[FILE] 32 lines",
                "_windows.py": "[FILE] 568 lines",
                "py.typed": "[BINARY] 0 bytes"
              },
              "urllib3": {
                "LICENSE.txt": "[BINARY] 1115 bytes",
                "__init__.py": "[FILE] 103 lines",
                "_collections.py": "[FILE] 356 lines",
                "_version.py": "[FILE] 3 lines",
                "connection.py": "[FILE] 573 lines",
                "connectionpool.py": "[FILE] 1141 lines",
                "contrib": {
                  "__init__.py": "[FILE] 1 lines",
                  "_appengine_environ.py": "[FILE] 37 lines",
                  "_securetransport": {
                    "__init__.py": "[FILE] 1 lines",
                    "bindings.py": "[FILE] 520 lines",
                    "low_level.py": "[FILE] 398 lines"
                  },
                  "appengine.py": "[FILE] 315 lines",
                  "ntlmpool.py": "[FILE] 131 lines",
                  "pyopenssl.py": "[FILE] 519 lines",
                  "securetransport.py": "[FILE] 921 lines",
                  "socks.py": "[FILE] 217 lines"
                },
                "exceptions.py": "[FILE] 324 lines",
                "fields.py": "[FILE] 275 lines",
                "filepost.py": "[FILE] 99 lines",
                "packages": {
                  "__init__.py": "[FILE] 1 lines",
                  "backports": {
                    "__init__.py": "[FILE] 1 lines",
                    "makefile.py": "[FILE] 52 lines",
                    "weakref_finalize.py": "[FILE] 156 lines"
                  },
                  "six.py": "[FILE] 1077 lines"
                },
                "poolmanager.py": "[FILE] 541 lines",
                "request.py": "[FILE] 192 lines",
                "response.py": "[FILE] 880 lines",
                "util": {
                  "__init__.py": "[FILE] 50 lines",
                  "connection.py": "[FILE] 150 lines",
                  "proxy.py": "[FILE] 58 lines",
                  "queue.py": "[FILE] 23 lines",
                  "request.py": "[FILE] 138 lines",
                  "response.py": "[FILE] 108 lines",
                  "retry.py": "[FILE] 623 lines",
                  "ssl_.py": "[FILE] 505 lines",
                  "ssl_match_hostname.py": "[FILE] 160 lines",
                  "ssltransport.py": "[FILE] 222 lines",
                  "timeout.py": "[FILE] 272 lines",
                  "url.py": "[FILE] 436 lines",
                  "wait.py": "[FILE] 153 lines"
                }
              },
              "vendor.txt": "[BINARY] 342 bytes"
            },
            "py.typed": "[BINARY] 286 bytes"
          },
          "pip-26.0.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 4675 bytes",
            "RECORD": "[BINARY] 68761 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "entry_points.txt": "[BINARY] 84 bytes",
            "licenses": {
              "AUTHORS.txt": "[BINARY] 11731 bytes",
              "LICENSE.txt": "[BINARY] 1093 bytes",
              "src": {
                "pip": {
                  "_vendor": {
                    "cachecontrol": {
                      "LICENSE.txt": "[BINARY] 558 bytes"
                    },
                    "certifi": {
                      "LICENSE": "[BINARY] 989 bytes"
                    },
                    "dependency_groups": {
                      "LICENSE.txt": "[BINARY] 1099 bytes"
                    },
                    "idna": {
                      "LICENSE.md": "[FILE] 32 lines"
                    },
                    "msgpack": {
                      "COPYING": "[BINARY] 614 bytes"
                    },
                    "packaging": {
                      "LICENSE": "[BINARY] 197 bytes",
                      "LICENSE.APACHE": "[BINARY] 10174 bytes",
                      "LICENSE.BSD": "[BINARY] 1344 bytes"
                    },
                    "pkg_resources": {
                      "LICENSE": "[BINARY] 1023 bytes"
                    },
                    "platformdirs": {
                      "LICENSE": "[BINARY] 1089 bytes"
                    },
                    "pygments": {
                      "LICENSE": "[BINARY] 1331 bytes"
                    },
                    "pyproject_hooks": {
                      "LICENSE": "[BINARY] 1081 bytes"
                    },
                    "requests": {
                      "LICENSE": "[BINARY] 10142 bytes"
                    },
                    "resolvelib": {
                      "LICENSE": "[BINARY] 751 bytes"
                    },
                    "rich": {
                      "LICENSE": "[BINARY] 1056 bytes"
                    },
                    "tomli": {
                      "LICENSE": "[BINARY] 1072 bytes"
                    },
                    "tomli_w": {
                      "LICENSE": "[BINARY] 1072 bytes"
                    },
                    "truststore": {
                      "LICENSE": "[BINARY] 1086 bytes"
                    },
                    "urllib3": {
                      "LICENSE.txt": "[BINARY] 1115 bytes"
                    }
                  }
                }
              }
            }
          },
          "prompt_toolkit": {
            "__init__.py": "[FILE] 55 lines",
            "application": {
              "__init__.py": "[FILE] 33 lines",
              "application.py": "[FILE] 1631 lines",
              "current.py": "[FILE] 196 lines",
              "dummy.py": "[FILE] 56 lines",
              "run_in_terminal.py": "[FILE] 118 lines"
            },
            "auto_suggest.py": "[FILE] 178 lines",
            "buffer.py": "[FILE] 2030 lines",
            "cache.py": "[FILE] 128 lines",
            "clipboard": {
              "__init__.py": "[FILE] 18 lines",
              "base.py": "[FILE] 110 lines",
              "in_memory.py": "[FILE] 45 lines",
              "pyperclip.py": "[FILE] 43 lines"
            },
            "completion": {
              "__init__.py": "[FILE] 44 lines",
              "base.py": "[FILE] 439 lines",
              "deduplicate.py": "[FILE] 46 lines",
              "filesystem.py": "[FILE] 119 lines",
              "fuzzy_completer.py": "[FILE] 214 lines",
              "nested.py": "[FILE] 110 lines",
              "word_completer.py": "[FILE] 95 lines"
            },
            "contrib": {
              "__init__.py": "[FILE] 1 lines",
              "completers": {
                "__init__.py": "[FILE] 6 lines",
                "system.py": "[FILE] 65 lines"
              },
              "regular_languages": {
                "__init__.py": "[FILE] 81 lines",
                "compiler.py": "[FILE] 580 lines",
                "completion.py": "[FILE] 101 lines",
                "lexer.py": "[FILE] 95 lines",
                "regex_parser.py": "[FILE] 280 lines",
                "validation.py": "[FILE] 61 lines"
              },
              "ssh": {
                "__init__.py": "[FILE] 9 lines",
                "server.py": "[FILE] 179 lines"
              },
              "telnet": {
                "__init__.py": "[FILE] 8 lines",
                "log.py": "[FILE] 14 lines",
                "protocol.py": "[FILE] 210 lines",
                "server.py": "[FILE] 429 lines"
              }
            },
            "cursor_shapes.py": "[FILE] 118 lines",
            "data_structures.py": "[FILE] 19 lines",
            "document.py": "[FILE] 1183 lines",
            "enums.py": "[FILE] 20 lines",
            "eventloop": {
              "__init__.py": "[FILE] 32 lines",
              "async_generator.py": "[FILE] 126 lines",
              "inputhook.py": "[FILE] 192 lines",
              "utils.py": "[FILE] 102 lines",
              "win32.py": "[FILE] 73 lines"
            },
            "filters": {
              "__init__.py": "[FILE] 72 lines",
              "app.py": "[FILE] 420 lines",
              "base.py": "[FILE] 261 lines",
              "cli.py": "[FILE] 66 lines",
              "utils.py": "[FILE] 42 lines"
            },
            "formatted_text": {
              "__init__.py": "[FILE] 60 lines",
              "ansi.py": "[FILE] 303 lines",
              "base.py": "[FILE] 180 lines",
              "html.py": "[FILE] 146 lines",
              "pygments.py": "[FILE] 33 lines",
              "utils.py": "[FILE] 103 lines"
            },
            "history.py": "[FILE] 307 lines",
            "input": {
              "__init__.py": "[FILE] 15 lines",
              "ansi_escape_sequences.py": "[FILE] 345 lines",
              "base.py": "[FILE] 155 lines",
              "defaults.py": "[FILE] 80 lines",
              "posix_pipe.py": "[FILE] 119 lines",
              "posix_utils.py": "[FILE] 98 lines",
              "typeahead.py": "[FILE] 79 lines",
              "vt100.py": "[FILE] 310 lines",
              "vt100_parser.py": "[FILE] 251 lines",
              "win32.py": "[FILE] 905 lines",
              "win32_pipe.py": "[FILE] 157 lines"
            },
            "key_binding": {
              "__init__.py": "[FILE] 23 lines",
              "bindings": {
                "__init__.py": "[FILE] 1 lines",
                "auto_suggest.py": "[FILE] 67 lines",
                "basic.py": "[FILE] 258 lines",
                "completion.py": "[FILE] 207 lines",
                "cpr.py": "[FILE] 31 lines",
                "emacs.py": "[FILE] 564 lines",
                "focus.py": "[FILE] 27 lines",
                "mouse.py": "[FILE] 349 lines",
                "named_commands.py": "[FILE] 692 lines",
                "open_in_editor.py": "[FILE] 53 lines",
                "page_navigation.py": "[FILE] 86 lines",
                "scroll.py": "[FILE] 191 lines",
                "search.py": "[FILE] 97 lines",
                "vi.py": "[FILE] 2234 lines"
              },
              "defaults.py": "[FILE] 64 lines",
              "digraphs.py": "[FILE] 1379 lines",
              "emacs_state.py": "[FILE] 37 lines",
              "key_bindings.py": "[FILE] 673 lines",
              "key_processor.py": "[FILE] 527 lines",
              "vi_state.py": "[FILE] 108 lines"
            },
            "keys.py": "[FILE] 223 lines",
            "layout": {
              "__init__.py": "[FILE] 148 lines",
              "containers.py": "[FILE] 2767 lines",
              "controls.py": "[FILE] 957 lines",
              "dimension.py": "[FILE] 217 lines",
              "dummy.py": "[FILE] 41 lines",
              "layout.py": "[FILE] 413 lines",
              "margins.py": "[FILE] 305 lines",
              "menus.py": "[FILE] 749 lines",
              "mouse_handlers.py": "[FILE] 57 lines",
              "processors.py": "[FILE] 1017 lines",
              "screen.py": "[FILE] 324 lines",
              "scrollable_pane.py": "[FILE] 495 lines",
              "utils.py": "[FILE] 81 lines"
            },
            "lexers": {
              "__init__.py": "[FILE] 22 lines",
              "base.py": "[FILE] 86 lines",
              "pygments.py": "[FILE] 329 lines"
            },
            "log.py": "[FILE] 14 lines",
            "mouse_events.py": "[FILE] 86 lines",
            "output": {
              "__init__.py": "[FILE] 16 lines",
              "base.py": "[FILE] 333 lines",
              "color_depth.py": "[FILE] 65 lines",
              "conemu.py": "[FILE] 66 lines",
              "defaults.py": "[FILE] 107 lines",
              "flush_stdout.py": "[FILE] 88 lines",
              "plain_text.py": "[FILE] 144 lines",
              "vt100.py": "[FILE] 761 lines",
              "win32.py": "[FILE] 685 lines",
              "windows10.py": "[FILE] 134 lines"
            },
            "patch_stdout.py": "[FILE] 298 lines",
            "py.typed": "[BINARY] 0 bytes",
            "renderer.py": "[FILE] 821 lines",
            "search.py": "[FILE] 227 lines",
            "selection.py": "[FILE] 59 lines",
            "shortcuts": {
              "__init__.py": "[FILE] 50 lines",
              "choice_input.py": "[FILE] 312 lines",
              "dialogs.py": "[FILE] 331 lines",
              "progress_bar": {
                "__init__.py": "[FILE] 34 lines",
                "base.py": "[FILE] 450 lines",
                "formatters.py": "[FILE] 432 lines"
              },
              "prompt.py": "[FILE] 1539 lines",
              "utils.py": "[FILE] 240 lines"
            },
            "styles": {
              "__init__.py": "[FILE] 68 lines",
              "base.py": "[FILE] 189 lines",
              "defaults.py": "[FILE] 237 lines",
              "named_colors.py": "[FILE] 163 lines",
              "pygments.py": "[FILE] 71 lines",
              "style.py": "[FILE] 408 lines",
              "style_transformation.py": "[FILE] 375 lines"
            },
            "token.py": "[FILE] 10 lines",
            "utils.py": "[FILE] 328 lines",
            "validation.py": "[FILE] 193 lines",
            "widgets": {
              "__init__.py": "[FILE] 64 lines",
              "base.py": "[FILE] 1081 lines",
              "dialogs.py": "[FILE] 109 lines",
              "menus.py": "[FILE] 375 lines",
              "toolbars.py": "[FILE] 371 lines"
            },
            "win32_types.py": "[FILE] 230 lines"
          },
          "prompt_toolkit-3.0.52.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6414 bytes",
            "RECORD": "[BINARY] 23851 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "AUTHORS.rst": "[BINARY] 148 bytes",
              "LICENSE": "[BINARY] 1493 bytes"
            },
            "top_level.txt": "[BINARY] 15 bytes"
          },
          "psycopg2": {
            "__init__.py": "[FILE] 127 lines",
            "_ipaddress.py": "[FILE] 91 lines",
            "_json.py": "[FILE] 200 lines",
            "_psycopg.cpython-312-x86_64-linux-gnu.so": "[BINARY] 339145 bytes",
            "_range.py": "[FILE] 555 lines",
            "errorcodes.py": "[FILE] 450 lines",
            "errors.py": "[FILE] 39 lines",
            "extensions.py": "[FILE] 214 lines",
            "extras.py": "[FILE] 1341 lines",
            "pool.py": "[FILE] 188 lines",
            "sql.py": "[FILE] 456 lines",
            "tz.py": "[FILE] 159 lines"
          },
          "psycopg2_binary-2.9.9.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2238 bytes",
            "METADATA": "[BINARY] 4445 bytes",
            "RECORD": "[BINARY] 3590 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "psycopg2_binary.libs": {
            "libcom_err-2abe824b.so.2.1": "[BINARY] 17497 bytes",
            "libcrypto-0628e7d4.so.1.1": "[BINARY] 3133185 bytes",
            "libgssapi_krb5-497db0c6.so.2.2": "[BINARY] 345209 bytes",
            "libk5crypto-b1f99d5c.so.3.1": "[BINARY] 219953 bytes",
            "libkeyutils-dfe70bd6.so.1.5": "[BINARY] 17913 bytes",
            "libkrb5-fcafa220.so.3.3": "[BINARY] 1018953 bytes",
            "libkrb5support-d0bcff84.so.0.1": "[BINARY] 76873 bytes",
            "liblber-5a1d5ae1.so.2.0.200": "[BINARY] 60977 bytes",
            "libldap-5d2ff197.so.2.0.200": "[BINARY] 447329 bytes",
            "libpcre-9513aab5.so.1.2.0": "[BINARY] 406817 bytes",
            "libpq-e8a033dd.so.5.16": "[BINARY] 370777 bytes",
            "libsasl2-883649fd.so.3.0.0": "[BINARY] 119217 bytes",
            "libselinux-0922c95c.so.1": "[BINARY] 178337 bytes",
            "libssl-3e69114b.so.1.1": "[BINARY] 646065 bytes"
          },
          "pyasn1": {
            "__init__.py": "[FILE] 3 lines",
            "codec": {
              "__init__.py": "[FILE] 2 lines",
              "ber": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 2208 lines",
                "encoder.py": "[FILE] 955 lines",
                "eoo.py": "[FILE] 29 lines"
              },
              "cer": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 150 lines",
                "encoder.py": "[FILE] 332 lines"
              },
              "der": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 121 lines",
                "encoder.py": "[FILE] 127 lines"
              },
              "native": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 245 lines",
                "encoder.py": "[FILE] 286 lines"
              },
              "streaming.py": "[FILE] 235 lines"
            },
            "compat": {
              "__init__.py": "[FILE] 5 lines",
              "integer.py": "[FILE] 14 lines"
            },
            "debug.py": "[FILE] 147 lines",
            "error.py": "[FILE] 117 lines",
            "type": {
              "__init__.py": "[FILE] 2 lines",
              "base.py": "[FILE] 700 lines",
              "char.py": "[FILE] 289 lines",
              "constraint.py": "[FILE] 752 lines",
              "error.py": "[FILE] 12 lines",
              "namedtype.py": "[FILE] 551 lines",
              "namedval.py": "[FILE] 193 lines",
              "opentype.py": "[FILE] 105 lines",
              "tag.py": "[FILE] 336 lines",
              "tagmap.py": "[FILE] 97 lines",
              "univ.py": "[FILE] 3328 lines",
              "useful.py": "[FILE] 190 lines"
            }
          },
          "pyasn1-0.6.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8411 bytes",
            "RECORD": "[BINARY] 4866 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE.rst": "[BINARY] 1334 bytes"
            },
            "top_level.txt": "[BINARY] 7 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "pycparser": {
            "__init__.py": "[FILE] 100 lines",
            "_ast_gen.py": "[FILE] 356 lines",
            "_c_ast.cfg": "[BINARY] 4255 bytes",
            "ast_transforms.py": "[FILE] 175 lines",
            "c_ast.py": "[FILE] 1342 lines",
            "c_generator.py": "[FILE] 574 lines",
            "c_lexer.py": "[FILE] 707 lines",
            "c_parser.py": "[FILE] 2377 lines"
          },
          "pycparser-3.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8229 bytes",
            "RECORD": "[BINARY] 1484 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1543 bytes"
            },
            "top_level.txt": "[BINARY] 10 bytes"
          },
          "pydantic": {
            "__init__.py": "[FILE] 395 lines",
            "_internal": {
              "__init__.py": "[FILE] 1 lines",
              "_config.py": "[FILE] 335 lines",
              "_core_metadata.py": "[FILE] 93 lines",
              "_core_utils.py": "[FILE] 569 lines",
              "_dataclasses.py": "[FILE] 231 lines",
              "_decorators.py": "[FILE] 792 lines",
              "_decorators_v1.py": "[FILE] 182 lines",
              "_discriminated_union.py": "[FILE] 504 lines",
              "_docs_extraction.py": "[FILE] 108 lines",
              "_fields.py": "[FILE] 345 lines",
              "_forward_ref.py": "[FILE] 24 lines",
              "_generate_schema.py": "[FILE] 2304 lines",
              "_generics.py": "[FILE] 518 lines",
              "_git.py": "[FILE] 27 lines",
              "_internal_dataclass.py": "[FILE] 11 lines",
              "_known_annotated_metadata.py": "[FILE] 429 lines",
              "_mock_val_ser.py": "[FILE] 141 lines",
              "_model_construction.py": "[FILE] 714 lines",
              "_repr.py": "[FILE] 118 lines",
              "_schema_generation_shared.py": "[FILE] 125 lines",
              "_signature.py": "[FILE] 165 lines",
              "_std_types_schema.py": "[FILE] 716 lines",
              "_typing_extra.py": "[FILE] 495 lines",
              "_utils.py": "[FILE] 363 lines",
              "_validate_call.py": "[FILE] 85 lines",
              "_validators.py": "[FILE] 290 lines"
            },
            "_migration.py": "[FILE] 309 lines",
            "alias_generators.py": "[FILE] 51 lines",
            "aliases.py": "[FILE] 113 lines",
            "annotated_handlers.py": "[FILE] 121 lines",
            "class_validators.py": "[FILE] 5 lines",
            "color.py": "[FILE] 604 lines",
            "config.py": "[FILE] 1004 lines",
            "dataclasses.py": "[FILE] 328 lines",
            "datetime_parse.py": "[FILE] 5 lines",
            "decorator.py": "[FILE] 5 lines",
            "deprecated": {
              "__init__.py": "[FILE] 1 lines",
              "class_validators.py": "[FILE] 266 lines",
              "config.py": "[FILE] 73 lines",
              "copy_internals.py": "[FILE] 225 lines",
              "decorator.py": "[FILE] 280 lines",
              "json.py": "[FILE] 141 lines",
              "parse.py": "[FILE] 81 lines",
              "tools.py": "[FILE] 104 lines"
            },
            "env_settings.py": "[FILE] 5 lines",
            "error_wrappers.py": "[FILE] 5 lines",
            "errors.py": "[FILE] 154 lines",
            "fields.py": "[FILE] 1238 lines",
            "functional_serializers.py": "[FILE] 400 lines",
            "functional_validators.py": "[FILE] 710 lines",
            "generics.py": "[FILE] 5 lines",
            "json.py": "[FILE] 5 lines",
            "json_schema.py": "[FILE] 2494 lines",
            "main.py": "[FILE] 1542 lines",
            "mypy.py": "[FILE] 1285 lines",
            "networks.py": "[FILE] 733 lines",
            "parse.py": "[FILE] 5 lines",
            "plugin": {
              "__init__.py": "[FILE] 171 lines",
              "_loader.py": "[FILE] 57 lines",
              "_schema_validator.py": "[FILE] 139 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "root_model.py": "[FILE] 156 lines",
            "schema.py": "[FILE] 5 lines",
            "tools.py": "[FILE] 5 lines",
            "type_adapter.py": "[FILE] 474 lines",
            "types.py": "[FILE] 2997 lines",
            "typing.py": "[FILE] 5 lines",
            "utils.py": "[FILE] 5 lines",
            "v1": {
              "__init__.py": "[FILE] 132 lines",
              "_hypothesis_plugin.py": "[FILE] 392 lines",
              "annotated_types.py": "[FILE] 73 lines",
              "class_validators.py": "[FILE] 362 lines",
              "color.py": "[FILE] 495 lines",
              "config.py": "[FILE] 192 lines",
              "dataclasses.py": "[FILE] 501 lines",
              "datetime_parse.py": "[FILE] 249 lines",
              "decorator.py": "[FILE] 265 lines",
              "env_settings.py": "[FILE] 351 lines",
              "error_wrappers.py": "[FILE] 162 lines",
              "errors.py": "[FILE] 647 lines",
              "fields.py": "[FILE] 1254 lines",
              "generics.py": "[FILE] 401 lines",
              "json.py": "[FILE] 113 lines",
              "main.py": "[FILE] 1108 lines",
              "mypy.py": "[FILE] 945 lines",
              "networks.py": "[FILE] 748 lines",
              "parse.py": "[FILE] 67 lines",
              "py.typed": "[BINARY] 0 bytes",
              "schema.py": "[FILE] 1164 lines",
              "tools.py": "[FILE] 93 lines",
              "types.py": "[FILE] 1206 lines",
              "typing.py": "[FILE] 604 lines",
              "utils.py": "[FILE] 804 lines",
              "v1.py": "[FILE] 117 lines",
              "validators.py": "[FILE] 766 lines",
              "version.py": "[FILE] 39 lines"
            },
            "validate_call_decorator.py": "[FILE] 69 lines",
            "validators.py": "[FILE] 5 lines",
            "version.py": "[FILE] 78 lines",
            "warnings.py": "[FILE] 59 lines"
          },
          "pydantic-2.7.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 103375 bytes",
            "RECORD": "[BINARY] 14549 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1129 bytes"
            }
          },
          "pydantic_core": {
            "__init__.py": "[FILE] 140 lines",
            "_pydantic_core.cpython-312-x86_64-linux-gnu.so": "[BINARY] 5088024 bytes",
            "_pydantic_core.pyi": "[BINARY] 35226 bytes",
            "core_schema.py": "[FILE] 4046 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "pydantic_core-2.18.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6534 bytes",
            "RECORD": "[BINARY] 1007 bytes",
            "WHEEL": "[BINARY] 129 bytes",
            "license_files": {
              "LICENSE": "[BINARY] 1080 bytes"
            }
          },
          "pydantic_settings": {
            "__init__.py": "[FILE] 23 lines",
            "main.py": "[FILE] 178 lines",
            "py.typed": "[BINARY] 0 bytes",
            "sources.py": "[FILE] 650 lines",
            "utils.py": "[FILE] 25 lines",
            "version.py": "[FILE] 2 lines"
          },
          "pydantic_settings-2.1.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2931 bytes",
            "RECORD": "[BINARY] 1328 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1103 bytes"
            }
          },
          "python_dateutil-2.9.0.post0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2889 bytes",
            "METADATA": "[BINARY] 8354 bytes",
            "RECORD": "[BINARY] 3125 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 9 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "python_dotenv-1.0.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1556 bytes",
            "METADATA": "[BINARY] 21991 bytes",
            "RECORD": "[BINARY] 1816 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 47 bytes",
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "python_jose-3.3.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1081 bytes",
            "METADATA": "[BINARY] 5403 bytes",
            "RECORD": "[BINARY] 2491 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 19 bytes"
          },
          "python_multipart-0.0.6.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2459 bytes",
            "RECORD": "[BINARY] 6237 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 556 bytes"
            }
          },
          "pyyaml-6.0.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2351 bytes",
            "RECORD": "[BINARY] 2706 bytes",
            "WHEEL": "[BINARY] 190 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1101 bytes"
            },
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "redis": {
            "__init__.py": "[FILE] 95 lines",
            "_parsers": {
              "__init__.py": "[FILE] 21 lines",
              "base.py": "[FILE] 226 lines",
              "commands.py": "[FILE] 282 lines",
              "encoders.py": "[FILE] 45 lines",
              "helpers.py": "[FILE] 853 lines",
              "hiredis.py": "[FILE] 218 lines",
              "resp2.py": "[FILE] 133 lines",
              "resp3.py": "[FILE] 260 lines",
              "socket.py": "[FILE] 163 lines"
            },
            "asyncio": {
              "__init__.py": "[FILE] 65 lines",
              "client.py": "[FILE] 1534 lines",
              "cluster.py": "[FILE] 1621 lines",
              "connection.py": "[FILE] 1181 lines",
              "lock.py": "[FILE] 314 lines",
              "retry.py": "[FILE] 68 lines",
              "sentinel.py": "[FILE] 376 lines",
              "utils.py": "[FILE] 29 lines"
            },
            "backoff.py": "[FILE] 115 lines",
            "client.py": "[FILE] 1501 lines",
            "cluster.py": "[FILE] 2487 lines",
            "commands": {
              "__init__.py": "[FILE] 19 lines",
              "bf": {
                "__init__.py": "[FILE] 254 lines",
                "commands.py": "[FILE] 543 lines",
                "info.py": "[FILE] 121 lines"
              },
              "cluster.py": "[FILE] 929 lines",
              "core.py": "[FILE] 6306 lines",
              "graph": {
                "__init__.py": "[FILE] 264 lines",
                "commands.py": "[FILE] 314 lines",
                "edge.py": "[FILE] 92 lines",
                "exceptions.py": "[FILE] 4 lines",
                "execution_plan.py": "[FILE] 212 lines",
                "node.py": "[FILE] 89 lines",
                "path.py": "[FILE] 79 lines",
                "query_result.py": "[FILE] 574 lines"
              },
              "helpers.py": "[FILE] 167 lines",
              "json": {
                "__init__.py": "[FILE] 148 lines",
                "_util.py": "[FILE] 4 lines",
                "commands.py": "[FILE] 430 lines",
                "decoders.py": "[FILE] 61 lines",
                "path.py": "[FILE] 17 lines"
              },
              "redismodules.py": "[FILE] 104 lines",
              "search": {
                "__init__.py": "[FILE] 190 lines",
                "_util.py": "[FILE] 8 lines",
                "aggregation.py": "[FILE] 373 lines",
                "commands.py": "[FILE] 1118 lines",
                "document.py": "[FILE] 18 lines",
                "field.py": "[FILE] 169 lines",
                "indexDefinition.py": "[FILE] 80 lines",
                "query.py": "[FILE] 363 lines",
                "querystring.py": "[FILE] 318 lines",
                "reducers.py": "[FILE] 183 lines",
                "result.py": "[FILE] 74 lines",
                "suggestion.py": "[FILE] 56 lines"
              },
              "sentinel.py": "[FILE] 100 lines",
              "timeseries": {
                "__init__.py": "[FILE] 109 lines",
                "commands.py": "[FILE] 897 lines",
                "info.py": "[FILE] 92 lines",
                "utils.py": "[FILE] 45 lines"
              }
            },
            "compat.py": "[FILE] 7 lines",
            "connection.py": "[FILE] 1337 lines",
            "crc.py": "[FILE] 24 lines",
            "credentials.py": "[FILE] 27 lines",
            "exceptions.py": "[FILE] 219 lines",
            "lock.py": "[FILE] 309 lines",
            "ocsp.py": "[FILE] 308 lines",
            "py.typed": "[BINARY] 0 bytes",
            "retry.py": "[FILE] 55 lines",
            "sentinel.py": "[FILE] 390 lines",
            "typing.py": "[FILE] 66 lines",
            "utils.py": "[FILE] 148 lines"
          },
          "redis-5.0.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1074 bytes",
            "METADATA": "[BINARY] 8910 bytes",
            "RECORD": "[BINARY] 10376 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "rsa": {
            "__init__.py": "[FILE] 61 lines",
            "asn1.py": "[FILE] 53 lines",
            "cli.py": "[FILE] 322 lines",
            "common.py": "[FILE] 185 lines",
            "core.py": "[FILE] 54 lines",
            "key.py": "[FILE] 859 lines",
            "parallel.py": "[FILE] 97 lines",
            "pem.py": "[FILE] 135 lines",
            "pkcs1.py": "[FILE] 486 lines",
            "pkcs1_v2.py": "[FILE] 101 lines",
            "prime.py": "[FILE] 199 lines",
            "py.typed": "[BINARY] 63 bytes",
            "randnum.py": "[FILE] 96 lines",
            "transform.py": "[FILE] 73 lines",
            "util.py": "[FILE] 98 lines"
          },
          "rsa-4.9.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 577 bytes",
            "METADATA": "[BINARY] 5590 bytes",
            "RECORD": "[BINARY] 2590 bytes",
            "WHEEL": "[BINARY] 88 bytes",
            "entry_points.txt": "[BINARY] 201 bytes"
          },
          "six-1.17.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1066 bytes",
            "METADATA": "[BINARY] 1658 bytes",
            "RECORD": "[BINARY] 561 bytes",
            "WHEEL": "[BINARY] 109 bytes",
            "top_level.txt": "[BINARY] 4 bytes"
          },
          "six.py": "[FILE] 1004 lines",
          "sniffio": {
            "__init__.py": "[FILE] 18 lines",
            "_impl.py": "[FILE] 96 lines",
            "_tests": {
              "__init__.py": "[FILE] 1 lines",
              "test_sniffio.py": "[FILE] 85 lines"
            },
            "_version.py": "[FILE] 4 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "sniffio-1.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 185 bytes",
            "LICENSE.APACHE2": "[BINARY] 11358 bytes",
            "LICENSE.MIT": "[BINARY] 1046 bytes",
            "METADATA": "[BINARY] 3875 bytes",
            "RECORD": "[BINARY] 1388 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "sqlalchemy": {
            "__init__.py": "[FILE] 286 lines",
            "connectors": {
              "__init__.py": "[FILE] 19 lines",
              "aioodbc.py": "[FILE] 188 lines",
              "asyncio.py": "[FILE] 210 lines",
              "pyodbc.py": "[FILE] 248 lines"
            },
            "cyextension": {
              "__init__.py": "[FILE] 1 lines",
              "collections.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1947440 bytes",
              "collections.pyx": "[BINARY] 12323 bytes",
              "immutabledict.cpython-312-x86_64-linux-gnu.so": "[BINARY] 811232 bytes",
              "immutabledict.pxd": "[BINARY] 41 bytes",
              "immutabledict.pyx": "[BINARY] 3285 bytes",
              "processors.cpython-312-x86_64-linux-gnu.so": "[BINARY] 533968 bytes",
              "processors.pyx": "[BINARY] 1545 bytes",
              "resultproxy.cpython-312-x86_64-linux-gnu.so": "[BINARY] 626112 bytes",
              "resultproxy.pyx": "[BINARY] 2477 bytes",
              "util.cpython-312-x86_64-linux-gnu.so": "[BINARY] 958760 bytes",
              "util.pyx": "[BINARY] 2289 bytes"
            },
            "dialects": {
              "__init__.py": "[FILE] 62 lines",
              "_typing.py": "[FILE] 20 lines",
              "mssql": {
                "__init__.py": "[FILE] 89 lines",
                "aioodbc.py": "[FILE] 65 lines",
                "base.py": "[FILE] 4049 lines",
                "information_schema.py": "[FILE] 254 lines",
                "json.py": "[FILE] 128 lines",
                "provision.py": "[FILE] 147 lines",
                "pymssql.py": "[FILE] 126 lines",
                "pyodbc.py": "[FILE] 747 lines"
              },
              "mysql": {
                "__init__.py": "[FILE] 102 lines",
                "aiomysql.py": "[FILE] 326 lines",
                "asyncmy.py": "[FILE] 331 lines",
                "base.py": "[FILE] 3444 lines",
                "cymysql.py": "[FILE] 85 lines",
                "dml.py": "[FILE] 220 lines",
                "enumerated.py": "[FILE] 245 lines",
                "expression.py": "[FILE] 141 lines",
                "json.py": "[FILE] 82 lines",
                "mariadb.py": "[FILE] 33 lines",
                "mariadbconnector.py": "[FILE] 283 lines",
                "mysqlconnector.py": "[FILE] 180 lines",
                "mysqldb.py": "[FILE] 309 lines",
                "provision.py": "[FILE] 102 lines",
                "pymysql.py": "[FILE] 136 lines",
                "pyodbc.py": "[FILE] 139 lines",
                "reflection.py": "[FILE] 673 lines",
                "reserved_words.py": "[FILE] 568 lines",
                "types.py": "[FILE] 774 lines"
              },
              "oracle": {
                "__init__.py": "[FILE] 64 lines",
                "base.py": "[FILE] 3233 lines",
                "cx_oracle.py": "[FILE] 1485 lines",
                "dictionary.py": "[FILE] 507 lines",
                "oracledb.py": "[FILE] 110 lines",
                "provision.py": "[FILE] 215 lines",
                "types.py": "[FILE] 287 lines"
              },
              "postgresql": {
                "__init__.py": "[FILE] 164 lines",
                "_psycopg_common.py": "[FILE] 187 lines",
                "array.py": "[FILE] 427 lines",
                "asyncpg.py": "[FILE] 1262 lines",
                "base.py": "[FILE] 4891 lines",
                "dml.py": "[FILE] 311 lines",
                "ext.py": "[FILE] 497 lines",
                "hstore.py": "[FILE] 398 lines",
                "json.py": "[FILE] 326 lines",
                "named_types.py": "[FILE] 497 lines",
                "operators.py": "[FILE] 130 lines",
                "pg8000.py": "[FILE] 665 lines",
                "pg_catalog.py": "[FILE] 295 lines",
                "provision.py": "[FILE] 170 lines",
                "psycopg.py": "[FILE] 747 lines",
                "psycopg2.py": "[FILE] 877 lines",
                "psycopg2cffi.py": "[FILE] 62 lines",
                "ranges.py": "[FILE] 947 lines",
                "types.py": "[FILE] 313 lines"
              },
              "sqlite": {
                "__init__.py": "[FILE] 58 lines",
                "aiosqlite.py": "[FILE] 397 lines",
                "base.py": "[FILE] 2783 lines",
                "dml.py": "[FILE] 241 lines",
                "json.py": "[FILE] 87 lines",
                "provision.py": "[FILE] 193 lines",
                "pysqlcipher.py": "[FILE] 156 lines",
                "pysqlite.py": "[FILE] 754 lines"
              },
              "type_migration_guidelines.txt": "[BINARY] 8239 bytes"
            },
            "engine": {
              "__init__.py": "[FILE] 63 lines",
              "_py_processors.py": "[FILE] 137 lines",
              "_py_row.py": "[FILE] 123 lines",
              "_py_util.py": "[FILE] 69 lines",
              "base.py": "[FILE] 3366 lines",
              "characteristics.py": "[FILE] 76 lines",
              "create.py": "[FILE] 861 lines",
              "cursor.py": "[FILE] 2150 lines",
              "default.py": "[FILE] 2324 lines",
              "events.py": "[FILE] 952 lines",
              "interfaces.py": "[FILE] 3407 lines",
              "mock.py": "[FILE] 132 lines",
              "processors.py": "[FILE] 62 lines",
              "reflection.py": "[FILE] 2090 lines",
              "result.py": "[FILE] 2406 lines",
              "row.py": "[FILE] 406 lines",
              "strategies.py": "[FILE] 20 lines",
              "url.py": "[FILE] 914 lines",
              "util.py": "[FILE] 167 lines"
            },
            "event": {
              "__init__.py": "[FILE] 26 lines",
              "api.py": "[FILE] 226 lines",
              "attr.py": "[FILE] 642 lines",
              "base.py": "[FILE] 466 lines",
              "legacy.py": "[FILE] 247 lines",
              "registry.py": "[FILE] 387 lines"
            },
            "events.py": "[FILE] 18 lines",
            "exc.py": "[FILE] 834 lines",
            "ext": {
              "__init__.py": "[FILE] 12 lines",
              "associationproxy.py": "[FILE] 2029 lines",
              "asyncio": {
                "__init__.py": "[FILE] 26 lines",
                "base.py": "[FILE] 284 lines",
                "engine.py": "[FILE] 1469 lines",
                "exc.py": "[FILE] 22 lines",
                "result.py": "[FILE] 977 lines",
                "scoping.py": "[FILE] 1626 lines",
                "session.py": "[FILE] 1941 lines"
              },
              "automap.py": "[FILE] 1659 lines",
              "baked.py": "[FILE] 575 lines",
              "compiler.py": "[FILE] 556 lines",
              "declarative": {
                "__init__.py": "[FILE] 66 lines",
                "extensions.py": "[FILE] 549 lines"
              },
              "horizontal_shard.py": "[FILE] 484 lines",
              "hybrid.py": "[FILE] 1525 lines",
              "indexable.py": "[FILE] 342 lines",
              "instrumentation.py": "[FILE] 453 lines",
              "mutable.py": "[FILE] 1079 lines",
              "mypy": {
                "__init__.py": "[FILE] 1 lines",
                "apply.py": "[FILE] 319 lines",
                "decl_class.py": "[FILE] 516 lines",
                "infer.py": "[FILE] 591 lines",
                "names.py": "[FILE] 343 lines",
                "plugin.py": "[FILE] 304 lines",
                "util.py": "[FILE] 339 lines"
              },
              "orderinglist.py": "[FILE] 417 lines",
              "serializer.py": "[FILE] 186 lines"
            },
            "future": {
              "__init__.py": "[FILE] 17 lines",
              "engine.py": "[FILE] 16 lines"
            },
            "inspection.py": "[FILE] 182 lines",
            "log.py": "[FILE] 291 lines",
            "orm": {
              "__init__.py": "[FILE] 171 lines",
              "_orm_constructors.py": "[FILE] 2484 lines",
              "_typing.py": "[FILE] 186 lines",
              "attributes.py": "[FILE] 2843 lines",
              "base.py": "[FILE] 996 lines",
              "bulk_persistence.py": "[FILE] 2049 lines",
              "clsregistry.py": "[FILE] 573 lines",
              "collections.py": "[FILE] 1620 lines",
              "context.py": "[FILE] 3228 lines",
              "decl_api.py": "[FILE] 1887 lines",
              "decl_base.py": "[FILE] 2156 lines",
              "dependency.py": "[FILE] 1303 lines",
              "descriptor_props.py": "[FILE] 1075 lines",
              "dynamic.py": "[FILE] 300 lines",
              "evaluator.py": "[FILE] 369 lines",
              "events.py": "[FILE] 3249 lines",
              "exc.py": "[FILE] 228 lines",
              "identity.py": "[FILE] 303 lines",
              "instrumentation.py": "[FILE] 757 lines",
              "interfaces.py": "[FILE] 1466 lines",
              "loading.py": "[FILE] 1662 lines",
              "mapped_collection.py": "[FILE] 563 lines",
              "mapper.py": "[FILE] 4417 lines",
              "path_registry.py": "[FILE] 820 lines",
              "persistence.py": "[FILE] 1756 lines",
              "properties.py": "[FILE] 880 lines",
              "query.py": "[FILE] 3415 lines",
              "relationships.py": "[FILE] 3467 lines",
              "scoping.py": "[FILE] 2184 lines",
              "session.py": "[FILE] 5257 lines",
              "state.py": "[FILE] 1139 lines",
              "state_changes.py": "[FILE] 199 lines",
              "strategies.py": "[FILE] 3339 lines",
              "strategy_options.py": "[FILE] 2529 lines",
              "sync.py": "[FILE] 164 lines",
              "unitofwork.py": "[FILE] 797 lines",
              "util.py": "[FILE] 2408 lines",
              "writeonly.py": "[FILE] 682 lines"
            },
            "pool": {
              "__init__.py": "[FILE] 45 lines",
              "base.py": "[FILE] 1522 lines",
              "events.py": "[FILE] 371 lines",
              "impl.py": "[FILE] 553 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "schema.py": "[FILE] 71 lines",
            "sql": {
              "__init__.py": "[FILE] 146 lines",
              "_dml_constructors.py": "[FILE] 141 lines",
              "_elements_constructors.py": "[FILE] 1851 lines",
              "_orm_types.py": "[FILE] 21 lines",
              "_py_util.py": "[FILE] 76 lines",
              "_selectable_constructors.py": "[FILE] 643 lines",
              "_typing.py": "[FILE] 457 lines",
              "annotation.py": "[FILE] 595 lines",
              "base.py": "[FILE] 2197 lines",
              "cache_key.py": "[FILE] 1030 lines",
              "coercions.py": "[FILE] 1407 lines",
              "compiler.py": "[FILE] 7656 lines",
              "crud.py": "[FILE] 1672 lines",
              "ddl.py": "[FILE] 1378 lines",
              "default_comparator.py": "[FILE] 550 lines",
              "dml.py": "[FILE] 1836 lines",
              "elements.py": "[FILE] 5406 lines",
              "events.py": "[FILE] 456 lines",
              "expression.py": "[FILE] 163 lines",
              "functions.py": "[FILE] 1829 lines",
              "lambdas.py": "[FILE] 1451 lines",
              "naming.py": "[FILE] 213 lines",
              "operators.py": "[FILE] 2597 lines",
              "roles.py": "[FILE] 326 lines",
              "schema.py": "[FILE] 6119 lines",
              "selectable.py": "[FILE] 6935 lines",
              "sqltypes.py": "[FILE] 3851 lines",
              "traversals.py": "[FILE] 1022 lines",
              "type_api.py": "[FILE] 2327 lines",
              "util.py": "[FILE] 1500 lines",
              "visitors.py": "[FILE] 1182 lines"
            },
            "testing": {
              "__init__.py": "[FILE] 96 lines",
              "assertions.py": "[FILE] 990 lines",
              "assertsql.py": "[FILE] 517 lines",
              "asyncio.py": "[FILE] 131 lines",
              "config.py": "[FILE] 425 lines",
              "engines.py": "[FILE] 470 lines",
              "entities.py": "[FILE] 118 lines",
              "exclusions.py": "[FILE] 436 lines",
              "fixtures": {
                "__init__.py": "[FILE] 29 lines",
                "base.py": "[FILE] 367 lines",
                "mypy.py": "[FILE] 309 lines",
                "orm.py": "[FILE] 228 lines",
                "sql.py": "[FILE] 493 lines"
              },
              "pickleable.py": "[FILE] 156 lines",
              "plugin": {
                "__init__.py": "[FILE] 1 lines",
                "bootstrap.py": "[FILE] 46 lines",
                "plugin_base.py": "[FILE] 780 lines",
                "pytestplugin.py": "[FILE] 857 lines"
              },
              "profiling.py": "[FILE] 325 lines",
              "provision.py": "[FILE] 487 lines",
              "requirements.py": "[FILE] 1766 lines",
              "schema.py": "[FILE] 225 lines",
              "suite": {
                "__init__.py": "[FILE] 14 lines",
                "test_cte.py": "[FILE] 206 lines",
                "test_ddl.py": "[FILE] 384 lines",
                "test_deprecations.py": "[FILE] 148 lines",
                "test_dialect.py": "[FILE] 735 lines",
                "test_insert.py": "[FILE] 615 lines",
                "test_reflection.py": "[FILE] 3123 lines",
                "test_results.py": "[FILE] 463 lines",
                "test_rowcount.py": "[FILE] 253 lines",
                "test_select.py": "[FILE] 1883 lines",
                "test_sequence.py": "[FILE] 312 lines",
                "test_types.py": "[FILE] 2066 lines",
                "test_unicode_ddl.py": "[FILE] 184 lines",
                "test_update_delete.py": "[FILE] 130 lines"
              },
              "util.py": "[FILE] 520 lines",
              "warnings.py": "[FILE] 53 lines"
            },
            "types.py": "[FILE] 77 lines",
            "util": {
              "__init__.py": "[FILE] 160 lines",
              "_collections.py": "[FILE] 724 lines",
              "_concurrency_py3k.py": "[FILE] 261 lines",
              "_has_cy.py": "[FILE] 40 lines",
              "_py_collections.py": "[FILE] 540 lines",
              "compat.py": "[FILE] 321 lines",
              "concurrency.py": "[FILE] 70 lines",
              "deprecations.py": "[FILE] 402 lines",
              "langhelpers.py": "[FILE] 2219 lines",
              "preloaded.py": "[FILE] 151 lines",
              "queue.py": "[FILE] 325 lines",
              "tool_support.py": "[FILE] 199 lines",
              "topological.py": "[FILE] 121 lines",
              "typing.py": "[FILE] 575 lines"
            }
          },
          "starlette": {
            "__init__.py": "[FILE] 2 lines",
            "_compat.py": "[FILE] 29 lines",
            "_utils.py": "[FILE] 75 lines",
            "applications.py": "[FILE] 262 lines",
            "authentication.py": "[FILE] 154 lines",
            "background.py": "[FILE] 44 lines",
            "concurrency.py": "[FILE] 66 lines",
            "config.py": "[FILE] 150 lines",
            "convertors.py": "[FILE] 88 lines",
            "datastructures.py": "[FILE] 709 lines",
            "endpoints.py": "[FILE] 131 lines",
            "exceptions.py": "[FILE] 55 lines",
            "formparsers.py": "[FILE] 277 lines",
            "middleware": {
              "__init__.py": "[FILE] 18 lines",
              "authentication.py": "[FILE] 53 lines",
              "base.py": "[FILE] 135 lines",
              "cors.py": "[FILE] 177 lines",
              "errors.py": "[FILE] 257 lines",
              "exceptions.py": "[FILE] 110 lines",
              "gzip.py": "[FILE] 114 lines",
              "httpsredirect.py": "[FILE] 20 lines",
              "sessions.py": "[FILE] 87 lines",
              "trustedhost.py": "[FILE] 61 lines",
              "wsgi.py": "[FILE] 141 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "requests.py": "[FILE] 319 lines",
            "responses.py": "[FILE] 367 lines",
            "routing.py": "[FILE] 863 lines",
            "schemas.py": "[FILE] 146 lines",
            "staticfiles.py": "[FILE] 247 lines",
            "status.py": "[FILE] 200 lines",
            "templating.py": "[FILE] 121 lines",
            "testclient.py": "[FILE] 798 lines",
            "types.py": "[FILE] 18 lines",
            "websockets.py": "[FILE] 194 lines"
          },
          "starlette-0.27.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 5836 bytes",
            "RECORD": "[BINARY] 5166 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 28 lines"
            }
          },
          "structlog": {
            "__init__.py": "[FILE] 129 lines",
            "_base.py": "[FILE] 239 lines",
            "_config.py": "[FILE] 432 lines",
            "_frames.py": "[FILE] 84 lines",
            "_generic.py": "[FILE] 55 lines",
            "_greenlets.py": "[FILE] 45 lines",
            "_log_levels.py": "[FILE] 76 lines",
            "_native.py": "[FILE] 236 lines",
            "_output.py": "[FILE] 349 lines",
            "_utils.py": "[FILE] 60 lines",
            "contextvars.py": "[FILE] 188 lines",
            "dev.py": "[FILE] 784 lines",
            "exceptions.py": "[FILE] 19 lines",
            "processors.py": "[FILE] 900 lines",
            "py.typed": "[BINARY] 0 bytes",
            "stdlib.py": "[FILE] 1135 lines",
            "testing.py": "[FILE] 209 lines",
            "threadlocal.py": "[FILE] 355 lines",
            "tracebacks.py": "[FILE] 285 lines",
            "twisted.py": "[FILE] 331 lines",
            "types.py": "[FILE] 39 lines",
            "typing.py": "[FILE] 312 lines"
          },
          "structlog-24.1.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6941 bytes",
            "RECORD": "[BINARY] 3485 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE-APACHE": "[BINARY] 10174 bytes",
              "LICENSE-MIT": "[BINARY] 1113 bytes",
              "NOTICE": "[BINARY] 72 bytes"
            }
          },
          "tenacity": {
            "__init__.py": "[FILE] 607 lines",
            "_asyncio.py": "[FILE] 95 lines",
            "_utils.py": "[FILE] 77 lines",
            "after.py": "[FILE] 52 lines",
            "before.py": "[FILE] 47 lines",
            "before_sleep.py": "[FILE] 72 lines",
            "nap.py": "[FILE] 44 lines",
            "py.typed": "[BINARY] 0 bytes",
            "retry.py": "[FILE] 273 lines",
            "stop.py": "[FILE] 104 lines",
            "tornadoweb.py": "[FILE] 60 lines",
            "wait.py": "[FILE] 229 lines"
          },
          "tenacity-8.2.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 11357 bytes",
            "METADATA": "[BINARY] 1049 bytes",
            "RECORD": "[BINARY] 2010 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "typing_extensions-4.15.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3259 bytes",
            "RECORD": "[BINARY] 580 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 13936 bytes"
            }
          },
          "typing_extensions.py": "[FILE] 4318 lines",
          "tzdata": {
            "__init__.py": "[FILE] 7 lines",
            "zoneinfo": {
              "Africa": {
                "Abidjan": "[BINARY] 130 bytes",
                "Accra": "[BINARY] 130 bytes",
                "Addis_Ababa": "[BINARY] 191 bytes",
                "Algiers": "[BINARY] 470 bytes",
                "Asmara": "[BINARY] 191 bytes",
                "Asmera": "[BINARY] 191 bytes",
                "Bamako": "[BINARY] 130 bytes",
                "Bangui": "[BINARY] 180 bytes",
                "Banjul": "[BINARY] 130 bytes",
                "Bissau": "[BINARY] 149 bytes",
                "Blantyre": "[BINARY] 131 bytes",
                "Brazzaville": "[BINARY] 180 bytes",
                "Bujumbura": "[BINARY] 131 bytes",
                "Cairo": "[BINARY] 1309 bytes",
                "Casablanca": "[BINARY] 1919 bytes",
                "Ceuta": "[BINARY] 562 bytes",
                "Conakry": "[BINARY] 130 bytes",
                "Dakar": "[BINARY] 130 bytes",
                "Dar_es_Salaam": "[BINARY] 191 bytes",
                "Djibouti": "[BINARY] 191 bytes",
                "Douala": "[BINARY] 180 bytes",
                "El_Aaiun": "[BINARY] 1830 bytes",
                "Freetown": "[BINARY] 130 bytes",
                "Gaborone": "[BINARY] 131 bytes",
                "Harare": "[BINARY] 131 bytes",
                "Johannesburg": "[BINARY] 190 bytes",
                "Juba": "[BINARY] 458 bytes",
                "Kampala": "[BINARY] 191 bytes",
                "Khartoum": "[BINARY] 458 bytes",
                "Kigali": "[BINARY] 131 bytes",
                "Kinshasa": "[BINARY] 180 bytes",
                "Lagos": "[BINARY] 180 bytes",
                "Libreville": "[BINARY] 180 bytes",
                "Lome": "[BINARY] 130 bytes",
                "Luanda": "[BINARY] 180 bytes",
                "Lubumbashi": "[BINARY] 131 bytes",
                "Lusaka": "[BINARY] 131 bytes",
                "Malabo": "[BINARY] 180 bytes",
                "Maputo": "[BINARY] 131 bytes",
                "Maseru": "[BINARY] 190 bytes",
                "Mbabane": "[BINARY] 190 bytes",
                "Mogadishu": "[BINARY] 191 bytes",
                "Monrovia": "[BINARY] 164 bytes",
                "Nairobi": "[BINARY] 191 bytes",
                "Ndjamena": "[BINARY] 160 bytes",
                "Niamey": "[BINARY] 180 bytes",
                "Nouakchott": "[BINARY] 130 bytes",
                "Ouagadougou": "[BINARY] 130 bytes",
                "Porto-Novo": "[BINARY] 180 bytes",
                "Sao_Tome": "[BINARY] 173 bytes",
                "Timbuktu": "[BINARY] 130 bytes",
                "Tripoli": "[BINARY] 431 bytes",
                "Tunis": "[BINARY] 449 bytes",
                "Windhoek": "[BINARY] 638 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "America": {
                "Adak": "[BINARY] 969 bytes",
                "Anchorage": "[BINARY] 977 bytes",
                "Anguilla": "[BINARY] 177 bytes",
                "Antigua": "[BINARY] 177 bytes",
                "Araguaina": "[BINARY] 592 bytes",
                "Argentina": {
                  "Buenos_Aires": "[BINARY] 708 bytes",
                  "Catamarca": "[BINARY] 708 bytes",
                  "ComodRivadavia": "[BINARY] 708 bytes",
                  "Cordoba": "[BINARY] 708 bytes",
                  "Jujuy": "[BINARY] 690 bytes",
                  "La_Rioja": "[BINARY] 717 bytes",
                  "Mendoza": "[BINARY] 708 bytes",
                  "Rio_Gallegos": "[BINARY] 708 bytes",
                  "Salta": "[BINARY] 690 bytes",
                  "San_Juan": "[BINARY] 717 bytes",
                  "San_Luis": "[BINARY] 717 bytes",
                  "Tucuman": "[BINARY] 726 bytes",
                  "Ushuaia": "[BINARY] 708 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Aruba": "[BINARY] 177 bytes",
                "Asuncion": "[BINARY] 1085 bytes",
                "Atikokan": "[BINARY] 149 bytes",
                "Atka": "[BINARY] 969 bytes",
                "Bahia": "[BINARY] 682 bytes",
                "Bahia_Banderas": "[BINARY] 700 bytes",
                "Barbados": "[BINARY] 278 bytes",
                "Belem": "[BINARY] 394 bytes",
                "Belize": "[BINARY] 1045 bytes",
                "Blanc-Sablon": "[BINARY] 177 bytes",
                "Boa_Vista": "[BINARY] 430 bytes",
                "Bogota": "[BINARY] 179 bytes",
                "Boise": "[BINARY] 999 bytes",
                "Buenos_Aires": "[BINARY] 708 bytes",
                "Cambridge_Bay": "[BINARY] 883 bytes",
                "Campo_Grande": "[BINARY] 952 bytes",
                "Cancun": "[BINARY] 538 bytes",
                "Caracas": "[BINARY] 190 bytes",
                "Catamarca": "[BINARY] 708 bytes",
                "Cayenne": "[BINARY] 151 bytes",
                "Cayman": "[BINARY] 149 bytes",
                "Chicago": "[BINARY] 1754 bytes",
                "Chihuahua": "[BINARY] 691 bytes",
                "Ciudad_Juarez": "[BINARY] 718 bytes",
                "Coral_Harbour": "[BINARY] 149 bytes",
                "Cordoba": "[BINARY] 708 bytes",
                "Costa_Rica": "[BINARY] 232 bytes",
                "Coyhaique": "[BINARY] 1362 bytes",
                "Creston": "[BINARY] 240 bytes",
                "Cuiaba": "[BINARY] 934 bytes",
                "Curacao": "[BINARY] 177 bytes",
                "Danmarkshavn": "[BINARY] 447 bytes",
                "Dawson": "[BINARY] 1029 bytes",
                "Dawson_Creek": "[BINARY] 683 bytes",
                "Denver": "[BINARY] 1042 bytes",
                "Detroit": "[BINARY] 899 bytes",
                "Dominica": "[BINARY] 177 bytes",
                "Edmonton": "[BINARY] 970 bytes",
                "Eirunepe": "[BINARY] 436 bytes",
                "El_Salvador": "[BINARY] 176 bytes",
                "Ensenada": "[BINARY] 1367 bytes",
                "Fort_Nelson": "[BINARY] 1448 bytes",
                "Fort_Wayne": "[BINARY] 531 bytes",
                "Fortaleza": "[BINARY] 484 bytes",
                "Glace_Bay": "[BINARY] 880 bytes",
                "Godthab": "[BINARY] 965 bytes",
                "Goose_Bay": "[BINARY] 1580 bytes",
                "Grand_Turk": "[BINARY] 853 bytes",
                "Grenada": "[BINARY] 177 bytes",
                "Guadeloupe": "[BINARY] 177 bytes",
                "Guatemala": "[BINARY] 212 bytes",
                "Guayaquil": "[BINARY] 179 bytes",
                "Guyana": "[BINARY] 181 bytes",
                "Halifax": "[BINARY] 1672 bytes",
                "Havana": "[BINARY] 1117 bytes",
                "Hermosillo": "[BINARY] 258 bytes",
                "Indiana": {
                  "Indianapolis": "[BINARY] 531 bytes",
                  "Knox": "[BINARY] 1016 bytes",
                  "Marengo": "[BINARY] 567 bytes",
                  "Petersburg": "[BINARY] 683 bytes",
                  "Tell_City": "[BINARY] 522 bytes",
                  "Vevay": "[BINARY] 369 bytes",
                  "Vincennes": "[BINARY] 558 bytes",
                  "Winamac": "[BINARY] 603 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Indianapolis": "[BINARY] 531 bytes",
                "Inuvik": "[BINARY] 817 bytes",
                "Iqaluit": "[BINARY] 855 bytes",
                "Jamaica": "[BINARY] 339 bytes",
                "Jujuy": "[BINARY] 690 bytes",
                "Juneau": "[BINARY] 966 bytes",
                "Kentucky": {
                  "Louisville": "[BINARY] 1242 bytes",
                  "Monticello": "[BINARY] 972 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Knox_IN": "[BINARY] 1016 bytes",
                "Kralendijk": "[BINARY] 177 bytes",
                "La_Paz": "[BINARY] 170 bytes",
                "Lima": "[BINARY] 283 bytes",
                "Los_Angeles": "[BINARY] 1294 bytes",
                "Louisville": "[BINARY] 1242 bytes",
                "Lower_Princes": "[BINARY] 177 bytes",
                "Maceio": "[BINARY] 502 bytes",
                "Managua": "[BINARY] 295 bytes",
                "Manaus": "[BINARY] 412 bytes",
                "Marigot": "[BINARY] 177 bytes",
                "Martinique": "[BINARY] 178 bytes",
                "Matamoros": "[BINARY] 437 bytes",
                "Mazatlan": "[BINARY] 690 bytes",
                "Mendoza": "[BINARY] 708 bytes",
                "Menominee": "[BINARY] 917 bytes",
                "Merida": "[BINARY] 654 bytes",
                "Metlakatla": "[BINARY] 586 bytes",
                "Mexico_City": "[BINARY] 773 bytes",
                "Miquelon": "[BINARY] 550 bytes",
                "Moncton": "[BINARY] 1493 bytes",
                "Monterrey": "[BINARY] 709 bytes",
                "Montevideo": "[BINARY] 969 bytes",
                "Montreal": "[BINARY] 1717 bytes",
                "Montserrat": "[BINARY] 177 bytes",
                "Nassau": "[BINARY] 1717 bytes",
                "New_York": "[BINARY] 1744 bytes",
                "Nipigon": "[BINARY] 1717 bytes",
                "Nome": "[BINARY] 975 bytes",
                "Noronha": "[BINARY] 484 bytes",
                "North_Dakota": {
                  "Beulah": "[BINARY] 1043 bytes",
                  "Center": "[BINARY] 990 bytes",
                  "New_Salem": "[BINARY] 990 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Nuuk": "[BINARY] 965 bytes",
                "Ojinaga": "[BINARY] 718 bytes",
                "Panama": "[BINARY] 149 bytes",
                "Pangnirtung": "[BINARY] 855 bytes",
                "Paramaribo": "[BINARY] 187 bytes",
                "Phoenix": "[BINARY] 240 bytes",
                "Port-au-Prince": "[BINARY] 565 bytes",
                "Port_of_Spain": "[BINARY] 177 bytes",
                "Porto_Acre": "[BINARY] 418 bytes",
                "Porto_Velho": "[BINARY] 394 bytes",
                "Puerto_Rico": "[BINARY] 177 bytes",
                "Punta_Arenas": "[BINARY] 1218 bytes",
                "Rainy_River": "[BINARY] 1294 bytes",
                "Rankin_Inlet": "[BINARY] 807 bytes",
                "Recife": "[BINARY] 484 bytes",
                "Regina": "[BINARY] 638 bytes",
                "Resolute": "[BINARY] 807 bytes",
                "Rio_Branco": "[BINARY] 418 bytes",
                "Rosario": "[BINARY] 708 bytes",
                "Santa_Isabel": "[BINARY] 1367 bytes",
                "Santarem": "[BINARY] 409 bytes",
                "Santiago": "[BINARY] 1354 bytes",
                "Santo_Domingo": "[BINARY] 317 bytes",
                "Sao_Paulo": "[BINARY] 952 bytes",
                "Scoresbysund": "[BINARY] 984 bytes",
                "Shiprock": "[BINARY] 1042 bytes",
                "Sitka": "[BINARY] 956 bytes",
                "St_Barthelemy": "[BINARY] 177 bytes",
                "St_Johns": "[BINARY] 1878 bytes",
                "St_Kitts": "[BINARY] 177 bytes",
                "St_Lucia": "[BINARY] 177 bytes",
                "St_Thomas": "[BINARY] 177 bytes",
                "St_Vincent": "[BINARY] 177 bytes",
                "Swift_Current": "[BINARY] 368 bytes",
                "Tegucigalpa": "[BINARY] 194 bytes",
                "Thule": "[BINARY] 455 bytes",
                "Thunder_Bay": "[BINARY] 1717 bytes",
                "Tijuana": "[BINARY] 1367 bytes",
                "Toronto": "[BINARY] 1717 bytes",
                "Tortola": "[BINARY] 177 bytes",
                "Vancouver": "[BINARY] 1330 bytes",
                "Virgin": "[BINARY] 177 bytes",
                "Whitehorse": "[BINARY] 1029 bytes",
                "Winnipeg": "[BINARY] 1294 bytes",
                "Yakutat": "[BINARY] 946 bytes",
                "Yellowknife": "[BINARY] 970 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Antarctica": {
                "Casey": "[BINARY] 287 bytes",
                "Davis": "[BINARY] 197 bytes",
                "DumontDUrville": "[BINARY] 154 bytes",
                "Macquarie": "[BINARY] 976 bytes",
                "Mawson": "[BINARY] 152 bytes",
                "McMurdo": "[BINARY] 1043 bytes",
                "Palmer": "[BINARY] 887 bytes",
                "Rothera": "[BINARY] 132 bytes",
                "South_Pole": "[BINARY] 1043 bytes",
                "Syowa": "[BINARY] 133 bytes",
                "Troll": "[BINARY] 158 bytes",
                "Vostok": "[BINARY] 170 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Arctic": {
                "Longyearbyen": "[BINARY] 705 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Asia": {
                "Aden": "[BINARY] 133 bytes",
                "Almaty": "[BINARY] 618 bytes",
                "Amman": "[BINARY] 928 bytes",
                "Anadyr": "[BINARY] 743 bytes",
                "Aqtau": "[BINARY] 606 bytes",
                "Aqtobe": "[BINARY] 615 bytes",
                "Ashgabat": "[BINARY] 375 bytes",
                "Ashkhabad": "[BINARY] 375 bytes",
                "Atyrau": "[BINARY] 616 bytes",
                "Baghdad": "[BINARY] 630 bytes",
                "Bahrain": "[BINARY] 152 bytes",
                "Baku": "[BINARY] 744 bytes",
                "Bangkok": "[BINARY] 152 bytes",
                "Barnaul": "[BINARY] 753 bytes",
                "Beirut": "[BINARY] 732 bytes",
                "Bishkek": "[BINARY] 618 bytes",
                "Brunei": "[BINARY] 320 bytes",
                "Calcutta": "[BINARY] 220 bytes",
                "Chita": "[BINARY] 750 bytes",
                "Choibalsan": "[BINARY] 594 bytes",
                "Chongqing": "[BINARY] 393 bytes",
                "Chungking": "[BINARY] 393 bytes",
                "Colombo": "[BINARY] 247 bytes",
                "Dacca": "[BINARY] 231 bytes",
                "Damascus": "[BINARY] 1234 bytes",
                "Dhaka": "[BINARY] 231 bytes",
                "Dili": "[BINARY] 170 bytes",
                "Dubai": "[BINARY] 133 bytes",
                "Dushanbe": "[BINARY] 366 bytes",
                "Famagusta": "[BINARY] 940 bytes",
                "Gaza": "[BINARY] 2950 bytes",
                "Harbin": "[BINARY] 393 bytes",
                "Hebron": "[BINARY] 2968 bytes",
                "Ho_Chi_Minh": "[BINARY] 236 bytes",
                "Hong_Kong": "[BINARY] 775 bytes",
                "Hovd": "[BINARY] 594 bytes",
                "Irkutsk": "[BINARY] 760 bytes",
                "Istanbul": "[BINARY] 1200 bytes",
                "Jakarta": "[BINARY] 248 bytes",
                "Jayapura": "[BINARY] 171 bytes",
                "Jerusalem": "[BINARY] 1074 bytes",
                "Kabul": "[BINARY] 159 bytes",
                "Kamchatka": "[BINARY] 727 bytes",
                "Karachi": "[BINARY] 266 bytes",
                "Kashgar": "[BINARY] 133 bytes",
                "Kathmandu": "[BINARY] 161 bytes",
                "Katmandu": "[BINARY] 161 bytes",
                "Khandyga": "[BINARY] 775 bytes",
                "Kolkata": "[BINARY] 220 bytes",
                "Krasnoyarsk": "[BINARY] 741 bytes",
                "Kuala_Lumpur": "[BINARY] 256 bytes",
                "Kuching": "[BINARY] 320 bytes",
                "Kuwait": "[BINARY] 133 bytes",
                "Macao": "[BINARY] 791 bytes",
                "Macau": "[BINARY] 791 bytes",
                "Magadan": "[BINARY] 751 bytes",
                "Makassar": "[BINARY] 190 bytes",
                "Manila": "[BINARY] 274 bytes",
                "Muscat": "[BINARY] 133 bytes",
                "Nicosia": "[BINARY] 597 bytes",
                "Novokuznetsk": "[BINARY] 726 bytes",
                "Novosibirsk": "[BINARY] 753 bytes",
                "Omsk": "[BINARY] 741 bytes",
                "Oral": "[BINARY] 625 bytes",
                "Phnom_Penh": "[BINARY] 152 bytes",
                "Pontianak": "[BINARY] 247 bytes",
                "Pyongyang": "[BINARY] 183 bytes",
                "Qatar": "[BINARY] 152 bytes",
                "Qostanay": "[BINARY] 624 bytes",
                "Qyzylorda": "[BINARY] 624 bytes",
                "Rangoon": "[BINARY] 187 bytes",
                "Riyadh": "[BINARY] 133 bytes",
                "Saigon": "[BINARY] 236 bytes",
                "Sakhalin": "[BINARY] 755 bytes",
                "Samarkand": "[BINARY] 366 bytes",
                "Seoul": "[BINARY] 415 bytes",
                "Shanghai": "[BINARY] 393 bytes",
                "Singapore": "[BINARY] 256 bytes",
                "Srednekolymsk": "[BINARY] 742 bytes",
                "Taipei": "[BINARY] 511 bytes",
                "Tashkent": "[BINARY] 366 bytes",
                "Tbilisi": "[BINARY] 629 bytes",
                "Tehran": "[BINARY] 812 bytes",
                "Tel_Aviv": "[BINARY] 1074 bytes",
                "Thimbu": "[BINARY] 154 bytes",
                "Thimphu": "[BINARY] 154 bytes",
                "Tokyo": "[BINARY] 213 bytes",
                "Tomsk": "[BINARY] 753 bytes",
                "Ujung_Pandang": "[BINARY] 190 bytes",
                "Ulaanbaatar": "[BINARY] 594 bytes",
                "Ulan_Bator": "[BINARY] 594 bytes",
                "Urumqi": "[BINARY] 133 bytes",
                "Ust-Nera": "[BINARY] 771 bytes",
                "Vientiane": "[BINARY] 152 bytes",
                "Vladivostok": "[BINARY] 742 bytes",
                "Yakutsk": "[BINARY] 741 bytes",
                "Yangon": "[BINARY] 187 bytes",
                "Yekaterinburg": "[BINARY] 760 bytes",
                "Yerevan": "[BINARY] 708 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Atlantic": {
                "Azores": "[BINARY] 1401 bytes",
                "Bermuda": "[BINARY] 1024 bytes",
                "Canary": "[BINARY] 478 bytes",
                "Cape_Verde": "[BINARY] 175 bytes",
                "Faeroe": "[BINARY] 441 bytes",
                "Faroe": "[BINARY] 441 bytes",
                "Jan_Mayen": "[BINARY] 705 bytes",
                "Madeira": "[BINARY] 1372 bytes",
                "Reykjavik": "[BINARY] 130 bytes",
                "South_Georgia": "[BINARY] 132 bytes",
                "St_Helena": "[BINARY] 130 bytes",
                "Stanley": "[BINARY] 789 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Australia": {
                "ACT": "[BINARY] 904 bytes",
                "Adelaide": "[BINARY] 921 bytes",
                "Brisbane": "[BINARY] 289 bytes",
                "Broken_Hill": "[BINARY] 941 bytes",
                "Canberra": "[BINARY] 904 bytes",
                "Currie": "[BINARY] 1003 bytes",
                "Darwin": "[BINARY] 234 bytes",
                "Eucla": "[BINARY] 314 bytes",
                "Hobart": "[BINARY] 1003 bytes",
                "LHI": "[BINARY] 692 bytes",
                "Lindeman": "[BINARY] 325 bytes",
                "Lord_Howe": "[BINARY] 692 bytes",
                "Melbourne": "[BINARY] 904 bytes",
                "NSW": "[BINARY] 904 bytes",
                "North": "[BINARY] 234 bytes",
                "Perth": "[BINARY] 306 bytes",
                "Queensland": "[BINARY] 289 bytes",
                "South": "[BINARY] 921 bytes",
                "Sydney": "[BINARY] 904 bytes",
                "Tasmania": "[BINARY] 1003 bytes",
                "Victoria": "[BINARY] 904 bytes",
                "West": "[BINARY] 306 bytes",
                "Yancowinna": "[BINARY] 941 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Brazil": {
                "Acre": "[BINARY] 418 bytes",
                "DeNoronha": "[BINARY] 484 bytes",
                "East": "[BINARY] 952 bytes",
                "West": "[BINARY] 412 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "CET": "[BINARY] 1103 bytes",
              "CST6CDT": "[BINARY] 1754 bytes",
              "Canada": {
                "Atlantic": "[BINARY] 1672 bytes",
                "Central": "[BINARY] 1294 bytes",
                "Eastern": "[BINARY] 1717 bytes",
                "Mountain": "[BINARY] 970 bytes",
                "Newfoundland": "[BINARY] 1878 bytes",
                "Pacific": "[BINARY] 1330 bytes",
                "Saskatchewan": "[BINARY] 638 bytes",
                "Yukon": "[BINARY] 1029 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Chile": {
                "Continental": "[BINARY] 1354 bytes",
                "EasterIsland": "[BINARY] 1174 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Cuba": "[BINARY] 1117 bytes",
              "EET": "[BINARY] 682 bytes",
              "EST": "[BINARY] 149 bytes",
              "EST5EDT": "[BINARY] 1744 bytes",
              "Egypt": "[BINARY] 1309 bytes",
              "Eire": "[BINARY] 1496 bytes",
              "Etc": {
                "GMT": "[BINARY] 111 bytes",
                "GMT+0": "[BINARY] 111 bytes",
                "GMT+1": "[BINARY] 113 bytes",
                "GMT+10": "[BINARY] 114 bytes",
                "GMT+11": "[BINARY] 114 bytes",
                "GMT+12": "[BINARY] 114 bytes",
                "GMT+2": "[BINARY] 113 bytes",
                "GMT+3": "[BINARY] 113 bytes",
                "GMT+4": "[BINARY] 113 bytes",
                "GMT+5": "[BINARY] 113 bytes",
                "GMT+6": "[BINARY] 113 bytes",
                "GMT+7": "[BINARY] 113 bytes",
                "GMT+8": "[BINARY] 113 bytes",
                "GMT+9": "[BINARY] 113 bytes",
                "GMT-0": "[BINARY] 111 bytes",
                "GMT-1": "[BINARY] 114 bytes",
                "GMT-10": "[BINARY] 115 bytes",
                "GMT-11": "[BINARY] 115 bytes",
                "GMT-12": "[BINARY] 115 bytes",
                "GMT-13": "[BINARY] 115 bytes",
                "GMT-14": "[BINARY] 115 bytes",
                "GMT-2": "[BINARY] 114 bytes",
                "GMT-3": "[BINARY] 114 bytes",
                "GMT-4": "[BINARY] 114 bytes",
                "GMT-5": "[BINARY] 114 bytes",
                "GMT-6": "[BINARY] 114 bytes",
                "GMT-7": "[BINARY] 114 bytes",
                "GMT-8": "[BINARY] 114 bytes",
                "GMT-9": "[BINARY] 114 bytes",
                "GMT0": "[BINARY] 111 bytes",
                "Greenwich": "[BINARY] 111 bytes",
                "UCT": "[BINARY] 111 bytes",
                "UTC": "[BINARY] 111 bytes",
                "Universal": "[BINARY] 111 bytes",
                "Zulu": "[BINARY] 111 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Europe": {
                "Amsterdam": "[BINARY] 1103 bytes",
                "Andorra": "[BINARY] 389 bytes",
                "Astrakhan": "[BINARY] 726 bytes",
                "Athens": "[BINARY] 682 bytes",
                "Belfast": "[BINARY] 1599 bytes",
                "Belgrade": "[BINARY] 478 bytes",
                "Berlin": "[BINARY] 705 bytes",
                "Bratislava": "[BINARY] 723 bytes",
                "Brussels": "[BINARY] 1103 bytes",
                "Bucharest": "[BINARY] 661 bytes",
                "Budapest": "[BINARY] 766 bytes",
                "Busingen": "[BINARY] 497 bytes",
                "Chisinau": "[BINARY] 755 bytes",
                "Copenhagen": "[BINARY] 705 bytes",
                "Dublin": "[BINARY] 1496 bytes",
                "Gibraltar": "[BINARY] 1220 bytes",
                "Guernsey": "[BINARY] 1599 bytes",
                "Helsinki": "[BINARY] 481 bytes",
                "Isle_of_Man": "[BINARY] 1599 bytes",
                "Istanbul": "[BINARY] 1200 bytes",
                "Jersey": "[BINARY] 1599 bytes",
                "Kaliningrad": "[BINARY] 904 bytes",
                "Kiev": "[BINARY] 558 bytes",
                "Kirov": "[BINARY] 735 bytes",
                "Kyiv": "[BINARY] 558 bytes",
                "Lisbon": "[BINARY] 1463 bytes",
                "Ljubljana": "[BINARY] 478 bytes",
                "London": "[BINARY] 1599 bytes",
                "Luxembourg": "[BINARY] 1103 bytes",
                "Madrid": "[BINARY] 897 bytes",
                "Malta": "[BINARY] 928 bytes",
                "Mariehamn": "[BINARY] 481 bytes",
                "Minsk": "[BINARY] 808 bytes",
                "Monaco": "[BINARY] 1105 bytes",
                "Moscow": "[BINARY] 908 bytes",
                "Nicosia": "[BINARY] 597 bytes",
                "Oslo": "[BINARY] 705 bytes",
                "Paris": "[BINARY] 1105 bytes",
                "Podgorica": "[BINARY] 478 bytes",
                "Prague": "[BINARY] 723 bytes",
                "Riga": "[BINARY] 694 bytes",
                "Rome": "[BINARY] 947 bytes",
                "Samara": "[BINARY] 732 bytes",
                "San_Marino": "[BINARY] 947 bytes",
                "Sarajevo": "[BINARY] 478 bytes",
                "Saratov": "[BINARY] 726 bytes",
                "Simferopol": "[BINARY] 865 bytes",
                "Skopje": "[BINARY] 478 bytes",
                "Sofia": "[BINARY] 592 bytes",
                "Stockholm": "[BINARY] 705 bytes",
                "Tallinn": "[BINARY] 675 bytes",
                "Tirane": "[BINARY] 604 bytes",
                "Tiraspol": "[BINARY] 755 bytes",
                "Ulyanovsk": "[BINARY] 760 bytes",
                "Uzhgorod": "[BINARY] 558 bytes",
                "Vaduz": "[BINARY] 497 bytes",
                "Vatican": "[BINARY] 947 bytes",
                "Vienna": "[BINARY] 658 bytes",
                "Vilnius": "[BINARY] 676 bytes",
                "Volgograd": "[BINARY] 753 bytes",
                "Warsaw": "[BINARY] 923 bytes",
                "Zagreb": "[BINARY] 478 bytes",
                "Zaporozhye": "[BINARY] 558 bytes",
                "Zurich": "[BINARY] 497 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Factory": "[BINARY] 113 bytes",
              "GB": "[BINARY] 1599 bytes",
              "GB-Eire": "[BINARY] 1599 bytes",
              "GMT": "[BINARY] 111 bytes",
              "GMT+0": "[BINARY] 111 bytes",
              "GMT-0": "[BINARY] 111 bytes",
              "GMT0": "[BINARY] 111 bytes",
              "Greenwich": "[BINARY] 111 bytes",
              "HST": "[BINARY] 221 bytes",
              "Hongkong": "[BINARY] 775 bytes",
              "Iceland": "[BINARY] 130 bytes",
              "Indian": {
                "Antananarivo": "[BINARY] 191 bytes",
                "Chagos": "[BINARY] 152 bytes",
                "Christmas": "[BINARY] 152 bytes",
                "Cocos": "[BINARY] 187 bytes",
                "Comoro": "[BINARY] 191 bytes",
                "Kerguelen": "[BINARY] 152 bytes",
                "Mahe": "[BINARY] 133 bytes",
                "Maldives": "[BINARY] 152 bytes",
                "Mauritius": "[BINARY] 179 bytes",
                "Mayotte": "[BINARY] 191 bytes",
                "Reunion": "[BINARY] 133 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Iran": "[BINARY] 812 bytes",
              "Israel": "[BINARY] 1074 bytes",
              "Jamaica": "[BINARY] 339 bytes",
              "Japan": "[BINARY] 213 bytes",
              "Kwajalein": "[BINARY] 219 bytes",
              "Libya": "[BINARY] 431 bytes",
              "MET": "[BINARY] 1103 bytes",
              "MST": "[BINARY] 240 bytes",
              "MST7MDT": "[BINARY] 1042 bytes",
              "Mexico": {
                "BajaNorte": "[BINARY] 1367 bytes",
                "BajaSur": "[BINARY] 690 bytes",
                "General": "[BINARY] 773 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "NZ": "[BINARY] 1043 bytes",
              "NZ-CHAT": "[BINARY] 808 bytes",
              "Navajo": "[BINARY] 1042 bytes",
              "PRC": "[BINARY] 393 bytes",
              "PST8PDT": "[BINARY] 1294 bytes",
              "Pacific": {
                "Apia": "[BINARY] 407 bytes",
                "Auckland": "[BINARY] 1043 bytes",
                "Bougainville": "[BINARY] 201 bytes",
                "Chatham": "[BINARY] 808 bytes",
                "Chuuk": "[BINARY] 154 bytes",
                "Easter": "[BINARY] 1174 bytes",
                "Efate": "[BINARY] 342 bytes",
                "Enderbury": "[BINARY] 172 bytes",
                "Fakaofo": "[BINARY] 153 bytes",
                "Fiji": "[BINARY] 396 bytes",
                "Funafuti": "[BINARY] 134 bytes",
                "Galapagos": "[BINARY] 175 bytes",
                "Gambier": "[BINARY] 132 bytes",
                "Guadalcanal": "[BINARY] 134 bytes",
                "Guam": "[BINARY] 350 bytes",
                "Honolulu": "[BINARY] 221 bytes",
                "Johnston": "[BINARY] 221 bytes",
                "Kanton": "[BINARY] 172 bytes",
                "Kiritimati": "[BINARY] 174 bytes",
                "Kosrae": "[BINARY] 242 bytes",
                "Kwajalein": "[BINARY] 219 bytes",
                "Majuro": "[BINARY] 134 bytes",
                "Marquesas": "[BINARY] 139 bytes",
                "Midway": "[BINARY] 146 bytes",
                "Nauru": "[BINARY] 183 bytes",
                "Niue": "[BINARY] 154 bytes",
                "Norfolk": "[BINARY] 237 bytes",
                "Noumea": "[BINARY] 198 bytes",
                "Pago_Pago": "[BINARY] 146 bytes",
                "Palau": "[BINARY] 148 bytes",
                "Pitcairn": "[BINARY] 153 bytes",
                "Pohnpei": "[BINARY] 134 bytes",
                "Ponape": "[BINARY] 134 bytes",
                "Port_Moresby": "[BINARY] 154 bytes",
                "Rarotonga": "[BINARY] 406 bytes",
                "Saipan": "[BINARY] 350 bytes",
                "Samoa": "[BINARY] 146 bytes",
                "Tahiti": "[BINARY] 133 bytes",
                "Tarawa": "[BINARY] 134 bytes",
                "Tongatapu": "[BINARY] 237 bytes",
                "Truk": "[BINARY] 154 bytes",
                "Wake": "[BINARY] 134 bytes",
                "Wallis": "[BINARY] 134 bytes",
                "Yap": "[BINARY] 154 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Poland": "[BINARY] 923 bytes",
              "Portugal": "[BINARY] 1463 bytes",
              "ROC": "[BINARY] 511 bytes",
              "ROK": "[BINARY] 415 bytes",
              "Singapore": "[BINARY] 256 bytes",
              "Turkey": "[BINARY] 1200 bytes",
              "UCT": "[BINARY] 111 bytes",
              "US": {
                "Alaska": "[BINARY] 977 bytes",
                "Aleutian": "[BINARY] 969 bytes",
                "Arizona": "[BINARY] 240 bytes",
                "Central": "[BINARY] 1754 bytes",
                "East-Indiana": "[BINARY] 531 bytes",
                "Eastern": "[BINARY] 1744 bytes",
                "Hawaii": "[BINARY] 221 bytes",
                "Indiana-Starke": "[BINARY] 1016 bytes",
                "Michigan": "[BINARY] 899 bytes",
                "Mountain": "[BINARY] 1042 bytes",
                "Pacific": "[BINARY] 1294 bytes",
                "Samoa": "[BINARY] 146 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "UTC": "[BINARY] 111 bytes",
              "Universal": "[BINARY] 111 bytes",
              "W-SU": "[BINARY] 908 bytes",
              "WET": "[BINARY] 1463 bytes",
              "Zulu": "[BINARY] 111 bytes",
              "__init__.py": "[FILE] 1 lines",
              "iso3166.tab": "[BINARY] 4841 bytes",
              "leapseconds": "[BINARY] 3694 bytes",
              "tzdata.zi": "[BINARY] 107441 bytes",
              "zone.tab": "[BINARY] 18822 bytes",
              "zone1970.tab": "[BINARY] 17605 bytes",
              "zonenow.tab": "[BINARY] 8002 bytes"
            },
            "zones": "[BINARY] 9102 bytes"
          },
          "tzdata-2025.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 1352 bytes",
            "RECORD": "[BINARY] 56828 bytes",
            "WHEEL": "[BINARY] 109 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 592 bytes",
              "licenses": {
                "LICENSE_APACHE": "[BINARY] 11357 bytes"
              }
            },
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "uvicorn": {
            "__init__.py": "[FILE] 6 lines",
            "__main__.py": "[FILE] 5 lines",
            "_subprocess.py": "[FILE] 77 lines",
            "_types.py": "[FILE] 282 lines",
            "config.py": "[FILE] 578 lines",
            "importer.py": "[FILE] 39 lines",
            "lifespan": {
              "__init__.py": "[FILE] 1 lines",
              "off.py": "[FILE] 16 lines",
              "on.py": "[FILE] 138 lines"
            },
            "logging.py": "[FILE] 118 lines",
            "loops": {
              "__init__.py": "[FILE] 1 lines",
              "asyncio.py": "[FILE] 11 lines",
              "auto.py": "[FILE] 12 lines",
              "uvloop.py": "[FILE] 8 lines"
            },
            "main.py": "[FILE] 597 lines",
            "middleware": {
              "__init__.py": "[FILE] 1 lines",
              "asgi2.py": "[FILE] 18 lines",
              "message_logger.py": "[FILE] 88 lines",
              "proxy_headers.py": "[FILE] 85 lines",
              "wsgi.py": "[FILE] 204 lines"
            },
            "protocols": {
              "__init__.py": "[FILE] 1 lines",
              "http": {
                "__init__.py": "[FILE] 1 lines",
                "auto.py": "[FILE] 15 lines",
                "flow_control.py": "[FILE] 67 lines",
                "h11_impl.py": "[FILE] 551 lines",
                "httptools_impl.py": "[FILE] 602 lines"
              },
              "utils.py": "[FILE] 55 lines",
              "websockets": {
                "__init__.py": "[FILE] 1 lines",
                "auto.py": "[FILE] 20 lines",
                "websockets_impl.py": "[FILE] 377 lines",
                "wsproto_impl.py": "[FILE] 343 lines"
              }
            },
            "py.typed": "[BINARY] 1 bytes",
            "server.py": "[FILE] 336 lines",
            "supervisors": {
              "__init__.py": "[FILE] 22 lines",
              "basereload.py": "[FILE] 126 lines",
              "multiprocess.py": "[FILE] 75 lines",
              "statreload.py": "[FILE] 54 lines",
              "watchfilesreload.py": "[FILE] 92 lines",
              "watchgodreload.py": "[FILE] 159 lines"
            },
            "workers.py": "[FILE] 106 lines"
          },
          "uvicorn-0.24.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6352 bytes",
            "RECORD": "[BINARY] 6322 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "entry_points.txt": "[BINARY] 46 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 28 lines"
            }
          },
          "uvloop": {
            "__init__.py": "[FILE] 234 lines",
            "_noop.py": "[FILE] 4 lines",
            "_testbase.py": "[FILE] 553 lines",
            "_version.py": "[FILE] 14 lines",
            "cbhandles.pxd": "[BINARY] 752 bytes",
            "cbhandles.pyx": "[BINARY] 12298 bytes",
            "dns.pyx": "[BINARY] 14562 bytes",
            "errors.pyx": "[BINARY] 2774 bytes",
            "handles": {
              "async_.pxd": "[BINARY] 252 bytes",
              "async_.pyx": "[BINARY] 1516 bytes",
              "basetransport.pxd": "[BINARY] 1322 bytes",
              "basetransport.pyx": "[BINARY] 9553 bytes",
              "check.pxd": "[BINARY] 276 bytes",
              "check.pyx": "[BINARY] 1881 bytes",
              "fsevent.pxd": "[BINARY] 325 bytes",
              "fsevent.pyx": "[BINARY] 2823 bytes",
              "handle.pxd": "[BINARY] 1189 bytes",
              "handle.pyx": "[BINARY] 13248 bytes",
              "idle.pxd": "[BINARY] 274 bytes",
              "idle.pyx": "[BINARY] 1859 bytes",
              "pipe.pxd": "[BINARY] 933 bytes",
              "pipe.pyx": "[BINARY] 7688 bytes",
              "poll.pxd": "[BINARY] 575 bytes",
              "poll.pyx": "[BINARY] 6511 bytes",
              "process.pxd": "[BINARY] 2314 bytes",
              "process.pyx": "[BINARY] 26919 bytes",
              "stream.pxd": "[BINARY] 1535 bytes",
              "stream.pyx": "[BINARY] 31791 bytes",
              "streamserver.pxd": "[BINARY] 786 bytes",
              "streamserver.pyx": "[BINARY] 4632 bytes",
              "tcp.pxd": "[BINARY] 892 bytes",
              "tcp.pyx": "[BINARY] 7291 bytes",
              "timer.pxd": "[BINARY] 440 bytes",
              "timer.pyx": "[BINARY] 2416 bytes",
              "udp.pxd": "[BINARY] 671 bytes",
              "udp.pyx": "[BINARY] 12039 bytes"
            },
            "includes": {
              "__init__.py": "[FILE] 24 lines",
              "consts.pxi": "[BINARY] 843 bytes",
              "debug.pxd": "[BINARY] 64 bytes",
              "flowcontrol.pxd": "[BINARY] 458 bytes",
              "python.pxd": "[BINARY] 846 bytes",
              "stdlib.pxi": "[BINARY] 6377 bytes",
              "system.pxd": "[BINARY] 2186 bytes",
              "uv.pxd": "[BINARY] 16080 bytes"
            },
            "loop.cpython-312-x86_64-linux-gnu.so": "[BINARY] 15952168 bytes",
            "loop.pxd": "[BINARY] 6224 bytes",
            "loop.pyi": "[BINARY] 10504 bytes",
            "loop.pyx": "[BINARY] 118650 bytes",
            "lru.pyx": "[BINARY] 2279 bytes",
            "pseudosock.pyx": "[BINARY] 5383 bytes",
            "py.typed": "[BINARY] 0 bytes",
            "request.pxd": "[BINARY] 143 bytes",
            "request.pyx": "[BINARY] 2259 bytes",
            "server.pxd": "[BINARY] 394 bytes",
            "server.pyx": "[BINARY] 3623 bytes",
            "sslproto.pxd": "[BINARY] 3534 bytes",
            "sslproto.pyx": "[BINARY] 35381 bytes"
          },
          "uvloop-0.22.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 4922 bytes",
            "RECORD": "[BINARY] 5435 bytes",
            "WHEEL": "[BINARY] 190 bytes",
            "licenses": {
              "LICENSE-APACHE": "[BINARY] 11439 bytes",
              "LICENSE-MIT": "[BINARY] 1105 bytes"
            },
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "vine": {
            "__init__.py": "[FILE] 43 lines",
            "abstract.py": "[FILE] 69 lines",
            "funtools.py": "[FILE] 114 lines",
            "promises.py": "[FILE] 242 lines",
            "synchronization.py": "[FILE] 105 lines",
            "utils.py": "[FILE] 28 lines"
          },
          "vine-5.1.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2461 bytes",
            "METADATA": "[BINARY] 2657 bytes",
            "RECORD": "[BINARY] 1181 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 5 bytes"
          },
          "watchfiles": {
            "__init__.py": "[FILE] 18 lines",
            "__main__.py": "[FILE] 5 lines",
            "_rust_notify.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1124288 bytes",
            "_rust_notify.pyi": "[BINARY] 4753 bytes",
            "cli.py": "[FILE] 225 lines",
            "filters.py": "[FILE] 150 lines",
            "main.py": "[FILE] 374 lines",
            "py.typed": "[BINARY] 69 bytes",
            "run.py": "[FILE] 439 lines",
            "version.py": "[FILE] 6 lines"
          },
          "watchfiles-1.1.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 4874 bytes",
            "RECORD": "[BINARY] 1748 bytes",
            "WHEEL": "[BINARY] 129 bytes",
            "entry_points.txt": "[BINARY] 48 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1091 bytes"
            }
          },
          "wcwidth": {
            "__init__.py": "[FILE] 44 lines",
            "bisearch.py": "[FILE] 30 lines",
            "control_codes.py": "[FILE] 47 lines",
            "escape_sequences.py": "[FILE] 70 lines",
            "grapheme.py": "[FILE] 429 lines",
            "py.typed": "[BINARY] 0 bytes",
            "sgr_state.py": "[FILE] 339 lines",
            "table_ambiguous.py": "[FILE] 190 lines",
            "table_grapheme.py": "[FILE] 2295 lines",
            "table_mc.py": "[FILE] 207 lines",
            "table_vs16.py": "[FILE] 127 lines",
            "table_wide.py": "[FILE] 139 lines",
            "table_zero.py": "[FILE] 351 lines",
            "textwrap.py": "[FILE] 657 lines",
            "unicode_versions.py": "[FILE] 22 lines",
            "wcwidth.py": "[FILE] 1031 lines"
          },
          "wcwidth-0.6.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 30525 bytes",
            "RECORD": "[BINARY] 2429 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1322 bytes"
            }
          },
          "websockets": {
            "__init__.py": "[FILE] 237 lines",
            "__main__.py": "[FILE] 6 lines",
            "asyncio": {
              "__init__.py": "[FILE] 1 lines",
              "async_timeout.py": "[FILE] 283 lines",
              "client.py": "[FILE] 805 lines",
              "compatibility.py": "[FILE] 31 lines",
              "connection.py": "[FILE] 1248 lines",
              "messages.py": "[FILE] 317 lines",
              "router.py": "[FILE] 220 lines",
              "server.py": "[FILE] 998 lines"
            },
            "auth.py": "[FILE] 19 lines",
            "cli.py": "[FILE] 179 lines",
            "client.py": "[FILE] 392 lines",
            "connection.py": "[FILE] 13 lines",
            "datastructures.py": "[FILE] 184 lines",
            "exceptions.py": "[FILE] 474 lines",
            "extensions": {
              "__init__.py": "[FILE] 5 lines",
              "base.py": "[FILE] 124 lines",
              "permessage_deflate.py": "[FILE] 700 lines"
            },
            "frames.py": "[FILE] 432 lines",
            "headers.py": "[FILE] 587 lines",
            "http.py": "[FILE] 21 lines",
            "http11.py": "[FILE] 439 lines",
            "imports.py": "[FILE] 101 lines",
            "legacy": {
              "__init__.py": "[FILE] 12 lines",
              "auth.py": "[FILE] 191 lines",
              "client.py": "[FILE] 704 lines",
              "exceptions.py": "[FILE] 72 lines",
              "framing.py": "[FILE] 225 lines",
              "handshake.py": "[FILE] 159 lines",
              "http.py": "[FILE] 202 lines",
              "protocol.py": "[FILE] 1636 lines",
              "server.py": "[FILE] 1192 lines"
            },
            "protocol.py": "[FILE] 769 lines",
            "proxy.py": "[FILE] 151 lines",
            "py.typed": "[BINARY] 0 bytes",
            "server.py": "[FILE] 590 lines",
            "speedups.c": "[BINARY] 5920 bytes",
            "speedups.cpython-312-x86_64-linux-gnu.so": "[BINARY] 38048 bytes",
            "speedups.pyi": "[BINARY] 102 bytes",
            "streams.py": "[FILE] 152 lines",
            "sync": {
              "__init__.py": "[FILE] 1 lines",
              "client.py": "[FILE] 634 lines",
              "connection.py": "[FILE] 1079 lines",
              "messages.py": "[FILE] 349 lines",
              "router.py": "[FILE] 214 lines",
              "server.py": "[FILE] 766 lines",
              "utils.py": "[FILE] 46 lines"
            },
            "typing.py": "[FILE] 76 lines",
            "uri.py": "[FILE] 108 lines",
            "utils.py": "[FILE] 54 lines",
            "version.py": "[FILE] 93 lines"
          },
          "websockets-16.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6799 bytes",
            "RECORD": "[BINARY] 7638 bytes",
            "WHEEL": "[BINARY] 186 bytes",
            "entry_points.txt": "[BINARY] 51 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1514 bytes"
            },
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "yaml": {
            "__init__.py": "[FILE] 391 lines",
            "_yaml.cpython-312-x86_64-linux-gnu.so": "[BINARY] 2679264 bytes",
            "composer.py": "[FILE] 140 lines",
            "constructor.py": "[FILE] 749 lines",
            "cyaml.py": "[FILE] 102 lines",
            "dumper.py": "[FILE] 63 lines",
            "emitter.py": "[FILE] 1138 lines",
            "error.py": "[FILE] 76 lines",
            "events.py": "[FILE] 87 lines",
            "loader.py": "[FILE] 64 lines",
            "nodes.py": "[FILE] 50 lines",
            "parser.py": "[FILE] 590 lines",
            "reader.py": "[FILE] 186 lines",
            "representer.py": "[FILE] 390 lines",
            "resolver.py": "[FILE] 228 lines",
            "scanner.py": "[FILE] 1436 lines",
            "serializer.py": "[FILE] 112 lines",
            "tokens.py": "[FILE] 105 lines"
          }
        }
      }
    },
    "lib64": {
      "python3.12": {
        "site-packages": {
          "SQLAlchemy-2.0.23.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1100 bytes",
            "METADATA": "[BINARY] 9551 bytes",
            "RECORD": "[BINARY] 40360 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "_cffi_backend.cpython-312-x86_64-linux-gnu.so": "[BINARY] 348808 bytes",
          "_yaml": {
            "__init__.py": "[FILE] 34 lines"
          },
          "alembic": {
            "__init__.py": "[FILE] 7 lines",
            "__main__.py": "[FILE] 5 lines",
            "autogenerate": {
              "__init__.py": "[FILE] 11 lines",
              "api.py": "[FILE] 648 lines",
              "compare.py": "[FILE] 1395 lines",
              "render.py": "[FILE] 1083 lines",
              "rewriter.py": "[FILE] 228 lines"
            },
            "command.py": "[FILE] 745 lines",
            "config.py": "[FILE] 635 lines",
            "context.py": "[FILE] 6 lines",
            "context.pyi": "[BINARY] 31463 bytes",
            "ddl": {
              "__init__.py": "[FILE] 7 lines",
              "base.py": "[FILE] 333 lines",
              "impl.py": "[FILE] 748 lines",
              "mssql.py": "[FILE] 417 lines",
              "mysql.py": "[FILE] 472 lines",
              "oracle.py": "[FILE] 198 lines",
              "postgresql.py": "[FILE] 775 lines",
              "sqlite.py": "[FILE] 224 lines"
            },
            "environment.py": "[FILE] 2 lines",
            "migration.py": "[FILE] 2 lines",
            "op.py": "[FILE] 6 lines",
            "op.pyi": "[BINARY] 48591 bytes",
            "operations": {
              "__init__.py": "[FILE] 16 lines",
              "base.py": "[FILE] 1838 lines",
              "batch.py": "[FILE] 719 lines",
              "ops.py": "[FILE] 2765 lines",
              "schemaobj.py": "[FILE] 288 lines",
              "toimpl.py": "[FILE] 224 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "runtime": {
              "__init__.py": "[FILE] 1 lines",
              "environment.py": "[FILE] 1044 lines",
              "migration.py": "[FILE] 1381 lines"
            },
            "script": {
              "__init__.py": "[FILE] 5 lines",
              "base.py": "[FILE] 1054 lines",
              "revision.py": "[FILE] 1709 lines",
              "write_hooks.py": "[FILE] 177 lines"
            },
            "templates": {
              "async": {
                "README": "[BINARY] 58 bytes",
                "alembic.ini.mako": "[BINARY] 3505 bytes",
                "env.py": "[FILE] 90 lines",
                "script.py.mako": "[BINARY] 635 bytes"
              },
              "generic": {
                "README": "[BINARY] 38 bytes",
                "alembic.ini.mako": "[BINARY] 3614 bytes",
                "env.py": "[FILE] 79 lines",
                "script.py.mako": "[BINARY] 635 bytes"
              },
              "multidb": {
                "README": "[BINARY] 606 bytes",
                "alembic.ini.mako": "[BINARY] 3708 bytes",
                "env.py": "[FILE] 141 lines",
                "script.py.mako": "[BINARY] 1090 bytes"
              }
            },
            "testing": {
              "__init__.py": "[FILE] 30 lines",
              "assertions.py": "[FILE] 168 lines",
              "env.py": "[FILE] 519 lines",
              "fixtures.py": "[FILE] 307 lines",
              "plugin": {
                "__init__.py": "[FILE] 1 lines",
                "bootstrap.py": "[FILE] 5 lines"
              },
              "requirements.py": "[FILE] 199 lines",
              "schemacompare.py": "[FILE] 161 lines",
              "suite": {
                "__init__.py": "[FILE] 8 lines",
                "_autogen_fixtures.py": "[FILE] 336 lines",
                "test_autogen_comments.py": "[FILE] 243 lines",
                "test_autogen_computed.py": "[FILE] 204 lines",
                "test_autogen_diffs.py": "[FILE] 274 lines",
                "test_autogen_fks.py": "[FILE] 1191 lines",
                "test_autogen_identity.py": "[FILE] 227 lines",
                "test_environment.py": "[FILE] 365 lines",
                "test_op.py": "[FILE] 43 lines"
              },
              "util.py": "[FILE] 127 lines",
              "warnings.py": "[FILE] 41 lines"
            },
            "util": {
              "__init__.py": "[FILE] 36 lines",
              "compat.py": "[FILE] 74 lines",
              "editor.py": "[FILE] 82 lines",
              "exc.py": "[FILE] 7 lines",
              "langhelpers.py": "[FILE] 291 lines",
              "messaging.py": "[FILE] 113 lines",
              "pyfiles.py": "[FILE] 111 lines",
              "sqla_compat.py": "[FILE] 640 lines"
            }
          },
          "alembic-1.12.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1058 bytes",
            "METADATA": "[BINARY] 7306 bytes",
            "RECORD": "[BINARY] 10905 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 48 bytes",
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "amqp": {
            "__init__.py": "[FILE] 76 lines",
            "abstract_channel.py": "[FILE] 164 lines",
            "basic_message.py": "[FILE] 123 lines",
            "channel.py": "[FILE] 2128 lines",
            "connection.py": "[FILE] 785 lines",
            "exceptions.py": "[FILE] 289 lines",
            "method_framing.py": "[FILE] 190 lines",
            "platform.py": "[FILE] 80 lines",
            "protocol.py": "[FILE] 13 lines",
            "sasl.py": "[FILE] 192 lines",
            "serialization.py": "[FILE] 583 lines",
            "spec.py": "[FILE] 122 lines",
            "transport.py": "[FILE] 680 lines",
            "utils.py": "[FILE] 65 lines"
          },
          "amqp-5.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2372 bytes",
            "METADATA": "[BINARY] 8887 bytes",
            "RECORD": "[BINARY] 2163 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "top_level.txt": "[BINARY] 5 bytes"
          },
          "annotated_types": {
            "__init__.py": "[FILE] 433 lines",
            "py.typed": "[BINARY] 0 bytes",
            "test_cases.py": "[FILE] 152 lines"
          },
          "annotated_types-0.7.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 15046 bytes",
            "RECORD": "[BINARY] 802 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1083 bytes"
            }
          },
          "anyio": {
            "__init__.py": "[FILE] 170 lines",
            "_backends": {
              "__init__.py": "[FILE] 1 lines",
              "_asyncio.py": "[FILE] 2118 lines",
              "_trio.py": "[FILE] 997 lines"
            },
            "_core": {
              "__init__.py": "[FILE] 1 lines",
              "_compat.py": "[FILE] 218 lines",
              "_eventloop.py": "[FILE] 154 lines",
              "_exceptions.py": "[FILE] 95 lines",
              "_fileio.py": "[FILE] 604 lines",
              "_resources.py": "[FILE] 19 lines",
              "_signals.py": "[FILE] 27 lines",
              "_sockets.py": "[FILE] 608 lines",
              "_streams.py": "[FILE] 48 lines",
              "_subprocesses.py": "[FILE] 136 lines",
              "_synchronization.py": "[FILE] 597 lines",
              "_tasks.py": "[FILE] 181 lines",
              "_testing.py": "[FILE] 83 lines",
              "_typedattr.py": "[FILE] 84 lines"
            },
            "abc": {
              "__init__.py": "[FILE] 91 lines",
              "_resources.py": "[FILE] 32 lines",
              "_sockets.py": "[FILE] 161 lines",
              "_streams.py": "[FILE] 204 lines",
              "_subprocesses.py": "[FILE] 80 lines",
              "_tasks.py": "[FILE] 120 lines",
              "_testing.py": "[FILE] 71 lines"
            },
            "from_thread.py": "[FILE] 501 lines",
            "lowlevel.py": "[FILE] 175 lines",
            "py.typed": "[BINARY] 0 bytes",
            "pytest_plugin.py": "[FILE] 143 lines",
            "streams": {
              "__init__.py": "[FILE] 1 lines",
              "buffered.py": "[FILE] 119 lines",
              "file.py": "[FILE] 148 lines",
              "memory.py": "[FILE] 280 lines",
              "stapled.py": "[FILE] 141 lines",
              "text.py": "[FILE] 144 lines",
              "tls.py": "[FILE] 321 lines"
            },
            "to_process.py": "[FILE] 250 lines",
            "to_thread.py": "[FILE] 68 lines"
          },
          "anyio-3.7.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1081 bytes",
            "METADATA": "[BINARY] 4708 bytes",
            "RECORD": "[BINARY] 5527 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 39 bytes",
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "asyncpg": {
            "__init__.py": "[FILE] 20 lines",
            "_asyncio_compat.py": "[FILE] 88 lines",
            "_testbase": {
              "__init__.py": "[FILE] 528 lines",
              "fuzzer.py": "[FILE] 307 lines"
            },
            "_version.py": "[FILE] 14 lines",
            "cluster.py": "[FILE] 689 lines",
            "compat.py": "[FILE] 62 lines",
            "connect_utils.py": "[FILE] 1082 lines",
            "connection.py": "[FILE] 2656 lines",
            "connresource.py": "[FILE] 45 lines",
            "cursor.py": "[FILE] 324 lines",
            "exceptions": {
              "__init__.py": "[FILE] 1199 lines",
              "_base.py": "[FILE] 300 lines"
            },
            "introspection.py": "[FILE] 293 lines",
            "pgproto": {
              "__init__.pxd": "[BINARY] 213 bytes",
              "__init__.py": "[FILE] 6 lines",
              "buffer.pxd": "[BINARY] 4382 bytes",
              "buffer.pyx": "[BINARY] 25310 bytes",
              "codecs": {
                "__init__.pxd": "[BINARY] 6013 bytes",
                "bits.pyx": "[BINARY] 1475 bytes",
                "bytea.pyx": "[BINARY] 997 bytes",
                "context.pyx": "[BINARY] 623 bytes",
                "datetime.pyx": "[BINARY] 12831 bytes",
                "float.pyx": "[BINARY] 1031 bytes",
                "geometry.pyx": "[BINARY] 4665 bytes",
                "hstore.pyx": "[BINARY] 2018 bytes",
                "int.pyx": "[BINARY] 4527 bytes",
                "json.pyx": "[BINARY] 1454 bytes",
                "jsonpath.pyx": "[BINARY] 833 bytes",
                "misc.pyx": "[BINARY] 484 bytes",
                "network.pyx": "[BINARY] 3917 bytes",
                "numeric.pyx": "[BINARY] 10373 bytes",
                "pg_snapshot.pyx": "[BINARY] 1814 bytes",
                "text.pyx": "[BINARY] 1516 bytes",
                "tid.pyx": "[BINARY] 1549 bytes",
                "uuid.pyx": "[BINARY] 855 bytes"
              },
              "consts.pxi": "[BINARY] 375 bytes",
              "cpythonx.pxd": "[BINARY] 736 bytes",
              "debug.pxd": "[BINARY] 263 bytes",
              "frb.pxd": "[BINARY] 1212 bytes",
              "frb.pyx": "[BINARY] 409 bytes",
              "hton.pxd": "[BINARY] 953 bytes",
              "pgproto.cpython-312-x86_64-linux-gnu.so": "[BINARY] 2849672 bytes",
              "pgproto.pxd": "[BINARY] 430 bytes",
              "pgproto.pyx": "[BINARY] 1249 bytes",
              "tohex.pxd": "[BINARY] 361 bytes",
              "types.py": "[FILE] 424 lines",
              "uuid.pyx": "[BINARY] 9943 bytes"
            },
            "pool.py": "[FILE] 1131 lines",
            "prepared_stmt.py": "[FILE] 260 lines",
            "protocol": {
              "__init__.py": "[FILE] 10 lines",
              "codecs": {
                "__init__.py": "[FILE] 1 lines",
                "array.pyx": "[BINARY] 29486 bytes",
                "base.pxd": "[BINARY] 6224 bytes",
                "base.pyx": "[BINARY] 33475 bytes",
                "pgproto.pyx": "[BINARY] 17175 bytes",
                "range.pyx": "[BINARY] 6359 bytes",
                "record.pyx": "[BINARY] 2362 bytes",
                "textutils.pyx": "[BINARY] 2011 bytes"
              },
              "consts.pxi": "[BINARY] 381 bytes",
              "coreproto.pxd": "[BINARY] 6149 bytes",
              "coreproto.pyx": "[BINARY] 38015 bytes",
              "cpythonx.pxd": "[BINARY] 613 bytes",
              "encodings.pyx": "[BINARY] 1644 bytes",
              "pgtypes.pxi": "[BINARY] 6924 bytes",
              "prepared_stmt.pxd": "[BINARY] 1115 bytes",
              "prepared_stmt.pyx": "[BINARY] 13052 bytes",
              "protocol.cpython-312-x86_64-linux-gnu.so": "[BINARY] 8713328 bytes",
              "protocol.pxd": "[BINARY] 1950 bytes",
              "protocol.pyx": "[BINARY] 34824 bytes",
              "record": {
                "__init__.pxd": "[BINARY] 495 bytes"
              },
              "scram.pxd": "[BINARY] 1299 bytes",
              "scram.pyx": "[BINARY] 14594 bytes",
              "settings.pxd": "[BINARY] 1066 bytes",
              "settings.pyx": "[BINARY] 3795 bytes"
            },
            "serverversion.py": "[FILE] 61 lines",
            "transaction.py": "[FILE] 247 lines",
            "types.py": "[FILE] 178 lines",
            "utils.py": "[FILE] 46 lines"
          },
          "asyncpg-0.29.0.dist-info": {
            "AUTHORS": "[BINARY] 130 bytes",
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 11466 bytes",
            "METADATA": "[BINARY] 4356 bytes",
            "RECORD": "[BINARY] 8764 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "bcrypt": {
            "__init__.py": "[FILE] 44 lines",
            "__init__.pyi": "[BINARY] 333 bytes",
            "_bcrypt.abi3.so": "[BINARY] 631768 bytes",
            "py.typed": "[BINARY] 0 bytes"
          },
          "bcrypt-5.0.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 10524 bytes",
            "RECORD": "[BINARY] 835 bytes",
            "WHEEL": "[BINARY] 111 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 10850 bytes"
            },
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "billiard": {
            "__init__.py": "[FILE] 62 lines",
            "_ext.py": "[FILE] 33 lines",
            "_win.py": "[FILE] 115 lines",
            "common.py": "[FILE] 157 lines",
            "compat.py": "[FILE] 280 lines",
            "connection.py": "[FILE] 1041 lines",
            "context.py": "[FILE] 421 lines",
            "dummy": {
              "__init__.py": "[FILE] 167 lines",
              "connection.py": "[FILE] 93 lines"
            },
            "einfo.py": "[FILE] 194 lines",
            "exceptions.py": "[FILE] 53 lines",
            "forkserver.py": "[FILE] 265 lines",
            "heap.py": "[FILE] 286 lines",
            "managers.py": "[FILE] 1211 lines",
            "pool.py": "[FILE] 2054 lines",
            "popen_fork.py": "[FILE] 90 lines",
            "popen_forkserver.py": "[FILE] 69 lines",
            "popen_spawn_posix.py": "[FILE] 75 lines",
            "popen_spawn_win32.py": "[FILE] 122 lines",
            "process.py": "[FILE] 401 lines",
            "queues.py": "[FILE] 404 lines",
            "reduction.py": "[FILE] 294 lines",
            "resource_sharer.py": "[FILE] 163 lines",
            "semaphore_tracker.py": "[FILE] 147 lines",
            "sharedctypes.py": "[FILE] 259 lines",
            "spawn.py": "[FILE] 390 lines",
            "synchronize.py": "[FILE] 437 lines",
            "util.py": "[FILE] 238 lines"
          },
          "billiard-4.2.4.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE.txt": "[BINARY] 1483 bytes",
            "METADATA": "[BINARY] 4770 bytes",
            "RECORD": "[BINARY] 4127 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "celery": {
            "__init__.py": "[FILE] 173 lines",
            "__main__.py": "[FILE] 20 lines",
            "_state.py": "[FILE] 198 lines",
            "app": {
              "__init__.py": "[FILE] 77 lines",
              "amqp.py": "[FILE] 615 lines",
              "annotations.py": "[FILE] 53 lines",
              "autoretry.py": "[FILE] 67 lines",
              "backends.py": "[FILE] 69 lines",
              "base.py": "[FILE] 1367 lines",
              "builtins.py": "[FILE] 188 lines",
              "control.py": "[FILE] 780 lines",
              "defaults.py": "[FILE] 415 lines",
              "events.py": "[FILE] 41 lines",
              "log.py": "[FILE] 248 lines",
              "registry.py": "[FILE] 69 lines",
              "routes.py": "[FILE] 137 lines",
              "task.py": "[FILE] 1145 lines",
              "trace.py": "[FILE] 764 lines",
              "utils.py": "[FILE] 416 lines"
            },
            "apps": {
              "__init__.py": "[FILE] 1 lines",
              "beat.py": "[FILE] 161 lines",
              "multi.py": "[FILE] 507 lines",
              "worker.py": "[FILE] 388 lines"
            },
            "backends": {
              "__init__.py": "[FILE] 2 lines",
              "arangodb.py": "[FILE] 191 lines",
              "asynchronous.py": "[FILE] 334 lines",
              "azureblockblob.py": "[FILE] 166 lines",
              "base.py": "[FILE] 1111 lines",
              "cache.py": "[FILE] 164 lines",
              "cassandra.py": "[FILE] 257 lines",
              "consul.py": "[FILE] 117 lines",
              "cosmosdbsql.py": "[FILE] 219 lines",
              "couchbase.py": "[FILE] 115 lines",
              "couchdb.py": "[FILE] 100 lines",
              "database": {
                "__init__.py": "[FILE] 223 lines",
                "models.py": "[FILE] 109 lines",
                "session.py": "[FILE] 90 lines"
              },
              "dynamodb.py": "[FILE] 494 lines",
              "elasticsearch.py": "[FILE] 249 lines",
              "filesystem.py": "[FILE] 113 lines",
              "mongodb.py": "[FILE] 334 lines",
              "redis.py": "[FILE] 669 lines",
              "rpc.py": "[FILE] 343 lines",
              "s3.py": "[FILE] 88 lines"
            },
            "beat.py": "[FILE] 737 lines",
            "bin": {
              "__init__.py": "[FILE] 1 lines",
              "amqp.py": "[FILE] 313 lines",
              "base.py": "[FILE] 288 lines",
              "beat.py": "[FILE] 73 lines",
              "call.py": "[FILE] 72 lines",
              "celery.py": "[FILE] 237 lines",
              "control.py": "[FILE] 204 lines",
              "events.py": "[FILE] 95 lines",
              "graph.py": "[FILE] 198 lines",
              "list.py": "[FILE] 39 lines",
              "logtool.py": "[FILE] 158 lines",
              "migrate.py": "[FILE] 64 lines",
              "multi.py": "[FILE] 481 lines",
              "purge.py": "[FILE] 71 lines",
              "result.py": "[FILE] 31 lines",
              "shell.py": "[FILE] 174 lines",
              "upgrade.py": "[FILE] 92 lines",
              "worker.py": "[FILE] 361 lines"
            },
            "bootsteps.py": "[FILE] 416 lines",
            "canvas.py": "[FILE] 2395 lines",
            "concurrency": {
              "__init__.py": "[FILE] 49 lines",
              "asynpool.py": "[FILE] 1361 lines",
              "base.py": "[FILE] 181 lines",
              "eventlet.py": "[FILE] 182 lines",
              "gevent.py": "[FILE] 123 lines",
              "prefork.py": "[FILE] 173 lines",
              "solo.py": "[FILE] 32 lines",
              "thread.py": "[FILE] 65 lines"
            },
            "contrib": {
              "__init__.py": "[FILE] 1 lines",
              "abortable.py": "[FILE] 166 lines",
              "migrate.py": "[FILE] 417 lines",
              "pytest.py": "[FILE] 217 lines",
              "rdb.py": "[FILE] 188 lines",
              "sphinx.py": "[FILE] 106 lines",
              "testing": {
                "__init__.py": "[FILE] 1 lines",
                "app.py": "[FILE] 113 lines",
                "manager.py": "[FILE] 240 lines",
                "mocks.py": "[FILE] 138 lines",
                "tasks.py": "[FILE] 10 lines",
                "worker.py": "[FILE] 222 lines"
              }
            },
            "events": {
              "__init__.py": "[FILE] 16 lines",
              "cursesmon.py": "[FILE] 535 lines",
              "dispatcher.py": "[FILE] 230 lines",
              "dumper.py": "[FILE] 104 lines",
              "event.py": "[FILE] 64 lines",
              "receiver.py": "[FILE] 136 lines",
              "snapshot.py": "[FILE] 112 lines",
              "state.py": "[FILE] 731 lines"
            },
            "exceptions.py": "[FILE] 313 lines",
            "fixups": {
              "__init__.py": "[FILE] 2 lines",
              "django.py": "[FILE] 214 lines"
            },
            "loaders": {
              "__init__.py": "[FILE] 19 lines",
              "app.py": "[FILE] 9 lines",
              "base.py": "[FILE] 273 lines",
              "default.py": "[FILE] 43 lines"
            },
            "local.py": "[FILE] 544 lines",
            "platforms.py": "[FILE] 832 lines",
            "result.py": "[FILE] 1088 lines",
            "schedules.py": "[FILE] 866 lines",
            "security": {
              "__init__.py": "[FILE] 75 lines",
              "certificate.py": "[FILE] 114 lines",
              "key.py": "[FILE] 36 lines",
              "serialization.py": "[FILE] 102 lines",
              "utils.py": "[FILE] 29 lines"
            },
            "signals.py": "[FILE] 155 lines",
            "states.py": "[FILE] 152 lines",
            "utils": {
              "__init__.py": "[FILE] 38 lines",
              "abstract.py": "[FILE] 147 lines",
              "collections.py": "[FILE] 865 lines",
              "debug.py": "[FILE] 194 lines",
              "deprecated.py": "[FILE] 114 lines",
              "dispatch": {
                "__init__.py": "[FILE] 5 lines",
                "signal.py": "[FILE] 355 lines"
              },
              "functional.py": "[FILE] 403 lines",
              "graph.py": "[FILE] 310 lines",
              "imports.py": "[FILE] 164 lines",
              "iso8601.py": "[FILE] 77 lines",
              "log.py": "[FILE] 296 lines",
              "nodenames.py": "[FILE] 103 lines",
              "objects.py": "[FILE] 143 lines",
              "saferepr.py": "[FILE] 267 lines",
              "serialization.py": "[FILE] 274 lines",
              "static": {
                "__init__.py": "[FILE] 15 lines",
                "celery_128.png": "[BINARY] 2556 bytes"
              },
              "sysinfo.py": "[FILE] 49 lines",
              "term.py": "[FILE] 178 lines",
              "text.py": "[FILE] 199 lines",
              "threads.py": "[FILE] 332 lines",
              "time.py": "[FILE] 430 lines",
              "timer2.py": "[FILE] 155 lines"
            },
            "worker": {
              "__init__.py": "[FILE] 5 lines",
              "autoscale.py": "[FILE] 155 lines",
              "components.py": "[FILE] 241 lines",
              "consumer": {
                "__init__.py": "[FILE] 16 lines",
                "agent.py": "[FILE] 22 lines",
                "connection.py": "[FILE] 37 lines",
                "consumer.py": "[FILE] 746 lines",
                "control.py": "[FILE] 34 lines",
                "events.py": "[FILE] 69 lines",
                "gossip.py": "[FILE] 206 lines",
                "heart.py": "[FILE] 37 lines",
                "mingle.py": "[FILE] 77 lines",
                "tasks.py": "[FILE] 66 lines"
              },
              "control.py": "[FILE] 625 lines",
              "heartbeat.py": "[FILE] 62 lines",
              "loops.py": "[FILE] 136 lines",
              "pidbox.py": "[FILE] 123 lines",
              "request.py": "[FILE] 791 lines",
              "state.py": "[FILE] 289 lines",
              "strategy.py": "[FILE] 209 lines",
              "worker.py": "[FILE] 410 lines"
            }
          },
          "celery-5.3.4.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2717 bytes",
            "METADATA": "[BINARY] 21051 bytes",
            "RECORD": "[BINARY] 21833 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 48 bytes",
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "certifi": {
            "__init__.py": "[FILE] 5 lines",
            "__main__.py": "[FILE] 13 lines",
            "cacert.pem": "[BINARY] 272441 bytes",
            "core.py": "[FILE] 84 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "certifi-2026.2.25.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2474 bytes",
            "RECORD": "[BINARY] 1023 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 989 bytes"
            },
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "cffi": {
            "__init__.py": "[FILE] 15 lines",
            "_cffi_errors.h": "[BINARY] 3908 bytes",
            "_cffi_include.h": "[BINARY] 15055 bytes",
            "_embedding.h": "[BINARY] 18786 bytes",
            "_imp_emulation.py": "[FILE] 84 lines",
            "_shimmed_dist_utils.py": "[FILE] 46 lines",
            "api.py": "[FILE] 968 lines",
            "backend_ctypes.py": "[FILE] 1122 lines",
            "cffi_opcode.py": "[FILE] 188 lines",
            "commontypes.py": "[FILE] 83 lines",
            "cparser.py": "[FILE] 1016 lines",
            "error.py": "[FILE] 32 lines",
            "ffiplatform.py": "[FILE] 114 lines",
            "lock.py": "[FILE] 31 lines",
            "model.py": "[FILE] 619 lines",
            "parse_c_type.h": "[BINARY] 5976 bytes",
            "pkgconfig.py": "[FILE] 122 lines",
            "recompiler.py": "[FILE] 1599 lines",
            "setuptools_ext.py": "[FILE] 230 lines",
            "vengine_cpy.py": "[FILE] 1088 lines",
            "vengine_gen.py": "[FILE] 680 lines",
            "verifier.py": "[FILE] 307 lines"
          },
          "cffi-2.0.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2559 bytes",
            "RECORD": "[BINARY] 3281 bytes",
            "WHEEL": "[BINARY] 151 bytes",
            "entry_points.txt": "[BINARY] 75 bytes",
            "licenses": {
              "AUTHORS": "[BINARY] 208 bytes",
              "LICENSE": "[BINARY] 1123 bytes"
            },
            "top_level.txt": "[BINARY] 19 bytes"
          },
          "click": {
            "__init__.py": "[FILE] 124 lines",
            "_compat.py": "[FILE] 623 lines",
            "_termui_impl.py": "[FILE] 853 lines",
            "_textwrap.py": "[FILE] 52 lines",
            "_utils.py": "[FILE] 37 lines",
            "_winconsole.py": "[FILE] 297 lines",
            "core.py": "[FILE] 3416 lines",
            "decorators.py": "[FILE] 552 lines",
            "exceptions.py": "[FILE] 309 lines",
            "formatting.py": "[FILE] 302 lines",
            "globals.py": "[FILE] 68 lines",
            "parser.py": "[FILE] 533 lines",
            "py.typed": "[BINARY] 0 bytes",
            "shell_completion.py": "[FILE] 668 lines",
            "termui.py": "[FILE] 884 lines",
            "testing.py": "[FILE] 578 lines",
            "types.py": "[FILE] 1210 lines",
            "utils.py": "[FILE] 628 lines"
          },
          "click-8.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2621 bytes",
            "RECORD": "[BINARY] 2531 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 1475 bytes"
            }
          },
          "click_didyoumean": {
            "__init__.py": "[FILE] 67 lines"
          },
          "click_didyoumean-0.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1056 bytes",
            "METADATA": "[BINARY] 3943 bytes",
            "RECORD": "[BINARY] 574 bytes",
            "WHEEL": "[BINARY] 88 bytes"
          },
          "click_plugins": {
            "__init__.py": "[FILE] 62 lines",
            "core.py": "[FILE] 93 lines"
          },
          "click_plugins-1.1.1.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6461 bytes",
            "RECORD": "[BINARY] 1129 bytes",
            "WHEEL": "[BINARY] 109 bytes",
            "licenses": {
              "AUTHORS.txt": "[BINARY] 90 bytes",
              "LICENSE.txt": "[BINARY] 1517 bytes"
            },
            "top_level.txt": "[BINARY] 14 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "click_plugins.py": "[FILE] 238 lines",
          "click_repl": {
            "__init__.py": "[FILE] 12 lines",
            "_completer.py": "[FILE] 297 lines",
            "_repl.py": "[FILE] 153 lines",
            "exceptions.py": "[FILE] 24 lines",
            "utils.py": "[FILE] 223 lines"
          },
          "click_repl-0.3.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1141 bytes",
            "METADATA": "[BINARY] 3553 bytes",
            "RECORD": "[BINARY] 1146 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "cryptography": {
            "__about__.py": "[FILE] 18 lines",
            "__init__.py": "[FILE] 14 lines",
            "exceptions.py": "[FILE] 53 lines",
            "fernet.py": "[FILE] 225 lines",
            "hazmat": {
              "__init__.py": "[FILE] 14 lines",
              "_oid.py": "[FILE] 357 lines",
              "asn1": {
                "__init__.py": "[FILE] 11 lines",
                "asn1.py": "[FILE] 117 lines"
              },
              "backends": {
                "__init__.py": "[FILE] 14 lines",
                "openssl": {
                  "__init__.py": "[FILE] 10 lines",
                  "backend.py": "[FILE] 303 lines"
                }
              },
              "bindings": {
                "__init__.py": "[FILE] 4 lines",
                "_rust": {
                  "__init__.pyi": "[BINARY] 1257 bytes",
                  "_openssl.pyi": "[BINARY] 230 bytes",
                  "asn1.pyi": "[BINARY] 354 bytes",
                  "declarative_asn1.pyi": "[BINARY] 892 bytes",
                  "exceptions.pyi": "[BINARY] 640 bytes",
                  "ocsp.pyi": "[BINARY] 4020 bytes",
                  "openssl": {
                    "__init__.pyi": "[BINARY] 1522 bytes",
                    "aead.pyi": "[BINARY] 2688 bytes",
                    "ciphers.pyi": "[BINARY] 1315 bytes",
                    "cmac.pyi": "[BINARY] 564 bytes",
                    "dh.pyi": "[BINARY] 1564 bytes",
                    "dsa.pyi": "[BINARY] 1299 bytes",
                    "ec.pyi": "[BINARY] 1691 bytes",
                    "ed25519.pyi": "[BINARY] 532 bytes",
                    "ed448.pyi": "[BINARY] 514 bytes",
                    "hashes.pyi": "[BINARY] 984 bytes",
                    "hmac.pyi": "[BINARY] 702 bytes",
                    "kdf.pyi": "[BINARY] 2029 bytes",
                    "keys.pyi": "[BINARY] 912 bytes",
                    "poly1305.pyi": "[BINARY] 585 bytes",
                    "rsa.pyi": "[BINARY] 1364 bytes",
                    "x25519.pyi": "[BINARY] 523 bytes",
                    "x448.pyi": "[BINARY] 505 bytes"
                  },
                  "pkcs12.pyi": "[BINARY] 1605 bytes",
                  "pkcs7.pyi": "[BINARY] 1601 bytes",
                  "test_support.pyi": "[BINARY] 757 bytes",
                  "x509.pyi": "[BINARY] 9784 bytes"
                },
                "_rust.abi3.so": "[BINARY] 12807728 bytes",
                "openssl": {
                  "__init__.py": "[FILE] 4 lines",
                  "_conditional.py": "[FILE] 208 lines",
                  "binding.py": "[FILE] 138 lines"
                }
              },
              "decrepit": {
                "__init__.py": "[FILE] 6 lines",
                "ciphers": {
                  "__init__.py": "[FILE] 6 lines",
                  "algorithms.py": "[FILE] 113 lines"
                }
              },
              "primitives": {
                "__init__.py": "[FILE] 4 lines",
                "_asymmetric.py": "[FILE] 20 lines",
                "_cipheralgorithm.py": "[FILE] 61 lines",
                "_serialization.py": "[FILE] 169 lines",
                "asymmetric": {
                  "__init__.py": "[FILE] 4 lines",
                  "dh.py": "[FILE] 148 lines",
                  "dsa.py": "[FILE] 168 lines",
                  "ec.py": "[FILE] 471 lines",
                  "ed25519.py": "[FILE] 130 lines",
                  "ed448.py": "[FILE] 132 lines",
                  "padding.py": "[FILE] 112 lines",
                  "rsa.py": "[FILE] 286 lines",
                  "types.py": "[FILE] 112 lines",
                  "utils.py": "[FILE] 25 lines",
                  "x25519.py": "[FILE] 123 lines",
                  "x448.py": "[FILE] 126 lines"
                },
                "ciphers": {
                  "__init__.py": "[FILE] 28 lines",
                  "aead.py": "[FILE] 24 lines",
                  "algorithms.py": "[FILE] 137 lines",
                  "base.py": "[FILE] 147 lines",
                  "modes.py": "[FILE] 269 lines"
                },
                "cmac.py": "[FILE] 11 lines",
                "constant_time.py": "[FILE] 15 lines",
                "hashes.py": "[FILE] 247 lines",
                "hmac.py": "[FILE] 14 lines",
                "kdf": {
                  "__init__.py": "[FILE] 24 lines",
                  "argon2.py": "[FILE] 14 lines",
                  "concatkdf.py": "[FILE] 126 lines",
                  "hkdf.py": "[FILE] 17 lines",
                  "kbkdf.py": "[FILE] 304 lines",
                  "pbkdf2.py": "[FILE] 63 lines",
                  "scrypt.py": "[FILE] 20 lines",
                  "x963kdf.py": "[FILE] 62 lines"
                },
                "keywrap.py": "[FILE] 178 lines",
                "padding.py": "[FILE] 70 lines",
                "poly1305.py": "[FILE] 12 lines",
                "serialization": {
                  "__init__.py": "[FILE] 66 lines",
                  "base.py": "[FILE] 15 lines",
                  "pkcs12.py": "[FILE] 177 lines",
                  "pkcs7.py": "[FILE] 412 lines",
                  "ssh.py": "[FILE] 1620 lines"
                },
                "twofactor": {
                  "__init__.py": "[FILE] 10 lines",
                  "hotp.py": "[FILE] 102 lines",
                  "totp.py": "[FILE] 57 lines"
                }
              }
            },
            "py.typed": "[BINARY] 0 bytes",
            "utils.py": "[FILE] 139 lines",
            "x509": {
              "__init__.py": "[FILE] 271 lines",
              "base.py": "[FILE] 849 lines",
              "certificate_transparency.py": "[FILE] 36 lines",
              "extensions.py": "[FILE] 2529 lines",
              "general_name.py": "[FILE] 282 lines",
              "name.py": "[FILE] 477 lines",
              "ocsp.py": "[FILE] 380 lines",
              "oid.py": "[FILE] 38 lines",
              "verification.py": "[FILE] 35 lines"
            }
          },
          "cryptography-46.0.5.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 5748 bytes",
            "RECORD": "[BINARY] 16073 bytes",
            "WHEEL": "[BINARY] 108 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 197 bytes",
              "LICENSE.APACHE": "[BINARY] 11360 bytes",
              "LICENSE.BSD": "[BINARY] 1532 bytes"
            }
          },
          "dateutil": {
            "__init__.py": "[FILE] 25 lines",
            "_common.py": "[FILE] 44 lines",
            "_version.py": "[FILE] 5 lines",
            "easter.py": "[FILE] 90 lines",
            "parser": {
              "__init__.py": "[FILE] 62 lines",
              "_parser.py": "[FILE] 1614 lines",
              "isoparser.py": "[FILE] 417 lines"
            },
            "relativedelta.py": "[FILE] 600 lines",
            "rrule.py": "[FILE] 1738 lines",
            "tz": {
              "__init__.py": "[FILE] 13 lines",
              "_common.py": "[FILE] 420 lines",
              "_factories.py": "[FILE] 81 lines",
              "tz.py": "[FILE] 1850 lines",
              "win.py": "[FILE] 371 lines"
            },
            "tzwin.py": "[FILE] 3 lines",
            "utils.py": "[FILE] 72 lines",
            "zoneinfo": {
              "__init__.py": "[FILE] 168 lines",
              "rebuild.py": "[FILE] 76 lines"
            }
          },
          "dotenv": {
            "__init__.py": "[FILE] 50 lines",
            "__main__.py": "[FILE] 7 lines",
            "cli.py": "[FILE] 200 lines",
            "ipython.py": "[FILE] 40 lines",
            "main.py": "[FILE] 383 lines",
            "parser.py": "[FILE] 176 lines",
            "py.typed": "[BINARY] 26 bytes",
            "variables.py": "[FILE] 87 lines",
            "version.py": "[FILE] 2 lines"
          },
          "ecdsa": {
            "__init__.py": "[FILE] 105 lines",
            "_compat.py": "[FILE] 139 lines",
            "_rwlock.py": "[FILE] 87 lines",
            "_sha3.py": "[FILE] 182 lines",
            "_version.py": "[FILE] 22 lines",
            "curves.py": "[FILE] 591 lines",
            "der.py": "[FILE] 479 lines",
            "ecdh.py": "[FILE] 337 lines",
            "ecdsa.py": "[FILE] 1095 lines",
            "eddsa.py": "[FILE] 253 lines",
            "ellipticcurve.py": "[FILE] 1610 lines",
            "errors.py": "[FILE] 5 lines",
            "keys.py": "[FILE] 1632 lines",
            "numbertheory.py": "[FILE] 836 lines",
            "rfc6979.py": "[FILE] 114 lines",
            "ssh.py": "[FILE] 84 lines",
            "test_curves.py": "[FILE] 362 lines",
            "test_der.py": "[FILE] 603 lines",
            "test_ecdh.py": "[FILE] 450 lines",
            "test_ecdsa.py": "[FILE] 695 lines",
            "test_eddsa.py": "[FILE] 1125 lines",
            "test_ellipticcurve.py": "[FILE] 295 lines",
            "test_jacobi.py": "[FILE] 935 lines",
            "test_keys.py": "[FILE] 1139 lines",
            "test_malformed_sigs.py": "[FILE] 379 lines",
            "test_numbertheory.py": "[FILE] 484 lines",
            "test_pyecdsa.py": "[FILE] 2565 lines",
            "test_rw_lock.py": "[FILE] 181 lines",
            "test_sha3.py": "[FILE] 112 lines",
            "util.py": "[FILE] 534 lines"
          },
          "ecdsa-0.19.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1147 bytes",
            "METADATA": "[BINARY] 29641 bytes",
            "RECORD": "[BINARY] 4164 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "fastapi": {
            "__init__.py": "[FILE] 26 lines",
            "_compat.py": "[FILE] 630 lines",
            "applications.py": "[FILE] 4638 lines",
            "background.py": "[FILE] 60 lines",
            "concurrency.py": "[FILE] 41 lines",
            "datastructures.py": "[FILE] 205 lines",
            "dependencies": {
              "__init__.py": "[FILE] 1 lines",
              "models.py": "[FILE] 59 lines",
              "utils.py": "[FILE] 811 lines"
            },
            "encoders.py": "[FILE] 342 lines",
            "exception_handlers.py": "[FILE] 35 lines",
            "exceptions.py": "[FILE] 177 lines",
            "logger.py": "[FILE] 4 lines",
            "middleware": {
              "__init__.py": "[FILE] 2 lines",
              "asyncexitstack.py": "[FILE] 26 lines",
              "cors.py": "[FILE] 2 lines",
              "gzip.py": "[FILE] 2 lines",
              "httpsredirect.py": "[FILE] 4 lines",
              "trustedhost.py": "[FILE] 4 lines",
              "wsgi.py": "[FILE] 2 lines"
            },
            "openapi": {
              "__init__.py": "[FILE] 1 lines",
              "constants.py": "[FILE] 4 lines",
              "docs.py": "[FILE] 345 lines",
              "models.py": "[FILE] 612 lines",
              "utils.py": "[FILE] 531 lines"
            },
            "param_functions.py": "[FILE] 2361 lines",
            "params.py": "[FILE] 778 lines",
            "py.typed": "[BINARY] 0 bytes",
            "requests.py": "[FILE] 3 lines",
            "responses.py": "[FILE] 49 lines",
            "routing.py": "[FILE] 4363 lines",
            "security": {
              "__init__.py": "[FILE] 16 lines",
              "api_key.py": "[FILE] 302 lines",
              "base.py": "[FILE] 7 lines",
              "http.py": "[FILE] 421 lines",
              "oauth2.py": "[FILE] 639 lines",
              "open_id_connect_url.py": "[FILE] 85 lines",
              "utils.py": "[FILE] 11 lines"
            },
            "staticfiles.py": "[FILE] 2 lines",
            "templating.py": "[FILE] 2 lines",
            "testclient.py": "[FILE] 2 lines",
            "types.py": "[FILE] 12 lines",
            "utils.py": "[FILE] 230 lines",
            "websockets.py": "[FILE] 4 lines"
          },
          "fastapi-0.104.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 24298 bytes",
            "RECORD": "[BINARY] 6399 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1086 bytes"
            }
          },
          "greenlet": {
            "CObjects.cpp": "[BINARY] 3508 bytes",
            "PyGreenlet.cpp": "[BINARY] 26311 bytes",
            "PyGreenlet.hpp": "[BINARY] 1463 bytes",
            "PyGreenletUnswitchable.cpp": "[BINARY] 4375 bytes",
            "PyModule.cpp": "[BINARY] 8649 bytes",
            "TBrokenGreenlet.cpp": "[BINARY] 1021 bytes",
            "TExceptionState.cpp": "[BINARY] 1359 bytes",
            "TGreenlet.cpp": "[BINARY] 25909 bytes",
            "TGreenlet.hpp": "[BINARY] 28700 bytes",
            "TGreenletGlobals.cpp": "[BINARY] 3264 bytes",
            "TMainGreenlet.cpp": "[BINARY] 3420 bytes",
            "TPythonState.cpp": "[BINARY] 17155 bytes",
            "TStackState.cpp": "[BINARY] 7381 bytes",
            "TThreadState.hpp": "[BINARY] 20439 bytes",
            "TThreadStateCreator.hpp": "[BINARY] 2620 bytes",
            "TThreadStateDestroy.cpp": "[BINARY] 8395 bytes",
            "TUserGreenlet.cpp": "[BINARY] 23553 bytes",
            "__init__.py": "[FILE] 72 lines",
            "_greenlet.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1448744 bytes",
            "greenlet.cpp": "[BINARY] 11093 bytes",
            "greenlet.h": "[BINARY] 4755 bytes",
            "greenlet_allocator.hpp": "[BINARY] 1835 bytes",
            "greenlet_compiler_compat.hpp": "[BINARY] 4346 bytes",
            "greenlet_cpython_compat.hpp": "[BINARY] 4253 bytes",
            "greenlet_exceptions.hpp": "[BINARY] 4503 bytes",
            "greenlet_internal.hpp": "[BINARY] 2709 bytes",
            "greenlet_msvc_compat.hpp": "[BINARY] 3195 bytes",
            "greenlet_refs.hpp": "[BINARY] 34436 bytes",
            "greenlet_slp_switch.hpp": "[BINARY] 3298 bytes",
            "greenlet_thread_support.hpp": "[BINARY] 867 bytes",
            "platform": {
              "__init__.py": "[FILE] 1 lines",
              "setup_switch_x64_masm.cmd": "[BINARY] 143 bytes",
              "switch_aarch64_gcc.h": "[BINARY] 4307 bytes",
              "switch_alpha_unix.h": "[BINARY] 671 bytes",
              "switch_amd64_unix.h": "[BINARY] 2748 bytes",
              "switch_arm32_gcc.h": "[BINARY] 2479 bytes",
              "switch_arm32_ios.h": "[BINARY] 1892 bytes",
              "switch_arm64_masm.asm": "[BINARY] 1245 bytes",
              "switch_arm64_masm.obj": "[BINARY] 746 bytes",
              "switch_arm64_msvc.h": "[BINARY] 398 bytes",
              "switch_csky_gcc.h": "[BINARY] 1331 bytes",
              "switch_loongarch64_linux.h": "[BINARY] 779 bytes",
              "switch_m68k_gcc.h": "[BINARY] 928 bytes",
              "switch_mips_unix.h": "[BINARY] 1462 bytes",
              "switch_ppc64_aix.h": "[BINARY] 3860 bytes",
              "switch_ppc64_linux.h": "[BINARY] 3815 bytes",
              "switch_ppc_aix.h": "[BINARY] 2941 bytes",
              "switch_ppc_linux.h": "[BINARY] 2759 bytes",
              "switch_ppc_macosx.h": "[BINARY] 2624 bytes",
              "switch_ppc_unix.h": "[BINARY] 2652 bytes",
              "switch_riscv_unix.h": "[BINARY] 949 bytes",
              "switch_s390_unix.h": "[BINARY] 2763 bytes",
              "switch_sh_gcc.h": "[BINARY] 901 bytes",
              "switch_sparc_sun_gcc.h": "[BINARY] 2797 bytes",
              "switch_x32_unix.h": "[BINARY] 1509 bytes",
              "switch_x64_masm.asm": "[BINARY] 1841 bytes",
              "switch_x64_masm.obj": "[BINARY] 1078 bytes",
              "switch_x64_msvc.h": "[BINARY] 1805 bytes",
              "switch_x86_msvc.h": "[BINARY] 12838 bytes",
              "switch_x86_unix.h": "[BINARY] 3059 bytes"
            },
            "slp_platformselect.h": "[BINARY] 3959 bytes",
            "tests": {
              "__init__.py": "[FILE] 249 lines",
              "_test_extension.c": "[BINARY] 6921 bytes",
              "_test_extension.cpython-312-x86_64-linux-gnu.so": "[BINARY] 17256 bytes",
              "_test_extension_cpp.cpp": "[BINARY] 6686 bytes",
              "_test_extension_cpp.cpython-312-x86_64-linux-gnu.so": "[BINARY] 58384 bytes",
              "fail_clearing_run_switches.py": "[FILE] 48 lines",
              "fail_cpp_exception.py": "[FILE] 34 lines",
              "fail_initialstub_already_started.py": "[FILE] 79 lines",
              "fail_slp_switch.py": "[FILE] 30 lines",
              "fail_switch_three_greenlets.py": "[FILE] 45 lines",
              "fail_switch_three_greenlets2.py": "[FILE] 56 lines",
              "fail_switch_two_greenlets.py": "[FILE] 42 lines",
              "leakcheck.py": "[FILE] 337 lines",
              "test_contextvars.py": "[FILE] 313 lines",
              "test_cpp.py": "[FILE] 74 lines",
              "test_extension_interface.py": "[FILE] 116 lines",
              "test_gc.py": "[FILE] 87 lines",
              "test_generator.py": "[FILE] 60 lines",
              "test_generator_nested.py": "[FILE] 169 lines",
              "test_greenlet.py": "[FILE] 1366 lines",
              "test_greenlet_trash.py": "[FILE] 188 lines",
              "test_interpreter_shutdown.py": "[FILE] 321 lines",
              "test_leaks.py": "[FILE] 475 lines",
              "test_stack_saved.py": "[FILE] 20 lines",
              "test_throw.py": "[FILE] 129 lines",
              "test_tracing.py": "[FILE] 300 lines",
              "test_version.py": "[FILE] 42 lines",
              "test_weakref.py": "[FILE] 36 lines"
            }
          },
          "greenlet-3.3.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3731 bytes",
            "RECORD": "[BINARY] 10609 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1434 bytes",
              "LICENSE.PSF": "[BINARY] 2424 bytes"
            },
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "h11": {
            "__init__.py": "[FILE] 63 lines",
            "_abnf.py": "[FILE] 133 lines",
            "_connection.py": "[FILE] 660 lines",
            "_events.py": "[FILE] 370 lines",
            "_headers.py": "[FILE] 283 lines",
            "_readers.py": "[FILE] 251 lines",
            "_receivebuffer.py": "[FILE] 154 lines",
            "_state.py": "[FILE] 366 lines",
            "_util.py": "[FILE] 136 lines",
            "_version.py": "[FILE] 17 lines",
            "_writers.py": "[FILE] 146 lines",
            "py.typed": "[BINARY] 7 bytes"
          },
          "h11-0.16.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8348 bytes",
            "RECORD": "[BINARY] 1830 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 1124 bytes"
            },
            "top_level.txt": "[BINARY] 4 bytes"
          },
          "httpcore": {
            "__init__.py": "[FILE] 142 lines",
            "_api.py": "[FILE] 95 lines",
            "_async": {
              "__init__.py": "[FILE] 40 lines",
              "connection.py": "[FILE] 223 lines",
              "connection_pool.py": "[FILE] 421 lines",
              "http11.py": "[FILE] 380 lines",
              "http2.py": "[FILE] 593 lines",
              "http_proxy.py": "[FILE] 368 lines",
              "interfaces.py": "[FILE] 138 lines",
              "socks_proxy.py": "[FILE] 342 lines"
            },
            "_backends": {
              "__init__.py": "[FILE] 1 lines",
              "anyio.py": "[FILE] 147 lines",
              "auto.py": "[FILE] 53 lines",
              "base.py": "[FILE] 102 lines",
              "mock.py": "[FILE] 144 lines",
              "sync.py": "[FILE] 242 lines",
              "trio.py": "[FILE] 160 lines"
            },
            "_exceptions.py": "[FILE] 82 lines",
            "_models.py": "[FILE] 517 lines",
            "_ssl.py": "[FILE] 10 lines",
            "_sync": {
              "__init__.py": "[FILE] 40 lines",
              "connection.py": "[FILE] 223 lines",
              "connection_pool.py": "[FILE] 421 lines",
              "http11.py": "[FILE] 380 lines",
              "http2.py": "[FILE] 593 lines",
              "http_proxy.py": "[FILE] 368 lines",
              "interfaces.py": "[FILE] 138 lines",
              "socks_proxy.py": "[FILE] 342 lines"
            },
            "_synchronization.py": "[FILE] 319 lines",
            "_trace.py": "[FILE] 108 lines",
            "_utils.py": "[FILE] 38 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "httpcore-1.0.9.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 21529 bytes",
            "RECORD": "[BINARY] 4762 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 28 lines"
            }
          },
          "httptools": {
            "__init__.py": "[FILE] 7 lines",
            "_version.py": "[FILE] 14 lines",
            "parser": {
              "__init__.py": "[FILE] 7 lines",
              "cparser.pxd": "[BINARY] 4977 bytes",
              "errors.py": "[FILE] 31 lines",
              "parser.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1264464 bytes",
              "parser.pyi": "[BINARY] 1861 bytes",
              "parser.pyx": "[BINARY] 15140 bytes",
              "protocol.py": "[FILE] 16 lines",
              "python.pxd": "[BINARY] 138 bytes",
              "url_cparser.pxd": "[BINARY] 779 bytes",
              "url_parser.cpython-312-x86_64-linux-gnu.so": "[BINARY] 483328 bytes",
              "url_parser.pyi": "[BINARY] 565 bytes",
              "url_parser.pyx": "[BINARY] 3758 bytes"
            }
          },
          "httptools-0.7.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3472 bytes",
            "RECORD": "[BINARY] 2021 bytes",
            "WHEEL": "[BINARY] 186 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1093 bytes"
            },
            "top_level.txt": "[BINARY] 10 bytes"
          },
          "httpx": {
            "__init__.py": "[FILE] 139 lines",
            "__version__.py": "[FILE] 4 lines",
            "_api.py": "[FILE] 446 lines",
            "_auth.py": "[FILE] 353 lines",
            "_client.py": "[FILE] 2007 lines",
            "_compat.py": "[FILE] 42 lines",
            "_config.py": "[FILE] 369 lines",
            "_content.py": "[FILE] 239 lines",
            "_decoders.py": "[FILE] 325 lines",
            "_exceptions.py": "[FILE] 344 lines",
            "_main.py": "[FILE] 507 lines",
            "_models.py": "[FILE] 1215 lines",
            "_multipart.py": "[FILE] 267 lines",
            "_status_codes.py": "[FILE] 159 lines",
            "_transports": {
              "__init__.py": "[FILE] 1 lines",
              "asgi.py": "[FILE] 180 lines",
              "base.py": "[FILE] 83 lines",
              "default.py": "[FILE] 379 lines",
              "mock.py": "[FILE] 39 lines",
              "wsgi.py": "[FILE] 145 lines"
            },
            "_types.py": "[FILE] 134 lines",
            "_urlparse.py": "[FILE] 465 lines",
            "_urls.py": "[FILE] 643 lines",
            "_utils.py": "[FILE] 443 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "httpx-0.25.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 7095 bytes",
            "RECORD": "[BINARY] 3727 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "entry_points.txt": "[BINARY] 37 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 13 lines"
            }
          },
          "idna": {
            "__init__.py": "[FILE] 46 lines",
            "codec.py": "[FILE] 123 lines",
            "compat.py": "[FILE] 16 lines",
            "core.py": "[FILE] 438 lines",
            "idnadata.py": "[FILE] 4310 lines",
            "intranges.py": "[FILE] 58 lines",
            "package_data.py": "[FILE] 2 lines",
            "py.typed": "[BINARY] 0 bytes",
            "uts46data.py": "[FILE] 8842 lines"
          },
          "idna-3.11.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8378 bytes",
            "RECORD": "[BINARY] 1392 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 32 lines"
            }
          },
          "jose": {
            "__init__.py": "[FILE] 11 lines",
            "backends": {
              "__init__.py": "[FILE] 33 lines",
              "_asn1.py": "[FILE] 84 lines",
              "base.py": "[FILE] 90 lines",
              "cryptography_backend.py": "[FILE] 606 lines",
              "ecdsa_backend.py": "[FILE] 151 lines",
              "native.py": "[FILE] 77 lines",
              "rsa_backend.py": "[FILE] 285 lines"
            },
            "constants.py": "[FILE] 99 lines",
            "exceptions.py": "[FILE] 60 lines",
            "jwe.py": "[FILE] 608 lines",
            "jwk.py": "[FILE] 80 lines",
            "jws.py": "[FILE] 267 lines",
            "jwt.py": "[FILE] 497 lines",
            "utils.py": "[FILE] 109 lines"
          },
          "kombu": {
            "__init__.py": "[FILE] 116 lines",
            "abstract.py": "[FILE] 144 lines",
            "asynchronous": {
              "__init__.py": "[FILE] 10 lines",
              "aws": {
                "__init__.py": "[FILE] 18 lines",
                "connection.py": "[FILE] 279 lines",
                "ext.py": "[FILE] 34 lines",
                "sqs": {
                  "__init__.py": "[FILE] 1 lines",
                  "connection.py": "[FILE] 336 lines",
                  "ext.py": "[FILE] 10 lines",
                  "message.py": "[FILE] 36 lines",
                  "queue.py": "[FILE] 131 lines"
                }
              },
              "debug.py": "[FILE] 68 lines",
              "http": {
                "__init__.py": "[FILE] 29 lines",
                "base.py": "[FILE] 275 lines",
                "curl.py": "[FILE] 294 lines"
              },
              "hub.py": "[FILE] 404 lines",
              "semaphore.py": "[FILE] 128 lines",
              "timer.py": "[FILE] 242 lines"
            },
            "clocks.py": "[FILE] 157 lines",
            "common.py": "[FILE] 457 lines",
            "compat.py": "[FILE] 228 lines",
            "compression.py": "[FILE] 122 lines",
            "connection.py": "[FILE] 1145 lines",
            "entity.py": "[FILE] 888 lines",
            "exceptions.py": "[FILE] 113 lines",
            "log.py": "[FILE] 144 lines",
            "matcher.py": "[FILE] 145 lines",
            "message.py": "[FILE] 235 lines",
            "messaging.py": "[FILE] 679 lines",
            "mixins.py": "[FILE] 304 lines",
            "pidbox.py": "[FILE] 424 lines",
            "pools.py": "[FILE] 153 lines",
            "resource.py": "[FILE] 232 lines",
            "serialization.py": "[FILE] 464 lines",
            "simple.py": "[FILE] 164 lines",
            "transport": {
              "SLMQ.py": "[FILE] 203 lines",
              "SQS.py": "[FILE] 1185 lines",
              "__init__.py": "[FILE] 94 lines",
              "azureservicebus.py": "[FILE] 499 lines",
              "azurestoragequeues.py": "[FILE] 264 lines",
              "base.py": "[FILE] 272 lines",
              "confluentkafka.py": "[FILE] 381 lines",
              "consul.py": "[FILE] 324 lines",
              "etcd.py": "[FILE] 301 lines",
              "filesystem.py": "[FILE] 353 lines",
              "gcpubsub.py": "[FILE] 820 lines",
              "librabbitmq.py": "[FILE] 191 lines",
              "memory.py": "[FILE] 107 lines",
              "mongodb.py": "[FILE] 555 lines",
              "native_delayed_delivery.py": "[FILE] 135 lines",
              "pyamqp.py": "[FILE] 254 lines",
              "pyro.py": "[FILE] 213 lines",
              "qpid.py": "[FILE] 1749 lines",
              "redis.py": "[FILE] 1502 lines",
              "sqlalchemy": {
                "__init__.py": "[FILE] 263 lines",
                "models.py": "[FILE] 77 lines"
              },
              "virtual": {
                "__init__.py": "[FILE] 12 lines",
                "base.py": "[FILE] 1040 lines",
                "exchange.py": "[FILE] 165 lines"
              },
              "zookeeper.py": "[FILE] 224 lines"
            },
            "utils": {
              "__init__.py": "[FILE] 21 lines",
              "amq_manager.py": "[FILE] 23 lines",
              "collections.py": "[FILE] 46 lines",
              "compat.py": "[FILE] 138 lines",
              "debug.py": "[FILE] 78 lines",
              "div.py": "[FILE] 38 lines",
              "encoding.py": "[FILE] 98 lines",
              "eventio.py": "[FILE] 330 lines",
              "functional.py": "[FILE] 361 lines",
              "imports.py": "[FILE] 69 lines",
              "json.py": "[FILE] 147 lines",
              "limits.py": "[FILE] 88 lines",
              "objects.py": "[FILE] 68 lines",
              "scheduling.py": "[FILE] 112 lines",
              "text.py": "[FILE] 74 lines",
              "time.py": "[FILE] 10 lines",
              "url.py": "[FILE] 133 lines",
              "uuid.py": "[FILE] 16 lines"
            }
          },
          "kombu-5.6.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3465 bytes",
            "RECORD": "[BINARY] 11150 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1664 bytes"
            },
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "mako": {
            "__init__.py": "[FILE] 9 lines",
            "_ast_util.py": "[FILE] 714 lines",
            "ast.py": "[FILE] 203 lines",
            "cache.py": "[FILE] 240 lines",
            "cmd.py": "[FILE] 100 lines",
            "codegen.py": "[FILE] 1320 lines",
            "compat.py": "[FILE] 71 lines",
            "exceptions.py": "[FILE] 418 lines",
            "ext": {
              "__init__.py": "[FILE] 1 lines",
              "autohandler.py": "[FILE] 71 lines",
              "babelplugin.py": "[FILE] 58 lines",
              "beaker_cache.py": "[FILE] 83 lines",
              "extract.py": "[FILE] 130 lines",
              "linguaplugin.py": "[FILE] 58 lines",
              "preprocessors.py": "[FILE] 21 lines",
              "pygmentplugin.py": "[FILE] 151 lines",
              "turbogears.py": "[FILE] 62 lines"
            },
            "filters.py": "[FILE] 164 lines",
            "lexer.py": "[FILE] 482 lines",
            "lookup.py": "[FILE] 362 lines",
            "parsetree.py": "[FILE] 657 lines",
            "pygen.py": "[FILE] 310 lines",
            "pyparser.py": "[FILE] 236 lines",
            "runtime.py": "[FILE] 969 lines",
            "template.py": "[FILE] 712 lines",
            "testing": {
              "__init__.py": "[FILE] 1 lines",
              "_config.py": "[FILE] 129 lines",
              "assertions.py": "[FILE] 167 lines",
              "config.py": "[FILE] 18 lines",
              "exclusions.py": "[FILE] 81 lines",
              "fixtures.py": "[FILE] 120 lines",
              "helpers.py": "[FILE] 72 lines"
            },
            "util.py": "[FILE] 389 lines"
          },
          "mako-1.3.10.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2919 bytes",
            "RECORD": "[BINARY] 4761 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "entry_points.txt": "[BINARY] 512 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1098 bytes"
            },
            "top_level.txt": "[BINARY] 5 bytes"
          },
          "markupsafe": {
            "__init__.py": "[FILE] 397 lines",
            "_native.py": "[FILE] 9 lines",
            "_speedups.c": "[BINARY] 4327 bytes",
            "_speedups.cpython-312-x86_64-linux-gnu.so": "[BINARY] 44072 bytes",
            "_speedups.pyi": "[BINARY] 41 bytes",
            "py.typed": "[BINARY] 0 bytes"
          },
          "markupsafe-3.0.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2690 bytes",
            "RECORD": "[BINARY] 1116 bytes",
            "WHEEL": "[BINARY] 190 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 1475 bytes"
            },
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "multipart": {
            "__init__.py": "[FILE] 16 lines",
            "decoders.py": "[FILE] 172 lines",
            "exceptions.py": "[FILE] 47 lines",
            "multipart.py": "[FILE] 1894 lines",
            "tests": {
              "__init__.py": "[FILE] 1 lines",
              "compat.py": "[FILE] 134 lines",
              "test_data": {
                "http": {
                  "CR_in_header.http": "[BINARY] 149 bytes",
                  "CR_in_header.yaml": "[FILE] 4 lines",
                  "CR_in_header_value.http": "[BINARY] 149 bytes",
                  "CR_in_header_value.yaml": "[FILE] 4 lines",
                  "almost_match_boundary.http": "[BINARY] 264 bytes",
                  "almost_match_boundary.yaml": "[FILE] 9 lines",
                  "almost_match_boundary_without_CR.http": "[BINARY] 132 bytes",
                  "almost_match_boundary_without_CR.yaml": "[FILE] 9 lines",
                  "almost_match_boundary_without_LF.http": "[BINARY] 133 bytes",
                  "almost_match_boundary_without_LF.yaml": "[FILE] 9 lines",
                  "almost_match_boundary_without_final_hyphen.http": "[BINARY] 133 bytes",
                  "almost_match_boundary_without_final_hyphen.yaml": "[FILE] 9 lines",
                  "bad_end_of_headers.http": "[BINARY] 149 bytes",
                  "bad_end_of_headers.yaml": "[FILE] 4 lines",
                  "bad_header_char.http": "[BINARY] 149 bytes",
                  "bad_header_char.yaml": "[FILE] 4 lines",
                  "bad_initial_boundary.http": "[BINARY] 149 bytes",
                  "bad_initial_boundary.yaml": "[FILE] 4 lines",
                  "base64_encoding.http": "[BINARY] 173 bytes",
                  "base64_encoding.yaml": "[FILE] 8 lines",
                  "empty_header.http": "[BINARY] 130 bytes",
                  "empty_header.yaml": "[FILE] 4 lines",
                  "multiple_fields.http": "[BINARY] 242 bytes",
                  "multiple_fields.yaml": "[FILE] 11 lines",
                  "multiple_files.http": "[BINARY] 348 bytes",
                  "multiple_files.yaml": "[FILE] 14 lines",
                  "quoted_printable_encoding.http": "[BINARY] 180 bytes",
                  "quoted_printable_encoding.yaml": "[FILE] 8 lines",
                  "single_field.http": "[BINARY] 149 bytes",
                  "single_field.yaml": "[FILE] 7 lines",
                  "single_field_blocks.http": "[BINARY] 115 bytes",
                  "single_field_blocks.yaml": "[FILE] 7 lines",
                  "single_field_longer.http": "[BINARY] 262 bytes",
                  "single_field_longer.yaml": "[FILE] 7 lines",
                  "single_field_single_file.http": "[BINARY] 192 bytes",
                  "single_field_single_file.yaml": "[FILE] 14 lines",
                  "single_field_with_leading_newlines.http": "[BINARY] 153 bytes",
                  "single_field_with_leading_newlines.yaml": "[FILE] 7 lines",
                  "single_file.http": "[BINARY] 202 bytes",
                  "single_file.yaml": "[FILE] 9 lines",
                  "utf8_filename.http": "[BINARY] 208 bytes",
                  "utf8_filename.yaml": "[FILE] 9 lines"
                }
              },
              "test_multipart.py": "[FILE] 1306 lines"
            }
          },
          "networkx": {
            "__init__.py": "[FILE] 50 lines",
            "algorithms": {
              "__init__.py": "[FILE] 133 lines",
              "approximation": {
                "__init__.py": "[FILE] 25 lines",
                "clique.py": "[FILE] 259 lines",
                "clustering_coefficient.py": "[FILE] 67 lines",
                "connectivity.py": "[FILE] 413 lines",
                "dominating_set.py": "[FILE] 127 lines",
                "kcomponents.py": "[FILE] 370 lines",
                "matching.py": "[FILE] 44 lines",
                "maxcut.py": "[FILE] 114 lines",
                "ramsey.py": "[FILE] 53 lines",
                "steinertree.py": "[FILE] 221 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_approx_clust_coeff.py": "[FILE] 42 lines",
                  "test_clique.py": "[FILE] 114 lines",
                  "test_connectivity.py": "[FILE] 200 lines",
                  "test_distance_measures.py": "[FILE] 61 lines",
                  "test_dominating_set.py": "[FILE] 79 lines",
                  "test_kcomponents.py": "[FILE] 304 lines",
                  "test_matching.py": "[FILE] 9 lines",
                  "test_maxcut.py": "[FILE] 83 lines",
                  "test_ramsey.py": "[FILE] 32 lines",
                  "test_steinertree.py": "[FILE] 192 lines",
                  "test_traveling_salesman.py": "[FILE] 964 lines",
                  "test_treewidth.py": "[FILE] 281 lines",
                  "test_vertex_cover.py": "[FILE] 69 lines"
                },
                "traveling_salesman.py": "[FILE] 1443 lines",
                "treewidth.py": "[FILE] 253 lines",
                "vertex_cover.py": "[FILE] 83 lines"
              },
              "assortativity": {
                "__init__.py": "[FILE] 6 lines",
                "connectivity.py": "[FILE] 123 lines",
                "correlation.py": "[FILE] 303 lines",
                "mixing.py": "[FILE] 251 lines",
                "neighbor_degree.py": "[FILE] 161 lines",
                "pairs.py": "[FILE] 119 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "base_test.py": "[FILE] 82 lines",
                  "test_connectivity.py": "[FILE] 144 lines",
                  "test_correlation.py": "[FILE] 124 lines",
                  "test_mixing.py": "[FILE] 177 lines",
                  "test_neighbor_degree.py": "[FILE] 109 lines",
                  "test_pairs.py": "[FILE] 88 lines"
                }
              },
              "asteroidal.py": "[FILE] 171 lines",
              "bipartite": {
                "__init__.py": "[FILE] 88 lines",
                "basic.py": "[FILE] 322 lines",
                "centrality.py": "[FILE] 291 lines",
                "cluster.py": "[FILE] 281 lines",
                "covering.py": "[FILE] 58 lines",
                "edgelist.py": "[FILE] 360 lines",
                "extendability.py": "[FILE] 106 lines",
                "generators.py": "[FILE] 604 lines",
                "matching.py": "[FILE] 590 lines",
                "matrix.py": "[FILE] 168 lines",
                "projection.py": "[FILE] 529 lines",
                "redundancy.py": "[FILE] 112 lines",
                "spectral.py": "[FILE] 69 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_basic.py": "[FILE] 126 lines",
                  "test_centrality.py": "[FILE] 193 lines",
                  "test_cluster.py": "[FILE] 85 lines",
                  "test_covering.py": "[FILE] 34 lines",
                  "test_edgelist.py": "[FILE] 230 lines",
                  "test_extendability.py": "[FILE] 327 lines",
                  "test_generators.py": "[FILE] 401 lines",
                  "test_matching.py": "[FILE] 327 lines",
                  "test_matrix.py": "[FILE] 80 lines",
                  "test_project.py": "[FILE] 408 lines",
                  "test_redundancy.py": "[FILE] 38 lines",
                  "test_spectral_bipartivity.py": "[FILE] 81 lines"
                }
              },
              "boundary.py": "[FILE] 168 lines",
              "bridges.py": "[FILE] 206 lines",
              "centrality": {
                "__init__.py": "[FILE] 21 lines",
                "betweenness.py": "[FILE] 436 lines",
                "betweenness_subset.py": "[FILE] 275 lines",
                "closeness.py": "[FILE] 282 lines",
                "current_flow_betweenness.py": "[FILE] 344 lines",
                "current_flow_betweenness_subset.py": "[FILE] 227 lines",
                "current_flow_closeness.py": "[FILE] 98 lines",
                "degree_alg.py": "[FILE] 150 lines",
                "dispersion.py": "[FILE] 108 lines",
                "eigenvector.py": "[FILE] 342 lines",
                "flow_matrix.py": "[FILE] 131 lines",
                "group.py": "[FILE] 786 lines",
                "harmonic.py": "[FILE] 81 lines",
                "katz.py": "[FILE] 332 lines",
                "laplacian.py": "[FILE] 147 lines",
                "load.py": "[FILE] 200 lines",
                "percolation.py": "[FILE] 129 lines",
                "reaching.py": "[FILE] 207 lines",
                "second_order.py": "[FILE] 139 lines",
                "subgraph_alg.py": "[FILE] 341 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_betweenness_centrality.py": "[FILE] 781 lines",
                  "test_betweenness_centrality_subset.py": "[FILE] 341 lines",
                  "test_closeness_centrality.py": "[FILE] 307 lines",
                  "test_current_flow_betweenness_centrality.py": "[FILE] 198 lines",
                  "test_current_flow_betweenness_centrality_subset.py": "[FILE] 148 lines",
                  "test_current_flow_closeness.py": "[FILE] 44 lines",
                  "test_degree_centrality.py": "[FILE] 145 lines",
                  "test_dispersion.py": "[FILE] 74 lines",
                  "test_eigenvector_centrality.py": "[FILE] 176 lines",
                  "test_group.py": "[FILE] 279 lines",
                  "test_harmonic_centrality.py": "[FILE] 116 lines",
                  "test_katz_centrality.py": "[FILE] 346 lines",
                  "test_laplacian_centrality.py": "[FILE] 222 lines",
                  "test_load_centrality.py": "[FILE] 345 lines",
                  "test_percolation_centrality.py": "[FILE] 88 lines",
                  "test_reaching.py": "[FILE] 118 lines",
                  "test_second_order_centrality.py": "[FILE] 83 lines",
                  "test_subgraph.py": "[FILE] 111 lines",
                  "test_trophic.py": "[FILE] 303 lines",
                  "test_voterank.py": "[FILE] 66 lines"
                },
                "trophic.py": "[FILE] 163 lines",
                "voterank_alg.py": "[FILE] 95 lines"
              },
              "chains.py": "[FILE] 173 lines",
              "chordal.py": "[FILE] 441 lines",
              "clique.py": "[FILE] 754 lines",
              "cluster.py": "[FILE] 606 lines",
              "coloring": {
                "__init__.py": "[FILE] 5 lines",
                "equitable_coloring.py": "[FILE] 506 lines",
                "greedy_coloring.py": "[FILE] 573 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_coloring.py": "[FILE] 866 lines"
                }
              },
              "communicability_alg.py": "[FILE] 163 lines",
              "community": {
                "__init__.py": "[FILE] 25 lines",
                "asyn_fluid.py": "[FILE] 151 lines",
                "centrality.py": "[FILE] 172 lines",
                "community_utils.py": "[FILE] 30 lines",
                "kclique.py": "[FILE] 80 lines",
                "kernighan_lin.py": "[FILE] 140 lines",
                "label_propagation.py": "[FILE] 338 lines",
                "louvain.py": "[FILE] 374 lines",
                "lukes.py": "[FILE] 227 lines",
                "modularity_max.py": "[FILE] 449 lines",
                "quality.py": "[FILE] 347 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_asyn_fluid.py": "[FILE] 130 lines",
                  "test_centrality.py": "[FILE] 85 lines",
                  "test_kclique.py": "[FILE] 92 lines",
                  "test_kernighan_lin.py": "[FILE] 92 lines",
                  "test_label_propagation.py": "[FILE] 241 lines",
                  "test_louvain.py": "[FILE] 245 lines",
                  "test_lukes.py": "[FILE] 153 lines",
                  "test_modularity_max.py": "[FILE] 334 lines",
                  "test_quality.py": "[FILE] 139 lines",
                  "test_utils.py": "[FILE] 29 lines"
                }
              },
              "components": {
                "__init__.py": "[FILE] 7 lines",
                "attracting.py": "[FILE] 115 lines",
                "biconnected.py": "[FILE] 394 lines",
                "connected.py": "[FILE] 209 lines",
                "semiconnected.py": "[FILE] 71 lines",
                "strongly_connected.py": "[FILE] 432 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_attracting.py": "[FILE] 71 lines",
                  "test_biconnected.py": "[FILE] 249 lines",
                  "test_connected.py": "[FILE] 118 lines",
                  "test_semiconnected.py": "[FILE] 56 lines",
                  "test_strongly_connected.py": "[FILE] 208 lines",
                  "test_weakly_connected.py": "[FILE] 91 lines"
                },
                "weakly_connected.py": "[FILE] 197 lines"
              },
              "connectivity": {
                "__init__.py": "[FILE] 12 lines",
                "connectivity.py": "[FILE] 827 lines",
                "cuts.py": "[FILE] 616 lines",
                "disjoint_paths.py": "[FILE] 413 lines",
                "edge_augmentation.py": "[FILE] 1270 lines",
                "edge_kcomponents.py": "[FILE] 585 lines",
                "kcomponents.py": "[FILE] 223 lines",
                "kcutsets.py": "[FILE] 234 lines",
                "stoerwagner.py": "[FILE] 151 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_connectivity.py": "[FILE] 422 lines",
                  "test_cuts.py": "[FILE] 310 lines",
                  "test_disjoint_paths.py": "[FILE] 250 lines",
                  "test_edge_augmentation.py": "[FILE] 503 lines",
                  "test_edge_kcomponents.py": "[FILE] 489 lines",
                  "test_kcomponents.py": "[FILE] 297 lines",
                  "test_kcutsets.py": "[FILE] 267 lines",
                  "test_stoer_wagner.py": "[FILE] 103 lines"
                },
                "utils.py": "[FILE] 88 lines"
              },
              "core.py": "[FILE] 546 lines",
              "covering.py": "[FILE] 143 lines",
              "cuts.py": "[FILE] 401 lines",
              "cycles.py": "[FILE] 1231 lines",
              "d_separation.py": "[FILE] 458 lines",
              "dag.py": "[FILE] 1259 lines",
              "dominance.py": "[FILE] 136 lines",
              "dominating.py": "[FILE] 95 lines",
              "efficiency_measures.py": "[FILE] 169 lines",
              "euler.py": "[FILE] 470 lines",
              "flow": {
                "__init__.py": "[FILE] 12 lines",
                "boykovkolmogorov.py": "[FILE] 374 lines",
                "capacityscaling.py": "[FILE] 406 lines",
                "dinitz_alg.py": "[FILE] 218 lines",
                "edmondskarp.py": "[FILE] 251 lines",
                "gomory_hu.py": "[FILE] 178 lines",
                "maxflow.py": "[FILE] 608 lines",
                "mincost.py": "[FILE] 336 lines",
                "networksimplex.py": "[FILE] 665 lines",
                "preflowpush.py": "[FILE] 430 lines",
                "shortestaugmentingpath.py": "[FILE] 305 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "gl1.gpickle.bz2": "[BINARY] 44623 bytes",
                  "gw1.gpickle.bz2": "[BINARY] 42248 bytes",
                  "netgen-2.gpickle.bz2": "[BINARY] 18972 bytes",
                  "test_gomory_hu.py": "[FILE] 129 lines",
                  "test_maxflow.py": "[FILE] 561 lines",
                  "test_maxflow_large_graph.py": "[FILE] 158 lines",
                  "test_mincost.py": "[FILE] 477 lines",
                  "test_networksimplex.py": "[FILE] 388 lines",
                  "wlm3.gpickle.bz2": "[BINARY] 88132 bytes"
                },
                "utils.py": "[FILE] 189 lines"
              },
              "graph_hashing.py": "[FILE] 314 lines",
              "graphical.py": "[FILE] 484 lines",
              "hierarchy.py": "[FILE] 49 lines",
              "hybrid.py": "[FILE] 196 lines",
              "isolate.py": "[FILE] 108 lines",
              "isomorphism": {
                "__init__.py": "[FILE] 8 lines",
                "ismags.py": "[FILE] 1170 lines",
                "isomorph.py": "[FILE] 249 lines",
                "isomorphvf2.py": "[FILE] 1061 lines",
                "matchhelpers.py": "[FILE] 353 lines",
                "temporalisomorphvf2.py": "[FILE] 309 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "iso_r01_s80.A99": "[BINARY] 1442 bytes",
                  "iso_r01_s80.B99": "[BINARY] 1442 bytes",
                  "si2_b06_m200.A99": "[BINARY] 310 bytes",
                  "si2_b06_m200.B99": "[BINARY] 1602 bytes",
                  "test_ismags.py": "[FILE] 328 lines",
                  "test_isomorphism.py": "[FILE] 41 lines",
                  "test_isomorphvf2.py": "[FILE] 411 lines",
                  "test_match_helpers.py": "[FILE] 65 lines",
                  "test_temporalisomorphvf2.py": "[FILE] 212 lines",
                  "test_tree_isomorphism.py": "[FILE] 283 lines",
                  "test_vf2pp.py": "[FILE] 1609 lines",
                  "test_vf2pp_helpers.py": "[FILE] 3104 lines",
                  "test_vf2userfunc.py": "[FILE] 201 lines"
                },
                "tree_isomorphism.py": "[FILE] 284 lines",
                "vf2pp.py": "[FILE] 1069 lines",
                "vf2userfunc.py": "[FILE] 193 lines"
              },
              "link_analysis": {
                "__init__.py": "[FILE] 3 lines",
                "hits_alg.py": "[FILE] 335 lines",
                "pagerank_alg.py": "[FILE] 500 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_hits.py": "[FILE] 79 lines",
                  "test_pagerank.py": "[FILE] 218 lines"
                }
              },
              "link_prediction.py": "[FILE] 605 lines",
              "lowest_common_ancestors.py": "[FILE] 269 lines",
              "matching.py": "[FILE] 1152 lines",
              "minors": {
                "__init__.py": "[FILE] 28 lines",
                "contraction.py": "[FILE] 631 lines",
                "tests": {
                  "test_contraction.py": "[FILE] 446 lines"
                }
              },
              "mis.py": "[FILE] 78 lines",
              "moral.py": "[FILE] 60 lines",
              "node_classification.py": "[FILE] 219 lines",
              "non_randomness.py": "[FILE] 97 lines",
              "operators": {
                "__init__.py": "[FILE] 5 lines",
                "all.py": "[FILE] 320 lines",
                "binary.py": "[FILE] 445 lines",
                "product.py": "[FILE] 535 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_all.py": "[FILE] 329 lines",
                  "test_binary.py": "[FILE] 469 lines",
                  "test_product.py": "[FILE] 436 lines",
                  "test_unary.py": "[FILE] 56 lines"
                },
                "unary.py": "[FILE] 77 lines"
              },
              "planar_drawing.py": "[FILE] 465 lines",
              "planarity.py": "[FILE] 1180 lines",
              "polynomials.py": "[FILE] 306 lines",
              "reciprocity.py": "[FILE] 98 lines",
              "regular.py": "[FILE] 213 lines",
              "richclub.py": "[FILE] 122 lines",
              "shortest_paths": {
                "__init__.py": "[FILE] 6 lines",
                "astar.py": "[FILE] 215 lines",
                "dense.py": "[FILE] 257 lines",
                "generic.py": "[FILE] 720 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_astar.py": "[FILE] 211 lines",
                  "test_dense.py": "[FILE] 213 lines",
                  "test_dense_numpy.py": "[FILE] 90 lines",
                  "test_generic.py": "[FILE] 445 lines",
                  "test_unweighted.py": "[FILE] 150 lines",
                  "test_weighted.py": "[FILE] 973 lines"
                },
                "unweighted.py": "[FILE] 571 lines",
                "weighted.py": "[FILE] 2515 lines"
              },
              "similarity.py": "[FILE] 1711 lines",
              "simple_paths.py": "[FILE] 979 lines",
              "smallworld.py": "[FILE] 404 lines",
              "smetric.py": "[FILE] 61 lines",
              "sparsifiers.py": "[FILE] 296 lines",
              "structuralholes.py": "[FILE] 284 lines",
              "summarization.py": "[FILE] 562 lines",
              "swap.py": "[FILE] 406 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_asteroidal.py": "[FILE] 24 lines",
                "test_boundary.py": "[FILE] 155 lines",
                "test_bridges.py": "[FILE] 145 lines",
                "test_chains.py": "[FILE] 141 lines",
                "test_chordal.py": "[FILE] 130 lines",
                "test_clique.py": "[FILE] 292 lines",
                "test_cluster.py": "[FILE] 544 lines",
                "test_communicability.py": "[FILE] 81 lines",
                "test_core.py": "[FILE] 186 lines",
                "test_covering.py": "[FILE] 86 lines",
                "test_cuts.py": "[FILE] 173 lines",
                "test_cycles.py": "[FILE] 972 lines",
                "test_d_separation.py": "[FILE] 229 lines",
                "test_dag.py": "[FILE] 772 lines",
                "test_distance_measures.py": "[FILE] 669 lines",
                "test_distance_regular.py": "[FILE] 67 lines",
                "test_dominance.py": "[FILE] 286 lines",
                "test_dominating.py": "[FILE] 47 lines",
                "test_efficiency.py": "[FILE] 59 lines",
                "test_euler.py": "[FILE] 308 lines",
                "test_graph_hashing.py": "[FILE] 658 lines",
                "test_graphical.py": "[FILE] 164 lines",
                "test_hierarchy.py": "[FILE] 40 lines",
                "test_hybrid.py": "[FILE] 25 lines",
                "test_isolate.py": "[FILE] 27 lines",
                "test_link_prediction.py": "[FILE] 583 lines",
                "test_lowest_common_ancestors.py": "[FILE] 428 lines",
                "test_matching.py": "[FILE] 606 lines",
                "test_max_weight_clique.py": "[FILE] 182 lines",
                "test_mis.py": "[FILE] 63 lines",
                "test_moral.py": "[FILE] 16 lines",
                "test_node_classification.py": "[FILE] 141 lines",
                "test_non_randomness.py": "[FILE] 38 lines",
                "test_planar_drawing.py": "[FILE] 275 lines",
                "test_planarity.py": "[FILE] 443 lines",
                "test_polynomials.py": "[FILE] 58 lines",
                "test_reciprocity.py": "[FILE] 38 lines",
                "test_regular.py": "[FILE] 87 lines",
                "test_richclub.py": "[FILE] 98 lines",
                "test_similarity.py": "[FILE] 924 lines",
                "test_simple_paths.py": "[FILE] 770 lines",
                "test_smallworld.py": "[FILE] 79 lines",
                "test_smetric.py": "[FILE] 37 lines",
                "test_sparsifiers.py": "[FILE] 138 lines",
                "test_structuralholes.py": "[FILE] 140 lines",
                "test_summarization.py": "[FILE] 642 lines",
                "test_swap.py": "[FILE] 157 lines",
                "test_threshold.py": "[FILE] 270 lines",
                "test_time_dependent.py": "[FILE] 432 lines",
                "test_tournament.py": "[FILE] 163 lines",
                "test_triads.py": "[FILE] 278 lines",
                "test_vitality.py": "[FILE] 42 lines",
                "test_voronoi.py": "[FILE] 104 lines",
                "test_walks.py": "[FILE] 55 lines",
                "test_wiener.py": "[FILE] 67 lines"
              },
              "threshold.py": "[FILE] 980 lines",
              "time_dependent.py": "[FILE] 143 lines",
              "tournament.py": "[FILE] 407 lines",
              "traversal": {
                "__init__.py": "[FILE] 6 lines",
                "beamsearch.py": "[FILE] 107 lines",
                "breadth_first_search.py": "[FILE] 582 lines",
                "depth_first_search.py": "[FILE] 470 lines",
                "edgebfs.py": "[FILE] 178 lines",
                "edgedfs.py": "[FILE] 176 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_beamsearch.py": "[FILE] 33 lines",
                  "test_bfs.py": "[FILE] 213 lines",
                  "test_dfs.py": "[FILE] 252 lines",
                  "test_edgebfs.py": "[FILE] 148 lines",
                  "test_edgedfs.py": "[FILE] 132 lines"
                }
              },
              "tree": {
                "__init__.py": "[FILE] 7 lines",
                "branchings.py": "[FILE] 1601 lines",
                "coding.py": "[FILE] 413 lines",
                "decomposition.py": "[FILE] 89 lines",
                "mst.py": "[FILE] 1134 lines",
                "operations.py": "[FILE] 129 lines",
                "recognition.py": "[FILE] 274 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_branchings.py": "[FILE] 633 lines",
                  "test_coding.py": "[FILE] 114 lines",
                  "test_decomposition.py": "[FILE] 80 lines",
                  "test_mst.py": "[FILE] 709 lines",
                  "test_operations.py": "[FILE] 54 lines",
                  "test_recognition.py": "[FILE] 163 lines"
                }
              },
              "triads.py": "[FILE] 566 lines",
              "vitality.py": "[FILE] 77 lines",
              "voronoi.py": "[FILE] 86 lines",
              "walks.py": "[FILE] 81 lines",
              "wiener.py": "[FILE] 80 lines"
            },
            "classes": {
              "__init__.py": "[FILE] 14 lines",
              "coreviews.py": "[FILE] 368 lines",
              "digraph.py": "[FILE] 1324 lines",
              "filters.py": "[FILE] 76 lines",
              "function.py": "[FILE] 1314 lines",
              "graph.py": "[FILE] 2031 lines",
              "graphviews.py": "[FILE] 268 lines",
              "multidigraph.py": "[FILE] 964 lines",
              "multigraph.py": "[FILE] 1279 lines",
              "reportviews.py": "[FILE] 1432 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "dispatch_interface.py": "[FILE] 195 lines",
                "historical_tests.py": "[FILE] 475 lines",
                "test_backends.py": "[FILE] 77 lines",
                "test_coreviews.py": "[FILE] 363 lines",
                "test_digraph.py": "[FILE] 332 lines",
                "test_digraph_historical.py": "[FILE] 111 lines",
                "test_filters.py": "[FILE] 178 lines",
                "test_function.py": "[FILE] 783 lines",
                "test_graph.py": "[FILE] 921 lines",
                "test_graph_historical.py": "[FILE] 13 lines",
                "test_graphviews.py": "[FILE] 351 lines",
                "test_multidigraph.py": "[FILE] 460 lines",
                "test_multigraph.py": "[FILE] 529 lines",
                "test_reportviews.py": "[FILE] 1424 lines",
                "test_special.py": "[FILE] 132 lines",
                "test_subgraphviews.py": "[FILE] 363 lines"
              }
            },
            "conftest.py": "[FILE] 266 lines",
            "convert.py": "[FILE] 497 lines",
            "convert_matrix.py": "[FILE] 1201 lines",
            "drawing": {
              "__init__.py": "[FILE] 8 lines",
              "layout.py": "[FILE] 1298 lines",
              "nx_agraph.py": "[FILE] 470 lines",
              "nx_latex.py": "[FILE] 572 lines",
              "nx_pydot.py": "[FILE] 455 lines",
              "nx_pylab.py": "[FILE] 1595 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "baseline": {
                  "test_house_with_colors.png": "[BINARY] 21918 bytes"
                },
                "test_agraph.py": "[FILE] 255 lines",
                "test_latex.py": "[FILE] 293 lines",
                "test_layout.py": "[FILE] 470 lines",
                "test_pydot.py": "[FILE] 191 lines",
                "test_pylab.py": "[FILE] 792 lines"
              }
            },
            "exception.py": "[FILE] 126 lines",
            "generators": {
              "__init__.py": "[FILE] 33 lines",
              "atlas.dat.gz": "[BINARY] 8887 bytes",
              "atlas.py": "[FILE] 180 lines",
              "classic.py": "[FILE] 923 lines",
              "cographs.py": "[FILE] 68 lines",
              "community.py": "[FILE] 1072 lines",
              "degree_seq.py": "[FILE] 869 lines",
              "directed.py": "[FILE] 502 lines",
              "duplication.py": "[FILE] 164 lines",
              "ego.py": "[FILE] 66 lines",
              "expanders.py": "[FILE] 207 lines",
              "geometric.py": "[FILE] 847 lines",
              "harary_graph.py": "[FILE] 200 lines",
              "internet_as_graphs.py": "[FILE] 442 lines",
              "intersection.py": "[FILE] 125 lines",
              "interval_graph.py": "[FILE] 72 lines",
              "joint_degree_seq.py": "[FILE] 665 lines",
              "lattice.py": "[FILE] 368 lines",
              "line.py": "[FILE] 500 lines",
              "mycielski.py": "[FILE] 111 lines",
              "nonisomorphic_trees.py": "[FILE] 193 lines",
              "random_clustered.py": "[FILE] 118 lines",
              "random_graphs.py": "[FILE] 1332 lines",
              "small.py": "[FILE] 979 lines",
              "social.py": "[FILE] 547 lines",
              "spectral_graph_forge.py": "[FILE] 122 lines",
              "stochastic.py": "[FILE] 52 lines",
              "sudoku.py": "[FILE] 132 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_atlas.py": "[FILE] 76 lines",
                "test_classic.py": "[FILE] 623 lines",
                "test_cographs.py": "[FILE] 21 lines",
                "test_community.py": "[FILE] 363 lines",
                "test_degree_seq.py": "[FILE] 231 lines",
                "test_directed.py": "[FILE] 163 lines",
                "test_duplication.py": "[FILE] 74 lines",
                "test_ego.py": "[FILE] 40 lines",
                "test_expanders.py": "[FILE] 87 lines",
                "test_geometric.py": "[FILE] 336 lines",
                "test_harary_graph.py": "[FILE] 135 lines",
                "test_internet_as_graphs.py": "[FILE] 177 lines",
                "test_intersection.py": "[FILE] 29 lines",
                "test_interval_graph.py": "[FILE] 146 lines",
                "test_joint_degree_seq.py": "[FILE] 126 lines",
                "test_lattice.py": "[FILE] 247 lines",
                "test_line.py": "[FILE] 310 lines",
                "test_mycielski.py": "[FILE] 27 lines",
                "test_nonisomorphic_trees.py": "[FILE] 65 lines",
                "test_random_clustered.py": "[FILE] 35 lines",
                "test_random_graphs.py": "[FILE] 349 lines",
                "test_small.py": "[FILE] 206 lines",
                "test_spectral_graph_forge.py": "[FILE] 50 lines",
                "test_stochastic.py": "[FILE] 72 lines",
                "test_sudoku.py": "[FILE] 93 lines",
                "test_time_series.py": "[FILE] 64 lines",
                "test_trees.py": "[FILE] 218 lines",
                "test_triads.py": "[FILE] 15 lines"
              },
              "time_series.py": "[FILE] 74 lines",
              "trees.py": "[FILE] 1157 lines",
              "triads.py": "[FILE] 78 lines"
            },
            "lazy_imports.py": "[FILE] 191 lines",
            "linalg": {
              "__init__.py": "[FILE] 14 lines",
              "algebraicconnectivity.py": "[FILE] 657 lines",
              "attrmatrix.py": "[FILE] 465 lines",
              "bethehessianmatrix.py": "[FILE] 79 lines",
              "graphmatrix.py": "[FILE] 167 lines",
              "laplacianmatrix.py": "[FILE] 429 lines",
              "modularitymatrix.py": "[FILE] 167 lines",
              "spectrum.py": "[FILE] 186 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_algebraic_connectivity.py": "[FILE] 403 lines",
                "test_attrmatrix.py": "[FILE] 109 lines",
                "test_bethehessian.py": "[FILE] 42 lines",
                "test_graphmatrix.py": "[FILE] 277 lines",
                "test_laplacian.py": "[FILE] 243 lines",
                "test_modularity.py": "[FILE] 88 lines",
                "test_spectrum.py": "[FILE] 72 lines"
              }
            },
            "readwrite": {
              "__init__.py": "[FILE] 19 lines",
              "adjlist.py": "[FILE] 311 lines",
              "edgelist.py": "[FILE] 490 lines",
              "gexf.py": "[FILE] 1066 lines",
              "gml.py": "[FILE] 879 lines",
              "graph6.py": "[FILE] 417 lines",
              "graphml.py": "[FILE] 1052 lines",
              "json_graph": {
                "__init__.py": "[FILE] 19 lines",
                "adjacency.py": "[FILE] 157 lines",
                "cytoscape.py": "[FILE] 175 lines",
                "node_link.py": "[FILE] 245 lines",
                "tests": {
                  "__init__.py": "[FILE] 1 lines",
                  "test_adjacency.py": "[FILE] 79 lines",
                  "test_cytoscape.py": "[FILE] 79 lines",
                  "test_node_link.py": "[FILE] 145 lines",
                  "test_tree.py": "[FILE] 49 lines"
                },
                "tree.py": "[FILE] 138 lines"
              },
              "leda.py": "[FILE] 109 lines",
              "multiline_adjlist.py": "[FILE] 394 lines",
              "p2g.py": "[FILE] 105 lines",
              "pajek.py": "[FILE] 287 lines",
              "sparse6.py": "[FILE] 377 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test_adjlist.py": "[FILE] 269 lines",
                "test_edgelist.py": "[FILE] 315 lines",
                "test_gexf.py": "[FILE] 558 lines",
                "test_gml.py": "[FILE] 754 lines",
                "test_graph6.py": "[FILE] 170 lines",
                "test_graphml.py": "[FILE] 1530 lines",
                "test_leda.py": "[FILE] 31 lines",
                "test_p2g.py": "[FILE] 63 lines",
                "test_pajek.py": "[FILE] 131 lines",
                "test_sparse6.py": "[FILE] 174 lines",
                "test_text.py": "[FILE] 1810 lines"
              },
              "text.py": "[FILE] 951 lines"
            },
            "relabel.py": "[FILE] 286 lines",
            "tests": {
              "__init__.py": "[FILE] 1 lines",
              "test_all_random_functions.py": "[FILE] 248 lines",
              "test_convert.py": "[FILE] 322 lines",
              "test_convert_numpy.py": "[FILE] 396 lines",
              "test_convert_pandas.py": "[FILE] 321 lines",
              "test_convert_scipy.py": "[FILE] 283 lines",
              "test_exceptions.py": "[FILE] 41 lines",
              "test_import.py": "[FILE] 12 lines",
              "test_lazy_imports.py": "[FILE] 98 lines",
              "test_relabel.py": "[FILE] 348 lines"
            },
            "utils": {
              "__init__.py": "[FILE] 7 lines",
              "backends.py": "[FILE] 976 lines",
              "decorators.py": "[FILE] 1271 lines",
              "heaps.py": "[FILE] 341 lines",
              "mapped_queue.py": "[FILE] 299 lines",
              "misc.py": "[FILE] 492 lines",
              "random_sequence.py": "[FILE] 165 lines",
              "rcm.py": "[FILE] 159 lines",
              "tests": {
                "__init__.py": "[FILE] 1 lines",
                "test__init.py": "[FILE] 12 lines",
                "test_decorators.py": "[FILE] 492 lines",
                "test_heaps.py": "[FILE] 132 lines",
                "test_mapped_queue.py": "[FILE] 269 lines",
                "test_misc.py": "[FILE] 256 lines",
                "test_random_sequence.py": "[FILE] 39 lines",
                "test_rcm.py": "[FILE] 64 lines",
                "test_unionfind.py": "[FILE] 56 lines"
              },
              "union_find.py": "[FILE] 107 lines"
            }
          },
          "networkx-3.2.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE.txt": "[BINARY] 1763 bytes",
            "METADATA": "[BINARY] 5232 bytes",
            "RECORD": "[BINARY] 98361 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 87 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "packaging": {
            "__init__.py": "[FILE] 16 lines",
            "_elffile.py": "[FILE] 109 lines",
            "_manylinux.py": "[FILE] 263 lines",
            "_musllinux.py": "[FILE] 86 lines",
            "_parser.py": "[FILE] 366 lines",
            "_structures.py": "[FILE] 70 lines",
            "_tokenizer.py": "[FILE] 194 lines",
            "licenses": {
              "__init__.py": "[FILE] 148 lines",
              "_spdx.py": "[FILE] 800 lines"
            },
            "markers.py": "[FILE] 389 lines",
            "metadata.py": "[FILE] 979 lines",
            "py.typed": "[BINARY] 0 bytes",
            "pylock.py": "[FILE] 636 lines",
            "requirements.py": "[FILE] 87 lines",
            "specifiers.py": "[FILE] 1069 lines",
            "tags.py": "[FILE] 652 lines",
            "utils.py": "[FILE] 159 lines",
            "version.py": "[FILE] 793 lines"
          },
          "packaging-26.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3309 bytes",
            "RECORD": "[BINARY] 2918 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 197 bytes",
              "LICENSE.APACHE": "[BINARY] 10174 bytes",
              "LICENSE.BSD": "[BINARY] 1344 bytes"
            }
          },
          "passlib": {
            "__init__.py": "[FILE] 4 lines",
            "_data": {
              "wordsets": {
                "bip39.txt": "[BINARY] 13117 bytes",
                "eff_long.txt": "[BINARY] 62144 bytes",
                "eff_prefixed.txt": "[BINARY] 10778 bytes",
                "eff_short.txt": "[BINARY] 7180 bytes"
              }
            },
            "apache.py": "[FILE] 1256 lines",
            "apps.py": "[FILE] 246 lines",
            "context.py": "[FILE] 2638 lines",
            "crypto": {
              "__init__.py": "[FILE] 2 lines",
              "_blowfish": {
                "__init__.py": "[FILE] 170 lines",
                "_gen_files.py": "[FILE] 205 lines",
                "base.py": "[FILE] 442 lines",
                "unrolled.py": "[FILE] 772 lines"
              },
              "_md4.py": "[FILE] 245 lines",
              "des.py": "[FILE] 849 lines",
              "digest.py": "[FILE] 1058 lines",
              "scrypt": {
                "__init__.py": "[FILE] 282 lines",
                "_builtin.py": "[FILE] 245 lines",
                "_gen_files.py": "[FILE] 155 lines",
                "_salsa.py": "[FILE] 171 lines"
              }
            },
            "exc.py": "[FILE] 398 lines",
            "ext": {
              "__init__.py": "[FILE] 2 lines",
              "django": {
                "__init__.py": "[FILE] 7 lines",
                "models.py": "[FILE] 37 lines",
                "utils.py": "[FILE] 1277 lines"
              }
            },
            "handlers": {
              "__init__.py": "[FILE] 2 lines",
              "argon2.py": "[FILE] 1010 lines",
              "bcrypt.py": "[FILE] 1244 lines",
              "cisco.py": "[FILE] 441 lines",
              "des_crypt.py": "[FILE] 608 lines",
              "digests.py": "[FILE] 169 lines",
              "django.py": "[FILE] 513 lines",
              "fshp.py": "[FILE] 215 lines",
              "ldap_digests.py": "[FILE] 360 lines",
              "md5_crypt.py": "[FILE] 347 lines",
              "misc.py": "[FILE] 270 lines",
              "mssql.py": "[FILE] 245 lines",
              "mysql.py": "[FILE] 129 lines",
              "oracle.py": "[FILE] 173 lines",
              "pbkdf2.py": "[FILE] 476 lines",
              "phpass.py": "[FILE] 136 lines",
              "postgres.py": "[FILE] 56 lines",
              "roundup.py": "[FILE] 30 lines",
              "scram.py": "[FILE] 583 lines",
              "scrypt.py": "[FILE] 384 lines",
              "sha1_crypt.py": "[FILE] 159 lines",
              "sha2_crypt.py": "[FILE] 535 lines",
              "sun_md5_crypt.py": "[FILE] 364 lines",
              "windows.py": "[FILE] 335 lines"
            },
            "hash.py": "[FILE] 69 lines",
            "hosts.py": "[FILE] 107 lines",
            "ifc.py": "[FILE] 354 lines",
            "pwd.py": "[FILE] 810 lines",
            "registry.py": "[FILE] 548 lines",
            "tests": {
              "__init__.py": "[FILE] 2 lines",
              "__main__.py": "[FILE] 7 lines",
              "_test_bad_register.py": "[FILE] 16 lines",
              "backports.py": "[FILE] 68 lines",
              "sample1.cfg": "[BINARY] 243 bytes",
              "sample1b.cfg": "[BINARY] 252 bytes",
              "sample1c.cfg": "[BINARY] 490 bytes",
              "sample_config_1s.cfg": "[BINARY] 238 bytes",
              "test_apache.py": "[FILE] 770 lines",
              "test_apps.py": "[FILE] 140 lines",
              "test_context.py": "[FILE] 1787 lines",
              "test_context_deprecated.py": "[FILE] 744 lines",
              "test_crypto_builtin_md4.py": "[FILE] 161 lines",
              "test_crypto_des.py": "[FILE] 195 lines",
              "test_crypto_digest.py": "[FILE] 545 lines",
              "test_crypto_scrypt.py": "[FILE] 635 lines",
              "test_ext_django.py": "[FILE] 1081 lines",
              "test_ext_django_source.py": "[FILE] 251 lines",
              "test_handlers.py": "[FILE] 1820 lines",
              "test_handlers_argon2.py": "[FILE] 508 lines",
              "test_handlers_bcrypt.py": "[FILE] 689 lines",
              "test_handlers_cisco.py": "[FILE] 458 lines",
              "test_handlers_django.py": "[FILE] 414 lines",
              "test_handlers_pbkdf2.py": "[FILE] 481 lines",
              "test_handlers_scrypt.py": "[FILE] 112 lines",
              "test_hosts.py": "[FILE] 98 lines",
              "test_pwd.py": "[FILE] 206 lines",
              "test_registry.py": "[FILE] 229 lines",
              "test_totp.py": "[FILE] 1605 lines",
              "test_utils.py": "[FILE] 1172 lines",
              "test_utils_handlers.py": "[FILE] 871 lines",
              "test_utils_md4.py": "[FILE] 42 lines",
              "test_utils_pbkdf2.py": "[FILE] 324 lines",
              "test_win32.py": "[FILE] 51 lines",
              "tox_support.py": "[FILE] 84 lines",
              "utils.py": "[FILE] 3622 lines"
            },
            "totp.py": "[FILE] 1909 lines",
            "utils": {
              "__init__.py": "[FILE] 1221 lines",
              "binary.py": "[FILE] 885 lines",
              "compat": {
                "__init__.py": "[FILE] 475 lines",
                "_ordered_dict.py": "[FILE] 243 lines"
              },
              "decor.py": "[FILE] 234 lines",
              "des.py": "[FILE] 47 lines",
              "handlers.py": "[FILE] 2712 lines",
              "md4.py": "[FILE] 30 lines",
              "pbkdf2.py": "[FILE] 194 lines"
            },
            "win32.py": "[FILE] 69 lines"
          },
          "passlib-1.7.4.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 4954 bytes",
            "METADATA": "[BINARY] 1688 bytes",
            "RECORD": "[BINARY] 14607 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 8 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "pip": {
            "__init__.py": "[FILE] 14 lines",
            "__main__.py": "[FILE] 25 lines",
            "__pip-runner__.py": "[FILE] 51 lines",
            "_internal": {
              "__init__.py": "[FILE] 19 lines",
              "cache.py": "[FILE] 292 lines",
              "cli": {
                "__init__.py": "[FILE] 4 lines",
                "autocompletion.py": "[FILE] 185 lines",
                "base_command.py": "[FILE] 256 lines",
                "cmdoptions.py": "[FILE] 1268 lines",
                "command_context.py": "[FILE] 29 lines",
                "index_command.py": "[FILE] 196 lines",
                "main.py": "[FILE] 86 lines",
                "main_parser.py": "[FILE] 137 lines",
                "parser.py": "[FILE] 359 lines",
                "progress_bars.py": "[FILE] 154 lines",
                "req_command.py": "[FILE] 448 lines",
                "spinners.py": "[FILE] 236 lines",
                "status_codes.py": "[FILE] 7 lines"
              },
              "commands": {
                "__init__.py": "[FILE] 140 lines",
                "cache.py": "[FILE] 256 lines",
                "check.py": "[FILE] 67 lines",
                "completion.py": "[FILE] 137 lines",
                "configuration.py": "[FILE] 289 lines",
                "debug.py": "[FILE] 204 lines",
                "download.py": "[FILE] 147 lines",
                "freeze.py": "[FILE] 108 lines",
                "hash.py": "[FILE] 59 lines",
                "help.py": "[FILE] 41 lines",
                "index.py": "[FILE] 167 lines",
                "inspect.py": "[FILE] 93 lines",
                "install.py": "[FILE] 811 lines",
                "list.py": "[FILE] 399 lines",
                "lock.py": "[FILE] 176 lines",
                "search.py": "[FILE] 179 lines",
                "show.py": "[FILE] 232 lines",
                "uninstall.py": "[FILE] 114 lines",
                "wheel.py": "[FILE] 172 lines"
              },
              "configuration.py": "[FILE] 397 lines",
              "exceptions.py": "[FILE] 972 lines",
              "index": {
                "__init__.py": "[FILE] 2 lines",
                "collector.py": "[FILE] 489 lines",
                "package_finder.py": "[FILE] 1126 lines",
                "sources.py": "[FILE] 288 lines"
              },
              "locations": {
                "__init__.py": "[FILE] 441 lines",
                "_distutils.py": "[FILE] 174 lines",
                "_sysconfig.py": "[FILE] 219 lines",
                "base.py": "[FILE] 83 lines"
              },
              "main.py": "[FILE] 13 lines",
              "metadata": {
                "__init__.py": "[FILE] 170 lines",
                "_json.py": "[FILE] 88 lines",
                "base.py": "[FILE] 686 lines",
                "importlib": {
                  "__init__.py": "[FILE] 7 lines",
                  "_compat.py": "[FILE] 88 lines",
                  "_dists.py": "[FILE] 230 lines",
                  "_envs.py": "[FILE] 144 lines"
                },
                "pkg_resources.py": "[FILE] 299 lines"
              },
              "models": {
                "__init__.py": "[FILE] 2 lines",
                "candidate.py": "[FILE] 26 lines",
                "direct_url.py": "[FILE] 228 lines",
                "format_control.py": "[FILE] 79 lines",
                "index.py": "[FILE] 29 lines",
                "installation_report.py": "[FILE] 58 lines",
                "link.py": "[FILE] 618 lines",
                "release_control.py": "[FILE] 93 lines",
                "scheme.py": "[FILE] 26 lines",
                "search_scope.py": "[FILE] 127 lines",
                "selection_prefs.py": "[FILE] 57 lines",
                "target_python.py": "[FILE] 123 lines",
                "wheel.py": "[FILE] 81 lines"
              },
              "network": {
                "__init__.py": "[FILE] 2 lines",
                "auth.py": "[FILE] 569 lines",
                "cache.py": "[FILE] 129 lines",
                "download.py": "[FILE] 342 lines",
                "lazy_wheel.py": "[FILE] 216 lines",
                "session.py": "[FILE] 533 lines",
                "utils.py": "[FILE] 99 lines",
                "xmlrpc.py": "[FILE] 62 lines"
              },
              "operations": {
                "__init__.py": "[FILE] 1 lines",
                "check.py": "[FILE] 176 lines",
                "freeze.py": "[FILE] 260 lines",
                "install": {
                  "__init__.py": "[FILE] 2 lines",
                  "wheel.py": "[FILE] 746 lines"
                },
                "prepare.py": "[FILE] 748 lines"
              },
              "pyproject.py": "[FILE] 124 lines",
              "req": {
                "__init__.py": "[FILE] 104 lines",
                "constructors.py": "[FILE] 569 lines",
                "pep723.py": "[FILE] 42 lines",
                "req_dependency_group.py": "[FILE] 76 lines",
                "req_file.py": "[FILE] 632 lines",
                "req_install.py": "[FILE] 829 lines",
                "req_set.py": "[FILE] 82 lines",
                "req_uninstall.py": "[FILE] 640 lines"
              },
              "resolution": {
                "__init__.py": "[FILE] 1 lines",
                "base.py": "[FILE] 21 lines",
                "legacy": {
                  "__init__.py": "[FILE] 1 lines",
                  "resolver.py": "[FILE] 599 lines"
                },
                "resolvelib": {
                  "__init__.py": "[FILE] 1 lines",
                  "base.py": "[FILE] 143 lines",
                  "candidates.py": "[FILE] 592 lines",
                  "factory.py": "[FILE] 857 lines",
                  "found_candidates.py": "[FILE] 167 lines",
                  "provider.py": "[FILE] 286 lines",
                  "reporter.py": "[FILE] 99 lines",
                  "requirements.py": "[FILE] 252 lines",
                  "resolver.py": "[FILE] 333 lines"
                }
              },
              "self_outdated_check.py": "[FILE] 256 lines",
              "utils": {
                "__init__.py": "[FILE] 1 lines",
                "_jaraco_text.py": "[FILE] 110 lines",
                "_log.py": "[FILE] 39 lines",
                "appdirs.py": "[FILE] 53 lines",
                "compat.py": "[FILE] 86 lines",
                "compatibility_tags.py": "[FILE] 202 lines",
                "datetime.py": "[FILE] 29 lines",
                "deprecation.py": "[FILE] 127 lines",
                "direct_url_helpers.py": "[FILE] 88 lines",
                "egg_link.py": "[FILE] 82 lines",
                "entrypoints.py": "[FILE] 89 lines",
                "filesystem.py": "[FILE] 204 lines",
                "filetypes.py": "[FILE] 25 lines",
                "glibc.py": "[FILE] 103 lines",
                "hashes.py": "[FILE] 151 lines",
                "logging.py": "[FILE] 397 lines",
                "misc.py": "[FILE] 772 lines",
                "packaging.py": "[FILE] 45 lines",
                "pylock.py": "[FILE] 117 lines",
                "retry.py": "[FILE] 46 lines",
                "subprocess.py": "[FILE] 249 lines",
                "temp_dir.py": "[FILE] 295 lines",
                "unpacking.py": "[FILE] 363 lines",
                "urls.py": "[FILE] 56 lines",
                "virtualenv.py": "[FILE] 106 lines",
                "wheel.py": "[FILE] 133 lines"
              },
              "vcs": {
                "__init__.py": "[FILE] 16 lines",
                "bazaar.py": "[FILE] 131 lines",
                "git.py": "[FILE] 572 lines",
                "mercurial.py": "[FILE] 187 lines",
                "subversion.py": "[FILE] 336 lines",
                "versioncontrol.py": "[FILE] 696 lines"
              },
              "wheel_builder.py": "[FILE] 262 lines"
            },
            "_vendor": {
              "README.rst": "[BINARY] 9394 bytes",
              "__init__.py": "[FILE] 118 lines",
              "cachecontrol": {
                "LICENSE.txt": "[BINARY] 558 bytes",
                "__init__.py": "[FILE] 33 lines",
                "_cmd.py": "[FILE] 71 lines",
                "adapter.py": "[FILE] 168 lines",
                "cache.py": "[FILE] 76 lines",
                "caches": {
                  "__init__.py": "[FILE] 9 lines",
                  "file_cache.py": "[FILE] 146 lines",
                  "redis_cache.py": "[FILE] 49 lines"
                },
                "controller.py": "[FILE] 512 lines",
                "filewrapper.py": "[FILE] 122 lines",
                "heuristics.py": "[FILE] 158 lines",
                "py.typed": "[BINARY] 0 bytes",
                "serialize.py": "[FILE] 147 lines",
                "wrapper.py": "[FILE] 44 lines"
              },
              "certifi": {
                "LICENSE": "[BINARY] 989 bytes",
                "__init__.py": "[FILE] 5 lines",
                "__main__.py": "[FILE] 13 lines",
                "cacert.pem": "[BINARY] 270954 bytes",
                "core.py": "[FILE] 84 lines",
                "py.typed": "[BINARY] 0 bytes"
              },
              "dependency_groups": {
                "LICENSE.txt": "[BINARY] 1099 bytes",
                "__init__.py": "[FILE] 14 lines",
                "__main__.py": "[FILE] 66 lines",
                "_implementation.py": "[FILE] 210 lines",
                "_lint_dependency_groups.py": "[FILE] 60 lines",
                "_pip_wrapper.py": "[FILE] 63 lines",
                "_toml_compat.py": "[FILE] 10 lines",
                "py.typed": "[BINARY] 0 bytes"
              },
              "idna": {
                "LICENSE.md": "[FILE] 32 lines",
                "__init__.py": "[FILE] 46 lines",
                "codec.py": "[FILE] 123 lines",
                "compat.py": "[FILE] 16 lines",
                "core.py": "[FILE] 438 lines",
                "idnadata.py": "[FILE] 4310 lines",
                "intranges.py": "[FILE] 58 lines",
                "package_data.py": "[FILE] 2 lines",
                "py.typed": "[BINARY] 0 bytes",
                "uts46data.py": "[FILE] 8842 lines"
              },
              "msgpack": {
                "COPYING": "[BINARY] 614 bytes",
                "__init__.py": "[FILE] 56 lines",
                "exceptions.py": "[FILE] 49 lines",
                "ext.py": "[FILE] 171 lines",
                "fallback.py": "[FILE] 930 lines"
              },
              "packaging": {
                "LICENSE": "[BINARY] 197 bytes",
                "LICENSE.APACHE": "[BINARY] 10174 bytes",
                "LICENSE.BSD": "[BINARY] 1344 bytes",
                "__init__.py": "[FILE] 16 lines",
                "_elffile.py": "[FILE] 109 lines",
                "_manylinux.py": "[FILE] 263 lines",
                "_musllinux.py": "[FILE] 86 lines",
                "_parser.py": "[FILE] 366 lines",
                "_structures.py": "[FILE] 70 lines",
                "_tokenizer.py": "[FILE] 194 lines",
                "licenses": {
                  "__init__.py": "[FILE] 148 lines",
                  "_spdx.py": "[FILE] 800 lines"
                },
                "markers.py": "[FILE] 389 lines",
                "metadata.py": "[FILE] 979 lines",
                "py.typed": "[BINARY] 0 bytes",
                "pylock.py": "[FILE] 636 lines",
                "requirements.py": "[FILE] 87 lines",
                "specifiers.py": "[FILE] 1069 lines",
                "tags.py": "[FILE] 652 lines",
                "utils.py": "[FILE] 159 lines",
                "version.py": "[FILE] 793 lines"
              },
              "pkg_resources": {
                "LICENSE": "[BINARY] 1023 bytes",
                "__init__.py": "[FILE] 3677 lines"
              },
              "platformdirs": {
                "LICENSE": "[BINARY] 1089 bytes",
                "__init__.py": "[FILE] 632 lines",
                "__main__.py": "[FILE] 56 lines",
                "android.py": "[FILE] 250 lines",
                "api.py": "[FILE] 300 lines",
                "macos.py": "[FILE] 147 lines",
                "py.typed": "[BINARY] 0 bytes",
                "unix.py": "[FILE] 273 lines",
                "version.py": "[FILE] 35 lines",
                "windows.py": "[FILE] 279 lines"
              },
              "pygments": {
                "LICENSE": "[BINARY] 1331 bytes",
                "__init__.py": "[FILE] 83 lines",
                "__main__.py": "[FILE] 18 lines",
                "console.py": "[FILE] 71 lines",
                "filter.py": "[FILE] 71 lines",
                "filters": {
                  "__init__.py": "[FILE] 941 lines"
                },
                "formatter.py": "[FILE] 130 lines",
                "formatters": {
                  "__init__.py": "[FILE] 158 lines",
                  "_mapping.py": "[FILE] 24 lines"
                },
                "lexer.py": "[FILE] 964 lines",
                "lexers": {
                  "__init__.py": "[FILE] 363 lines",
                  "_mapping.py": "[FILE] 603 lines",
                  "python.py": "[FILE] 1202 lines"
                },
                "modeline.py": "[FILE] 44 lines",
                "plugin.py": "[FILE] 73 lines",
                "regexopt.py": "[FILE] 92 lines",
                "scanner.py": "[FILE] 105 lines",
                "sphinxext.py": "[FILE] 248 lines",
                "style.py": "[FILE] 204 lines",
                "styles": {
                  "__init__.py": "[FILE] 62 lines",
                  "_mapping.py": "[FILE] 55 lines"
                },
                "token.py": "[FILE] 215 lines",
                "unistring.py": "[FILE] 154 lines",
                "util.py": "[FILE] 325 lines"
              },
              "pyproject_hooks": {
                "LICENSE": "[BINARY] 1081 bytes",
                "__init__.py": "[FILE] 32 lines",
                "_impl.py": "[FILE] 411 lines",
                "_in_process": {
                  "__init__.py": "[FILE] 22 lines",
                  "_in_process.py": "[FILE] 390 lines"
                },
                "py.typed": "[BINARY] 0 bytes"
              },
              "requests": {
                "LICENSE": "[BINARY] 10142 bytes",
                "__init__.py": "[FILE] 180 lines",
                "__version__.py": "[FILE] 15 lines",
                "_internal_utils.py": "[FILE] 51 lines",
                "adapters.py": "[FILE] 697 lines",
                "api.py": "[FILE] 158 lines",
                "auth.py": "[FILE] 315 lines",
                "certs.py": "[FILE] 18 lines",
                "compat.py": "[FILE] 91 lines",
                "cookies.py": "[FILE] 562 lines",
                "exceptions.py": "[FILE] 152 lines",
                "help.py": "[FILE] 128 lines",
                "hooks.py": "[FILE] 34 lines",
                "models.py": "[FILE] 1040 lines",
                "packages.py": "[FILE] 26 lines",
                "sessions.py": "[FILE] 832 lines",
                "status_codes.py": "[FILE] 129 lines",
                "structures.py": "[FILE] 100 lines",
                "utils.py": "[FILE] 1087 lines"
              },
              "resolvelib": {
                "LICENSE": "[BINARY] 751 bytes",
                "__init__.py": "[FILE] 28 lines",
                "providers.py": "[FILE] 197 lines",
                "py.typed": "[BINARY] 0 bytes",
                "reporters.py": "[FILE] 56 lines",
                "resolvers": {
                  "__init__.py": "[FILE] 28 lines",
                  "abstract.py": "[FILE] 48 lines",
                  "criterion.py": "[FILE] 49 lines",
                  "exceptions.py": "[FILE] 58 lines",
                  "resolution.py": "[FILE] 628 lines"
                },
                "structs.py": "[FILE] 210 lines"
              },
              "rich": {
                "LICENSE": "[BINARY] 1056 bytes",
                "__init__.py": "[FILE] 178 lines",
                "__main__.py": "[FILE] 246 lines",
                "_cell_widths.py": "[FILE] 455 lines",
                "_emoji_codes.py": "[FILE] 3611 lines",
                "_emoji_replace.py": "[FILE] 33 lines",
                "_export_format.py": "[FILE] 77 lines",
                "_extension.py": "[FILE] 11 lines",
                "_fileno.py": "[FILE] 25 lines",
                "_inspect.py": "[FILE] 269 lines",
                "_log_render.py": "[FILE] 95 lines",
                "_loop.py": "[FILE] 44 lines",
                "_null_file.py": "[FILE] 70 lines",
                "_palettes.py": "[FILE] 310 lines",
                "_pick.py": "[FILE] 18 lines",
                "_ratio.py": "[FILE] 154 lines",
                "_spinners.py": "[FILE] 483 lines",
                "_stack.py": "[FILE] 17 lines",
                "_timer.py": "[FILE] 20 lines",
                "_win32_console.py": "[FILE] 662 lines",
                "_windows.py": "[FILE] 72 lines",
                "_windows_renderer.py": "[FILE] 57 lines",
                "_wrap.py": "[FILE] 94 lines",
                "abc.py": "[FILE] 34 lines",
                "align.py": "[FILE] 307 lines",
                "ansi.py": "[FILE] 242 lines",
                "bar.py": "[FILE] 94 lines",
                "box.py": "[FILE] 475 lines",
                "cells.py": "[FILE] 175 lines",
                "color.py": "[FILE] 622 lines",
                "color_triplet.py": "[FILE] 39 lines",
                "columns.py": "[FILE] 188 lines",
                "console.py": "[FILE] 2681 lines",
                "constrain.py": "[FILE] 38 lines",
                "containers.py": "[FILE] 168 lines",
                "control.py": "[FILE] 220 lines",
                "default_styles.py": "[FILE] 194 lines",
                "diagnose.py": "[FILE] 40 lines",
                "emoji.py": "[FILE] 92 lines",
                "errors.py": "[FILE] 35 lines",
                "file_proxy.py": "[FILE] 58 lines",
                "filesize.py": "[FILE] 89 lines",
                "highlighter.py": "[FILE] 233 lines",
                "json.py": "[FILE] 140 lines",
                "jupyter.py": "[FILE] 102 lines",
                "layout.py": "[FILE] 443 lines",
                "live.py": "[FILE] 401 lines",
                "live_render.py": "[FILE] 107 lines",
                "logging.py": "[FILE] 298 lines",
                "markup.py": "[FILE] 252 lines",
                "measure.py": "[FILE] 152 lines",
                "padding.py": "[FILE] 142 lines",
                "pager.py": "[FILE] 35 lines",
                "palette.py": "[FILE] 101 lines",
                "panel.py": "[FILE] 318 lines",
                "pretty.py": "[FILE] 1017 lines",
                "progress.py": "[FILE] 1716 lines",
                "progress_bar.py": "[FILE] 224 lines",
                "prompt.py": "[FILE] 401 lines",
                "protocol.py": "[FILE] 43 lines",
                "py.typed": "[BINARY] 0 bytes",
                "region.py": "[FILE] 11 lines",
                "repr.py": "[FILE] 150 lines",
                "rule.py": "[FILE] 131 lines",
                "scope.py": "[FILE] 87 lines",
                "screen.py": "[FILE] 55 lines",
                "segment.py": "[FILE] 753 lines",
                "spinner.py": "[FILE] 133 lines",
                "status.py": "[FILE] 132 lines",
                "style.py": "[FILE] 793 lines",
                "styled.py": "[FILE] 43 lines",
                "syntax.py": "[FILE] 986 lines",
                "table.py": "[FILE] 1007 lines",
                "terminal_theme.py": "[FILE] 154 lines",
                "text.py": "[FILE] 1362 lines",
                "theme.py": "[FILE] 116 lines",
                "themes.py": "[FILE] 6 lines",
                "traceback.py": "[FILE] 900 lines",
                "tree.py": "[FILE] 258 lines"
              },
              "tomli": {
                "LICENSE": "[BINARY] 1072 bytes",
                "__init__.py": "[FILE] 9 lines",
                "_parser.py": "[FILE] 778 lines",
                "_re.py": "[FILE] 116 lines",
                "_types.py": "[FILE] 11 lines",
                "py.typed": "[BINARY] 26 bytes"
              },
              "tomli_w": {
                "LICENSE": "[BINARY] 1072 bytes",
                "__init__.py": "[FILE] 5 lines",
                "_writer.py": "[FILE] 230 lines",
                "py.typed": "[BINARY] 26 bytes"
              },
              "truststore": {
                "LICENSE": "[BINARY] 1086 bytes",
                "__init__.py": "[FILE] 37 lines",
                "_api.py": "[FILE] 342 lines",
                "_macos.py": "[FILE] 572 lines",
                "_openssl.py": "[FILE] 69 lines",
                "_ssl_constants.py": "[FILE] 32 lines",
                "_windows.py": "[FILE] 568 lines",
                "py.typed": "[BINARY] 0 bytes"
              },
              "urllib3": {
                "LICENSE.txt": "[BINARY] 1115 bytes",
                "__init__.py": "[FILE] 103 lines",
                "_collections.py": "[FILE] 356 lines",
                "_version.py": "[FILE] 3 lines",
                "connection.py": "[FILE] 573 lines",
                "connectionpool.py": "[FILE] 1141 lines",
                "contrib": {
                  "__init__.py": "[FILE] 1 lines",
                  "_appengine_environ.py": "[FILE] 37 lines",
                  "_securetransport": {
                    "__init__.py": "[FILE] 1 lines",
                    "bindings.py": "[FILE] 520 lines",
                    "low_level.py": "[FILE] 398 lines"
                  },
                  "appengine.py": "[FILE] 315 lines",
                  "ntlmpool.py": "[FILE] 131 lines",
                  "pyopenssl.py": "[FILE] 519 lines",
                  "securetransport.py": "[FILE] 921 lines",
                  "socks.py": "[FILE] 217 lines"
                },
                "exceptions.py": "[FILE] 324 lines",
                "fields.py": "[FILE] 275 lines",
                "filepost.py": "[FILE] 99 lines",
                "packages": {
                  "__init__.py": "[FILE] 1 lines",
                  "backports": {
                    "__init__.py": "[FILE] 1 lines",
                    "makefile.py": "[FILE] 52 lines",
                    "weakref_finalize.py": "[FILE] 156 lines"
                  },
                  "six.py": "[FILE] 1077 lines"
                },
                "poolmanager.py": "[FILE] 541 lines",
                "request.py": "[FILE] 192 lines",
                "response.py": "[FILE] 880 lines",
                "util": {
                  "__init__.py": "[FILE] 50 lines",
                  "connection.py": "[FILE] 150 lines",
                  "proxy.py": "[FILE] 58 lines",
                  "queue.py": "[FILE] 23 lines",
                  "request.py": "[FILE] 138 lines",
                  "response.py": "[FILE] 108 lines",
                  "retry.py": "[FILE] 623 lines",
                  "ssl_.py": "[FILE] 505 lines",
                  "ssl_match_hostname.py": "[FILE] 160 lines",
                  "ssltransport.py": "[FILE] 222 lines",
                  "timeout.py": "[FILE] 272 lines",
                  "url.py": "[FILE] 436 lines",
                  "wait.py": "[FILE] 153 lines"
                }
              },
              "vendor.txt": "[BINARY] 342 bytes"
            },
            "py.typed": "[BINARY] 286 bytes"
          },
          "pip-26.0.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 4675 bytes",
            "RECORD": "[BINARY] 68761 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "entry_points.txt": "[BINARY] 84 bytes",
            "licenses": {
              "AUTHORS.txt": "[BINARY] 11731 bytes",
              "LICENSE.txt": "[BINARY] 1093 bytes",
              "src": {
                "pip": {
                  "_vendor": {
                    "cachecontrol": {
                      "LICENSE.txt": "[BINARY] 558 bytes"
                    },
                    "certifi": {
                      "LICENSE": "[BINARY] 989 bytes"
                    },
                    "dependency_groups": {
                      "LICENSE.txt": "[BINARY] 1099 bytes"
                    },
                    "idna": {
                      "LICENSE.md": "[FILE] 32 lines"
                    },
                    "msgpack": {
                      "COPYING": "[BINARY] 614 bytes"
                    },
                    "packaging": {
                      "LICENSE": "[BINARY] 197 bytes",
                      "LICENSE.APACHE": "[BINARY] 10174 bytes",
                      "LICENSE.BSD": "[BINARY] 1344 bytes"
                    },
                    "pkg_resources": {
                      "LICENSE": "[BINARY] 1023 bytes"
                    },
                    "platformdirs": {
                      "LICENSE": "[BINARY] 1089 bytes"
                    },
                    "pygments": {
                      "LICENSE": "[BINARY] 1331 bytes"
                    },
                    "pyproject_hooks": {
                      "LICENSE": "[BINARY] 1081 bytes"
                    },
                    "requests": {
                      "LICENSE": "[BINARY] 10142 bytes"
                    },
                    "resolvelib": {
                      "LICENSE": "[BINARY] 751 bytes"
                    },
                    "rich": {
                      "LICENSE": "[BINARY] 1056 bytes"
                    },
                    "tomli": {
                      "LICENSE": "[BINARY] 1072 bytes"
                    },
                    "tomli_w": {
                      "LICENSE": "[BINARY] 1072 bytes"
                    },
                    "truststore": {
                      "LICENSE": "[BINARY] 1086 bytes"
                    },
                    "urllib3": {
                      "LICENSE.txt": "[BINARY] 1115 bytes"
                    }
                  }
                }
              }
            }
          },
          "prompt_toolkit": {
            "__init__.py": "[FILE] 55 lines",
            "application": {
              "__init__.py": "[FILE] 33 lines",
              "application.py": "[FILE] 1631 lines",
              "current.py": "[FILE] 196 lines",
              "dummy.py": "[FILE] 56 lines",
              "run_in_terminal.py": "[FILE] 118 lines"
            },
            "auto_suggest.py": "[FILE] 178 lines",
            "buffer.py": "[FILE] 2030 lines",
            "cache.py": "[FILE] 128 lines",
            "clipboard": {
              "__init__.py": "[FILE] 18 lines",
              "base.py": "[FILE] 110 lines",
              "in_memory.py": "[FILE] 45 lines",
              "pyperclip.py": "[FILE] 43 lines"
            },
            "completion": {
              "__init__.py": "[FILE] 44 lines",
              "base.py": "[FILE] 439 lines",
              "deduplicate.py": "[FILE] 46 lines",
              "filesystem.py": "[FILE] 119 lines",
              "fuzzy_completer.py": "[FILE] 214 lines",
              "nested.py": "[FILE] 110 lines",
              "word_completer.py": "[FILE] 95 lines"
            },
            "contrib": {
              "__init__.py": "[FILE] 1 lines",
              "completers": {
                "__init__.py": "[FILE] 6 lines",
                "system.py": "[FILE] 65 lines"
              },
              "regular_languages": {
                "__init__.py": "[FILE] 81 lines",
                "compiler.py": "[FILE] 580 lines",
                "completion.py": "[FILE] 101 lines",
                "lexer.py": "[FILE] 95 lines",
                "regex_parser.py": "[FILE] 280 lines",
                "validation.py": "[FILE] 61 lines"
              },
              "ssh": {
                "__init__.py": "[FILE] 9 lines",
                "server.py": "[FILE] 179 lines"
              },
              "telnet": {
                "__init__.py": "[FILE] 8 lines",
                "log.py": "[FILE] 14 lines",
                "protocol.py": "[FILE] 210 lines",
                "server.py": "[FILE] 429 lines"
              }
            },
            "cursor_shapes.py": "[FILE] 118 lines",
            "data_structures.py": "[FILE] 19 lines",
            "document.py": "[FILE] 1183 lines",
            "enums.py": "[FILE] 20 lines",
            "eventloop": {
              "__init__.py": "[FILE] 32 lines",
              "async_generator.py": "[FILE] 126 lines",
              "inputhook.py": "[FILE] 192 lines",
              "utils.py": "[FILE] 102 lines",
              "win32.py": "[FILE] 73 lines"
            },
            "filters": {
              "__init__.py": "[FILE] 72 lines",
              "app.py": "[FILE] 420 lines",
              "base.py": "[FILE] 261 lines",
              "cli.py": "[FILE] 66 lines",
              "utils.py": "[FILE] 42 lines"
            },
            "formatted_text": {
              "__init__.py": "[FILE] 60 lines",
              "ansi.py": "[FILE] 303 lines",
              "base.py": "[FILE] 180 lines",
              "html.py": "[FILE] 146 lines",
              "pygments.py": "[FILE] 33 lines",
              "utils.py": "[FILE] 103 lines"
            },
            "history.py": "[FILE] 307 lines",
            "input": {
              "__init__.py": "[FILE] 15 lines",
              "ansi_escape_sequences.py": "[FILE] 345 lines",
              "base.py": "[FILE] 155 lines",
              "defaults.py": "[FILE] 80 lines",
              "posix_pipe.py": "[FILE] 119 lines",
              "posix_utils.py": "[FILE] 98 lines",
              "typeahead.py": "[FILE] 79 lines",
              "vt100.py": "[FILE] 310 lines",
              "vt100_parser.py": "[FILE] 251 lines",
              "win32.py": "[FILE] 905 lines",
              "win32_pipe.py": "[FILE] 157 lines"
            },
            "key_binding": {
              "__init__.py": "[FILE] 23 lines",
              "bindings": {
                "__init__.py": "[FILE] 1 lines",
                "auto_suggest.py": "[FILE] 67 lines",
                "basic.py": "[FILE] 258 lines",
                "completion.py": "[FILE] 207 lines",
                "cpr.py": "[FILE] 31 lines",
                "emacs.py": "[FILE] 564 lines",
                "focus.py": "[FILE] 27 lines",
                "mouse.py": "[FILE] 349 lines",
                "named_commands.py": "[FILE] 692 lines",
                "open_in_editor.py": "[FILE] 53 lines",
                "page_navigation.py": "[FILE] 86 lines",
                "scroll.py": "[FILE] 191 lines",
                "search.py": "[FILE] 97 lines",
                "vi.py": "[FILE] 2234 lines"
              },
              "defaults.py": "[FILE] 64 lines",
              "digraphs.py": "[FILE] 1379 lines",
              "emacs_state.py": "[FILE] 37 lines",
              "key_bindings.py": "[FILE] 673 lines",
              "key_processor.py": "[FILE] 527 lines",
              "vi_state.py": "[FILE] 108 lines"
            },
            "keys.py": "[FILE] 223 lines",
            "layout": {
              "__init__.py": "[FILE] 148 lines",
              "containers.py": "[FILE] 2767 lines",
              "controls.py": "[FILE] 957 lines",
              "dimension.py": "[FILE] 217 lines",
              "dummy.py": "[FILE] 41 lines",
              "layout.py": "[FILE] 413 lines",
              "margins.py": "[FILE] 305 lines",
              "menus.py": "[FILE] 749 lines",
              "mouse_handlers.py": "[FILE] 57 lines",
              "processors.py": "[FILE] 1017 lines",
              "screen.py": "[FILE] 324 lines",
              "scrollable_pane.py": "[FILE] 495 lines",
              "utils.py": "[FILE] 81 lines"
            },
            "lexers": {
              "__init__.py": "[FILE] 22 lines",
              "base.py": "[FILE] 86 lines",
              "pygments.py": "[FILE] 329 lines"
            },
            "log.py": "[FILE] 14 lines",
            "mouse_events.py": "[FILE] 86 lines",
            "output": {
              "__init__.py": "[FILE] 16 lines",
              "base.py": "[FILE] 333 lines",
              "color_depth.py": "[FILE] 65 lines",
              "conemu.py": "[FILE] 66 lines",
              "defaults.py": "[FILE] 107 lines",
              "flush_stdout.py": "[FILE] 88 lines",
              "plain_text.py": "[FILE] 144 lines",
              "vt100.py": "[FILE] 761 lines",
              "win32.py": "[FILE] 685 lines",
              "windows10.py": "[FILE] 134 lines"
            },
            "patch_stdout.py": "[FILE] 298 lines",
            "py.typed": "[BINARY] 0 bytes",
            "renderer.py": "[FILE] 821 lines",
            "search.py": "[FILE] 227 lines",
            "selection.py": "[FILE] 59 lines",
            "shortcuts": {
              "__init__.py": "[FILE] 50 lines",
              "choice_input.py": "[FILE] 312 lines",
              "dialogs.py": "[FILE] 331 lines",
              "progress_bar": {
                "__init__.py": "[FILE] 34 lines",
                "base.py": "[FILE] 450 lines",
                "formatters.py": "[FILE] 432 lines"
              },
              "prompt.py": "[FILE] 1539 lines",
              "utils.py": "[FILE] 240 lines"
            },
            "styles": {
              "__init__.py": "[FILE] 68 lines",
              "base.py": "[FILE] 189 lines",
              "defaults.py": "[FILE] 237 lines",
              "named_colors.py": "[FILE] 163 lines",
              "pygments.py": "[FILE] 71 lines",
              "style.py": "[FILE] 408 lines",
              "style_transformation.py": "[FILE] 375 lines"
            },
            "token.py": "[FILE] 10 lines",
            "utils.py": "[FILE] 328 lines",
            "validation.py": "[FILE] 193 lines",
            "widgets": {
              "__init__.py": "[FILE] 64 lines",
              "base.py": "[FILE] 1081 lines",
              "dialogs.py": "[FILE] 109 lines",
              "menus.py": "[FILE] 375 lines",
              "toolbars.py": "[FILE] 371 lines"
            },
            "win32_types.py": "[FILE] 230 lines"
          },
          "prompt_toolkit-3.0.52.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6414 bytes",
            "RECORD": "[BINARY] 23851 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "AUTHORS.rst": "[BINARY] 148 bytes",
              "LICENSE": "[BINARY] 1493 bytes"
            },
            "top_level.txt": "[BINARY] 15 bytes"
          },
          "psycopg2": {
            "__init__.py": "[FILE] 127 lines",
            "_ipaddress.py": "[FILE] 91 lines",
            "_json.py": "[FILE] 200 lines",
            "_psycopg.cpython-312-x86_64-linux-gnu.so": "[BINARY] 339145 bytes",
            "_range.py": "[FILE] 555 lines",
            "errorcodes.py": "[FILE] 450 lines",
            "errors.py": "[FILE] 39 lines",
            "extensions.py": "[FILE] 214 lines",
            "extras.py": "[FILE] 1341 lines",
            "pool.py": "[FILE] 188 lines",
            "sql.py": "[FILE] 456 lines",
            "tz.py": "[FILE] 159 lines"
          },
          "psycopg2_binary-2.9.9.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2238 bytes",
            "METADATA": "[BINARY] 4445 bytes",
            "RECORD": "[BINARY] 3590 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 152 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "psycopg2_binary.libs": {
            "libcom_err-2abe824b.so.2.1": "[BINARY] 17497 bytes",
            "libcrypto-0628e7d4.so.1.1": "[BINARY] 3133185 bytes",
            "libgssapi_krb5-497db0c6.so.2.2": "[BINARY] 345209 bytes",
            "libk5crypto-b1f99d5c.so.3.1": "[BINARY] 219953 bytes",
            "libkeyutils-dfe70bd6.so.1.5": "[BINARY] 17913 bytes",
            "libkrb5-fcafa220.so.3.3": "[BINARY] 1018953 bytes",
            "libkrb5support-d0bcff84.so.0.1": "[BINARY] 76873 bytes",
            "liblber-5a1d5ae1.so.2.0.200": "[BINARY] 60977 bytes",
            "libldap-5d2ff197.so.2.0.200": "[BINARY] 447329 bytes",
            "libpcre-9513aab5.so.1.2.0": "[BINARY] 406817 bytes",
            "libpq-e8a033dd.so.5.16": "[BINARY] 370777 bytes",
            "libsasl2-883649fd.so.3.0.0": "[BINARY] 119217 bytes",
            "libselinux-0922c95c.so.1": "[BINARY] 178337 bytes",
            "libssl-3e69114b.so.1.1": "[BINARY] 646065 bytes"
          },
          "pyasn1": {
            "__init__.py": "[FILE] 3 lines",
            "codec": {
              "__init__.py": "[FILE] 2 lines",
              "ber": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 2208 lines",
                "encoder.py": "[FILE] 955 lines",
                "eoo.py": "[FILE] 29 lines"
              },
              "cer": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 150 lines",
                "encoder.py": "[FILE] 332 lines"
              },
              "der": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 121 lines",
                "encoder.py": "[FILE] 127 lines"
              },
              "native": {
                "__init__.py": "[FILE] 2 lines",
                "decoder.py": "[FILE] 245 lines",
                "encoder.py": "[FILE] 286 lines"
              },
              "streaming.py": "[FILE] 235 lines"
            },
            "compat": {
              "__init__.py": "[FILE] 5 lines",
              "integer.py": "[FILE] 14 lines"
            },
            "debug.py": "[FILE] 147 lines",
            "error.py": "[FILE] 117 lines",
            "type": {
              "__init__.py": "[FILE] 2 lines",
              "base.py": "[FILE] 700 lines",
              "char.py": "[FILE] 289 lines",
              "constraint.py": "[FILE] 752 lines",
              "error.py": "[FILE] 12 lines",
              "namedtype.py": "[FILE] 551 lines",
              "namedval.py": "[FILE] 193 lines",
              "opentype.py": "[FILE] 105 lines",
              "tag.py": "[FILE] 336 lines",
              "tagmap.py": "[FILE] 97 lines",
              "univ.py": "[FILE] 3328 lines",
              "useful.py": "[FILE] 190 lines"
            }
          },
          "pyasn1-0.6.2.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8411 bytes",
            "RECORD": "[BINARY] 4866 bytes",
            "WHEEL": "[BINARY] 91 bytes",
            "licenses": {
              "LICENSE.rst": "[BINARY] 1334 bytes"
            },
            "top_level.txt": "[BINARY] 7 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "pycparser": {
            "__init__.py": "[FILE] 100 lines",
            "_ast_gen.py": "[FILE] 356 lines",
            "_c_ast.cfg": "[BINARY] 4255 bytes",
            "ast_transforms.py": "[FILE] 175 lines",
            "c_ast.py": "[FILE] 1342 lines",
            "c_generator.py": "[FILE] 574 lines",
            "c_lexer.py": "[FILE] 707 lines",
            "c_parser.py": "[FILE] 2377 lines"
          },
          "pycparser-3.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 8229 bytes",
            "RECORD": "[BINARY] 1484 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1543 bytes"
            },
            "top_level.txt": "[BINARY] 10 bytes"
          },
          "pydantic": {
            "__init__.py": "[FILE] 395 lines",
            "_internal": {
              "__init__.py": "[FILE] 1 lines",
              "_config.py": "[FILE] 335 lines",
              "_core_metadata.py": "[FILE] 93 lines",
              "_core_utils.py": "[FILE] 569 lines",
              "_dataclasses.py": "[FILE] 231 lines",
              "_decorators.py": "[FILE] 792 lines",
              "_decorators_v1.py": "[FILE] 182 lines",
              "_discriminated_union.py": "[FILE] 504 lines",
              "_docs_extraction.py": "[FILE] 108 lines",
              "_fields.py": "[FILE] 345 lines",
              "_forward_ref.py": "[FILE] 24 lines",
              "_generate_schema.py": "[FILE] 2304 lines",
              "_generics.py": "[FILE] 518 lines",
              "_git.py": "[FILE] 27 lines",
              "_internal_dataclass.py": "[FILE] 11 lines",
              "_known_annotated_metadata.py": "[FILE] 429 lines",
              "_mock_val_ser.py": "[FILE] 141 lines",
              "_model_construction.py": "[FILE] 714 lines",
              "_repr.py": "[FILE] 118 lines",
              "_schema_generation_shared.py": "[FILE] 125 lines",
              "_signature.py": "[FILE] 165 lines",
              "_std_types_schema.py": "[FILE] 716 lines",
              "_typing_extra.py": "[FILE] 495 lines",
              "_utils.py": "[FILE] 363 lines",
              "_validate_call.py": "[FILE] 85 lines",
              "_validators.py": "[FILE] 290 lines"
            },
            "_migration.py": "[FILE] 309 lines",
            "alias_generators.py": "[FILE] 51 lines",
            "aliases.py": "[FILE] 113 lines",
            "annotated_handlers.py": "[FILE] 121 lines",
            "class_validators.py": "[FILE] 5 lines",
            "color.py": "[FILE] 604 lines",
            "config.py": "[FILE] 1004 lines",
            "dataclasses.py": "[FILE] 328 lines",
            "datetime_parse.py": "[FILE] 5 lines",
            "decorator.py": "[FILE] 5 lines",
            "deprecated": {
              "__init__.py": "[FILE] 1 lines",
              "class_validators.py": "[FILE] 266 lines",
              "config.py": "[FILE] 73 lines",
              "copy_internals.py": "[FILE] 225 lines",
              "decorator.py": "[FILE] 280 lines",
              "json.py": "[FILE] 141 lines",
              "parse.py": "[FILE] 81 lines",
              "tools.py": "[FILE] 104 lines"
            },
            "env_settings.py": "[FILE] 5 lines",
            "error_wrappers.py": "[FILE] 5 lines",
            "errors.py": "[FILE] 154 lines",
            "fields.py": "[FILE] 1238 lines",
            "functional_serializers.py": "[FILE] 400 lines",
            "functional_validators.py": "[FILE] 710 lines",
            "generics.py": "[FILE] 5 lines",
            "json.py": "[FILE] 5 lines",
            "json_schema.py": "[FILE] 2494 lines",
            "main.py": "[FILE] 1542 lines",
            "mypy.py": "[FILE] 1285 lines",
            "networks.py": "[FILE] 733 lines",
            "parse.py": "[FILE] 5 lines",
            "plugin": {
              "__init__.py": "[FILE] 171 lines",
              "_loader.py": "[FILE] 57 lines",
              "_schema_validator.py": "[FILE] 139 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "root_model.py": "[FILE] 156 lines",
            "schema.py": "[FILE] 5 lines",
            "tools.py": "[FILE] 5 lines",
            "type_adapter.py": "[FILE] 474 lines",
            "types.py": "[FILE] 2997 lines",
            "typing.py": "[FILE] 5 lines",
            "utils.py": "[FILE] 5 lines",
            "v1": {
              "__init__.py": "[FILE] 132 lines",
              "_hypothesis_plugin.py": "[FILE] 392 lines",
              "annotated_types.py": "[FILE] 73 lines",
              "class_validators.py": "[FILE] 362 lines",
              "color.py": "[FILE] 495 lines",
              "config.py": "[FILE] 192 lines",
              "dataclasses.py": "[FILE] 501 lines",
              "datetime_parse.py": "[FILE] 249 lines",
              "decorator.py": "[FILE] 265 lines",
              "env_settings.py": "[FILE] 351 lines",
              "error_wrappers.py": "[FILE] 162 lines",
              "errors.py": "[FILE] 647 lines",
              "fields.py": "[FILE] 1254 lines",
              "generics.py": "[FILE] 401 lines",
              "json.py": "[FILE] 113 lines",
              "main.py": "[FILE] 1108 lines",
              "mypy.py": "[FILE] 945 lines",
              "networks.py": "[FILE] 748 lines",
              "parse.py": "[FILE] 67 lines",
              "py.typed": "[BINARY] 0 bytes",
              "schema.py": "[FILE] 1164 lines",
              "tools.py": "[FILE] 93 lines",
              "types.py": "[FILE] 1206 lines",
              "typing.py": "[FILE] 604 lines",
              "utils.py": "[FILE] 804 lines",
              "v1.py": "[FILE] 117 lines",
              "validators.py": "[FILE] 766 lines",
              "version.py": "[FILE] 39 lines"
            },
            "validate_call_decorator.py": "[FILE] 69 lines",
            "validators.py": "[FILE] 5 lines",
            "version.py": "[FILE] 78 lines",
            "warnings.py": "[FILE] 59 lines"
          },
          "pydantic-2.7.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 103375 bytes",
            "RECORD": "[BINARY] 14549 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1129 bytes"
            }
          },
          "pydantic_core": {
            "__init__.py": "[FILE] 140 lines",
            "_pydantic_core.cpython-312-x86_64-linux-gnu.so": "[BINARY] 5088024 bytes",
            "_pydantic_core.pyi": "[BINARY] 35226 bytes",
            "core_schema.py": "[FILE] 4046 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "pydantic_core-2.18.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6534 bytes",
            "RECORD": "[BINARY] 1007 bytes",
            "WHEEL": "[BINARY] 129 bytes",
            "license_files": {
              "LICENSE": "[BINARY] 1080 bytes"
            }
          },
          "pydantic_settings": {
            "__init__.py": "[FILE] 23 lines",
            "main.py": "[FILE] 178 lines",
            "py.typed": "[BINARY] 0 bytes",
            "sources.py": "[FILE] 650 lines",
            "utils.py": "[FILE] 25 lines",
            "version.py": "[FILE] 2 lines"
          },
          "pydantic_settings-2.1.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2931 bytes",
            "RECORD": "[BINARY] 1328 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1103 bytes"
            }
          },
          "python_dateutil-2.9.0.post0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2889 bytes",
            "METADATA": "[BINARY] 8354 bytes",
            "RECORD": "[BINARY] 3125 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 9 bytes",
            "zip-safe": "[BINARY] 1 bytes"
          },
          "python_dotenv-1.0.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1556 bytes",
            "METADATA": "[BINARY] 21991 bytes",
            "RECORD": "[BINARY] 1816 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "entry_points.txt": "[BINARY] 47 bytes",
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "python_jose-3.3.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1081 bytes",
            "METADATA": "[BINARY] 5403 bytes",
            "RECORD": "[BINARY] 2491 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 110 bytes",
            "top_level.txt": "[BINARY] 19 bytes"
          },
          "python_multipart-0.0.6.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2459 bytes",
            "RECORD": "[BINARY] 6237 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE.txt": "[BINARY] 556 bytes"
            }
          },
          "pyyaml-6.0.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 2351 bytes",
            "RECORD": "[BINARY] 2706 bytes",
            "WHEEL": "[BINARY] 190 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1101 bytes"
            },
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "redis": {
            "__init__.py": "[FILE] 95 lines",
            "_parsers": {
              "__init__.py": "[FILE] 21 lines",
              "base.py": "[FILE] 226 lines",
              "commands.py": "[FILE] 282 lines",
              "encoders.py": "[FILE] 45 lines",
              "helpers.py": "[FILE] 853 lines",
              "hiredis.py": "[FILE] 218 lines",
              "resp2.py": "[FILE] 133 lines",
              "resp3.py": "[FILE] 260 lines",
              "socket.py": "[FILE] 163 lines"
            },
            "asyncio": {
              "__init__.py": "[FILE] 65 lines",
              "client.py": "[FILE] 1534 lines",
              "cluster.py": "[FILE] 1621 lines",
              "connection.py": "[FILE] 1181 lines",
              "lock.py": "[FILE] 314 lines",
              "retry.py": "[FILE] 68 lines",
              "sentinel.py": "[FILE] 376 lines",
              "utils.py": "[FILE] 29 lines"
            },
            "backoff.py": "[FILE] 115 lines",
            "client.py": "[FILE] 1501 lines",
            "cluster.py": "[FILE] 2487 lines",
            "commands": {
              "__init__.py": "[FILE] 19 lines",
              "bf": {
                "__init__.py": "[FILE] 254 lines",
                "commands.py": "[FILE] 543 lines",
                "info.py": "[FILE] 121 lines"
              },
              "cluster.py": "[FILE] 929 lines",
              "core.py": "[FILE] 6306 lines",
              "graph": {
                "__init__.py": "[FILE] 264 lines",
                "commands.py": "[FILE] 314 lines",
                "edge.py": "[FILE] 92 lines",
                "exceptions.py": "[FILE] 4 lines",
                "execution_plan.py": "[FILE] 212 lines",
                "node.py": "[FILE] 89 lines",
                "path.py": "[FILE] 79 lines",
                "query_result.py": "[FILE] 574 lines"
              },
              "helpers.py": "[FILE] 167 lines",
              "json": {
                "__init__.py": "[FILE] 148 lines",
                "_util.py": "[FILE] 4 lines",
                "commands.py": "[FILE] 430 lines",
                "decoders.py": "[FILE] 61 lines",
                "path.py": "[FILE] 17 lines"
              },
              "redismodules.py": "[FILE] 104 lines",
              "search": {
                "__init__.py": "[FILE] 190 lines",
                "_util.py": "[FILE] 8 lines",
                "aggregation.py": "[FILE] 373 lines",
                "commands.py": "[FILE] 1118 lines",
                "document.py": "[FILE] 18 lines",
                "field.py": "[FILE] 169 lines",
                "indexDefinition.py": "[FILE] 80 lines",
                "query.py": "[FILE] 363 lines",
                "querystring.py": "[FILE] 318 lines",
                "reducers.py": "[FILE] 183 lines",
                "result.py": "[FILE] 74 lines",
                "suggestion.py": "[FILE] 56 lines"
              },
              "sentinel.py": "[FILE] 100 lines",
              "timeseries": {
                "__init__.py": "[FILE] 109 lines",
                "commands.py": "[FILE] 897 lines",
                "info.py": "[FILE] 92 lines",
                "utils.py": "[FILE] 45 lines"
              }
            },
            "compat.py": "[FILE] 7 lines",
            "connection.py": "[FILE] 1337 lines",
            "crc.py": "[FILE] 24 lines",
            "credentials.py": "[FILE] 27 lines",
            "exceptions.py": "[FILE] 219 lines",
            "lock.py": "[FILE] 309 lines",
            "ocsp.py": "[FILE] 308 lines",
            "py.typed": "[BINARY] 0 bytes",
            "retry.py": "[FILE] 55 lines",
            "sentinel.py": "[FILE] 390 lines",
            "typing.py": "[FILE] 66 lines",
            "utils.py": "[FILE] 148 lines"
          },
          "redis-5.0.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1074 bytes",
            "METADATA": "[BINARY] 8910 bytes",
            "RECORD": "[BINARY] 10376 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 6 bytes"
          },
          "rsa": {
            "__init__.py": "[FILE] 61 lines",
            "asn1.py": "[FILE] 53 lines",
            "cli.py": "[FILE] 322 lines",
            "common.py": "[FILE] 185 lines",
            "core.py": "[FILE] 54 lines",
            "key.py": "[FILE] 859 lines",
            "parallel.py": "[FILE] 97 lines",
            "pem.py": "[FILE] 135 lines",
            "pkcs1.py": "[FILE] 486 lines",
            "pkcs1_v2.py": "[FILE] 101 lines",
            "prime.py": "[FILE] 199 lines",
            "py.typed": "[BINARY] 63 bytes",
            "randnum.py": "[FILE] 96 lines",
            "transform.py": "[FILE] 73 lines",
            "util.py": "[FILE] 98 lines"
          },
          "rsa-4.9.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 577 bytes",
            "METADATA": "[BINARY] 5590 bytes",
            "RECORD": "[BINARY] 2590 bytes",
            "WHEEL": "[BINARY] 88 bytes",
            "entry_points.txt": "[BINARY] 201 bytes"
          },
          "six-1.17.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 1066 bytes",
            "METADATA": "[BINARY] 1658 bytes",
            "RECORD": "[BINARY] 561 bytes",
            "WHEEL": "[BINARY] 109 bytes",
            "top_level.txt": "[BINARY] 4 bytes"
          },
          "six.py": "[FILE] 1004 lines",
          "sniffio": {
            "__init__.py": "[FILE] 18 lines",
            "_impl.py": "[FILE] 96 lines",
            "_tests": {
              "__init__.py": "[FILE] 1 lines",
              "test_sniffio.py": "[FILE] 85 lines"
            },
            "_version.py": "[FILE] 4 lines",
            "py.typed": "[BINARY] 0 bytes"
          },
          "sniffio-1.3.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 185 bytes",
            "LICENSE.APACHE2": "[BINARY] 11358 bytes",
            "LICENSE.MIT": "[BINARY] 1046 bytes",
            "METADATA": "[BINARY] 3875 bytes",
            "RECORD": "[BINARY] 1388 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 8 bytes"
          },
          "sqlalchemy": {
            "__init__.py": "[FILE] 286 lines",
            "connectors": {
              "__init__.py": "[FILE] 19 lines",
              "aioodbc.py": "[FILE] 188 lines",
              "asyncio.py": "[FILE] 210 lines",
              "pyodbc.py": "[FILE] 248 lines"
            },
            "cyextension": {
              "__init__.py": "[FILE] 1 lines",
              "collections.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1947440 bytes",
              "collections.pyx": "[BINARY] 12323 bytes",
              "immutabledict.cpython-312-x86_64-linux-gnu.so": "[BINARY] 811232 bytes",
              "immutabledict.pxd": "[BINARY] 41 bytes",
              "immutabledict.pyx": "[BINARY] 3285 bytes",
              "processors.cpython-312-x86_64-linux-gnu.so": "[BINARY] 533968 bytes",
              "processors.pyx": "[BINARY] 1545 bytes",
              "resultproxy.cpython-312-x86_64-linux-gnu.so": "[BINARY] 626112 bytes",
              "resultproxy.pyx": "[BINARY] 2477 bytes",
              "util.cpython-312-x86_64-linux-gnu.so": "[BINARY] 958760 bytes",
              "util.pyx": "[BINARY] 2289 bytes"
            },
            "dialects": {
              "__init__.py": "[FILE] 62 lines",
              "_typing.py": "[FILE] 20 lines",
              "mssql": {
                "__init__.py": "[FILE] 89 lines",
                "aioodbc.py": "[FILE] 65 lines",
                "base.py": "[FILE] 4049 lines",
                "information_schema.py": "[FILE] 254 lines",
                "json.py": "[FILE] 128 lines",
                "provision.py": "[FILE] 147 lines",
                "pymssql.py": "[FILE] 126 lines",
                "pyodbc.py": "[FILE] 747 lines"
              },
              "mysql": {
                "__init__.py": "[FILE] 102 lines",
                "aiomysql.py": "[FILE] 326 lines",
                "asyncmy.py": "[FILE] 331 lines",
                "base.py": "[FILE] 3444 lines",
                "cymysql.py": "[FILE] 85 lines",
                "dml.py": "[FILE] 220 lines",
                "enumerated.py": "[FILE] 245 lines",
                "expression.py": "[FILE] 141 lines",
                "json.py": "[FILE] 82 lines",
                "mariadb.py": "[FILE] 33 lines",
                "mariadbconnector.py": "[FILE] 283 lines",
                "mysqlconnector.py": "[FILE] 180 lines",
                "mysqldb.py": "[FILE] 309 lines",
                "provision.py": "[FILE] 102 lines",
                "pymysql.py": "[FILE] 136 lines",
                "pyodbc.py": "[FILE] 139 lines",
                "reflection.py": "[FILE] 673 lines",
                "reserved_words.py": "[FILE] 568 lines",
                "types.py": "[FILE] 774 lines"
              },
              "oracle": {
                "__init__.py": "[FILE] 64 lines",
                "base.py": "[FILE] 3233 lines",
                "cx_oracle.py": "[FILE] 1485 lines",
                "dictionary.py": "[FILE] 507 lines",
                "oracledb.py": "[FILE] 110 lines",
                "provision.py": "[FILE] 215 lines",
                "types.py": "[FILE] 287 lines"
              },
              "postgresql": {
                "__init__.py": "[FILE] 164 lines",
                "_psycopg_common.py": "[FILE] 187 lines",
                "array.py": "[FILE] 427 lines",
                "asyncpg.py": "[FILE] 1262 lines",
                "base.py": "[FILE] 4891 lines",
                "dml.py": "[FILE] 311 lines",
                "ext.py": "[FILE] 497 lines",
                "hstore.py": "[FILE] 398 lines",
                "json.py": "[FILE] 326 lines",
                "named_types.py": "[FILE] 497 lines",
                "operators.py": "[FILE] 130 lines",
                "pg8000.py": "[FILE] 665 lines",
                "pg_catalog.py": "[FILE] 295 lines",
                "provision.py": "[FILE] 170 lines",
                "psycopg.py": "[FILE] 747 lines",
                "psycopg2.py": "[FILE] 877 lines",
                "psycopg2cffi.py": "[FILE] 62 lines",
                "ranges.py": "[FILE] 947 lines",
                "types.py": "[FILE] 313 lines"
              },
              "sqlite": {
                "__init__.py": "[FILE] 58 lines",
                "aiosqlite.py": "[FILE] 397 lines",
                "base.py": "[FILE] 2783 lines",
                "dml.py": "[FILE] 241 lines",
                "json.py": "[FILE] 87 lines",
                "provision.py": "[FILE] 193 lines",
                "pysqlcipher.py": "[FILE] 156 lines",
                "pysqlite.py": "[FILE] 754 lines"
              },
              "type_migration_guidelines.txt": "[BINARY] 8239 bytes"
            },
            "engine": {
              "__init__.py": "[FILE] 63 lines",
              "_py_processors.py": "[FILE] 137 lines",
              "_py_row.py": "[FILE] 123 lines",
              "_py_util.py": "[FILE] 69 lines",
              "base.py": "[FILE] 3366 lines",
              "characteristics.py": "[FILE] 76 lines",
              "create.py": "[FILE] 861 lines",
              "cursor.py": "[FILE] 2150 lines",
              "default.py": "[FILE] 2324 lines",
              "events.py": "[FILE] 952 lines",
              "interfaces.py": "[FILE] 3407 lines",
              "mock.py": "[FILE] 132 lines",
              "processors.py": "[FILE] 62 lines",
              "reflection.py": "[FILE] 2090 lines",
              "result.py": "[FILE] 2406 lines",
              "row.py": "[FILE] 406 lines",
              "strategies.py": "[FILE] 20 lines",
              "url.py": "[FILE] 914 lines",
              "util.py": "[FILE] 167 lines"
            },
            "event": {
              "__init__.py": "[FILE] 26 lines",
              "api.py": "[FILE] 226 lines",
              "attr.py": "[FILE] 642 lines",
              "base.py": "[FILE] 466 lines",
              "legacy.py": "[FILE] 247 lines",
              "registry.py": "[FILE] 387 lines"
            },
            "events.py": "[FILE] 18 lines",
            "exc.py": "[FILE] 834 lines",
            "ext": {
              "__init__.py": "[FILE] 12 lines",
              "associationproxy.py": "[FILE] 2029 lines",
              "asyncio": {
                "__init__.py": "[FILE] 26 lines",
                "base.py": "[FILE] 284 lines",
                "engine.py": "[FILE] 1469 lines",
                "exc.py": "[FILE] 22 lines",
                "result.py": "[FILE] 977 lines",
                "scoping.py": "[FILE] 1626 lines",
                "session.py": "[FILE] 1941 lines"
              },
              "automap.py": "[FILE] 1659 lines",
              "baked.py": "[FILE] 575 lines",
              "compiler.py": "[FILE] 556 lines",
              "declarative": {
                "__init__.py": "[FILE] 66 lines",
                "extensions.py": "[FILE] 549 lines"
              },
              "horizontal_shard.py": "[FILE] 484 lines",
              "hybrid.py": "[FILE] 1525 lines",
              "indexable.py": "[FILE] 342 lines",
              "instrumentation.py": "[FILE] 453 lines",
              "mutable.py": "[FILE] 1079 lines",
              "mypy": {
                "__init__.py": "[FILE] 1 lines",
                "apply.py": "[FILE] 319 lines",
                "decl_class.py": "[FILE] 516 lines",
                "infer.py": "[FILE] 591 lines",
                "names.py": "[FILE] 343 lines",
                "plugin.py": "[FILE] 304 lines",
                "util.py": "[FILE] 339 lines"
              },
              "orderinglist.py": "[FILE] 417 lines",
              "serializer.py": "[FILE] 186 lines"
            },
            "future": {
              "__init__.py": "[FILE] 17 lines",
              "engine.py": "[FILE] 16 lines"
            },
            "inspection.py": "[FILE] 182 lines",
            "log.py": "[FILE] 291 lines",
            "orm": {
              "__init__.py": "[FILE] 171 lines",
              "_orm_constructors.py": "[FILE] 2484 lines",
              "_typing.py": "[FILE] 186 lines",
              "attributes.py": "[FILE] 2843 lines",
              "base.py": "[FILE] 996 lines",
              "bulk_persistence.py": "[FILE] 2049 lines",
              "clsregistry.py": "[FILE] 573 lines",
              "collections.py": "[FILE] 1620 lines",
              "context.py": "[FILE] 3228 lines",
              "decl_api.py": "[FILE] 1887 lines",
              "decl_base.py": "[FILE] 2156 lines",
              "dependency.py": "[FILE] 1303 lines",
              "descriptor_props.py": "[FILE] 1075 lines",
              "dynamic.py": "[FILE] 300 lines",
              "evaluator.py": "[FILE] 369 lines",
              "events.py": "[FILE] 3249 lines",
              "exc.py": "[FILE] 228 lines",
              "identity.py": "[FILE] 303 lines",
              "instrumentation.py": "[FILE] 757 lines",
              "interfaces.py": "[FILE] 1466 lines",
              "loading.py": "[FILE] 1662 lines",
              "mapped_collection.py": "[FILE] 563 lines",
              "mapper.py": "[FILE] 4417 lines",
              "path_registry.py": "[FILE] 820 lines",
              "persistence.py": "[FILE] 1756 lines",
              "properties.py": "[FILE] 880 lines",
              "query.py": "[FILE] 3415 lines",
              "relationships.py": "[FILE] 3467 lines",
              "scoping.py": "[FILE] 2184 lines",
              "session.py": "[FILE] 5257 lines",
              "state.py": "[FILE] 1139 lines",
              "state_changes.py": "[FILE] 199 lines",
              "strategies.py": "[FILE] 3339 lines",
              "strategy_options.py": "[FILE] 2529 lines",
              "sync.py": "[FILE] 164 lines",
              "unitofwork.py": "[FILE] 797 lines",
              "util.py": "[FILE] 2408 lines",
              "writeonly.py": "[FILE] 682 lines"
            },
            "pool": {
              "__init__.py": "[FILE] 45 lines",
              "base.py": "[FILE] 1522 lines",
              "events.py": "[FILE] 371 lines",
              "impl.py": "[FILE] 553 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "schema.py": "[FILE] 71 lines",
            "sql": {
              "__init__.py": "[FILE] 146 lines",
              "_dml_constructors.py": "[FILE] 141 lines",
              "_elements_constructors.py": "[FILE] 1851 lines",
              "_orm_types.py": "[FILE] 21 lines",
              "_py_util.py": "[FILE] 76 lines",
              "_selectable_constructors.py": "[FILE] 643 lines",
              "_typing.py": "[FILE] 457 lines",
              "annotation.py": "[FILE] 595 lines",
              "base.py": "[FILE] 2197 lines",
              "cache_key.py": "[FILE] 1030 lines",
              "coercions.py": "[FILE] 1407 lines",
              "compiler.py": "[FILE] 7656 lines",
              "crud.py": "[FILE] 1672 lines",
              "ddl.py": "[FILE] 1378 lines",
              "default_comparator.py": "[FILE] 550 lines",
              "dml.py": "[FILE] 1836 lines",
              "elements.py": "[FILE] 5406 lines",
              "events.py": "[FILE] 456 lines",
              "expression.py": "[FILE] 163 lines",
              "functions.py": "[FILE] 1829 lines",
              "lambdas.py": "[FILE] 1451 lines",
              "naming.py": "[FILE] 213 lines",
              "operators.py": "[FILE] 2597 lines",
              "roles.py": "[FILE] 326 lines",
              "schema.py": "[FILE] 6119 lines",
              "selectable.py": "[FILE] 6935 lines",
              "sqltypes.py": "[FILE] 3851 lines",
              "traversals.py": "[FILE] 1022 lines",
              "type_api.py": "[FILE] 2327 lines",
              "util.py": "[FILE] 1500 lines",
              "visitors.py": "[FILE] 1182 lines"
            },
            "testing": {
              "__init__.py": "[FILE] 96 lines",
              "assertions.py": "[FILE] 990 lines",
              "assertsql.py": "[FILE] 517 lines",
              "asyncio.py": "[FILE] 131 lines",
              "config.py": "[FILE] 425 lines",
              "engines.py": "[FILE] 470 lines",
              "entities.py": "[FILE] 118 lines",
              "exclusions.py": "[FILE] 436 lines",
              "fixtures": {
                "__init__.py": "[FILE] 29 lines",
                "base.py": "[FILE] 367 lines",
                "mypy.py": "[FILE] 309 lines",
                "orm.py": "[FILE] 228 lines",
                "sql.py": "[FILE] 493 lines"
              },
              "pickleable.py": "[FILE] 156 lines",
              "plugin": {
                "__init__.py": "[FILE] 1 lines",
                "bootstrap.py": "[FILE] 46 lines",
                "plugin_base.py": "[FILE] 780 lines",
                "pytestplugin.py": "[FILE] 857 lines"
              },
              "profiling.py": "[FILE] 325 lines",
              "provision.py": "[FILE] 487 lines",
              "requirements.py": "[FILE] 1766 lines",
              "schema.py": "[FILE] 225 lines",
              "suite": {
                "__init__.py": "[FILE] 14 lines",
                "test_cte.py": "[FILE] 206 lines",
                "test_ddl.py": "[FILE] 384 lines",
                "test_deprecations.py": "[FILE] 148 lines",
                "test_dialect.py": "[FILE] 735 lines",
                "test_insert.py": "[FILE] 615 lines",
                "test_reflection.py": "[FILE] 3123 lines",
                "test_results.py": "[FILE] 463 lines",
                "test_rowcount.py": "[FILE] 253 lines",
                "test_select.py": "[FILE] 1883 lines",
                "test_sequence.py": "[FILE] 312 lines",
                "test_types.py": "[FILE] 2066 lines",
                "test_unicode_ddl.py": "[FILE] 184 lines",
                "test_update_delete.py": "[FILE] 130 lines"
              },
              "util.py": "[FILE] 520 lines",
              "warnings.py": "[FILE] 53 lines"
            },
            "types.py": "[FILE] 77 lines",
            "util": {
              "__init__.py": "[FILE] 160 lines",
              "_collections.py": "[FILE] 724 lines",
              "_concurrency_py3k.py": "[FILE] 261 lines",
              "_has_cy.py": "[FILE] 40 lines",
              "_py_collections.py": "[FILE] 540 lines",
              "compat.py": "[FILE] 321 lines",
              "concurrency.py": "[FILE] 70 lines",
              "deprecations.py": "[FILE] 402 lines",
              "langhelpers.py": "[FILE] 2219 lines",
              "preloaded.py": "[FILE] 151 lines",
              "queue.py": "[FILE] 325 lines",
              "tool_support.py": "[FILE] 199 lines",
              "topological.py": "[FILE] 121 lines",
              "typing.py": "[FILE] 575 lines"
            }
          },
          "starlette": {
            "__init__.py": "[FILE] 2 lines",
            "_compat.py": "[FILE] 29 lines",
            "_utils.py": "[FILE] 75 lines",
            "applications.py": "[FILE] 262 lines",
            "authentication.py": "[FILE] 154 lines",
            "background.py": "[FILE] 44 lines",
            "concurrency.py": "[FILE] 66 lines",
            "config.py": "[FILE] 150 lines",
            "convertors.py": "[FILE] 88 lines",
            "datastructures.py": "[FILE] 709 lines",
            "endpoints.py": "[FILE] 131 lines",
            "exceptions.py": "[FILE] 55 lines",
            "formparsers.py": "[FILE] 277 lines",
            "middleware": {
              "__init__.py": "[FILE] 18 lines",
              "authentication.py": "[FILE] 53 lines",
              "base.py": "[FILE] 135 lines",
              "cors.py": "[FILE] 177 lines",
              "errors.py": "[FILE] 257 lines",
              "exceptions.py": "[FILE] 110 lines",
              "gzip.py": "[FILE] 114 lines",
              "httpsredirect.py": "[FILE] 20 lines",
              "sessions.py": "[FILE] 87 lines",
              "trustedhost.py": "[FILE] 61 lines",
              "wsgi.py": "[FILE] 141 lines"
            },
            "py.typed": "[BINARY] 0 bytes",
            "requests.py": "[FILE] 319 lines",
            "responses.py": "[FILE] 367 lines",
            "routing.py": "[FILE] 863 lines",
            "schemas.py": "[FILE] 146 lines",
            "staticfiles.py": "[FILE] 247 lines",
            "status.py": "[FILE] 200 lines",
            "templating.py": "[FILE] 121 lines",
            "testclient.py": "[FILE] 798 lines",
            "types.py": "[FILE] 18 lines",
            "websockets.py": "[FILE] 194 lines"
          },
          "starlette-0.27.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 5836 bytes",
            "RECORD": "[BINARY] 5166 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 28 lines"
            }
          },
          "structlog": {
            "__init__.py": "[FILE] 129 lines",
            "_base.py": "[FILE] 239 lines",
            "_config.py": "[FILE] 432 lines",
            "_frames.py": "[FILE] 84 lines",
            "_generic.py": "[FILE] 55 lines",
            "_greenlets.py": "[FILE] 45 lines",
            "_log_levels.py": "[FILE] 76 lines",
            "_native.py": "[FILE] 236 lines",
            "_output.py": "[FILE] 349 lines",
            "_utils.py": "[FILE] 60 lines",
            "contextvars.py": "[FILE] 188 lines",
            "dev.py": "[FILE] 784 lines",
            "exceptions.py": "[FILE] 19 lines",
            "processors.py": "[FILE] 900 lines",
            "py.typed": "[BINARY] 0 bytes",
            "stdlib.py": "[FILE] 1135 lines",
            "testing.py": "[FILE] 209 lines",
            "threadlocal.py": "[FILE] 355 lines",
            "tracebacks.py": "[FILE] 285 lines",
            "twisted.py": "[FILE] 331 lines",
            "types.py": "[FILE] 39 lines",
            "typing.py": "[FILE] 312 lines"
          },
          "structlog-24.1.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6941 bytes",
            "RECORD": "[BINARY] 3485 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE-APACHE": "[BINARY] 10174 bytes",
              "LICENSE-MIT": "[BINARY] 1113 bytes",
              "NOTICE": "[BINARY] 72 bytes"
            }
          },
          "tenacity": {
            "__init__.py": "[FILE] 607 lines",
            "_asyncio.py": "[FILE] 95 lines",
            "_utils.py": "[FILE] 77 lines",
            "after.py": "[FILE] 52 lines",
            "before.py": "[FILE] 47 lines",
            "before_sleep.py": "[FILE] 72 lines",
            "nap.py": "[FILE] 44 lines",
            "py.typed": "[BINARY] 0 bytes",
            "retry.py": "[FILE] 273 lines",
            "stop.py": "[FILE] 104 lines",
            "tornadoweb.py": "[FILE] 60 lines",
            "wait.py": "[FILE] 229 lines"
          },
          "tenacity-8.2.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 11357 bytes",
            "METADATA": "[BINARY] 1049 bytes",
            "RECORD": "[BINARY] 2010 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 9 bytes"
          },
          "typing_extensions-4.15.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 3259 bytes",
            "RECORD": "[BINARY] 580 bytes",
            "WHEEL": "[BINARY] 82 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 13936 bytes"
            }
          },
          "typing_extensions.py": "[FILE] 4318 lines",
          "tzdata": {
            "__init__.py": "[FILE] 7 lines",
            "zoneinfo": {
              "Africa": {
                "Abidjan": "[BINARY] 130 bytes",
                "Accra": "[BINARY] 130 bytes",
                "Addis_Ababa": "[BINARY] 191 bytes",
                "Algiers": "[BINARY] 470 bytes",
                "Asmara": "[BINARY] 191 bytes",
                "Asmera": "[BINARY] 191 bytes",
                "Bamako": "[BINARY] 130 bytes",
                "Bangui": "[BINARY] 180 bytes",
                "Banjul": "[BINARY] 130 bytes",
                "Bissau": "[BINARY] 149 bytes",
                "Blantyre": "[BINARY] 131 bytes",
                "Brazzaville": "[BINARY] 180 bytes",
                "Bujumbura": "[BINARY] 131 bytes",
                "Cairo": "[BINARY] 1309 bytes",
                "Casablanca": "[BINARY] 1919 bytes",
                "Ceuta": "[BINARY] 562 bytes",
                "Conakry": "[BINARY] 130 bytes",
                "Dakar": "[BINARY] 130 bytes",
                "Dar_es_Salaam": "[BINARY] 191 bytes",
                "Djibouti": "[BINARY] 191 bytes",
                "Douala": "[BINARY] 180 bytes",
                "El_Aaiun": "[BINARY] 1830 bytes",
                "Freetown": "[BINARY] 130 bytes",
                "Gaborone": "[BINARY] 131 bytes",
                "Harare": "[BINARY] 131 bytes",
                "Johannesburg": "[BINARY] 190 bytes",
                "Juba": "[BINARY] 458 bytes",
                "Kampala": "[BINARY] 191 bytes",
                "Khartoum": "[BINARY] 458 bytes",
                "Kigali": "[BINARY] 131 bytes",
                "Kinshasa": "[BINARY] 180 bytes",
                "Lagos": "[BINARY] 180 bytes",
                "Libreville": "[BINARY] 180 bytes",
                "Lome": "[BINARY] 130 bytes",
                "Luanda": "[BINARY] 180 bytes",
                "Lubumbashi": "[BINARY] 131 bytes",
                "Lusaka": "[BINARY] 131 bytes",
                "Malabo": "[BINARY] 180 bytes",
                "Maputo": "[BINARY] 131 bytes",
                "Maseru": "[BINARY] 190 bytes",
                "Mbabane": "[BINARY] 190 bytes",
                "Mogadishu": "[BINARY] 191 bytes",
                "Monrovia": "[BINARY] 164 bytes",
                "Nairobi": "[BINARY] 191 bytes",
                "Ndjamena": "[BINARY] 160 bytes",
                "Niamey": "[BINARY] 180 bytes",
                "Nouakchott": "[BINARY] 130 bytes",
                "Ouagadougou": "[BINARY] 130 bytes",
                "Porto-Novo": "[BINARY] 180 bytes",
                "Sao_Tome": "[BINARY] 173 bytes",
                "Timbuktu": "[BINARY] 130 bytes",
                "Tripoli": "[BINARY] 431 bytes",
                "Tunis": "[BINARY] 449 bytes",
                "Windhoek": "[BINARY] 638 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "America": {
                "Adak": "[BINARY] 969 bytes",
                "Anchorage": "[BINARY] 977 bytes",
                "Anguilla": "[BINARY] 177 bytes",
                "Antigua": "[BINARY] 177 bytes",
                "Araguaina": "[BINARY] 592 bytes",
                "Argentina": {
                  "Buenos_Aires": "[BINARY] 708 bytes",
                  "Catamarca": "[BINARY] 708 bytes",
                  "ComodRivadavia": "[BINARY] 708 bytes",
                  "Cordoba": "[BINARY] 708 bytes",
                  "Jujuy": "[BINARY] 690 bytes",
                  "La_Rioja": "[BINARY] 717 bytes",
                  "Mendoza": "[BINARY] 708 bytes",
                  "Rio_Gallegos": "[BINARY] 708 bytes",
                  "Salta": "[BINARY] 690 bytes",
                  "San_Juan": "[BINARY] 717 bytes",
                  "San_Luis": "[BINARY] 717 bytes",
                  "Tucuman": "[BINARY] 726 bytes",
                  "Ushuaia": "[BINARY] 708 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Aruba": "[BINARY] 177 bytes",
                "Asuncion": "[BINARY] 1085 bytes",
                "Atikokan": "[BINARY] 149 bytes",
                "Atka": "[BINARY] 969 bytes",
                "Bahia": "[BINARY] 682 bytes",
                "Bahia_Banderas": "[BINARY] 700 bytes",
                "Barbados": "[BINARY] 278 bytes",
                "Belem": "[BINARY] 394 bytes",
                "Belize": "[BINARY] 1045 bytes",
                "Blanc-Sablon": "[BINARY] 177 bytes",
                "Boa_Vista": "[BINARY] 430 bytes",
                "Bogota": "[BINARY] 179 bytes",
                "Boise": "[BINARY] 999 bytes",
                "Buenos_Aires": "[BINARY] 708 bytes",
                "Cambridge_Bay": "[BINARY] 883 bytes",
                "Campo_Grande": "[BINARY] 952 bytes",
                "Cancun": "[BINARY] 538 bytes",
                "Caracas": "[BINARY] 190 bytes",
                "Catamarca": "[BINARY] 708 bytes",
                "Cayenne": "[BINARY] 151 bytes",
                "Cayman": "[BINARY] 149 bytes",
                "Chicago": "[BINARY] 1754 bytes",
                "Chihuahua": "[BINARY] 691 bytes",
                "Ciudad_Juarez": "[BINARY] 718 bytes",
                "Coral_Harbour": "[BINARY] 149 bytes",
                "Cordoba": "[BINARY] 708 bytes",
                "Costa_Rica": "[BINARY] 232 bytes",
                "Coyhaique": "[BINARY] 1362 bytes",
                "Creston": "[BINARY] 240 bytes",
                "Cuiaba": "[BINARY] 934 bytes",
                "Curacao": "[BINARY] 177 bytes",
                "Danmarkshavn": "[BINARY] 447 bytes",
                "Dawson": "[BINARY] 1029 bytes",
                "Dawson_Creek": "[BINARY] 683 bytes",
                "Denver": "[BINARY] 1042 bytes",
                "Detroit": "[BINARY] 899 bytes",
                "Dominica": "[BINARY] 177 bytes",
                "Edmonton": "[BINARY] 970 bytes",
                "Eirunepe": "[BINARY] 436 bytes",
                "El_Salvador": "[BINARY] 176 bytes",
                "Ensenada": "[BINARY] 1367 bytes",
                "Fort_Nelson": "[BINARY] 1448 bytes",
                "Fort_Wayne": "[BINARY] 531 bytes",
                "Fortaleza": "[BINARY] 484 bytes",
                "Glace_Bay": "[BINARY] 880 bytes",
                "Godthab": "[BINARY] 965 bytes",
                "Goose_Bay": "[BINARY] 1580 bytes",
                "Grand_Turk": "[BINARY] 853 bytes",
                "Grenada": "[BINARY] 177 bytes",
                "Guadeloupe": "[BINARY] 177 bytes",
                "Guatemala": "[BINARY] 212 bytes",
                "Guayaquil": "[BINARY] 179 bytes",
                "Guyana": "[BINARY] 181 bytes",
                "Halifax": "[BINARY] 1672 bytes",
                "Havana": "[BINARY] 1117 bytes",
                "Hermosillo": "[BINARY] 258 bytes",
                "Indiana": {
                  "Indianapolis": "[BINARY] 531 bytes",
                  "Knox": "[BINARY] 1016 bytes",
                  "Marengo": "[BINARY] 567 bytes",
                  "Petersburg": "[BINARY] 683 bytes",
                  "Tell_City": "[BINARY] 522 bytes",
                  "Vevay": "[BINARY] 369 bytes",
                  "Vincennes": "[BINARY] 558 bytes",
                  "Winamac": "[BINARY] 603 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Indianapolis": "[BINARY] 531 bytes",
                "Inuvik": "[BINARY] 817 bytes",
                "Iqaluit": "[BINARY] 855 bytes",
                "Jamaica": "[BINARY] 339 bytes",
                "Jujuy": "[BINARY] 690 bytes",
                "Juneau": "[BINARY] 966 bytes",
                "Kentucky": {
                  "Louisville": "[BINARY] 1242 bytes",
                  "Monticello": "[BINARY] 972 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Knox_IN": "[BINARY] 1016 bytes",
                "Kralendijk": "[BINARY] 177 bytes",
                "La_Paz": "[BINARY] 170 bytes",
                "Lima": "[BINARY] 283 bytes",
                "Los_Angeles": "[BINARY] 1294 bytes",
                "Louisville": "[BINARY] 1242 bytes",
                "Lower_Princes": "[BINARY] 177 bytes",
                "Maceio": "[BINARY] 502 bytes",
                "Managua": "[BINARY] 295 bytes",
                "Manaus": "[BINARY] 412 bytes",
                "Marigot": "[BINARY] 177 bytes",
                "Martinique": "[BINARY] 178 bytes",
                "Matamoros": "[BINARY] 437 bytes",
                "Mazatlan": "[BINARY] 690 bytes",
                "Mendoza": "[BINARY] 708 bytes",
                "Menominee": "[BINARY] 917 bytes",
                "Merida": "[BINARY] 654 bytes",
                "Metlakatla": "[BINARY] 586 bytes",
                "Mexico_City": "[BINARY] 773 bytes",
                "Miquelon": "[BINARY] 550 bytes",
                "Moncton": "[BINARY] 1493 bytes",
                "Monterrey": "[BINARY] 709 bytes",
                "Montevideo": "[BINARY] 969 bytes",
                "Montreal": "[BINARY] 1717 bytes",
                "Montserrat": "[BINARY] 177 bytes",
                "Nassau": "[BINARY] 1717 bytes",
                "New_York": "[BINARY] 1744 bytes",
                "Nipigon": "[BINARY] 1717 bytes",
                "Nome": "[BINARY] 975 bytes",
                "Noronha": "[BINARY] 484 bytes",
                "North_Dakota": {
                  "Beulah": "[BINARY] 1043 bytes",
                  "Center": "[BINARY] 990 bytes",
                  "New_Salem": "[BINARY] 990 bytes",
                  "__init__.py": "[FILE] 1 lines"
                },
                "Nuuk": "[BINARY] 965 bytes",
                "Ojinaga": "[BINARY] 718 bytes",
                "Panama": "[BINARY] 149 bytes",
                "Pangnirtung": "[BINARY] 855 bytes",
                "Paramaribo": "[BINARY] 187 bytes",
                "Phoenix": "[BINARY] 240 bytes",
                "Port-au-Prince": "[BINARY] 565 bytes",
                "Port_of_Spain": "[BINARY] 177 bytes",
                "Porto_Acre": "[BINARY] 418 bytes",
                "Porto_Velho": "[BINARY] 394 bytes",
                "Puerto_Rico": "[BINARY] 177 bytes",
                "Punta_Arenas": "[BINARY] 1218 bytes",
                "Rainy_River": "[BINARY] 1294 bytes",
                "Rankin_Inlet": "[BINARY] 807 bytes",
                "Recife": "[BINARY] 484 bytes",
                "Regina": "[BINARY] 638 bytes",
                "Resolute": "[BINARY] 807 bytes",
                "Rio_Branco": "[BINARY] 418 bytes",
                "Rosario": "[BINARY] 708 bytes",
                "Santa_Isabel": "[BINARY] 1367 bytes",
                "Santarem": "[BINARY] 409 bytes",
                "Santiago": "[BINARY] 1354 bytes",
                "Santo_Domingo": "[BINARY] 317 bytes",
                "Sao_Paulo": "[BINARY] 952 bytes",
                "Scoresbysund": "[BINARY] 984 bytes",
                "Shiprock": "[BINARY] 1042 bytes",
                "Sitka": "[BINARY] 956 bytes",
                "St_Barthelemy": "[BINARY] 177 bytes",
                "St_Johns": "[BINARY] 1878 bytes",
                "St_Kitts": "[BINARY] 177 bytes",
                "St_Lucia": "[BINARY] 177 bytes",
                "St_Thomas": "[BINARY] 177 bytes",
                "St_Vincent": "[BINARY] 177 bytes",
                "Swift_Current": "[BINARY] 368 bytes",
                "Tegucigalpa": "[BINARY] 194 bytes",
                "Thule": "[BINARY] 455 bytes",
                "Thunder_Bay": "[BINARY] 1717 bytes",
                "Tijuana": "[BINARY] 1367 bytes",
                "Toronto": "[BINARY] 1717 bytes",
                "Tortola": "[BINARY] 177 bytes",
                "Vancouver": "[BINARY] 1330 bytes",
                "Virgin": "[BINARY] 177 bytes",
                "Whitehorse": "[BINARY] 1029 bytes",
                "Winnipeg": "[BINARY] 1294 bytes",
                "Yakutat": "[BINARY] 946 bytes",
                "Yellowknife": "[BINARY] 970 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Antarctica": {
                "Casey": "[BINARY] 287 bytes",
                "Davis": "[BINARY] 197 bytes",
                "DumontDUrville": "[BINARY] 154 bytes",
                "Macquarie": "[BINARY] 976 bytes",
                "Mawson": "[BINARY] 152 bytes",
                "McMurdo": "[BINARY] 1043 bytes",
                "Palmer": "[BINARY] 887 bytes",
                "Rothera": "[BINARY] 132 bytes",
                "South_Pole": "[BINARY] 1043 bytes",
                "Syowa": "[BINARY] 133 bytes",
                "Troll": "[BINARY] 158 bytes",
                "Vostok": "[BINARY] 170 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Arctic": {
                "Longyearbyen": "[BINARY] 705 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Asia": {
                "Aden": "[BINARY] 133 bytes",
                "Almaty": "[BINARY] 618 bytes",
                "Amman": "[BINARY] 928 bytes",
                "Anadyr": "[BINARY] 743 bytes",
                "Aqtau": "[BINARY] 606 bytes",
                "Aqtobe": "[BINARY] 615 bytes",
                "Ashgabat": "[BINARY] 375 bytes",
                "Ashkhabad": "[BINARY] 375 bytes",
                "Atyrau": "[BINARY] 616 bytes",
                "Baghdad": "[BINARY] 630 bytes",
                "Bahrain": "[BINARY] 152 bytes",
                "Baku": "[BINARY] 744 bytes",
                "Bangkok": "[BINARY] 152 bytes",
                "Barnaul": "[BINARY] 753 bytes",
                "Beirut": "[BINARY] 732 bytes",
                "Bishkek": "[BINARY] 618 bytes",
                "Brunei": "[BINARY] 320 bytes",
                "Calcutta": "[BINARY] 220 bytes",
                "Chita": "[BINARY] 750 bytes",
                "Choibalsan": "[BINARY] 594 bytes",
                "Chongqing": "[BINARY] 393 bytes",
                "Chungking": "[BINARY] 393 bytes",
                "Colombo": "[BINARY] 247 bytes",
                "Dacca": "[BINARY] 231 bytes",
                "Damascus": "[BINARY] 1234 bytes",
                "Dhaka": "[BINARY] 231 bytes",
                "Dili": "[BINARY] 170 bytes",
                "Dubai": "[BINARY] 133 bytes",
                "Dushanbe": "[BINARY] 366 bytes",
                "Famagusta": "[BINARY] 940 bytes",
                "Gaza": "[BINARY] 2950 bytes",
                "Harbin": "[BINARY] 393 bytes",
                "Hebron": "[BINARY] 2968 bytes",
                "Ho_Chi_Minh": "[BINARY] 236 bytes",
                "Hong_Kong": "[BINARY] 775 bytes",
                "Hovd": "[BINARY] 594 bytes",
                "Irkutsk": "[BINARY] 760 bytes",
                "Istanbul": "[BINARY] 1200 bytes",
                "Jakarta": "[BINARY] 248 bytes",
                "Jayapura": "[BINARY] 171 bytes",
                "Jerusalem": "[BINARY] 1074 bytes",
                "Kabul": "[BINARY] 159 bytes",
                "Kamchatka": "[BINARY] 727 bytes",
                "Karachi": "[BINARY] 266 bytes",
                "Kashgar": "[BINARY] 133 bytes",
                "Kathmandu": "[BINARY] 161 bytes",
                "Katmandu": "[BINARY] 161 bytes",
                "Khandyga": "[BINARY] 775 bytes",
                "Kolkata": "[BINARY] 220 bytes",
                "Krasnoyarsk": "[BINARY] 741 bytes",
                "Kuala_Lumpur": "[BINARY] 256 bytes",
                "Kuching": "[BINARY] 320 bytes",
                "Kuwait": "[BINARY] 133 bytes",
                "Macao": "[BINARY] 791 bytes",
                "Macau": "[BINARY] 791 bytes",
                "Magadan": "[BINARY] 751 bytes",
                "Makassar": "[BINARY] 190 bytes",
                "Manila": "[BINARY] 274 bytes",
                "Muscat": "[BINARY] 133 bytes",
                "Nicosia": "[BINARY] 597 bytes",
                "Novokuznetsk": "[BINARY] 726 bytes",
                "Novosibirsk": "[BINARY] 753 bytes",
                "Omsk": "[BINARY] 741 bytes",
                "Oral": "[BINARY] 625 bytes",
                "Phnom_Penh": "[BINARY] 152 bytes",
                "Pontianak": "[BINARY] 247 bytes",
                "Pyongyang": "[BINARY] 183 bytes",
                "Qatar": "[BINARY] 152 bytes",
                "Qostanay": "[BINARY] 624 bytes",
                "Qyzylorda": "[BINARY] 624 bytes",
                "Rangoon": "[BINARY] 187 bytes",
                "Riyadh": "[BINARY] 133 bytes",
                "Saigon": "[BINARY] 236 bytes",
                "Sakhalin": "[BINARY] 755 bytes",
                "Samarkand": "[BINARY] 366 bytes",
                "Seoul": "[BINARY] 415 bytes",
                "Shanghai": "[BINARY] 393 bytes",
                "Singapore": "[BINARY] 256 bytes",
                "Srednekolymsk": "[BINARY] 742 bytes",
                "Taipei": "[BINARY] 511 bytes",
                "Tashkent": "[BINARY] 366 bytes",
                "Tbilisi": "[BINARY] 629 bytes",
                "Tehran": "[BINARY] 812 bytes",
                "Tel_Aviv": "[BINARY] 1074 bytes",
                "Thimbu": "[BINARY] 154 bytes",
                "Thimphu": "[BINARY] 154 bytes",
                "Tokyo": "[BINARY] 213 bytes",
                "Tomsk": "[BINARY] 753 bytes",
                "Ujung_Pandang": "[BINARY] 190 bytes",
                "Ulaanbaatar": "[BINARY] 594 bytes",
                "Ulan_Bator": "[BINARY] 594 bytes",
                "Urumqi": "[BINARY] 133 bytes",
                "Ust-Nera": "[BINARY] 771 bytes",
                "Vientiane": "[BINARY] 152 bytes",
                "Vladivostok": "[BINARY] 742 bytes",
                "Yakutsk": "[BINARY] 741 bytes",
                "Yangon": "[BINARY] 187 bytes",
                "Yekaterinburg": "[BINARY] 760 bytes",
                "Yerevan": "[BINARY] 708 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Atlantic": {
                "Azores": "[BINARY] 1401 bytes",
                "Bermuda": "[BINARY] 1024 bytes",
                "Canary": "[BINARY] 478 bytes",
                "Cape_Verde": "[BINARY] 175 bytes",
                "Faeroe": "[BINARY] 441 bytes",
                "Faroe": "[BINARY] 441 bytes",
                "Jan_Mayen": "[BINARY] 705 bytes",
                "Madeira": "[BINARY] 1372 bytes",
                "Reykjavik": "[BINARY] 130 bytes",
                "South_Georgia": "[BINARY] 132 bytes",
                "St_Helena": "[BINARY] 130 bytes",
                "Stanley": "[BINARY] 789 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Australia": {
                "ACT": "[BINARY] 904 bytes",
                "Adelaide": "[BINARY] 921 bytes",
                "Brisbane": "[BINARY] 289 bytes",
                "Broken_Hill": "[BINARY] 941 bytes",
                "Canberra": "[BINARY] 904 bytes",
                "Currie": "[BINARY] 1003 bytes",
                "Darwin": "[BINARY] 234 bytes",
                "Eucla": "[BINARY] 314 bytes",
                "Hobart": "[BINARY] 1003 bytes",
                "LHI": "[BINARY] 692 bytes",
                "Lindeman": "[BINARY] 325 bytes",
                "Lord_Howe": "[BINARY] 692 bytes",
                "Melbourne": "[BINARY] 904 bytes",
                "NSW": "[BINARY] 904 bytes",
                "North": "[BINARY] 234 bytes",
                "Perth": "[BINARY] 306 bytes",
                "Queensland": "[BINARY] 289 bytes",
                "South": "[BINARY] 921 bytes",
                "Sydney": "[BINARY] 904 bytes",
                "Tasmania": "[BINARY] 1003 bytes",
                "Victoria": "[BINARY] 904 bytes",
                "West": "[BINARY] 306 bytes",
                "Yancowinna": "[BINARY] 941 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Brazil": {
                "Acre": "[BINARY] 418 bytes",
                "DeNoronha": "[BINARY] 484 bytes",
                "East": "[BINARY] 952 bytes",
                "West": "[BINARY] 412 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "CET": "[BINARY] 1103 bytes",
              "CST6CDT": "[BINARY] 1754 bytes",
              "Canada": {
                "Atlantic": "[BINARY] 1672 bytes",
                "Central": "[BINARY] 1294 bytes",
                "Eastern": "[BINARY] 1717 bytes",
                "Mountain": "[BINARY] 970 bytes",
                "Newfoundland": "[BINARY] 1878 bytes",
                "Pacific": "[BINARY] 1330 bytes",
                "Saskatchewan": "[BINARY] 638 bytes",
                "Yukon": "[BINARY] 1029 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Chile": {
                "Continental": "[BINARY] 1354 bytes",
                "EasterIsland": "[BINARY] 1174 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Cuba": "[BINARY] 1117 bytes",
              "EET": "[BINARY] 682 bytes",
              "EST": "[BINARY] 149 bytes",
              "EST5EDT": "[BINARY] 1744 bytes",
              "Egypt": "[BINARY] 1309 bytes",
              "Eire": "[BINARY] 1496 bytes",
              "Etc": {
                "GMT": "[BINARY] 111 bytes",
                "GMT+0": "[BINARY] 111 bytes",
                "GMT+1": "[BINARY] 113 bytes",
                "GMT+10": "[BINARY] 114 bytes",
                "GMT+11": "[BINARY] 114 bytes",
                "GMT+12": "[BINARY] 114 bytes",
                "GMT+2": "[BINARY] 113 bytes",
                "GMT+3": "[BINARY] 113 bytes",
                "GMT+4": "[BINARY] 113 bytes",
                "GMT+5": "[BINARY] 113 bytes",
                "GMT+6": "[BINARY] 113 bytes",
                "GMT+7": "[BINARY] 113 bytes",
                "GMT+8": "[BINARY] 113 bytes",
                "GMT+9": "[BINARY] 113 bytes",
                "GMT-0": "[BINARY] 111 bytes",
                "GMT-1": "[BINARY] 114 bytes",
                "GMT-10": "[BINARY] 115 bytes",
                "GMT-11": "[BINARY] 115 bytes",
                "GMT-12": "[BINARY] 115 bytes",
                "GMT-13": "[BINARY] 115 bytes",
                "GMT-14": "[BINARY] 115 bytes",
                "GMT-2": "[BINARY] 114 bytes",
                "GMT-3": "[BINARY] 114 bytes",
                "GMT-4": "[BINARY] 114 bytes",
                "GMT-5": "[BINARY] 114 bytes",
                "GMT-6": "[BINARY] 114 bytes",
                "GMT-7": "[BINARY] 114 bytes",
                "GMT-8": "[BINARY] 114 bytes",
                "GMT-9": "[BINARY] 114 bytes",
                "GMT0": "[BINARY] 111 bytes",
                "Greenwich": "[BINARY] 111 bytes",
                "UCT": "[BINARY] 111 bytes",
                "UTC": "[BINARY] 111 bytes",
                "Universal": "[BINARY] 111 bytes",
                "Zulu": "[BINARY] 111 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Europe": {
                "Amsterdam": "[BINARY] 1103 bytes",
                "Andorra": "[BINARY] 389 bytes",
                "Astrakhan": "[BINARY] 726 bytes",
                "Athens": "[BINARY] 682 bytes",
                "Belfast": "[BINARY] 1599 bytes",
                "Belgrade": "[BINARY] 478 bytes",
                "Berlin": "[BINARY] 705 bytes",
                "Bratislava": "[BINARY] 723 bytes",
                "Brussels": "[BINARY] 1103 bytes",
                "Bucharest": "[BINARY] 661 bytes",
                "Budapest": "[BINARY] 766 bytes",
                "Busingen": "[BINARY] 497 bytes",
                "Chisinau": "[BINARY] 755 bytes",
                "Copenhagen": "[BINARY] 705 bytes",
                "Dublin": "[BINARY] 1496 bytes",
                "Gibraltar": "[BINARY] 1220 bytes",
                "Guernsey": "[BINARY] 1599 bytes",
                "Helsinki": "[BINARY] 481 bytes",
                "Isle_of_Man": "[BINARY] 1599 bytes",
                "Istanbul": "[BINARY] 1200 bytes",
                "Jersey": "[BINARY] 1599 bytes",
                "Kaliningrad": "[BINARY] 904 bytes",
                "Kiev": "[BINARY] 558 bytes",
                "Kirov": "[BINARY] 735 bytes",
                "Kyiv": "[BINARY] 558 bytes",
                "Lisbon": "[BINARY] 1463 bytes",
                "Ljubljana": "[BINARY] 478 bytes",
                "London": "[BINARY] 1599 bytes",
                "Luxembourg": "[BINARY] 1103 bytes",
                "Madrid": "[BINARY] 897 bytes",
                "Malta": "[BINARY] 928 bytes",
                "Mariehamn": "[BINARY] 481 bytes",
                "Minsk": "[BINARY] 808 bytes",
                "Monaco": "[BINARY] 1105 bytes",
                "Moscow": "[BINARY] 908 bytes",
                "Nicosia": "[BINARY] 597 bytes",
                "Oslo": "[BINARY] 705 bytes",
                "Paris": "[BINARY] 1105 bytes",
                "Podgorica": "[BINARY] 478 bytes",
                "Prague": "[BINARY] 723 bytes",
                "Riga": "[BINARY] 694 bytes",
                "Rome": "[BINARY] 947 bytes",
                "Samara": "[BINARY] 732 bytes",
                "San_Marino": "[BINARY] 947 bytes",
                "Sarajevo": "[BINARY] 478 bytes",
                "Saratov": "[BINARY] 726 bytes",
                "Simferopol": "[BINARY] 865 bytes",
                "Skopje": "[BINARY] 478 bytes",
                "Sofia": "[BINARY] 592 bytes",
                "Stockholm": "[BINARY] 705 bytes",
                "Tallinn": "[BINARY] 675 bytes",
                "Tirane": "[BINARY] 604 bytes",
                "Tiraspol": "[BINARY] 755 bytes",
                "Ulyanovsk": "[BINARY] 760 bytes",
                "Uzhgorod": "[BINARY] 558 bytes",
                "Vaduz": "[BINARY] 497 bytes",
                "Vatican": "[BINARY] 947 bytes",
                "Vienna": "[BINARY] 658 bytes",
                "Vilnius": "[BINARY] 676 bytes",
                "Volgograd": "[BINARY] 753 bytes",
                "Warsaw": "[BINARY] 923 bytes",
                "Zagreb": "[BINARY] 478 bytes",
                "Zaporozhye": "[BINARY] 558 bytes",
                "Zurich": "[BINARY] 497 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Factory": "[BINARY] 113 bytes",
              "GB": "[BINARY] 1599 bytes",
              "GB-Eire": "[BINARY] 1599 bytes",
              "GMT": "[BINARY] 111 bytes",
              "GMT+0": "[BINARY] 111 bytes",
              "GMT-0": "[BINARY] 111 bytes",
              "GMT0": "[BINARY] 111 bytes",
              "Greenwich": "[BINARY] 111 bytes",
              "HST": "[BINARY] 221 bytes",
              "Hongkong": "[BINARY] 775 bytes",
              "Iceland": "[BINARY] 130 bytes",
              "Indian": {
                "Antananarivo": "[BINARY] 191 bytes",
                "Chagos": "[BINARY] 152 bytes",
                "Christmas": "[BINARY] 152 bytes",
                "Cocos": "[BINARY] 187 bytes",
                "Comoro": "[BINARY] 191 bytes",
                "Kerguelen": "[BINARY] 152 bytes",
                "Mahe": "[BINARY] 133 bytes",
                "Maldives": "[BINARY] 152 bytes",
                "Mauritius": "[BINARY] 179 bytes",
                "Mayotte": "[BINARY] 191 bytes",
                "Reunion": "[BINARY] 133 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Iran": "[BINARY] 812 bytes",
              "Israel": "[BINARY] 1074 bytes",
              "Jamaica": "[BINARY] 339 bytes",
              "Japan": "[BINARY] 213 bytes",
              "Kwajalein": "[BINARY] 219 bytes",
              "Libya": "[BINARY] 431 bytes",
              "MET": "[BINARY] 1103 bytes",
              "MST": "[BINARY] 240 bytes",
              "MST7MDT": "[BINARY] 1042 bytes",
              "Mexico": {
                "BajaNorte": "[BINARY] 1367 bytes",
                "BajaSur": "[BINARY] 690 bytes",
                "General": "[BINARY] 773 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "NZ": "[BINARY] 1043 bytes",
              "NZ-CHAT": "[BINARY] 808 bytes",
              "Navajo": "[BINARY] 1042 bytes",
              "PRC": "[BINARY] 393 bytes",
              "PST8PDT": "[BINARY] 1294 bytes",
              "Pacific": {
                "Apia": "[BINARY] 407 bytes",
                "Auckland": "[BINARY] 1043 bytes",
                "Bougainville": "[BINARY] 201 bytes",
                "Chatham": "[BINARY] 808 bytes",
                "Chuuk": "[BINARY] 154 bytes",
                "Easter": "[BINARY] 1174 bytes",
                "Efate": "[BINARY] 342 bytes",
                "Enderbury": "[BINARY] 172 bytes",
                "Fakaofo": "[BINARY] 153 bytes",
                "Fiji": "[BINARY] 396 bytes",
                "Funafuti": "[BINARY] 134 bytes",
                "Galapagos": "[BINARY] 175 bytes",
                "Gambier": "[BINARY] 132 bytes",
                "Guadalcanal": "[BINARY] 134 bytes",
                "Guam": "[BINARY] 350 bytes",
                "Honolulu": "[BINARY] 221 bytes",
                "Johnston": "[BINARY] 221 bytes",
                "Kanton": "[BINARY] 172 bytes",
                "Kiritimati": "[BINARY] 174 bytes",
                "Kosrae": "[BINARY] 242 bytes",
                "Kwajalein": "[BINARY] 219 bytes",
                "Majuro": "[BINARY] 134 bytes",
                "Marquesas": "[BINARY] 139 bytes",
                "Midway": "[BINARY] 146 bytes",
                "Nauru": "[BINARY] 183 bytes",
                "Niue": "[BINARY] 154 bytes",
                "Norfolk": "[BINARY] 237 bytes",
                "Noumea": "[BINARY] 198 bytes",
                "Pago_Pago": "[BINARY] 146 bytes",
                "Palau": "[BINARY] 148 bytes",
                "Pitcairn": "[BINARY] 153 bytes",
                "Pohnpei": "[BINARY] 134 bytes",
                "Ponape": "[BINARY] 134 bytes",
                "Port_Moresby": "[BINARY] 154 bytes",
                "Rarotonga": "[BINARY] 406 bytes",
                "Saipan": "[BINARY] 350 bytes",
                "Samoa": "[BINARY] 146 bytes",
                "Tahiti": "[BINARY] 133 bytes",
                "Tarawa": "[BINARY] 134 bytes",
                "Tongatapu": "[BINARY] 237 bytes",
                "Truk": "[BINARY] 154 bytes",
                "Wake": "[BINARY] 134 bytes",
                "Wallis": "[BINARY] 134 bytes",
                "Yap": "[BINARY] 154 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "Poland": "[BINARY] 923 bytes",
              "Portugal": "[BINARY] 1463 bytes",
              "ROC": "[BINARY] 511 bytes",
              "ROK": "[BINARY] 415 bytes",
              "Singapore": "[BINARY] 256 bytes",
              "Turkey": "[BINARY] 1200 bytes",
              "UCT": "[BINARY] 111 bytes",
              "US": {
                "Alaska": "[BINARY] 977 bytes",
                "Aleutian": "[BINARY] 969 bytes",
                "Arizona": "[BINARY] 240 bytes",
                "Central": "[BINARY] 1754 bytes",
                "East-Indiana": "[BINARY] 531 bytes",
                "Eastern": "[BINARY] 1744 bytes",
                "Hawaii": "[BINARY] 221 bytes",
                "Indiana-Starke": "[BINARY] 1016 bytes",
                "Michigan": "[BINARY] 899 bytes",
                "Mountain": "[BINARY] 1042 bytes",
                "Pacific": "[BINARY] 1294 bytes",
                "Samoa": "[BINARY] 146 bytes",
                "__init__.py": "[FILE] 1 lines"
              },
              "UTC": "[BINARY] 111 bytes",
              "Universal": "[BINARY] 111 bytes",
              "W-SU": "[BINARY] 908 bytes",
              "WET": "[BINARY] 1463 bytes",
              "Zulu": "[BINARY] 111 bytes",
              "__init__.py": "[FILE] 1 lines",
              "iso3166.tab": "[BINARY] 4841 bytes",
              "leapseconds": "[BINARY] 3694 bytes",
              "tzdata.zi": "[BINARY] 107441 bytes",
              "zone.tab": "[BINARY] 18822 bytes",
              "zone1970.tab": "[BINARY] 17605 bytes",
              "zonenow.tab": "[BINARY] 8002 bytes"
            },
            "zones": "[BINARY] 9102 bytes"
          },
          "tzdata-2025.3.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 1352 bytes",
            "RECORD": "[BINARY] 56828 bytes",
            "WHEEL": "[BINARY] 109 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 592 bytes",
              "licenses": {
                "LICENSE_APACHE": "[BINARY] 11357 bytes"
              }
            },
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "uvicorn": {
            "__init__.py": "[FILE] 6 lines",
            "__main__.py": "[FILE] 5 lines",
            "_subprocess.py": "[FILE] 77 lines",
            "_types.py": "[FILE] 282 lines",
            "config.py": "[FILE] 578 lines",
            "importer.py": "[FILE] 39 lines",
            "lifespan": {
              "__init__.py": "[FILE] 1 lines",
              "off.py": "[FILE] 16 lines",
              "on.py": "[FILE] 138 lines"
            },
            "logging.py": "[FILE] 118 lines",
            "loops": {
              "__init__.py": "[FILE] 1 lines",
              "asyncio.py": "[FILE] 11 lines",
              "auto.py": "[FILE] 12 lines",
              "uvloop.py": "[FILE] 8 lines"
            },
            "main.py": "[FILE] 597 lines",
            "middleware": {
              "__init__.py": "[FILE] 1 lines",
              "asgi2.py": "[FILE] 18 lines",
              "message_logger.py": "[FILE] 88 lines",
              "proxy_headers.py": "[FILE] 85 lines",
              "wsgi.py": "[FILE] 204 lines"
            },
            "protocols": {
              "__init__.py": "[FILE] 1 lines",
              "http": {
                "__init__.py": "[FILE] 1 lines",
                "auto.py": "[FILE] 15 lines",
                "flow_control.py": "[FILE] 67 lines",
                "h11_impl.py": "[FILE] 551 lines",
                "httptools_impl.py": "[FILE] 602 lines"
              },
              "utils.py": "[FILE] 55 lines",
              "websockets": {
                "__init__.py": "[FILE] 1 lines",
                "auto.py": "[FILE] 20 lines",
                "websockets_impl.py": "[FILE] 377 lines",
                "wsproto_impl.py": "[FILE] 343 lines"
              }
            },
            "py.typed": "[BINARY] 1 bytes",
            "server.py": "[FILE] 336 lines",
            "supervisors": {
              "__init__.py": "[FILE] 22 lines",
              "basereload.py": "[FILE] 126 lines",
              "multiprocess.py": "[FILE] 75 lines",
              "statreload.py": "[FILE] 54 lines",
              "watchfilesreload.py": "[FILE] 92 lines",
              "watchgodreload.py": "[FILE] 159 lines"
            },
            "workers.py": "[FILE] 106 lines"
          },
          "uvicorn-0.24.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6352 bytes",
            "RECORD": "[BINARY] 6322 bytes",
            "REQUESTED": "[BINARY] 0 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "entry_points.txt": "[BINARY] 46 bytes",
            "licenses": {
              "LICENSE.md": "[FILE] 28 lines"
            }
          },
          "uvloop": {
            "__init__.py": "[FILE] 234 lines",
            "_noop.py": "[FILE] 4 lines",
            "_testbase.py": "[FILE] 553 lines",
            "_version.py": "[FILE] 14 lines",
            "cbhandles.pxd": "[BINARY] 752 bytes",
            "cbhandles.pyx": "[BINARY] 12298 bytes",
            "dns.pyx": "[BINARY] 14562 bytes",
            "errors.pyx": "[BINARY] 2774 bytes",
            "handles": {
              "async_.pxd": "[BINARY] 252 bytes",
              "async_.pyx": "[BINARY] 1516 bytes",
              "basetransport.pxd": "[BINARY] 1322 bytes",
              "basetransport.pyx": "[BINARY] 9553 bytes",
              "check.pxd": "[BINARY] 276 bytes",
              "check.pyx": "[BINARY] 1881 bytes",
              "fsevent.pxd": "[BINARY] 325 bytes",
              "fsevent.pyx": "[BINARY] 2823 bytes",
              "handle.pxd": "[BINARY] 1189 bytes",
              "handle.pyx": "[BINARY] 13248 bytes",
              "idle.pxd": "[BINARY] 274 bytes",
              "idle.pyx": "[BINARY] 1859 bytes",
              "pipe.pxd": "[BINARY] 933 bytes",
              "pipe.pyx": "[BINARY] 7688 bytes",
              "poll.pxd": "[BINARY] 575 bytes",
              "poll.pyx": "[BINARY] 6511 bytes",
              "process.pxd": "[BINARY] 2314 bytes",
              "process.pyx": "[BINARY] 26919 bytes",
              "stream.pxd": "[BINARY] 1535 bytes",
              "stream.pyx": "[BINARY] 31791 bytes",
              "streamserver.pxd": "[BINARY] 786 bytes",
              "streamserver.pyx": "[BINARY] 4632 bytes",
              "tcp.pxd": "[BINARY] 892 bytes",
              "tcp.pyx": "[BINARY] 7291 bytes",
              "timer.pxd": "[BINARY] 440 bytes",
              "timer.pyx": "[BINARY] 2416 bytes",
              "udp.pxd": "[BINARY] 671 bytes",
              "udp.pyx": "[BINARY] 12039 bytes"
            },
            "includes": {
              "__init__.py": "[FILE] 24 lines",
              "consts.pxi": "[BINARY] 843 bytes",
              "debug.pxd": "[BINARY] 64 bytes",
              "flowcontrol.pxd": "[BINARY] 458 bytes",
              "python.pxd": "[BINARY] 846 bytes",
              "stdlib.pxi": "[BINARY] 6377 bytes",
              "system.pxd": "[BINARY] 2186 bytes",
              "uv.pxd": "[BINARY] 16080 bytes"
            },
            "loop.cpython-312-x86_64-linux-gnu.so": "[BINARY] 15952168 bytes",
            "loop.pxd": "[BINARY] 6224 bytes",
            "loop.pyi": "[BINARY] 10504 bytes",
            "loop.pyx": "[BINARY] 118650 bytes",
            "lru.pyx": "[BINARY] 2279 bytes",
            "pseudosock.pyx": "[BINARY] 5383 bytes",
            "py.typed": "[BINARY] 0 bytes",
            "request.pxd": "[BINARY] 143 bytes",
            "request.pyx": "[BINARY] 2259 bytes",
            "server.pxd": "[BINARY] 394 bytes",
            "server.pyx": "[BINARY] 3623 bytes",
            "sslproto.pxd": "[BINARY] 3534 bytes",
            "sslproto.pyx": "[BINARY] 35381 bytes"
          },
          "uvloop-0.22.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 4922 bytes",
            "RECORD": "[BINARY] 5435 bytes",
            "WHEEL": "[BINARY] 190 bytes",
            "licenses": {
              "LICENSE-APACHE": "[BINARY] 11439 bytes",
              "LICENSE-MIT": "[BINARY] 1105 bytes"
            },
            "top_level.txt": "[BINARY] 7 bytes"
          },
          "vine": {
            "__init__.py": "[FILE] 43 lines",
            "abstract.py": "[FILE] 69 lines",
            "funtools.py": "[FILE] 114 lines",
            "promises.py": "[FILE] 242 lines",
            "synchronization.py": "[FILE] 105 lines",
            "utils.py": "[FILE] 28 lines"
          },
          "vine-5.1.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "LICENSE": "[BINARY] 2461 bytes",
            "METADATA": "[BINARY] 2657 bytes",
            "RECORD": "[BINARY] 1181 bytes",
            "WHEEL": "[BINARY] 92 bytes",
            "top_level.txt": "[BINARY] 5 bytes"
          },
          "watchfiles": {
            "__init__.py": "[FILE] 18 lines",
            "__main__.py": "[FILE] 5 lines",
            "_rust_notify.cpython-312-x86_64-linux-gnu.so": "[BINARY] 1124288 bytes",
            "_rust_notify.pyi": "[BINARY] 4753 bytes",
            "cli.py": "[FILE] 225 lines",
            "filters.py": "[FILE] 150 lines",
            "main.py": "[FILE] 374 lines",
            "py.typed": "[BINARY] 69 bytes",
            "run.py": "[FILE] 439 lines",
            "version.py": "[FILE] 6 lines"
          },
          "watchfiles-1.1.1.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 4874 bytes",
            "RECORD": "[BINARY] 1748 bytes",
            "WHEEL": "[BINARY] 129 bytes",
            "entry_points.txt": "[BINARY] 48 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1091 bytes"
            }
          },
          "wcwidth": {
            "__init__.py": "[FILE] 44 lines",
            "bisearch.py": "[FILE] 30 lines",
            "control_codes.py": "[FILE] 47 lines",
            "escape_sequences.py": "[FILE] 70 lines",
            "grapheme.py": "[FILE] 429 lines",
            "py.typed": "[BINARY] 0 bytes",
            "sgr_state.py": "[FILE] 339 lines",
            "table_ambiguous.py": "[FILE] 190 lines",
            "table_grapheme.py": "[FILE] 2295 lines",
            "table_mc.py": "[FILE] 207 lines",
            "table_vs16.py": "[FILE] 127 lines",
            "table_wide.py": "[FILE] 139 lines",
            "table_zero.py": "[FILE] 351 lines",
            "textwrap.py": "[FILE] 657 lines",
            "unicode_versions.py": "[FILE] 22 lines",
            "wcwidth.py": "[FILE] 1031 lines"
          },
          "wcwidth-0.6.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 30525 bytes",
            "RECORD": "[BINARY] 2429 bytes",
            "WHEEL": "[BINARY] 87 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1322 bytes"
            }
          },
          "websockets": {
            "__init__.py": "[FILE] 237 lines",
            "__main__.py": "[FILE] 6 lines",
            "asyncio": {
              "__init__.py": "[FILE] 1 lines",
              "async_timeout.py": "[FILE] 283 lines",
              "client.py": "[FILE] 805 lines",
              "compatibility.py": "[FILE] 31 lines",
              "connection.py": "[FILE] 1248 lines",
              "messages.py": "[FILE] 317 lines",
              "router.py": "[FILE] 220 lines",
              "server.py": "[FILE] 998 lines"
            },
            "auth.py": "[FILE] 19 lines",
            "cli.py": "[FILE] 179 lines",
            "client.py": "[FILE] 392 lines",
            "connection.py": "[FILE] 13 lines",
            "datastructures.py": "[FILE] 184 lines",
            "exceptions.py": "[FILE] 474 lines",
            "extensions": {
              "__init__.py": "[FILE] 5 lines",
              "base.py": "[FILE] 124 lines",
              "permessage_deflate.py": "[FILE] 700 lines"
            },
            "frames.py": "[FILE] 432 lines",
            "headers.py": "[FILE] 587 lines",
            "http.py": "[FILE] 21 lines",
            "http11.py": "[FILE] 439 lines",
            "imports.py": "[FILE] 101 lines",
            "legacy": {
              "__init__.py": "[FILE] 12 lines",
              "auth.py": "[FILE] 191 lines",
              "client.py": "[FILE] 704 lines",
              "exceptions.py": "[FILE] 72 lines",
              "framing.py": "[FILE] 225 lines",
              "handshake.py": "[FILE] 159 lines",
              "http.py": "[FILE] 202 lines",
              "protocol.py": "[FILE] 1636 lines",
              "server.py": "[FILE] 1192 lines"
            },
            "protocol.py": "[FILE] 769 lines",
            "proxy.py": "[FILE] 151 lines",
            "py.typed": "[BINARY] 0 bytes",
            "server.py": "[FILE] 590 lines",
            "speedups.c": "[BINARY] 5920 bytes",
            "speedups.cpython-312-x86_64-linux-gnu.so": "[BINARY] 38048 bytes",
            "speedups.pyi": "[BINARY] 102 bytes",
            "streams.py": "[FILE] 152 lines",
            "sync": {
              "__init__.py": "[FILE] 1 lines",
              "client.py": "[FILE] 634 lines",
              "connection.py": "[FILE] 1079 lines",
              "messages.py": "[FILE] 349 lines",
              "router.py": "[FILE] 214 lines",
              "server.py": "[FILE] 766 lines",
              "utils.py": "[FILE] 46 lines"
            },
            "typing.py": "[FILE] 76 lines",
            "uri.py": "[FILE] 108 lines",
            "utils.py": "[FILE] 54 lines",
            "version.py": "[FILE] 93 lines"
          },
          "websockets-16.0.dist-info": {
            "INSTALLER": "[BINARY] 4 bytes",
            "METADATA": "[BINARY] 6799 bytes",
            "RECORD": "[BINARY] 7638 bytes",
            "WHEEL": "[BINARY] 186 bytes",
            "entry_points.txt": "[BINARY] 51 bytes",
            "licenses": {
              "LICENSE": "[BINARY] 1514 bytes"
            },
            "top_level.txt": "[BINARY] 11 bytes"
          },
          "yaml": {
            "__init__.py": "[FILE] 391 lines",
            "_yaml.cpython-312-x86_64-linux-gnu.so": "[BINARY] 2679264 bytes",
            "composer.py": "[FILE] 140 lines",
            "constructor.py": "[FILE] 749 lines",
            "cyaml.py": "[FILE] 102 lines",
            "dumper.py": "[FILE] 63 lines",
            "emitter.py": "[FILE] 1138 lines",
            "error.py": "[FILE] 76 lines",
            "events.py": "[FILE] 87 lines",
            "loader.py": "[FILE] 64 lines",
            "nodes.py": "[FILE] 50 lines",
            "parser.py": "[FILE] 590 lines",
            "reader.py": "[FILE] 186 lines",
            "representer.py": "[FILE] 390 lines",
            "resolver.py": "[FILE] 228 lines",
            "scanner.py": "[FILE] 1436 lines",
            "serializer.py": "[FILE] 112 lines",
            "tokens.py": "[FILE] 105 lines"
          }
        }
      }
    },
    "pyvenv.cfg": "[BINARY] 176 bytes"
  }
}
```

🔧 КЛЮЧЕВЫЕ ФАЙЛЫ (с содержимым)
--------------------------------------------------

--- app/api/routes/__init__.py (hash: 330224fa) ---
// размер: 8 строк
# app/api/routes/__init__.py
"""
API routes package initialization.
"""

from app.api.routes import projects, schema, nodes, edges, graphs, artifacts

__all__ = ["projects", "schema", "nodes", "edges", "graphs", "artifacts"]

--- app/api/routes/artifacts.py (hash: 8d5f648d) ---
// размер: 727 строк
# app/api/routes/artifacts.py
"""
Artifact management endpoints (API v2).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, and_, or_
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime

from app.database import get_db
from app.models.artifact import Artifact, ArtifactRelation, ArtifactVersion
from app.models.project import Project
from app.api.deps import get_project
from app.core.exceptions import ValidationError, ArtifactNotFoundError, RelationNotFoundError, VersionNotFoundError

router = APIRouter(prefix="/projects/{project_id}/artifacts", tags=["artifacts"])
logger = logging.getLogger(__name__)

# ============================================================================
# Базовые CRUD операции
# ============================================================================

@router.post("", response_model=Dict[str, Any])
async def create_artifact(
    project_id: int,
    artifact_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Create a new artifact.
    
    Args:
        project_id: Project ID
        artifact_data: {
            "type": "graph|table|map|chart|document",
            "name": "Artifact name",
            "description": "Optional description",
            "data": {...},  # Artifact-specific data
            "metadata": {...}  # Optional metadata
        }
    
    Returns:
        Created artifact
    """
    try:
        # Валидация обязательных полей
        if "type" not in artifact_data:
            raise HTTPException(status_code=400, detail="Field 'type' is required")
        if "name" not in artifact_data:
            raise HTTPException(status_code=400, detail="Field 'name' is required")
        if "data" not in artifact_data:
            raise HTTPException(status_code=400, detail="Field 'data' is required")
        
        # Валидация типа
        valid_types = ["graph", "table", "map", "chart", "document"]
        if artifact_data["type"] not in valid_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid type. Must be one of: {valid_types}"
            )
        
        # Создаем артефакт
        artifact = Artifact(
            project_id=project_id,
            type=artifact_data["type"],
            name=artifact_data["name"],
            description=artifact_data.get("description"),
            data=artifact_data["data"],
            artifact_metadata=artifact_data.get("metadata", {})
        )
        
        db.add(artifact)
        await db.commit()
        await db.refresh(artifact)
        
        # Создаем первую версию
        version = ArtifactVersion(
            artifact_id=artifact.id,
            version=1,
            data=artifact.data,
            changed_by="user"
        )
        db.add(version)
        await db.commit()
        
        return {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": artifact.data,
            "metadata": artifact.artifact_metadata,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
            "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
            "version": 1
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating artifact: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", response_model=List[Dict[str, Any]])
async def list_artifacts(
    project_id: int,
    type: Optional[str] = Query(None, description="Filter by artifact type"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    List all artifacts in a project with optional filtering.
    """
    try:
        query = select(Artifact).where(Artifact.project_id == project_id)
        
        # Фильтр по типу
        if type:
            query = query.where(Artifact.type == type)
        
        # Поиск по имени и описанию
        if search:
            query = query.where(
                or_(
                    Artifact.name.ilike(f"%{search}%"),
                    Artifact.description.ilike(f"%{search}%")
                )
            )
        
        # Пагинация
        query = query.order_by(Artifact.updated_at.desc()).limit(limit).offset(offset)
        
        result = await db.execute(query)
        artifacts = result.scalars().all()
        
        # Получаем последнюю версию для каждого артефакта
        response = []
        for artifact in artifacts:
            latest_version = await db.execute(
                select(ArtifactVersion)
                .where(ArtifactVersion.artifact_id == artifact.id)
                .order_by(ArtifactVersion.version.desc())
                .limit(1)
            )
            version = latest_version.scalar_one_or_none()
            
            response.append({
                "id": artifact.id,
                "project_id": artifact.project_id,
                "type": artifact.type,
                "name": artifact.name,
                "description": artifact.description,
                "data": artifact.data,
                "metadata": artifact.artifact_metadata,
                "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
                "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
                "version": version.version if version else 1
            })
        
        return response
    except Exception as e:
        logger.error(f"Error listing artifacts: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{artifact_id}", response_model=Dict[str, Any])
async def get_artifact(
    project_id: int,
    artifact_id: int,
    version: Optional[int] = Query(None, description="Specific version to retrieve"),
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Get a specific artifact, optionally at a specific version.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Если запрошена конкретная версия
        if version:
            version_result = await db.execute(
                select(ArtifactVersion)
                .where(
                    ArtifactVersion.artifact_id == artifact_id,
                    ArtifactVersion.version == version
                )
            )
            artifact_version = version_result.scalar_one_or_none()
            
            if not artifact_version:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Version {version} not found"
                )
            
            data = artifact_version.data
            current_version = version
        else:
            data = artifact.data
            # Получаем последнюю версию
            version_result = await db.execute(
                select(ArtifactVersion)
                .where(ArtifactVersion.artifact_id == artifact_id)
                .order_by(ArtifactVersion.version.desc())
                .limit(1)
            )
            latest_version = version_result.scalar_one_or_none()
            current_version = latest_version.version if latest_version else 1
        
        return {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": data,
            "metadata": artifact.artifact_metadata,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
            "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
            "version": current_version
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{artifact_id}", response_model=Dict[str, Any])
async def update_artifact(
    project_id: int,
    artifact_id: int,
    update_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Update an artifact (creates a new version).
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Получаем текущую версию
        version_result = await db.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version.desc())
            .limit(1)
        )
        latest_version = version_result.scalar_one_or_none()
        current_version = latest_version.version if latest_version else 1
        
        # Обновляем поля
        if "name" in update_data:
            artifact.name = update_data["name"]
        if "description" in update_data:
            artifact.description = update_data["description"]
        if "metadata" in update_data:
            artifact.artifact_metadata = {
                **(artifact.artifact_metadata or {}),
                **update_data["metadata"]
            }
        
        # Если обновляются данные, создаем новую версию
        if "data" in update_data:
            # Создаем новую версию
            new_version = ArtifactVersion(
                artifact_id=artifact_id,
                version=current_version + 1,
                data=update_data["data"],
                changed_by="user"
            )
            db.add(new_version)
            
            # Обновляем основные данные артефакта
            artifact.data = update_data["data"]
            artifact.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(artifact)
        
        # Получаем обновленную версию
        final_version = current_version + 1 if "data" in update_data else current_version
        
        return {
            "id": artifact.id,
            "project_id": artifact.project_id,
            "type": artifact.type,
            "name": artifact.name,
            "description": artifact.description,
            "data": artifact.data,
            "metadata": artifact.artifact_metadata,
            "created_at": artifact.created_at.isoformat() if artifact.created_at else None,
            "updated_at": artifact.updated_at.isoformat() if artifact.updated_at else None,
            "version": final_version
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating artifact: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{artifact_id}")
async def delete_artifact(
    project_id: int,
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Delete an artifact and all its versions and relations.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Удаляем (каскадно удалятся все версии и связи благодаря ondelete=CASCADE)
        await db.delete(artifact)
        await db.commit()
        
        return {"status": "success", "message": f"Artifact {artifact_id} deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting artifact: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# Операции с версиями
# ============================================================================

@router.get("/{artifact_id}/versions", response_model=List[Dict[str, Any]])
async def get_artifact_versions(
    project_id: int,
    artifact_id: int,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Get all versions of an artifact.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Получаем версии
        versions_result = await db.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version.desc())
            .limit(limit)
            .offset(offset)
        )
        versions = versions_result.scalars().all()
        
        return [
            {
                "version": v.version,
                "data": v.data,
                "changed_at": v.changed_at.isoformat() if v.changed_at else None,
                "changed_by": v.changed_by
            }
            for v in versions
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact versions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{artifact_id}/restore")
async def restore_artifact_version(
    project_id: int,
    artifact_id: int,
    version: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Restore an artifact to a previous version.
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        # Получаем версию для восстановления
        version_result = await db.execute(
            select(ArtifactVersion)
            .where(
                ArtifactVersion.artifact_id == artifact_id,
                ArtifactVersion.version == version
            )
        )
        old_version = version_result.scalar_one_or_none()
        
        if not old_version:
            raise HTTPException(status_code=404, detail=f"Version {version} not found")
        
        # Получаем текущую версию
        latest_result = await db.execute(
            select(ArtifactVersion)
            .where(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version.desc())
            .limit(1)
        )
        latest_version = latest_result.scalar_one_or_none()
        current_version = latest_version.version if latest_version else 1
        
        # Создаем новую версию с данными из старой
        new_version = ArtifactVersion(
            artifact_id=artifact_id,
            version=current_version + 1,
            data=old_version.data,
            changed_by="user (restore)"
        )
        db.add(new_version)
        
        # Обновляем основные данные артефакта
        artifact.data = old_version.data
        artifact.updated_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "status": "success",
            "message": f"Restored to version {version}",
            "new_version": current_version + 1
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring artifact version: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# Операции со связями
# ============================================================================

@router.post("/{artifact_id}/relations")
async def create_artifact_relation(
    project_id: int,
    artifact_id: int,
    relation_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Create a relation between artifacts.
    
    Args:
        relation_data: {
            "target_id": int,
            "relation_type": "derived_from|attached_to|references"
        }
    """
    try:
        # Проверяем существование исходного артефакта
        source_result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        source = source_result.scalar_one_or_none()
        
        if not source:
            raise HTTPException(status_code=404, detail="Source artifact not found")
        
        # Проверяем обязательные поля
        if "target_id" not in relation_data:
            raise HTTPException(status_code=400, detail="Field 'target_id' is required")
        if "relation_type" not in relation_data:
            raise HTTPException(status_code=400, detail="Field 'relation_type' is required")
        
        # Проверяем существование целевого артефакта
        target_result = await db.execute(
            select(Artifact).where(
                Artifact.id == relation_data["target_id"],
                Artifact.project_id == project_id
            )
        )
        target = target_result.scalar_one_or_none()
        
        if not target:
            raise HTTPException(status_code=404, detail="Target artifact not found")
        
        # Проверяем валидность типа связи
        valid_relation_types = ["derived_from", "attached_to", "references"]
        if relation_data["relation_type"] not in valid_relation_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid relation_type. Must be one of: {valid_relation_types}"
            )
        
        # Проверяем, не существует ли уже такая связь
        existing = await db.execute(
            select(ArtifactRelation).where(
                ArtifactRelation.source_id == artifact_id,
                ArtifactRelation.target_id == relation_data["target_id"],
                ArtifactRelation.relation_type == relation_data["relation_type"]
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Relation already exists"
            )
        
        # Создаем связь
        relation = ArtifactRelation(
            source_id=artifact_id,
            target_id=relation_data["target_id"],
            relation_type=relation_data["relation_type"]
        )
        
        db.add(relation)
        await db.commit()
        
        return {
            "status": "success",
            "source_id": artifact_id,
            "target_id": relation_data["target_id"],
            "relation_type": relation_data["relation_type"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating artifact relation: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{artifact_id}/relations")
async def get_artifact_relations(
    project_id: int,
    artifact_id: int,
    direction: str = Query("both", regex="^(in|out|both)$"),
    relation_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Get all relations for an artifact.
    
    Args:
        direction: 'in' (incoming), 'out' (outgoing), or 'both'
        relation_type: Optional filter by relation type
    """
    try:
        # Проверяем существование артефакта
        result = await db.execute(
            select(Artifact).where(
                Artifact.id == artifact_id,
                Artifact.project_id == project_id
            )
        )
        artifact = result.scalar_one_or_none()
        
        if not artifact:
            raise HTTPException(status_code=404, detail="Artifact not found")
        
        relations = []
        
        # Исходящие связи
        if direction in ["out", "both"]:
            out_query = select(ArtifactRelation).where(
                ArtifactRelation.source_id == artifact_id
            )
            if relation_type:
                out_query = out_query.where(ArtifactRelation.relation_type == relation_type)
            
            out_result = await db.execute(out_query)
            for rel in out_result.scalars().all():
                # Получаем информацию о целевом артефакте
                target_result = await db.execute(
                    select(Artifact).where(Artifact.id == rel.target_id)
                )
                target = target_result.scalar_one_or_none()
                
                relations.append({
                    "direction": "out",
                    "source_id": rel.source_id,
                    "target_id": rel.target_id,
                    "target_name": target.name if target else "Unknown",
                    "target_type": target.type if target else "unknown",
                    "relation_type": rel.relation_type,
                    "created_at": rel.created_at.isoformat() if rel.created_at else None
                })
        
        # Входящие связи
        if direction in ["in", "both"]:
            in_query = select(ArtifactRelation).where(
                ArtifactRelation.target_id == artifact_id
            )
            if relation_type:
                in_query = in_query.where(ArtifactRelation.relation_type == relation_type)
            
            in_result = await db.execute(in_query)
            for rel in in_result.scalars().all():
                # Получаем информацию об исходном артефакте
                source_result = await db.execute(
                    select(Artifact).where(Artifact.id == rel.source_id)
                )
                source = source_result.scalar_one_or_none()
                
                relations.append({
                    "direction": "in",
                    "source_id": rel.source_id,
                    "source_name": source.name if source else "Unknown",
                    "source_type": source.type if source else "unknown",
                    "target_id": rel.target_id,
                    "relation_type": rel.relation_type,
                    "created_at": rel.created_at.isoformat() if rel.created_at else None
                })
        
        return relations
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting artifact relations: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{artifact_id}/relations/{target_id}")
async def delete_artifact_relation(
    project_id: int,
    artifact_id: int,
    target_id: int,
    relation_type: str,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """
    Delete a relation between artifacts.
    """
    try:
        # Проверяем существование связи
        result = await db.execute(
            select(ArtifactRelation).where(
                ArtifactRelation.source_id == artifact_id,
                ArtifactRelation.target_id == target_id,
                ArtifactRelation.relation_type == relation_type
            )
        )
        relation = result.scalar_one_or_none()
        
        if not relation:
            raise HTTPException(status_code=404, detail="Relation not found")
        
        await db.delete(relation)
        await db.commit()
        
        return {
            "status": "success",
            "message": f"Relation deleted: {artifact_id} -> {target_id} ({relation_type})"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting artifact relation: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

--- app/api/routes/edges.py (hash: 1c0bcab4) ---
// размер: 219 строк
"""
Edge management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Dict, Any, Optional
import logging
import uuid

from app.database import get_db
from app.models.edge import Edge
from app.models.node import Node
from app.models.graph import Graph
from app.services.schema_service import SchemaService
from app.api.deps import get_graph
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/graphs/{graph_id}/edges", tags=["edges"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_edge(
    graph_id: int,
    edge_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Create a new edge."""
    try:
        # Get source and target node types
        nodes_result = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id.in_([edge_data["source_node"], edge_data["target_node"]])
            )
        )
        nodes = nodes_result.scalars().all()
        node_types = {node.node_id: node.type for node in nodes}
        
        if edge_data["source_node"] not in node_types:
            raise HTTPException(status_code=400, detail=f"Source node {edge_data['source_node']} not found")
        if edge_data["target_node"] not in node_types:
            raise HTTPException(status_code=400, detail=f"Target node {edge_data['target_node']} not found")
        
        # Validate against schema
        schema_service = SchemaService(db)
        await schema_service.validate_edge(
            graph.project_id,
            edge_data["type"],
            node_types[edge_data["source_node"]],
            node_types[edge_data["target_node"]],
            edge_data.get("attributes", {})
        )
        
        # Generate edge_id if not provided
        if "edge_id" not in edge_data:
            edge_data["edge_id"] = str(uuid.uuid4())[:8]
        
        # Create edge
        edge = Edge(
            graph_id=graph_id,
            edge_id=edge_data["edge_id"],
            source_node=edge_data["source_node"],
            target_node=edge_data["target_node"],
            type=edge_data["type"],
            attributes=edge_data.get("attributes", {})
        )
        
        db.add(edge)
        await db.commit()
        await db.refresh(edge)
        return edge
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/batch")
async def batch_create_edges(
    graph_id: int,
    edges_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Batch create multiple edges."""
    try:
        # Get all nodes in graph
        nodes_result = await db.execute(
            select(Node).where(Node.graph_id == graph_id)
        )
        nodes = nodes_result.scalars().all()
        node_types = {node.node_id: node.type for node in nodes}
        
        schema_service = SchemaService(db)
        edges = []
        
        for edge_data in edges_data:
            # Check nodes exist
            if edge_data["source_node"] not in node_types:
                raise HTTPException(status_code=400, detail=f"Source node {edge_data['source_node']} not found")
            if edge_data["target_node"] not in node_types:
                raise HTTPException(status_code=400, detail=f"Target node {edge_data['target_node']} not found")
            
            # Validate against schema
            await schema_service.validate_edge(
                graph.project_id,
                edge_data["type"],
                node_types[edge_data["source_node"]],
                node_types[edge_data["target_node"]],
                edge_data.get("attributes", {})
            )
            
            # Generate edge_id if not provided
            if "edge_id" not in edge_data:
                edge_data["edge_id"] = str(uuid.uuid4())[:8]
            
            edge = Edge(
                graph_id=graph_id,
                edge_id=edge_data["edge_id"],
                source_node=edge_data["source_node"],
                target_node=edge_data["target_node"],
                type=edge_data["type"],
                attributes=edge_data.get("attributes", {})
            )
            edges.append(edge)
        
        db.add_all(edges)
        await db.commit()
        return {"status": "success", "count": len(edges)}
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
async def get_edges(
    graph_id: int,
    type: Optional[str] = None,
    source_node: Optional[str] = None,
    target_node: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get edges with optional filtering."""
    query = select(Edge).where(Edge.graph_id == graph_id)
    
    if type:
        query = query.where(Edge.type == type)
    if source_node:
        query = query.where(Edge.source_node == source_node)
    if target_node:
        query = query.where(Edge.target_node == target_node)
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{edge_id}")
async def get_edge(
    graph_id: int,
    edge_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get specific edge."""
    result = await db.execute(
        select(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge

@router.patch("/{edge_id}")
async def update_edge(
    graph_id: int,
    edge_id: str,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Update edge attributes."""
    result = await db.execute(
        select(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    edge = result.scalar_one_or_none()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    
    if "attributes" in updates:
        edge.attributes = {**edge.attributes, **updates["attributes"]}
    
    await db.commit()
    await db.refresh(edge)
    return edge

@router.delete("/{edge_id}")
async def delete_edge(
    graph_id: int,
    edge_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Delete an edge."""
    await db.execute(
        delete(Edge).where(
            Edge.graph_id == graph_id,
            Edge.edge_id == edge_id
        )
    )
    await db.commit()
    return {"status": "success", "message": "Edge deleted"}


--- app/api/routes/graphs.py (hash: 3c34fc47) ---
// размер: 59 строк
"""
Graph management endpoints (legacy, use projects/{id}/graphs instead).
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import logging

from app.database import get_db
from app.models.graph import Graph

router = APIRouter(prefix="/graphs", tags=["graphs"])
logger = logging.getLogger(__name__)

@router.get("")
async def get_all_graphs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all graphs."""
    result = await db.execute(
        select(Graph).offset(skip).limit(limit)
    )
    return result.scalars().all()

@router.get("/{graph_id}")
async def get_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific graph."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    return graph

@router.delete("/{graph_id}")
async def delete_graph(
    graph_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a graph."""
    result = await db.execute(
        select(Graph).where(Graph.id == graph_id)
    )
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(status_code=404, detail=f"Graph {graph_id} not found")
    
    await db.delete(graph)
    await db.commit()
    return {"message": f"Graph {graph_id} deleted"}


--- app/api/routes/history.py (hash: cd023a5e) ---
// размер: 269 строк
# app/api/routes/history.py
"""
History management endpoints for undo/redo functionality.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, func
from typing import List, Optional
import uuid
import logging

from app.database import get_db
from app.models.action import GraphAction
from app.models.artifact import Artifact
from app.schemas.action import GraphActionCreate, GraphActionResponse, UndoResponse, RedoResponse
from app.api.deps import get_artifact
from app.services.history_cache import HistoryCache, get_redis_client

router = APIRouter(prefix="/api/v2/artifacts/{artifact_id}/history", tags=["history"])
logger = logging.getLogger(__name__)

# ============================================================================
# Получение истории
# ============================================================================

@router.get("", response_model=List[GraphActionResponse])
async def get_history(
    artifact_id: int,
    limit: int = Query(50, ge=1, le=200, description="Number of actions to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Get action history for a graph artifact.
    Returns actions sorted by timestamp (newest first).
    """
    try:
        # Сначала пробуем получить из кэша Redis
        cache = HistoryCache(redis_client)

        if offset == 0 and limit <= 100:
            cached_actions = await cache.get_recent(artifact_id, limit)
            if cached_actions:
                logger.debug(f"Returning {len(cached_actions)} actions from cache for artifact {artifact_id}")
                return cached_actions

        # Если нет в кэше или нужна пагинация - идем в БД
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(desc(GraphAction.timestamp))
            .limit(limit)
            .offset(offset)
        )
        actions = result.scalars().all()

        # Кэшируем результат для будущих запросов
        if offset == 0 and actions:
            await cache.push_many(artifact_id, [a.to_dict() for a in actions])

        return [action.to_dict() for action in actions]
    except Exception as e:
        logger.error(f"Error getting history for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get history")

# ============================================================================
# Запись действий
# ============================================================================

@router.post("/actions", response_model=GraphActionResponse, status_code=201)
async def record_action(
    artifact_id: int,
    action_data: GraphActionCreate,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Record a new action in history.
    All actions are stored permanently for undo/redo functionality.
    """
    try:
        # Создаем запись в БД
        db_action = GraphAction(
            artifact_id=artifact_id,
            action_type=action_data.action_type,
            before_state=action_data.before_state,
            after_state=action_data.after_state,
            description=action_data.description,
            user_type=action_data.user_type,
            plugin_id=action_data.plugin_id,
            group_id=action_data.group_id or uuid.uuid4()
        )

        db.add(db_action)
        await db.commit()
        await db.refresh(db_action)

        # Обновляем кэш
        cache = HistoryCache(redis_client)
        await cache.push_action(artifact_id, db_action.to_dict())

        logger.info(f"Recorded action {db_action.id} for artifact {artifact_id}: {db_action.description}")
        return db_action.to_dict()
    except Exception as e:
        logger.error(f"Error recording action for artifact {artifact_id}: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to record action")

# ============================================================================
# Undo операция
# ============================================================================

@router.post("/undo", response_model=UndoResponse)
async def undo_action(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Undo the last action.
    Returns the state to revert to (before_state of the action that would bring us back one step).
    Does NOT delete the action - keeps full history.
    """
    try:
        # Получаем ВСЕ действия для этого артефакта, отсортированные по времени (старые первые)
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(GraphAction.timestamp)  # По возрастанию (старые первые)
        )
        all_actions = result.scalars().all()
        
        if not all_actions:
            raise HTTPException(status_code=404, detail="No actions to undo")
        
        # Если есть только одно действие - отменяем его до начального состояния
        if len(all_actions) == 1:
            action = all_actions[0]
            logger.info(f"Undo single action {action.id} for artifact {artifact_id}: {action.description}")
            return {
                "action_id": action.id,
                "artifact_id": artifact_id,
                "state": action.before_state,
                "description": f"Undo: {action.description}",
                "timestamp": action.timestamp
            }
        
        # Если действий больше одного - отменяем последнее действие
        # Для этого нужно вернуть состояние перед последним действием,
        # то есть after_state предпоследнего действия
        second_last_action = all_actions[-2]  # Предпоследнее действие
        last_action = all_actions[-1]  # Последнее действие
        
        logger.info(f"Undo action {last_action.id} for artifact {artifact_id}: {last_action.description}")
        logger.info(f"Returning to state after action {second_last_action.id}")
        
        return {
            "action_id": last_action.id,
            "artifact_id": artifact_id,
            "state": second_last_action.after_state,  # Важно! after_state предпоследнего действия
            "description": f"Undo: {last_action.description}",
            "timestamp": last_action.timestamp
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error undoing action for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to undo action")

# ============================================================================
# Redo операция
# ============================================================================

@router.post("/redo", response_model=RedoResponse)
async def redo_action(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact),
    redis_client = Depends(get_redis_client)
):
    """
    Redo the last undone action.
    Returns the state to reapply (after_state of the last action).
    """
    try:
        # Получаем ВСЕ действия для этого артефакта
        result = await db.execute(
            select(GraphAction)
            .where(GraphAction.artifact_id == artifact_id)
            .order_by(GraphAction.timestamp)
        )
        all_actions = result.scalars().all()
        
        if not all_actions:
            raise HTTPException(status_code=404, detail="No actions to redo")
        
        # Для redo возвращаем after_state последнего действия
        last_action = all_actions[-1]
        
        logger.info(f"Redo action {last_action.id} for artifact {artifact_id}: {last_action.description}")
        
        return {
            "action_id": last_action.id,
            "artifact_id": artifact_id,
            "state": last_action.after_state,
            "description": f"Redo: {last_action.description}",
            "timestamp": last_action.timestamp
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error redoing action for artifact {artifact_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to redo action")

# ============================================================================
# Получение конкретного действия
# ============================================================================

@router.get("/actions/{action_id}", response_model=GraphActionResponse)
async def get_action(
    artifact_id: int,
    action_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact)
):
    """
    Get a specific action by ID.
    """
    result = await db.execute(
        select(GraphAction)
        .where(
            and_(
                GraphAction.artifact_id == artifact_id,
                GraphAction.id == action_id
            )
        )
    )
    action = result.scalar_one_or_none()

    if not action:
        raise HTTPException(status_code=404, detail="Action not found")

    return action.to_dict()

# ============================================================================
# Получение количества действий
# ============================================================================

@router.get("/count")
async def get_actions_count(
    artifact_id: int,
    db: AsyncSession = Depends(get_db),
    artifact: Artifact = Depends(get_artifact)
):
    """
    Get total number of actions for an artifact.
    """
    result = await db.execute(
        select(func.count())
        .where(GraphAction.artifact_id == artifact_id)
    )
    count = result.scalar()
    
    return {"artifact_id": artifact_id, "total_actions": count}


--- app/api/routes/nodes.py (hash: 4a2846de) ---
// размер: 249 строк
"""
Node management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import uuid

from app.database import get_db
from app.models.node import Node
from app.models.edge import Edge
from app.models.graph import Graph
from app.services.schema_service import SchemaService
from app.api.deps import get_graph
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/graphs/{graph_id}/nodes", tags=["nodes"])
logger = logging.getLogger(__name__)

@router.post("")
async def create_node(
    graph_id: int,
    node_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Create a new node."""
    try:
        # Validate against schema
        schema_service = SchemaService(db)
        await schema_service.validate_node(
            graph.project_id,
            node_data["type"],
            node_data.get("attributes", {})
        )
        
        # Generate node_id if not provided
        if "node_id" not in node_data:
            node_data["node_id"] = str(uuid.uuid4())[:8]
        
        # Check if node_id already exists
        existing = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_data["node_id"]
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Node with ID {node_data['node_id']} already exists")
        
        # Create node
        node = Node(
            graph_id=graph_id,
            node_id=node_data["node_id"],
            type=node_data["type"],
            attributes=node_data.get("attributes", {}),
            position_x=node_data.get("position_x"),
            position_y=node_data.get("position_y")
        )
        
        db.add(node)
        await db.commit()
        await db.refresh(node)
        
        return node
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/batch")
async def batch_create_nodes(
    graph_id: int,
    nodes_data: List[Dict[str, Any]],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Batch create multiple nodes (optimized for large imports)."""
    try:
        schema_service = SchemaService(db)
        nodes = []
        node_ids = set()
        
        for node_data in nodes_data:
            # Validate each node
            await schema_service.validate_node(
                graph.project_id,
                node_data["type"],
                node_data.get("attributes", {})
            )
            
            # Generate node_id if not provided
            if "node_id" not in node_data:
                node_data["node_id"] = str(uuid.uuid4())[:8]
            
            # Check for duplicate IDs in batch
            if node_data["node_id"] in node_ids:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Duplicate node_id '{node_data['node_id']}' in batch"
                )
            node_ids.add(node_data["node_id"])
            
            node = Node(
                graph_id=graph_id,
                node_id=node_data["node_id"],
                type=node_data["type"],
                attributes=node_data.get("attributes", {}),
                position_x=node_data.get("position_x"),
                position_y=node_data.get("position_y")
            )
            nodes.append(node)
        
        db.add_all(nodes)
        await db.commit()
        
        return {"status": "success", "count": len(nodes), "nodes": nodes}
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error batch creating nodes: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("")
async def get_nodes(
    graph_id: int,
    type: Optional[str] = None,
    limit: int = 1000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get nodes with optional filtering."""
    query = select(Node).where(Node.graph_id == graph_id)
    
    if type:
        query = query.where(Node.type == type)
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    nodes = result.scalars().all()
    return nodes

@router.get("/{node_id}")
async def get_node(
    graph_id: int,
    node_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Get specific node."""
    result = await db.execute(
        select(Node).where(
            Node.graph_id == graph_id,
            Node.node_id == node_id
        )
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.patch("/{node_id}")
async def update_node(
    graph_id: int,
    node_id: str,
    updates: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Update node attributes or position."""
    try:
        # Get current node
        result = await db.execute(
            select(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_id
            )
        )
        node = result.scalar_one_or_none()
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Update fields
        if "attributes" in updates:
            # Validate updated attributes against schema
            schema_service = SchemaService(db)
            await schema_service.validate_node(
                graph.project_id,
                node.type,
                {**node.attributes, **updates["attributes"]}
            )
            node.attributes = {**node.attributes, **updates["attributes"]}
        
        if "position_x" in updates:
            node.position_x = updates["position_x"]
        if "position_y" in updates:
            node.position_y = updates["position_y"]
        
        node.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(node)
        return node
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{node_id}")
async def delete_node(
    graph_id: int,
    node_id: str,
    db: AsyncSession = Depends(get_db),
    graph: Graph = Depends(get_graph)
):
    """Delete node and all its edges."""
    try:
        # Delete edges connected to this node
        await db.execute(
            delete(Edge).where(
                Edge.graph_id == graph_id,
                (Edge.source_node == node_id) | (Edge.target_node == node_id)
            )
        )
        
        # Delete node
        await db.execute(
            delete(Node).where(
                Node.graph_id == graph_id,
                Node.node_id == node_id
            )
        )
        
        await db.commit()
        return {"status": "success", "message": "Node deleted"}
    except Exception as e:
        logger.error(f"Error deleting node: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

--- app/api/routes/projects.py (hash: 8f2ead6b) ---
// размер: 142 строк
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import logging

from app.database import get_db
from app.models.project import Project

# 👇 Важно: префикс только "/projects", без "/api/v1"
router = APIRouter(prefix="/projects", tags=["projects"])
logger = logging.getLogger(__name__)

# GET /projects (полный путь: /api/v1/projects)
@router.get("")  # 👈 пустая строка после префикса
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all projects."""
    logger.info("GET /api/v1/projects called")
    result = await db.execute(
        select(Project).offset(skip).limit(limit)
    )
    projects = result.scalars().all()
    return projects

# POST /projects (полный путь: /api/v1/projects)
@router.post("")  # 👈 тоже пустая строка
async def create_project(
    name: str,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new project."""
    project = Project(name=name, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project

# GET /projects/{project_id} (полный путь: /api/v1/projects/{id})
@router.get("/{project_id}")
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get project by ID."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project

# POST /projects/{project_id}/graphs (полный путь: /api/v1/projects/{id}/graphs)
@router.post("/{project_id}/graphs")
async def create_graph(
    project_id: int,
    name: str,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new graph in project."""
    # Check if project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    graph = Graph(project_id=project_id, name=name, description=description)
    db.add(graph)
    await db.commit()
    await db.refresh(graph)
    return graph

# GET /projects/{project_id}/graphs (полный путь: /api/v1/projects/{id}/graphs)
@router.get("/{project_id}/graphs")
async def list_project_graphs(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all graphs in a project."""
    # Check if project exists
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    graphs_result = await db.execute(
        select(Graph).where(Graph.project_id == project_id)
    )
    return graphs_result.scalars().all()

# PUT /projects/{project_id} (полный путь: /api/v1/projects/{id})
@router.put("/{project_id}")
async def update_project(
    project_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Update a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    if name:
        project.name = name
    if description:
        project.description = description
    
    await db.commit()
    await db.refresh(project)
    return project

# DELETE /projects/{project_id} (полный путь: /api/v1/projects/{id})
@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a project."""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    
    await db.delete(project)
    await db.commit()
    return {"message": f"Project {project_id} deleted"}

--- app/api/routes/schema.py (hash: 53c4ba43) ---
// размер: 93 строк
"""
Schema management endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any
import logging

from app.database import get_db
from app.services.schema_service import SchemaService
from app.models.project import Project
from app.models.schema import NodeType, EdgeType
from app.api.deps import get_project
from app.core.exceptions import SchemaValidationError

router = APIRouter(prefix="/projects/{project_id}/schema", tags=["schema"])
logger = logging.getLogger(__name__)

@router.put("")
async def update_schema(
    project_id: int,
    schema_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Update project schema."""
    try:
        service = SchemaService(db)
        schema = await service.create_or_update_schema(project_id, schema_data)
        return {
            "status": "success",
            "message": "Schema updated",
            "version": schema.version
        }
    except SchemaValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating schema: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("")
async def get_schema(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get project schema."""
    try:
        service = SchemaService(db)
        schema = await service.get_schema(project_id)
        if not schema:
            raise HTTPException(status_code=404, detail="Schema not found")
        return schema
    except Exception as e:
        logger.error(f"Error getting schema: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/node-types")
async def get_node_types(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get all node types for project."""
    try:
        result = await db.execute(
            select(NodeType).where(NodeType.project_id == project_id)
        )
        types = result.scalars().all()
        return types
    except Exception as e:
        logger.error(f"Error getting node types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/edge-types")
async def get_edge_types(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    project: Project = Depends(get_project)
):
    """Get all edge types for project."""
    try:
        result = await db.execute(
            select(EdgeType).where(EdgeType.project_id == project_id)
        )
        types = result.scalars().all()
        return types
    except Exception as e:
        logger.error(f"Error getting edge types: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

--- app/config.py (hash: 820d42a5) ---
// размер: 64 строк
""""
Configuration management using Pydantic settings.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator
import json
import os

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    """
    # Database
    DATABASE_URL: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Redis
    REDIS_URL: str

    # Application
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        """Parse CORS origins from string or list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # File upload
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_UPLOAD_EXTENSIONS: List[str] = [".json", ".csv", ".graphml"]

    # Graph settings
    MAX_NODES_PER_GRAPH: int = 5000
    MAX_EDGES_PER_GRAPH: int = 50000

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Игнорировать лишние поля

# Create global settings instance
settings = Settings()

# Validate critical settings
if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == "your-secret-key-here-change-in-production":
    raise ValueError("SECRET_KEY must be changed in production!")


--- app/database.py (hash: 5ef709dd) ---
// размер: 71 строк
"""
Database configuration and session management.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, declared_attr
from typing import AsyncGenerator
import logging

from app.config import settings

# Configure logging
logger = logging.getLogger(__name__)

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

class Base:
    """Base class for SQLAlchemy models with common attributes."""

    @declared_attr
    def __tablename__(cls):
        """Generate table name automatically."""
        return cls.__name__.lower()

    # Common columns can be added here
    # id = Column(Integer, primary_key=True, index=True)
    # created_at = Column(DateTime, default=datetime.utcnow)
    # updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create declarative base
Base = declarative_base(cls=Base)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for getting database sessions.

    Yields:
        AsyncSession: Database session
    """
    session = AsyncSessionLocal()
    try:
        yield session
    except Exception as e:
        logger.error(f"Database session error: {e}")
        await session.rollback()
        raise
    finally:
        await session.close()

async def init_db() -> None:
    """Initialize database (for development only)."""
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")
