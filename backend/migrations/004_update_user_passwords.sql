-- Migration 004: Update pre-seeded user account passwords to word123pass
-- SHA256('word123pass') = a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99
UPDATE users SET password_hash = 'a8adcd2d4dba9baa859db460f956b1f00a35000e448f662b97336d0d2664ca99';
