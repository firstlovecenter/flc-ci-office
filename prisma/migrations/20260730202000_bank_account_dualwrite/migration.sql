-- Bank-account split, DUAL-WRITE phase.
--
-- Keeps bankAccountId in step with organisationId for any row written while the
-- application still targets organisationId. Implemented as a trigger rather than
-- edits at the 8 call sites: it cannot be forgotten by a new code path, and it
-- also covers migrations and manual SQL.
--
-- Dropped in the contract migration once nothing writes organisationId for
-- accounts any more.

CREATE OR REPLACE FUNCTION sync_bank_account_id() RETURNS TRIGGER AS $$
BEGIN
    IF NEW."bankAccountId" IS NULL AND NEW."organisationId" IS NOT NULL THEN
        SELECT id INTO NEW."bankAccountId"
        FROM "BankAccount" WHERE id = NEW."organisationId";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_sync_bank_account
    BEFORE INSERT OR UPDATE ON "Transaction"
    FOR EACH ROW EXECUTE FUNCTION sync_bank_account_id();

CREATE TRIGGER userrole_sync_bank_account
    BEFORE INSERT OR UPDATE ON "UserRole"
    FOR EACH ROW EXECUTE FUNCTION sync_bank_account_id();

CREATE TRIGGER user_sync_bank_account
    BEFORE INSERT OR UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION sync_bank_account_id();
