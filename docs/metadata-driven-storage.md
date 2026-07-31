# Metadata-driven project data storage

## Purpose

Nodex now has a generic project-domain layer alongside the existing canonical
import tables. It stores an imported project as three kinds of records:

- **entities**: a typed external key, label, and JSON attributes;
- **relations**: a typed connection between natural entity keys, optional time,
  direction, and JSON attributes;
- **facts**: the original typed observation payload.

Type definitions are synchronized from `app/configuration/domain_model.json`.
Adding a node type, relation type, or an attribute therefore does not require a
new SQL table or a database migration.

## Active storage model

Canonical CSV output is normalized directly into `project_domain_entities`,
`project_domain_relations`, and `project_domain_facts`. The active loading,
project statistics, generated communication graph, location timeline, and
base-station enrichment paths do not write or query the former per-dataset
project tables.

The former tables may remain in an upgraded database as inert legacy data.
They are not created by the active schema initializer and can be removed by a
separate, explicitly approved cleanup migration after the training projects
have been cleared.

The cell-tower reference (`cell_tower_reference`) is independent from project
training data and is never affected by clearing a project.

## Import plugin contract

An import plugin declares its domain output in `domain_contract`:

```python
class ExampleImportPlugin(ProjectDataImportPlugin):
    id = "example_import"
    domain_contract = {
        "entities": ["msisdn", "ip_address"],
        "relations": ["ip_msisdn_link"],
        "facts": ["example_observation"],
    }
```

The declaration is visible through the import-plugin API and is used as a
contract for the plugin editor. It is metadata, not executable SQL.
## Analysis plugin requirements

Graph plugins can declare what they consume without embedding this knowledge in
the editor:

```python
domain_requirements = {
    "entities": ["ip_address", "msisdn"],
    "relations": ["ip_msisdn_link"],
}
```

The built-in links plugins for user/MSISDN, IP/MSISDN, MSISDN/device,
"Recorded as", and address-book links now query the generic relations first.
Their supported data source is the generic relations store. Existing training projects should be cleared and re-imported before using the new release.

## Read API

All endpoints are under `/api/v1`:

- `GET /projects/{project_id}/domain/stats`
- `GET /projects/{project_id}/domain/entities?type_id=msisdn&query=7928`
- `GET /projects/{project_id}/domain/relations?relation_type=ip_msisdn_link`
- `GET /projects/{project_id}/domain/relations?entity_type=msisdn&entity_key=79283100198`

The endpoints initialize the generic tables and synchronize the type registry
when needed. They are read-only with respect to project facts.

## Clean transition

Training projects, graphs, and imported project data may be removed before a
production migration. Do not remove `cell_tower_reference`: it is the shared
base-station directory. After a clean transition, re-import source data into
the desired project so both legacy and generic layers are populated.

A later migration step will make canonical source datasets optional and allow
an import plugin to emit generic entities, relations, and facts directly.