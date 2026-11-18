# Config Import Examples

Worked examples for the `___import` tag. Every example below is a real config from the test set, with the **stored** form (what `GET ...?raw=true` and the UI editor show) and the **resolved** form (what a normal API read returns).

- Configs live under `/config/test/`, so `test/imp_import1` means `/config/test/imp_import1`.
- Files prefixed `imp_` are only used as import sources.
- Results below were produced by running the real resolver against these configs, with a token that can read `/config/test` only.
- Reference: see "Config Imports" in the README for the full tag description and error codes.

```json
"___import": {
  "source": "test/imp_import1",
  "priority": "keep | overwrite",
  "filter": "<optional JSONPath>"
}
```

## Source configs

These configs are only ever imported by the examples below (they carry the `imp_` prefix).

### `imp_import1`

The main source used by most examples.

Stored (`/config/test/imp_import1`):

```json
{
  "test_string": "This is a test string",
  "test_number": 123,
  "test_object": {
    "object_field1": "This is a nested string"
  },
  "not-test-object": "this shoudl not be included with filter"
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123,
  "test_object": {
    "object_field1": "This is a nested string"
  },
  "not-test-object": "this shoudl not be included with filter"
}
```

### `imp_source_overlap`

Source with overlapping keys, used for `keep` / `overwrite` and deep-merge examples.

Stored (`/config/test/imp_source_overlap`):

```json
{
  "host": "imported-host",
  "port": 5432,
  "pool": {
    "min": 1,
    "max": 10
  },
  "tags": [
    "imported"
  ],
  "mixed": {
    "a": 1
  }
}
```

Resolved:

```json
{
  "host": "imported-host",
  "port": 5432,
  "pool": {
    "min": 1,
    "max": 10
  },
  "tags": [
    "imported"
  ],
  "mixed": {
    "a": 1
  }
}
```

### `imp_subtree_src/a`

Part of a folder source (`imp_subtree_src`).

Stored (`/config/test/imp_subtree_src/a`):

```json
{
  "from_a": 1
}
```

Resolved:

```json
{
  "from_a": 1
}
```

### `imp_subtree_src/b`

Part of a folder source (`imp_subtree_src`).

Stored (`/config/test/imp_subtree_src/b`):

```json
{
  "from_b": {
    "deep": true
  }
}
```

Resolved:

```json
{
  "from_b": {
    "deep": true
  }
}
```

### `imp_chain_l3`

Last link of the nested chain.

Stored (`/config/test/imp_chain_l3`):

```json
{
  "l3_value": "from level 3",
  "shared": "l3"
}
```

Resolved:

```json
{
  "l3_value": "from level 3",
  "shared": "l3"
}
```

## Basic imports

### `simple_import`

Import the whole source. The tag is removed and the imported keys appear in its place.

Stored (`/config/test/simple_import`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "priority": "overwrite"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123,
  "test_object": {
    "object_field1": "This is a nested string"
  },
  "not-test-object": "this shoudl not be included with filter"
}
```

### `sub_level_import`

The tag can sit inside a nested object; keys are inserted at that level.

Stored (`/config/test/sub_level_import`):

```json
{
  "imported_content": {
    "___import": {
      "source": "test/imp_import1",
      "priority": "overwrite"
    }
  },
  "another_field": "another field not imported"
}
```

Resolved:

```json
{
  "imported_content": {
    "test_string": "This is a test string",
    "test_number": 123,
    "test_object": {
      "object_field1": "This is a nested string"
    },
    "not-test-object": "this shoudl not be included with filter"
  },
  "another_field": "another field not imported"
}
```

### `sub_level_deep`

Several imports at different levels of one document.

Stored (`/config/test/sub_level_deep`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$.test_object"
  },
  "level1": {
    "___import": {
      "source": "test/imp_import1",
      "filter": "$.test_string"
    },
    "level2": {
      "___import": {
        "source": "test/imp_import1",
        "filter": "$.test_number"
      }
    }
  }
}
```

Resolved:

```json
{
  "level1": {
    "level2": {
      "test_number": 123
    },
    "test_string": "This is a test string"
  },
  "test_object": {
    "object_field1": "This is a nested string"
  }
}
```

### `array_with_imports`

A tag inside an array item resolves within that item.

Stored (`/config/test/array_with_imports`):

```json
{
  "servers": [
    {
      "name": "a",
      "___import": {
        "source": "test/imp_import1",
        "filter": "$.test_string"
      }
    },
    {
      "name": "b"
    }
  ]
}
```

Resolved:

```json
{
  "servers": [
    {
      "name": "a",
      "test_string": "This is a test string"
    },
    {
      "name": "b"
    }
  ]
}
```

### `source_form_absolute`

`source` may be written with the `/config` prefix.

Stored (`/config/test/source_form_absolute`):

```json
{
  "___import": {
    "source": "/config/test/imp_import1",
    "filter": "$.test_number"
  }
}
```

Resolved:

```json
{
  "test_number": 123
}
```

### `source_form_leading_slash`

`source` may be written with just a leading slash.

Stored (`/config/test/source_form_leading_slash`):

```json
{
  "___import": {
    "source": "/test/imp_import1",
    "filter": "$.test_number"
  }
}
```

Resolved:

```json
{
  "test_number": 123
}
```

### `no_imports_plain`

A config with no imports is returned exactly as stored.

Stored (`/config/test/no_imports_plain`):

```json
{
  "a": 1,
  "nested": {
    "b": [
      1,
      2,
      3
    ]
  }
}
```

Resolved:

```json
{
  "a": 1,
  "nested": {
    "b": [
      1,
      2,
      3
    ]
  }
}
```

## Priority and merging

`keep` (default): the importing config wins on conflict. `overwrite`: the imported value wins. Objects present on both sides are merged recursively; arrays and scalars are replaced or kept whole.

### `priority_keep`

Explicit `keep`.

Stored (`/config/test/priority_keep`):

```json
{
  "host": "local-host",
  "pool": {
    "max": 99,
    "idle": 5
  },
  "tags": [
    "local"
  ],
  "mixed": "was-a-string",
  "___import": {
    "source": "test/imp_source_overlap",
    "priority": "keep"
  }
}
```

Resolved:

```json
{
  "host": "local-host",
  "pool": {
    "max": 99,
    "idle": 5,
    "min": 1
  },
  "tags": [
    "local"
  ],
  "mixed": "was-a-string",
  "port": 5432
}
```

### `priority_default`

`priority` omitted behaves as `keep`.

Stored (`/config/test/priority_default`):

```json
{
  "host": "local-host",
  "pool": {
    "max": 99,
    "idle": 5
  },
  "tags": [
    "local"
  ],
  "mixed": "was-a-string",
  "___import": {
    "source": "test/imp_source_overlap"
  }
}
```

Resolved:

```json
{
  "host": "local-host",
  "pool": {
    "max": 99,
    "idle": 5,
    "min": 1
  },
  "tags": [
    "local"
  ],
  "mixed": "was-a-string",
  "port": 5432
}
```

### `priority_overwrite`

`overwrite`.

Stored (`/config/test/priority_overwrite`):

```json
{
  "host": "local-host",
  "pool": {
    "max": 99,
    "idle": 5
  },
  "tags": [
    "local"
  ],
  "mixed": "was-a-string",
  "___import": {
    "source": "test/imp_source_overlap",
    "priority": "overwrite"
  }
}
```

Resolved:

```json
{
  "host": "imported-host",
  "pool": {
    "max": 10,
    "idle": 5,
    "min": 1
  },
  "tags": [
    "imported"
  ],
  "mixed": {
    "a": 1
  },
  "port": 5432
}
```

## Nested imports

### `imp_chain_l3`

(source) end of the chain

Stored (`/config/test/imp_chain_l3`):

```json
{
  "l3_value": "from level 3",
  "shared": "l3"
}
```

Resolved:

```json
{
  "l3_value": "from level 3",
  "shared": "l3"
}
```

### `chain_l2`

Imports `imp_chain_l3`.

Stored (`/config/test/chain_l2`):

```json
{
  "l2_value": "from level 2",
  "shared": "l2",
  "___import": {
    "source": "test/imp_chain_l3"
  }
}
```

Resolved:

```json
{
  "l2_value": "from level 2",
  "shared": "l2",
  "l3_value": "from level 3"
}
```

### `chain_l1`

Imports `chain_l2`.

Stored (`/config/test/chain_l1`):

```json
{
  "l1_value": "from level 1",
  "shared": "l1",
  "___import": {
    "source": "test/chain_l2"
  }
}
```

Resolved:

```json
{
  "l1_value": "from level 1",
  "shared": "l1",
  "l2_value": "from level 2",
  "l3_value": "from level 3"
}
```

### `chain_top_keep`

Four levels deep; the importing config keeps its own `shared`.

Stored (`/config/test/chain_top_keep`):

```json
{
  "top_value": "top",
  "shared": "top",
  "___import": {
    "source": "test/chain_l1"
  }
}
```

Resolved:

```json
{
  "top_value": "top",
  "shared": "top",
  "l1_value": "from level 1",
  "l2_value": "from level 2",
  "l3_value": "from level 3"
}
```

### `chain_top_overwrite`

Same chain, `overwrite` at the top level replaces `shared`.

Stored (`/config/test/chain_top_overwrite`):

```json
{
  "top_value": "top",
  "shared": "top",
  "___import": {
    "source": "test/chain_l1",
    "priority": "overwrite"
  }
}
```

Resolved:

```json
{
  "top_value": "top",
  "shared": "l1",
  "l1_value": "from level 1",
  "l2_value": "from level 2",
  "l3_value": "from level 3"
}
```

## Filters (JSONPath)

`filter` selects what to import. Each match contributes its last path segment as the key. With no filter the whole source is imported.

### `import_with_simple_filter`

Pick one key.

Stored (`/config/test/import_with_simple_filter`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "priority": "overwrite",
    "filter": "$.test_object"
  }
}
```

Resolved:

```json
{
  "test_object": {
    "object_field1": "This is a nested string"
  }
}
```

### `filter_bracket_key`

Bracket notation for keys with special characters such as hyphens.

Stored (`/config/test/filter_bracket_key`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$['not-test-object']"
  }
}
```

Resolved:

```json
{
  "not-test-object": "this shoudl not be included with filter"
}
```

### `filter_nested_key`

`$..key` finds a key at any depth; it is inserted at the top level of the importing object.

Stored (`/config/test/filter_nested_key`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$..object_field1"
  }
}
```

Resolved:

```json
{
  "object_field1": "This is a nested string"
}
```

### `filter_root`

`$` imports the whole object.

Stored (`/config/test/filter_root`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123,
  "test_object": {
    "object_field1": "This is a nested string"
  },
  "not-test-object": "this shoudl not be included with filter"
}
```

### `filter_no_match`

A filter that matches nothing imports nothing (not an error).

Stored (`/config/test/filter_no_match`):

```json
{
  "local_key": "only me",
  "___import": {
    "source": "test/imp_import1",
    "filter": "$.does_not_exist"
  }
}
```

Resolved:

```json
{
  "local_key": "only me"
}
```

### `import_with_wildcard_filter`

Only keys starting with `test_`.

Stored (`/config/test/import_with_wildcard_filter`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "priority": "overwrite",
    "filter": "$[?(@property.startsWith('test_'))]"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123,
  "test_object": {
    "object_field1": "This is a nested string"
  }
}
```

### `filter_regex`

Regular expression on the key name.

Stored (`/config/test/filter_regex`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$[?(@property.match(/^test_(string|number)$/))]"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123
}
```

### `filter_multiple_matches_keep`

Wildcard filter combined with a conflicting local key and default `keep`.

Stored (`/config/test/filter_multiple_matches_keep`):

```json
{
  "test_string": "local wins",
  "___import": {
    "source": "test/imp_import1",
    "filter": "$[?(@property.startsWith('test_'))]"
  }
}
```

Resolved:

```json
{
  "test_string": "local wins",
  "test_number": 123,
  "test_object": {
    "object_field1": "This is a nested string"
  }
}
```

### `import_with_single_exclude`

Exclude one key.

Stored (`/config/test/import_with_single_exclude`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "priority": "overwrite",
    "filter": "$[?(@property !== 'test_object')]"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123,
  "not-test-object": "this shoudl not be included with filter"
}
```

### `filter_exclude_multiple`

Exclude several named keys.

Stored (`/config/test/filter_exclude_multiple`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$[?(@property !== 'test_object' && @property !== 'test_number')]"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "not-test-object": "this shoudl not be included with filter"
}
```

### `filter_exclude_wildcard`

Exclude by wildcard (everything not starting with `test_`).

Stored (`/config/test/filter_exclude_wildcard`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$[?(!@property.startsWith('test_'))]"
  }
}
```

Resolved:

```json
{
  "not-test-object": "this shoudl not be included with filter"
}
```

### `filter_exclude_array_includes`

Exclude using an array and `includes`.

Stored (`/config/test/filter_exclude_array_includes`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$[?(!['test_object','not-test-object'].includes(@property))]"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string",
  "test_number": 123
}
```

### `nested_filter_src`

(source that itself imports)

Stored (`/config/test/nested_filter_src`):

```json
{
  "keep_me": 1,
  "drop_me": 2,
  "___import": {
    "source": "test/imp_import1",
    "filter": "$.test_string"
  }
}
```

Resolved:

```json
{
  "keep_me": 1,
  "drop_me": 2,
  "test_string": "This is a test string"
}
```

### `filter_on_own_key`

Filter selects a key of the source itself.

Stored (`/config/test/filter_on_own_key`):

```json
{
  "___import": {
    "source": "test/nested_filter_src",
    "filter": "$.keep_me"
  }
}
```

Resolved:

```json
{
  "keep_me": 1
}
```

### `filter_on_resolved_import`

The filter runs after the source has resolved its own imports.

Stored (`/config/test/filter_on_resolved_import`):

```json
{
  "___import": {
    "source": "test/nested_filter_src",
    "filter": "$.test_string"
  }
}
```

Resolved:

```json
{
  "test_string": "This is a test string"
}
```

## Folder (subtree) sources

Importing a path that has child configs gives one key per child.

### `import_subtree`

Whole folder.

Stored (`/config/test/import_subtree`):

```json
{
  "___import": {
    "source": "test/imp_subtree_src"
  }
}
```

Resolved:

```json
{
  "a": {
    "from_a": 1
  },
  "b": {
    "from_b": {
      "deep": true
    }
  }
}
```

### `import_subtree_filtered`

Folder with a filter.

Stored (`/config/test/import_subtree_filtered`):

```json
{
  "___import": {
    "source": "test/imp_subtree_src",
    "filter": "$.a"
  }
}
```

Resolved:

```json
{
  "a": {
    "from_a": 1
  }
}
```

## Errors

Import errors return **422** with a `code`, `source` and `importedFrom`; an unreadable source returns **403**.

### `err_circular_a`

Two-way cycle (also `err_circular_b`).

Stored (`/config/test/err_circular_a`):

```json
{
  "___import": {
    "source": "test/err_circular_b"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "CIRCULAR_IMPORT",
  "message": "Circular import detected: /config/test/err_circular_a -> /config/test/err_circular_b -> /config/test/err_circular_a"
}
```

`err_circular_b` stored:

```json
{
  "___import": {
    "source": "test/err_circular_a"
  }
}
```

### `err_self_import`

A config importing itself.

Stored (`/config/test/err_self_import`):

```json
{
  "___import": {
    "source": "test/err_self_import"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "CIRCULAR_IMPORT",
  "message": "Circular import detected: /config/test/err_self_import -> /config/test/err_self_import"
}
```

### `err_cycle_x`

Three-way cycle (`x` -> `y` -> `z` -> `x`).

Stored (`/config/test/err_cycle_x`):

```json
{
  "___import": {
    "source": "test/err_cycle_y"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "CIRCULAR_IMPORT",
  "message": "Circular import detected: /config/test/err_cycle_x -> /config/test/err_cycle_y -> /config/test/err_cycle_z -> /config/test/err_cycle_x"
}
```

`err_cycle_y` stored:

```json
{
  "___import": {
    "source": "test/err_cycle_z"
  }
}
```

`err_cycle_z` stored:

```json
{
  "___import": {
    "source": "test/err_cycle_x"
  }
}
```

### `err_missing_source`

Source does not exist.

Stored (`/config/test/err_missing_source`):

```json
{
  "___import": {
    "source": "test/does_not_exist"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "SOURCE_NOT_FOUND",
  "message": "Import source not found: /config/test/does_not_exist (imported from /config/test/err_missing_source)"
}
```

### `err_nested_missing`

The missing source is two levels down; the error names the deeper config.

Stored (`/config/test/err_nested_missing`):

```json
{
  "ok": true,
  "___import": {
    "source": "test/err_missing_source"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "SOURCE_NOT_FOUND",
  "message": "Import source not found: /config/test/does_not_exist (imported from /config/test/err_missing_source)"
}
```

### `err_no_source`

Tag without `source`.

Stored (`/config/test/err_no_source`):

```json
{
  "___import": {
    "priority": "keep"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "INVALID_IMPORT_TAG",
  "message": "___import in /config/test/err_no_source requires a valid \"source\" path"
}
```

### `err_bad_priority`

`priority` is not `keep` or `overwrite`.

Stored (`/config/test/err_bad_priority`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "priority": "sometimes"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "INVALID_IMPORT_TAG",
  "message": "___import of /config/test/imp_import1 in /config/test/err_bad_priority has invalid priority \"sometimes\" (expected keep or overwrite)"
}
```

### `err_tag_not_object`

`___import` is a string instead of an object.

Stored (`/config/test/err_tag_not_object`):

```json
{
  "___import": "test/imp_import1"
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "INVALID_IMPORT_TAG",
  "message": "___import in /config/test/err_tag_not_object must be an object"
}
```

### `err_filter_not_string`

`filter` is not a string.

Stored (`/config/test/err_filter_not_string`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": 123
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "INVALID_FILTER",
  "message": "___import of /config/test/imp_import1 in /config/test/err_filter_not_string has a filter that is not a non-empty JSONPath string"
}
```

### `err_empty_filter`

`filter` is an empty string.

Stored (`/config/test/err_empty_filter`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": ""
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "INVALID_FILTER",
  "message": "___import of /config/test/imp_import1 in /config/test/err_empty_filter has a filter that is not a non-empty JSONPath string"
}
```

### `err_invalid_filter`

`filter` is not valid JSONPath.

Stored (`/config/test/err_invalid_filter`):

```json
{
  "___import": {
    "source": "test/imp_import1",
    "filter": "$[?("
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "INVALID_FILTER",
  "message": "Invalid JSONPath filter \"$[?(\" in import of /config/test/imp_import1 (in /config/test/err_invalid_filter): Unexpected \"?\" at character 0"
}
```

### `deep_00`

Chain of 12 configs; exceeds `IMPORT_MAX_DEPTH` (default 10). `deep_01` .. `deep_11` resolve normally.

Stored (`/config/test/deep_00`):

```json
{
  "level": 0,
  "___import": {
    "source": "test/deep_01"
  }
}
```

Response: **422**

```json
{
  "error": "Unprocessable Entity",
  "code": "IMPORT_DEPTH_EXCEEDED",
  "message": "Import depth limit (10) exceeded: /config/test/deep_00 -> /config/test/deep_01 -> /config/test/deep_02 -> /config/test/deep_03 -> /config/test/deep_04 -> /config/test/deep_05 -> /config/test/deep_06 -> /config/test/deep_07 -> /config/test/deep_08 -> /config/test/deep_09 -> /config/test/deep_10 -> /config/test/deep_11"
}
```

Each `deep_NN` imports `deep_NN+1`; `deep_11` has no import.

### `err_forbidden_source`

The caller needs `read` on every imported source, not just on the requested config. Source is `/config/restricted/imp_creds`.

Stored (`/config/test/err_forbidden_source`):

```json
{
  "name": "needs read on /config/restricted",
  "___import": {
    "source": "restricted/imp_creds"
  }
}
```

Stored source (`/config/restricted/imp_creds`):

```json
{
  "password": "hunter2"
}
```

Token with read on `/config/test` only: **403**

```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN_SOURCE",
  "message": "Access denied: no read permission for imported source /config/restricted/imp_creds (imported from /config/test/err_forbidden_source)"
}
```

Token with read on `/config`: **200**

```json
{
  "name": "needs read on /config/restricted",
  "password": "hunter2"
}
```

## JSONPath filter cheat sheet

Filters are standard JSONPath with filter expressions on `@property` (the key name). Use **single quotes** inside the filter, because the tag is stored as JSON.

The tables below were run against this source:

```json
{
  "test_a": 1,
  "test_b": { "x": 1 },
  "other": 2,
  "secret": "s",
  "pw": "p",
  "nested": { "test_c": 3, "secret": "n", "z": 4 }
}
```

### Including keys

| Goal | `filter` | Keys imported |
|---|---|---|
| Keys starting with `test_` (top level) | `$[?(@property.startsWith('test_'))]` | `test_a`, `test_b` |
| Same, with a regex | `$[?(@property.match(/^test_/))]` | `test_a`, `test_b` |
| Same, with `indexOf` | `$[?(@property.indexOf('test_')===0)]` | `test_a`, `test_b` |
| Starting with `test_` at any depth | `$..[?(@property.startsWith('test_'))]` | `test_a`, `test_b`, `test_c` |

Matches found by `$..` are inserted at the level of the tag, so a nested `test_c` lands at the top level of the importing object. If the same key name appears at several depths the later match wins. Use `$[...]` to keep structure.

### Excluding keys

| Goal | `filter` | Keys imported |
|---|---|---|
| Exclude one field | `$[?(@property !== 'secret')]` | `test_a`, `test_b`, `other`, `pw`, `nested` |
| Exclude several named fields | `$[?(@property !== 'secret' && @property !== 'pw')]` | `test_a`, `test_b`, `other`, `nested` |
| Exclude several (array form) | `$[?(!['secret','pw'].includes(@property))]` | `test_a`, `test_b`, `other`, `nested` |
| Exclude by wildcard | `$[?(!@property.startsWith('test_'))]` | `other`, `secret`, `pw`, `nested` |
| Wildcard and named exclusion | `$[?(!@property.startsWith('test_') && @property !== 'secret')]` | `other`, `pw`, `nested` |
| Exclude by regex | `$[?(!@property.match(/^test_\|^secret$/))]` | `other`, `pw`, `nested` |

Exclusion works on top-level keys only. A kept key such as `nested` comes in with **all** of its contents, including `nested.secret`. Do not use `$..` for exclusions: it matches keys at every depth and flattens them into one level (for example `$..[?(@property !== 'secret')]` also returns `x`, `test_c` and `z` at the top level).

## Reading the stored form

| Request | Returns |
|---|---|
| `GET /config/test/simple_import` | resolved config (default for API consumers) |
| `GET /config/test/simple_import?raw=true` | stored config with the `___import` tag intact (used by the UI editor) |
