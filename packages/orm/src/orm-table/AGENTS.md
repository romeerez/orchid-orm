# Table type contracts

`Selectable` must preserve the output type and nullability of each declared
column, including parsed custom PostgreSQL types. Guard this through table
factory definitions with both non-nullable and explicitly nullable columns;
include a rejected null assignment for non-nullable parsed outputs.
