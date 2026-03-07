# Encapsulation Violations Report

This document summarizes the encapsulation violations detected in the `desloppify` project. A full list of 418 violations with exact file paths and line numbers is available in the `EVIDENCE_LIST.txt` file within this repository.

## Summary of Violations

The violations primarily involve importing internal modules and schemas directly, instead of using the intended public API. This compromises the encapsulation of the `desloppify` engine and can lead to instability and maintenance issues.

Most violations occur in the `intelligence` directory, specifically within the `review` subdirectories. A significant number of violations also appear in the `app` directory.

## Sample Violations

Here are a few examples of the most egregious violations:

1.  `./target-hunt/desloppify/intelligence/integrity.py:11:from desloppify.engine._scoring.policy.core import (...)` - Direct import from a private module.
2.  `./target-hunt/desloppify/intelligence/review/context.py:15:from desloppify.engine._state.schema import StateModel` - Direct import of the `StateModel` schema.
3.  `./target-hunt/desloppify/intelligence/review/context_builder.py:9:from desloppify.engine._state.schema import StateModel` - Another direct import of the `StateModel` schema.

These examples highlight the pattern of direct imports that bypass the intended encapsulation boundaries. Addressing these violations will improve the overall architecture and maintainability of the `desloppify` project.

The full raw list of 418 violations is available in this repository.