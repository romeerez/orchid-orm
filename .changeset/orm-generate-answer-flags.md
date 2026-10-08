---
'orchid-orm': patch
---

Add `--rename`, `--create`, and `--recreate` flags to answer migration generator questions. If questions remain unanswered without a terminal or with `--non-interactive`, the command lists them with the flags to answer them and writes no migration (#777)
