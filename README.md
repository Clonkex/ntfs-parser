# NodeJS NTFS Parser

Crappy, half-finished NTFS parser written in TypeScript using NodeJS. Doesn't do anything useful yet, but can read dd images of individual NTFS partitions and list out some data about the MFT (so long as nothing's corrupted). The intention is that it will gracefully handle corruption to allow partial recovery where possible.

Doesn't yet attempt to handle partition tables or anything.