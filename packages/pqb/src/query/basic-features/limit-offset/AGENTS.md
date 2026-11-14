# Limit and Offset Guidance

Test a limit or offset change both on a plain query and on a relation selected
through another relation with `chain`: the wrapping query that deduplicates its
records applies the limit and offset separately.
