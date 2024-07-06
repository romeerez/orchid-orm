# orchid-orm-valibot

## 0.2.17

### Patch Changes

- 1285118: Fix migration gen: handle column changes together with primaryKey/index/foreignKey/check changes (#316)
- Updated dependencies [1285118]
  - pqb@0.36.8
  - orchid-core@0.19.3

## 0.2.16

### Patch Changes

- Updated dependencies [e7656c4]
  - pqb@0.36.7

## 0.2.15

### Patch Changes

- Updated dependencies [15cdb45]
  - pqb@0.36.6

## 0.2.14

### Patch Changes

- Updated dependencies [690ecad]
  - pqb@0.36.5

## 0.2.13

### Patch Changes

- Updated dependencies [c9697c9]
  - pqb@0.36.4

## 0.2.12

### Patch Changes

- Updated dependencies [aa9ee08]
  - pqb@0.36.3
  - orchid-core@0.19.2

## 0.2.11

### Patch Changes

- Updated dependencies [57e9e9c]
  - pqb@0.36.2
  - orchid-core@0.19.1

## 0.2.10

### Patch Changes

- Updated dependencies [8d076c6]
  - pqb@0.36.1

## 0.2.9

### Patch Changes

- Updated dependencies [f278b19]
  - pqb@0.36.0
  - orchid-core@0.19.0

## 0.2.8

### Patch Changes

- Updated dependencies [3b9228c]
  - pqb@0.35.7

## 0.2.7

### Patch Changes

- Updated dependencies [1663d8b]
  - pqb@0.35.6

## 0.2.6

### Patch Changes

- Updated dependencies [e8682bf]
  - orchid-core@0.18.2
  - pqb@0.35.5

## 0.2.5

### Patch Changes

- Updated dependencies [b54bca1]
  - pqb@0.35.4

## 0.2.4

### Patch Changes

- Updated dependencies [7546bc8]
  - pqb@0.35.3
  - orchid-core@0.18.1

## 0.2.3

### Patch Changes

- Updated dependencies [c2ee6a9]
  - pqb@0.35.2

## 0.2.2

### Patch Changes

- Updated dependencies [8cde8eb]
  - pqb@0.35.1

## 0.2.1

### Patch Changes

- Updated dependencies [8dd2832]
  - pqb@0.35.0
  - orchid-core@0.18.0

## 0.2.0

### Minor Changes

- 9eb720a: Change `text`, `varchar` types, remove `char` (#277)

  The text no longer accepts min and max: `text(min, max)` -> `text()`

  Varchar's limit becomes required: `varchar(limit?: number)` -> `varchar(limit: number)`

### Patch Changes

- Updated dependencies [9eb720a]
  - pqb@0.34.0
  - orchid-core@0.17.0

## 0.1.24

### Patch Changes

- Updated dependencies [353d06a]
  - pqb@0.33.2

## 0.1.23

### Patch Changes

- Updated dependencies [9c82aca]
  - pqb@0.33.1
  - orchid-core@0.16.1

## 0.1.22

### Patch Changes

- Updated dependencies [ee49636]
  - pqb@0.33.0
  - orchid-core@0.16.0

## 0.1.21

### Patch Changes

- Updated dependencies [fb7fdf6]
  - pqb@0.32.0

## 0.1.20

### Patch Changes

- Updated dependencies [d42bdb3]
  - pqb@0.31.9

## 0.1.19

### Patch Changes

- Updated dependencies [61215ad]
  - pqb@0.31.8
  - orchid-core@0.15.6

## 0.1.18

### Patch Changes

- Updated dependencies [9e3f1c9]
  - pqb@0.31.7

## 0.1.17

### Patch Changes

- Updated dependencies [8f06156]
  - pqb@0.31.6

## 0.1.16

### Patch Changes

- Updated dependencies [d5390af]
  - pqb@0.31.5

## 0.1.15

### Patch Changes

- Updated dependencies [16cbe41]
  - pqb@0.31.4

## 0.1.14

### Patch Changes

- Updated dependencies [77f0c75]
  - pqb@0.31.3

## 0.1.13

### Patch Changes

- Updated dependencies [f0b1e0e]
  - pqb@0.31.2

## 0.1.12

### Patch Changes

- Updated dependencies [6a0d06d]
  - pqb@0.31.1
  - orchid-core@0.15.5

## 0.1.11

### Patch Changes

- Updated dependencies [f27f8c4]
  - pqb@0.31.0

## 0.1.10

### Patch Changes

- Updated dependencies [5a21099]
- Updated dependencies [5a21099]
  - pqb@0.30.7
  - orchid-core@0.15.4

## 0.1.9

### Patch Changes

- Updated dependencies [147091d]
  - pqb@0.30.6
  - orchid-core@0.15.3

## 0.1.8

### Patch Changes

- 859c4cd: Accept readonly arrays in enum type (#269)
- Updated dependencies [859c4cd]
  - pqb@0.30.5

## 0.1.7

### Patch Changes

- Updated dependencies [8095627]
  - pqb@0.30.4

## 0.1.6

### Patch Changes

- Updated dependencies [98ad6a6]
  - pqb@0.30.3
  - orchid-core@0.15.2

## 0.1.5

### Patch Changes

- Updated dependencies [8ef6411]
- Updated dependencies [6ee467f]
  - pqb@0.30.2

## 0.1.4

### Patch Changes

- Updated dependencies [4e9082f]
  - pqb@0.30.1
  - orchid-core@0.15.1

## 0.1.3

### Patch Changes

- Updated dependencies [e92cebd]
  - pqb@0.30.0
  - orchid-core@0.15.0

## 0.1.2

### Patch Changes

- Updated dependencies [bdef5b0]
  - pqb@0.29.1
  - orchid-core@0.14.1

## 0.1.1

### Patch Changes

- Updated dependencies [1aa1fb3]
  - pqb@0.29.0

## 0.1.0

### Minor Changes

- e254c22: - Rework composite indexes, primary and foreign keys.

  - Change `findBy` to filter only by unique columns.
  - `onConflict` now will require columns for `merge`, and it can also accept a constraint name.

  See the BREAKING_CHANGE.md at orchid-orm 1.26 at the repository root for details.

### Patch Changes

- Updated dependencies [e254c22]
  - pqb@0.28.0
  - orchid-core@0.14.0

## 0.0.17

### Patch Changes

- 907b2b8: Synchronize libraries by publishing them
- Updated dependencies [907b2b8]
  - pqb@0.27.7
  - orchid-core@0.13.4

## 0.0.16

### Patch Changes

- 929f49b: Minor fixes

## 0.0.15

### Patch Changes

- 555b4f6c: Fix `min` and `max` methods for date columns
- Updated dependencies [05590044]
- Updated dependencies [c94339ad]
  - pqb@0.27.6

## 0.0.14

### Patch Changes

- 2385c314: Hide default `parse` method from code generated for timestamps
- Updated dependencies [2385c314]
  - pqb@0.27.5

## 0.0.13

### Patch Changes

- Updated dependencies [465827b1]
  - pqb@0.27.4
  - orchid-core@0.13.3

## 0.0.12

### Patch Changes

- Updated dependencies [14465bf7]
  - pqb@0.27.3
  - orchid-core@0.13.2

## 0.0.11

### Patch Changes

- Updated dependencies [0a2795d6]
  - pqb@0.27.2
  - orchid-core@0.13.1

## 0.0.10

### Patch Changes

- Updated dependencies [ca5d8543]
  - pqb@0.27.1

## 0.0.9

### Patch Changes

- Updated dependencies [ba3d9c2e]
  - pqb@0.27.0
  - orchid-core@0.13.0

## 0.0.8

### Patch Changes

- Updated dependencies [79da9a41]
  - pqb@0.26.7
  - orchid-core@0.12.4

## 0.0.7

### Patch Changes

- f6dacede: Fix type in valibot
- Updated dependencies [f6dacede]
  - pqb@0.26.6

## 0.0.6

### Patch Changes

- Updated dependencies [04e441da]
  - pqb@0.26.5

## 0.0.5

### Patch Changes

- Updated dependencies [ff771568]
  - pqb@0.26.4
  - orchid-core@0.12.3

## 0.0.4

### Patch Changes

- Updated dependencies [216988fc]
  - pqb@0.26.3

## 0.0.3

### Patch Changes

- Updated dependencies [7e7fb35c]
  - orchid-core@0.12.2
  - pqb@0.26.2

## 0.0.2

### Patch Changes

- Updated dependencies [f0324edb]
  - pqb@0.26.1

## 0.0.1

### Patch Changes

- 012752d0: Add valibot integration
- Updated dependencies [012752d0]
  - pqb@0.26.0
  - orchid-core@0.12.1
